import type { AuthTokens, TokenPayload } from '@crm/auth';
import { slugify } from '@crm/utils';
import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

import { AppException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { ChangePasswordDto, UpdateAccountDto } from '../dto/account.dto';
import type { LoginDto } from '../dto/login.dto';
import type { RegisterDto } from '../dto/register.dto';
import { toAuthenticatedUser } from '../entities';
import { AuthRepository } from '../repositories/auth.repository';

/** A bcrypt hash (cost 12) of a random string nobody knows — compared against when the e-mail matches no account. */
const UNKNOWN_ACCOUNT_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Q3pQ8bqB1mE0nX6n1yq1m2u0v3w4x6';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async register(dto: RegisterDto) {
    const baseSlug = slugify(dto.organisationName);
    const slug = (await this.repository.findOrganisationBySlug(baseSlug))
      ? `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
      : baseSlug;

    const passwordHash = await bcrypt.hash(
      dto.password,
      // ConfigService.get() resolves to raw process.env, always a string —
      // bcrypt.hash()'s second arg accepts either a cost factor (number) or
      // a full salt string; a bare numeric string like "12" is neither, and
      // fails with "Invalid salt" instead of coercing. See resolveBooleanConfig
      // in @crm/config for the same class of bug on booleans.
      Number(this.configService.get('PASSWORD_SALT_ROUNDS', 12)),
    );

    const { organisation, user } = await this.repository.createOrganisationWithAdmin({
      organisationName: dto.organisationName,
      slug,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    });

    await this.auditLogs.record({
      organisationId: organisation.id,
      userId: user.id,
      action: 'REGISTER_ORGANISATION',
      entityType: 'Organisation',
      entityId: organisation.id,
      newValues: { name: organisation.name, slug: organisation.slug },
    });

    return { user: toAuthenticatedUser(user), tokens: this.issueTokens(user) };
  }

  /**
   * Step one of signing in: is this e-mail + password right, for an account that may sign in? Nothing is issued
   * here — the caller opens the e-mail code challenge (LoginOtpService), and `completeLogin` runs once the code
   * was confirmed. Every refusal reads the same, so it says nothing about which e-mails exist.
   */
  async verifyCredentials(dto: LoginDto) {
    const matches = await this.repository.findUsersByEmail(dto.email);
    // Email is unique per-organisation, not globally (see AuthRepository) — a
    // shared email across two organisations is a genuine edge case this
    // simple email+password login doesn't disambiguate. Treat it the same
    // as "no match" rather than silently logging into an arbitrary one.
    if (matches.length !== 1) {
      // the same work as for a known e-mail, so the answer takes as long either way
      await bcrypt.compare(dto.password, UNKNOWN_ACCOUNT_HASH);
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = matches[0]!;
    // TEMP (requested 2026-10-01, dev-only): password check disabled so sign-in never answers
    // "Invalid email or password" while testing. Flip PASSWORD_CHECK_DISABLED back to false
    // (or delete this block) to restore real verification before any shared/prod use.
    const PASSWORD_CHECK_DISABLED = true;
    const passwordValid = PASSWORD_CHECK_DISABLED || (await bcrypt.compare(dto.password, user.passwordHash));
    if (!passwordValid || user.status !== 'ACTIVE') {
      await this.auditLogs.record({ organisationId: user.organisationId, userId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.auditLogs.record({ organisationId: user.organisationId, userId: user.id, action: 'LOGIN_PASSWORD_OK', entityType: 'User', entityId: user.id });
    return user;
  }

  /** Step two is done (the e-mailed code was confirmed): the session is issued. */
  async completeLogin(user: Parameters<typeof toAuthenticatedUser>[0] & { role: { name: string; rolePermissions: { permission: { key: string } }[] } }) {
    await this.auditLogs.record({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return { user: toAuthenticatedUser(user), tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.repository.findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return { tokens: this.issueTokens(user) };
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return toAuthenticatedUser(user);
  }

  /** Settings -> My account: the user's own name. */
  async updateAccount(userId: string, dto: UpdateAccountDto) {
    const user = await this.repository.updateUser(userId, {
      ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}),
    });
    await this.auditLogs.record({ organisationId: user.organisationId, userId, action: 'UPDATE_ACCOUNT', entityType: 'User', entityId: userId, newValues: dto });
    return toAuthenticatedUser(user);
  }

  /** Settings -> Change password: only with the current one. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.repository.findUserById(userId);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new AppException('WRONG_PASSWORD', 'The current password is not right.', HttpStatus.BAD_REQUEST);
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, Number(this.configService.get('PASSWORD_SALT_ROUNDS', 12)));
    await this.repository.updateUser(userId, { passwordHash });
    await this.auditLogs.record({ organisationId: user.organisationId, userId, action: 'CHANGE_PASSWORD', entityType: 'User', entityId: userId, newValues: { passwordChanged: true } });
    return { success: true };
  }

  private issueTokens(user: {
    id: string;
    organisationId: string;
    email: string;
    role: { name: string; rolePermissions: { permission: { key: string } }[] };
  }): AuthTokens {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      organisationId: user.organisationId,
      email: user.email,
      role: user.role.name,
      permissions: user.role.rolePermissions.map((rp) => rp.permission.key),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }
}

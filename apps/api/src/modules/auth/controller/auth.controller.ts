import { CurrentUser, Public } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { resolveBooleanConfig } from '@crm/config';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  clearAuthCookies,
  clearChallengeCookie,
  LOGIN_CHALLENGE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  setChallengeCookie,
} from '../../../common/utils/auth-cookies';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResendOtpDto, ResetPasswordDto, UpdateAccountDto, VerifyOtpDto } from '../dto';
import { AuthService } from '../service/auth.service';
import { LoginOtpService } from '../service/login-otp.service';
import { PasswordResetService } from '../service/password-reset.service';

/**
 * By default e-mail + password sign in directly. For a user the admin switched the e-mail code on for (or for
 * everyone, with LOGIN_OTP_ENABLED=true) signing in takes two steps, every time:
 *   POST /auth/login       e-mail + password  -> a challenge is opened and a code is e-mailed; NO session yet
 *   POST /auth/verify-otp  the 6-digit code   -> the session cookies are issued
 * In between the browser only holds the challenge cookie, which no guard accepts as a session. The three sign-in
 * endpoints carry their own, much tighter rate limits than the rest of the API.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginOtp: LoginOtpService,
    private readonly passwordReset: PasswordResetService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.register(dto);
    setAuthCookies(res, tokens, this.configService);
    return { user, ...tokens };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.verifyCredentials(dto);

    // TEMP (requested 2026-10-01, dev-only): the e-mail-code step is fully disabled for now,
    // regardless of User.loginOtpEnabled / LOGIN_OTP_ENABLED. Flip OTP_DISABLED back to false
    // to restore the normal two-step challenge before any shared/prod use.
    const OTP_DISABLED = true;
    // E-mail + password sign in directly, unless the admin switched the e-mail code on for this user
    // (User.loginOtpEnabled) or it is on for everyone (LOGIN_OTP_ENABLED=true).
    if (OTP_DISABLED || (!user.loginOtpEnabled && !resolveBooleanConfig(this.configService.get('LOGIN_OTP_ENABLED'), false))) {
      const session = await this.authService.completeLogin(user);
      clearChallengeCookie(res, this.configService);
      setAuthCookies(res, session.tokens, this.configService);
      return { otpRequired: false, user: session.user, ...session.tokens };
    }

    const { token, view } = await this.loginOtp.start(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    // whatever session this browser still had is not the one being signed into
    clearAuthCookies(res, this.configService);
    setChallengeCookie(res, token, this.configService);
    return { otpRequired: true, ...view };
  }

  /** The pending challenge of this browser — what the verification page shows when it is opened or reloaded. */
  @Public()
  @Get('login-challenge')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  challenge(@Req() req: Request) {
    return this.loginOtp.describe(parseCookie(req, LOGIN_CHALLENGE_COOKIE));
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const challengeUser = await this.loginOtp.verify(dto.challengeToken ?? parseCookie(req, LOGIN_CHALLENGE_COOKIE), dto.code);
    const { user, tokens } = await this.authService.completeLogin(challengeUser);
    clearChallengeCookie(res, this.configService);
    setAuthCookies(res, tokens, this.configService);
    return { success: true, message: 'Authentication successful', user, ...tokens };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    return this.loginOtp.resend(dto.challengeToken ?? parseCookie(req, LOGIN_CHALLENGE_COOKIE));
  }

  /** "Back to sign in" on the verification page: the pending challenge is over. */
  @Public()
  @Post('cancel-login')
  @HttpCode(HttpStatus.OK)
  async cancelLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.loginOtp.cancel(parseCookie(req, LOGIN_CHALLENGE_COOKIE));
    clearChallengeCookie(res, this.configService);
    return { success: true };
  }

  /** "Forgot password": e-mails a link to choose a new one. The answer is the same for every e-mail address. */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.passwordReset.requestByEmail(dto.email, { ip: req.ip, userAgent: req.headers['user-agent'], origin: req.headers.origin });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.reset(dto.token, dto.password);
  }

  /** My Profile: the same link, for the signed-in user's own address. */
  @ApiBearerAuth()
  @Post('me/password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  myPasswordReset(@CurrentUser() user: TokenPayload, @Req() req: Request) {
    return this.passwordReset.requestForUser(user.sub, { ip: req.ip, userAgent: req.headers['user-agent'], origin: req.headers.origin });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = parseCookie(req, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'No refresh token present' };
    }

    const { tokens } = await this.authService.refresh(refreshToken);
    setAuthCookies(res, tokens, this.configService);
    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.loginOtp.cancel(parseCookie(req, LOGIN_CHALLENGE_COOKIE));
    clearChallengeCookie(res, this.configService);
    clearAuthCookies(res, this.configService);
    return { success: true };
  }

  @ApiBearerAuth()
  @Patch('me')
  updateAccount(@CurrentUser() user: TokenPayload, @Body() dto: UpdateAccountDto) {
    return this.authService.updateAccount(user.sub, dto);
  }

  @ApiBearerAuth()
  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@CurrentUser() user: TokenPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: TokenPayload) {
    return this.authService.me(user.sub);
  }
}

/** Express only auto-parses req.cookies when cookie-parser middleware is installed, which this app deliberately doesn't add (see JwtStrategy's own manual cookie extractor) — parse the one cookie we need here the same way. */
function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

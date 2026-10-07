import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

const USER_INCLUDE = {
  user: {
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} as const;

type ChallengeStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'CANCELLED';

/** The user a challenge belongs to, with what the session tokens are made of (same shape as AuthRepository's). */
export interface ChallengeUser {
  id: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  allowedSections: string[];
  createdAt: Date;
  updatedAt: Date;
  role: { id: string; name: string; rolePermissions: { permission: { key: string } }[] };
}

export interface StoredChallenge {
  id: string;
  userId: string;
  codeHash: string;
  status: ChallengeStatus;
  expiresAt: Date;
  closesAt: Date;
  attempts: number;
  maxAttempts: number;
  sendCount: number;
  lastSentAt: Date;
  user: ChallengeUser;
}

export interface NewChallenge {
  userId: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: Date;
  closesAt: Date;
  maxAttempts: number;
  requestIp?: string;
  userAgent?: string;
}

export interface ChallengeChanges {
  codeHash?: string;
  status?: ChallengeStatus;
  expiresAt?: Date;
  lastSentAt?: Date;
  sendCount?: number;
  attempts?: number;
}

/**
 * Login challenges live outside any tenant, like the rest of authentication (see AuthRepository): they exist before
 * a session does. Raw client on purpose.
 */
@Injectable()
export class LoginChallengesRepository {
  constructor(private readonly db: DatabaseService) {}

  create(data: NewChallenge): Promise<StoredChallenge> {
    return this.db.client.loginChallenge.create({ data, include: USER_INCLUDE });
  }

  findByTokenHash(tokenHash: string): Promise<StoredChallenge | null> {
    return this.db.client.loginChallenge.findUnique({ where: { tokenHash }, include: USER_INCLUDE });
  }

  update(id: string, data: ChallengeChanges): Promise<StoredChallenge> {
    return this.db.client.loginChallenge.update({ where: { id }, data, include: USER_INCLUDE });
  }

  /** One more try, only while tries are left. False when the limit was already reached. */
  async countAttempt(id: string, maxAttempts: number): Promise<boolean> {
    const { count } = await this.db.client.loginChallenge.updateMany({
      where: { id, status: 'PENDING', attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  }

  /** PENDING -> VERIFIED, once. False when another request got there first. */
  async claim(id: string): Promise<boolean> {
    const { count } = await this.db.client.loginChallenge.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    return count === 1;
  }

  /** A user has one live challenge at a time: a new login, a confirmed one and a logout all end the others. */
  async cancelPendingForUser(userId: string): Promise<void> {
    await this.db.client.loginChallenge.updateMany({ where: { userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  }
}

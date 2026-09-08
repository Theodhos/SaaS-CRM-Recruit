import { JwtStrategy } from '@crm/auth';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './controller/auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './service/auth.service';

/**
 * Authentication is deliberately isolated in its own module rather than
 * embedded in `users` — see docs/architecture/authentication.md. Every other
 * module authenticates via the globally-registered JwtAuthGuard
 * (apps/api/src/app.module.ts) and never re-implements token verification.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    {
      provide: JwtStrategy,
      useFactory: (config: ConfigService) =>
        new JwtStrategy(config.get<string>('JWT_ACCESS_SECRET')!),
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}

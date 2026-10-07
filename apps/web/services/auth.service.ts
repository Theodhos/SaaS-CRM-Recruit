import type { AuthenticatedUser } from '@crm/types';
import type { LoginInput, RegisterInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

/** The pending second step of a sign-in. The code and the challenge itself never reach the page's code. */
export interface LoginChallenge {
  /** The registered address, masked: "t***@gmail.com". */
  emailHint: string;
  codeLength: number;
  /** Seconds until the code that was just sent stops working. */
  expiresInSeconds: number;
  /** Seconds until the next code may be requested. */
  resendInSeconds: number;
  /** Development servers without a mail server only: the code itself (see the API's LoginOtpService). */
  devCode?: string;
}

/**
 * E-mail + password. Signs in directly (`otpRequired: false`, the session cookies are set) unless the API has the
 * e-mail code switched on (LOGIN_OTP_ENABLED) — then there is no session yet: a code was e-mailed and the challenge
 * lives in an httpOnly cookie.
 */
export function login(input: LoginInput) {
  return apiClient<({ otpRequired: true } & LoginChallenge) | { otpRequired: false; user: AuthenticatedUser }>('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export function getLoginChallenge() {
  return apiClient<LoginChallenge>('/auth/login-challenge');
}

/** Step two: the code. On success the API sets the session cookies. */
export function verifyLoginCode(code: string) {
  return apiClient<{ success: true; user: AuthenticatedUser }>('/auth/verify-otp', { method: 'POST', body: { code } });
}

export function resendLoginCode() {
  return apiClient<LoginChallenge>('/auth/resend-otp', { method: 'POST', body: {} });
}

export function cancelLogin() {
  return apiClient<{ success: boolean }>('/auth/cancel-login', { method: 'POST' });
}

/** Asking for a password reset link. `devLink`: development servers without a mail server only. */
export interface PasswordResetRequest {
  requested: true;
  devLink?: string;
}

/** "Forgot your password?" on the sign-in page. */
export function requestPasswordReset(email: string) {
  return apiClient<PasswordResetRequest>('/auth/forgot-password', { method: 'POST', body: { email } });
}

/** My Profile: the same link, to the signed-in user's own address. */
export function requestMyPasswordReset() {
  return apiClient<PasswordResetRequest>('/auth/me/password-reset', { method: 'POST' });
}

export function resetPassword(token: string, password: string) {
  return apiClient<{ success: true }>('/auth/reset-password', { method: 'POST', body: { token, password } });
}

/** Settings: the signed-in user's own name. */
export function updateMyAccount(input: { firstName?: string; lastName?: string }) {
  return apiClient<AuthenticatedUser>('/auth/me', { method: 'PATCH', body: input });
}

/** Settings: a new password, with the current one. */
export function changeMyPassword(input: { currentPassword: string; newPassword: string }) {
  return apiClient<{ success: true }>('/auth/me/password', { method: 'POST', body: input });
}

export function register(input: RegisterInput) {
  return apiClient<{ user: AuthenticatedUser; accessToken: string; refreshToken: string }>(
    '/auth/register',
    { method: 'POST', body: input },
  );
}

export function logout() {
  return apiClient<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export function getSession() {
  return apiClient<AuthenticatedUser>('/auth/me');
}

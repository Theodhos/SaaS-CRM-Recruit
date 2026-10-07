'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm/ui';
import { Briefcase, MailCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { OtpInput } from '@/features/auth/otp-input';
import { useInvalidateSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import {
  cancelLogin,
  getLoginChallenge,
  resendLoginCode,
  verifyLoginCode,
  type LoginChallenge,
} from '@/services/auth.service';

/** Codes that mean "this sign-in is over" — back to e-mail + password. */
const ENDED = new Set(['OTP_SESSION_ENDED']);

// `useSearchParams()` must sit under a Suspense boundary so the route can be statically prerendered.
export default function VerifyCodePage() {
  return (
    <Suspense fallback={null}>
      <VerifyCode />
    </Suspense>
  );
}

/**
 * Step two of signing in. The password was accepted and a code was e-mailed; the session only exists once
 * the code is confirmed here. Codes rotate: each one is good for a short time (the countdown), and when it runs out
 * the next one is requested and e-mailed without the user doing anything.
 */
function VerifyCode() {
  const router = useRouter();
  const redirectTo = useSearchParams().get('redirectTo');
  const invalidateSession = useInvalidateSession();

  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  /** When the current code stops working / when the next one may be asked for (ms since epoch). */
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  /** Codes keep coming on their own until the server ends the sign-in or the rotation is stopped by an error. */
  const [rotating, setRotating] = useState(true);
  const busy = useRef(false);

  const take = useCallback((next: LoginChallenge) => {
    setChallenge(next);
    setExpiresAt(Date.now() + next.expiresInSeconds * 1000);
    setResendAt(Date.now() + next.resendInSeconds * 1000);
    setNow(Date.now());
  }, []);

  const backToLogin = useCallback(
    (message?: string) => {
      const query = new URLSearchParams();
      if (redirectTo) query.set('redirectTo', redirectTo);
      if (message) query.set('notice', message);
      router.replace(`/login${query.size ? `?${query.toString()}` : ''}`);
    },
    [redirectTo, router],
  );

  // opened (or reloaded): what is pending for this browser?
  useEffect(() => {
    let cancelled = false;
    // The code shown on a development server without a mail server was handed over by the login page. It is read,
    // not taken: React runs this effect twice in development. The next sign-in overwrites or clears it.
    let handedOver: string | undefined;
    try {
      handedOver = sessionStorage.getItem('crm.devLoginCode') ?? undefined;
    } catch {
      /* private mode */
    }
    getLoginChallenge()
      .then((pending) => !cancelled && take({ ...pending, devCode: handedOver }))
      .catch(() => !cancelled && backToLogin());
    return () => {
      cancelled = true;
    };
  }, [take, backToLogin]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const requestCode = useCallback(
    async (byHand: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setSending(true);
      if (byHand) setError(null);
      try {
        take(await resendLoginCode());
        setCode('');
        setRotating(true);
        setNotice(byHand ? 'A new code was sent.' : 'The code expired — a new one was sent.');
      } catch (e) {
        const failure = e instanceof ApiClientError ? e : null;
        if (failure && ENDED.has(failure.code)) {
          backToLogin('Your sign-in has expired. Please sign in again.');
          return;
        }
        // a cooldown answer only means the clocks differ by a moment: try again on the next tick
        if (failure?.code !== 'OTP_RESEND_COOLDOWN') {
          setRotating(false);
          setError(failure?.message ?? 'Unable to send the verification code. Please try again.');
        } else if (byHand) {
          setError(failure.message);
        }
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [take, backToLogin],
  );

  // the code ran out: the next one is requested on its own
  useEffect(() => {
    if (!challenge || !rotating || verifying) return;
    if (secondsLeft === 0 && resendIn === 0) void requestCode(false);
  }, [challenge, rotating, verifying, secondsLeft, resendIn, requestCode]);

  async function verify(value: string) {
    if (verifying || value.length !== (challenge?.codeLength ?? 6)) return;
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      await verifyLoginCode(value);
      await invalidateSession();
      router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
    } catch (e) {
      const failure = e instanceof ApiClientError ? e : null;
      if (failure && ENDED.has(failure.code)) {
        backToLogin('Your sign-in has expired. Please sign in again.');
        return;
      }
      setCode('');
      setError(failure?.message ?? 'Something went wrong. Please try again.');
      setVerifying(false);
    }
  }

  async function leave() {
    await cancelLogin().catch(() => undefined);
    backToLogin();
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Briefcase className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold">Recruitment CRM</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-foreground/60" /> Check your email
          </CardTitle>
          <CardDescription>
            {challenge
              ? `We sent a ${challenge.codeLength}-digit verification code to ${challenge.emailHint}.`
              : 'We sent a verification code to your registered email address.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            noValidate
          >
            <OtpInput
              value={code}
              length={challenge?.codeLength ?? 6}
              disabled={!challenge || verifying}
              invalid={Boolean(error)}
              onChange={(value) => {
                setCode(value);
                if (error) setError(null);
              }}
              onComplete={(value) => void verify(value)}
            />

            {challenge ? (
              <div data-testid="otp-countdown" data-seconds={secondsLeft}>
                <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ${secondsLeft <= 5 ? 'bg-red-600' : 'bg-emerald-700'}`}
                    style={{ width: `${Math.min(100, (Math.max(0, expiresAt - now) / (challenge.expiresInSeconds * 1000 || 1)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-xs text-foreground/60">
                  {secondsLeft > 0 ? `This code expires in ${secondsLeft}s` : sending ? 'Sending a new code…' : 'This code has expired.'}
                </p>
              </div>
            ) : null}

            {challenge?.devCode ? (
              <p className="rounded-md border border-amber-400 bg-amber-50 p-2 text-center text-xs text-amber-950" data-testid="dev-code" data-code={challenge.devCode}>
                E-mail is not set up on this server, so nothing was sent. Development code:{' '}
                <span className="font-mono text-sm font-bold tracking-widest">{challenge.devCode}</span>
              </p>
            ) : null}

            {error ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : notice ? (
              <p className="text-center text-sm text-foreground/60" role="status">
                {notice}
              </p>
            ) : null}

            <Button type="submit" disabled={!challenge || verifying || code.length !== (challenge?.codeLength ?? 6)}>
              {verifying ? 'Verifying…' : 'Verify Code'}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-1 text-sm">
            <p className="text-foreground/60">Didn&apos;t receive the code?</p>
            <button
              type="button"
              className="font-medium text-primary hover:underline disabled:cursor-default disabled:text-foreground/40 disabled:no-underline"
              disabled={!challenge || sending || verifying || resendIn > 0}
              onClick={() => void requestCode(true)}
            >
              {sending ? 'Sending…' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
            <button type="button" className="mt-2 text-xs text-foreground/60 hover:underline" onClick={() => void leave()}>
              Back to sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

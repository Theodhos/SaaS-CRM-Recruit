'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@crm/ui';
import { loginSchema, type LoginInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/hooks/use-hydrated';
import { useInvalidateSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { login as loginRequest } from '@/services/auth.service';

// `useSearchParams()` must sit under a Suspense boundary so the route can be statically prerendered.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

/**
 * E-mail + password. That signs in directly; when the API has the e-mail code switched on it answers with a
 * pending challenge instead, and /verify-code is where the session is obtained.
 */
function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateSession = useInvalidateSession();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const challenge = await loginRequest(values);
      const redirectTo = searchParams.get('redirectTo');
      if (!challenge.otpRequired) {
        await invalidateSession();
        router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
        return;
      }
      // a development server without a mail server hands the code over for the next page to show (see verify-code)
      try {
        if (challenge.devCode) sessionStorage.setItem('crm.devLoginCode', challenge.devCode);
        else sessionStorage.removeItem('crm.devLoginCode');
      } catch {
        /* private mode */
      }
      router.push(redirectTo ? `/verify-code?redirectTo=${encodeURIComponent(redirectTo)}` : '/verify-code');
    } catch (error) {
      setServerError(
        error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.',
      );
    }
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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to access your organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* method="post": a submit the browser handles itself must never put the password in the address bar */}
          <form className="flex flex-col gap-4" method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            {serverError ? (
              <p className="text-sm text-destructive">{serverError}</p>
            ) : searchParams.get('notice') ? (
              <p className="text-sm text-foreground/60">{searchParams.get('notice')}</p>
            ) : null}
            <Button type="submit" className="mt-2" disabled={!hydrated || isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>

      <p className="mt-3 text-center text-sm text-foreground/60">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

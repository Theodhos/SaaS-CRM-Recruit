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
import { registerSchema, type RegisterInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/hooks/use-hydrated';
import { useInvalidateSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { register as registerRequest } from '@/services/auth.service';

export default function RegisterPage() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      await registerRequest(values);
      await invalidateSession();
      router.push('/dashboard');
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
          <CardTitle>Create your organisation</CardTitle>
          <CardDescription>Set up a new workspace to start recruiting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organisationName">Organisation name</Label>
              <Input
                id="organisationName"
                placeholder="Acme Recruiting"
                {...registerField('organisationName')}
              />
              {errors.organisationName ? (
                <p className="text-xs text-destructive">{errors.organisationName.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" placeholder="Jamie" {...registerField('firstName')} />
                {errors.firstName ? (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" placeholder="Rivera" {...registerField('lastName')} />
                {errors.lastName ? (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...registerField('email')}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...registerField('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
            <Button type="submit" className="mt-2" disabled={!hydrated || isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-foreground/60">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

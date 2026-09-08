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
import { Briefcase } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
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
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Jamie Rivera" disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" placeholder="you@company.com" disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" disabled />
            </div>
            <Button type="submit" className="mt-2" disabled>
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-foreground/50">
            Registration isn&apos;t connected yet — this is a preview of the interface only.
          </p>
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

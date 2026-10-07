import { redirect } from 'next/navigation';

// The site root has no content of its own: signed-in users land on the dashboard (the middleware sends everyone else to /login).
export default function RootPage() {
  redirect('/dashboard');
}

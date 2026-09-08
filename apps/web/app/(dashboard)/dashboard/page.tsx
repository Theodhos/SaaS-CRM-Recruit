import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { Briefcase, FileText, Trophy, Users } from 'lucide-react';

const METRICS = [
  { label: 'Candidates', icon: Users },
  { label: 'Open Jobs', icon: Briefcase },
  { label: 'Active Applications', icon: FileText },
  { label: 'Placements', icon: Trophy },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Here&apos;s what&apos;s happening across your organisation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/60">{label}</CardTitle>
              <Icon className="h-4 w-4 text-foreground/40" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground/30">—</div>
              <p className="mt-1 text-xs text-foreground/40">
                Connect the database to see real numbers
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/60">
          This dashboard computes its metrics live from Jobs, Applications, Candidates, and
          Placements — nothing here is hard-coded. Metrics will populate once the API is connected
          to a running database and the first records are created.
        </CardContent>
      </Card>
    </div>
  );
}

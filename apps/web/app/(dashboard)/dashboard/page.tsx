'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { Briefcase, Building2, UserCheck, UserCog, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { isAdminSession } from '@/components/navigation';
import type { UserComparisonRow } from '@/features/analytics';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';
import { usePlacements } from '@/hooks/use-placements';
import { useReportsOverview } from '@/hooks/use-reports-overview';
import { useSession } from '@/hooks/use-session';
import { useUsers, useUsersWorkload } from '@/hooks/use-users';

// The charts (recharts) only render after the overview data below has loaded,
// never on the first render, so they are split out of this route's entry chunk.
// The chunk is requested as soon as this route loads (see the import() below),
// so it downloads in parallel with the analytics requests rather than after.
const StatusBarChart = dynamic(() => import('@/features/analytics').then((m) => m.StatusBarChart), {
  ssr: false,
});
const TrendLineChart = dynamic(() => import('@/features/analytics').then((m) => m.TrendLineChart), {
  ssr: false,
});
const RankingBarChart = dynamic(() => import('@/features/analytics').then((m) => m.RankingBarChart), {
  ssr: false,
});
const UserComparison = dynamic(() => import('@/features/analytics').then((m) => m.UserComparison), {
  ssr: false,
});
if (typeof window !== 'undefined') {
  void import('@/features/analytics');
}

const cardLinkClass = 'block rounded-lg transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Deliberately short: a handful of the most decision-relevant numbers,
 * computed precisely from live data — not a dump of every chart the
 * platform can produce (that's what the raw endpoints under /reports and
 * /analytics data are for). Every number here is a live query, nothing
 * hard-coded.
 */
export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsOverview();
  const { data: reports, isLoading: reportsLoading } = useReportsOverview();
  const { data: session } = useSession();

  const isLoading = analyticsLoading || reportsLoading;

  // Admin only: the users next to each other. Active accounts, in a fixed (alphabetical) order so a user keeps
  // their colour from one visit to the next.
  const isAdmin = isAdminSession(session);
  const { data: users } = useUsers({ page: 1, pageSize: 100 }, { enabled: isAdmin });
  const { data: workload } = useUsersWorkload({ enabled: isAdmin });
  const comparison: UserComparisonRow[] = (users?.items ?? [])
    .filter((user) => user.status !== 'DEACTIVATED')
    .map((user) => {
      const built = workload?.find((w) => w.userId === user.id);
      return {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        companies: built?.companies ?? 0,
        jobs: built?.jobs ?? 0,
        candidates: built?.candidates ?? 0,
        activeEmployees: built?.activeEmployees ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // The figures that are shown as plain numbers; everything else on this page is a chart.
  const { data: activeEmployees } = usePlacements({ status: 'ACTIVE', page: 1, pageSize: 1 });
  const total = (rows: { count: number }[] | undefined) => rows?.reduce((sum, row) => sum + row.count, 0);
  const summary = analytics?.summary;
  const tiles: { label: string; icon: typeof Users; value: number | undefined; note?: string; href: string; tone: string }[] = [
    { label: 'Companies', icon: Building2, value: total(analytics?.companiesByStatus), href: '/companies', tone: 'var(--chart-series-1)' },
    {
      label: 'Jobs',
      icon: Briefcase,
      value: total(analytics?.jobsByStatus),
      note: summary ? `${summary.openJobCount.toLocaleString()} open` : undefined,
      href: '/jobs',
      tone: 'var(--chart-series-2)',
    },
    { label: 'Candidates', icon: Users, value: summary?.candidateCount, href: '/candidates', tone: 'var(--chart-series-3)' },
    { label: 'Active Employees', icon: UserCheck, value: activeEmployees?.totalItems, note: 'working now', href: '/applications', tone: 'var(--chart-series-7)' },
    // organisation-wide, so the admin's only: a user's dashboard holds their own records and nothing else
    ...(isAdmin
      ? [
          {
            label: 'Users on the platform',
            icon: UserCog,
            value: summary?.activeUserCount,
            note: summary ? `${summary.activeEmployeeCount} instructor${summary.activeEmployeeCount === 1 ? '' : 's'} · ${summary.adminCount} admin${summary.adminCount === 1 ? '' : 's'}` : undefined,
            href: '/profile',
            tone: 'var(--chart-series-5)',
          },
        ]
      : []),
  ];

  const topCompaniesByConversion = reports
    ? [...reports.companyPerformance].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5)
    : [];

  const topCompaniesByHires = reports
    ? [...reports.companyPerformance].sort((a, b) => b.placements - a.placements).slice(0, 5)
    : [];

  const topJobsByApplicants = reports ? reports.jobPerformance.slice(0, 5) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome back{session ? `, ${session.firstName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          {isAdmin ? 'The whole organisation: every user’s records together.' : 'Your own records: what you added yourself.'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {tiles.map(({ label, icon: Icon, value, note, href, tone }) => (
          <Link key={label} href={href} className={cardLinkClass} aria-label={`Open ${label}`}>
            <Card className="h-full border-t-2" style={{ borderTopColor: tone }} data-testid="dashboard-number">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground/60">{label}</CardTitle>
                <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: tone }}>
                  <Icon className="h-4 w-4" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value === undefined ? '—' : value.toLocaleString()}</div>
                {note ? <p className="mt-0.5 text-xs text-foreground/50">{note}</p> : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <Card data-testid="dashboard-user-comparison">
          <CardHeader>
            <CardTitle className="text-base">Users compared</CardTitle>
            <p className="mt-0.5 text-xs text-foreground/50">
              What each user has added: companies, jobs, candidates, and the employees of theirs who are working now.
            </p>
          </CardHeader>
          <CardContent>
            {workload && users ? <UserComparison rows={comparison} /> : <p className="py-6 text-center text-sm text-foreground/50">Loading…</p>}
          </CardContent>
        </Card>
      ) : null}

      {isLoading || !analytics || !reports ? (
        <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Pipeline funnel</CardTitle>
                <p className="mt-0.5 text-xs text-foreground/50">
                  Every application currently moving through a recruitment process, in stage order.
                </p>
              </div>
              <Link
                href="/candidates"
                className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
              >
                {analytics.unassignedCandidateCount.toLocaleString()} unassigned →
              </Link>
            </CardHeader>
            <CardContent>
              {analytics.applicationsByPipelineStage.length > 0 ? (
                <StatusBarChart data={analytics.applicationsByPipelineStage} />
              ) : (
                <p className="py-10 text-center text-sm text-foreground/50">No applications recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Placements — last 6 months</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendLineChart data={analytics.placementsByMonth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top companies by placement rate</CardTitle>
                <p className="mt-0.5 text-xs text-foreground/50">Share of applications that became a placement.</p>
              </CardHeader>
              <CardContent>
                <RankingBarChart
                  data={topCompaniesByConversion.map((c) => ({ label: c.company, value: c.conversionRate }))}
                  valueLabel="Placement rate"
                  valueFormatter={(v) => `${v}%`}
                  emptyMessage="No applications recorded yet."
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Applicants by job</CardTitle>
                <p className="mt-0.5 text-xs text-foreground/50">
                  How many people have applied to each open role.
                </p>
              </CardHeader>
              <CardContent>
                <RankingBarChart
                  data={topJobsByApplicants.map((j) => ({ label: j.job, value: j.applications }))}
                  valueLabel="Applicants"
                  emptyMessage="No applications recorded yet."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hires by company</CardTitle>
                <p className="mt-0.5 text-xs text-foreground/50">
                  Placements made at each client company, all time.
                </p>
              </CardHeader>
              <CardContent>
                <RankingBarChart
                  data={topCompaniesByHires.map((c) => ({ label: c.company, value: c.placements }))}
                  valueLabel="Hires"
                  emptyMessage="No placements recorded yet."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  Contact,
  DollarSign,
  FileText,
  Folder,
  GitBranch,
  LayoutDashboard,
  Mail,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Trophy,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for sidebar navigation. Mirrors the route folders
 * under app/(dashboard)/ 1:1 — add a route, add it here.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Candidates', href: '/candidates', icon: Users },
      { label: 'Companies', href: '/companies', icon: Building2 },
      { label: 'Contacts', href: '/contacts', icon: Contact },
    ],
  },
  {
    label: 'Recruitment',
    items: [
      { label: 'Jobs', href: '/jobs', icon: Briefcase },
      { label: 'Applications', href: '/applications', icon: FileText },
      { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
    ],
  },
  {
    label: 'Productivity',
    items: [
      { label: 'Activities', href: '/activities', icon: Activity },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare },
      { label: 'Calendar', href: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Emails', href: '/emails', icon: Mail },
      { label: 'Documents', href: '/documents', icon: Folder },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { label: 'Placements', href: '/placements', icon: Trophy },
      { label: 'Fees', href: '/fees', icon: DollarSign },
      { label: 'Retainers', href: '/retainers', icon: Wallet },
      { label: 'Renewals', href: '/renewals', icon: RefreshCw },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { label: 'Talent Pools', href: '/talent-pools', icon: UsersRound },
      { label: 'Distribution Lists', href: '/distribution-lists', icon: Send },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3 },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Teams', href: '/teams', icon: UsersRound },
      { label: 'Roles', href: '/roles', icon: Shield },
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

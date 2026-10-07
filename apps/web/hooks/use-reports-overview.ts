import { useQuery } from '@tanstack/react-query';

import { getReportsOverview } from '@/services/reports.service';

export function useReportsOverview() {
  return useQuery({ queryKey: ['reports', 'overview'], queryFn: getReportsOverview });
}

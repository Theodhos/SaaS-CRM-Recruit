import { useQuery } from '@tanstack/react-query';

import { getAnalyticsOverview } from '@/services/analytics.service';

export function useAnalyticsOverview() {
  return useQuery({ queryKey: ['analytics', 'overview'], queryFn: getAnalyticsOverview });
}

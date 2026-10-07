import { useQuery } from '@tanstack/react-query';

import { listRoles } from '@/services/roles.service';

export function useRoles() {
  return useQuery({ queryKey: ['roles', 'list'], queryFn: listRoles });
}

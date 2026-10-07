import { apiClient } from '@/lib/api-client';

export interface SearchResultItem {
  id: string;
  label: string;
  subtitle: string | null;
  href: string;
}

export interface GlobalSearchResult {
  candidates: SearchResultItem[];
  contacts: SearchResultItem[];
  companies: SearchResultItem[];
  jobs: SearchResultItem[];
}

export function globalSearch(q: string) {
  return apiClient<GlobalSearchResult>(`/search?q=${encodeURIComponent(q)}`);
}

import { apiClient } from '@/lib/api-client';

/** The values the pay calculation and the fees start from, for the whole organisation. */
export interface PayDefaults {
  currency: string;
  hoursPerDay: number;
  daysPerMonth: number;
  /** Null = no standard fee: it is typed per person. */
  feePercent: number | null;
  /** Days a client has to pay a fee in. */
  paymentTermDays: number;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: string;
  createdAt: string;
  payDefaults: PayDefaults;
}

/** What the platform is connected to. Names of the settings only — never a key or a password. */
export interface Integration {
  key: string;
  name: string;
  connected: boolean;
  detail: string;
  needs: string[];
}

export function getOrganisation() {
  return apiClient<Organisation>('/organisations/current');
}

export function updateOrganisation(input: { name?: string; payDefaults?: Partial<Omit<PayDefaults, 'feePercent'>> & { feePercent?: number } }) {
  return apiClient<Organisation>('/organisations/current', { method: 'PATCH', body: input });
}

export function getIntegrations() {
  return apiClient<Integration[]>('/organisations/current/integrations');
}

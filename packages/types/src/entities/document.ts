import type { DocumentType } from '../common';

import type { TenantScopedEntity } from './base';

export interface Document extends TenantScopedEntity {
  name: string;
  type: DocumentType;
  /** Storage key, not a browser-usable URL — see the separately-resolved `downloadUrl` on API responses. */
  fileUrl: string;
  fileSize: number;
  uploadedById: string | null;
  companyId: string | null;
  contactId: string | null;
  jobId: string | null;
  applicationId: string | null;
  candidateId: string | null;
  placementId: string | null;
}

import { join } from 'path';

import type { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for where LocalDiskStorageProvider writes files and
 * where StorageController reads them back from — computed independently in
 * two places before, which silently drifted out of sync (module wrote to
 * `apps/storage-uploads`, controller looked in the same wrong place, so
 * nothing crashed, files just landed outside apps/api/).
 *
 * `__dirname` is `apps/api/dist` at runtime (webpack bundles everything
 * into that one directory — same reasoning as configuration.ts's
 * `envFilePath`), so one `../` reaches `apps/api`.
 */
export function resolveStorageLocalRoot(config: ConfigService): string {
  return join(__dirname, '../', config.get<string>('STORAGE_LOCAL_ROOT', './storage-uploads'));
}

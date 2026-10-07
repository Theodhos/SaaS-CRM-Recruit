import {
  LocalDiskStorageProvider,
  type LocalDiskStorageConfig,
} from './providers/local-disk-storage.provider';
import { S3StorageProvider, type S3StorageConfig } from './providers/s3-storage.provider';
import type { StorageProvider } from './storage.interface';

export interface StorageFactoryConfig extends S3StorageConfig, Partial<LocalDiskStorageConfig> {
  provider: 's3' | 'r2' | 'minio' | 'local';
}

/**
 * Single place that decides which StorageProvider implementation to
 * construct. Consumers (apps/api, apps/worker) call this once at bootstrap
 * and depend on the returned StorageProvider interface from then on.
 */
export function createStorageProvider(config: StorageFactoryConfig): StorageProvider {
  switch (config.provider) {
    case 's3':
    case 'r2':
    case 'minio':
      return new S3StorageProvider(config);
    case 'local':
      if (!config.rootDir || !config.publicBaseUrl) {
        throw new Error(
          'STORAGE_PROVIDER=local requires STORAGE_LOCAL_ROOT and STORAGE_LOCAL_PUBLIC_BASE_URL.',
        );
      }
      return new LocalDiskStorageProvider({
        rootDir: config.rootDir,
        publicBaseUrl: config.publicBaseUrl,
      });
    default:
      throw new Error(`Unsupported storage provider: ${String(config.provider)}`);
  }
}

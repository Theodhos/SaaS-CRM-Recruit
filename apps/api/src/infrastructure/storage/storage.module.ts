import { resolveBooleanConfig } from '@crm/config';
import { createStorageProvider } from '@crm/storage';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveStorageLocalRoot } from './local-root';
import { STORAGE_PROVIDER } from './storage.constants';
import { StorageController } from './storage.controller';

/**
 * Global module exposing the abstracted StorageProvider (see
 * packages/storage). Domain modules (candidates, documents) inject
 * STORAGE_PROVIDER and never import @aws-sdk/* directly.
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) => {
        const apiUrl = config.get<string>('API_URL', 'http://localhost:4000');
        const globalPrefix = config.get<string>('API_GLOBAL_PREFIX', 'api/v1');
        return createStorageProvider({
          provider: config.get('STORAGE_PROVIDER', 's3'),
          bucket: config.get('STORAGE_BUCKET', 'crm-documents'),
          region: config.get('STORAGE_REGION', 'auto'),
          endpoint: config.get('STORAGE_ENDPOINT'),
          accessKeyId: config.get('STORAGE_ACCESS_KEY_ID'),
          secretAccessKey: config.get('STORAGE_SECRET_ACCESS_KEY'),
          forcePathStyle: resolveBooleanConfig(config.get('STORAGE_FORCE_PATH_STYLE'), false),
          rootDir: resolveStorageLocalRoot(config),
          publicBaseUrl: config.get<string>('STORAGE_LOCAL_PUBLIC_BASE_URL') || `${apiUrl}/${globalPrefix}`,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}

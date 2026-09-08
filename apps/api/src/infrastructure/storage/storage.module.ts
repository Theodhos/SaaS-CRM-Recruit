import { createStorageProvider } from '@crm/storage';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_PROVIDER } from './storage.constants';

/**
 * Global module exposing the abstracted StorageProvider (see
 * packages/storage). Domain modules (candidates, documents) inject
 * STORAGE_PROVIDER and never import @aws-sdk/* directly.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) =>
        createStorageProvider({
          provider: config.get('STORAGE_PROVIDER', 's3'),
          bucket: config.get('STORAGE_BUCKET', 'crm-documents'),
          region: config.get('STORAGE_REGION', 'auto'),
          endpoint: config.get('STORAGE_ENDPOINT'),
          accessKeyId: config.get('STORAGE_ACCESS_KEY_ID'),
          secretAccessKey: config.get('STORAGE_SECRET_ACCESS_KEY'),
          forcePathStyle: config.get('STORAGE_FORCE_PATH_STYLE', false),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}

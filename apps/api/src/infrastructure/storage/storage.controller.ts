import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';

import { CurrentTenant, Permissions } from '@crm/auth';
import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/constants/permissions.constants';

import { resolveStorageLocalRoot } from './local-root';

/**
 * Only meaningful when STORAGE_PROVIDER=local (see LocalDiskStorageProvider
 * — real S3/R2/MinIO hand back their own presigned URL instead, and the
 * browser never touches this route for those). Keys are namespaced
 * `${organisationId}/...`, so the tenant-prefix check below is the whole
 * access-control story: no DB lookup, no risk of leaking another org's key
 * even if someone guesses/replays an encoded key.
 */
@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly config: ConfigService) {}

  @Get('download/:encodedKey')
  @Permissions(PERMISSIONS.DOCUMENT.READ)
  async download(
    @CurrentTenant() organisationId: string,
    @Param('encodedKey') encodedKey: string,
  ): Promise<StreamableFile> {
    let key: string;
    try {
      key = Buffer.from(encodedKey, 'base64url').toString('utf-8');
    } catch {
      throw new NotFoundException('File not found.');
    }

    if (!key.startsWith(`${organisationId}/`)) {
      throw new NotFoundException('File not found.');
    }

    const filePath = join(resolveStorageLocalRoot(this.config), key);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('File not found.');
    }

    const filename = key.split('/').pop() ?? 'file';
    return new StreamableFile(createReadStream(filePath), {
      disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
  }
}

import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { BadRequestException, Injectable } from '@nestjs/common';

const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;

/** Validates route/query params that reference Prisma cuid() primary keys, e.g. @Param('id', ParseCuidPipe). */
@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!CUID_PATTERN.test(value)) {
      throw new BadRequestException(`"${metadata.data}" must be a valid identifier`);
    }
    return value;
  }
}

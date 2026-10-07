import { Module } from '@nestjs/common';

import { SearchController } from './controller/search.controller';
import { SearchRepository } from './repositories/search.repository';
import { SearchService } from './service/search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
})
export class SearchModule {}

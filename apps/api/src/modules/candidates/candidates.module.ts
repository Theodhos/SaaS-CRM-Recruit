import { Module } from '@nestjs/common';

import { CandidatesController } from './controller/candidates.controller';
import { CandidatesRepository } from './repositories/candidates.repository';
import { CandidatesService } from './service/candidates.service';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidatesRepository],
  exports: [CandidatesService],
})
export class CandidatesModule {}

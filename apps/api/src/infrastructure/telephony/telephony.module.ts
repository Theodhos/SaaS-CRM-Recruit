import { Global, Module } from '@nestjs/common';

import { TwilioVoiceService } from './twilio-voice.service';

@Global()
@Module({
  providers: [TwilioVoiceService],
  exports: [TwilioVoiceService],
})
export class TelephonyModule {}

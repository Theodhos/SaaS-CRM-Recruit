import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

/**
 * Browser calling through Twilio Programmable Voice. The browser never sees a credential: it asks the API for a
 * short-lived Access Token (Voice grant bound to our TwiML App), dials with the Voice JS SDK, Twilio asks this API
 * for TwiML (what to dial) and reports call progress to the webhook. Required environment:
 *   TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID, TWILIO_CALLER_ID
 * Optional: TWILIO_AUTH_TOKEN (verifies webhook signatures — set it in production), PUBLIC_API_URL (the URL Twilio
 * can reach this API on, for status callbacks).
 */
@Injectable()
export class TwilioVoiceService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'].every((key) =>
      Boolean(this.config.get<string>(key)),
    );
  }

  /** What is missing — shown to the admin instead of a dead Call button. */
  missingConfig(): string[] {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'].filter(
      (key) => !this.config.get<string>(key),
    );
  }

  /** One-hour token letting this browser identity place outgoing calls through our TwiML App. */
  accessToken(identity: string): string {
    const { AccessToken } = twilio.jwt;
    const token = new AccessToken(
      this.config.get<string>('TWILIO_ACCOUNT_SID')!,
      this.config.get<string>('TWILIO_API_KEY_SID')!,
      this.config.get<string>('TWILIO_API_KEY_SECRET')!,
      { identity, ttl: 3600 },
    );
    token.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: this.config.get<string>('TWILIO_TWIML_APP_SID'), incomingAllow: false }));
    return token.toJwt();
  }

  /** TwiML that bridges the browser leg to the phone number, reporting progress to `statusCallbackUrl`. */
  dialTwiml(to: string, statusCallbackUrl: string): string {
    const response = new twilio.twiml.VoiceResponse();
    const dial = response.dial({ callerId: this.config.get<string>('TWILIO_CALLER_ID'), answerOnBridge: true });
    dial.number({ statusCallback: statusCallbackUrl, statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'], statusCallbackMethod: 'POST' }, to);
    return response.toString();
  }

  rejectTwiml(message: string): string {
    const response = new twilio.twiml.VoiceResponse();
    response.say(message);
    response.hangup();
    return response.toString();
  }

  /** True when the request really came from Twilio (or when no auth token is configured — development). */
  validateSignature(url: string, params: Record<string, unknown>, signature: string | undefined): boolean {
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!authToken) return true;
    if (!signature) return false;
    return twilio.validateRequest(authToken, signature, url, params as Record<string, string>);
  }

  /** Where Twilio reaches this API (status callbacks) — PUBLIC_API_URL, else API_URL. */
  publicApiUrl(): string {
    return (this.config.get<string>('PUBLIC_API_URL') ?? this.config.get<string>('API_URL') ?? 'http://localhost:4010').replace(/\/$/, '');
  }
}

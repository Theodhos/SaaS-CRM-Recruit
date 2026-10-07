'use client';

import { Badge, Button, Dialog, Label, Textarea } from '@crm/ui';
import { Mic, MicOff, Pause, PhoneOff, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useStartPhoneCall, useUpdatePhoneCall } from '@/hooks/use-phones';
import type { Phone, PhoneCallStatus } from '@/services/phones.service';

import { CALL_STATUS_LABEL, CALL_STATUS_VARIANT, formatDuration } from './call-status';

type Stage = 'starting' | 'unavailable' | 'live' | 'ended' | 'error';

/**
 * The in-browser call: the API creates the call record and issues a provider token, the Twilio Voice SDK dials
 * through microphone + headphones, and the status here follows the SDK events (ringing → connected → ended) while
 * the provider's webhook keeps the server record authoritative. When the call ends, a note can be added to the
 * phone's history. Hold is implemented as mute (the Voice SDK has no native hold for a two-party call).
 */
export function CallDialog({ phone, onClose }: { phone: Phone; onClose: () => void }) {
  const start = useStartPhoneCall();
  const update = useUpdatePhoneCall();
  const [stage, setStage] = useState<Stage>('starting');
  const [status, setStatus] = useState<PhoneCallStatus>('INITIATED');
  const [message, setMessage] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const deviceRef = useRef<{ destroy: () => void } | null>(null);
  const callRef = useRef<{ disconnect: () => void; mute: (m: boolean) => void } | null>(null);
  const answeredAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    async function begin() {
      let session;
      try {
        session = await start.mutateAsync(phone.id);
      } catch (e) {
        setStage('unavailable');
        setMessage(e instanceof Error ? e.message : 'Calling is not available.');
        return;
      }
      if (cancelled) return;
      setCallId(session.call.id);
      const report = (input: Parameters<typeof update.mutateAsync>[0]['input']) => update.mutateAsync({ callId: session.call.id, input }).catch(() => undefined);
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const device = new Device(session.token, { logLevel: 'error' });
        deviceRef.current = device;
        const call = await device.connect({ params: { To: session.to, CallId: session.call.id } });
        callRef.current = call;
        setStage('live');
        call.on('ringing', () => {
          setStatus('RINGING');
          void report({ status: 'RINGING' });
        });
        call.on('accept', () => {
          setStatus('ANSWERED');
          answeredAtRef.current = Date.now();
          void report({ status: 'ANSWERED', answeredAt: new Date().toISOString() });
          timerRef.current = setInterval(() => setSeconds(Math.round((Date.now() - (answeredAtRef.current ?? Date.now())) / 1000)), 1000);
        });
        const finish = (final: 'ENDED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'REJECTED', text?: string) => {
          if (timerRef.current) clearInterval(timerRef.current);
          const duration = answeredAtRef.current ? Math.round((Date.now() - answeredAtRef.current) / 1000) : 0;
          setSeconds(duration);
          setStatus(final);
          setStage('ended');
          if (text) setMessage(text);
          void report({ status: final, endedAt: new Date().toISOString(), durationSeconds: duration });
        };
        call.on('disconnect', () => finish(answeredAtRef.current ? 'ENDED' : 'NO_ANSWER'));
        call.on('cancel', () => finish('NO_ANSWER'));
        call.on('reject', () => finish('REJECTED'));
        call.on('error', (error: { message?: string; code?: number }) => finish(error?.code === 31486 ? 'BUSY' : 'FAILED', error?.message));
      } catch (e) {
        setStage('error');
        setStatus('FAILED');
        setMessage(e instanceof Error ? e.message : 'The browser could not start the call (microphone permission?).');
        void report({ status: 'FAILED', endedAt: new Date().toISOString(), durationSeconds: 0 });
      }
    }
    void begin();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.id]);

  function toggleMute() {
    const next = !muted;
    callRef.current?.mute(next);
    setMuted(next);
  }

  function toggleHold() {
    const next = !held;
    callRef.current?.mute(next || muted);
    setHeld(next);
  }

  async function saveNote() {
    if (!callId) return;
    await update.mutateAsync({ callId, input: { notes: note } });
    setNoteSaved(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={phone.name ?? phone.normalizedPhone} description={phone.normalizedPhone} className="max-w-md">
      <div className="flex flex-col items-center gap-4 text-center" data-testid="call-dialog">
        {stage === 'unavailable' ? (
          <>
            <Badge variant="warning">Browser calling not connected</Badge>
            <p className="text-sm text-foreground/60">{message}</p>
            <a href={`tel:${phone.normalizedPhone}`} className="text-sm text-primary underline">
              Dial {phone.normalizedPhone} with your phone app instead
            </a>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </>
        ) : stage === 'starting' ? (
          <p className="py-6 text-sm text-foreground/60">Connecting…</p>
        ) : (
          <>
            <Badge variant={CALL_STATUS_VARIANT[status]}>{held && stage === 'live' ? 'On hold' : CALL_STATUS_LABEL[status]}</Badge>
            <p className="text-3xl font-semibold tabular-nums" data-testid="call-timer">
              {formatDuration(seconds)}
            </p>
            {message ? <p className="text-xs text-foreground/50">{message}</p> : null}
            {stage === 'live' ? (
              <div className="flex gap-2">
                <Button type="button" variant={muted ? 'default' : 'outline'} onClick={toggleMute}>
                  {muted ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />} {muted ? 'Unmute' : 'Mute'}
                </Button>
                <Button type="button" variant={held ? 'default' : 'outline'} onClick={toggleHold}>
                  {held ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />} {held ? 'Resume' : 'Hold'}
                </Button>
                <Button type="button" variant="destructive" onClick={() => callRef.current?.disconnect()}>
                  <PhoneOff className="mr-1.5 h-4 w-4" /> End call
                </Button>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2 text-left">
                <p className="text-sm font-medium">Call {status === 'ENDED' ? 'completed' : CALL_STATUS_LABEL[status].toLowerCase()} · duration {formatDuration(seconds)}</p>
                <Label htmlFor="call-note">Add note</Label>
                <Textarea id="call-note" rows={3} className="min-h-0" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said, next step…" />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button type="button" onClick={() => void saveNote()} disabled={!note.trim() || update.isPending}>
                    {noteSaved ? 'Saved' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

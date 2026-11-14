import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CloudOff, FileText, Keyboard, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { CaptureStep } from '@/features/voice/capture-step';
import { ReviewSlip } from '@/features/voice/review-slip';
import type { ReviewValues } from '@/features/voice/review-form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localItems, saveConfirmed, useLocalItems, type LocalItem } from '@/lib/drafts';
import type { ExtractionResult, TranscribeResponse } from '@/lib/queries';
import { formatDate, newIdempotencyKey } from '@/lib/utils';

type Step = 'capture' | 'transcript' | 'review';

export function RecordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('capture');
  const [stt, setStt] = useState<TranscribeResponse | null>(null);
  const [transcript, setTranscript] = useState('');
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [restoredValues, setRestoredValues] = useState<ReviewValues | null>(null);
  const idRef = useRef(newIdempotencyKey());
  const drafts = useLocalItems();

  const transcribe = useMutation({
    mutationFn: ({ audio, filename, language }: { audio: Blob; filename: string; language: string }) => {
      const fd = new FormData();
      fd.append('language', language);
      fd.append('audio', audio, filename);
      return api.post<TranscribeResponse>('/api/voice/transcribe', fd);
    },
    onSuccess: (r) => { setStt(r); setTranscript(r.transcript); setExtraction(r.extraction); setStep('transcript'); },
  });

  const extract = useMutation({
    mutationFn: (text: string) => api.post<ExtractionResult>('/api/voice/extract', { transcript: text }),
    onSuccess: (r) => { setExtraction(r); setStep('review'); },
  });

  const save = useMutation({
    mutationFn: ({ payload, full }: { payload: Record<string, unknown>; full: boolean }) =>
      saveConfirmed(idRef.current, payload, full, transcript ? 'voice' : 'manual'),
    onSuccess: ({ transaction }) => {
      localItems.remove(idRef.current);
      void qc.invalidateQueries();
      toast.success('Transaction saved');
      navigate(`/app/transactions/${transaction.id}?new=1`);
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.code === 'NETWORK_ERROR') {
        localItems.upsert({ id: idRef.current, kind: 'queued', savedAt: new Date().toISOString(), payload: vars.payload, recordFullPayment: vars.full, transcript });
        toast.message('You are offline. Saved on this device and will be sent when you are back online.');
        reset();
      }
    },
  });

  function reset() {
    setStep('capture'); setStt(null); setTranscript(''); setExtraction(null); setRestoredValues(null);
    idRef.current = newIdempotencyKey();
    transcribe.reset(); extract.reset(); save.reset();
  }

  function saveDraft(values: ReviewValues) {
    localItems.upsert({ id: idRef.current, kind: 'draft', savedAt: new Date().toISOString(), values, transcript, extraction });
    toast.success('Draft saved on this device only');
    reset();
  }

  function openDraft(d: LocalItem) {
    idRef.current = d.id;
    setTranscript(d.transcript ?? '');
    setExtraction(d.extraction ?? null);
    setRestoredValues(d.values ?? null);
    setStep('review');
  }

  const transcribeError = transcribe.error instanceof ApiError ? transcribe.error.message : transcribe.error ? 'Transcription failed.' : undefined;

  return (
    <>
      <PageHeader
        title="Record a sale"
        subtitle={step === 'capture' ? 'Speak naturally in Hindi, Hinglish or English.' : step === 'transcript' ? 'This is what Gnani Prisma heard. Fix any mistakes before we read the numbers.' : 'Review the slip, hear it back, then confirm.'}
        actions={step !== 'capture'
          ? <Button variant="ghost" onClick={reset}><ArrowLeft /> Start over</Button>
          : <Button variant="secondary" onClick={() => { setExtraction(null); setStep('review'); }}><Keyboard /> Enter manually</Button>}
      />

      <ol className="mb-6 flex gap-2 text-xs" aria-label="Progress">
        {(['capture', 'transcript', 'review'] as Step[]).map((s, i) => (
          <li key={s} aria-current={step === s ? 'step' : undefined} className={`rounded-full px-3 py-1 ${step === s ? 'bg-mandi-700 text-white' : 'bg-white text-ink-faint ring-1 ring-line'}`}>
            {i + 1}. {s === 'capture' ? 'Speak' : s === 'transcript' ? 'Transcript' : 'Review & confirm'}
          </li>
        ))}
      </ol>

      {step === 'capture' && (
        <>
          <CaptureStep defaultLanguage={user?.preferredLanguage ?? 'hi'} busy={transcribe.isPending} error={transcribeError}
            onSubmit={(audio, filename, language) => transcribe.mutate({ audio, filename, language })} onClearError={() => transcribe.reset()} />
          {drafts.length > 0 && <LocalDrafts items={drafts} onOpen={openDraft} />}
        </>
      )}

      {step === 'transcript' && stt && (
        <div className="max-w-3xl rounded-slip border border-line bg-white p-6">
          <label htmlFor="transcript" className="text-sm font-medium">Transcript</label>
          {stt.transcript ? (
            <Textarea id="transcript" data-testid="transcript" rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="mt-2 text-base" />
          ) : (
            <p className="mt-2 rounded-lg bg-turmeric-50 p-3 text-sm text-turmeric-700">No speech was detected in the recording. Record again closer to the microphone, or type the sale below.</p>
          )}
          {!stt.transcript && <Textarea id="transcript" rows={3} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="mt-3" placeholder="25 quintal gehu, rate 2400…" />}
          <p className="mt-2 text-xs text-ink-faint">
            Model {stt.model ?? 'unknown'} · sent as {stt.languageCodeSent}{stt.detectedLanguageCode ? ` · detected ${stt.detectedLanguageCode}` : ''}{stt.processingTimeSeconds ? ` · ${stt.processingTimeSeconds.toFixed(1)} s` : ''}
            {stt.truncated && ' · transcript was truncated by the service'}
          </p>
          {extract.error && <p className="mt-2 text-sm text-ledger-700">{(extract.error as ApiError).message}</p>}
          <div className="mt-5 flex gap-2">
            <Button size="lg" disabled={!transcript.trim() || extract.isPending}
              onClick={() => (transcript === stt.transcript && stt.extraction ? setStep('review') : extract.mutate(transcript))}>
              {extract.isPending ? <Loader2 className="animate-spin" /> : <FileText />} Fill the sale slip
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <ReviewSlip
          key={idRef.current}
          extraction={restoredValues ? null : extraction}
          transcript={transcript || undefined}
          storeTranscriptDefault={user?.saveTranscriptsByDefault ?? false}
          submitting={save.isPending}
          submitError={save.error && !(save.error instanceof ApiError && save.error.code === 'NETWORK_ERROR') ? (save.error as Error).message : undefined}
          onConfirm={(payload, full) => save.mutate({ payload, full })}
          onSaveDraft={saveDraft}
          initialValues={restoredValues ?? undefined}
        />
      )}
    </>
  );
}

function LocalDrafts({ items, onOpen }: { items: LocalItem[]; onOpen: (d: LocalItem) => void }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><CloudOff className="size-4" /> On this device only</h2>
      <p className="text-xs text-ink-faint">These are not saved to your account yet.</p>
      <ul className="mt-3 divide-y divide-line rounded-slip border border-dashed border-line bg-white">
        {items.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{d.values?.cropName || (d.payload?.cropName as string) || 'Untitled slip'} {d.values?.quantity ? `· ${d.values.quantity} ${d.values.unit}` : ''}</p>
              <p className="text-xs text-ink-faint">{d.kind === 'queued' ? 'Confirmed, waiting for internet' : 'Draft'} · {formatDate(d.savedAt, { dateStyle: 'medium', timeStyle: 'short' })}{d.lastError ? ` · ${d.lastError}` : ''}</p>
            </div>
            <div className="flex gap-1">
              {d.kind === 'draft' && <Button size="sm" variant="secondary" onClick={() => onOpen(d)}>Continue</Button>}
              <Button size="icon" variant="ghost" aria-label="Delete local item" onClick={() => localItems.remove(d.id)}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

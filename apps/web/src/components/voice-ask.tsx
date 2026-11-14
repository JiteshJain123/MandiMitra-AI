import { useMutation } from '@tanstack/react-query';
import { Loader2, MessageCircleQuestion, Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { SpeakButton } from '@/features/voice/audio-player';
import { useWavRecorder } from '@/features/voice/use-wav-recorder';
import type { ApiError } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { TranscribeResponse } from '@/lib/queries';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ErrorState } from './ui/states';

const SUGGESTIONS = ['Mera kitna paisa pending hai?', 'Is mahine kitni gehun ki sale hui?', 'Kaunse transactions ka payment abhi nahi aaya?'];

interface Answer { intent: string; answerText: string; speechLanguage: string }

/** Ask about payments by voice or text. Questions map to fixed, user-scoped queries on the server. */
export function VoiceAsk() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const rec = useWavRecorder();
  const ask = useMutation({ mutationFn: (q: string) => api.post<Answer>('/api/voice/query', { question: q }) });
  const transcribe = useMutation({
    mutationFn: async (blob: Blob) => {
      const fd = new FormData();
      fd.append('language', user?.preferredLanguage ?? 'hi');
      fd.append('audio', blob, 'question.wav');
      return api.post<TranscribeResponse>('/api/voice/transcribe', fd);
    },
    onSuccess: (r) => { setQuestion(r.transcript); if (r.transcript) ask.mutate(r.transcript); },
  });

  const recording = rec.state === 'recording';
  const error = (ask.error ?? transcribe.error) as ApiError | null;

  return (
    <div className="rounded-slip border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageCircleQuestion className="size-4 text-mandi-700" /> Ask about your money</h2>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask.mutate(question.trim()); }}>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Mera kitna paisa pending hai?" aria-label="Your question" className="min-w-0" />
        <Button type="button" size="icon" variant={recording ? 'danger' : 'secondary'} aria-label={recording ? 'Stop and ask' : 'Ask by voice'}
          disabled={transcribe.isPending}
          onClick={async () => {
            if (recording) { rec.stop(); return; }
            await rec.start();
          }}>
          {transcribe.isPending ? <Loader2 className="animate-spin" /> : recording ? <Square /> : <Mic />}
        </Button>
        <Button type="submit" disabled={!question.trim() || ask.isPending}>{ask.isPending ? <Loader2 className="animate-spin" /> : 'Ask'}</Button>
      </form>
      {rec.blob && rec.state === 'stopped' && !transcribe.isPending && !transcribe.isSuccess && (
        <div className="mt-2 flex gap-2 text-sm">
          <Button size="sm" onClick={() => transcribe.mutate(rec.blob as Blob)}>Send question</Button>
          <Button size="sm" variant="ghost" onClick={rec.reset}>Discard</Button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => { setQuestion(s); ask.mutate(s); transcribe.reset(); }} className="rounded-full bg-mist px-2.5 py-1 text-xs text-ink-soft hover:bg-mandi-50 hover:text-mandi-700">{s}</button>
        ))}
      </div>
      {(rec.error || error) && <div className="mt-3"><ErrorState message={rec.error?.message ?? error?.message ?? ''} /></div>}
      {ask.data && (
        <div className="mt-4 rounded-lg bg-mandi-50 p-4" aria-live="polite">
          <p className="text-[15px] leading-relaxed text-mandi-900" data-testid="voice-answer">{ask.data.answerText}</p>
          <div className="mt-3"><SpeakButton key={ask.data.answerText} text={ask.data.answerText} label="Hear the answer" /></div>
        </div>
      )}
    </div>
  );
}

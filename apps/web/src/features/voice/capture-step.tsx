import { FileAudio, Loader2, Mic, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_LANGUAGES, MAX_AUDIO_BYTES } from '@mandimitra/shared';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { useWavRecorder } from './use-wav-recorder';

const ACCEPTED = '.wav,.mp3,.ogg,.flac,.m4a,.aac,audio/wav,audio/mpeg,audio/ogg,audio/flac,audio/mp4,audio/aac';

export function CaptureStep({ defaultLanguage, busy, error, onSubmit, onClearError }: {
  defaultLanguage: string;
  busy: boolean;
  error?: string;
  onSubmit: (audio: Blob, filename: string, language: string) => void;
  /** Called when the user discards the audio or starts over, so a stale server error does not linger. */
  onClearError?: () => void;
}) {
  const rec = useWavRecorder();
  const [language, setLanguage] = useState(defaultLanguage);
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const audio = upload ?? rec.blob;
  const previewUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const recording = rec.state === 'recording';
  const seconds = Math.floor(rec.elapsed);

  function onFile(f: File | undefined) {
    setUploadError('');
    onClearError?.();
    if (!f) return;
    if (f.size > MAX_AUDIO_BYTES) { setUploadError('File is larger than 5 MB.'); return; }
    if (/webm/i.test(f.type) || f.name.endsWith('.webm')) { setUploadError('WebM is not supported by the speech service. Use WAV, MP3, OGG, FLAC or M4A.'); return; }
    rec.reset();
    setUpload(f);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-slip border border-line bg-white p-6 sm:p-8">
        <p className="text-sm text-ink-soft">Say the sale the way you would tell your munim, for example:</p>
        <blockquote className="mt-2 border-l-2 border-mandi-200 pl-3 text-[15px] leading-relaxed text-ink">
          “25 quintal gehu becha hai, rate 2400 rupaye per quintal. 2 percent commission aur 500 rupaye transport kaat lena.”
        </blockquote>

        <div className="mt-8 flex flex-col items-center">
          <button
            type="button"
            onClick={recording ? rec.stop : () => { setUpload(null); setUploadError(''); onClearError?.(); void rec.start(); }}
            disabled={busy || rec.state === 'requesting'}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            className={cn(
              'grid size-28 place-items-center rounded-full text-white transition-colors disabled:opacity-60',
              recording ? 'recording-pulse bg-ledger-500 hover:bg-ledger-700' : 'bg-mandi-700 hover:bg-mandi-800',
            )}
          >
            {rec.state === 'requesting' ? <Loader2 className="size-10 animate-spin" /> : recording ? <Square className="size-9" fill="currentColor" /> : <Mic className="size-11" />}
          </button>

          <div className="mt-4 h-12 text-center" aria-live="polite">
            {recording ? (
              <>
                <p className="tabular text-2xl font-semibold">0:{String(seconds).padStart(2, '0')} <span className="text-sm font-normal text-ink-faint">/ 0:{rec.maxSeconds}</span></p>
                <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-mist">
                  <div className="h-full bg-mandi-500 transition-[width] duration-100" style={{ width: `${Math.min(100, rec.level * 160)}%` }} />
                </div>
              </>
            ) : rec.state === 'requesting' ? (
              <p className="text-sm text-ink-soft">Waiting for microphone permission…</p>
            ) : audio ? (
              <p className="text-sm text-ink-soft">Listen back, then send it for transcription.</p>
            ) : (
              <p className="text-sm text-ink-soft">Tap to start. Recording stops on its own at {rec.maxSeconds} seconds.</p>
            )}
          </div>

          {recording && (
            <Button variant="ghost" size="sm" onClick={rec.cancel}><Trash2 /> Cancel recording</Button>
          )}
        </div>

        {(rec.error || uploadError || error) && (
          <div className="mt-4">
            {/* "||" not "??": uploadError starts as an empty string, which must not hide the server's message. */}
            <ErrorState message={rec.error?.message || uploadError || error || ''} />
          </div>
        )}

        {audio && previewUrl && !recording && (
          <div className="mt-6 space-y-4 border-t border-line pt-6">
            <div className="flex items-center gap-3 text-sm text-ink-soft">
              <FileAudio className="size-4" /> {upload ? upload.name : `Recording, ${seconds} s, WAV`}
            </div>
            <audio src={previewUrl} controls className="h-10 w-full" aria-label="Recording preview" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onSubmit(audio, upload?.name ?? 'recording.wav', language)} disabled={busy} size="lg">
                {busy ? <><Loader2 className="animate-spin" /> Transcribing with Gnani Prisma…</> : 'Transcribe'}
              </Button>
              <Button variant="secondary" size="lg" disabled={busy} onClick={() => { setUpload(null); setUploadError(''); rec.reset(); onClearError?.(); }}>Discard</Button>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-slip border border-line bg-white p-5">
          <Label htmlFor="lang">Spoken language</Label>
          <Select id="lang" className="mt-2" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy || recording}>
            <option value="auto">Detect automatically</option>
            {APP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
          <p className="mt-2 text-xs text-ink-faint">Hinglish listens for Hindi and English together. Amounts are read best in Hindi, Hinglish and English.</p>
        </div>
        <div className="rounded-slip border border-dashed border-line bg-white p-5">
          <p className="text-sm font-medium">Have a recording already?</p>
          <p className="mt-1 text-xs text-ink-faint">WAV, MP3, OGG, FLAC or M4A, up to 30 seconds.</p>
          <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" data-testid="audio-upload" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => fileRef.current?.click()} disabled={busy || recording}>
            <Upload /> Upload audio
          </Button>
        </div>
      </aside>
    </div>
  );
}

import { Download, Loader2, RotateCcw, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { api, ApiError, downloadBlob } from '@/lib/api';

/** Sends text to the backend Timbre endpoint and plays the returned binary audio. */
export function SpeakButton({ text, label = 'Read aloud', autoPlay = true }: { text: string; label?: string; autoPlay?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastText = useRef('');

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // Text changed: previous audio no longer matches.
  useEffect(() => { if (lastText.current && lastText.current !== text) { setState('idle'); setUrl(null); } }, [text]);

  async function synthesize() {
    setState('loading');
    setError('');
    try {
      const { blob: b } = await api.blob('/api/voice/speak', { method: 'POST', body: JSON.stringify({ text }), headers: { 'Content-Type': 'application/json' } });
      lastText.current = text;
      setBlob(b);
      setVoice(null);
      setUrl(URL.createObjectURL(b));
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Voice generation failed.');
      setState('error');
    }
  }

  useEffect(() => {
    if (state === 'ready' && autoPlay) void audioRef.current?.play().catch(() => {});
  }, [state, autoPlay]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="subtle" onClick={synthesize} disabled={state === 'loading' || !text}>
          {state === 'loading' ? <Loader2 className="animate-spin" /> : <Volume2 />}
          {state === 'loading' ? 'Generating voice…' : state === 'ready' ? 'Generate again' : label}
        </Button>
        {state === 'ready' && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play(); } }}>
              <RotateCcw /> Replay
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => blob && downloadBlob(blob, 'mandimitra-summary.mp3')}>
              <Download /> Download
            </Button>
          </>
        )}
      </div>
      {url && <audio ref={audioRef} src={url} controls className="h-10 w-full max-w-md" aria-label="Spoken summary" data-voice={voice ?? undefined} />}
      {state === 'error' && <ErrorState message={error} onRetry={synthesize} />}
    </div>
  );
}

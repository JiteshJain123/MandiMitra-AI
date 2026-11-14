import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { APP_LANGUAGES, type PublicUser } from '@mandimitra/shared';
import { PageHeader } from '@/components/layout/app-shell';
import { useHealth } from '@/components/layout/integration-status';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/states';
import type { ApiError } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const health = useHealth();
  const [name, setName] = useState(user?.name ?? '');
  const [lang, setLang] = useState(user?.preferredLanguage ?? 'hi');
  const [keepTranscripts, setKeepTranscripts] = useState(user?.saveTranscriptsByDefault ?? false);

  const save = useMutation({
    mutationFn: () => api.patch<{ user: PublicUser }>('/api/auth/me', { name, preferredLanguage: lang, saveTranscriptsByDefault: keepTranscripts }),
    onSuccess: (r) => { setUser(r.user); toast.success('Settings saved'); },
  });
  const resetDemo = useMutation({
    mutationFn: () => api.post('/api/auth/demo/reset'),
    onSuccess: () => { void qc.invalidateQueries(); toast.success('Demo data reset'); },
  });
  const g = health.data?.gnani;
  const voiceNote = lang === 'hi' || lang === 'hinglish' || lang === 'en' ? null : 'Spoken summaries for this language are read in English for now. Speech recognition works in this language.';

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <h2 className="font-semibold">Profile</h2>
          <div className="mt-4 space-y-4">
            <div><Label htmlFor="s-name">Name</Label><Input id="s-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="s-email">Email</Label><Input id="s-email" className="mt-1.5" value={user?.email ?? ''} disabled /></div>
            <div><Label>Role</Label><p className="mt-1.5 text-sm capitalize text-ink-soft">{user?.role}</p></div>
            <div>
              <Label htmlFor="s-lang">Preferred language</Label>
              <Select id="s-lang" className="mt-1.5" value={lang} onChange={(e) => setLang(e.target.value)}>
                {APP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.nativeLabel})</option>)}
              </Select>
              <p className="mt-1.5 text-xs text-ink-faint">Used for speech recognition and for the voice that reads summaries aloud.{voiceNote ? ` ${voiceNote}` : ''}</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="size-6 shrink-0 accent-mandi-700" checked={keepTranscripts} onChange={(e) => setKeepTranscripts(e.target.checked)} />
              <span>Keep the transcript with each sale by default<span className="block text-xs text-ink-faint">Audio recordings are never stored. Only the text, and only if you choose.</span></span>
            </label>
            {save.error && <ErrorState message={(save.error as ApiError).message} />}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save settings</Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="font-semibold">Gnani AI integration</h2>
            {health.isError ? <p className="mt-2 text-sm text-ledger-700">The server cannot be reached.</p> : !g ? <p className="mt-2 text-sm text-ink-faint">Checking…</p> : (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">API key on server</dt><dd className={g.configured ? 'text-mandi-700' : 'text-turmeric-700'}>{g.configured ? 'Configured' : 'Missing'}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Speech-to-text</dt><dd>{g.sttModel}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Text-to-speech</dt><dd>{g.ttsModel}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-soft">Last transcription</dt><dd className="text-right">{g.stt.lastErrorAt && (!g.stt.lastSuccessAt || g.stt.lastErrorAt > g.stt.lastSuccessAt) ? <span className="text-ledger-700">{g.stt.lastErrorCode}</span> : g.stt.lastSuccessAt ? formatDate(g.stt.lastSuccessAt, { timeStyle: 'short', dateStyle: 'short' }) : 'None yet'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-soft">Last voice</dt><dd className="text-right">{g.tts.lastErrorAt && (!g.tts.lastSuccessAt || g.tts.lastErrorAt > g.tts.lastSuccessAt) ? <span className="text-ledger-700">{g.tts.lastErrorCode}</span> : g.tts.lastSuccessAt ? formatDate(g.tts.lastSuccessAt, { timeStyle: 'short', dateStyle: 'short' }) : 'None yet'}</dd></div>
              </dl>
            )}
            <p className="mt-3 text-xs text-ink-faint">The key stays on the server and is never sent to this browser.</p>
          </Card>
          {user?.isDemo && (
            <Card className="p-6">
              <h2 className="font-semibold">Demo account</h2>
              <p className="mt-1 text-sm text-ink-soft">Restore the original synthetic sales.</p>
              <Button variant="secondary" className="mt-3" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}>{resetDemo.isPending && <Loader2 className="animate-spin" />} Reset demo data</Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

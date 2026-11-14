import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Health {
  status: string;
  database: 'up' | 'down';
  gnani: { configured: boolean; sttModel: string; ttsModel: string; stt: { lastSuccessAt?: string; lastErrorCode?: string; lastErrorAt?: string }; tts: { lastSuccessAt?: string; lastErrorCode?: string; lastErrorAt?: string } };
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/api/health'), refetchInterval: 60_000, retry: 1 });
}

function lastState(s: { lastSuccessAt?: string; lastErrorAt?: string; lastErrorCode?: string }) {
  if (!s.lastSuccessAt && !s.lastErrorAt) return 'untested';
  if (s.lastErrorAt && (!s.lastSuccessAt || s.lastErrorAt > s.lastSuccessAt)) return `error (${s.lastErrorCode})`;
  return 'working';
}

/** Clearly labelled indicator of whether the server's Gnani integration is configured and its last observed result. */
export function IntegrationStatus({ compact = false }: { compact?: boolean }) {
  const { data, isError } = useHealth();
  const configured = data?.gnani.configured;
  const color = isError ? 'bg-ledger-500' : !data ? 'bg-ink-faint' : !configured ? 'bg-turmeric-500' : 'bg-mandi-500';
  const label = isError ? 'Server unreachable' : !data ? 'Checking…' : !configured ? 'Gnani AI not configured' : 'Gnani AI connected';
  const title = data ? `Speech-to-text (${data.gnani.sttModel}): ${lastState(data.gnani.stt)}\nText-to-speech (${data.gnani.ttsModel}): ${lastState(data.gnani.tts)}` : label;
  return (
    <span title={title} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-soft" role="status">
      <span className={cn('size-2 rounded-full', color)} aria-hidden />
      <span className={compact ? 'sr-only' : 'sr-only sm:not-sr-only'}>{label}</span>
    </span>
  );
}

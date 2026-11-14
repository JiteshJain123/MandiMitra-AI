/** In-memory record of the last Gnani call outcome per service, for the integration status indicator. */
export interface ServiceStatus {
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: string;
}

const status: Record<'stt' | 'tts', ServiceStatus> = { stt: {}, tts: {} };

export function recordSuccess(service: 'stt' | 'tts'): void {
  status[service].lastSuccessAt = new Date().toISOString();
}

export function recordFailure(service: 'stt' | 'tts', code: string): void {
  status[service].lastErrorAt = new Date().toISOString();
  status[service].lastErrorCode = code;
}

export function getGnaniStatus(): Record<'stt' | 'tts', ServiceStatus> {
  return { stt: { ...status.stt }, tts: { ...status.tts } };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_AUDIO_SECONDS } from '@mandimitra/shared';
import { concatFloat32, downsample, encodeWav, TARGET_SAMPLE_RATE } from './wav';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error';

export interface RecorderError {
  kind: 'permission' | 'no-device' | 'unsupported' | 'other';
  message: string;
}

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('mm-capture', Capture);
`;

/** Stops automatically just under Prisma's 30-second limit. */
const AUTO_STOP_SECONDS = MAX_AUDIO_SECONDS - 1;

export function useWavRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cleanupNodesRef = useRef<() => void>(() => {});

  const teardown = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    cleanupNodesRef.current();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const finish = useCallback((keep: boolean) => {
    const ctx = ctxRef.current;
    const rate = ctx?.sampleRate ?? TARGET_SAMPLE_RATE;
    teardown();
    setLevel(0);
    if (!keep) {
      chunksRef.current = [];
      setBlob(null);
      setElapsed(0);
      setState('idle');
      return;
    }
    const pcm = downsample(concatFloat32(chunksRef.current), rate, TARGET_SAMPLE_RATE);
    chunksRef.current = [];
    setBlob(encodeWav(pcm, TARGET_SAMPLE_RATE));
    setState('stopped');
  }, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setError({ kind: 'unsupported', message: 'This browser cannot record audio. Try Chrome, Edge or Firefox, or upload an audio file.' });
      setState('error');
      return;
    }
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const onChunk = (data: Float32Array) => {
        chunksRef.current.push(data);
        let peak = 0;
        for (let i = 0; i < data.length; i += 8) peak = Math.max(peak, Math.abs(data[i] as number));
        setLevel(peak);
      };
      if (ctx.audioWorklet) {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(ctx, 'mm-capture');
        node.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data);
        source.connect(node);
        cleanupNodesRef.current = () => { source.disconnect(); node.disconnect(); node.port.onmessage = null; };
      } else {
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
        source.connect(proc);
        proc.connect(ctx.destination);
        cleanupNodesRef.current = () => { source.disconnect(); proc.disconnect(); proc.onaudioprocess = null; };
      }
      chunksRef.current = [];
      startRef.current = performance.now();
      setElapsed(0);
      setState('recording');
      timerRef.current = window.setInterval(() => {
        const s = (performance.now() - startRef.current) / 1000;
        setElapsed(s);
        if (s >= AUTO_STOP_SECONDS) finish(true);
      }, 200);
    } catch (err) {
      teardown();
      const name = (err as DOMException)?.name;
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? { kind: 'permission', message: 'Microphone access was blocked. Allow the microphone in your browser\'s site settings, then try again.' }
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? { kind: 'no-device', message: 'No microphone was found. Connect one or upload an audio file instead.' }
            : { kind: 'other', message: 'Could not start recording. Please try again.' },
      );
      setState('error');
    }
  }, [finish, teardown]);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(() => finish(false), [finish]);
  const reset = useCallback(() => { setBlob(null); setElapsed(0); setError(null); setState('idle'); }, []);

  return { state, elapsed, level, blob, error, start, stop, cancel, reset, maxSeconds: AUTO_STOP_SECONDS };
}

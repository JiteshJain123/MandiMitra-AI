import { describe, expect, it } from 'vitest';
import { concatFloat32, downsample, encodeWav } from './wav';

describe('wav encoding', () => {
  it('writes a valid 16 kHz mono PCM header', async () => {
    const blob = encodeWav(new Float32Array(16000), 16000);
    const b = new DataView(await blob.arrayBuffer());
    const str = (o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => b.getUint8(o + i)));
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(b.getUint16(22, true)).toBe(1);
    expect(b.getUint32(24, true)).toBe(16000);
    expect(b.getUint32(40, true)).toBe(32000);
    expect(blob.size).toBe(44 + 32000);
  });

  it('clips samples to the int16 range', async () => {
    const b = new DataView(await encodeWav(new Float32Array([2, -2, 0.5])).arrayBuffer());
    expect(b.getInt16(44, true)).toBe(32767);
    expect(b.getInt16(46, true)).toBe(-32768);
    expect(b.getInt16(48, true)).toBe(Math.floor(0.5 * 0x7fff));
  });

  it('downsamples 48 kHz to 16 kHz by averaging', () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000, 16000);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(1);
  });

  it('concatenates chunks', () => {
    expect(Array.from(concatFloat32([new Float32Array([1]), new Float32Array([2, 3])]))).toEqual([1, 2, 3]);
  });
});

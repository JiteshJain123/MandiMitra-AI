// Minimal stand-in for the Gnani APIs, returning the documented response shapes.
// Used ONLY by automated end-to-end tests so they never consume real credits.
import http from 'node:http';

const PORT = Number(process.env.MOCK_GNANI_PORT ?? 4999);
const TRANSCRIPT = 'Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal hai. 2 percent commission aur 500 rupaye transport charge kaat lena.';

// 0.1 s of silent 16-bit mono WAV, served as the "synthesized" audio.
function silentWav() {
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (!req.headers['x-api-key-id']) return json(401, { detail: { error_code: 'MISSING_API_KEY', message: 'missing', status_code: 401 } });
    if (req.method === 'POST' && req.url === '/stt/v3') {
      const text = body.toString('latin1');
      if (!text.includes('name="audio_file"')) return json(422, { detail: [{ loc: ['body', 'audio_file'], msg: 'Field required' }] });
      return json(200, { success: true, request_id: `mock-${Date.now()}`, transcript: TRANSCRIPT, model: 'prisma-v3.0', detected_language_code: 'hi-IN', processing_time: 0.4, end_to_end_latency: 0.5 });
    }
    if (req.method === 'POST' && req.url === '/api/v1/tts/inference') {
      const wav = silentWav();
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
      return res.end(wav);
    }
    if (req.url === '/health') return json(200, { ok: true });
    json(404, { detail: { error_code: 'NOT_FOUND', message: 'not found', status_code: 404 } });
  });
}).listen(PORT, () => console.log(`mock gnani on ${PORT}`));

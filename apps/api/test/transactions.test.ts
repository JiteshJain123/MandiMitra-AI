import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PaymentRecordModel } from '../src/models/payment-record.model.js';
import { app, auth, registerUser, useDatabase, WHEAT } from './helpers.js';

useDatabase();

async function create(token: string, body: Record<string, unknown> = {}, key?: string) {
  const req = request(app).post('/api/transactions').set(auth(token));
  if (key) req.set('Idempotency-Key', key);
  return req.send({ ...WHEAT, confirmed: true, ...body });
}

describe('transaction preview and creation', () => {
  it('previews backend-calculated amounts without saving', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/transactions/preview').set(auth(token)).send(WHEAT).expect(200);
    expect(res.body.amounts).toMatchObject({ grossAmountPaise: 6_000_000, commissionAmountPaise: 120_000, transportChargePaise: 50_000, netAmountPaise: 5_830_000 });
    expect(res.body.summaryText).toContain('₹58,300');
    const list = await request(app).get('/api/transactions').set(auth(token));
    expect(list.body.total).toBe(0);
  });

  it('refuses to save an unconfirmed transaction', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/transactions').set(auth(token)).send(WHEAT);
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/transactions').set(auth(token))).body.total).toBe(0);
  });

  it('ignores client-supplied amounts and computes them server-side', async () => {
    const { token } = await registerUser();
    const res = await create(token, { netAmountPaise: 1 });
    expect(res.status).toBe(400); // unknown fields are rejected by the strict schema
    const ok = await create(token);
    expect(ok.status).toBe(201);
    expect(ok.body.transaction).toMatchObject({ netAmountPaise: 5_830_000, paymentStatus: 'pending', confirmed: true, outstandingPaise: 5_830_000 });
    expect(ok.body.transaction.receiptNumber).toMatch(/^MM-\d{8}-[0-9A-F]{8}$/);
  });

  it('rejects missing required fields and invalid values', async () => {
    const { token } = await registerUser();
    for (const body of [{ cropName: '' }, { quantity: 0 }, { ratePerUnit: -1 }, { unit: 'bag' }, { commissionPercentage: 150 }]) {
      const res = await create(token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const res = await create(token, { transportCharge: 100000 });
    expect(res.body.error.code).toBe('DEDUCTIONS_EXCEED_GROSS');
  });

  it('stores the transcript only with consent', async () => {
    const { token } = await registerUser();
    const without = await create(token, { transcript: '25 quintal gehu', storeTranscript: false });
    expect(without.body.transaction.transcript).toBeUndefined();
    const withConsent = await create(token, { transcript: '25 quintal gehu', storeTranscript: true });
    expect(withConsent.body.transaction.transcript).toBe('25 quintal gehu');
  });

  it('deduplicates repeated requests with the same Idempotency-Key', async () => {
    const { token } = await registerUser();
    const key = 'offline-draft-0001';
    const [a, b] = await Promise.all([create(token, {}, key), create(token, {}, key)]);
    const c = await create(token, {}, key);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(c.status).toBe(200);
    expect(c.body.duplicate).toBe(true);
    expect(new Set([a.body.transaction.id, b.body.transaction.id, c.body.transaction.id]).size).toBe(1);
    expect((await request(app).get('/api/transactions').set(auth(token))).body.total).toBe(1);
  });
});

describe('authorization', () => {
  it('isolates transactions between users', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const { body } = await create(alice.token);
    const id = body.transaction.id;
    expect((await request(app).get(`/api/transactions/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).patch(`/api/transactions/${id}`).set(auth(bob.token)).send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/transactions/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).post(`/api/transactions/${id}/payments`).set(auth(bob.token)).send({ amount: 10 })).status).toBe(404);
    expect((await request(app).get(`/api/transactions/${id}/receipt.pdf`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).get('/api/transactions').set(auth(bob.token))).body.total).toBe(0);
    expect((await request(app).get('/api/analytics').set(auth(bob.token))).body.totals.transactions).toBe(0);
    expect((await request(app).get(`/api/transactions/${id}`).set(auth(alice.token))).status).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/transactions')).status).toBe(401);
    expect((await request(app).post('/api/voice/extract').send({ transcript: 'x' })).status).toBe(401);
  });

  it('returns 404 for malformed ids', async () => {
    const { token } = await registerUser();
    expect((await request(app).get('/api/transactions/not-an-id').set(auth(token))).status).toBe(404);
  });
});

describe('updates and deletion', () => {
  it('recalculates amounts on update', async () => {
    const { token } = await registerUser();
    const id = (await create(token)).body.transaction.id;
    const res = await request(app).patch(`/api/transactions/${id}`).set(auth(token)).send({ quantity: 30, buyerName: 'Demo Buyer' }).expect(200);
    expect(res.body.transaction).toMatchObject({ quantity: 30, grossAmountPaise: 7_200_000, commissionAmountPaise: 144_000, netAmountPaise: 7_200_000 - 144_000 - 50_000, buyerName: 'Demo Buyer' });
  });

  it('does not allow net to drop below recorded payments', async () => {
    const { token } = await registerUser();
    const id = (await create(token)).body.transaction.id;
    await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 50000 }).expect(201);
    const res = await request(app).patch(`/api/transactions/${id}`).set(auth(token)).send({ quantity: 10 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NET_BELOW_RECEIVED');
  });

  it('deletes a transaction and its payment records', async () => {
    const { token } = await registerUser();
    const id = (await create(token)).body.transaction.id;
    await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 1000 }).expect(201);
    await request(app).delete(`/api/transactions/${id}`).set(auth(token)).expect(204);
    expect((await request(app).get(`/api/transactions/${id}`).set(auth(token))).status).toBe(404);
    expect(await PaymentRecordModel.countDocuments({ transactionId: id })).toBe(0);
  });
});

describe('payments', () => {
  it('tracks partial and full payments and derives status', async () => {
    const { token } = await registerUser();
    const id = (await create(token)).body.transaction.id;
    const p1 = await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 20000, method: 'upi' }).expect(201);
    expect(p1.body.transaction).toMatchObject({ paymentStatus: 'partially_paid', amountReceivedPaise: 2_000_000, outstandingPaise: 3_830_000 });
    const over = await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 40000 });
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('OVERPAYMENT');
    const p2 = await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 38300 }).expect(201);
    expect(p2.body.transaction).toMatchObject({ paymentStatus: 'paid', outstandingPaise: 0 });
    const again = await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 1 });
    expect(again.body.error.code).toBe('ALREADY_PAID');

    const history = await request(app).get(`/api/transactions/${id}/payments`).set(auth(token)).expect(200);
    expect(history.body.payments.map((p: { amountPaise: number }) => p.amountPaise)).toEqual([2_000_000, 3_830_000]);

    const reverted = await request(app).delete(`/api/transactions/${id}/payments/${p2.body.payment.id}`).set(auth(token)).expect(200);
    expect(reverted.body.transaction).toMatchObject({ paymentStatus: 'partially_paid', outstandingPaise: 3_830_000 });
  });

  it('keeps disputed status when payments are recorded', async () => {
    const { token } = await registerUser();
    const id = (await create(token, { paymentStatus: 'disputed' })).body.transaction.id;
    const res = await request(app).post(`/api/transactions/${id}/payments`).set(auth(token)).send({ amount: 100 }).expect(201);
    expect(res.body.transaction.paymentStatus).toBe('disputed');
  });

  it('computes pending totals and overdue records in analytics', async () => {
    const { token } = await registerUser();
    const a = (await create(token)).body.transaction.id; // 58,300 net
    await create(token, { cropName: 'Gram', quantity: 10, ratePerUnit: 5000, commissionPercentage: 0, transportCharge: 0, transactionDate: '2026-01-01' });
    await request(app).post(`/api/transactions/${a}/payments`).set(auth(token)).send({ amount: 8300 }).expect(201);
    const res = await request(app).get('/api/analytics').set(auth(token)).expect(200);
    expect(res.body.totals).toMatchObject({
      transactions: 2,
      grossSalesPaise: 6_000_000 + 5_000_000,
      receivedPaise: 830_000,
      pendingPaise: 5_000_000 + 5_000_000,
      partiallyPaidCount: 1,
      overdueCount: 1,
      overduePaise: 5_000_000,
    });
    expect(res.body.cropWise.map((c: { crop: string }) => c.crop).sort()).toEqual(['Gram', 'Wheat']);
    expect(res.body.monthly).toHaveLength(12);
  });
});

describe('listing and export', () => {
  it('searches, filters, sorts and paginates', async () => {
    const { token } = await registerUser();
    await create(token, { cropName: 'Wheat', buyerName: 'Sharma Traders' });
    await create(token, { cropName: 'Mustard', ratePerUnit: 5600 });
    await create(token, { cropName: 'Gram', ratePerUnit: 5200, paymentStatus: 'disputed' });
    const page1 = await request(app).get('/api/transactions?pageSize=2&sort=-net').set(auth(token)).expect(200);
    expect(page1.body).toMatchObject({ total: 3, totalPages: 2, page: 1 });
    expect(page1.body.items.map((t: { cropName: string }) => t.cropName)).toEqual(['Mustard', 'Gram']);
    const search = await request(app).get('/api/transactions?q=sharma').set(auth(token));
    expect(search.body.items).toHaveLength(1);
    const disputed = await request(app).get('/api/transactions?status=disputed').set(auth(token));
    expect(disputed.body.items[0].cropName).toBe('Gram');
    const regexy = await request(app).get('/api/transactions?q=.*').set(auth(token));
    expect(regexy.body.total).toBe(0);
    const bad = await request(app).get('/api/transactions?pageSize=1000').set(auth(token));
    expect(bad.status).toBe(400);
  });

  it('exports CSV with formula-injection protection', async () => {
    const { token } = await registerUser();
    await create(token, { buyerName: '=HYPERLINK("http://evil")' });
    const res = await request(app).get('/api/transactions/export.csv').set(auth(token)).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('58300.00');
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('generates a PDF receipt', async () => {
    const { token } = await registerUser();
    const id = (await create(token, { buyerName: 'रामलाल ट्रेडर्स' })).body.transaction.id;
    const res = await request(app).get(`/api/transactions/${id}/receipt.pdf`).set(auth(token)).buffer(true)
      .parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); })
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

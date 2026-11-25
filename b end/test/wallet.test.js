import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Wallet } from 'ethers';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.JWT_SECRET = 'test-secret';
process.env.TOKEN_ISSUER = 'test-issuer';
process.env.TOKEN_AUDIENCE = 'test-audience';
process.env.PUBLIC_WEB_URL = 'http://localhost:5173/login';
const { createWalletRouter } = await import('../routes/apiWalletRoutes.js');

function fakeDb() {
  const challenges = new Map(); const links = new Map(); let n = 0;
  return {
    from(table) {
      const filters = {};
      return {
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        insert(row) { const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; challenges.set(id, { ...row, id, consumed_at: null }); this.insertedId = id; return this; },
        async single() { return { data: { id: this.insertedId }, error: null }; },
        async maybeSingle() { const row = table === 'wallet_challenges' ? challenges.get(filters.id) : links.get(filters.user_id); return { data: row && Object.entries(filters).every(([k,v]) => row[k] === v) ? row : null, error: null }; },
      };
    },
    async rpc(name, args) {
      assert.equal(name, 'consume_wallet_challenge');
      const row = challenges.get(args.p_id);
      if (!row || row.consumed_at || row.user_id !== args.p_user_id || row.address !== args.p_address || Date.parse(row.expires_at) <= Date.now()) return { data: false, error: null };
      row.consumed_at = new Date().toISOString(); links.set(row.user_id, { user_id: row.user_id, address: row.address, chain_id: 11155111 });
      return { data: true, error: null };
    },
  };
}
const token = jwt.sign({ sub: '00000000-0000-4000-8000-000000000001', role: 'user' }, process.env.JWT_SECRET, { issuer: process.env.TOKEN_ISSUER, audience: process.env.TOKEN_AUDIENCE });
const app = express(); app.use(express.json()); app.use('/api/wallet', createWalletRouter(fakeDb()));
const auth = req => req.set('Authorization', `Bearer ${token}`);

test('wallet linking requires authentication and a valid, single-use signature', async () => {
  const wallet = Wallet.createRandom();
  assert.equal((await request(app).get('/api/wallet')).status, 401);
  const challenge = await auth(request(app).post('/api/wallet/challenge')).send({ address: wallet.address });
  assert.equal(challenge.status, 200);
  const body = challenge.body.data;
  const wrongSignature = await Wallet.createRandom().signMessage(body.message);
  const wrong = await auth(request(app).post('/api/wallet/verify')).send({ challengeId: body.id, signature: wrongSignature });
  assert.equal(wrong.status, 400);
  const signature = await wallet.signMessage(body.message);
  const verified = await auth(request(app).post('/api/wallet/verify')).send({ challengeId: body.id, signature });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.address, wallet.address.toLowerCase());
  const replay = await auth(request(app).post('/api/wallet/verify')).send({ challengeId: body.id, signature });
  assert.equal(replay.status, 400);
  const linked = await auth(request(app).get('/api/wallet'));
  assert.equal(linked.body.data.address, wallet.address.toLowerCase());
});

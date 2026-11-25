import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { getAddress } from 'ethers';
import { SiweMessage } from 'siwe';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { supabase } from '../services/supabase.js';

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const CHAIN_ID = 11155111;

function webOrigin() {
  const url = new URL(process.env.PUBLIC_WEB_URL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('PUBLIC_WEB_URL must use HTTPS outside localhost');
  return url.origin;
}
function normalizedAddress(address) { return getAddress(address).toLowerCase(); }
function serverError(res, error) {
  console.error('WALLET_ERROR:', error.code || error.message);
  return res.status(500).json({ ok: false, error: { code: 'WALLET_UNAVAILABLE', message: 'Wallet service unavailable' } });
}

export function createWalletRouter(database = supabase) {
const router = Router();
router.use(authenticateToken, limiter);
router.get('/', async (req, res) => {
  try {
    const { data, error } = await database.from('wallet_links').select('address,chain_id,linked_at').eq('user_id', req.user.sub).maybeSingle();
    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (error) { return serverError(res, error); }
});

router.post('/challenge', async (req, res) => {
  let address;
  try { address = normalizedAddress(req.body?.address); } catch { return res.status(400).json({ ok: false, error: { code: 'INVALID_ADDRESS' } }); }
  try {
    const origin = webOrigin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const message = new SiweMessage({
      domain: new URL(origin).host,
      address: getAddress(address),
      statement: 'Link this wallet to your Board Game Cafe account.',
      uri: origin,
      version: '1',
      chainId: CHAIN_ID,
      nonce: randomBytes(16).toString('hex'),
      issuedAt: now.toISOString(),
      expirationTime: expiresAt.toISOString(),
    }).prepareMessage();
    const { data, error } = await database.from('wallet_challenges').insert({ user_id: req.user.sub, address, message, expires_at: expiresAt.toISOString() }).select('id').single();
    if (error) throw error;
    return res.json({ ok: true, data: { id: data.id, message, expiresAt: expiresAt.toISOString() } });
  } catch (error) { return serverError(res, error); }
});

router.post('/verify', async (req, res) => {
  const { challengeId, signature } = req.body || {};
  if (typeof challengeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(challengeId) || typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST' } });
  }
  try {
    const { data: challenge, error } = await database.from('wallet_challenges').select('id,address,message,expires_at,consumed_at').eq('id', challengeId).eq('user_id', req.user.sub).maybeSingle();
    if (error) throw error;
    if (!challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now()) return res.status(400).json({ ok: false, error: { code: 'CHALLENGE_EXPIRED' } });
    const message = new SiweMessage(challenge.message);
    const origin = webOrigin();
    if (message.uri !== origin || message.chainId !== CHAIN_ID || normalizedAddress(message.address) !== challenge.address) return res.status(400).json({ ok: false, error: { code: 'INVALID_CHALLENGE' } });
    try { await message.verify({ signature, domain: new URL(origin).host }); }
    catch { return res.status(400).json({ ok: false, error: { code: 'INVALID_SIGNATURE' } }); }
    const { data: linked, error: rpcError } = await database.rpc('consume_wallet_challenge', { p_id: challenge.id, p_user_id: req.user.sub, p_address: challenge.address });
    if (rpcError?.code === '23505') return res.status(409).json({ ok: false, error: { code: 'WALLET_ALREADY_LINKED' } });
    if (rpcError) throw rpcError;
    if (!linked) return res.status(400).json({ ok: false, error: { code: 'CHALLENGE_EXPIRED' } });
    return res.json({ ok: true, data: { address: challenge.address, chainId: CHAIN_ID } });
  } catch (error) { return serverError(res, error); }
});

return router;
}

export default createWalletRouter();

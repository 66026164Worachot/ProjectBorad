import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Wallet } from 'lucide-react';
import api from '../services/api';

const SEPOLIA_CHAIN_ID = '0xaa36a7';

// Connecting a wallet is not authentication and does not link it to an account.
export default function WalletConnection() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkedAccount, setLinkedAccount] = useState('');
  const [linkStatusLoaded, setLinkStatusLoaded] = useState(false);
  const linkEnabled = import.meta.env.VITE_WALLET_LINK_ENABLED === 'true';
  const wallet = typeof window !== 'undefined' ? window.ethereum : undefined;

  useEffect(() => {
    if (!wallet) return undefined;
    let active = true;
    const updateAccounts = (accounts) => { if (active) setAccount(accounts[0] || ''); };
    const updateChain = (chain) => { if (active) setChainId(chain); };
    Promise.all([
      wallet.request({ method: 'eth_accounts' }),
      wallet.request({ method: 'eth_chainId' }),
    ]).then(([accounts, chain]) => {
      updateAccounts(accounts);
      updateChain(chain);
    }).catch(() => { if (active) setError('ไม่สามารถอ่านสถานะกระเป๋าได้'); });
    wallet.on?.('accountsChanged', updateAccounts);
    wallet.on?.('chainChanged', updateChain);
    return () => {
      active = false;
      wallet.removeListener?.('accountsChanged', updateAccounts);
      wallet.removeListener?.('chainChanged', updateChain);
    };
  }, [wallet]);

  useEffect(() => {
    if (!linkEnabled) return undefined;
    let active = true;
    api.get('/api/wallet').then(({ data }) => {
      if (active) { setLinkedAccount(data.data?.address || ''); setLinkStatusLoaded(true); }
    }).catch(() => { if (active) setError('ไม่สามารถตรวจสอบการผูกกระเป๋าได้'); });
    return () => { active = false; };
  }, [linkEnabled]);

  const connect = async () => {
    if (!wallet) { setError('กรุณาติดตั้งกระเป๋าที่รองรับ Ethereum เช่น MetaMask'); return; }
    setBusy(true); setError('');
    try {
      const accounts = await wallet.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0] || '');
      setChainId(await wallet.request({ method: 'eth_chainId' }));
    } catch (err) {
      setError(err.code === 4001 ? 'คุณยกเลิกการเชื่อมกระเป๋าแล้ว' : 'ไม่สามารถเชื่อมกระเป๋าได้ กรุณาลองอีกครั้ง');
    } finally { setBusy(false); }
  };

  const switchNetwork = async () => {
    setBusy(true); setError('');
    try {
      await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      setChainId(await wallet.request({ method: 'eth_chainId' }));
    } catch (err) {
      setError(err.code === 4902 ? 'กรุณาเพิ่มเครือข่าย Sepolia ในกระเป๋าของคุณก่อน' : 'ไม่สามารถเปลี่ยนเครือข่ายได้ กรุณาตรวจสอบกระเป๋า');
    } finally { setBusy(false); }
  };

  const linkWallet = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/wallet/challenge', { address: account });
      const signature = await wallet.request({ method: 'personal_sign', params: [data.data.message, account] });
      const result = await api.post('/api/wallet/verify', { challengeId: data.data.id, signature });
      setLinkedAccount(result.data.data.address);
    } catch (err) {
      setError(err.code === 4001 ? 'คุณยกเลิกการลงนามแล้ว' : err.response?.data?.error?.code === 'WALLET_ALREADY_LINKED' ? 'กระเป๋านี้ผูกกับบัญชีอื่นแล้ว' : 'ไม่สามารถยืนยันกระเป๋าได้ กรุณาลองอีกครั้ง');
    } finally { setBusy(false); }
  };

  return (
    <Box component="section" aria-label="กระเป๋าสำหรับ Smart Contract" sx={{ mb: 2, p: 2, border: '1px solid #fed7aa', borderRadius: 2, bgcolor: '#fffaf5' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Wallet size={20} aria-hidden="true" />
            <Typography fontWeight={700}>กระเป๋า Smart Contract</Typography>
            {account && <Chip size="small" label={chainId === SEPOLIA_CHAIN_ID ? 'Sepolia' : 'เครือข่ายอื่น'} color={chainId === SEPOLIA_CHAIN_ID ? 'success' : 'warning'} />}
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            {account ? `เชื่อมแล้ว: ${account}` : 'เชื่อมกระเป๋าสำหรับเตรียมใช้งานบน Sepolia'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {linkedAccount && account?.toLowerCase() === linkedAccount.toLowerCase() ? 'กระเป๋านี้ผูกกับบัญชีแล้ว' : linkEnabled ? 'การเชื่อมกระเป๋าเพียงอย่างเดียวยังไม่ผูกกับบัญชี' : 'ระบบผูกกระเป๋าและการจองบนบล็อกเชนยังอยู่ระหว่างเตรียมใช้งาน'}
          </Typography>
        </Box>
        {!account ? <Button variant="contained" onClick={connect} disabled={busy}>เชื่อมกระเป๋า</Button> : chainId !== SEPOLIA_CHAIN_ID ? <Button variant="outlined" onClick={switchNetwork} disabled={busy}>เปลี่ยนเป็น Sepolia</Button> : linkEnabled && linkStatusLoaded && account.toLowerCase() !== linkedAccount.toLowerCase() ? <Button variant="outlined" onClick={linkWallet} disabled={busy}>ยืนยันและผูกกระเป๋า</Button> : null}
      </Stack>
      {error && <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError('')}>{error}</Alert>}
    </Box>
  );
}

import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { BrowserProvider, Contract, ContractFactory, isAddress, parseEther } from 'ethers';
import abi from '../contracts/BoardgameBooking.abi.json';
import bytecode from '../contracts/BoardgameBooking.bytecode.json';

const STORAGE_KEY = 'boardgame_sepolia_contract';
export const getSepoliaContractAddress = () => import.meta.env.VITE_SEPOLIA_CONTRACT_ADDRESS || localStorage.getItem(STORAGE_KEY) || '';

export default function SepoliaSetup() {
  const [address, setAddress] = useState(getSepoliaContractAddress);
  const [name, setName] = useState('โต๊ะทดสอบ');
  const [capacity, setCapacity] = useState('4');
  const [price, setPrice] = useState('0.002');
  const [staffAddress, setStaffAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const signerForSepolia = async () => {
    if (!window.ethereum) throw new Error('กรุณาเชื่อมกระเป๋าก่อน');
    const provider = new BrowserProvider(window.ethereum);
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('กรุณาเลือกเครือข่าย Sepolia ในกระเป๋า');
    return provider.getSigner();
  };
  const deploy = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      const signer = await signerForSepolia();
      const contract = await new ContractFactory(abi, bytecode, signer).deploy();
      const tx = contract.deploymentTransaction();
      setMessage(`ส่งธุรกรรม deploy แล้ว รอการยืนยัน: ${tx.hash}`);
      await contract.waitForDeployment();
      const deployed = await contract.getAddress();
      localStorage.setItem(STORAGE_KEY, deployed);
      setAddress(deployed);
      setMessage('Deploy สำเร็จแล้ว กระเป๋าที่ใช้ deploy เป็นเจ้าของสัญญา ขั้นต่อไปเพิ่มโต๊ะทดสอบ');
    } catch (err) { setError(err.reason || err.shortMessage || err.message || 'Deploy ไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const addTable = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      if (!isAddress(address) || !name.trim() || !Number.isInteger(Number(capacity)) || Number(capacity) < 1) throw new Error('กรุณากรอกข้อมูลโต๊ะให้ถูกต้อง');
      const value = parseEther(price);
      if (value <= 0n) throw new Error('ราคาต้องมากกว่าศูนย์');
      const signer = await signerForSepolia();
      const contract = new Contract(address, abi, signer);
      if ((await contract.owner()).toLowerCase() !== (await signer.getAddress()).toLowerCase()) throw new Error('ต้องใช้กระเป๋าเจ้าของสัญญาเพิ่มโต๊ะ');
      const tx = await contract.addTable(name.trim(), Number(capacity), value);
      setMessage(`ส่งธุรกรรมเพิ่มโต๊ะแล้ว รอการยืนยัน: ${tx.hash}`);
      await tx.wait();
      setMessage('เพิ่มโต๊ะทดสอบบน Sepolia แล้ว');
    } catch (err) { setError(err.reason || err.shortMessage || err.message || 'เพิ่มโต๊ะไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const addStaff = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      if (!isAddress(staffAddress)) throw new Error('กรุณากรอก address ของพนักงานให้ถูกต้อง');
      const signer = await signerForSepolia();
      const contract = new Contract(address, abi, signer);
      const owner = await contract.owner();
      if (owner.toLowerCase() !== (await signer.getAddress()).toLowerCase()) throw new Error('ต้องใช้กระเป๋าเจ้าของสัญญาเพิ่มพนักงาน');
      if (owner.toLowerCase() === staffAddress.toLowerCase()) throw new Error('กระเป๋านี้เป็น Owner อยู่แล้ว กรุณาใส่ address ของกระเป๋าพนักงานอีกใบ');
      const tx = await contract.setStaff(staffAddress, true);
      setMessage(`ส่งธุรกรรมเพิ่มสิทธิ์พนักงานแล้ว รอการยืนยัน: ${tx.hash}`);
      await tx.wait();
      setMessage('เพิ่มสิทธิ์กระเป๋าพนักงานบน Sepolia แล้ว');
      setStaffAddress('');
    } catch (err) { setError(err.reason || err.shortMessage || err.message || 'เพิ่มพนักงานไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  return <Box sx={{ border: '1px solid #bfdbfe', bgcolor: '#f8fbff', p: 2, borderRadius: 2, mb: 2 }}>
    <Typography fontWeight={700}>ตั้งค่า Smart Contract สำหรับทดสอบ</Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>ใช้เครือข่าย Sepolia เท่านั้น กระเป๋าที่ deploy จะเป็นเจ้าของสัญญาและต้องยืนยันธุรกรรมด้วยตนเอง</Typography>
    <Alert severity="warning" sx={{ my: 1 }}>สัญญาเป็นต้นแบบ ยังไม่ผ่านการตรวจสอบความปลอดภัย ห้ามใช้กับเงินจริง การจองทดสอบแยกจากระบบเดิม</Alert>
    {!address ? <Button variant="contained" disabled={busy} onClick={deploy}>Deploy สัญญาทดสอบ</Button> : <>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', my: 1 }}>Contract: {address}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField size="small" label="ชื่อโต๊ะทดสอบ" value={name} onChange={e => setName(e.target.value)} />
        <TextField size="small" label="จำนวนคน" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
        <TextField size="small" label="ราคา ETH / ชั่วโมง" value={price} onChange={e => setPrice(e.target.value)} />
        <Button variant="outlined" disabled={busy} onClick={addTable}>เพิ่มโต๊ะทดสอบ</Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
        <TextField size="small" fullWidth label="Wallet address ของพนักงาน" value={staffAddress} onChange={e => setStaffAddress(e.target.value)} />
        <Button variant="outlined" disabled={busy} onClick={addStaff}>เพิ่มสิทธิ์ Staff บนเชน</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>ใช้กระเป๋า Owner เพิ่ม address ของพนักงานอีกใบ จากนั้นสลับไปใช้กระเป๋าพนักงานเพื่อจัดการการจองของ Owner</Typography>
    </>}
    {message && <Alert severity="info" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
  </Box>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { BrowserProvider, Contract, formatEther, isAddress, ZeroHash } from 'ethers';
import { useNavigate } from 'react-router-dom';
import WalletConnection from '../../components/WalletConnection';
import contractAbi from '../../contracts/BoardgameBooking.abi.json';
import { getSepoliaContractAddress } from '../../components/SepoliaSetup';
import { auth } from '../../utils/auth';
import { getDefaultChainBookingTime } from '../../utils/bookingTime';

const statuses = ['รอจ่ายมัดจำ', 'ยืนยันแล้ว', 'เช็กอินแล้ว', 'เสร็จสิ้น', 'ยกเลิกแล้ว', 'หมดเวลาจ่ายมัดจำ', 'ไม่มาใช้บริการ', 'มีข้อพิพาท'];
const formatTime = (timestamp) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(timestamp) * 1000));

export default function ChainReservation({ embedded = false }) {
  const navigate = useNavigate();
  const address = getSepoliaContractAddress();
  const [account, setAccount] = useState('');
  const [tables, setTables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [refund, setRefund] = useState(0n);
  const [form, setForm] = useState(() => ({ table: '', ...getDefaultChainBookingTime(), hours: '1', guests: '1' }));
  const timeEdited = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const configured = isAddress(address);

  const getContract = useCallback(async () => {
    if (!window.ethereum) throw new Error('กรุณาติดตั้งและเชื่อมกระเป๋า Ethereum');
    if (!configured) throw new Error('ยังไม่ได้ตั้งค่า Smart Contract สำหรับ Sepolia');
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== 11155111n) throw new Error('กรุณาเปลี่ยนเครือข่ายกระเป๋าเป็น Sepolia');
    const signer = await provider.getSigner();
    if ((await provider.getCode(address)) === '0x') throw new Error('ไม่พบ Smart Contract ที่ address นี้บน Sepolia');
    return { contract: new Contract(address, contractAbi, signer), signer };
  }, [configured, address]);

  const refresh = useCallback(async () => {
    if (!configured || !window.ethereum) return;
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    setAccount(accounts[0] || '');
    if (!accounts.length) { setBookings([]); return; }
    const { contract } = await getContract();
    const [openingHour, closingHour] = await Promise.all([contract.openingHour(), contract.closingHour()]);
    if (!timeEdited.current) {
      const suggested = getDefaultChainBookingTime(Date.now(), Number(openingHour), Number(closingHour));
      setForm(previous => ({ ...previous, ...suggested }));
    }
    const count = Number(await contract.tableCount());
    if (count > 200) throw new Error('จำนวนโต๊ะมากเกินขอบเขตหน้าทดสอบ');
    const allTables = await Promise.all(Array.from({ length: count }, (_, index) => contract.getTable(index + 1).then(table => ({ id: index + 1, name: table.name, capacity: table.capacity, price: table.pricePerHour, active: table.active }))));
    setTables(allTables.filter(table => table.active));
    setTablesLoaded(true);
    const ids = await contract.getBookingsOf(accounts[0]);
    // ethers returns an immutable Result; copy it before reversing the display order.
    const recentIds = Array.from(ids).slice(-30).reverse();
    const entries = await Promise.all(recentIds.map(async id => ({ id, data: await contract.getBooking(id) })));
    setBookings(entries);
    setRefund(await contract.pendingRefunds(accounts[0]));
  }, [configured, getContract]);

  useEffect(() => {
    const provider = window.ethereum;
    const update = () => { refresh().catch(err => setError(err.shortMessage || err.message)); };
    update();
    provider?.on?.('accountsChanged', update); provider?.on?.('chainChanged', update);
    return () => { provider?.removeListener?.('accountsChanged', update); provider?.removeListener?.('chainChanged', update); };
  }, [refresh]);

  const run = async (action) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const { contract } = await getContract();
      const tx = await action(contract);
      setNotice(`ส่งธุรกรรมแล้ว ${tx.hash} รอการยืนยัน`);
      await tx.wait();
      setNotice(`ธุรกรรมยืนยันแล้ว ${tx.hash}`);
      window.dispatchEvent(new Event('chain-bookings-updated'));
      await refresh();
    } catch (err) { setError(err.reason || err.shortMessage || err.message || 'ไม่สามารถทำรายการได้'); }
    finally { setBusy(false); }
  };

  const createBooking = async (event) => {
    event.preventDefault();
    const start = Math.floor(Date.parse(`${form.date}T${form.time}:00+07:00`) / 1000);
    const hours = Number(form.hours); const guests = Number(form.guests);
    if (!form.table || !form.date || !form.time || !Number.isFinite(start) || !Number.isInteger(hours) || hours < 1 || hours > 8 || !Number.isInteger(guests) || guests < 1) { setError('กรุณากรอกข้อมูลการจองให้ครบ'); return; }
    await run(async (contract) => {
      const [total] = await contract.quoteBooking(form.table, hours);
      return contract.createBooking(form.table, start, hours, guests, total, ZeroHash);
    });
  };

  return <Container maxWidth="lg" disableGutters={embedded} sx={{ py: embedded ? 1 : 3 }}>
    {!embedded && <Typography variant="h4" fontWeight={700} gutterBottom>ทดลองจองบน Sepolia</Typography>}
    <Alert severity="warning" sx={{ mb: 2 }}>ระบบทดลองแยกจากการจองปกติ ใช้ Sepolia ETH เท่านั้น การจองที่นี่ไม่บันทึกลง Supabase และไม่กันโต๊ะของระบบเดิม สัญญายังไม่ได้ตรวจสอบความปลอดภัย</Alert>
    {!embedded && <WalletConnection />}
    {!configured && <Alert severity="info" sx={{ mb: 2 }}>ยังไม่ได้ตั้งค่า address ของสัญญาที่ deploy บน Sepolia จึงยังทำรายการไม่ได้</Alert>}
    {configured && account && tablesLoaded && tables.length === 0 && (
      <Alert severity="warning" sx={{ mb: 2 }} action={['manager', 'staff'].includes(auth.getUserInfo()?.role) ? <Button onClick={() => navigate('/admin/reservation')}>ไปเพิ่มโต๊ะ</Button> : undefined}>
        ยังไม่มีโต๊ะที่เปิดให้จองบน Smart Contract กรุณาเพิ่มโต๊ะทดสอบและยืนยันธุรกรรมในกระเป๋าก่อน จากนั้นกลับมารีเฟรชหน้านี้
      </Alert>
    )}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="info" sx={{ mb: 2, overflowWrap: 'anywhere' }}>{notice}</Alert>}
    <Card sx={{ mb: 3 }}><CardContent>
      <Typography variant="h6" fontWeight={700} gutterBottom>สร้างการจองทดลอง</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>เวลาไทย · เลือกเวลาในช่วงเปิดร้านให้อัตโนมัติ โปรดตรวจสอบโต๊ะว่าง · หลังจองต้องจ่ายมัดจำแยกอีกหนึ่งธุรกรรม</Typography>
      <Box component="form" onSubmit={createBooking}><Stack spacing={2}>
        <TextField select label="โต๊ะบนเชน" value={form.table} onChange={e => setForm({ ...form, table: e.target.value })} required>
          {tables.map(table => <MenuItem key={table.id} value={String(table.id)}>{table.name} · {String(table.capacity)} คน · {formatEther(table.price)} ETH/ชม.</MenuItem>)}
        </TextField>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField type="date" label="วันที่" value={form.date} onChange={e => { timeEdited.current = true; setForm({ ...form, date: e.target.value }); }} InputLabelProps={{ shrink: true }} required fullWidth />
          <TextField type="time" label="เวลาเริ่ม" inputProps={{ step: 3600 }} value={form.time} onChange={e => { timeEdited.current = true; setForm({ ...form, time: e.target.value }); }} InputLabelProps={{ shrink: true }} required fullWidth />
          <TextField type="number" label="ชั่วโมง" inputProps={{ min: 1, max: 8, step: 1 }} value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} fullWidth />
          <TextField type="number" label="จำนวนคน" inputProps={{ min: 1, step: 1 }} value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} fullWidth />
        </Stack>
        <Button type="submit" variant="contained" disabled={busy || !configured || !account || !tables.length}>สร้างการจอง</Button>
      </Stack></Box>
    </CardContent></Card>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Typography variant="h6" fontWeight={700}>การจองของกระเป๋านี้</Typography><Button disabled={busy || !configured || !account} onClick={() => refresh().catch(err => setError(err.message))}>รีเฟรช</Button></Stack>
    {busy && <CircularProgress size={24} />}
    {refund > 0n && <Alert severity="success" sx={{ mb: 2 }} action={<Button disabled={busy} onClick={() => run(c => c.claimRefund())}>รับเงินคืน</Button>}>ยอดรอรับคืน {formatEther(refund)} ETH</Alert>}
    {account && !bookings.length && <Typography color="text.secondary">ไม่พบการจองบนเชนของกระเป๋านี้</Typography>}
    <Stack spacing={2}>{bookings.map(({ id, data }) => {
      const status = Number(data.status); const due = data.totalPrice + data.extraCharges - data.amountHeld;
      return <Card key={String(id)}><CardContent><Stack spacing={1}>
        <Typography fontWeight={700}>การจอง #{String(id)} · {statuses[status]}</Typography>
        <Typography>โต๊ะ #{String(data.tableId)} · {formatTime(data.startTime)} · {String(data.hoursBooked)} ชม.</Typography>
        <Typography>ราคารวม {formatEther(data.totalPrice)} ETH · มัดจำ {formatEther(data.depositAmount)} ETH</Typography>
        {status === 0 && <Typography>จ่ายมัดจำภายใน {formatTime(data.depositDeadline)}</Typography>}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {status === 0 && <Button disabled={busy} variant="contained" onClick={() => run(c => c.payDeposit(id, { value: data.depositAmount }))}>จ่ายมัดจำ</Button>}
          {(status === 0 || status === 1) && <Button disabled={busy} onClick={() => run(c => c.cancelBooking(id))}>ยกเลิก</Button>}
          {status === 2 && <Button disabled={busy} variant="contained" onClick={() => run(c => c.payBalance(id, { value: due }))}>จ่ายยอดคงเหลือ {formatEther(due)} ETH</Button>}
        </Stack>
      </Stack></CardContent></Card>;
    })}</Stack>
  </Container>;
}

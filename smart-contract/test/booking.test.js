import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import solc from 'solc';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, parseEther, ZeroHash, id } from 'ethers';

const source = fs.readFileSync(new URL('../contracts/BoardgameBooking.sol', import.meta.url), 'utf8');
const input = { language: 'Solidity', sources: { 'BoardgameBooking.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } };
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (compiled.errors || []).filter(e => e.severity === 'error');
assert.deepEqual(errors, [], errors.map(e => e.formattedMessage).join('\n'));
const artifact = compiled.contracts['BoardgameBooking.sol'].BoardgameBooking;
assert.ok(artifact.evm.deployedBytecode.object.length / 2 <= 24576, 'contract exceeds EIP-170 size limit');

async function setup() {
  const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, wallet: { totalAccounts: 5 } });
  const provider = new BrowserProvider(rpc);
  const [owner, customer, staff, other] = await Promise.all([0,1,2,3].map(i => provider.getSigner(i)));
  const c = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, owner).deploy();
  await c.waitForDeployment();
  await (await c.addTable('Table A', 4, parseEther('0.002'))).wait();
  await (await c.setStaff(await staff.getAddress(), true)).wait();
  await (await c.setSettings(0, 24, 30, 900)).wait();
  const block = await provider.getBlock('latest');
  const start = Math.ceil((Number(block.timestamp) + 27 * 3600) / 3600) * 3600;
  return { rpc, provider, owner, customer, staff, other, c, start };
}
async function advance(rpc, seconds) { await rpc.request({ method: 'evm_increaseTime', params: [seconds] }); await rpc.request({ method: 'evm_mine', params: [] }); }
async function invariant(c, provider) { const balance = await provider.getBalance(await c.getAddress()); assert.ok(balance >= await c.totalHeld() + await c.totalPendingRefunds() + await c.lockedRevenue() + await c.ownerWithdrawable()); }
async function book(c, signer, start, hours = 1) { const [total] = await c.quoteBooking(1, hours); await (await c.connect(signer).createBooking(1, start, hours, 2, total, ZeroHash)).wait(); return c.bookingCount(); }

test('booking protects slots, expiry and pending limit', async () => {
  const { rpc, c, customer, other, start, provider } = await setup();
  const booking = await book(c, customer, start);
  await assert.rejects(book(c, other, start));
  await book(c, customer, start + 3600); await book(c, customer, start + 7200);
  await assert.rejects(book(c, customer, start + 10800));
  await advance(rpc, 1801);
  await (await c.connect(other).expireBooking(booking)).wait();
  assert.equal(await c.isSlotAvailable(1, start, 1), true);
  await invariant(c, provider);
});

test('deposit, early cancellation and pull refund remain available while paused', async () => {
  const { c, customer, start, provider } = await setup();
  const booking = await book(c, customer, start);
  const [, deposit] = await c.quoteBooking(1, 1);
  await assert.rejects(c.connect(customer).payDeposit(booking, { value: deposit - 1n }));
  await (await c.connect(customer).payDeposit(booking, { value: deposit })).wait();
  await (await c.pause()).wait();
  await (await c.connect(customer).cancelBooking(booking)).wait();
  assert.equal(await c.pendingRefunds(await customer.getAddress()), deposit);
  await invariant(c, provider);
  await (await c.connect(customer).claimRefund()).wait();
  assert.equal(await c.pendingRefunds(await customer.getAddress()), 0n);
  await assert.rejects(c.connect(customer).claimRefund.staticCall());
  await invariant(c, provider);
});

test('check-in, extension, charge, settlement and dispute lock', async () => {
  const { rpc, c, customer, staff, start, provider } = await setup();
  const booking = await book(c, customer, start);
  const [, deposit] = await c.quoteBooking(1, 1);
  await (await c.connect(customer).payDeposit(booking, { value: deposit })).wait();
  await assert.rejects(c.connect(staff).checkIn(booking));
  const block = await provider.getBlock('latest'); await advance(rpc, start - Number(block.timestamp) - 600);
  await (await c.connect(staff).checkIn(booking, { gasLimit: 200000 })).wait();
  await (await c.connect(customer).extendBooking(booking, 1, parseEther('0.002'))).wait();
  await (await c.connect(staff).addCharge(booking, parseEther('0.001'), id('food'))).wait();
  const balance = parseEther('0.005') - deposit;
  await (await c.connect(customer).payBalance(booking, { value: balance })).wait();
  assert.equal(await c.lockedRevenue(), parseEther('0.005'));
  await assert.rejects(c.releaseRevenue(booking));
  await (await c.connect(customer).raiseDispute(booking, id('dispute'))).wait();
  await (await c.resolveDispute(booking, deposit, id('resolution'))).wait();
  assert.equal(await c.pendingRefunds(await customer.getAddress()), deposit);
  assert.equal(await c.ownerWithdrawable(), parseEther('0.005') - deposit);
  await invariant(c, provider);
});

test('shop actions reject own bookings and no-show stays locked until dispute window ends', async () => {
  const { rpc, c, owner, customer, staff, start, provider } = await setup();
  const customerBooking = await book(c, customer, start);
  const [, deposit] = await c.quoteBooking(1, 1);
  await (await c.connect(customer).payDeposit(customerBooking, { value: deposit })).wait();
  const staffBooking = await book(c, staff, start + 3600);
  await (await c.connect(staff).payDeposit(staffBooking, { value: deposit })).wait();
  const current = await rpc.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  await advance(rpc, start - Number(BigInt(current.timestamp)) - 300);
  await assert.rejects(c.connect(staff).checkIn.staticCall(staffBooking));
  await assert.rejects(c.connect(staff).markNoShow.staticCall(customerBooking));
  await advance(rpc, 2101);
  await (await c.connect(staff).markNoShow(customerBooking)).wait();
  assert.equal((await c.getBooking(customerBooking)).status, 6n);
  assert.equal(await c.lockedRevenue(), deposit);
  await assert.rejects(c.connect(owner).releaseRevenue.staticCall(customerBooking));
  await invariant(c, provider);
});

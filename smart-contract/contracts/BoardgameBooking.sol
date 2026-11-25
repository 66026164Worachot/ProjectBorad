// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Experimental escrow for a single boardgame venue. Not audited for production use.
contract BoardgameBooking {
    enum Status { Pending, Confirmed, CheckedIn, Completed, Cancelled, Expired, NoShow, Disputed }
    struct Table { string name; uint256 capacity; uint256 pricePerHour; bool active; }
    struct Policy {
        uint256 depositBps; uint256 minDeposit; uint256 refundEarlyBps; uint256 refundMidBps;
        uint256 refundLateBps; uint256 noShowGrace; uint256 disputeWindow; uint256 timeoutRefund;
        uint256 maxExtraBps;
    }
    struct Booking {
        address customer; uint256 tableId; uint256 startTime; uint256 hoursBooked; uint256 guests;
        uint256 pricePerHour; uint256 totalPrice; uint256 depositAmount; uint256 extraCharges;
        uint256 amountHeld; uint256 createdAt; uint256 checkedInAt; uint256 closedAt;
        uint256 depositDeadline; uint256 policyId; uint256 extendedHours; bytes32 contactHash;
        Status status; bool revenueReleased;
    }
    address public owner;
    address public proposedOwner;
    mapping(address => bool) public staff;
    uint256 public staffCount;
    mapping(uint256 => Table) private tables;
    uint256 public tableCount;
    mapping(uint256 => Booking) private bookings;
    uint256 public bookingCount;
    mapping(uint256 => mapping(uint256 => uint256)) public slotOwner;
    mapping(address => uint256[]) private customerBookings;
    mapping(address => uint256) public pendingCount;
    mapping(address => uint256) public pendingRefunds;
    mapping(uint256 => Policy) private policies;
    uint256 public policyId;
    uint256 public ownerWithdrawable;
    uint256 public lockedRevenue;
    uint256 public totalHeld;
    uint256 public totalPendingRefunds;
    uint256 public openingHour = 12;
    uint256 public closingHour = 24;
    uint256 public expiryMinutes = 30;
    uint256 public checkInEarly = 15 minutes;
    bool public paused;
    bool private entered;
    uint256 private constant BPS = 10_000;
    uint256 private constant HOUR = 1 hours;

    event TableUpdated(uint256 indexed tableId, string name, uint256 capacity, uint256 pricePerHour, bool active);
    event StaffUpdated(address indexed account, bool allowed);
    event PolicyChanged(uint256 indexed policyId);
    event SettingsChanged(uint256 openingHour, uint256 closingHour, uint256 expiryMinutes, uint256 checkInEarly);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed proposedOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(); event Unpaused();
    event BookingCreated(uint256 indexed bookingId, address indexed customer, uint256 indexed tableId, uint256 startTime);
    event DepositPaid(uint256 indexed bookingId, uint256 amount);
    event BookingCancelled(uint256 indexed bookingId, uint256 refund, uint256 retained, bytes32 reasonHash);
    event BookingExpired(uint256 indexed bookingId);
    event CheckedIn(uint256 indexed bookingId);
    event ExtraChargeAdded(uint256 indexed bookingId, uint256 amount, bytes32 noteHash);
    event BookingExtended(uint256 indexed bookingId, uint256 extraHours, uint256 newEndTime, uint256 addedPrice);
    event BalancePaid(uint256 indexed bookingId, uint256 amount);
    event NoShowMarked(uint256 indexed bookingId);
    event DisputeRaised(uint256 indexed bookingId, address indexed by, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed bookingId, uint256 refund, uint256 retained, bytes32 reasonHash);
    event RefundClaimed(address indexed customer, uint256 amount);
    event RevenueReleased(uint256 indexed bookingId, uint256 amount);
    event RevenueWithdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier onlyStaff() { require(isStaff(msg.sender), "Only staff"); _; }
    modifier whenRunning() { require(!paused, "Contract paused"); _; }
    modifier nonReentrant() { require(!entered, "Reentrant call"); entered = true; _; entered = false; }
    constructor() {
        owner = msg.sender;
        policyId = 1;
        policies[1] = Policy(3000, 0.0001 ether, 10000, 5000, 0, 30 minutes, 24 hours, 7 days, 10000);
    }
    function isStaff(address account) public view returns (bool) { return account == owner || staff[account]; }
    function setStaff(address account, bool allowed) external onlyOwner {
        require(account != address(0) && account != owner, "Invalid address");
        if (staff[account] != allowed) { if (allowed) { require(staffCount < 20, "Too many staff"); ++staffCount; } else { --staffCount; } staff[account] = allowed; }
        emit StaffUpdated(account, allowed);
    }
    function proposeOwner(address account) external onlyOwner { require(account != address(0), "Invalid address"); proposedOwner = account; emit OwnershipTransferStarted(owner, account); }
    function acceptOwner() external { require(msg.sender == proposedOwner, "Only proposed owner"); address previous = owner; owner = msg.sender; proposedOwner = address(0); if (staff[owner]) { staff[owner] = false; --staffCount; } emit OwnershipTransferred(previous, owner); }
    function pause() external onlyOwner { paused = true; emit Paused(); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(); }
    function setSettings(uint256 open, uint256 close, uint256 expiry, uint256 early) external onlyOwner {
        require(open < close && close <= 24 && expiry >= 10 && expiry <= 120 && early <= 60 minutes, "Invalid settings");
        openingHour = open; closingHour = close; expiryMinutes = expiry; checkInEarly = early;
        emit SettingsChanged(open, close, expiry, early);
    }
    function setPolicy(Policy calldata p) external onlyOwner {
        require(p.depositBps >= 1000 && p.depositBps <= BPS && p.minDeposit <= 0.01 ether, "Invalid deposit");
        require(p.refundEarlyBps <= BPS && p.refundEarlyBps >= p.refundMidBps && p.refundMidBps >= p.refundLateBps, "Invalid refunds");
        require(p.noShowGrace >= 15 minutes && p.noShowGrace <= 120 minutes && p.disputeWindow >= 12 hours && p.disputeWindow <= 72 hours, "Invalid window");
        require(p.timeoutRefund >= 3 days && p.timeoutRefund <= 30 days && p.maxExtraBps <= 20000, "Invalid policy");
        policies[++policyId] = p; emit PolicyChanged(policyId);
    }
    function addTable(string calldata name, uint256 capacity, uint256 price) external onlyOwner returns (uint256 id) {
        require(bytes(name).length != 0 && capacity > 0 && price > 0, "Invalid table");
        id = ++tableCount; tables[id] = Table(name, capacity, price, true); emit TableUpdated(id, name, capacity, price, true);
    }
    function updateTable(uint256 id, string calldata name, uint256 capacity, uint256 price, bool active) external onlyOwner {
        require(id > 0 && id <= tableCount && bytes(name).length != 0 && capacity > 0 && price > 0, "Invalid table");
        tables[id] = Table(name, capacity, price, active); emit TableUpdated(id, name, capacity, price, active);
    }
    function getTable(uint256 id) external view returns (Table memory) { require(id > 0 && id <= tableCount, "Invalid table"); return tables[id]; }
    function getBooking(uint256 id) external view returns (Booking memory) { require(id > 0 && id <= bookingCount, "Invalid booking"); return bookings[id]; }
    function getPolicy(uint256 id) external view returns (Policy memory) { require(id > 0 && id <= policyId, "Invalid policy"); return policies[id]; }
    function getBookingsOf(address account) external view returns (uint256[] memory) { return customerBookings[account]; }
    function quoteBooking(uint256 id, uint256 hoursBooked) public view returns (uint256 total, uint256 deposit) {
        require(id > 0 && id <= tableCount && tables[id].active, "Table not active"); require(hoursBooked > 0 && hoursBooked <= 8, "Invalid hours");
        total = tables[id].pricePerHour * hoursBooked; Policy storage p = policies[policyId];
        deposit = (total * p.depositBps + BPS - 1) / BPS; if (deposit < p.minDeposit) deposit = p.minDeposit;
        // A deposit cannot exceed the entire booking price.
        if (deposit > total) deposit = total;
    }
    function isSlotAvailable(uint256 tableId, uint256 start, uint256 hoursBooked) public view returns (bool) {
        if (tableId == 0 || tableId > tableCount || !tables[tableId].active || start % HOUR != 0 || hoursBooked == 0 || hoursBooked > 8) return false;
        for (uint256 i; i < hoursBooked; ++i) if (slotOwner[tableId][start + i * HOUR] != 0) return false;
        return true;
    }
    function _withinOpeningHours(uint256 start, uint256 hoursBooked) internal view returns (bool) {
        uint256 localHour = ((start + 7 hours) % 1 days) / HOUR;
        return localHour >= openingHour && localHour + hoursBooked <= closingHour;
    }
    function createBooking(uint256 tableId, uint256 start, uint256 hoursBooked, uint256 guests, uint256 expectedTotal, bytes32 contactHash) external whenRunning returns (uint256 id) {
        require(start % HOUR == 0 && start >= block.timestamp + HOUR && start <= block.timestamp + 30 days, "Invalid start time");
        require(hoursBooked > 0 && hoursBooked <= 8 && _withinOpeningHours(start, hoursBooked), "Invalid hours");
        require(guests > 0 && guests <= tables[tableId].capacity, "Invalid guests");
        require(pendingCount[msg.sender] < 3, "Too many pending bookings");
        (uint256 total, uint256 deposit) = quoteBooking(tableId, hoursBooked); require(total == expectedTotal, "Price changed");
        require(isSlotAvailable(tableId, start, hoursBooked), "Slot already booked");
        id = ++bookingCount; Booking storage b = bookings[id];
        b.customer = msg.sender; b.tableId = tableId; b.startTime = start; b.hoursBooked = hoursBooked; b.guests = guests;
        b.pricePerHour = tables[tableId].pricePerHour; b.totalPrice = total; b.depositAmount = deposit;
        b.createdAt = block.timestamp; b.depositDeadline = block.timestamp + expiryMinutes * 1 minutes; b.policyId = policyId; b.contactHash = contactHash;
        for (uint256 i; i < hoursBooked; ++i) slotOwner[tableId][start + i * HOUR] = id;
        ++pendingCount[msg.sender]; customerBookings[msg.sender].push(id); emit BookingCreated(id, msg.sender, tableId, start);
    }
    function _booking(uint256 id) internal view returns (Booking storage b) { require(id > 0 && id <= bookingCount, "Invalid booking"); b = bookings[id]; }
    function _own(Booking storage b) internal view { require(msg.sender == b.customer, "Not your booking"); }
    function _shop(Booking storage b) internal view { require(msg.sender != b.customer, "Cannot act on own booking"); }
    function _free(Booking storage b) internal { for (uint256 i; i < b.hoursBooked; ++i) delete slotOwner[b.tableId][b.startTime + i * HOUR]; }
    function payDeposit(uint256 id) external payable whenRunning { Booking storage b = _booking(id); _own(b); require(b.status == Status.Pending && block.timestamp <= b.depositDeadline, "Deposit expired"); require(msg.value == b.depositAmount, "Incorrect payment"); --pendingCount[b.customer]; b.status = Status.Confirmed; b.amountHeld = msg.value; totalHeld += msg.value; emit DepositPaid(id, msg.value); }
    function expireBooking(uint256 id) external { Booking storage b = _booking(id); require(b.status == Status.Pending && block.timestamp > b.depositDeadline, "Not expired"); --pendingCount[b.customer]; b.status = Status.Expired; _free(b); emit BookingExpired(id); }
    function _settle(Booking storage b, uint256 refund) internal returns (uint256 retained) {
        uint256 held = b.amountHeld; require(refund <= held, "Refund exceeds held"); retained = held - refund;
        b.amountHeld = 0; totalHeld -= held; pendingRefunds[b.customer] += refund; totalPendingRefunds += refund; ownerWithdrawable += retained;
    }
    function cancelBooking(uint256 id) external { Booking storage b = _booking(id); _own(b);
        if (b.status == Status.Pending) { --pendingCount[b.customer]; b.status = Status.Cancelled; _free(b); emit BookingCancelled(id, 0, 0, 0); return; }
        require(b.status == Status.Confirmed && block.timestamp < b.startTime, "Cannot cancel now");
        Policy storage p = policies[b.policyId]; uint256 remaining = b.startTime - block.timestamp;
        uint256 rate = remaining >= 24 hours ? p.refundEarlyBps : remaining >= 2 hours ? p.refundMidBps : p.refundLateBps;
        uint256 refund = b.amountHeld * rate / BPS; b.status = Status.Cancelled; _free(b); uint256 retained = _settle(b, refund); emit BookingCancelled(id, refund, retained, 0);
    }
    function shopCancel(uint256 id, bytes32 reasonHash) external onlyStaff { Booking storage b = _booking(id); _shop(b); require(b.status == Status.Confirmed, "Cannot cancel now"); require(reasonHash != 0, "Reason required"); uint256 refund = b.amountHeld; b.status = Status.Cancelled; _free(b); _settle(b, refund); emit BookingCancelled(id, refund, 0, reasonHash); }
    function checkIn(uint256 id) external onlyStaff { Booking storage b = _booking(id); _shop(b); require(b.status == Status.Confirmed && block.timestamp + checkInEarly >= b.startTime && block.timestamp <= b.startTime + policies[b.policyId].noShowGrace, "Not in check-in window"); b.status = Status.CheckedIn; b.checkedInAt = block.timestamp; emit CheckedIn(id); }
    function addCharge(uint256 id, uint256 amount, bytes32 noteHash) external onlyStaff { Booking storage b = _booking(id); _shop(b); require(b.status == Status.CheckedIn && amount > 0 && noteHash != 0, "Invalid charge"); require(b.extraCharges + amount <= b.totalPrice * policies[b.policyId].maxExtraBps / BPS, "Charge exceeds cap"); b.extraCharges += amount; emit ExtraChargeAdded(id, amount, noteHash); }
    function extendBooking(uint256 id, uint256 extraHours, uint256 expectedAddedPrice) external whenRunning { Booking storage b = _booking(id); _own(b); require(b.status == Status.CheckedIn && block.timestamp <= b.startTime + b.hoursBooked * HOUR, "Cannot extend now"); require(tables[b.tableId].active, "Table not active"); require(extraHours > 0 && extraHours <= 4 && b.hoursBooked + extraHours <= 8, "Invalid hours"); require(_withinOpeningHours(b.startTime, b.hoursBooked + extraHours), "Closing time exceeded"); uint256 added = b.pricePerHour * extraHours; require(added == expectedAddedPrice, "Price changed"); uint256 start = b.startTime + b.hoursBooked * HOUR; require(isSlotAvailable(b.tableId, start, extraHours), "Slot already booked"); for (uint256 i; i < extraHours; ++i) slotOwner[b.tableId][start + i * HOUR] = id; b.hoursBooked += extraHours; b.extendedHours += extraHours; b.totalPrice += added; emit BookingExtended(id, extraHours, b.startTime + b.hoursBooked * HOUR, added); }
    function payBalance(uint256 id) external payable { Booking storage b = _booking(id); _own(b); require(b.status == Status.CheckedIn, "Invalid status"); require(msg.value == b.totalPrice + b.extraCharges - b.amountHeld, "Incorrect payment"); b.amountHeld += msg.value; totalHeld += msg.value; b.status = Status.Completed; b.closedAt = block.timestamp; totalHeld -= b.amountHeld; lockedRevenue += b.amountHeld; emit BalancePaid(id, msg.value); }
    function markNoShow(uint256 id) external onlyStaff { Booking storage b = _booking(id); _shop(b); require(b.status == Status.Confirmed && block.timestamp > b.startTime + policies[b.policyId].noShowGrace, "Cannot mark no-show"); b.status = Status.NoShow; b.closedAt = block.timestamp; totalHeld -= b.amountHeld; lockedRevenue += b.amountHeld; emit NoShowMarked(id); }
    function raiseDispute(uint256 id, bytes32 reasonHash) external { Booking storage b = _booking(id); require(msg.sender == b.customer || (isStaff(msg.sender) && msg.sender != b.customer), "Not authorized"); require(reasonHash != 0, "Reason required");
        if (b.status == Status.Completed || b.status == Status.NoShow) { require(!b.revenueReleased && block.timestamp <= b.closedAt + policies[b.policyId].disputeWindow, "Dispute window closed"); lockedRevenue -= b.amountHeld; totalHeld += b.amountHeld; }
        else require(b.status == Status.Confirmed || b.status == Status.CheckedIn, "Invalid status");
        b.status = Status.Disputed; emit DisputeRaised(id, msg.sender, reasonHash);
    }
    function resolveDispute(uint256 id, uint256 refund, bytes32 reasonHash) external onlyOwner { Booking storage b = _booking(id); _shop(b); require(b.status == Status.Disputed && reasonHash != 0, "Invalid dispute"); b.status = refund == b.amountHeld ? Status.Cancelled : Status.Completed; uint256 retained = _settle(b, refund); emit DisputeResolved(id, refund, retained, reasonHash); }
    function claimTimeoutRefund(uint256 id) external { Booking storage b = _booking(id); _own(b); require(b.status == Status.Confirmed && block.timestamp > b.startTime + b.hoursBooked * HOUR + policies[b.policyId].timeoutRefund, "Too early"); uint256 refund = b.amountHeld; b.status = Status.Cancelled; _free(b); _settle(b, refund); emit BookingCancelled(id, refund, 0, 0); }
    function releaseRevenue(uint256 id) external onlyOwner { Booking storage b = _booking(id); require((b.status == Status.Completed || b.status == Status.NoShow) && !b.revenueReleased && b.closedAt != 0 && block.timestamp > b.closedAt + policies[b.policyId].disputeWindow, "Revenue locked"); uint256 amount = b.amountHeld; b.amountHeld = 0; b.revenueReleased = true; lockedRevenue -= amount; ownerWithdrawable += amount; emit RevenueReleased(id, amount); }
    function claimRefund() external nonReentrant { uint256 amount = pendingRefunds[msg.sender]; require(amount > 0, "Nothing to claim"); pendingRefunds[msg.sender] = 0; totalPendingRefunds -= amount; (bool ok,) = payable(msg.sender).call{value: amount}(""); require(ok, "Transfer failed"); emit RefundClaimed(msg.sender, amount); }
    function withdrawRevenue(uint256 amount) external onlyOwner nonReentrant { require(amount > 0 && amount <= ownerWithdrawable, "Invalid amount"); ownerWithdrawable -= amount; (bool ok,) = payable(owner).call{value: amount}(""); require(ok, "Transfer failed"); emit RevenueWithdrawn(owner, amount); }
}

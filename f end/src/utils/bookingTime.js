const HOUR_MS = 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS;

// Pick an hour at least one hour ahead, allowing one minute for a transaction.
// This checks opening hours, not availability of a particular table.
export function getDefaultChainBookingTime(now = Date.now(), openingHour = 12, closingHour = 24) {
  if (!Number.isInteger(openingHour) || !Number.isInteger(closingHour) || openingHour < 0 || closingHour > 24 || openingHour >= closingHour) {
    throw new Error('Invalid opening hours');
  }
  let local = Math.ceil((now + HOUR_MS + 60_000) / HOUR_MS) * HOUR_MS + BANGKOK_OFFSET_MS;
  const hour = new Date(local).getUTCHours();
  const localMidnight = Math.floor(local / (24 * HOUR_MS)) * 24 * HOUR_MS;
  if (hour < openingHour) local = localMidnight + openingHour * HOUR_MS;
  else if (hour >= closingHour) local = localMidnight + 24 * HOUR_MS + openingHour * HOUR_MS;
  const date = new Date(local);
  return { date: date.toISOString().slice(0, 10), time: `${String(date.getUTCHours()).padStart(2, '0')}:00` };
}

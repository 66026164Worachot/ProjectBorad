const NUMERIC_KEYS = ['default_capacity', 'capacity', 'max_capacity', 'max_guests'];

function toPositiveInteger(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
}

export function deriveCategoryCapacity(category) {
  if (!category || typeof category !== 'object') {
    return null;
  }

  for (const key of NUMERIC_KEYS) {
    if (key in category) {
      const numeric = toPositiveInteger(category[key]);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  return null;
}

export function resolveTableCapacity(table, fallback = null) {
  const fromCategory = deriveCategoryCapacity(table?.category);
  if (fromCategory !== null) {
    return fromCategory;
  }

  const direct = toPositiveInteger(table?.capacity);
  if (direct !== null) {
    return direct;
  }

  return fallback;
}

export function normalizeTableCapacity(table) {
  if (!table || typeof table !== 'object') {
    return table;
  }

  const normalized = { ...table };
  const capacity = resolveTableCapacity(table);

  if (capacity !== null) {
    normalized.capacity = capacity;
  } else if ('capacity' in normalized) {
    delete normalized.capacity;
  }

  return normalized;
}

export function normalizeBookingTable(booking) {
  if (!booking || typeof booking !== 'object') {
    return booking;
  }

  const normalized = { ...booking };

  if (normalized.table) {
    normalized.table = normalizeTableCapacity(normalized.table);
  }

  return normalized;
}

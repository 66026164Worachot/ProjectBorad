const DEFAULT_CURRENCY_OPTIONS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
};

const PRICE_EPSILON = 0.009;

export function formatCurrencyTHB(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '฿0.00';
  }

  const { minimumFractionDigits, maximumFractionDigits } = {
    ...DEFAULT_CURRENCY_OPTIONS,
    ...options
  };

  return `฿${numeric.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits
  })}`;
}

export function normalizePrice(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  return fallback;
}

export function getCategoryPricing(category) {
  if (!category || typeof category !== 'object') {
    return {
      basePrice: 0,
      extraHourPrice: 0,
      hasAdditionalRate: false
    };
  }

  const basePrice = normalizePrice(
    category.base_price ?? category.price_per_hour ?? 0,
    0
  );

  const extraHourPrice = normalizePrice(
    category.extra_hour_price ?? category.price_per_hour ?? basePrice,
    basePrice
  );

  return {
    basePrice,
    extraHourPrice,
    hasAdditionalRate: Math.abs(extraHourPrice - basePrice) > PRICE_EPSILON
  };
}

export function calculateRoomPrice(hours, basePrice, extraHourPrice = basePrice) {
  const numericHours = Number(hours);

  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    return 0;
  }

  const normalizedBase = normalizePrice(basePrice, 0);
  if (normalizedBase <= 0) {
    return 0;
  }

  const normalizedExtra = normalizePrice(extraHourPrice, normalizedBase);

  if (numericHours <= 1) {
    return normalizedBase;
  }

  const incrementalRate = normalizedExtra > 0 ? normalizedExtra : normalizedBase;
  return normalizedBase + (numericHours - 1) * incrementalRate;
}

export function calculateCategoryPrice(hours, category) {
  const { basePrice, extraHourPrice } = getCategoryPricing(category);
  return calculateRoomPrice(hours, basePrice, extraHourPrice);
}

export function formatCategoryPricing(category, { style = 'long' } = {}) {
  const { basePrice, extraHourPrice, hasAdditionalRate } = getCategoryPricing(category);

  if (basePrice <= 0) {
    return 'Pricing unavailable';
  }

  const baseText = formatCurrencyTHB(basePrice);

  if (!hasAdditionalRate) {
    return `${baseText}/hr`;
  }

  const extraText = formatCurrencyTHB(extraHourPrice);

  if (style === 'short') {
    return `${baseText} • +${extraText}/hr`;
  }

  if (style === 'compact') {
    return `${baseText} (1st hr) · +${extraText}/hr`;
  }

  return `${baseText} (first hour) • +${extraText}/additional hour`;
}

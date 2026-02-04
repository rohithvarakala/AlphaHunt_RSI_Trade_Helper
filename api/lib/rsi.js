// Wilder's Smoothed RSI Calculator (1978 methodology)

const RSI_CONFIG = {
  period: 14,
  oversoldThreshold: 30,
  overboughtThreshold: 70,
  validRange: { min: 1, max: 99 }
};

export function calculatePriceChanges(closes) {
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  return changes;
}

export function separateGainsLosses(changes) {
  const gains = [];
  const losses = [];

  for (const change of changes) {
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  return { gains, losses };
}

export function calculateSMA(values, period) {
  if (values.length < period) return null;
  const sum = values.slice(0, period).reduce((acc, val) => acc + val, 0);
  return sum / period;
}

export function validateRSI(rsi) {
  if (rsi === null || rsi === undefined || isNaN(rsi)) return null;
  if (rsi < RSI_CONFIG.validRange.min || rsi > RSI_CONFIG.validRange.max) return null;
  return Math.round(rsi * 100) / 100;
}

export function calculateRSI(closes, period = RSI_CONFIG.period) {
  if (!closes || closes.length < period + 1) return [];

  const changes = calculatePriceChanges(closes);
  const { gains, losses } = separateGainsLosses(changes);

  const rsiValues = new Array(period).fill(null);

  let avgGain = calculateSMA(gains, period);
  let avgLoss = calculateSMA(losses, period);

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  rsiValues.push(validateRSI(rsi));

  for (let i = period; i < changes.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    rsiValues.push(validateRSI(rsi));
  }

  return rsiValues;
}

export function getCurrentRSI(closes, period = RSI_CONFIG.period) {
  const rsiValues = calculateRSI(closes, period);
  if (rsiValues.length === 0) return null;
  return rsiValues[rsiValues.length - 1];
}

export function isOversold(rsi, threshold = RSI_CONFIG.oversoldThreshold) {
  return rsi !== null && rsi < threshold;
}

export function isOverbought(rsi, threshold = RSI_CONFIG.overboughtThreshold) {
  return rsi !== null && rsi > threshold;
}

export function analyzeCurrentState(ohlcv, period = RSI_CONFIG.period) {
  if (!ohlcv || ohlcv.length < period + 1) {
    return { valid: false, reason: 'Insufficient data' };
  }

  const closes = ohlcv.map(c => c.close);
  const rsiValues = calculateRSI(closes, period);
  const currentRSI = rsiValues[rsiValues.length - 1];
  const previousRSI = rsiValues[rsiValues.length - 2];
  const latestCandle = ohlcv[ohlcv.length - 1];

  const rsiTrend = currentRSI > previousRSI ? 'rising' : 'falling';

  let zone = 'neutral';
  if (currentRSI < RSI_CONFIG.oversoldThreshold) zone = 'oversold';
  else if (currentRSI > RSI_CONFIG.overboughtThreshold) zone = 'overbought';

  let activeSignal = null;
  if (currentRSI < RSI_CONFIG.oversoldThreshold && previousRSI >= RSI_CONFIG.oversoldThreshold) {
    activeSignal = 'OVERSOLD_ENTRY';
  } else if (currentRSI > RSI_CONFIG.overboughtThreshold && previousRSI <= RSI_CONFIG.overboughtThreshold) {
    activeSignal = 'OVERBOUGHT_EXIT';
  }

  return {
    valid: true,
    timestamp: latestCandle.timestamp,
    date: new Date(latestCandle.timestamp).toISOString(),
    price: latestCandle.close,
    rsi: currentRSI,
    previousRsi: previousRSI,
    rsiTrend,
    zone,
    isOversold: isOversold(currentRSI),
    isOverbought: isOverbought(currentRSI),
    activeSignal,
    distanceFromOversold: currentRSI - RSI_CONFIG.oversoldThreshold,
    distanceFromOverbought: RSI_CONFIG.overboughtThreshold - currentRSI
  };
}

export { RSI_CONFIG };

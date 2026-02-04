// Backtesting Engine for RSI Strategy
import { calculateRSI, RSI_CONFIG } from './rsi.js';

const BACKTEST_CONFIG = {
  forwardReturns: { '1D': 1, '1W': 5, '2W': 10, '1M': 21 }
};

const RISK_CONFIG = {
  takeProfitPercent: 5,
  stopLossPercent: 10
};

export function getOversoldSignals(ohlcv, period = RSI_CONFIG.period) {
  const closes = ohlcv.map(c => c.close);
  const rsiValues = calculateRSI(closes, period);
  const signals = [];

  for (let i = 1; i < ohlcv.length; i++) {
    const currentRSI = rsiValues[i];
    const previousRSI = rsiValues[i - 1];

    if (currentRSI === null || previousRSI === null) continue;

    if (currentRSI < RSI_CONFIG.oversoldThreshold &&
        previousRSI >= RSI_CONFIG.oversoldThreshold) {
      signals.push({
        timestamp: ohlcv[i].timestamp,
        date: new Date(ohlcv[i].timestamp).toISOString(),
        close: ohlcv[i].close,
        rsi: currentRSI,
        previousRsi: previousRSI,
        signal: 'OVERSOLD_ENTRY',
        index: i
      });
    }
  }

  return signals;
}

export function calculateForwardReturns(signal, ohlcv) {
  const entryIndex = signal.index;
  const entryPrice = signal.close;
  const returns = {};

  for (const [horizon, days] of Object.entries(BACKTEST_CONFIG.forwardReturns)) {
    const exitIndex = entryIndex + days;

    if (exitIndex < ohlcv.length) {
      const exitPrice = ohlcv[exitIndex].close;
      const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

      returns[horizon] = {
        days,
        exitPrice,
        exitDate: new Date(ohlcv[exitIndex].timestamp).toISOString(),
        returnPercent: Math.round(returnPercent * 100) / 100,
        isWin: returnPercent > 0
      };
    } else {
      returns[horizon] = null;
    }
  }

  return returns;
}

export function simulateTrade(signal, ohlcv, takeProfitPercent = RISK_CONFIG.takeProfitPercent, stopLossPercent = RISK_CONFIG.stopLossPercent, maxHoldingDays = 21) {
  const entryIndex = signal.index;
  const entryPrice = signal.close;
  const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
  const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);

  let exitReason = null;
  let exitPrice = null;
  let exitIndex = null;
  let holdingDays = 0;

  for (let i = entryIndex + 1; i < ohlcv.length && i <= entryIndex + maxHoldingDays; i++) {
    const candle = ohlcv[i];
    holdingDays = i - entryIndex;

    if (candle.low <= stopLossPrice) {
      exitReason = 'STOP_LOSS';
      exitPrice = stopLossPrice;
      exitIndex = i;
      break;
    }

    if (candle.high >= takeProfitPrice) {
      exitReason = 'TAKE_PROFIT';
      exitPrice = takeProfitPrice;
      exitIndex = i;
      break;
    }
  }

  if (!exitReason) {
    const lastIndex = Math.min(entryIndex + maxHoldingDays, ohlcv.length - 1);
    exitReason = 'MAX_HOLDING';
    exitPrice = ohlcv[lastIndex].close;
    exitIndex = lastIndex;
    holdingDays = lastIndex - entryIndex;
  }

  const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

  return {
    entryDate: new Date(signal.timestamp).toISOString(),
    entryPrice,
    entryRsi: signal.rsi,
    exitDate: new Date(ohlcv[exitIndex].timestamp).toISOString(),
    exitPrice,
    exitReason,
    holdingDays,
    returnPercent: Math.round(returnPercent * 100) / 100,
    isWin: returnPercent > 0
  };
}

export function runBacktest(ohlcv, options = {}) {
  const { takeProfitPercent = RISK_CONFIG.takeProfitPercent, stopLossPercent = RISK_CONFIG.stopLossPercent } = options;

  const signals = getOversoldSignals(ohlcv);

  if (signals.length === 0) {
    return { valid: false, reason: 'No oversold signals found', signals: [] };
  }

  const trades = [];
  const forwardReturnsData = {
    '1D': { wins: 0, losses: 0, returns: [] },
    '1W': { wins: 0, losses: 0, returns: [] },
    '2W': { wins: 0, losses: 0, returns: [] },
    '1M': { wins: 0, losses: 0, returns: [] }
  };

  for (const signal of signals) {
    const forwardReturns = calculateForwardReturns(signal, ohlcv);

    for (const [horizon, data] of Object.entries(forwardReturns)) {
      if (data && forwardReturnsData[horizon]) {
        forwardReturnsData[horizon].returns.push(data.returnPercent);
        if (data.isWin) forwardReturnsData[horizon].wins++;
        else forwardReturnsData[horizon].losses++;
      }
    }

    const trade = simulateTrade(signal, ohlcv, takeProfitPercent, stopLossPercent);
    trade.forwardReturns = forwardReturns;
    trades.push(trade);
  }

  // Calculate statistics
  const wins = trades.filter(t => t.isWin).length;
  const returns = trades.map(t => t.returnPercent);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

  const forwardStats = {};
  for (const [horizon, data] of Object.entries(forwardReturnsData)) {
    const total = data.wins + data.losses;
    forwardStats[horizon] = {
      totalSignals: total,
      wins: data.wins,
      losses: data.losses,
      winRate: total > 0 ? Math.round((data.wins / total) * 100 * 100) / 100 : 0,
      avgReturn: data.returns.length > 0
        ? Math.round((data.returns.reduce((a, b) => a + b, 0) / data.returns.length) * 100) / 100
        : 0
    };
  }

  return {
    valid: true,
    totalSignals: signals.length,
    totalTrades: trades.length,
    stats: {
      wins,
      losses: trades.length - wins,
      winRate: Math.round((wins / trades.length) * 100 * 100) / 100,
      avgReturn: Math.round(avgReturn * 100) / 100
    },
    forwardReturns: forwardStats,
    trades: trades.slice(-10) // Return last 10 trades for display
  };
}

export { BACKTEST_CONFIG, RISK_CONFIG };

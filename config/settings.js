import 'dotenv/config';

export const RSI_CONFIG = {
  period: 14,
  oversoldThreshold: 30,
  overboughtThreshold: 70,
  minHistoryDays: 200,
  validRange: {
    min: 1,
    max: 99
  }
};

export const BACKTEST_CONFIG = {
  forwardReturns: {
    '1D': 1,
    '1W': 5,
    '2W': 10,
    '1M': 21
  }
};

export const RISK_CONFIG = {
  maxLeverage: 8,
  takeProfitPercent: 5,
  stopLossPercent: 10,
  maxPositions: 3,
  positionSizePercent: 10
};

export const SCANNER_CONFIG = {
  topCoinsCount: 50,
  quoteCurrency: 'USDT',
  exchange: 'mexc',
  timeframe: '1d',
  marketType: 'swap' // futures
};

export const MEXC_CONFIG = {
  apiKey: process.env.MEXC_API_KEY || '',
  apiSecret: process.env.MEXC_API_SECRET || '',
  enableRateLimit: true,
  options: {
    defaultType: 'swap'
  }
};

export const FIREBASE_CONFIG = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

export default {
  RSI: RSI_CONFIG,
  BACKTEST: BACKTEST_CONFIG,
  RISK: RISK_CONFIG,
  SCANNER: SCANNER_CONFIG,
  MEXC: MEXC_CONFIG,
  FIREBASE: FIREBASE_CONFIG
};

import ccxt from 'ccxt';
import { MEXC_CONFIG, SCANNER_CONFIG, RSI_CONFIG } from '../config/settings.js';

let exchangeInstance = null;

/**
 * Get or create MEXC exchange instance
 * @returns {ccxt.mexc} MEXC exchange instance
 */
export function getExchange() {
  if (!exchangeInstance) {
    exchangeInstance = new ccxt.mexc({
      apiKey: MEXC_CONFIG.apiKey,
      secret: MEXC_CONFIG.apiSecret,
      enableRateLimit: MEXC_CONFIG.enableRateLimit,
      options: MEXC_CONFIG.options
    });
  }
  return exchangeInstance;
}

/**
 * Reset exchange instance (useful for testing)
 */
export function resetExchange() {
  exchangeInstance = null;
}

/**
 * Fetch all available futures markets from MEXC
 * @returns {Promise<Array>} Array of market objects
 */
export async function fetchMarkets() {
  const exchange = getExchange();
  await exchange.loadMarkets();
  return exchange.markets;
}

/**
 * Get top coins by 24h volume
 * @param {number} limit - Number of top coins to return (default: 50)
 * @param {string} quoteCurrency - Quote currency filter (default: USDT)
 * @returns {Promise<Array<{symbol: string, volume: number, baseAsset: string}>>}
 */
export async function getTopCoinsByVolume(
  limit = SCANNER_CONFIG.topCoinsCount,
  quoteCurrency = SCANNER_CONFIG.quoteCurrency
) {
  const exchange = getExchange();

  // Fetch tickers for all markets
  const tickers = await exchange.fetchTickers();

  // Filter for USDT perpetual futures and sort by volume
  const filteredTickers = Object.entries(tickers)
    .filter(([symbol, ticker]) => {
      // Filter for USDT-margined perpetual futures
      return symbol.includes(`/${quoteCurrency}:${quoteCurrency}`) &&
             ticker.quoteVolume > 0;
    })
    .map(([symbol, ticker]) => ({
      symbol,
      volume: ticker.quoteVolume || 0,
      baseAsset: symbol.split('/')[0],
      last: ticker.last,
      change: ticker.percentage
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);

  return filteredTickers;
}

/**
 * Fetch OHLCV (candlestick) data for a symbol
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT:USDT')
 * @param {string} timeframe - Timeframe (default: '1d')
 * @param {number} limit - Number of candles to fetch
 * @returns {Promise<Array<{timestamp: number, open: number, high: number, low: number, close: number, volume: number}>>}
 */
export async function fetchOHLCV(
  symbol,
  timeframe = SCANNER_CONFIG.timeframe,
  limit = RSI_CONFIG.minHistoryDays + 50 // Extra buffer for RSI calculation
) {
  const exchange = getExchange();

  try {
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

    return ohlcv.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  } catch (error) {
    console.error(`Error fetching OHLCV for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Fetch OHLCV data for multiple symbols
 * @param {string[]} symbols - Array of trading symbols
 * @param {string} timeframe - Timeframe
 * @param {number} limit - Number of candles per symbol
 * @param {number} delayMs - Delay between requests to respect rate limits
 * @returns {Promise<Map<string, Array>>} Map of symbol to OHLCV data
 */
export async function fetchMultipleOHLCV(
  symbols,
  timeframe = SCANNER_CONFIG.timeframe,
  limit = RSI_CONFIG.minHistoryDays + 50,
  delayMs = 100
) {
  const results = new Map();

  for (const symbol of symbols) {
    const data = await fetchOHLCV(symbol, timeframe, limit);
    results.set(symbol, data);

    // Rate limiting delay
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Get current price for a symbol
 * @param {string} symbol - Trading pair symbol
 * @returns {Promise<{symbol: string, price: number, timestamp: number}>}
 */
export async function getCurrentPrice(symbol) {
  const exchange = getExchange();

  try {
    const ticker = await exchange.fetchTicker(symbol);
    return {
      symbol,
      price: ticker.last,
      timestamp: ticker.timestamp
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch account balance (requires API keys)
 * @returns {Promise<Object>} Balance object
 */
export async function fetchBalance() {
  const exchange = getExchange();

  if (!MEXC_CONFIG.apiKey || !MEXC_CONFIG.apiSecret) {
    throw new Error('API keys required for balance fetch');
  }

  return await exchange.fetchBalance();
}

/**
 * Sleep utility for rate limiting
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test exchange connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const exchange = getExchange();
    await exchange.loadMarkets();
    console.log('✓ Successfully connected to MEXC');
    return true;
  } catch (error) {
    console.error('✗ Failed to connect to MEXC:', error.message);
    return false;
  }
}

export default {
  getExchange,
  resetExchange,
  fetchMarkets,
  getTopCoinsByVolume,
  fetchOHLCV,
  fetchMultipleOHLCV,
  getCurrentPrice,
  fetchBalance,
  testConnection
};

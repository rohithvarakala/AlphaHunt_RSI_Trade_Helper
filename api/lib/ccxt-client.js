// MEXC Exchange Client using ccxt
// Public endpoints (tickers, OHLCV) work without API keys

let ccxt;

async function loadCcxt() {
  if (!ccxt) {
    ccxt = await import('ccxt');
  }
  return ccxt;
}

let exchangeInstance = null;

export async function getExchange() {
  const ccxtModule = await loadCcxt();

  if (!exchangeInstance) {
    // Only include credentials if they're actually set
    const config = {
      enableRateLimit: true,
      options: {
        defaultType: 'swap'
      }
    };

    // Only add API keys if they exist and are not empty
    if (process.env.MEXC_API_KEY && process.env.MEXC_API_SECRET) {
      config.apiKey = process.env.MEXC_API_KEY;
      config.secret = process.env.MEXC_API_SECRET;
    }

    exchangeInstance = new ccxtModule.default.mexc(config);
  }
  return exchangeInstance;
}

export async function getTopCoinsByVolume(limit = 50, quoteCurrency = 'USDT') {
  const exchange = await getExchange();

  // Fetch tickers without loading markets (which may require auth)
  const tickers = await exchange.fetchTickers();

  const filteredTickers = Object.entries(tickers)
    .filter(([symbol, ticker]) => {
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

export async function fetchOHLCV(symbol, timeframe = '1d', limit = 250) {
  const exchange = await getExchange();

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

export async function fetchMultipleOHLCV(symbols, timeframe = '1d', limit = 250) {
  const results = new Map();

  for (const symbol of symbols) {
    const data = await fetchOHLCV(symbol, timeframe, limit);
    results.set(symbol, data);
    // Small delay for rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

export async function testConnection() {
  try {
    const exchange = await getExchange();
    // Just fetch one ticker to test connection (doesn't require auth)
    await exchange.fetchTicker('BTC/USDT:USDT');
    return { success: true, message: 'Connected to MEXC' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

#!/usr/bin/env node

import 'dotenv/config';
import { SCANNER_CONFIG, RSI_CONFIG, RISK_CONFIG } from './config/settings.js';
import { getTopCoinsByVolume, fetchMultipleOHLCV, testConnection } from './data/fetcher.js';
import { validateOHLCV, generateQualityReport } from './data/validator.js';
import { getCurrentRSI, calculateRSIWithTimestamps } from './analysis/rsi.js';
import { scanForSignals, analyzeCurrentState, formatSignal } from './analysis/signals.js';
import { runBacktest, runMultiSymbolBacktest, formatBacktestResults } from './analysis/backtest.js';
import { initializeFirebase, logSignals, logScanHistory, logBacktestResults } from './storage/firebase.js';

/**
 * AlphaHunt RSI Trade Helper
 * Main Scanner & Backtesting Orchestrator
 */

const COMMANDS = {
  SCAN: '--scan',
  BACKTEST: '--backtest',
  TEST: '--test',
  HELP: '--help'
};

/**
 * Display help message
 */
function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          AlphaHunt RSI Trade Helper v1.0.0                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Commands:                                                    ║
║    --scan      Scan top 50 coins for RSI signals             ║
║    --backtest  Run backtest on historical data               ║
║    --test      Test connection to MEXC                       ║
║    --help      Show this help message                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Configuration:                                               ║
║    RSI Period: ${RSI_CONFIG.period.toString().padEnd(45)}║
║    Oversold Threshold: ${RSI_CONFIG.oversoldThreshold.toString().padEnd(37)}║
║    Overbought Threshold: ${RSI_CONFIG.overboughtThreshold.toString().padEnd(35)}║
║    Take Profit: ${RISK_CONFIG.takeProfitPercent}%${' '.repeat(43)}║
║    Stop Loss: ${RISK_CONFIG.stopLossPercent}%${' '.repeat(44)}║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

/**
 * Test connection to MEXC exchange
 */
async function runConnectionTest() {
  console.log('\n🔌 Testing connection to MEXC...\n');

  const success = await testConnection();

  if (success) {
    console.log('\n✓ Connection test passed!');
    console.log('  Ready to scan and trade.');
  } else {
    console.log('\n✗ Connection test failed.');
    console.log('  Check your internet connection and API settings.');
  }

  return success;
}

/**
 * Run the RSI scanner on top coins
 */
async function runScanner() {
  console.log('\n📡 Starting RSI Scanner...\n');
  console.log(`Configuration:`);
  console.log(`  - Scanning top ${SCANNER_CONFIG.topCoinsCount} coins by volume`);
  console.log(`  - Timeframe: ${SCANNER_CONFIG.timeframe}`);
  console.log(`  - RSI Period: ${RSI_CONFIG.period}`);
  console.log(`  - Oversold Threshold: < ${RSI_CONFIG.oversoldThreshold}`);
  console.log('');

  try {
    // Step 1: Get top coins by volume
    console.log('Step 1/4: Fetching top coins by 24h volume...');
    const topCoins = await getTopCoinsByVolume();
    console.log(`  Found ${topCoins.length} coins\n`);

    if (topCoins.length === 0) {
      console.log('✗ No coins found. Check your connection.');
      return;
    }

    // Display top 10 by volume
    console.log('Top 10 by Volume:');
    topCoins.slice(0, 10).forEach((coin, i) => {
      console.log(`  ${i + 1}. ${coin.baseAsset.padEnd(8)} Vol: $${(coin.volume / 1e6).toFixed(2)}M`);
    });
    console.log('');

    // Step 2: Fetch OHLCV data for all coins
    console.log('Step 2/4: Fetching historical data...');
    const symbols = topCoins.map(c => c.symbol);
    const ohlcvMap = await fetchMultipleOHLCV(symbols);
    console.log(`  Fetched data for ${ohlcvMap.size} symbols\n`);

    // Step 3: Validate data quality
    console.log('Step 3/4: Validating data quality...');
    const validatedMap = new Map();
    const validationResults = new Map();

    for (const [symbol, ohlcv] of ohlcvMap) {
      const validation = validateOHLCV(ohlcv, symbol);
      validationResults.set(symbol, validation);

      if (validation.valid && ohlcv.length >= RSI_CONFIG.minHistoryDays) {
        validatedMap.set(symbol, ohlcv);
      }
    }

    const qualityReport = generateQualityReport(validationResults);
    console.log(`  Valid symbols: ${qualityReport.validSymbols}/${qualityReport.totalSymbols}\n`);

    // Step 4: Scan for signals
    console.log('Step 4/4: Scanning for RSI signals...');
    const scanResults = scanForSignals(validatedMap);

    // Display results
    console.log('\n' + '═'.repeat(60));
    console.log('                    SCAN RESULTS');
    console.log('═'.repeat(60));
    console.log(`Scan Time: ${scanResults.date}`);
    console.log(`Symbols Scanned: ${validatedMap.size}`);
    console.log('');

    // New oversold signals (entry opportunities)
    if (scanResults.oversoldSignals.length > 0) {
      console.log('🟢 NEW OVERSOLD SIGNALS (Potential Entries):');
      scanResults.oversoldSignals.forEach(signal => {
        console.log(formatSignal({ ...signal, symbol: signal.symbol.split('/')[0] }));
      });
    } else {
      console.log('No new oversold signals detected.');
    }
    console.log('');

    // Currently oversold (watching)
    if (scanResults.currentlyOversold.length > 0) {
      console.log('👀 CURRENTLY OVERSOLD (Watching):');
      scanResults.currentlyOversold.slice(0, 10).forEach(coin => {
        console.log(`  ${coin.symbol.split('/')[0].padEnd(8)} RSI: ${coin.rsi.toFixed(2).padStart(5)} | $${coin.price.toFixed(4)}`);
      });
    }
    console.log('');

    // Currently overbought
    if (scanResults.currentlyOverbought.length > 0) {
      console.log('🔴 CURRENTLY OVERBOUGHT:');
      scanResults.currentlyOverbought.slice(0, 5).forEach(coin => {
        console.log(`  ${coin.symbol.split('/')[0].padEnd(8)} RSI: ${coin.rsi.toFixed(2).padStart(5)} | $${coin.price.toFixed(4)}`);
      });
    }

    console.log('\n' + '═'.repeat(60));

    // Log to Firebase if configured
    if (scanResults.oversoldSignals.length > 0) {
      initializeFirebase();
      await logSignals(scanResults.oversoldSignals);
      await logScanHistory({
        totalScanned: scanResults.totalScanned,
        oversoldCount: scanResults.oversoldSignals.length,
        overboughtCount: scanResults.overboughtSignals.length
      });
    }

    return scanResults;
  } catch (error) {
    console.error('✗ Scanner error:', error.message);
    throw error;
  }
}

/**
 * Run backtest on historical data
 */
async function runBacktestMode() {
  console.log('\n📊 Starting Backtest Mode...\n');
  console.log('Configuration:');
  console.log(`  - RSI Period: ${RSI_CONFIG.period}`);
  console.log(`  - Oversold Entry: RSI < ${RSI_CONFIG.oversoldThreshold}`);
  console.log(`  - Take Profit: +${RISK_CONFIG.takeProfitPercent}%`);
  console.log(`  - Stop Loss: -${RISK_CONFIG.stopLossPercent}%`);
  console.log('');

  try {
    // Get top coins
    console.log('Fetching top coins...');
    const topCoins = await getTopCoinsByVolume(20); // Backtest on top 20
    console.log(`Testing on ${topCoins.length} coins\n`);

    // Fetch OHLCV
    console.log('Fetching historical data (this may take a moment)...');
    const symbols = topCoins.map(c => c.symbol);
    const ohlcvMap = await fetchMultipleOHLCV(symbols, '1d', 365); // 1 year of data
    console.log(`Fetched data for ${ohlcvMap.size} symbols\n`);

    // Validate data
    const validatedMap = new Map();
    for (const [symbol, ohlcv] of ohlcvMap) {
      const validation = validateOHLCV(ohlcv, symbol);
      if (validation.valid && ohlcv.length >= 100) {
        validatedMap.set(symbol, ohlcv);
      }
    }
    console.log(`Valid symbols for backtest: ${validatedMap.size}\n`);

    // Run multi-symbol backtest
    console.log('Running backtest simulation...\n');
    const backtestResults = runMultiSymbolBacktest(validatedMap, {
      takeProfitPercent: RISK_CONFIG.takeProfitPercent,
      stopLossPercent: RISK_CONFIG.stopLossPercent,
      leverage: 1 // Base backtest without leverage
    });

    // Display aggregate results
    console.log('═'.repeat(60));
    console.log('              AGGREGATE BACKTEST RESULTS');
    console.log('═'.repeat(60));
    console.log(`Total Symbols Tested: ${backtestResults.totalSymbols}`);
    console.log(`Total Signals Found: ${backtestResults.aggregateStats.totalSignals}`);
    console.log(`Total Trades: ${backtestResults.aggregateStats.totalTrades}`);
    console.log(`Overall Win Rate: ${backtestResults.aggregateStats.winRate}%`);
    console.log(`Average Return: ${backtestResults.aggregateStats.avgReturn}%`);
    console.log('');

    // Show per-symbol breakdown
    console.log('Per-Symbol Breakdown (symbols with signals):');
    console.log('-'.repeat(60));

    for (const [symbol, result] of Object.entries(backtestResults.symbolResults)) {
      if (result.valid && result.totalSignals > 0) {
        const shortSymbol = symbol.split('/')[0].padEnd(8);
        const stats = result.stats.tradeStats;
        console.log(`${shortSymbol} | Signals: ${result.totalSignals.toString().padStart(3)} | Win Rate: ${stats.winRate.toString().padStart(5)}% | Avg: ${stats.avgReturn > 0 ? '+' : ''}${stats.avgReturn.toFixed(2)}%`);
      }
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log('Forward Returns Analysis (all symbols combined):');
    console.log('-'.repeat(60));

    // Calculate combined forward return stats
    const combinedForwardStats = {
      '1D': { wins: 0, total: 0, returns: [] },
      '1W': { wins: 0, total: 0, returns: [] },
      '2W': { wins: 0, total: 0, returns: [] },
      '1M': { wins: 0, total: 0, returns: [] }
    };

    for (const [symbol, result] of Object.entries(backtestResults.symbolResults)) {
      if (result.valid && result.stats?.forwardReturns) {
        for (const [horizon, data] of Object.entries(result.stats.forwardReturns)) {
          if (combinedForwardStats[horizon]) {
            combinedForwardStats[horizon].wins += data.wins;
            combinedForwardStats[horizon].total += data.totalSignals;
          }
        }
      }
    }

    for (const [horizon, data] of Object.entries(combinedForwardStats)) {
      const winRate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(2) : '0.00';
      console.log(`${horizon.padEnd(4)} | Win Rate: ${winRate.padStart(6)}% | Wins: ${data.wins}/${data.total}`);
    }

    console.log('═'.repeat(60));

    // Log to Firebase
    initializeFirebase();
    await logBacktestResults('AGGREGATE', backtestResults);

    return backtestResults;
  } catch (error) {
    console.error('✗ Backtest error:', error.message);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || COMMANDS.HELP;

  console.log('\n🔷 AlphaHunt RSI Trade Helper');
  console.log('─'.repeat(40));

  switch (command) {
    case COMMANDS.SCAN:
      await runScanner();
      break;

    case COMMANDS.BACKTEST:
      await runBacktestMode();
      break;

    case COMMANDS.TEST:
      await runConnectionTest();
      break;

    case COMMANDS.HELP:
    default:
      showHelp();
      break;
  }
}

// Run main function
main().catch(error => {
  console.error('\n✗ Fatal error:', error.message);
  process.exit(1);
});

export {
  runScanner,
  runBacktestMode,
  runConnectionTest
};

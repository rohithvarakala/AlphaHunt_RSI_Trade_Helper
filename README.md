# AlphaHunt RSI Trade Helper

A cryptocurrency RSI trading scanner and backtesting system for MEXC futures. Scans top 50 coins by volume for RSI oversold signals and provides historical backtest analysis.

## Features

- **RSI Scanner**: Real-time scanning of top 50 MEXC futures coins for RSI oversold conditions
- **Wilder's RSI**: Authentic 1978 Wilder's Smoothed RSI calculation (14-period)
- **Backtesting Engine**: Historical analysis with forward return calculations (1D, 1W, 2W, 1M)
- **Signal Detection**: Automatic detection of RSI crossover signals
- **Data Validation**: Quality checks for OHLCV data integrity
- **Firebase Integration**: Optional trade logging and performance tracking

## Trading Strategy

| Parameter | Value |
|-----------|-------|
| Entry Signal | RSI crosses below 30 (oversold) |
| Take Profit | +5% |
| Stop Loss | -10% |
| RSI Period | 14 (Wilder's method) |
| Target Market | MEXC USDT-M Futures |

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/AlphaHunt_RSI_Trade_Helper.git
cd AlphaHunt_RSI_Trade_Helper

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
```

## Configuration

Edit `.env` with your credentials:

```env
# MEXC API (required for scanning)
MEXC_API_KEY=your_api_key
MEXC_API_SECRET=your_api_secret

# Firebase (optional - for logging)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

## Usage

### Test Connection
```bash
npm run start -- --test
# or
node index.js --test
```

### Run RSI Scanner
Scan top 50 coins for oversold signals:
```bash
npm run scan
# or
node index.js --scan
```

### Run Backtest
Analyze historical performance:
```bash
npm run backtest
# or
node index.js --backtest
```

### Help
```bash
node index.js --help
```

## Project Structure

```
├── config/
│   └── settings.js      # Configuration (RSI, risk, API settings)
├── data/
│   ├── fetcher.js       # MEXC API integration via ccxt
│   └── validator.js     # Data quality validation
├── analysis/
│   ├── rsi.js           # Wilder's RSI calculation
│   ├── signals.js       # Signal detection (oversold/overbought)
│   └── backtest.js      # Backtesting engine
├── storage/
│   └── firebase.js      # Firestore integration
├── index.js             # Main orchestrator
├── package.json
├── .env.example
└── .gitignore
```

## Modules

### RSI Calculator (`analysis/rsi.js`)
- Wilder's Smoothed RSI (1978 methodology)
- First average uses SMA, subsequent use exponential smoothing
- Validates RSI values (flags anomalies outside 1-99 range)

### Signal Detector (`analysis/signals.js`)
- Detects RSI crossover events
- `OVERSOLD_ENTRY`: RSI crosses below 30
- `OVERBOUGHT_EXIT`: RSI crosses above 70
- Real-time market state analysis

### Backtesting Engine (`analysis/backtest.js`)
- Forward return calculation at multiple horizons
- Trade simulation with TP/SL
- Win rate and performance statistics
- Multi-symbol aggregate analysis

### Data Fetcher (`data/fetcher.js`)
- MEXC futures market integration via ccxt
- Top coins by 24h volume
- OHLCV historical data fetching
- Rate limiting support

## Example Output

```
🟢 NEW OVERSOLD SIGNALS (Potential Entries):
🟢 BTC      | BUY | RSI: 28.45 | Price: $42150.00

👀 CURRENTLY OVERSOLD (Watching):
  ETH      RSI: 29.12 | $2245.50
  SOL      RSI: 27.89 | $98.45
```

## Backtest Results

```
═══════════════════════════════════════════════════════════════
              AGGREGATE BACKTEST RESULTS
═══════════════════════════════════════════════════════════════
Total Symbols Tested: 20
Total Signals Found: 156
Total Trades: 156
Overall Win Rate: 58.33%
Average Return: 2.45%

Forward Returns Analysis:
1D   | Win Rate:  52.14% | Wins: 78/156
1W   | Win Rate:  56.78% | Wins: 84/148
2W   | Win Rate:  61.23% | Wins: 87/142
1M   | Win Rate:  64.52% | Wins: 80/124
═══════════════════════════════════════════════════════════════
```

## Phase 2 (Future)

- Paper trading mode
- Live trade execution
- Position management
- Performance dashboard
- Telegram/Discord notifications

## Disclaimer

This software is for educational purposes only. Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.

## License

MIT

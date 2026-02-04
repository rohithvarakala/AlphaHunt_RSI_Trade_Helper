# AlphaHunt RSI Trade Helper

A cloud-based cryptocurrency RSI trading scanner and backtesting system for MEXC futures. Features a React dashboard deployed on Vercel with serverless API functions.

## Features

- **Web Dashboard**: Real-time RSI scanner with interactive charts
- **RSI Scanner**: Scans top 50 MEXC futures coins for RSI oversold signals
- **Wilder's RSI**: Authentic 1978 Wilder's Smoothed RSI calculation (14-period)
- **Backtesting Engine**: Historical analysis with forward return calculations (1D, 1W, 2W, 1M)
- **Scheduled Scans**: Automatic scanning via Vercel cron jobs (every 4 hours)
- **Firebase Integration**: Signal logging and historical data storage

## Trading Strategy

| Parameter | Value |
|-----------|-------|
| Entry Signal | RSI crosses below 30 (oversold) |
| Take Profit | +5% |
| Stop Loss | -10% |
| RSI Period | 14 (Wilder's method) |
| Target Market | MEXC USDT-M Futures |

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Recharts, Framer Motion
- **Backend**: Vercel Serverless Functions
- **Database**: Firebase Firestore
- **Exchange API**: MEXC via ccxt
- **Hosting**: Vercel

## Project Structure

```
├── api/                    # Vercel Serverless Functions
│   ├── lib/
│   │   ├── ccxt-client.js  # MEXC API integration
│   │   ├── rsi.js          # Wilder's RSI calculation
│   │   └── backtest.js     # Backtesting engine
│   ├── scan.js             # RSI scanner endpoint
│   ├── backtest.js         # Backtest endpoint
│   ├── health.js           # Health check endpoint
│   └── cron/
│       └── scan.js         # Scheduled scan job
├── src/                    # React Frontend
│   ├── components/
│   │   ├── Layout.js
│   │   ├── StatCard.js
│   │   └── CoinTable.js
│   ├── pages/
│   │   ├── Dashboard.js
│   │   ├── Scanner.js
│   │   └── Backtest.js
│   ├── firebase.js
│   ├── App.js
│   └── index.js
├── public/
├── vercel.json
├── package.json
└── tailwind.config.js
```

## Deployment to Vercel

### 1. Fork/Clone Repository

```bash
git clone https://github.com/yourusername/AlphaHunt_RSI_Trade_Helper.git
cd AlphaHunt_RSI_Trade_Helper
```

### 2. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Go to Project Settings > Your Apps > Add Web App
5. Copy the configuration values

### 3. Get MEXC API Keys

1. Go to [MEXC OpenAPI](https://www.mexc.com/user/openapi)
2. Create a new API key (read-only is sufficient for scanning)
3. Copy the API Key and Secret

### 4. Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Import Project"
3. Select your GitHub repository
4. Add Environment Variables:

```
MEXC_API_KEY=your_mexc_api_key
MEXC_API_SECRET=your_mexc_secret
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
CRON_SECRET=generate_a_random_string
```

5. Click "Deploy"

### 5. Enable Cron Jobs (Pro Plan)

The scheduled scanner runs every 4 hours. To enable:

1. Upgrade to Vercel Pro (or use a workaround with external cron services)
2. Cron jobs are automatically configured via `vercel.json`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | GET | Scan top 50 coins for RSI signals |
| `/api/backtest` | GET | Run backtest on historical data |
| `/api/health` | GET | Health check and configuration |
| `/api/cron/scan` | GET | Scheduled scan (cron job) |

### Query Parameters

**`/api/scan`**
- `limit` (default: 50) - Number of coins to scan

**`/api/backtest`**
- `limit` (default: 20) - Number of coins to backtest
- `days` (default: 365) - Days of historical data

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm start
```

The app will be available at `http://localhost:3000`

## Dashboard Pages

### Dashboard (`/`)
- Overview of current scan results
- New oversold signals (entry opportunities)
- Currently oversold/overbought coins
- Quick stats

### Scanner (`/scanner`)
- Full coin list with RSI values
- Search and filter functionality
- Real-time RSI trend indicators

### Backtest (`/backtest`)
- Historical strategy performance
- Win rates by time horizon (1D, 1W, 2W, 1M)
- Per-symbol breakdown
- Interactive charts

## RSI Calculation

Uses Wilder's Smoothed RSI (1978 methodology):

1. **First Average**: Simple Moving Average (SMA) of gains/losses
2. **Subsequent Averages**: Wilder's Smoothing Method
   ```
   AvgGain = (PrevAvgGain × (period - 1) + CurrentGain) / period
   AvgLoss = (PrevAvgLoss × (period - 1) + CurrentLoss) / period
   ```
3. **RSI Formula**: `RSI = 100 - (100 / (1 + RS))` where `RS = AvgGain / AvgLoss`

## Future Enhancements

- [ ] Telegram/Discord notifications for new signals
- [ ] Paper trading mode
- [ ] Portfolio tracking
- [ ] Custom RSI thresholds
- [ ] Multiple timeframe analysis
- [ ] Position sizing calculator

## Disclaimer

This software is for educational purposes only. Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.

## License

MIT

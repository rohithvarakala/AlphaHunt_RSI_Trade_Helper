import admin from 'firebase-admin';
import { FIREBASE_CONFIG } from '../config/settings.js';

let db = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * @returns {boolean} True if initialization successful
 */
export function initializeFirebase() {
  if (isInitialized) {
    return true;
  }

  if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.clientEmail || !FIREBASE_CONFIG.privateKey) {
    console.warn('⚠ Firebase not configured - logging will be disabled');
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_CONFIG.projectId,
        clientEmail: FIREBASE_CONFIG.clientEmail,
        privateKey: FIREBASE_CONFIG.privateKey
      })
    });

    db = admin.firestore();
    isInitialized = true;
    console.log('✓ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('✗ Firebase initialization failed:', error.message);
    return false;
  }
}

/**
 * Get Firestore database instance
 * @returns {admin.firestore.Firestore|null}
 */
export function getDb() {
  return db;
}

/**
 * Check if Firebase is configured and ready
 * @returns {boolean}
 */
export function isFirebaseReady() {
  return isInitialized && db !== null;
}

// Collection names
const COLLECTIONS = {
  SIGNALS: 'signals',
  TRADES: 'trades',
  BACKTEST_RESULTS: 'backtest_results',
  SCAN_HISTORY: 'scan_history',
  PERFORMANCE: 'performance'
};

/**
 * Log a signal to Firestore
 * @param {Object} signal - Signal data
 * @returns {Promise<string|null>} Document ID or null if not configured
 */
export async function logSignal(signal) {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    const docRef = await db.collection(COLLECTIONS.SIGNALS).add({
      ...signal,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging signal:', error.message);
    return null;
  }
}

/**
 * Log multiple signals
 * @param {Array} signals - Array of signal objects
 * @returns {Promise<number>} Number of signals logged
 */
export async function logSignals(signals) {
  if (!isFirebaseReady() || signals.length === 0) {
    return 0;
  }

  const batch = db.batch();
  const collectionRef = db.collection(COLLECTIONS.SIGNALS);

  for (const signal of signals) {
    const docRef = collectionRef.doc();
    batch.set(docRef, {
      ...signal,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  try {
    await batch.commit();
    return signals.length;
  } catch (error) {
    console.error('Error logging signals batch:', error.message);
    return 0;
  }
}

/**
 * Log a trade to Firestore
 * @param {Object} trade - Trade data
 * @returns {Promise<string|null>} Document ID or null
 */
export async function logTrade(trade) {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    const docRef = await db.collection(COLLECTIONS.TRADES).add({
      ...trade,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging trade:', error.message);
    return null;
  }
}

/**
 * Update trade with exit information
 * @param {string} tradeId - Trade document ID
 * @param {Object} exitData - Exit data
 * @returns {Promise<boolean>}
 */
export async function updateTradeExit(tradeId, exitData) {
  if (!isFirebaseReady()) {
    return false;
  }

  try {
    await db.collection(COLLECTIONS.TRADES).doc(tradeId).update({
      ...exitData,
      exitedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating trade:', error.message);
    return false;
  }
}

/**
 * Log backtest results
 * @param {string} symbol - Trading symbol
 * @param {Object} results - Backtest results
 * @returns {Promise<string|null>}
 */
export async function logBacktestResults(symbol, results) {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    const docRef = await db.collection(COLLECTIONS.BACKTEST_RESULTS).add({
      symbol,
      results,
      runAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging backtest results:', error.message);
    return null;
  }
}

/**
 * Log scan history
 * @param {Object} scanResults - Scan results
 * @returns {Promise<string|null>}
 */
export async function logScanHistory(scanResults) {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    const docRef = await db.collection(COLLECTIONS.SCAN_HISTORY).add({
      ...scanResults,
      scannedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging scan history:', error.message);
    return null;
  }
}

/**
 * Get recent signals
 * @param {number} limit - Number of signals to retrieve
 * @param {string} signalType - Filter by signal type (optional)
 * @returns {Promise<Array>}
 */
export async function getRecentSignals(limit = 50, signalType = null) {
  if (!isFirebaseReady()) {
    return [];
  }

  try {
    let query = db.collection(COLLECTIONS.SIGNALS)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (signalType) {
      query = query.where('signal', '==', signalType);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching signals:', error.message);
    return [];
  }
}

/**
 * Get trade history
 * @param {number} limit - Number of trades to retrieve
 * @param {string} symbol - Filter by symbol (optional)
 * @returns {Promise<Array>}
 */
export async function getTradeHistory(limit = 50, symbol = null) {
  if (!isFirebaseReady()) {
    return [];
  }

  try {
    let query = db.collection(COLLECTIONS.TRADES)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (symbol) {
      query = query.where('symbol', '==', symbol);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching trades:', error.message);
    return [];
  }
}

/**
 * Calculate and store performance metrics
 * @returns {Promise<Object|null>}
 */
export async function calculatePerformance() {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    // Get all completed trades
    const tradesSnapshot = await db.collection(COLLECTIONS.TRADES)
      .where('exitReason', '!=', null)
      .get();

    const trades = tradesSnapshot.docs.map(doc => doc.data());

    if (trades.length === 0) {
      return { totalTrades: 0 };
    }

    // Calculate metrics
    const wins = trades.filter(t => t.returnPercent > 0).length;
    const totalReturn = trades.reduce((sum, t) => sum + (t.returnPercent || 0), 0);

    const performance = {
      totalTrades: trades.length,
      wins,
      losses: trades.length - wins,
      winRate: Math.round((wins / trades.length) * 100 * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      avgReturn: Math.round((totalReturn / trades.length) * 100) / 100,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Store performance snapshot
    await db.collection(COLLECTIONS.PERFORMANCE).add(performance);

    return performance;
  } catch (error) {
    console.error('Error calculating performance:', error.message);
    return null;
  }
}

/**
 * Get latest performance metrics
 * @returns {Promise<Object|null>}
 */
export async function getLatestPerformance() {
  if (!isFirebaseReady()) {
    return null;
  }

  try {
    const snapshot = await db.collection(COLLECTIONS.PERFORMANCE)
      .orderBy('calculatedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error fetching performance:', error.message);
    return null;
  }
}

export default {
  initializeFirebase,
  getDb,
  isFirebaseReady,
  logSignal,
  logSignals,
  logTrade,
  updateTradeExit,
  logBacktestResults,
  logScanHistory,
  getRecentSignals,
  getTradeHistory,
  calculatePerformance,
  getLatestPerformance
};

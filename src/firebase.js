import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase (only if config is present)
let app = null;
let db = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.warn('Firebase initialization failed:', error.message);
  }
}

// Collection names
const COLLECTIONS = {
  SIGNALS: 'signals',
  SCANS: 'scans',
  BACKTEST_RESULTS: 'backtest_results'
};

// Save a signal to Firestore
export async function saveSignal(signal) {
  if (!db) return null;

  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.SIGNALS), {
      ...signal,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving signal:', error);
    return null;
  }
}

// Save scan results
export async function saveScanResults(scanData) {
  if (!db) return null;

  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.SCANS), {
      ...scanData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving scan:', error);
    return null;
  }
}

// Get recent signals
export async function getRecentSignals(limitCount = 50) {
  if (!db) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.SIGNALS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching signals:', error);
    return [];
  }
}

// Get signals for a specific symbol
export async function getSignalsBySymbol(symbol, limitCount = 20) {
  if (!db) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.SIGNALS),
      where('symbol', '==', symbol),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching signals by symbol:', error);
    return [];
  }
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return db !== null;
}

export { db, app };

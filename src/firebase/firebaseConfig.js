import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key])
const isFirebaseConfigured = missingKeys.length === 0
const firebaseConfigError = isFirebaseConfigured
  ? ''
  : `Firebase config is missing: ${missingKeys.join(', ')}. Set VITE_FIREBASE_* variables in your .env file or GitHub Actions secrets.`

if (!isFirebaseConfigured) {
  console.warn(firebaseConfigError)
}

export const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null

export const auth = app ? getAuth(app) : null
export const db = app
  ? initializeFirestore(app, {
      // Helps in environments where WebChannel streams are blocked by browser/network policies.
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    })
  : null
export const functions = app
  ? getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
  : null

export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('Failed to set Firebase auth persistence:', error)
    })
  : Promise.resolve()

let analyticsPromise = null

export async function getFirebaseAnalytics() {
  if (typeof window === 'undefined' || !app) {
    return null
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const { getAnalytics, isSupported } = await import('firebase/analytics')

      if (!(await isSupported())) {
        return null
      }

      return getAnalytics(app)
    })()
  }

  return analyticsPromise
}

export { firebaseConfigError, isFirebaseConfigured, missingKeys }
export { firebaseConfig }

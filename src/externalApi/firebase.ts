import { initializeApp, type FirebaseApp } from 'firebase/app'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

export function isFirebaseConfigReady(config: typeof firebaseConfig) {
  return Object.values(config).every((value) => {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    return trimmed !== '' && trimmed !== 'undefined' && trimmed !== 'null'
  })
}

let firebaseApp: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigReady(firebaseConfig)) return null
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig)
  }
  return firebaseApp
}

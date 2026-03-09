import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, authPersistenceReady, db } from './firebaseConfig'

const USERS_COLLECTION = 'users'

function getCurrentHostname() {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return 'your deployed domain'
  }

  return window.location.hostname
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function cleanDisplayName(name) {
  return String(name || '').trim()
}

export async function ensureUserDocument(user, options = {}) {
  if (!user?.uid) {
    throw new Error('ensureUserDocument requires a valid authenticated user.')
  }

  const userRef = doc(db, USERS_COLLECTION, user.uid)
  const existingUser = await getDoc(userRef)

  const name = cleanDisplayName(options.displayName || user.displayName)
  const email = normalizeEmail(user.email)

  const payload = {
    userId: user.uid,
    name,
    displayName: name,
    email,
    photoURL: user.photoURL || null,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (!existingUser.exists()) {
    payload.createdAt = serverTimestamp()
    await setDoc(userRef, payload)
  } else {
    await setDoc(userRef, payload, { merge: true })
  }

  return payload
}

export async function signUpWithEmail({ email, password, fullName }) {
  await authPersistenceReady

  const normalizedEmail = normalizeEmail(email)
  const displayName = cleanDisplayName(fullName)

  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)

  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }

  await ensureUserDocument(credential.user, {
    isNewUser: true,
    displayName,
  })

  return credential.user
}

export async function loginWithEmail({ email, password }) {
  await authPersistenceReady

  const normalizedEmail = normalizeEmail(email)
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password)

  await ensureUserDocument(credential.user, { isNewUser: false })

  return credential.user
}

export async function handleGoogleLogin() {
  await authPersistenceReady

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  const credential = await signInWithPopup(auth, provider)
  await ensureUserDocument(credential.user, { isNewUser: false })

  return credential.user
}

export async function logoutUser() {
  await signOut(auth)
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return auth.currentUser
}

export function mapFirebaseAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again after some time.'
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please login instead.'
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.'
    case 'auth/popup-closed-by-user':
      return 'Google login popup was closed before sign-in completed.'
    case 'auth/popup-blocked':
      return 'Popup was blocked by browser. Please allow popups and try again.'
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Please try again.'
    case 'auth/unauthorized-domain':
      return `Google sign-in is blocked because "${getCurrentHostname()}" is not added in Firebase Authentication -> Settings -> Authorized domains. Add that hostname in Firebase Console and try again.`
    case 'auth/operation-not-allowed':
      return 'Google login is not enabled for this Firebase project.'
    default:
      return error?.message || 'Something went wrong. Please try again.'
  }
}

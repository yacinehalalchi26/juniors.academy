// Production backend: Firebase Auth + callable Cloud Functions (project cscatestorg).
import CONFIG from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const app = initializeApp(CONFIG.firebase);
const auth = getAuth(app);
auth.useDeviceLanguage();
const functions = getFunctions(app, CONFIG.region);

const ready = new Promise((resolve) => {
  const off = onAuthStateChanged(auth, () => { off(); resolve(); });
});

const siteUrl = (route = '') => new URL(CONFIG.basePath + route, location.origin).href;

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been suspended. Contact support@cscatest.org.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'You appear to be offline. Check your connection and try again.',
  'auth/invalid-phone-number': 'Enter a valid mobile number, including the country code.',
  'auth/missing-phone-number': 'Enter your mobile number.',
  'auth/invalid-verification-code': 'That code is incorrect. Check it and try again.',
  'auth/code-expired': 'This code has expired. Send a new one.',
  'auth/credential-already-in-use': 'This number is already linked to another account.',
  'auth/account-exists-with-different-credential': 'This number is already linked to another account.',
  'auth/provider-already-linked': 'A phone number is already verified on this account.',
  'auth/quota-exceeded': 'SMS limit reached. Try again later.',
  'auth/captcha-check-failed': 'The security check failed. Reload the page and try again.',
  'auth/operation-not-allowed': 'SMS verification is not available for this country yet. Contact support@cscatest.org.',
  'auth/requires-recent-login': 'Log in again to continue.',
};

/** Turns Firebase errors into { message, code, fields, data }. */
function normalize(e) {
  const out = new Error(e.message || 'Something went wrong. Try again.');
  if (e.code && e.code.startsWith('auth/')) {
    out.message = AUTH_MESSAGES[e.code] || 'Something went wrong. Try again.';
    out.code = e.code;
    if (e.code === 'auth/network-request-failed') out.offline = true;
    return out;
  }
  if (e.code && e.code.startsWith('functions/')) {
    out.status = e.code.replace('functions/', '');
    out.data = e.details || {};
    out.code = out.data.code || out.status;
    out.fields = out.data.fields || {};
    if (out.status === 'internal' && /fetch|network/i.test(e.message)) {
      out.offline = true;
      out.message = 'You appear to be offline. Check your connection and try again.';
    } else if (out.status === 'unavailable') {
      out.offline = true;
      out.message = 'You appear to be offline. Check your connection and try again.';
    }
  }
  return out;
}

const OWNER_HINT = 'admin';

const mapUser = (u) => (u ? {
  uid: u.uid,
  email: u.email || '',
  name: u.displayName || '',
  anonymous: u.isAnonymous,
  isAdmin: !u.isAnonymous && Boolean(u.email),
} : null);

export async function getUser() {
  await ready;
  return mapUser(auth.currentUser);
}

/**
 * Students don't have accounts. The browser signs in anonymously so the server can
 * own the answer key and the timers; the student never sees this.
 */
export async function ensureSession() {
  await ready;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      throw normalize(e);
    }
  }
  return mapUser(auth.currentUser);
}

export async function call(name, data = {}) {
  await ready;
  try {
    const res = await httpsCallable(functions, name, { timeout: 30000 })(data);
    return res.data;
  } catch (e) {
    throw normalize(e);
  }
}

/** Admin sign-in (the only password on the site). */
export async function adminLogin(email, password) {
  try {
    await signInWithEmailAndPassword(auth, String(email).trim(), password);
    return mapUser(auth.currentUser);
  } catch (e) {
    throw normalize(e);
  }
}

export async function adminResetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, String(email).trim(), { url: siteUrl('admin/') });
  } catch (e) {
    if (e.code !== 'auth/user-not-found' && e.code !== 'auth/invalid-email') throw normalize(e);
  }
}

export async function logout() {
  await signOut(auth);
}

export const isDemo = false;
export { OWNER_HINT };

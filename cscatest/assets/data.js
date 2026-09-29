// Talks to Firebase directly from the browser. No server, no build step.
// Project: cscatestorg. These keys are public by design; access is controlled by
// the security rules in firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc,
  query, where, orderBy, limit, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const CONFIG = {
  apiKey: 'AIzaSyDfAFG4Ezd6kJ6eIneR5kOiShEJ3gQvvWk',
  authDomain: 'cscatestorg.firebaseapp.com',
  projectId: 'cscatestorg',
  storageBucket: 'cscatestorg.firebasestorage.app',
  messagingSenderId: '429925243380',
  appId: '1:429925243380:web:151fc49942c70dd7dfc1a1',
};
export const ADMIN_EMAIL = 'director@juniors.academy';

const app = initializeApp(CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const ready = new Promise((resolve) => {
  const off = onAuthStateChanged(auth, () => { off(); resolve(); });
});

const MESSAGES = {
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'You appear to be offline. Check your connection.',
  'auth/operation-not-allowed': 'Anonymous sign-in is not enabled in the Firebase console yet.',
  'permission-denied': 'You do not have access to this.',
  'unavailable': 'You appear to be offline. Check your connection.',
};
const nice = (e) => new Error(MESSAGES[e?.code] || e?.message || 'Something went wrong. Try again.');

export async function currentUser() {
  await ready;
  const u = auth.currentUser;
  return u ? { uid: u.uid, email: u.email || '', anonymous: u.isAnonymous } : null;
}

/** Students get an anonymous session so their answers can be saved. */
export async function startSession() {
  await ready;
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (e) { throw nice(e); }
  }
  return currentUser();
}

export async function adminSignIn(email, password) {
  try {
    await signInWithEmailAndPassword(auth, String(email).trim(), password);
  } catch (e) { throw nice(e); }
  const u = await currentUser();
  if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) {
    await signOut(auth);
    throw new Error('That account does not have admin access.');
  }
  return u;
}

export async function adminReset(email) {
  try { await sendPasswordResetEmail(auth, String(email).trim()); } catch (e) { if (e.code !== 'auth/user-not-found') throw nice(e); }
}

export const signOutNow = () => signOut(auth);

// ------------------------------------------------------------------ attempts
export async function createAttempt(attempt) {
  try {
    const ref = await addDoc(collection(db, 'attempts'), { ...attempt, createdAtServer: serverTimestamp() });
    return ref.id;
  } catch (e) { throw nice(e); }
}

export async function loadAttempt(id) {
  try {
    const snap = await getDoc(doc(db, 'attempts', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { throw nice(e); }
}

export async function saveAttempt(id, patch) {
  try { await updateDoc(doc(db, 'attempts', id), patch); } catch (e) { throw nice(e); }
}

export async function myAttempts(uid) {
  const q = query(collection(db, 'attempts'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Admin: every attempt, newest first. */
export async function allAttempts(max = 300) {
  try {
    const snap = await getDocs(query(collection(db, 'attempts'), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { throw nice(e); }
}

export async function deleteAttempt(id) {
  try { await deleteDoc(doc(db, 'attempts', id)); } catch (e) { throw nice(e); }
}

/**
 * Queues the result email. Firebase's "Trigger Email from Firestore" extension
 * picks this up and sends it. If the extension isn't installed, the document
 * simply sits there and the on-screen result still works.
 */
export async function queueEmail(attemptId, to, message) {
  try {
    await setDoc(doc(db, 'mail', `result-${attemptId}`), {
      to, message, attemptId,
      createdAt: serverTimestamp(),
      expireAt: new Date(Date.now() + 30 * 24 * 3600e3),
    });
  } catch (e) {
    console.warn('Result email not queued:', e.message); // never block the student
  }
}

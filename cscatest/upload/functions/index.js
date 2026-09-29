// cscatest.org — Cloud Functions (Firebase project: cscatestorg)
//
// Every read and write of test data goes through these functions, so the
// answer key, timers and inactivity rule can't be tampered with from the browser.
// Firestore collections: users/{uid}, attempts/{id}, mail/{id}, ratelimits/{key}
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';

import * as E from './engine.js';
import { resultEmail } from './emails.js';
import { EMAIL_RE, isDisposable, domainReceivesMail, normalizePhone, clean } from './validate.js';

initializeApp();
const db = getFirestore();
const auth = getAuth();

const REGION = 'europe-west1';
setGlobalOptions({ region: REGION, maxInstances: 20 });

// Public URL of the site, ending with a slash. Change when moving to cscatest.org.
const SITE_URL = defineString('SITE_URL', { default: 'https://juniors.academy/cscatest/' });
// Owner admins (comma-separated emails). They can promote other admins from the admin page.
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' });
const TERMS_VERSION = '2026-09-29';

// Question banks live only on the server.
const raw = {};
for (const s of E.SUBJECT_ORDER) raw[s] = JSON.parse(fs.readFileSync(new URL(`./questions/${s}.json`, import.meta.url), 'utf8'));
const banks = E.prepareBanks(raw);
const rand = (n) => crypto.randomInt(n);

// ------------------------------------------------------------------ helpers
const callable = (handler, opts = {}) =>
  onCall({ cors: true, ...opts }, async (req) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e instanceof E.EngineError) throw new HttpsError(e.code, e.message, e.details);
      logger.error(e);
      throw new HttpsError('internal', 'Something went wrong on our side. Try again in a moment.');
    }
  });

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Log in to continue.', { code: 'unauthenticated' });
  return req.auth;
}

/** Fixed-window rate limit stored in Firestore (works across function instances). */
async function rateLimit(key, limit, windowMs) {
  const id = crypto.createHash('sha256').update(key).digest('hex').slice(0, 40);
  const ref = db.collection('ratelimits').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.resetAt < now) {
      tx.set(ref, { count: 1, resetAt: now + windowMs, expireAt: new Date(now + windowMs) });
      return;
    }
    if (d.count >= limit) throw new HttpsError('resource-exhausted', 'Too many attempts. Try again later.');
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}

function mailDoc(a) {
  const siteUrl = SITE_URL.value();
  const d = E.describe(a.type, a.subjects);
  return {
    to: a.email,
    message: resultEmail({
      name: (a.name || '').split(' ')[0] || 'there',
      typeName: d.typeName,
      modules: d.modules,
      results: a.results,
      url: `${siteUrl}results/?id=${a.id}`,
      siteUrl,
      submittedAt: a.submittedAt,
    }),
    attemptId: a.id,
    createdAt: FieldValue.serverTimestamp(),
    expireAt: new Date(Date.now() + 30 * 24 * 3600e3), // TTL policy deletes email records after 30 days
  };
}

/**
 * Loads an attempt in a transaction, applies `fn` to it, and saves it.
 * When the attempt becomes submitted, the result email is queued in the same
 * transaction (the document id makes it exactly-once).
 */
async function mutateAttempt(id, uid, fn) {
  const ref = db.collection('attempts').doc(String(id));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || (uid && snap.get('userId') !== uid)) throw new HttpsError('not-found', 'This test was not found.');
    const a = snap.data();
    const before = JSON.stringify([a.status, a.current, a.lastActivityAt, a.sections.map((s) => [s.answers, s.flags])]);
    const wasOpen = a.status === 'in_progress';
    fn(a);
    if (JSON.stringify([a.status, a.current, a.lastActivityAt, a.sections.map((s) => [s.answers, s.flags])]) !== before) tx.set(ref, a);
    if (wasOpen && a.status === 'submitted') tx.set(db.collection('mail').doc(`result-${a.id}`), mailDoc(a));
    if (wasOpen && a.status !== 'in_progress') {
      tx.set(db.collection('students').doc(a.userId), a.status === 'submitted'
        ? { testsSubmitted: FieldValue.increment(1), lastScore: a.results.score, lastTestAt: a.submittedAt }
        : { testsCancelled: FieldValue.increment(1), lastTestAt: a.cancelledAt }, { merge: true });
    }
    return a;
  });
}

const view = (a) => (a.status === 'in_progress' ? E.paperView(a, banks, Date.now()) : E.resultView(a, banks));

// ------------------------------------------------------------------ admin access
// Students never sign in; they use anonymous auth. The admin is a real Firebase
// email/password account whose address is listed in ADMIN_EMAILS (functions/.env).
const ownerEmails = () => ADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isOwner = (email) => Boolean(email) && ownerEmails().includes(email.toLowerCase());

function requireAdmin(req) {
  const a = requireAuth(req);
  if (!isOwner(a.token.email)) throw new HttpsError('permission-denied', 'You do not have access to the admin area.', { code: 'forbidden' });
  return a;
}

// ------------------------------------------------------------------ students
// There are no student accounts. A student types their details, the browser signs in
// anonymously, and those details are stored with the attempt so results can be emailed.
async function validateStudent(b) {
  const name = clean(b?.name, 80);
  const email = String(b?.email ?? '').trim().toLowerCase().slice(0, 254);
  const country = clean(b?.country, 60);
  const phone = b?.phone ? normalizePhone(b?.dialCode, b?.phone) : '';
  const domain = email.split('@')[1] || '';
  const fields = {};

  if (name.length < 2 || !name.includes(' ')) fields.name = 'Enter your first and last name.';
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  else if (isDisposable(domain)) fields.email = 'Temporary inboxes are not accepted. Use an email address you check regularly.';
  if (!country) fields.country = 'Select your country.';
  if (b?.phone && !phone) fields.phone = 'Enter a valid mobile number, or leave it empty.';
  if (b?.agree !== true) fields.agree = 'Confirm this to continue.';
  if (!fields.email && !(await domainReceivesMail(domain))) fields.email = `The domain “${domain}” can’t receive email. Check the spelling.`;
  if (Object.keys(fields).length) throw new HttpsError('invalid-argument', 'Check the highlighted fields.', { fields });
  return { name, email, country, phone };
}

// ------------------------------------------------------------------ tests
export const startAttempt = callable(async (req) => {
  const { uid } = requireAuth(req);
  const { type, subjects } = E.normalizeRequest(req.data?.type, req.data?.subjects);
  const student = await validateStudent(req.data?.student);
  await rateLimit(`start:${req.rawRequest.ip}`, 40, 3600e3);
  await rateLimit(`start:${uid}`, 30, 3600e3);

  // One test at a time in this browser session.
  const open = await db.collection('attempts').where('userId', '==', uid).where('status', '==', 'in_progress').get();
  for (const doc of open.docs) {
    const a = await mutateAttempt(doc.id, uid, (x) => E.tick(x, Date.now(), banks));
    if (a.status !== 'in_progress') continue;
    if (a.type === type && a.subjects.join() === subjects.join()) return view(a);
    const d = E.describe(a.type, a.subjects);
    throw new HttpsError('failed-precondition', `You already have a test in progress (${d.typeName}: ${d.modules}). Resume it or cancel it first.`, {
      code: 'active', attemptId: a.id, typeName: d.typeName, modules: d.modules,
    });
  }

  const ref = db.collection('attempts').doc();
  const now = Date.now();
  const studentRef = db.collection('students').doc(uid);
  const prior = await studentRef.get();
  const recent = prior.get('seen') || {}; // questions this browser has already been shown
  const a = E.createAttempt({
    id: ref.id, userId: uid, email: student.email, name: student.name,
    type, subjects, banks, now, rand, recent,
  });
  a.country = student.country;
  a.phone = student.phone;
  const batch = db.batch();
  batch.set(ref, a);
  batch.set(studentRef, {
    ...student,
    termsVersion: TERMS_VERSION,
    createdAt: prior.exists ? prior.get('createdAt') : FieldValue.serverTimestamp(),
    testsStarted: FieldValue.increment(1),
    lastTestAt: now,
    seen: E.updateHistory(recent, a),
  }, { merge: true });
  await batch.commit();
  return E.paperView(a, banks, now);
});

export const getAttempt = callable(async (req) => {
  const { uid } = requireAuth(req);
  return view(await mutateAttempt(req.data?.id, uid, (a) => E.tick(a, Date.now(), banks)));
});

/** Autosave + heartbeat. Called when answers change and every minute while the student is active. */
export const saveProgress = callable(async (req) => {
  const { uid } = requireAuth(req);
  const { id, section, answers, flags } = req.data || {};
  const a = await mutateAttempt(id, uid, (x) => E.saveProgress(x, { section, answers, flags }, Date.now(), banks));
  return { status: a.status, current: a.current, serverNow: Date.now() };
});

export const advanceSection = callable(async (req) => {
  const { uid } = requireAuth(req);
  const { id, section, answers, flags } = req.data || {};
  return view(await mutateAttempt(id, uid, (x) => E.advanceSection(x, { section, answers, flags }, Date.now(), banks)));
});

export const cancelAttempt = callable(async (req) => {
  const { uid } = requireAuth(req);
  const { id, reason } = req.data || {};
  return view(await mutateAttempt(id, uid, (x) => E.cancelAttempt(x, reason, Date.now(), banks)));
});

export const listAttempts = callable(async (req) => {
  const { uid } = requireAuth(req);
  const snap = await db.collection('attempts').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(50).get();
  const now = Date.now();
  const attempts = snap.docs.map((d) => {
    const a = d.data();
    E.tick(a, now, banks); // display only; the sweeper persists changes
    return E.summaryView(a);
  });
  return { attempts, serverNow: now };
});

// ------------------------------------------------------------------ background sweep
// Every minute: close sections whose time ran out, submit finished tests (which
// emails the result), and cancel tests with no activity for 10 minutes. This is
// what enforces the rules when a student simply closes the browser.
export const sweepAttempts = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Etc/UTC', retryCount: 0 }, async () => {
  const snap = await db.collection('attempts').where('status', '==', 'in_progress').get();
  const now = Date.now();
  let changed = 0;
  for (const doc of snap.docs) {
    const probe = doc.data();
    if (!E.tick(probe, now, banks)) continue; // nothing due yet; skip the transaction
    try {
      await mutateAttempt(doc.id, null, (a) => E.tick(a, Date.now(), banks));
      changed++;
    } catch (e) {
      logger.error(`sweep ${doc.id}`, e);
    }
  }
  if (changed) logger.info(`sweep updated ${changed} attempt(s)`);
});

// ------------------------------------------------------------------ admin
const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v ?? null);
const RECENT_SAMPLE = 500;

export const adminOverview = callable(async (req) => {
  requireAdmin(req);
  const attempts = db.collection('attempts');
  const students = db.collection('students');
  const count = async (q) => (await q.count().get()).data().count;
  const [studentCount, testCount, submittedCount, cancelledCount, inProgressCount, recent] = await Promise.all([
    count(students),
    count(attempts),
    count(attempts.where('status', '==', 'submitted')),
    count(attempts.where('status', '==', 'cancelled')),
    count(attempts.where('status', '==', 'in_progress')),
    attempts.orderBy('createdAt', 'desc').limit(RECENT_SAMPLE).get(),
  ]);
  return {
    totals: { students: studentCount, tests: testCount, submitted: submittedCount, cancelled: cancelledCount, inProgress: inProgressCount },
    ...E.overview(recent.docs.map((d) => d.data()), Date.now()),
  };
});

export const adminListAttempts = callable(async (req) => {
  requireAdmin(req);
  const { status, type, uid, cursor } = req.data || {};
  let q = db.collection('attempts');
  if (uid) q = q.where('userId', '==', String(uid));
  else {
    if (['in_progress', 'submitted', 'cancelled'].includes(status)) q = q.where('status', '==', status);
    if (E.TEST_TYPES[type]) q = q.where('type', '==', type);
  }
  q = q.orderBy('createdAt', 'desc');
  if (cursor) q = q.startAfter(Number(cursor));
  const snap = await q.limit(50).get();
  const now = Date.now();
  const rows = snap.docs.map((d) => {
    const a = d.data();
    E.tick(a, now, banks);
    return { ...E.summaryView(a), userId: a.userId, name: a.name, email: a.email };
  });
  return { rows, cursor: snap.size === 50 ? snap.docs.at(-1).get('createdAt') : null };
});

export const adminGetAttempt = callable(async (req) => {
  requireAdmin(req);
  const snap = await db.collection('attempts').doc(String(req.data?.id)).get();
  if (!snap.exists) throw new HttpsError('not-found', 'This test was not found.');
  const a = snap.data();
  E.tick(a, Date.now(), banks);
  return { ...E.resultView(a, banks), name: a.name, userId: a.userId, adminView: true };
});

export const adminCancelAttempt = callable(async (req) => {
  requireAdmin(req);
  const a = await mutateAttempt(req.data?.id, null, (x) => E.cancelAttempt(x, 'admin', Date.now(), banks));
  logger.info(`admin ${req.auth.token.email} cancelled attempt ${a.id}`);
  return E.summaryView(a);
});

export const adminListUsers = callable(async (req) => {
  requireAdmin(req);
  const { q: query, cursor } = req.data || {};
  const text = String(query ?? '').trim();
  let q = db.collection('students');
  if (text.includes('@')) q = q.where('email', '==', text.toLowerCase());
  else if (text) {
    const start = text.charAt(0).toUpperCase() + text.slice(1);
    q = q.where('name', '>=', start).where('name', '<', start + '\uf8ff').orderBy('name');
  } else {
    q = q.orderBy('createdAt', 'desc');
    if (cursor) q = q.startAfter(new Date(Number(cursor)));
  }
  const snap = await q.limit(50).get();
  const rows = snap.docs.map((d) => {
    const u = d.data();
    return {
      uid: d.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      country: u.country || '',
      createdAt: ms(u.createdAt),
      testsStarted: u.testsStarted || 0,
      testsSubmitted: u.testsSubmitted || 0,
      testsCancelled: u.testsCancelled || 0,
      lastScore: u.lastScore ?? null,
      lastTestAt: ms(u.lastTestAt),
    };
  });
  const last = snap.docs.at(-1);
  return { rows, cursor: !text && snap.size === 50 ? ms(last.get('createdAt')) : null };
});

export const adminDeleteUser = callable(async (req) => {
  requireAdmin(req);
  const uid = String(req.data?.uid || '');
  const writer = db.bulkWriter();
  writer.delete(db.collection('students').doc(uid));
  const attempts = await db.collection('attempts').where('userId', '==', uid).get();
  for (const doc of attempts.docs) writer.delete(doc.ref);
  await writer.close();
  await auth.deleteUser(uid).catch(() => {}); // the anonymous sign-in, if it still exists
  logger.info(`admin ${req.auth.token.email} deleted student ${uid} (${attempts.size} attempts)`);
  return { ok: true };
});

export const adminQuestionStats = callable(async (req) => {
  requireAdmin(req);
  const subject = req.data?.subject;
  if (!E.SUBJECTS[subject]) throw new HttpsError('invalid-argument', 'Choose a module.');
  const snap = await db.collection('attempts').where('status', '==', 'submitted').where('subjects', 'array-contains', subject)
    .orderBy('createdAt', 'desc').limit(RECENT_SAMPLE).get();
  return E.questionStats(snap.docs.map((d) => d.data()), banks, subject);
});

export const adminExport = callable(async (req) => {
  requireAdmin(req);
  const kind = req.data?.kind;
  if (kind === 'students') {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').limit(5000).get();
    return {
      columns: ['name', 'email', 'phone', 'country', 'firstSeen', 'testsStarted', 'testsSubmitted', 'testsCancelled', 'lastScore'],
      rows: snap.docs.map((d) => {
        const u = d.data();
        return [u.name, u.email, u.phone, u.country, ms(u.createdAt), u.testsStarted || 0, u.testsSubmitted || 0, u.testsCancelled || 0, u.lastScore ?? ''];
      }),
    };
  }
  if (kind === 'tests') {
    const snap = await db.collection('attempts').orderBy('createdAt', 'desc').limit(5000).get();
    return {
      columns: ['id', 'name', 'email', 'format', 'modules', 'status', 'cancelReason', 'started', 'finished', 'score', 'moduleScores'],
      rows: snap.docs.map((d) => {
        const a = d.data();
        const v = E.summaryView(a);
        return [a.id, a.name, a.email, v.typeName, v.modules, a.status, a.cancelReason || '', a.createdAt, a.submittedAt || a.cancelledAt || '', v.score ?? '', v.sectionScores.map((x) => `${x.name} ${x.score}`).join('; ')];
      }),
    };
  }
  throw new HttpsError('invalid-argument', 'Unknown export.');
});

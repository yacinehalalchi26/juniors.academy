// Demo backend for `npm run dev`: same interface as backend-firebase.js, but everything
// runs in this browser with localStorage. Uses the real test engine. Never deployed.
import CONFIG from './config.js';
import * as E from '../mock/engine.js';

const KEY = 'csca-demo';
const DEMO_ADMIN = { email: 'director@juniors.academy', password: 'demo1234' };
const load = () => JSON.parse(localStorage.getItem(KEY) || '{"students":{},"attempts":{},"session":null,"admin":false}');
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
// For testing the inactivity rule quickly: localStorage.setItem('csca-demo-idle-ms', '20000')
const opts = () => ({ inactivityMs: Number(localStorage.getItem('csca-demo-idle-ms')) || E.INACTIVITY_MS });

let banks;
async function getBanks() {
  if (banks) return banks;
  const raw = {};
  await Promise.all(E.SUBJECT_ORDER.map(async (s) => {
    raw[s] = await (await fetch(`${CONFIG.basePath}assets/mock/questions/${s}.json`)).json();
  }));
  return (banks = E.prepareBanks(raw));
}

const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const delay = () => new Promise((r) => setTimeout(r, 150));


const mapUser = (s) => (s.session ? { uid: s.session, email: s.admin ? DEMO_ADMIN.email : '', anonymous: !s.admin, isAdmin: s.admin } : null);

export async function getUser() { return mapUser(load()); }

export async function ensureSession() {
  const s = load();
  if (!s.session) { s.session = 'anon-' + Date.now().toString(36); s.admin = false; save(s); }
  return mapUser(s);
}

export async function adminLogin(email, password) {
  await delay();
  if (String(email).trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
    throw new Error(`Demo mode: sign in with ${DEMO_ADMIN.email} and the password ${DEMO_ADMIN.password}.`);
  }
  const s = load();
  s.session = 'admin';
  s.admin = true;
  save(s);
  return mapUser(s);
}

export async function adminResetPassword() { await delay(); }

export async function logout() {
  const s = load();
  s.session = null;
  s.admin = false;
  save(s);
}

function fail(message, status = 'failed-precondition', data = {}) {
  const e = new Error(message);
  Object.assign(e, { status, data, code: data.code || status, fields: data.fields || {} });
  throw e;
}

function requireSession(s) {
  if (!s.session) fail('Start a test first.', 'unauthenticated', { code: 'unauthenticated' });
  return s.session;
}
function requireAdmin(s) {
  if (!s.admin) fail('You do not have access to the admin area.', 'permission-denied', { code: 'forbidden' });
}

function normalizePhone(dialCode, number) {
  const raw = String(number ?? '').trim();
  if (!raw) return '';
  const e164 = raw.startsWith('+') ? '+' + raw.replace(/\D/g, '') : '+' + String(dialCode ?? '').replace(/\D/g, '') + raw.replace(/\D/g, '').replace(/^0+/, '');
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

function validateStudent(d) {
  const fields = {};
  const name = String(d?.name || '').trim();
  const email = String(d?.email || '').trim().toLowerCase();
  const phone = d?.phone ? normalizePhone(d?.dialCode, d?.phone) : '';
  if (name.split(' ').filter(Boolean).length < 2) fields.name = 'Enter your first and last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = 'Enter a valid email address.';
  if (!d?.country) fields.country = 'Select your country.';
  if (d?.phone && !phone) fields.phone = 'Enter a valid mobile number, or leave it empty.';
  if (d?.agree !== true) fields.agree = 'Confirm this to continue.';
  if (Object.keys(fields).length) fail('Check the highlighted fields.', 'invalid-argument', { fields });
  return { name, email, country: d.country, phone: phone || '' };
}

// ------------------------------------------------------------------ "Cloud Functions"
function attemptFor(s, id, uid) {
  const a = s.attempts[id];
  if (!a || (uid && a.userId !== uid)) fail('This test was not found.', 'not-found');
  return a;
}

const handlers = {
  async startAttempt(s, data, b) {
    const uid = requireSession(s);
    const student = validateStudent(data.student);
    const { type, subjects } = E.normalizeRequest(data.type, data.subjects);
    for (const a of Object.values(s.attempts)) {
      if (a.userId !== uid || a.status !== 'in_progress') continue;
      E.tick(a, Date.now(), b, opts());
      if (a.status !== 'in_progress') continue;
      if (a.type === type && a.subjects.join() === subjects.join()) return E.paperView(a, b, Date.now(), opts());
      const d = E.describe(a.type, a.subjects);
      fail(`You already have a test in progress (${d.typeName}: ${d.modules}). Resume it or cancel it first.`, 'failed-precondition', { code: 'active', attemptId: a.id, ...d });
    }
    const prior = s.students[uid] || {};
    const id = 'd' + Date.now().toString(36);
    const a = E.createAttempt({ id, userId: uid, email: student.email, name: student.name, type, subjects, banks: b, now: Date.now(), rand, recent: prior.seen || {} });
    a.country = student.country;
    a.phone = student.phone;
    s.students[uid] = {
      ...prior, ...student,
      createdAt: prior.createdAt || Date.now(),
      testsStarted: (prior.testsStarted || 0) + 1,
      lastTestAt: Date.now(),
      seen: E.updateHistory(prior.seen || {}, a),
    };
    s.attempts[id] = a;
    return E.paperView(a, b, Date.now(), opts());
  },

  async getAttempt(s, { id }, b) {
    const a = attemptFor(s, id, requireSession(s));
    E.tick(a, Date.now(), b, opts());
    return a.status === 'in_progress' ? E.paperView(a, b, Date.now(), opts()) : E.resultView(a, b);
  },

  async saveProgress(s, d, b) {
    const a = attemptFor(s, d.id, requireSession(s));
    E.saveProgress(a, d, Date.now(), b, opts());
    return { status: a.status, current: a.current, serverNow: Date.now() };
  },

  async advanceSection(s, d, b) {
    const a = attemptFor(s, d.id, requireSession(s));
    E.advanceSection(a, d, Date.now(), b, opts());
    if (a.status === 'submitted') {
      const st = s.students[a.userId] || {};
      s.students[a.userId] = { ...st, testsSubmitted: (st.testsSubmitted || 0) + 1, lastScore: a.results.score };
      console.info(`[demo] Result email would be sent to ${a.email}`);
    }
    return a.status === 'in_progress' ? E.paperView(a, b, Date.now(), opts()) : E.resultView(a, b);
  },

  async cancelAttempt(s, { id, reason }, b) {
    const a = attemptFor(s, id, requireSession(s));
    E.cancelAttempt(a, reason, Date.now(), b, opts());
    const st = s.students[a.userId] || {};
    s.students[a.userId] = { ...st, testsCancelled: (st.testsCancelled || 0) + 1 };
    return E.resultView(a, b);
  },

  async listAttempts(s, _d, b) {
    const uid = requireSession(s);
    const attempts = Object.values(s.attempts)
      .filter((a) => a.userId === uid)
      .sort((x, y) => y.createdAt - x.createdAt)
      .map((a) => { E.tick(a, Date.now(), b, opts()); return E.summaryView(a); });
    return { attempts, serverNow: Date.now() };
  },

  // ---------------------------------------------------------------- admin
  async adminOverview(s, _d, b) {
    requireAdmin(s);
    const all = Object.values(s.attempts);
    all.forEach((a) => E.tick(a, Date.now(), b, opts()));
    return {
      totals: {
        students: Object.keys(s.students).length, tests: all.length,
        submitted: all.filter((a) => a.status === 'submitted').length,
        cancelled: all.filter((a) => a.status === 'cancelled').length,
        inProgress: all.filter((a) => a.status === 'in_progress').length,
      },
      ...E.overview(all, Date.now()),
    };
  },
  async adminListAttempts(s, { status, type, uid }, b) {
    requireAdmin(s);
    const rows = Object.values(s.attempts)
      .filter((a) => (!uid || a.userId === uid) && (uid || ((!status || a.status === status) && (!type || a.type === type))))
      .sort((x, y) => y.createdAt - x.createdAt)
      .map((a) => { E.tick(a, Date.now(), b, opts()); return { ...E.summaryView(a), userId: a.userId, name: a.name, email: a.email }; });
    return { rows, cursor: null };
  },
  async adminGetAttempt(s, { id }, b) {
    requireAdmin(s);
    const a = attemptFor(s, id, null);
    E.tick(a, Date.now(), b, opts());
    return { ...E.resultView(a, b), name: a.name, userId: a.userId, adminView: true };
  },
  async adminCancelAttempt(s, { id }, b) {
    requireAdmin(s);
    const a = attemptFor(s, id, null);
    E.cancelAttempt(a, 'admin', Date.now(), b, opts());
    return E.summaryView(a);
  },
  async adminListUsers(s, { q }) {
    requireAdmin(s);
    const text = String(q || '').toLowerCase();
    const rows = Object.entries(s.students)
      .filter(([, u]) => !text || (u.email || '').includes(text) || (u.name || '').toLowerCase().includes(text))
      .map(([uid, u]) => ({ uid, ...u, seen: undefined }));
    return { rows, cursor: null };
  },
  async adminDeleteUser(s, { uid }) {
    requireAdmin(s);
    delete s.students[uid];
    for (const [id, a] of Object.entries(s.attempts)) if (a.userId === uid) delete s.attempts[id];
    return { ok: true };
  },
  async adminQuestionStats(s, { subject }, b) {
    requireAdmin(s);
    return E.questionStats(Object.values(s.attempts), b, subject);
  },
  async adminExport(s, { kind }) {
    requireAdmin(s);
    if (kind === 'students') return { columns: ['name', 'email', 'phone', 'country'], rows: Object.values(s.students).map((u) => [u.name, u.email, u.phone, u.country]) };
    return { columns: ['id', 'email', 'format', 'status', 'score'], rows: Object.values(s.attempts).map((a) => [a.id, a.email, a.type, a.status, a.results?.score ?? '']) };
  },
};

export async function call(name, data = {}) {
  await delay();
  const b = await getBanks();
  const s = load();
  try {
    const out = await handlers[name](s, data, b);
    save(s);
    return JSON.parse(JSON.stringify(out));
  } catch (e) {
    save(s);
    if (e instanceof E.EngineError) fail(e.message, e.code, e.details || {});
    throw e;
  }
}

export const isDemo = true;
export const demoAdmin = DEMO_ADMIN;

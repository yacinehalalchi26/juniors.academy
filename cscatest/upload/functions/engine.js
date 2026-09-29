// cscatest.org — test engine.
// Pure JavaScript with no dependencies, so the same rules run in Cloud Functions
// (production) and in the browser demo (`npm run dev`). All times are epoch ms.

export const SUBJECTS = {
  math: { key: 'math', name: 'Mathematics' },
  physics: { key: 'physics', name: 'Physics' },
  chemistry: { key: 'chemistry', name: 'Chemistry' },
};
export const SUBJECT_ORDER = ['math', 'physics', 'chemistry'];

export const TEST_TYPES = {
  quick: { key: 'quick', name: 'Quick test', questionsPerSection: 12, minutesPerSection: 15, minSubjects: 1, maxSubjects: 1 },
  module: { key: 'module', name: 'Module test', questionsPerSection: 48, minutesPerSection: 60, minSubjects: 1, maxSubjects: 1 },
  full: { key: 'full', name: 'Full exam', questionsPerSection: 48, minutesPerSection: 60, minSubjects: 2, maxSubjects: 3 },
};

export const INACTIVITY_MS = 10 * 60e3; // no activity for 10 minutes cancels the test
export const GRACE_MS = 30e3; // network slack after a section timer ends
export const HISTORY_PER_SUBJECT = 120; // question ids remembered per student and module, to avoid repeats

export class EngineError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code; // matches Firebase HttpsError codes
    this.details = details;
  }
}

// ------------------------------------------------------------------ banks
export function prepareBanks(raw) {
  const banks = {};
  for (const [subject, list] of Object.entries(raw)) {
    const byId = new Map();
    for (const q of list) {
      if (!q.id || !q.q || !q.t || !Array.isArray(q.o) || q.o.length < 2 || !(q.a >= 0 && q.a < q.o.length)) {
        throw new Error(`Invalid question in ${subject}: ${JSON.stringify(q).slice(0, 100)}`);
      }
      if (byId.has(q.id)) throw new Error(`Duplicate question id ${q.id} in ${subject}`);
      byId.set(q.id, q);
    }
    banks[subject] = { list, byId };
  }
  return banks;
}

const q = (banks, subject, id) => {
  const found = banks[subject]?.byId.get(id);
  if (!found) throw new Error(`Question ${id} missing from ${subject}`);
  return found;
};

// ------------------------------------------------------------------ requests
export function normalizeRequest(type, subjects) {
  const t = TEST_TYPES[type];
  if (!t) throw new EngineError('invalid-argument', 'Choose a test type.');
  const list = [...new Set(Array.isArray(subjects) ? subjects : [])].filter((s) => SUBJECTS[s]);
  if (list.length < t.minSubjects || list.length > t.maxSubjects) {
    throw new EngineError('invalid-argument', t.maxSubjects === 1 ? 'Choose one module.' : 'Choose two or three modules.');
  }
  list.sort((a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b));
  return { type, subjects: list };
}

export function describe(type, subjects) {
  const t = TEST_TYPES[type];
  const names = subjects.map((s) => SUBJECTS[s].name);
  const minutes = t.minutesPerSection * subjects.length;
  return {
    typeName: t.name,
    modules: names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0],
    questions: t.questionsPerSection * subjects.length,
    minutes,
  };
}

// ------------------------------------------------------------------ papers
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Paper blueprint: each topic's share of a module, following the CSCA syllabus.
 * Quotas are computed from these weights for any paper length (12 or 48).
 */
export const BLUEPRINT = {
  math: { 'Algebra': 8, 'Functions': 9, 'Exponents & logarithms': 9, 'Trigonometry': 11, 'Sequences': 8, 'Analytic geometry': 13, 'Vectors': 6, 'Complex numbers': 5, 'Probability & statistics': 10, 'Calculus': 8, 'Sets & logic': 6, 'Solid geometry': 7 },
  physics: { 'Mechanics': 24, 'Energy & momentum': 15, 'Circular motion & gravitation': 8, 'Oscillations & waves': 9, 'Optics': 7, 'Thermal physics': 8, 'Electricity': 14, 'Magnetism & induction': 8, 'Modern physics': 7 },
  chemistry: { 'Atomic structure': 12, 'Bonding & structure': 10, 'Moles & stoichiometry': 17, 'Acids & bases': 12, 'Redox & electrochemistry': 10, 'Rates & equilibrium': 12, 'Elements & compounds': 10, 'Organic chemistry': 12, 'Practical chemistry': 5 },
};

/** Integer quotas per topic that sum to `count` (largest-remainder method), capped by pool size. */
export function topicQuotas(weights, pools, count) {
  const topics = Object.keys(weights).filter((t) => pools[t]?.length);
  const totalW = topics.reduce((n, t) => n + weights[t], 0);
  const exact = Object.fromEntries(topics.map((t) => [t, (weights[t] / totalW) * count]));
  const quotas = Object.fromEntries(topics.map((t) => [t, Math.min(Math.floor(exact[t]), pools[t].length)]));
  let left = count - Object.values(quotas).reduce((n, q) => n + q, 0);
  // hand out the remainder by largest fractional part, then by whatever still has room
  const byRemainder = topics.slice().sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));
  for (let pass = 0; left > 0 && pass < 10; pass++) {
    for (const t of byRemainder) {
      if (left > 0 && quotas[t] < pools[t].length) { quotas[t]++; left--; }
    }
  }
  return quotas;
}

/**
 * Picks `count` questions: by topic quota from the blueprint, preferring questions
 * this student hasn't seen (then the ones seen longest ago), random within that.
 * `recent` is the student's history of question ids, oldest first.
 */
export function pickQuestions(list, count, rand, { subject, recent = [] } = {}) {
  const pools = {};
  for (const q of shuffle(list, rand)) (pools[q.t] ||= []).push(q);
  const weights = BLUEPRINT[subject] || Object.fromEntries(Object.keys(pools).map((t) => [t, 1]));
  for (const t of Object.keys(pools)) if (!(t in weights)) weights[t] = 1; // topics added to the bank later still appear
  const lastSeen = new Map(recent.map((id, i) => [id, i]));
  const rank = (q) => (lastSeen.has(q.id) ? lastSeen.get(q.id) + 1 : 0); // 0 = never seen, lower = seen longer ago
  const quotas = topicQuotas(weights, pools, Math.min(count, list.length));
  const picked = [];
  for (const [t, n] of Object.entries(quotas)) {
    picked.push(...pools[t].sort((a, b) => rank(a) - rank(b)).slice(0, n));
  }
  return shuffle(picked, rand);
}

export function createAttempt({ id, userId, email, name, type, subjects, banks, now, rand, recent = {} }) {
  const t = TEST_TYPES[type];
  const durationMs = t.minutesPerSection * 60e3;
  const sections = subjects.map((subject) => ({
    subject,
    items: pickQuestions(banks[subject].list, t.questionsPerSection, rand, { subject, recent: recent[subject] || [] })
      .map((item) => ({ id: item.id, perm: shuffle(item.o.map((_, i) => i), rand) })),
    answers: {},
    flags: [],
    durationMs,
    startedAt: null,
    endsAt: null,
    closedAt: null,
  }));
  sections[0].startedAt = now;
  sections[0].endsAt = now + durationMs;
  return {
    id, userId, email, name, type, subjects,
    status: 'in_progress', // in_progress | submitted | cancelled
    current: 0,
    sections,
    createdAt: now,
    lastActivityAt: now,
    submittedAt: null,
    cancelledAt: null,
    cancelReason: null,
    results: null,
  };
}

// ------------------------------------------------------------------ state changes
function startSection(a, index, at) {
  const s = a.sections[index];
  a.current = index;
  s.startedAt = at;
  s.endsAt = at + s.durationMs;
}

function closeSection(a, at, banks) {
  a.sections[a.current].closedAt = at;
  if (a.current === a.sections.length - 1) {
    a.status = 'submitted';
    a.submittedAt = at;
    a.results = grade(a, banks);
  } else {
    startSection(a, a.current + 1, at);
  }
}

/**
 * Applies everything that should have happened by `now`: sections that ran out
 * of time are closed (the next one starts, or the test is submitted), and a test
 * with no activity for 10 minutes is cancelled. Returns true if anything changed.
 */
export function tick(a, now, banks, { inactivityMs = INACTIVITY_MS } = {}) {
  if (a.status !== 'in_progress') return false;
  let changed = false;
  for (;;) {
    const s = a.sections[a.current];
    const idleAt = a.lastActivityAt + inactivityMs;
    if (now >= s.endsAt + GRACE_MS && s.endsAt <= idleAt) {
      closeSection(a, s.endsAt, banks);
      changed = true;
      if (a.status !== 'in_progress') break;
      continue;
    }
    if (now >= idleAt) {
      a.status = 'cancelled';
      a.cancelledAt = idleAt;
      a.cancelReason = 'inactivity';
      changed = true;
    }
    break;
  }
  return changed;
}

function sanitizeAnswers(input, count, optionCount = 8) {
  const out = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n < count && Number.isInteger(v) && v >= 0 && v < optionCount) out[String(n)] = v;
    }
  }
  return out;
}
function sanitizeFlags(input, count) {
  return Array.isArray(input) ? [...new Set(input.filter((n) => Number.isInteger(n) && n >= 0 && n < count))] : [];
}

function applyAnswers(a, { answers, flags }, now) {
  const s = a.sections[a.current];
  if (now > s.endsAt + GRACE_MS) return;
  if (answers !== undefined) s.answers = sanitizeAnswers(answers, s.items.length);
  if (flags !== undefined) s.flags = sanitizeFlags(flags, s.items.length);
}

/** Saves answers for the current section and records activity (also used as a heartbeat). */
export function saveProgress(a, input, now, banks, opts) {
  tick(a, now, banks, opts);
  if (a.status !== 'in_progress') return;
  a.lastActivityAt = now;
  if (input.section === a.current) applyAnswers(a, input, now);
}

/** Finishes the current section early: starts the next one, or submits the test. */
export function advanceSection(a, input, now, banks, opts) {
  tick(a, now, banks, opts);
  if (a.status !== 'in_progress' || input.section !== a.current) return; // already moved on
  applyAnswers(a, input, now);
  a.lastActivityAt = now;
  closeSection(a, Math.min(now, a.sections[a.current].endsAt), banks);
}

export function cancelAttempt(a, reason, now, banks, opts) {
  tick(a, now, banks, opts);
  if (a.status !== 'in_progress') return;
  a.status = 'cancelled';
  a.cancelledAt = now;
  a.cancelReason = ['inactivity', 'admin'].includes(reason) ? reason : 'user';
}

// ------------------------------------------------------------------ grading
export function bandFor(score) {
  if (score >= 85) return { label: 'Excellent', note: 'You are well prepared. Keep your speed sharp with timed practice.' };
  if (score >= 70) return { label: 'Strong', note: 'A solid result. Review the topics where you dropped marks.' };
  if (score >= 55) return { label: 'Developing', note: 'You have the foundations. Focus on your weakest topics first.' };
  return { label: 'Needs more practice', note: 'Rebuild the core concepts topic by topic, then try again.' };
}

function gradeSection(s, banks) {
  let correct = 0;
  const topics = new Map();
  s.items.forEach((it, n) => {
    const item = q(banks, s.subject, it.id);
    const chosen = s.answers[String(n)];
    const ok = chosen !== undefined && it.perm[chosen] === item.a;
    if (ok) correct++;
    const t = topics.get(item.t) || { topic: item.t, correct: 0, total: 0 };
    t.total++;
    if (ok) t.correct++;
    topics.set(item.t, t);
  });
  const total = s.items.length;
  return {
    subject: s.subject,
    name: SUBJECTS[s.subject].name,
    score: Math.round((correct / total) * 100),
    correct,
    total,
    answered: Object.keys(s.answers).length,
    durationSec: s.closedAt && s.startedAt ? Math.round((s.closedAt - s.startedAt) / 1000) : 0,
    breakdown: [...topics.values()].sort((x, y) => x.correct / x.total - y.correct / y.total),
  };
}

export function grade(a, banks) {
  const sections = a.sections.map((s) => gradeSection(s, banks));
  const correct = sections.reduce((n, s) => n + s.correct, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  const score = Math.round(sections.reduce((n, s) => n + s.score, 0) / sections.length);
  return { score, correct, total, sections };
}

// ------------------------------------------------------------------ views sent to the browser
const meta = (a) => ({
  id: a.id,
  status: a.status,
  type: a.type,
  subjects: a.subjects,
  ...describe(a.type, a.subjects),
  createdAt: a.createdAt,
  submittedAt: a.submittedAt,
  cancelledAt: a.cancelledAt,
  cancelReason: a.cancelReason,
});

/** The live paper for the current section. Never includes correct answers. */
export function paperView(a, banks, now, { inactivityMs = INACTIVITY_MS } = {}) {
  const s = a.sections[a.current];
  return {
    ...meta(a),
    current: a.current,
    sections: a.sections.map((x, i) => ({
      subject: x.subject,
      name: SUBJECTS[x.subject].name,
      questions: x.items.length,
      minutes: x.durationMs / 60e3,
      state: i < a.current ? 'done' : i === a.current ? 'current' : 'upcoming',
    })),
    section: {
      index: a.current,
      subject: s.subject,
      name: SUBJECTS[s.subject].name,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      answers: s.answers,
      flags: s.flags,
      questions: s.items.map((it, n) => {
        const item = q(banks, s.subject, it.id);
        return { n, text: item.q, options: it.perm.map((k) => item.o[k]) };
      }),
    },
    serverNow: now,
    lastActivityAt: a.lastActivityAt,
    inactivityMs,
  };
}

/** Results after submission (with answer review), or a cancellation notice. */
export function resultView(a, banks, { showReview = true } = {}) {
  const base = { ...meta(a), email: a.email };
  if (a.status !== 'submitted') return base;
  const r = a.results;
  return {
    ...base,
    score: r.score,
    correct: r.correct,
    total: r.total,
    band: bandFor(r.score),
    sections: r.sections.map((s, i) => ({
      ...s,
      band: bandFor(s.score),
      review: showReview
        ? a.sections[i].items.map((it, n) => {
          const item = q(banks, a.sections[i].subject, it.id);
          const chosen = a.sections[i].answers[String(n)];
          return {
            n,
            topic: item.t,
            text: item.q,
            options: it.perm.map((k) => item.o[k]),
            chosen: chosen === undefined ? null : chosen,
            correctIndex: it.perm.indexOf(item.a),
          };
        })
        : null,
    })),
  };
}

/** One row for the dashboard history. */
export function summaryView(a) {
  return {
    ...meta(a),
    current: a.current,
    sectionCount: a.sections.length,
    endsAt: a.status === 'in_progress' ? a.sections[a.current].endsAt : null,
    score: a.results ? a.results.score : null,
    sectionScores: a.results ? a.results.sections.map((s) => ({ name: s.name, score: s.score })) : [],
  };
}

// ------------------------------------------------------------------ admin statistics
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Aggregate statistics over a set of attempts (the most recent ones). */
export function overview(attempts, now = Date.now(), days = 14) {
  const byType = Object.fromEntries(Object.values(TEST_TYPES).map((t) => [t.key, { key: t.key, name: t.name, started: 0, submitted: 0, cancelled: 0, inProgress: 0, scoreSum: 0 }]));
  const bySubject = Object.fromEntries(SUBJECT_ORDER.map((s) => [s, { key: s, name: SUBJECTS[s].name, completed: 0, scoreSum: 0 }]));
  const bands = { Excellent: 0, Strong: 0, Developing: 0, 'Needs more practice': 0 };
  const reasons = { inactivity: 0, user: 0, admin: 0 };
  const daily = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(now - i * 86400e3);
    daily.set(k, { date: k, started: 0, submitted: 0, cancelled: 0 });
  }
  for (const a of attempts) {
    const t = byType[a.type];
    if (!t) continue;
    t.started++;
    daily.get(dayKey(a.createdAt)) && daily.get(dayKey(a.createdAt)).started++;
    if (a.status === 'in_progress') t.inProgress++;
    if (a.status === 'cancelled') {
      t.cancelled++;
      reasons[a.cancelReason] = (reasons[a.cancelReason] || 0) + 1;
      if (a.cancelledAt && daily.get(dayKey(a.cancelledAt))) daily.get(dayKey(a.cancelledAt)).cancelled++;
    }
    if (a.status === 'submitted' && a.results) {
      t.submitted++;
      t.scoreSum += a.results.score;
      bands[bandFor(a.results.score).label]++;
      if (daily.get(dayKey(a.submittedAt))) daily.get(dayKey(a.submittedAt)).submitted++;
      for (const s of a.results.sections) {
        bySubject[s.subject].completed++;
        bySubject[s.subject].scoreSum += s.score;
      }
    }
  }
  const avg = (sum, n) => (n ? Math.round(sum / n) : null);
  return {
    sample: attempts.length,
    byType: Object.values(byType).map(({ scoreSum, ...t }) => ({ ...t, avgScore: avg(scoreSum, t.submitted) })),
    bySubject: Object.values(bySubject).map(({ scoreSum, ...s }) => ({ ...s, avgScore: avg(scoreSum, s.completed) })),
    bands: Object.entries(bands).map(([label, count]) => ({ label, count })),
    reasons,
    daily: [...daily.values()],
  };
}

/** How each question in a module performs across completed attempts. */
export function questionStats(attempts, banks, subject) {
  const bank = banks[subject];
  if (!bank) throw new EngineError('invalid-argument', 'Unknown module.');
  const stats = new Map(bank.list.map((item, i) => [item.id, { id: item.id, n: i + 1, topic: item.t, text: item.q, seen: 0, answered: 0, correct: 0 }]));
  let tests = 0;
  for (const a of attempts) {
    if (a.status !== 'submitted') continue;
    for (const sec of a.sections) {
      if (sec.subject !== subject) continue;
      tests++;
      sec.items.forEach((it, n) => {
        const st = stats.get(it.id);
        if (!st) return;
        st.seen++;
        const chosen = sec.answers[String(n)];
        if (chosen === undefined) return;
        st.answered++;
        if (it.perm[chosen] === bank.byId.get(it.id).a) st.correct++;
      });
    }
  }
  const rows = [...stats.values()].map((s) => ({ ...s, pct: s.seen ? Math.round((s.correct / s.seen) * 100) : null }));
  rows.sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101));
  return { subject, name: SUBJECTS[subject].name, tests, questions: rows };
}

/** Updates a student's per-module history with the questions in a new attempt (oldest first, capped). */
export function updateHistory(recent, attempt) {
  const out = { ...recent };
  for (const sec of attempt.sections) {
    const ids = sec.items.map((it) => it.id);
    const kept = (out[sec.subject] || []).filter((id) => !ids.includes(id));
    out[sec.subject] = [...kept, ...ids].slice(-HISTORY_PER_SUBJECT);
  }
  return out;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as E from '../functions/engine.js';

const raw = {};
for (const s of E.SUBJECT_ORDER) raw[s] = JSON.parse(fs.readFileSync(new URL(`../functions/questions/${s}.json`, import.meta.url)));
const banks = E.prepareBanks(raw);
const rand = (n) => crypto.randomInt(n);
const T0 = 1_800_000_000_000;
const MIN = 60e3;

const make = (type, subjects, now = T0) =>
  E.createAttempt({ id: 'a1', userId: 'u1', email: 'x@y.z', name: 'X', type, subjects, banks, now, rand });

/** Simulates an active student: a heartbeat every 4 minutes between two times. */
function activeUntil(a, from, to) {
  for (let t = from; t <= to; t += 4 * MIN) E.saveProgress(a, { section: a.current }, t, banks);
  E.saveProgress(a, { section: a.current }, to, banks);
}

/** Answers every question in the current section correctly (or wrongly). */
function answerAll(a, correct = true) {
  const s = a.sections[a.current];
  const answers = {};
  s.items.forEach((it, n) => {
    const right = it.perm.indexOf(banks[s.subject].byId.get(it.id).a);
    answers[n] = correct ? right : (right + 1) % it.perm.length;
  });
  return answers;
}

test('request validation', () => {
  assert.deepEqual(E.normalizeRequest('full', ['chemistry', 'math']), { type: 'full', subjects: ['math', 'chemistry'] });
  assert.throws(() => E.normalizeRequest('full', ['math']), /two or three/);
  assert.throws(() => E.normalizeRequest('quick', ['math', 'physics']), /one module/);
  assert.throws(() => E.normalizeRequest('nope', ['math']), /test type/);
  assert.equal(E.describe('full', ['math', 'physics', 'chemistry']).minutes, 180);
  assert.equal(E.describe('full', ['math', 'physics']).modules, 'Mathematics and Physics');
});

test('quick test: 12 questions, 15 minutes, spread across topics, no duplicates', () => {
  const a = make('quick', ['math']);
  const s = a.sections[0];
  assert.equal(s.items.length, 12);
  assert.equal(s.endsAt - s.startedAt, 15 * MIN);
  assert.equal(new Set(s.items.map((i) => i.id)).size, 12);
  const topics = new Set(s.items.map((i) => banks.math.byId.get(i.id).t));
  assert.ok(topics.size >= 10, `only ${topics.size} topics covered`);
});

test('module test: all 48 questions in 60 minutes', () => {
  const a = make('module', ['physics']);
  assert.equal(a.sections.length, 1);
  assert.equal(a.sections[0].items.length, 48);
  assert.equal(a.sections[0].endsAt - T0, 60 * MIN);
});

test('paper view never contains the answer key', () => {
  const a = make('module', ['chemistry']);
  const view = E.paperView(a, banks, T0);
  const json = JSON.stringify(view);
  assert.ok(!json.includes('"a":'));
  assert.ok(!json.includes('correctIndex'));
  assert.equal(view.section.questions.length, 48);
});

test('full exam: sections run in order and grading covers all modules', () => {
  const a = make('full', ['math', 'physics', 'chemistry']);
  assert.equal(a.sections.length, 3);
  E.saveProgress(a, { section: 0, answers: answerAll(a) }, T0 + 9 * MIN, banks);
  activeUntil(a, T0 + 9 * MIN, T0 + 19 * MIN);
  E.advanceSection(a, { section: 0 }, T0 + 20 * MIN, banks);
  assert.equal(a.current, 1);
  assert.equal(a.sections[1].startedAt, T0 + 20 * MIN);
  assert.equal(a.sections[1].endsAt, T0 + 80 * MIN);
  // a stale advance for section 0 does nothing
  E.advanceSection(a, { section: 0 }, T0 + 21 * MIN, banks);
  assert.equal(a.current, 1);
  activeUntil(a, T0 + 21 * MIN, T0 + 29 * MIN);
  E.advanceSection(a, { section: 1, answers: answerAll(a, false) }, T0 + 30 * MIN, banks);
  E.advanceSection(a, { section: 2, answers: {} }, T0 + 35 * MIN, banks);
  assert.equal(a.status, 'submitted');
  const r = a.results;
  assert.deepEqual(r.sections.map((s) => s.score), [100, 0, 0]);
  assert.equal(r.score, 33);
  assert.equal(r.total, 144);
  const view = E.resultView(a, banks);
  assert.equal(view.sections[0].review.length, 48);
});

test('section timer running out moves to the next section while the student is active', () => {
  const a = make('full', ['math', 'physics']);
  // active until minute 55, section 1 ends at 60, server checks at 60:40
  activeUntil(a, T0, T0 + 55 * MIN);
  E.tick(a, T0 + 60 * MIN + 40e3, banks);
  assert.equal(a.status, 'in_progress');
  assert.equal(a.current, 1);
  assert.equal(a.sections[1].startedAt, T0 + 60 * MIN);
});

test('a test left alone mid-way is cancelled even while its timer is running', () => {
  const a = make('full', ['math', 'physics']);
  activeUntil(a, T0, T0 + 30 * MIN);
  E.tick(a, T0 + 45 * MIN, banks);
  assert.equal(a.status, 'cancelled');
  assert.equal(a.cancelledAt, T0 + 40 * MIN);
});

test('10 minutes without activity cancels the test', () => {
  const a = make('module', ['math']);
  E.saveProgress(a, { section: 0, answers: { 0: 1 } }, T0 + 5 * MIN, banks);
  E.tick(a, T0 + 14 * MIN, banks);
  assert.equal(a.status, 'in_progress');
  E.tick(a, T0 + 15 * MIN, banks);
  assert.equal(a.status, 'cancelled');
  assert.equal(a.cancelReason, 'inactivity');
  assert.equal(a.cancelledAt, T0 + 15 * MIN);
  // no further changes once cancelled
  E.saveProgress(a, { section: 0, answers: { 0: 2 } }, T0 + 16 * MIN, banks);
  assert.equal(a.status, 'cancelled');
  assert.equal(a.results, null);
});

test('time running out before the inactivity limit submits instead of cancelling', () => {
  const a = make('quick', ['physics']); // 15 minutes
  activeUntil(a, T0, T0 + 11 * MIN);
  E.saveProgress(a, { section: 0, answers: answerAll(a) }, T0 + 12 * MIN, banks);
  E.tick(a, T0 + 30 * MIN, banks); // idle limit would be minute 22, but time ended at 15
  assert.equal(a.status, 'submitted');
  assert.equal(a.submittedAt, T0 + 15 * MIN);
  assert.equal(a.results.score, 100);
});

test('answers sent after time is up are ignored', () => {
  const a = make('quick', ['math']);
  activeUntil(a, T0, T0 + 13 * MIN);
  E.saveProgress(a, { section: 0, answers: { 0: 1 } }, T0 + 14 * MIN, banks);
  E.advanceSection(a, { section: 0, answers: { 0: 1, 1: 2, 2: 3 } }, T0 + 15 * MIN + 20e3, banks);
  assert.equal(Object.keys(a.sections[0].answers).length, 3); // within grace
  const b = make('quick', ['math']);
  activeUntil(b, T0, T0 + 13 * MIN);
  E.saveProgress(b, { section: 0, answers: { 0: 1 } }, T0 + 14 * MIN, banks);
  E.tick(b, T0 + 16 * MIN, banks);
  assert.equal(b.status, 'submitted');
  assert.equal(b.results.sections[0].answered, 1);
});

test('student can cancel; invalid answers are dropped', () => {
  const a = make('module', ['math']);
  E.saveProgress(a, { section: 0, answers: { 0: 1, 99: 1, 3: 'x', '-1': 0 }, flags: [2, 2, 500] }, T0 + MIN, banks);
  assert.deepEqual(a.sections[0].answers, { 0: 1 });
  assert.deepEqual(a.sections[0].flags, [2]);
  E.cancelAttempt(a, 'user', T0 + 2 * MIN, banks);
  assert.equal(a.status, 'cancelled');
  assert.equal(a.cancelReason, 'user');
});

test('state survives a JSON round trip (as stored in Firestore)', () => {
  const a = JSON.parse(JSON.stringify(make('full', ['physics', 'chemistry'])));
  E.saveProgress(a, { section: 0, answers: answerAll(a) }, T0 + MIN, banks);
  const b = JSON.parse(JSON.stringify(a));
  E.advanceSection(b, { section: 0 }, T0 + 2 * MIN, banks);
  E.advanceSection(b, { section: 1 }, T0 + 3 * MIN, banks);
  assert.equal(b.status, 'submitted');
  assert.equal(b.results.sections[0].score, 100);
});

test('admin statistics: overview and question stats', () => {
  const a = make('quick', ['math']);
  activeUntil(a, T0, T0 + 5 * MIN);
  E.advanceSection(a, { section: 0, answers: answerAll(a) }, T0 + 6 * MIN, banks);
  const b = make('full', ['physics', 'chemistry']);
  E.cancelAttempt(b, 'admin', T0 + MIN, banks);
  const c = make('module', ['math']);
  const o = E.overview([a, b, c], T0 + 10 * MIN);
  const quick = o.byType.find((t) => t.key === 'quick');
  assert.equal(quick.submitted, 1);
  assert.equal(quick.avgScore, 100);
  assert.equal(o.byType.find((t) => t.key === 'full').cancelled, 1);
  assert.equal(o.byType.find((t) => t.key === 'module').inProgress, 1);
  assert.equal(o.reasons.admin, 1);
  assert.equal(o.bySubject.find((s) => s.key === 'math').avgScore, 100);
  assert.equal(o.daily.at(-1).started, 3);
  const qs = E.questionStats([a, b, c], banks, 'math');
  assert.equal(qs.tests, 1);
  assert.equal(qs.questions.length, 72);
  assert.equal(qs.questions.filter((q) => q.pct === 100).length, 12);
  assert.equal(b.cancelReason, 'admin');
});

test('question selection: blueprint quotas, no repeats while unseen questions remain', () => {
  const quotas = E.topicQuotas(E.BLUEPRINT.math, Object.fromEntries(Object.keys(E.BLUEPRINT.math).map((t) => [t, banks.math.list.filter((q) => q.t === t)])), 48);
  assert.equal(Object.values(quotas).reduce((n, q) => n + q, 0), 48);
  assert.ok(Object.values(quotas).every((q) => q >= 2), 'every topic appears at least twice in a module test');
  // six quick tests in a row for the same student cover all 72 questions with no repeat
  let recent = {};
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const a = E.createAttempt({ id: `q${i}`, userId: 'u', email: 'e', name: 'n', type: 'quick', subjects: ['math'], banks, now: T0, rand, recent });
    const ids = a.sections[0].items.map((it) => it.id);
    assert.equal(ids.length, 12);
    if (i < 3) for (const id of ids) assert.ok(!seen.has(id), `question ${id} repeated in test ${i + 1}`);
    ids.forEach((id) => seen.add(id));
    recent = E.updateHistory(recent, a);
  }
  assert.ok(seen.size >= 60, `only ${seen.size} distinct questions over six quick tests`);
  // two module tests: the second uses the 24 unseen questions plus the 24 seen longest ago
  const first = E.createAttempt({ id: 'm1', userId: 'u', email: 'e', name: 'n', type: 'module', subjects: ['physics'], banks, now: T0, rand });
  const hist = E.updateHistory({}, first);
  const second = E.createAttempt({ id: 'm2', userId: 'u', email: 'e', name: 'n', type: 'module', subjects: ['physics'], banks, now: T0, rand, recent: hist });
  const firstIds = new Set(first.sections[0].items.map((it) => it.id));
  const overlap = second.sections[0].items.filter((it) => firstIds.has(it.id)).length;
  assert.ok(overlap <= 26, `overlap ${overlap} should be about 24`);
  assert.equal(second.sections[0].items.filter((it) => !firstIds.has(it.id)).length, 24);
});

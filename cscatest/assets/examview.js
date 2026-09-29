// The exam. Runs inside the page it is given; the attempt lives in Firestore.
// startExam() takes the attempt document and calls back when it ends.
import * as E from './engine.js';
import { BANKS } from './questions.js';
import { saveAttempt, queueEmail } from './data.js';
import { resultEmail } from './email.js';
import { $, $$, LETTERS, toast, setBusy } from './common.js';

const banks = E.prepareBanks(BANKS);
let attempt = null;   // the attempt document
let id = null;        // its Firestore id
let onDone = () => {}; // called when the test is submitted or cancelled

/** The live view of the attempt, built by the engine (never includes answers we shouldn't show). */
const paperOf = () => E.paperView(attempt, banks, Date.now());

/** Writes the attempt back to Firestore. */
async function persist() {
  const { id: _omit, ...doc } = attempt;
  await saveAttempt(id, doc);
}

/** Submitted: queue the result email, then hand the finished attempt back to the page. */
async function finish() {
  stopExam();
  Object.keys(sessionStorage).filter((k) => k.startsWith(`csca-pos-${id}`)).forEach((k) => sessionStorage.removeItem(k));
  try {
    await queueEmail(id, attempt.email, resultEmail(attempt, `${location.origin}${location.pathname}?id=${id}`));
  } catch { /* the on-screen result is what matters */ }
  onDone.onFinish?.(attempt);
}

const WARN_BEFORE_MS = 2 * 60e3; // warn 2 minutes before the inactivity limit
const HEARTBEAT_EVERY_MS = 30e3; // while active, tell the server at most every 30 s

const el = {
  loading: $('[data-exam-loading]'),
  error: $('[data-exam-error]'),
  errorText: $('[data-exam-error-text]'),
  exam: $('[data-exam]'),
  subject: $('[data-exam-subject]'),
  sectionLabel: $('[data-exam-section]'),
  steps: $('[data-section-steps]'),
  timer: $('[data-timer]'),
  timerText: $('[data-timer-text]'),
  progress: $('[data-progress-bar]'),
  qLabel: $('[data-q-label]'),
  qText: $('[data-q-text]'),
  options: $('[data-options]'),
  flag: $('[data-flag]'),
  prev: $('[data-prev]'),
  next: $('[data-next]'),
  save: $('[data-save-status]'),
  grid: $('[data-nav-grid]'),
  answered: $('[data-answered-count]'),
  submitDialog: $('#submit-dialog'),
  leaveDialog: $('#leave-dialog'),
  idleWarning: $('[data-idle-warning]'),
  idleCountdown: $('[data-idle-countdown]'),
  cancelled: $('[data-cancelled]'),
};

let paper = null; // the current module, as the screen shows it
let answers = {};
let flags = new Set();
let current = 0; // question index within the section
let clockOffset = 0; // kept at 0: the clock is this browser's
let lastReportedAt = 0; // when activity was last recorded on the attempt
let lastSentAt = 0; // when we last wrote to Firestore
let dirty = false;
let inFlight = null;
let saveTimer = null;
let finished = false; // submitted or cancelled: stop everything
let advancing = false;
let timerHandle = null;

const serverNow = () => Date.now() + clockOffset;
const total = () => paper.section.questions.length;
const isLastSection = () => paper.current === paper.sections.length - 1;

// ------------------------------------------------------------------ loading a section
function load(view) {
  paper = view;
  clockOffset = view.serverNow - Date.now();
  lastReportedAt = Math.max(view.lastActivityAt, lastReportedAt);
  answers = Object.fromEntries(Object.entries(view.section.answers).map(([k, v]) => [Number(k), v]));
  flags = new Set(view.section.flags);
  const saved = Number(sessionStorage.getItem(`csca-pos-${id}-${view.current}`));
  current = Number.isInteger(saved) && saved < total() ? saved : 0;

  document.title = `${view.section.name}, ${view.typeName} | CSCA Test`;
  document.body.classList.remove('t-quick', 't-module', 't-full');
  document.body.classList.add(`t-${view.type}`);
  const chip = $('[data-exam-type]');
  chip.textContent = view.typeName;
  chip.hidden = false;
  el.subject.textContent = view.section.name;
  el.sectionLabel.textContent = view.sections.length > 1 ? `Module ${view.current + 1} of ${view.sections.length}` : view.typeName;

  if (view.sections.length > 1) {
    el.steps.innerHTML = view.sections.map((s) => `<li class="is-${s.state}"><span>${s.name}</span></li>`).join('');
    el.steps.hidden = false;
  }
  $('[data-nav-title]').textContent = view.sections.length > 1 ? view.section.name : 'Questions';
  $$('[data-open-submit]').forEach((b) => {
    b.textContent = isLastSection() ? (b.dataset.finishLabel !== undefined ? 'Finish test' : 'Finish') : (b.dataset.finishLabel !== undefined ? 'Finish module' : 'Next module');
  });
  el.save.textContent = '';
  el.save.classList.remove('is-error');
  el.grid.innerHTML = view.section.questions
    .map((q) => `<button type="button" class="nav-cell" data-go="${q.n}">${q.n + 1}</button>`).join('');
  el.loading.hidden = true;
  el.exam.hidden = false;
  render();
}

function refreshGrid() {
  const n = Object.keys(answers).length;
  $$('[data-go]', el.grid).forEach((c, i) => {
    const isAns = answers[i] !== undefined;
    c.classList.toggle('is-answered', isAns);
    c.classList.toggle('is-flagged', flags.has(i));
    c.classList.toggle('is-current', i === current);
    c.setAttribute('aria-label', `Question ${i + 1}${isAns ? ', answered' : ', not answered'}${flags.has(i) ? ', flagged' : ''}`);
    if (i === current) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
  });
  el.answered.textContent = `${n} of ${total()} answered`;
  const count = $('[data-nav-count]');
  if (count) count.textContent = `${n}/${total()}`;
  el.progress.style.width = `${(n / total()) * 100}%`;
}

function render() {
  const q = paper.section.questions[current];
  el.qLabel.textContent = `Question ${current + 1} of ${total()}`;
  el.qText.textContent = q.text;
  el.options.innerHTML = '';
  q.options.forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(answers[current] === i));
    b.tabIndex = answers[current] === i || (answers[current] === undefined && i === 0) ? 0 : -1;
    b.innerHTML = `<span class="letter">${LETTERS[i]}</span><span></span>`;
    b.lastChild.textContent = text;
    b.addEventListener('click', () => choose(i));
    el.options.append(b);
  });
  const flagged = flags.has(current);
  el.flag.setAttribute('aria-pressed', String(flagged));
  el.flag.querySelector('span').textContent = flagged ? 'Flagged' : 'Flag';
  el.prev.disabled = current === 0;
  el.next.textContent = current < total() - 1 ? 'Next' : isLastSection() ? 'Finish test' : 'Finish module';
  sessionStorage.setItem(`csca-pos-${id}-${paper.current}`, String(current));
  refreshGrid();
}

function goTo(n) {
  if (n < 0 || n >= total()) return;
  current = n;
  render();
  closeSheet();
  el.qText.focus({ preventScroll: true });
  if (window.innerWidth < 960) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function choose(i) {
  if (answers[current] === i) delete answers[current]; // tap again to clear
  else answers[current] = i;
  markDirty();
  render();
  $$('.option', el.options)[i]?.focus();
}

// ------------------------------------------------------------------ saving and heartbeat
function markDirty() {
  dirty = true;
  el.save.classList.remove('is-error');
  el.save.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 700);
}

async function save() {
  if (finished || advancing) return;
  if (inFlight) { dirty = true; return inFlight; }
  saveTimer = null;
  const hadChanges = dirty;
  dirty = false;
  lastSentAt = Date.now();
  inFlight = (async () => {
    try {
      const before = attempt.current;
      E.saveProgress(attempt, { section: paper.current, answers, flags: [...flags] }, Date.now(), banks);
      await persist();
      if (attempt.status === 'cancelled') return showCancelled(attempt.cancelReason);
      if (attempt.status === 'submitted') return finish();
      lastReportedAt = attempt.lastActivityAt;
      hideWarning();
      if (attempt.current !== before) { // time ran out and the next module started
        load(paperOf());
        toast(`${paper.section.name} has started.`);
        return;
      }
      if (hadChanges) el.save.textContent = 'All answers saved';
    } catch (err) {
          dirty = dirty || hadChanges;
      el.save.classList.add('is-error');
      el.save.textContent = err.offline ? 'Offline. Answers will save when you reconnect.' : 'Not saved. Retrying…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 5000);
    } finally {
      inFlight = null;
      if (dirty && !saveTimer && !finished) saveTimer = setTimeout(save, 700);
    }
  })();
  return inFlight;
}

// Any interaction counts as activity. Tell the server at most every 30 s,
// or immediately when the inactivity warning is showing.
function onActivity() {
  if (finished || !paper) return;
  const since = Date.now() - lastSentAt;
  if (!el.idleWarning.hidden || since >= HEARTBEAT_EVERY_MS) save();
  else if (!saveTimer) saveTimer = setTimeout(save, HEARTBEAT_EVERY_MS - since);
}
let lastMove = 0;
['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'input'].forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
window.addEventListener('pointermove', () => { if (Date.now() - lastMove > 5000) { lastMove = Date.now(); onActivity(); } }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onActivity(); });
window.addEventListener('online', () => save());
$('[data-still-here]').addEventListener('click', () => save());

function hideWarning() {
  el.idleWarning.hidden = true;
}

// ------------------------------------------------------------------ timers
function tick() {
  if (finished || !paper) return;
  const now = serverNow();

  // Section timer
  const ms = paper.section.endsAt - now;
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  el.timerText.textContent = m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  el.timer.classList.toggle('is-low', s <= 300 && s > 60);
  el.timer.classList.toggle('is-critical', s <= 60);
  el.timer.setAttribute('aria-label', `Time remaining in ${paper.section.name}: ${m} minutes ${s % 60} seconds`);
  if (s === 300) toast('5 minutes left in this module.');
  if (s === 60) toast(isLastSection() ? '1 minute left. Your test will be submitted automatically.' : '1 minute left. The next module will start automatically.');
  if (ms <= 0 && !advancing) advance(true);

  // Inactivity: measured from the last activity the server recorded.
  const idleLeft = lastReportedAt + paper.inactivityMs - now;
  if (idleLeft <= 0) {
    showCancelled('inactivity');
    E.cancelAttempt(attempt, 'inactivity', Date.now(), banks);
    persist().catch(() => {});
  } else if (idleLeft <= WARN_BEFORE_MS) {
    const sec = Math.ceil(idleLeft / 1000);
    el.idleCountdown.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    el.idleWarning.hidden = false;
  }
}

// ------------------------------------------------------------------ finishing a module or the test
function openSubmit() {
  const n = Object.keys(answers).length;
  const last = isLastSection();
  const nextSection = paper.sections[paper.current + 1];
  $('#submit-title').textContent = last ? 'Finish test?' : `Finish ${paper.section.name}?`;
  $('[data-sum-intro]').textContent = last
    ? 'You can’t change answers after this. Your results will be emailed right away.'
    : `You can’t return to ${paper.section.name}. ${nextSection.name} starts immediately, with ${nextSection.minutes} minutes.`;
  $('[data-sum-answered]').textContent = n;
  $('[data-sum-empty]').textContent = total() - n;
  $('[data-sum-flagged]').textContent = flags.size;
  $('[data-sum-note]').textContent = total() - n
    ? `You have ${total() - n} unanswered question${total() - n === 1 ? '' : 's'}. There’s no penalty for guessing.`
    : 'You have answered every question in this module.';
  $('[data-confirm-submit]').textContent = last ? 'Finish test' : `Start ${nextSection.name}`;
  el.submitDialog.showModal();
}

async function advance(auto) {
  if (advancing || finished) return;
  advancing = true;
  clearTimeout(saveTimer);
  const btn = $('[data-confirm-submit]');
  setBusy(btn, true);
  const wasLast = isLastSection();
  if (auto) toast(wasLast ? 'Time is up. Submitting your test…' : `Time is up for ${paper.section.name}.`);
  for (let tryNo = 0; tryNo < 4; tryNo++) {
    try {
      if (inFlight) await inFlight;
      E.advanceSection(attempt, { section: paper.current, answers, flags: [...flags] }, Date.now(), banks);
      await persist();
      el.submitDialog.close();
      setBusy(btn, false);
      advancing = false;
      if (attempt.status === 'submitted') return finish();
      if (attempt.status === 'cancelled') return showCancelled(attempt.cancelReason);
      const next = paperOf();
      load(next);
      window.scrollTo({ top: 0 });
      toast(`${next.section.name} has started. You have ${next.sections[next.current].minutes} minutes.`);
      return;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1200 * (tryNo + 1)));
    }
  }
  advancing = false;
  setBusy(btn, false);
  toast('Could not save. Check your connection and press Finish again.');
}

// ------------------------------------------------------------------ cancelled
function showCancelled(reason) {
  if (finished) return;
  stopExam();
  clearTimeout(saveTimer);
  hideWarning();
  el.submitDialog.open && el.submitDialog.close();
  el.leaveDialog.open && el.leaveDialog.close();
  $('[data-cancelled-desc]').textContent = reason === 'admin'
    ? 'An administrator cancelled this test, so it won’t be scored.'
    : reason === 'user'
    ? 'This test was cancelled, so it won’t be scored.'
    : 'There was no activity for 10 minutes, so this test was cancelled and won’t be scored.';
  el.cancelled.hidden = false;
  document.body.classList.add('is-locked');
  onDone.onCancelled?.(attempt);
  $('[data-cancelled-retry]').focus();
}

// ------------------------------------------------------------------ mobile navigator sheet
const sheet = $('#navigator');
const backdrop = $('[data-sheet-backdrop]');
const sheetToggle = $('[data-toggle-nav]');
function openSheet() {
  sheet.classList.add('is-open');
  backdrop.hidden = false;
  sheetToggle?.setAttribute('aria-expanded', 'true');
}
function closeSheet() {
  if (!sheet.classList.contains('is-open')) return;
  sheet.classList.remove('is-open');
  backdrop.hidden = true;
  sheetToggle?.setAttribute('aria-expanded', 'false');
}
sheetToggle?.addEventListener('click', () => (sheet.classList.contains('is-open') ? closeSheet() : openSheet()));
backdrop?.addEventListener('click', closeSheet);
window.addEventListener('resize', () => { if (window.innerWidth > 960) closeSheet(); });

// ------------------------------------------------------------------ controls
el.grid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) goTo(Number(b.dataset.go));
});
el.prev.addEventListener('click', () => goTo(current - 1));
el.next.addEventListener('click', () => (current < total() - 1 ? goTo(current + 1) : openSubmit()));
el.flag.addEventListener('click', () => {
  if (flags.has(current)) flags.delete(current); else flags.add(current);
  markDirty();
  render();
});
el.options.addEventListener('keydown', (e) => {
  const opts = $$('.option', el.options);
  const idx = opts.indexOf(document.activeElement);
  if (idx < 0) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); opts[(idx + 1) % opts.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); opts[(idx - 1 + opts.length) % opts.length].focus(); }
});
document.addEventListener('keydown', (e) => {
  if (!paper || finished || e.ctrlKey || e.metaKey || e.altKey) return;
  if (el.submitDialog.open || el.leaveDialog.open) return;
  const k = e.key.toLowerCase();
  const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
  if (k in map && map[k] < paper.section.questions[current].options.length) { e.preventDefault(); choose(map[k]); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
  else if (k === 'f') { e.preventDefault(); el.flag.click(); }
});
$$('[data-open-submit]').forEach((b) => b.addEventListener('click', openSubmit));
$('[data-close]', el.submitDialog).addEventListener('click', () => el.submitDialog.close());
$('[data-confirm-submit]').addEventListener('click', () => advance(false));
$('[data-leave]').addEventListener('click', (e) => { e.preventDefault(); el.leaveDialog.showModal(); });
$('[data-close]', el.leaveDialog).addEventListener('click', () => el.leaveDialog.close());
$('[data-confirm-leave]')?.addEventListener('click', async (e) => {
  e.preventDefault();
  clearTimeout(saveTimer);
  dirty = true;
  await save();
  stopExam();
  onDone.onLeave?.();
});
window.addEventListener('beforeunload', (e) => {
  if (finished || !paper) return;
  if (dirty) save();
  e.preventDefault();
  e.returnValue = '';
});

// ------------------------------------------------------------------ start
/**
 * Runs a test. `doc` is the attempt (with .id). `hooks.onFinish(attempt)` fires when
 * it is submitted, `hooks.onCancelled(attempt)` when the inactivity rule ends it.
 */
export async function startExam(doc, hooks = {}) {
  attempt = doc;
  id = doc.id;
  onDone = hooks;
  finished = false;
  advancing = false;
  if (E.tick(attempt, Date.now(), banks)) await persist();
  if (attempt.status === 'submitted') return hooks.onFinish?.(attempt);
  if (attempt.status === 'cancelled') {
    paper = paperOf();
    showCancelled(attempt.cancelReason);
    return;
  }
  load(paperOf());
  lastSentAt = Date.now();
  save();
  tick();
  if (!timerHandle) timerHandle = setInterval(tick, 1000);
}

export function stopExam() {
  finished = true;
  clearInterval(timerHandle);
  timerHandle = null;
  clearTimeout(saveTimer);
}

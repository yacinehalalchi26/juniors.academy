// The whole student flow on one page: pick an exam, enter details, take it, get the grade.
import * as E from './engine.js';
import { BANKS } from './questions.js';
import { startSession, createAttempt, loadAttempt, saveAttempt } from './data.js';
import { startExam, stopExam } from './examview.js';
import { renderResult, resultOf } from './resultview.js';
import { $, $$, toast, setBusy, clearErrors, showErrors, fillCountries, initChrome } from './common.js';

initChrome();

const banks = E.prepareBanks(BANKS);
const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const DETAILS_KEY = 'csca-details';
const SEEN_KEY = 'csca-seen';      // question ids already shown in this browser
const ACTIVE_KEY = 'csca-active';  // the test in progress, so it survives a refresh

const NAMES = { math: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry' };
let subject = null;

// ------------------------------------------------------------------ screens
function screen(name) {
  $$('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== name; });
  document.body.classList.toggle('exam-mode', name === 'exam');
  window.scrollTo({ top: 0 });
}

// ------------------------------------------------------------------ 1. pick an exam
$$('[data-exam-pick]').forEach((btn) => btn.addEventListener('click', () => {
  subject = btn.dataset.examPick;
  document.body.classList.remove('s-math', 's-physics', 's-chemistry');
  document.body.classList.add(`s-${subject}`);
  $('[data-details-title]').textContent = `${NAMES[subject]} test`;
  screen('details');
  $('#name').focus({ preventScroll: true });
}));

// ------------------------------------------------------------------ 2. details
const form = $('#details-form');
fillCountries($('#country'));
const prior = JSON.parse(localStorage.getItem(DETAILS_KEY) || 'null');
if (prior) for (const k of ['name', 'email', 'country', 'phone']) { const el = $(`[name="${k}"]`, form); if (el && prior[k]) el.value = prior[k]; }

$('[data-back]').addEventListener('click', () => screen('pick'));

function details() {
  const f = new FormData(form);
  return {
    name: String(f.get('name') || '').replace(/\s+/g, ' ').trim(),
    email: String(f.get('email') || '').trim().toLowerCase(),
    country: f.get('country') || '',
    phone: String(f.get('phone') || '').trim(),
    agree: $('#agree').checked,
  };
}

function problems(d) {
  const fields = {};
  if (d.name.split(' ').filter(Boolean).length < 2) fields.name = 'Enter your first and last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) fields.email = 'Enter a valid email address.';
  if (!d.country) fields.country = 'Select your country.';
  if (d.phone && !/^\+?[\d\s-]{7,20}$/.test(d.phone)) fields.phone = 'Enter a valid mobile number, or leave it empty.';
  if (!d.agree) fields.agree = 'Confirm this to continue.';
  return fields;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(form);
  const d = details();
  const fields = problems(d);
  if (Object.keys(fields).length) return showErrors(form, { fields });

  const btn = $('[data-start]');
  setBusy(btn, true);
  try {
    const session = await startSession();
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    const attempt = E.createAttempt({
      id: 'tmp', userId: session.uid, email: d.email, name: d.name,
      type: 'module', subjects: [subject], banks, now: Date.now(), rand, recent: seen,
    });
    attempt.country = d.country;
    attempt.phone = d.phone;
    delete attempt.id;
    const id = await createAttempt(attempt);
    attempt.id = id;
    localStorage.setItem(SEEN_KEY, JSON.stringify(E.updateHistory(seen, attempt)));
    localStorage.setItem(DETAILS_KEY, JSON.stringify({ name: d.name, email: d.email, country: d.country, phone: d.phone }));
    localStorage.setItem(ACTIVE_KEY, id);
    run(attempt);
  } catch (err) {
    showErrors(form, { message: err.message });
    toast(err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ------------------------------------------------------------------ 3. the test
function run(attempt) {
  screen('exam');
  startExam(attempt, {
    onFinish: (a) => { localStorage.removeItem(ACTIVE_KEY); showGrade(a); },
    onCancelled: () => { localStorage.removeItem(ACTIVE_KEY); },
    onLeave: () => { screen('pick'); checkResume(); },
  });
}

// ------------------------------------------------------------------ 4. the grade
function showGrade(attempt) {
  screen('result');
  const view = resultOf(attempt);
  if (view.status === 'cancelled') {
    $('[data-result-cancelled]').hidden = false;
    $('[data-cancel-reason]').textContent = view.cancelReason === 'inactivity'
      ? `Your ${view.modules} test was cancelled because there was no activity for 10 minutes. It wasn't scored.`
      : `This ${view.modules} test was cancelled, so it wasn't scored.`;
    return;
  }
  renderResult(view, { onAgain: backToStart });
}

function backToStart() {
  $('[data-result]').hidden = true;
  $('[data-result-cancelled]').hidden = true;
  screen('pick');
  checkResume();
}
$$('[data-again-btn]').forEach((b) => b.addEventListener('click', backToStart));

// ------------------------------------------------------------------ resuming after a refresh
async function checkResume() {
  const id = localStorage.getItem(ACTIVE_KEY);
  const bar = $('[data-resume]');
  bar.hidden = true;
  if (!id) return;
  let attempt;
  try {
    attempt = await loadAttempt(id);
  } catch { return; }
  if (!attempt) return localStorage.removeItem(ACTIVE_KEY);
  attempt.id = id;
  if (E.tick(attempt, Date.now(), banks)) {
    const { id: _x, ...doc } = attempt;
    saveAttempt(id, doc).catch(() => {});
  }
  if (attempt.status !== 'in_progress') {
    localStorage.removeItem(ACTIVE_KEY);
    if (attempt.status === 'submitted') showGrade(attempt);
    return;
  }
  const left = Math.max(0, Math.round((attempt.sections[attempt.current].endsAt - Date.now()) / 60000));
  $('[data-resume-title]').textContent = `${NAMES[attempt.subjects[0]]} test in progress`;
  $('[data-resume-note]').textContent = ` about ${left} min left. Return within 10 minutes of your last activity, or it will be cancelled.`;
  bar.hidden = false;
  $('[data-resume-go]').onclick = () => run(attempt);
  $('[data-resume-cancel]').onclick = async () => {
    if (!confirm('Cancel this test? It won’t be scored.')) return;
    E.cancelAttempt(attempt, 'user', Date.now(), banks);
    const { id: _y, ...doc } = attempt;
    await saveAttempt(id, doc).catch(() => {});
    localStorage.removeItem(ACTIVE_KEY);
    bar.hidden = true;
  };
}

// ------------------------------------------------------------------ boot
(async () => {
  screen('pick');
  await checkResume();
})();

window.addEventListener('pagehide', () => stopExam());

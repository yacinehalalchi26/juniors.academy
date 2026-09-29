// Admin. Only director@juniors.academy can read the data; that is enforced by the
// Firestore security rules, not just by hiding things on this page.
import * as E from './engine.js';
import { BANKS } from './questions.js';
import { currentUser, adminSignIn, adminReset, signOutNow, allAttempts, deleteAttempt, ADMIN_EMAIL } from './data.js';
import { $, $$, esc, fmtDate, toast, setBusy, clearErrors, showErrors, initChrome } from './common.js';

initChrome();
const banks = E.prepareBanks(BANKS);
const subjectChip = (subject, name) => `<span class="type-chip s-${subject}">${esc(name)}</span>`;

let rows = [];   // every attempt
let tab = 'overview';

// ------------------------------------------------------------------ rendering
function show(name) {
  tab = name;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  if (name === 'overview') renderOverview();
  if (name === 'tests') renderTests();
  if (name === 'students') renderStudents();
}

function renderOverview() {
  const o = E.overview(rows, Date.now());
  const t = {
    students: new Set(rows.map((a) => a.email)).size,
    tests: rows.length,
    submitted: rows.filter((a) => a.status === 'submitted').length,
    cancelled: rows.filter((a) => a.status === 'cancelled').length,
    inProgress: rows.filter((a) => a.status === 'in_progress').length,
  };
  $('[data-stat-tiles]').innerHTML = [
    ['Students', t.students], ['Tests started', t.tests], ['Completed', t.submitted],
    ['Cancelled', t.cancelled], ['In progress now', t.inProgress],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('[data-by-subject]').innerHTML = o.bySubject.map((r) => `<tr><td>${subjectChip(r.key, r.name)}</td><td class="num">${r.completed}</td><td class="num">${r.avgScore ?? '–'}</td></tr>`).join('');
  const r = o.reasons;
  $('[data-sample-note]').textContent = `Showing the ${rows.length} most recent tests. Cancellations: ${r.inactivity || 0} for inactivity, ${r.user || 0} by students, ${r.admin || 0} by admins.`;
}

function renderTests() {
  const status = $('[data-f-status]').value;
  const subj = $('[data-f-subject]').value;
  const list = rows.filter((a) => (!status || a.status === status) && (!subj || a.subjects[0] === subj));
  $('[data-tests]').innerHTML = list.length ? list.map((a) => {
    const v = E.summaryView(a);
    let result;
    if (a.status === 'submitted') result = `<b>${v.score}</b> / 100${v.sectionScores.length > 1 ? `<br><span class="muted small">${v.sectionScores.map((s) => `${esc(s.name)} ${s.score}`).join(', ')}</span>` : ''}`;
    else if (a.status === 'cancelled') result = `<span class="chip chip-seal">Cancelled${a.cancelReason === 'inactivity' ? ', no activity' : ''}</span>`;
    else result = '<span class="chip chip-live">In progress</span>';
    return `<tr data-id="${esc(a.id)}">
      <td><b>${esc(a.name || '—')}</b><br><span class="muted small">${esc(a.email || '')}</span></td>
      <td>${subjectChip(a.subjects[0], v.modules)}</td>
      <td>${esc(fmtDate(a.createdAt))}</td>
      <td>${result}</td>
      <td class="actions">
        ${a.status === 'submitted' ? `<a href="result.html?id=${encodeURIComponent(a.id)}&as=admin">View</a>` : ''}
        <button class="link-btn danger" type="button" data-delete>Delete</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No tests match these filters.</td></tr>';
}

/** Students are grouped from the attempts, keyed by email. */
function students() {
  const byEmail = new Map();
  for (const a of rows) {
    const key = (a.email || '').toLowerCase();
    if (!key) continue;
    const s = byEmail.get(key) || { name: a.name, email: a.email, country: a.country || '', phone: a.phone || '', tests: 0, done: 0, best: null, last: 0 };
    s.tests++;
    if (a.status === 'submitted') { s.done++; s.best = Math.max(s.best ?? 0, a.results?.score ?? 0); }
    s.last = Math.max(s.last, a.createdAt || 0);
    byEmail.set(key, s);
  }
  return [...byEmail.values()].sort((a, b) => b.last - a.last);
}

function renderStudents() {
  const text = ($('[data-student-search]').value || '').toLowerCase();
  const list = students().filter((s) => !text || s.email.toLowerCase().includes(text) || (s.name || '').toLowerCase().includes(text));
  $('[data-students]').innerHTML = list.length ? list.map((s) => `<tr>
    <td><b>${esc(s.name || '—')}</b><br><span class="muted small">${esc(s.email)}</span></td>
    <td>${esc(s.country)}</td>
    <td>${esc(s.phone)}</td>
    <td class="num">${s.done} / ${s.tests}</td>
    <td class="num">${s.best ?? '–'}</td>
    <td>${esc(fmtDate(s.last))}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="empty">No students yet.</td></tr>';
}

// ------------------------------------------------------------------ CSV
function exportCsv(kind, btn) {
  setBusy(btn, true);
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  let columns; let data;
  if (kind === 'students') {
    columns = ['name', 'email', 'country', 'phone', 'testsCompleted', 'testsStarted', 'bestScore', 'lastTest'];
    data = students().map((s) => [s.name, s.email, s.country, s.phone, s.done, s.tests, s.best ?? '', fmtDate(s.last)]);
  } else {
    columns = ['id', 'name', 'email', 'country', 'exam', 'status', 'cancelReason', 'started', 'finished', 'score'];
    data = rows.map((a) => {
      const v = E.summaryView(a);
      return [a.id, a.name, a.email, a.country || '', v.modules, a.status, a.cancelReason || '',
        fmtDate(a.createdAt), fmtDate(a.submittedAt || a.cancelledAt), v.score ?? ''];
    });
  }
  const csv = [columns, ...data].map((r) => r.map(cell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `cscatest-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  setBusy(btn, false);
}

// ------------------------------------------------------------------ wiring
function wire() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('[data-f-status]').addEventListener('change', renderTests);
  $('[data-f-subject]').addEventListener('change', renderTests);
  $('[data-student-search]').addEventListener('input', renderStudents);
  $$('[data-export]').forEach((b) => b.addEventListener('click', () => exportCsv(b.dataset.export, b)));
  $('[data-tests]').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    const tr = btn.closest('[data-id]');
    if (prompt('This permanently deletes this test. Type DELETE to confirm.') !== 'DELETE') return;
    setBusy(btn, true);
    try {
      await deleteAttempt(tr.dataset.id);
      rows = rows.filter((a) => a.id !== tr.dataset.id);
      renderTests();
      toast('Test deleted.');
    } catch (err) {
      toast(err.message);
      setBusy(btn, false);
    }
  });
  $('[data-admin-logout]').addEventListener('click', async () => {
    await signOutNow();
    location.reload();
  });
}

async function open() {
  rows = await allAttempts();
  const user = await currentUser();
  $('[data-admin-email]').textContent = user.email;
  $('[data-admin-gate]').hidden = true;
  $('[data-admin]').hidden = false;
  wire();
  show('overview');
}

function gate(message) {
  const box = $('[data-admin-gate]');
  box.hidden = false;
  $('[data-admin]').hidden = true;
  const form = $('[data-admin-login]', box);
  if (message) showErrors(form, { message });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = $('button[type="submit"]', form);
    const f = new FormData(form);
    setBusy(btn, true);
    try {
      await adminSignIn(f.get('email'), f.get('password'));
      await open();
    } catch (err) {
      showErrors(form, { message: err.message });
    } finally {
      setBusy(btn, false);
    }
  });
  $('[data-admin-forgot]', box).addEventListener('click', async () => {
    const email = $('#admin-email', box).value.trim();
    if (!email) return showErrors(form, { message: 'Enter your email first, then press Forgot.' });
    await adminReset(email);
    toast('If that address is the admin, a reset link is on its way.');
  });
}

(async () => {
  $('[data-admin-loading]').hidden = true;
  const user = await currentUser();
  if (user && user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
    try {
      await open();
      return;
    } catch (err) {
      gate(err.message);
      return;
    }
  }
  gate('');
})();

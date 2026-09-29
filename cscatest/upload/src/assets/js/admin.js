// cscatest.org — admin area
import { backend, $, $$, esc, fmtDate, toast, setBusy, clearErrors, showErrors, wirePasswordToggles, initChrome } from './core.js';

const typeChip = (type, name) => `<span class="type-chip t-${type}">${esc(name)}</span>`;
const date = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const loaded = new Set();
let me = null;
let firstOverview = null; // from the access check, so the overview isn't fetched twice

// ------------------------------------------------------------------ tabs
function show(tab) {
  if (!$(`[data-panel="${tab}"]`)) tab = 'overview';
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  // a relative URL here would resolve against <base>, so build the full one
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `${location.origin}${location.pathname}#${tab}`);
  if (!loaded.has(tab)) {
    loaded.add(tab);
    ({ overview, tests: () => tests(true), students: () => students(true), questions })[tab]();
  }
}

// ------------------------------------------------------------------ overview
async function overview() {
  const o = firstOverview || await backend.call('adminOverview');
  firstOverview = null;
  const t = o.totals;
  const tiles = [
    ['Students', t.students], ['Tests started', t.tests], ['Completed', t.submitted],
    ['Cancelled', t.cancelled], ['In progress now', t.inProgress],
  ];
  $('[data-stat-tiles]').innerHTML = tiles.map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
  $('[data-by-type]').innerHTML = o.byType.map((r) => `<tr><td>${typeChip(r.key, r.name)}</td><td class="num">${r.started}</td><td class="num">${r.submitted}</td><td class="num">${r.cancelled}</td><td class="num">${r.avgScore ?? '–'}</td></tr>`).join('');
  $('[data-by-subject]').innerHTML = o.bySubject.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.completed}</td><td class="num">${r.avgScore ?? '–'}</td></tr>`).join('');

  const max = Math.max(1, ...o.daily.map((d) => d.started));
  $('[data-daily]').innerHTML = o.daily.map((d) => {
    const h = (n) => `${Math.round((n / max) * 100)}%`;
    const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="day" title="${label}: ${d.started} started, ${d.submitted} completed, ${d.cancelled} cancelled">
      <div class="day-bars"><i class="b-started" style="height:${h(d.started)}"></i><i class="b-submitted" style="height:${h(d.submitted)}"></i><i class="b-cancelled" style="height:${h(d.cancelled)}"></i></div>
      <span>${new Date(`${d.date}T00:00:00Z`).getUTCDate()}</span></div>`;
  }).join('');

  const totalBands = Math.max(1, o.bands.reduce((n, b) => n + b.count, 0));
  $('[data-bands]').innerHTML = o.bands.map((b) => `<div><div class="topic-bar-head"><span>${esc(b.label)}</span><span>${b.count}</span></div><div class="bar"><i style="width:${(b.count / totalBands) * 100}%"></i></div></div>`).join('');
  const r = o.reasons;
  $('[data-reasons]').textContent = `Cancellations: ${r.inactivity || 0} for inactivity, ${r.user || 0} by students, ${r.admin || 0} by admins.`;
  $('[data-sample-note]').textContent = `Totals count every record. Tables and charts use the ${o.sample} most recent tests.`;
}

// ------------------------------------------------------------------ tests
let testCursor = null;
let userFilter = null;
async function tests(reset) {
  const body = $('[data-tests]');
  if (reset) { testCursor = null; body.innerHTML = '<tr><td colspan="5" class="empty"><div class="spinner"></div></td></tr>'; }
  const { rows, cursor } = await backend.call('adminListAttempts', {
    status: $('[data-f-status]').value, type: $('[data-f-type]').value, uid: userFilter?.uid, cursor: testCursor,
  });
  testCursor = cursor;
  const html = rows.map((a) => {
    let result;
    if (a.status === 'submitted') result = `<b>${a.score}</b> / 100${a.sectionScores.length > 1 ? `<br><span class="muted small">${a.sectionScores.map((s) => `${esc(s.name)} ${s.score}`).join(', ')}</span>` : ''}`;
    else if (a.status === 'cancelled') result = `<span class="chip chip-seal">Cancelled${a.cancelReason === 'inactivity' ? ', no activity' : a.cancelReason === 'admin' ? ' by admin' : ', by student'}</span>`;
    else result = '<span class="chip chip-live">In progress</span>';
    const actions = [
      a.status === 'submitted' ? `<a href="results/?id=${encodeURIComponent(a.id)}&as=admin">View</a>` : '',
      a.status === 'in_progress' ? `<button class="link-btn danger" type="button" data-cancel-test="${esc(a.id)}">Cancel</button>` : '',
    ].join(' ');
    return `<tr>
      <td><button class="link-btn strong" type="button" data-filter-user="${esc(a.userId)}" data-user-label="${esc(a.name || a.email)}">${esc(a.name || '—')}</button><br><span class="muted small">${esc(a.email || '')}</span></td>
      <td>${typeChip(a.type, a.typeName)}<br><span class="muted small">${esc(a.modules)}</span></td>
      <td>${esc(fmtDate(a.createdAt))}</td>
      <td>${result}</td>
      <td class="actions">${actions}</td>
    </tr>`;
  }).join('');
  if (reset) body.innerHTML = html || '<tr><td colspan="5" class="empty">No tests match these filters.</td></tr>';
  else body.insertAdjacentHTML('beforeend', html);
  $('[data-more-tests]').hidden = !cursor;
}

function filterByUser(uid, label) {
  userFilter = uid ? { uid, label } : null;
  const pill = $('[data-f-user]');
  pill.hidden = !uid;
  $('span', pill).textContent = uid ? `Student: ${label}` : '';
  $('[data-f-status]').disabled = Boolean(uid);
  $('[data-f-type]').disabled = Boolean(uid);
  loaded.add('tests');
  show('tests');
  tests(true).catch((e) => toast(e.message));
}

// ------------------------------------------------------------------ students
let studentCursor = null;
async function students(reset) {
  const body = $('[data-students]');
  const q = new FormData($('[data-student-search]')).get('q');
  if (reset) { studentCursor = null; body.innerHTML = '<tr><td colspan="7" class="empty"><div class="spinner"></div></td></tr>'; }
  const { rows, cursor } = await backend.call('adminListUsers', { q, cursor: studentCursor });
  studentCursor = cursor;
  const html = rows.map((u) => {
    return `<tr data-uid="${esc(u.uid)}">
      <td><b>${esc(u.name || '—')}</b><br><span class="muted small">${esc(u.email)}</span></td>
      <td>${esc(u.phone || '')}</td>
      <td>${esc(u.country || '')}</td>
      <td>${esc(date(u.createdAt))}</td>
      <td class="num">${u.testsSubmitted} / ${u.testsStarted}${u.testsCancelled ? `<br><span class="muted small">${u.testsCancelled} cancelled</span>` : ''}</td>
      <td class="num">${u.lastScore ?? '–'}</td>
      <td class="actions">
        <button class="link-btn" type="button" data-filter-user="${esc(u.uid)}" data-user-label="${esc(u.name || u.email)}">Tests</button>
        <button class="link-btn danger" type="button" data-delete-user data-label="${esc(u.email)}">Delete</button>
      </td>
    </tr>`;
  }).join('');
  if (reset) body.innerHTML = html || '<tr><td colspan="7" class="empty">No students yet. Search by the exact email address, or by the start of a name.</td></tr>';
  else body.insertAdjacentHTML('beforeend', html);
  $('[data-more-students]').hidden = !cursor;
}

// ------------------------------------------------------------------ questions
async function questions() {
  const body = $('[data-questions]');
  body.innerHTML = '<tr><td colspan="5" class="empty"><div class="spinner"></div></td></tr>';
  const r = await backend.call('adminQuestionStats', { subject: $('[data-q-subject]').value });
  $('[data-q-note]').textContent = `Based on ${r.tests} completed ${r.name} test${r.tests === 1 ? '' : 's'}.`;
  body.innerHTML = r.questions.map((q) => {
    const tone = q.pct === null ? '' : q.pct < 30 ? 'low' : q.pct < 60 ? 'mid' : '';
    return `<tr>
      <td class="muted">${q.n}</td>
      <td class="q-cell" title="${esc(q.text)}">${esc(q.text)}</td>
      <td class="muted small">${esc(q.topic)}</td>
      <td class="num">${q.seen}</td>
      <td>${q.pct === null ? '<span class="muted">–</span>' : `<div class="pct-cell"><div class="bar ${tone}"><i style="width:${q.pct}%"></i></div><span>${q.pct}%</span></div>`}</td>
    </tr>`;
  }).join('');
}

// ------------------------------------------------------------------ CSV export
async function exportCsv(kind, btn) {
  setBusy(btn, true);
  try {
    const { columns, rows } = await backend.call('adminExport', { kind });
    const cell = (v) => {
      const s = typeof v === 'number' && v > 1e12 ? new Date(v).toISOString() : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns, ...rows].map((r) => r.map(cell).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `cscatest-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast(e.message);
  } finally {
    setBusy(btn, false);
  }
}

// ------------------------------------------------------------------ events
function wire() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  $('[data-f-status]').addEventListener('change', () => tests(true).catch((e) => toast(e.message)));
  $('[data-f-type]').addEventListener('change', () => tests(true).catch((e) => toast(e.message)));
  $('[data-clear-user]').addEventListener('click', () => filterByUser(null));
  $('[data-more-tests]').addEventListener('click', () => tests(false).catch((e) => toast(e.message)));
  $('[data-more-students]').addEventListener('click', () => students(false).catch((e) => toast(e.message)));
  $('[data-student-search]').addEventListener('submit', (e) => { e.preventDefault(); students(true).catch((er) => toast(er.message)); });
  $('[data-q-subject]').addEventListener('change', () => questions().catch((e) => toast(e.message)));
  $$('[data-export]').forEach((b) => b.addEventListener('click', () => exportCsv(b.dataset.export, b)));

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    try {
      if (t.dataset.filterUser) return filterByUser(t.dataset.filterUser, t.dataset.userLabel);
      if (t.dataset.cancelTest) {
        if (!confirm('Cancel this test? The student will see that an administrator cancelled it.')) return;
        setBusy(t, true);
        await backend.call('adminCancelAttempt', { id: t.dataset.cancelTest });
        toast('Test cancelled.');
        return tests(true);
      }
      const row = t.closest('[data-uid]');
      if (t.hasAttribute('data-delete-user') && row) {
        const typed = prompt(`This permanently deletes ${t.dataset.label} and all their tests. It can’t be undone.\n\nType DELETE to confirm.`);
        if (typed !== 'DELETE') return;
        setBusy(t, true);
        await backend.call('adminDeleteUser', { uid: row.dataset.uid });
        toast('Student and all their tests deleted.');
        return students(true);
      }
    } catch (err) {
      setBusy(t, false);
      toast(err.message);
    }
  });

}

// ------------------------------------------------------------------ start
async function openAdmin() {
  try {
    firstOverview = await backend.call('adminOverview'); // also checks access
  } catch (err) {
    return err;
  }
  me = await backend.getUser();
  $('[data-admin-gate]').hidden = true;
  $('[data-admin-email]').textContent = me.email;
  $('[data-admin]').hidden = false;
  wire();
  show(location.hash.slice(1) || 'overview');
  return null;
}

let gateWired = false;
function showGate(message) {
  $('[data-admin]').hidden = true;
  const gate = $('[data-admin-gate]');
  gate.hidden = false;
  const form = $('[data-admin-login]', gate);
  form.reset();
  clearErrors(form);
  if (message) showErrors(form, { message, fields: {} });
  if (gateWired) return;
  gateWired = true;
  wirePasswordToggles();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = $('button[type="submit"]', form);
    const f = new FormData(form);
    setBusy(btn, true);
    try {
      await backend.adminLogin(f.get('email'), f.get('password'));
      const err = await openAdmin();
      if (err) {
        await backend.logout();
        throw err;
      }
    } catch (err) {
      showErrors(form, err.fields ? err : { message: err.message, fields: {} });
    } finally {
      setBusy(btn, false);
    }
  }, { once: false });

  $('[data-admin-forgot]', gate).addEventListener('click', async () => {
    const email = $('#admin-email', gate).value.trim();
    if (!email) return showErrors(form, { message: 'Enter your email first, then press Forgot.', fields: {} });
    await backend.adminResetPassword(email);
    toast('If that address is an admin, a reset link is on its way.');
  });
}

(async () => {
  await initChrome();
  $('[data-admin-loading]').hidden = true;
  me = await backend.getUser();
  if (me && me.isAdmin) {
    const err = await openAdmin();
    if (err) showGate(err.code === 'forbidden' ? 'That account does not have admin access.' : err.message);
  } else {
    showGate(backend.isDemo ? `Demo mode: sign in with ${backend.demoAdmin.email} and the password ${backend.demoAdmin.password}.` : '');
  }
  $$('[data-admin-logout]').forEach((b) => b.addEventListener('click', async (e) => {
    e.preventDefault();
    setBusy(b, true);
    await backend.logout();
    setBusy(b, false);
    loaded.clear();
    firstOverview = null;
    me = null;
    history.replaceState(null, '', location.origin + location.pathname);
    showGate('');
  }));
})();

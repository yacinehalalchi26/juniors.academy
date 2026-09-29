// cscatest.org — page controllers (the exam page has its own, exam.js)
import {
  CONFIG, backend, $, $$, LETTERS, esc, fmtDate, fmtDuration, fmtMinutes, params, go,
  toast, setBusy, clearErrors, showErrors, fillCountrySelects, normalizePhone, initChrome,
} from './core.js';

const TYPES = {
  quick: { name: 'Quick test', minutes: 15, questions: 12, min: 1, max: 1 },
  module: { name: 'Module test', minutes: 60, questions: 48, min: 1, max: 1 },
  full: { name: 'Full exam', minutes: 60, questions: 48, min: 2, max: 3 },
};
const SUBJECTS = { math: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry' };
const ORDER = ['math', 'physics', 'chemistry'];
const typeChip = (type, name) => `<span class="type-chip t-${type}">${esc(name)}</span>`;
const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '');

const DETAILS_KEY = 'csca-details';
const savedDetails = () => { try { return JSON.parse(localStorage.getItem(DETAILS_KEY) || 'null'); } catch { return null; } };

const pages = {};

// ------------------------------------------------------------------ tests (choose format + modules)
pages.tests = async () => {
  const form = $('[data-builder]');
  const startBtn = $('[data-start]');
  const summary = $('[data-summary]');
  const errBox = $('[data-start-error]');
  const subjectInputs = $$('input[name="subject"]', form);
  const startDialog = $('#start-dialog');
  const activeDialog = $('#active-dialog');
  let active = null;

  const state = () => ({
    type: $('input[name="type"]:checked', form)?.value || null,
    subjects: subjectInputs.filter((i) => i.checked).map((i) => i.value).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
  });

  function setType(type) {
    const t = TYPES[type];
    form.classList.remove('t-quick', 't-module', 't-full');
    if (t) form.classList.add(`t-${type}`);
    const multi = t && t.max > 1;
    const checked = subjectInputs.filter((i) => i.checked).map((i) => i.value);
    subjectInputs.forEach((i) => {
      i.type = multi ? 'checkbox' : 'radio';
      i.checked = multi ? checked.includes(i.value) : i.value === checked[0];
    });
    $('[data-subject-legend]').textContent = multi ? 'Modules' : 'Module';
    $('[data-subject-hint]').textContent = multi ? 'Choose two or three modules. They run in this order.' : 'Choose one module.';
  }

  function update() {
    const { type, subjects } = state();
    const t = TYPES[type];
    let ok = false;
    if (!t) summary.textContent = 'Choose a format and a module.';
    else if (subjects.length < t.min) summary.textContent = t.max > 1 ? `Choose ${t.min - subjects.length === 1 && subjects.length ? 'one more module' : 'two or three modules'}.` : 'Choose a module.';
    else if (subjects.length > t.max) summary.textContent = 'Choose up to three modules.';
    else {
      ok = true;
      const minutes = t.minutes * subjects.length;
      summary.innerHTML = `<b>${esc(t.name)}: ${esc(joinNames(subjects.map((s) => SUBJECTS[s])))}</b><br>${t.questions * subjects.length} questions in ${fmtMinutes(minutes)}`;
    }
    startBtn.disabled = !ok;
    const url = new URL(location.href);
    if (type) url.searchParams.set('type', type); else url.searchParams.delete('type');
    if (subjects.length) url.searchParams.set('subjects', subjects.join(',')); else url.searchParams.delete('subjects');
    history.replaceState(null, '', url);
  }

  // Preselect from the URL (e.g. links from the home page)
  const pType = params.get('type');
  if (TYPES[pType]) $(`input[name="type"][value="${pType}"]`, form).checked = true;
  setType(pType); // switch radio/checkbox first, so several modules can be preselected
  const pSubjects = (params.get('subjects') || params.get('subject') || '').split(',').filter((x) => SUBJECTS[x]);
  const keep = TYPES[pType]?.max > 1 ? pSubjects : pSubjects.slice(0, 1);
  subjectInputs.forEach((i) => { i.checked = keep.includes(i.value); });
  update();

  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') setType(e.target.value);
    update();
  });

  // Prefill the details if this browser has taken a test before.
  fillCountrySelects(form);
  const prior = savedDetails();
  if (prior) {
    for (const k of ['name', 'email', 'country', 'dialCode', 'phone']) {
      const el = $(`[name="${k}"]`, form);
      if (el && prior[k]) el.value = prior[k];
    }
  }

  const details = () => {
    const f = new FormData(form);
    return {
      name: String(f.get('name') || '').trim(),
      email: String(f.get('email') || '').trim(),
      country: f.get('country') || '',
      dialCode: f.get('dialCode') || '',
      phone: String(f.get('phone') || '').trim(),
      agree: $('#agree').checked,
    };
  };

  function checkDetails() {
    const d = details();
    const fields = {};
    if (d.name.split(' ').filter(Boolean).length < 2) fields.name = 'Enter your first and last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) fields.email = 'Enter a valid email address.';
    if (!d.country) fields.country = 'Select your country.';
    if (d.phone && !normalizePhone(d.dialCode, d.phone)) fields.phone = 'Enter a valid mobile number, or leave it empty.';
    if (!d.agree) fields.agree = 'Confirm this to continue.';
    return { d, fields };
  }

  async function start(btn) {
    errBox.hidden = true;
    setBusy(btn, true);
    try {
      const { type, subjects } = state();
      const { d } = checkDetails();
      await backend.ensureSession();
      const paper = await backend.call('startAttempt', { type, subjects, student: d });
      localStorage.setItem(DETAILS_KEY, JSON.stringify({ name: d.name, email: d.email, country: d.country, dialCode: d.dialCode, phone: d.phone }));
      go(`exam/?id=${encodeURIComponent(paper.id)}`);
    } catch (err) {
      setBusy(btn, false);
      startDialog.close();
      if (err.code === 'active') {
        active = err.data;
        $('[data-active-desc]').textContent = `${err.data.typeName}: ${err.data.modules}. You can have one test at a time. Resume it, or cancel it and start this one.`;
        return activeDialog.showModal();
      }
      if (Object.keys(err.fields || {}).length) {
        showErrors(form, err);
        $('[data-details-group]').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (startBtn.disabled) return;
    clearErrors(form);
    const { d, fields } = checkDetails();
    if (Object.keys(fields).length) {
      showErrors(form, { message: 'Check the highlighted fields.', fields });
      return;
    }
    const { type, subjects } = state();
    const t = TYPES[type];
    $('[data-start-desc]').textContent = `${t.name}: ${joinNames(subjects.map((x) => SUBJECTS[x]))}. ${t.questions * subjects.length} questions in ${fmtMinutes(t.minutes * subjects.length)}.`;
    $('[data-rule-sections]').hidden = subjects.length < 2;
    $('[data-user-email]').textContent = d.email;
    startDialog.showModal();
  });

  $('[data-close]', startDialog).addEventListener('click', () => startDialog.close());
  const confirmBtn = $('[data-confirm-start]', startDialog);
  confirmBtn.addEventListener('click', () => start(confirmBtn));
  $('[data-resume-active]').addEventListener('click', () => go(`exam/?id=${encodeURIComponent(active.attemptId)}`));
  const cancelBtn = $('[data-cancel-active]');
  cancelBtn.addEventListener('click', async () => {
    setBusy(cancelBtn, true);
    try {
      await backend.call('cancelAttempt', { id: active.attemptId, reason: 'user' });
      activeDialog.close();
      await start(cancelBtn);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(cancelBtn, false);
    }
  });
};

// ------------------------------------------------------------------ results
pages.results = async () => {
  const id = params.get('id');
  const asAdmin = params.get('as') === 'admin';
  const loading = $('[data-result-loading]');
  let r;
  try {
    if (!id) throw new Error('This result was not found.');
    r = await backend.call(asAdmin ? 'adminGetAttempt' : 'getAttempt', { id });
  } catch (err) {
    loading.hidden = true;
    $('[data-result-error-text]').textContent = err.message;
    $('[data-result-error]').hidden = false;
    return;
  }
  if (r.status === 'in_progress') {
    if (!asAdmin) return go(`exam/?id=${encodeURIComponent(r.id)}`);
    loading.hidden = true;
    $('[data-result-error-text]').textContent = `${r.name || r.email} is still taking this ${r.typeName.toLowerCase()} (${r.modules}).`;
    $('[data-result-error]').hidden = false;
    return;
  }
  loading.hidden = true;
  if (asAdmin) {
    const note = document.createElement('div');
    note.className = 'container';
    note.innerHTML = `<div class="admin-note">Admin view of <b>${esc(r.name || '')}</b> (${esc(r.email)}). <a href="admin/#tests">Back to admin</a></div>`;
    $('#main').prepend(note);
  }
  const retryUrl = `tests/?type=${r.type}&subjects=${r.subjects.join(',')}`;

  if (r.status === 'cancelled') {
    $('[data-cancel-reason]').textContent = r.cancelReason === 'inactivity'
      ? `Your ${r.typeName.toLowerCase()} (${r.modules}) was cancelled on ${fmtDate(r.cancelledAt)} because there was no activity for 10 minutes. It wasn't scored.`
      : r.cancelReason === 'admin'
        ? `This ${r.typeName.toLowerCase()} (${r.modules}) was cancelled by an administrator on ${fmtDate(r.cancelledAt)}. It wasn't scored.`
        : `This ${r.typeName.toLowerCase()} (${r.modules}) was cancelled on ${fmtDate(r.cancelledAt)}. It wasn't scored.`;
    $('[data-retry]').setAttribute('href', retryUrl);
    $('[data-result-cancelled]').hidden = false;
    return;
  }

  $('[data-result]').hidden = false;
  document.title = `${r.typeName} result: ${r.score}/100 | CSCA Test`;
  const tone = (pct) => (pct >= 70 ? '' : pct >= 50 ? 'mid' : 'low');
  const multi = r.sections.length > 1;
  document.body.classList.add(`t-${r.type}`);
  $('[data-result-subject]').innerHTML = `${typeChip(r.type, r.typeName)}<br>${esc(r.modules)}`;
  $('[data-score-of]').textContent = multi ? '/ 100 average' : '/ 100';
  const band = $('[data-band]');
  band.textContent = r.band.label;
  if (tone(r.score)) band.classList.add(tone(r.score));
  $('[data-band-note]').textContent = r.band.note;
  $('[data-correct]').textContent = `${r.correct} / ${r.total}`;
  $('[data-answered]').textContent = `${r.sections.reduce((n, s) => n + s.answered, 0)} / ${r.total}`;
  $('[data-duration]').textContent = fmtDuration(r.sections.reduce((n, s) => n + s.durationSec, 0));
  $('[data-submitted]').textContent = fmtDate(r.submittedAt);
  $('[data-emailed]').textContent = `Emailed to ${r.email}`;
  $('[data-review-link]').setAttribute('href', `${location.pathname}${location.search}#review`);
  const again = $('[data-again]');
  if (again) again.setAttribute('href', `tests/?type=${r.type}&subjects=${r.subjects.join(',')}`);

  if (multi) {
    const box = $('[data-module-scores]');
    box.innerHTML = r.sections.map((s) => `<div><span class="muted">${esc(s.name)}</span><b>${s.score}</b><span class="muted small">${esc(s.band.label)}</span></div>`).join('');
    box.hidden = false;
  }

  // Animated score
  const scoreEl = $('[data-score]');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) scoreEl.textContent = r.score;
  else {
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      scoreEl.textContent = Math.round(r.score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Topics, one block per module
  $('[data-topics-section]').innerHTML = r.sections.map((s) => `
    <div class="split topic-block">
      <div><h2>${multi ? esc(s.name) : 'By topic'}</h2><p class="muted small">${multi ? `${s.score} / 100, weakest topics first.` : 'Weakest first.'}</p></div>
      <div class="topic-bars">${s.breakdown.map((t) => {
        const pct = Math.round((t.correct / t.total) * 100);
        return `<div><div class="topic-bar-head"><span>${esc(t.topic)}</span><span>${t.correct} / ${t.total}</span></div><div class="bar ${tone(pct)}"><i data-w="${pct}"></i></div></div>`;
      }).join('')}</div>
    </div>`).join('');
  requestAnimationFrame(() => $$('[data-w]').forEach((i) => { i.style.width = `${i.dataset.w}%`; }));

  // Review
  if (!r.sections[0].review) {
    $('[data-review-section]').hidden = true;
    $('[data-review-link]').hidden = true;
    return;
  }
  let moduleIndex = 0;
  let filter = 'all';
  const list = $('[data-review-list]');
  const tabs = $('[data-module-tabs]');
  if (multi) {
    tabs.innerHTML = r.sections.map((s, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-module="${i}">${esc(s.name)}</button>`).join('');
    tabs.hidden = false;
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-module]');
      if (!b) return;
      moduleIndex = Number(b.dataset.module);
      $$('[data-module]', tabs).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderReview();
    });
  }
  function renderReview() {
    const items = r.sections[moduleIndex].review.filter((q) => {
      const right = q.chosen === q.correctIndex;
      if (filter === 'wrong') return q.chosen !== null && !right;
      if (filter === 'empty') return q.chosen === null;
      if (filter === 'right') return right;
      return true;
    });
    list.innerHTML = items.length ? items.map((q) => {
      const right = q.chosen === q.correctIndex;
      const status = q.chosen === null ? '<span class="chip">Unanswered</span>' : right ? '<span class="chip chip-jade">Correct</span>' : '<span class="chip chip-seal">Incorrect</span>';
      return `<article class="review-item">
        <div class="review-item-head"><span>${q.n + 1}. ${esc(q.topic)}</span>${status}</div>
        <p class="q">${esc(q.text)}</p>
        <ol class="review-options">${q.options.map((o, i) => {
          const cls = i === q.correctIndex ? 'is-correct' : i === q.chosen ? 'is-wrong' : '';
          const tag = i === q.correctIndex ? `<em>${i === q.chosen ? 'Your answer, correct' : 'Correct answer'}</em>` : i === q.chosen ? '<em>Your answer</em>' : '';
          return `<li class="${cls}"><b>${LETTERS[i]}</b><span>${esc(o)}</span>${tag}</li>`;
        }).join('')}</ol>
      </article>`;
    }).join('') : '<p class="empty">No questions in this group.</p>';
  }
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    filter = b.dataset.filter;
    renderReview();
  }));
  renderReview();
};

// ------------------------------------------------------------------ boot
(async () => {
  const user = await initChrome();
  // In-page links (#anchors) must keep the current page and query string, not jump to the base URL.
  $$('a[href*="#"]').forEach((a) => {
    const u = new URL(a.href);
    if (u.pathname === location.pathname) a.href = location.pathname + location.search + u.hash;
  });
  try {
    await pages[document.body.dataset.page]?.(user);
  } catch (err) {
    console.error(err);
    toast(err.message || 'Something went wrong. Refresh the page to try again.');
  }
})();

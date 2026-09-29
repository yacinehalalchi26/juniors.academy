// Renders a finished attempt: score, module scores, topics and the answer review.
import * as E from './engine.js';
import { BANKS } from './questions.js';
import { $, $$, LETTERS, esc, fmtDate, fmtDuration } from './common.js';

const banks = E.prepareBanks(BANKS);
const typeChip = (subject, name) => `<span class="type-chip s-${subject}">${esc(name)}</span>`;

/** Turns a stored attempt into the view object the renderer wants. */
export function resultOf(attempt) {
  E.tick(attempt, Date.now(), banks);
  return attempt.status === 'in_progress' ? { status: 'in_progress', id: attempt.id } : E.resultView(attempt, banks);
}

export function renderResult(r, { asAdmin = false, onAgain } = {}) {
  const loading = $('[data-result-loading]');
  if (loading) loading.hidden = true;
  if (r.status === 'in_progress') return;
  if (asAdmin) {
    const note = document.createElement('div');
    note.className = 'container';
    note.innerHTML = `<div class="admin-note">Admin view of <b>${esc(r.name || '')}</b> (${esc(r.email)}). <a href="admin.html">Back to admin</a></div>`;
    $('#main').prepend(note);
  }
  if (r.status === 'cancelled') {
    const why = r.cancelReason === 'inactivity'
      ? `Your ${r.modules} test was cancelled on ${fmtDate(r.cancelledAt)} because there was no activity for 10 minutes. It wasn't scored.`
      : r.cancelReason === 'admin'
        ? `This ${r.modules} test was cancelled by an administrator on ${fmtDate(r.cancelledAt)}. It wasn't scored.`
        : `This ${r.modules} test was cancelled on ${fmtDate(r.cancelledAt)}. It wasn't scored.`;
    const box = $('[data-cancel-reason]');
    if (box) box.textContent = why;
    const wrap = $('[data-result-cancelled]');
    if (wrap) wrap.hidden = false;
    return;
  }

  $('[data-result]').hidden = false;
  document.title = `${r.modules} result: ${r.score}/100 | CSCA Test`;
  const tone = (pct) => (pct >= 70 ? '' : pct >= 50 ? 'mid' : 'low');
  const multi = r.sections.length > 1;
  document.body.classList.remove('s-math', 's-physics', 's-chemistry');
  document.body.classList.add(`s-${r.subjects[0]}`);
  $('[data-result-subject]').innerHTML = `${typeChip(r.subjects[0], r.modules)} <span class="muted">CSCA practice test</span>`;
  $('[data-score-of]').textContent = multi ? '/ 100 average' : '/ 100';
  const band = $('[data-band]');
  band.textContent = r.band.label;
  if (tone(r.score)) band.classList.add(tone(r.score));
  $('[data-band-note]').textContent = r.band.note;
  $('[data-correct]').textContent = `${r.correct} / ${r.total}`;
  $('[data-answered]').textContent = `${r.sections.reduce((n, s) => n + s.answered, 0)} / ${r.total}`;
  $('[data-duration]').textContent = fmtDuration(r.sections.reduce((n, s) => n + s.durationSec, 0));
  const sub = $('[data-submitted]'); if (sub) sub.textContent = fmtDate(r.submittedAt);
  const em = $('[data-emailed]'); if (em) em.textContent = `Emailed to ${r.email}`;
  $('[data-review-link]')?.setAttribute('href', '#review');
  const again = $('[data-again]');
  if (again && onAgain) { again.setAttribute('href', '#'); again.onclick = (e) => { e.preventDefault(); onAgain(); }; }

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
    const rl = $('[data-review-link]'); if (rl) rl.hidden = true;
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




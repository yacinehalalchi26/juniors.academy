// result.html: used by the admin to open a student's result from the Tests tab.
import { loadAttempt } from './data.js';
import { renderResult, resultOf } from './resultview.js';
import { $, esc, params, initChrome } from './common.js';

initChrome();

(async () => {
  const id = params.get('id');
  try {
    if (!id) throw new Error('This result was not found.');
    const attempt = await loadAttempt(id);
    if (!attempt) throw new Error('This result was not found.');
    attempt.id = id;
    const view = resultOf(attempt);
    if (view.status === 'in_progress') throw new Error('This test is still in progress.');
    $('[data-result-loading]').hidden = true;
    const note = document.createElement('div');
    note.className = 'container';
    note.innerHTML = `<div class="admin-note">Admin view of <b>${esc(attempt.name || '')}</b> (${esc(attempt.email || '')}). <a href="admin.html">Back to admin</a></div>`;
    $('#main').prepend(note);
    renderResult(view, { asAdmin: true });
  } catch (err) {
    $('[data-result-loading]').hidden = true;
    $('[data-result-error-text]').textContent = err.message;
    $('[data-result-error]').hidden = false;
  }
})();

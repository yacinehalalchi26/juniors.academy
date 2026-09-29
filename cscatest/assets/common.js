// Small shared helpers.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const fmtDuration = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
export const params = new URLSearchParams(location.search);

export function toast(msg) {
  let el = $('[data-toast]');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.dataset.toast = '';
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-visible'), 4200);
}

export function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));
}

export function clearErrors(scope) {
  $$('[data-error-for]', scope).forEach((el) => { el.textContent = ''; });
  $$('.field.has-error', scope).forEach((el) => el.classList.remove('has-error'));
  const alert = $('[data-form-error]', scope);
  if (alert) alert.hidden = true;
}

export function showErrors(scope, { message, fields = {} }) {
  let first = null;
  let shown = 0;
  for (const [name, msg] of Object.entries(fields)) {
    const slot = $(`[data-error-for="${name}"]`, scope);
    if (!slot) continue;
    shown++;
    slot.textContent = msg;
    const field = slot.closest('.field');
    field?.classList.add('has-error');
    first ||= field?.querySelector('input, select');
  }
  const alert = $('[data-form-error]', scope);
  if (alert && (!shown || message)) {
    alert.textContent = message || 'Check the highlighted fields.';
    alert.hidden = false;
  }
  first?.focus();
}

export const COUNTRIES = ['Algeria', 'Morocco', 'Tunisia', 'Libya', 'Egypt', 'Mauritania', 'Afghanistan', 'Angola', 'Argentina', 'Australia', 'Azerbaijan', 'Bangladesh', 'Benin', 'Bolivia', 'Botswana', 'Brazil', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Chad', 'Chile', 'Colombia', 'Comoros', 'Congo', 'Côte d’Ivoire', 'DR Congo', 'Djibouti', 'Ecuador', 'Eritrea', 'Eswatini', 'Ethiopia', 'France', 'Gabon', 'Gambia', 'Germany', 'Ghana', 'Guinea', 'Guinea-Bissau', 'India', 'Indonesia', 'Iran', 'Iraq', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Lesotho', 'Liberia', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Mauritius', 'Mexico', 'Mongolia', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal', 'Niger', 'Nigeria', 'Oman', 'Pakistan', 'Palestine', 'Peru', 'Philippines', 'Qatar', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Seychelles', 'Sierra Leone', 'Singapore', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe', 'Other'];

export function fillCountries(select) {
  if (!select) return;
  for (const c of COUNTRIES) select.add(new Option(c, c));
}

/** Header, footer and mobile menu. */
export function initChrome() {
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  });
  $$('[data-toggle-password]').forEach((btn) => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  }));
}

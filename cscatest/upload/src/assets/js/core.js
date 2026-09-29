// Shared helpers for every page.
import CONFIG from './config.js';
import backend from './backend.js';

export { CONFIG, backend };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (ms) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDuration = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

// ------------------------------------------------------------------ navigation (relative to the base path)
export const params = new URLSearchParams(location.search);
/** Only allow in-site relative paths like "tests/?type=quick". */
export const safeNext = (n) => (n && !/^[a-z]+:|^\/|\/\/|\\/i.test(n) ? n : null);
export const nextParam = () => safeNext(params.get('next'));
export const here = () => location.pathname.slice(CONFIG.basePath.length) + location.search;
export const withNext = (route, next) => (next ? `${route}?next=${encodeURIComponent(next)}` : route);
export const go = (route) => { location.href = CONFIG.basePath + route; };

// ------------------------------------------------------------------ UI bits
export function toast(msg, tone = '') {
  let el = $('[data-toast]');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.dataset.toast = '';
    document.body.append(el);
  }
  el.textContent = msg;
  el.className = `toast is-visible${tone ? ` toast-${tone}` : ''}`;
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

export function showErrors(scope, err) {
  const fields = err.fields || {};
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
  if (alert && (!shown || !Object.keys(fields).length)) {
    alert.textContent = err.message;
    alert.hidden = false;
  }
  first?.focus();
}

export function wirePasswordToggles() {
  $$('[data-toggle-password]').forEach((btn) => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  }));
}

// ------------------------------------------------------------------ countries and phone numbers
export const COUNTRIES = [
  ['Afghanistan', '93'], ['Albania', '355'], ['Algeria', '213'], ['Angola', '244'], ['Argentina', '54'], ['Armenia', '374'],
  ['Australia', '61'], ['Azerbaijan', '994'], ['Bahrain', '973'], ['Bangladesh', '880'], ['Belarus', '375'], ['Benin', '229'],
  ['Bhutan', '975'], ['Bolivia', '591'], ['Botswana', '267'], ['Brazil', '55'], ['Brunei', '673'], ['Burkina Faso', '226'],
  ['Burundi', '257'], ['Cambodia', '855'], ['Cameroon', '237'], ['Canada', '1'], ['Cape Verde', '238'], ['Central African Republic', '236'],
  ['Chad', '235'], ['Chile', '56'], ['Colombia', '57'], ['Comoros', '269'], ['Congo', '242'], ['Côte d’Ivoire', '225'],
  ['DR Congo', '243'], ['Djibouti', '253'], ['Ecuador', '593'], ['Egypt', '20'], ['Equatorial Guinea', '240'], ['Eritrea', '291'],
  ['Eswatini', '268'], ['Ethiopia', '251'], ['Fiji', '679'], ['France', '33'], ['Gabon', '241'], ['Gambia', '220'],
  ['Georgia', '995'], ['Germany', '49'], ['Ghana', '233'], ['Guinea', '224'], ['Guinea-Bissau', '245'], ['India', '91'],
  ['Indonesia', '62'], ['Iran', '98'], ['Iraq', '964'], ['Italy', '39'], ['Jamaica', '1'], ['Japan', '81'], ['Jordan', '962'],
  ['Kazakhstan', '7'], ['Kenya', '254'], ['Kuwait', '965'], ['Kyrgyzstan', '996'], ['Laos', '856'], ['Lebanon', '961'],
  ['Lesotho', '266'], ['Liberia', '231'], ['Libya', '218'], ['Madagascar', '261'], ['Malawi', '265'], ['Malaysia', '60'],
  ['Maldives', '960'], ['Mali', '223'], ['Mauritania', '222'], ['Mauritius', '230'], ['Mexico', '52'], ['Mongolia', '976'],
  ['Morocco', '212'], ['Mozambique', '258'], ['Myanmar', '95'], ['Namibia', '264'], ['Nepal', '977'], ['New Zealand', '64'],
  ['Niger', '227'], ['Nigeria', '234'], ['Oman', '968'], ['Pakistan', '92'], ['Palestine', '970'], ['Papua New Guinea', '675'],
  ['Peru', '51'], ['Philippines', '63'], ['Poland', '48'], ['Qatar', '974'], ['Russia', '7'], ['Rwanda', '250'],
  ['Saudi Arabia', '966'], ['Senegal', '221'], ['Serbia', '381'], ['Seychelles', '248'], ['Sierra Leone', '232'], ['Singapore', '65'],
  ['Somalia', '252'], ['South Africa', '27'], ['South Korea', '82'], ['South Sudan', '211'], ['Spain', '34'], ['Sri Lanka', '94'],
  ['Sudan', '249'], ['Syria', '963'], ['Tajikistan', '992'], ['Tanzania', '255'], ['Thailand', '66'], ['Timor-Leste', '670'],
  ['Togo', '228'], ['Tunisia', '216'], ['Turkey', '90'], ['Turkmenistan', '993'], ['Uganda', '256'], ['Ukraine', '380'],
  ['United Arab Emirates', '971'], ['United Kingdom', '44'], ['United States', '1'], ['Uzbekistan', '998'], ['Venezuela', '58'],
  ['Vietnam', '84'], ['Yemen', '967'], ['Zambia', '260'], ['Zimbabwe', '263'],
];

export function fillCountrySelects(scope = document) {
  $$('[data-country-select]', scope).forEach((sel) => {
    for (const [name] of COUNTRIES) sel.add(new Option(name, name));
    sel.add(new Option('Other', 'Other'));
    sel.addEventListener('change', () => {
      const dial = $('[data-dial-select]', sel.form);
      const opt = dial && [...dial.options].find((o) => o.dataset.country === sel.value);
      if (opt) dial.value = opt.value;
    });
  });
  $$('[data-dial-select]', scope).forEach((sel) => {
    sel.add(new Option('Code', ''));
    for (const [name, code] of COUNTRIES) {
      const o = new Option(`+${code} ${name}`, code);
      o.dataset.country = name;
      sel.add(o);
    }
  });
}

export function normalizePhone(dialCode, number) {
  const raw = String(number ?? '').trim();
  let e164;
  if (raw.startsWith('+') || raw.startsWith('00')) e164 = '+' + raw.replace(/^00/, '').replace(/\D/g, '');
  else {
    const dial = String(dialCode ?? '').replace(/\D/g, '');
    if (!dial) return null;
    e164 = '+' + dial + raw.replace(/\D/g, '').replace(/^0+/, '');
  }
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

// ------------------------------------------------------------------ header and footer
export async function initChrome() {
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    nav.style.top = `${$('.site-header').getBoundingClientRect().bottom}px`;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  });
  const path = here().split('?')[0];
  $$('.site-nav a').forEach((a) => {
    if (a.getAttribute('href') === path && path) a.setAttribute('aria-current', 'page');
  });

  $$('[data-keep-next]').forEach((a) => a.removeAttribute('data-keep-next'));
  return backend.getUser();
}

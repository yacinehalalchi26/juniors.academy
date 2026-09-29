// Sign-up validation (runs inside Cloud Functions).
import dns from 'node:dns/promises';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'throwawaymail.com', 'fakeinbox.com', 'mintemail.com', 'emailondeck.com', 'moakt.com', 'tempail.com',
  'mohmal.com', 'burnermail.io', 'spamgourmet.com', 'mailnesia.com', 'tempr.email', 'discard.email', 'mailcatch.com',
]);

export const isDisposable = (domain) => DISPOSABLE.has(domain);

/** False only when DNS clearly says the domain can't receive email. */
export async function domainReceivesMail(domain) {
  const timeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), 4000))]);
  const definite = ['ENOTFOUND', 'ENODATA', 'ENONAME'];
  try {
    if ((await timeout(dns.resolveMx(domain))).length) return true;
  } catch (e) {
    if (!definite.includes(e.code)) return true;
  }
  try {
    return (await timeout(dns.resolve4(domain))).length > 0;
  } catch (e) {
    return !definite.includes(e.code);
  }
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

export const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Result email, queued in the Firestore `mail` collection and sent by the
// official "Trigger Email from Firestore" extension.
import { bandFor } from './engine.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INK = '#2A1F33';
const MUTED = '#74697C';
const LINE = '#EAE6ED';
const SEAL = '#7E549F';
const TYPE_COLORS = { 'Quick test': '#8A6100', 'Module test': '#A33B7E', 'Full exam': '#7E549F' };

function layout(preheader, body, siteUrl) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CSCA Test</title></head>
<body style="margin:0;padding:0;background:#F5F6F6;font-family:'Bricolage Grotesque',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F6;padding:40px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:28px 36px 0;">
    <img src="${esc(siteUrl)}assets/img/email-logo.png" width="150" height="30" alt="CSCA Test" style="display:block;border:0;height:auto;">
  </td></tr>
  <tr><td style="padding:32px 36px 36px;font-size:16px;line-height:24px;">${body}</td></tr>
  <tr><td style="padding:20px 36px;border-top:1px solid ${LINE};font-size:12px;line-height:18px;color:${MUTED};">
    <b style="color:${INK};">Powered by Juniors Academy.</b> Tests written by competent teachers and CSCA examiners, together with the Juniors Academy team.<br>
    cscatest.org is an independent practice platform, not affiliated with the official CSCA organisers (csca.cn).
    You received this service email because you have an account. <a href="${esc(siteUrl)}privacy/" style="color:${MUTED};">Privacy policy</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function topicRows(breakdown) {
  return breakdown.map((t) => {
    const weak = t.correct / t.total < 0.5;
    return `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:14px;">${esc(t.topic)}</td>
<td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:14px;text-align:right;white-space:nowrap;color:${weak ? SEAL : INK};">${t.correct} / ${t.total}</td></tr>`;
  }).join('');
}

export function resultEmail({ name, typeName, modules, results, url, siteUrl, submittedAt }) {
  const band = bandFor(results.score);
  const multi = results.sections.length > 1;
  const date = new Date(submittedAt).toUTCString().replace(' GMT', ' UTC');

  const moduleSummary = multi
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">${results.sections.map((s) => `
<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:15px;">${esc(s.name)}</td>
<td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:15px;text-align:right;">${s.score} / 100</td></tr>`).join('')}</table>`
    : '';

  const topics = results.sections.map((s) => `
<div style="font-size:14px;color:${MUTED};margin:32px 0 4px;">${multi ? `${esc(s.name)}, by topic` : 'By topic, weakest first'}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topicRows(s.breakdown)}</table>`).join('');

  const subject = `Your CSCA ${typeName.toLowerCase()} result: ${results.score}/100`;
  const html = layout(
    `You scored ${results.score}/100 on your ${typeName.toLowerCase()} (${modules}).`,
    `<p style="margin:0 0 20px;">Hello ${esc(name)},</p>
<p style="margin:0 0 24px;color:${MUTED};"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${TYPE_COLORS[typeName] || INK};color:#ffffff;font-size:13px;font-weight:bold;">${esc(typeName)}</span>&nbsp; ${esc(modules)}</p>
<div style="font-size:72px;line-height:72px;letter-spacing:-3px;color:${INK};">${results.score}<span style="font-size:20px;letter-spacing:0;color:${MUTED};"> / 100${multi ? ' average' : ''}</span></div>
<div style="font-size:18px;margin-top:12px;">${esc(band.label)}</div>
<div style="font-size:14px;color:${MUTED};margin-top:2px;">${results.correct} of ${results.total} correct</div>
${moduleSummary}
${topics}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>
  <td style="background:${INK};border-radius:999px;"><a href="${esc(url)}" style="display:inline-block;padding:13px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;">Review your answers</a></td>
</tr></table>
<p style="margin:24px 0 0;font-size:12px;color:${MUTED};">Submitted ${esc(date)}. This is a practice score and is not an official CSCA result.</p>`,
    siteUrl,
  );
  const text = `Hello ${name},\n\n${typeName}: ${modules}\nScore: ${results.score}/100 (${band.label}), ${results.correct} of ${results.total} correct.\n\n`
    + results.sections.map((s) => `${s.name}: ${s.score}/100\n` + s.breakdown.map((t) => `  ${t.topic}: ${t.correct}/${t.total}`).join('\n')).join('\n\n')
    + `\n\nReview your answers: ${url}\n\nThis is a practice score and is not an official CSCA result.`;
  return { subject, html, text };
}

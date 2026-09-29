// Builds the static site into ./dist.
//   node build.mjs              production build (needs Firebase web config in site.config.json)
//   MOCK=1 node build.mjs       offline demo build: no Firebase, runs the test engine in the browser
//   BASE_PATH=/ node build.mjs  build for the root of a domain (e.g. cscatest.org)
import fs from 'node:fs';
import path from 'node:path';
import { brand, tile, favicon } from './tools/logo.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const MOCK = process.env.MOCK === '1';
let BASE = process.env.BASE_PATH || cfg.basePath || '/';
if (!BASE.startsWith('/')) BASE = '/' + BASE;
if (!BASE.endsWith('/')) BASE += '/';
// Public URL, for canonical links, Open Graph, the sitemap and structured data.
let SITE_URL = process.env.SITE_URL || cfg.siteUrl || `https://cscatestorg.web.app${BASE}`;
if (!SITE_URL.endsWith('/')) SITE_URL += '/';

if (!MOCK && Object.values(cfg.firebase).some((v) => String(v).includes('PASTE_'))) {
  console.error('site.config.json: paste your Firebase web app config first (Firebase console > Project settings > Your apps).');
  console.error('Or run the offline demo with: npm run dev');
  process.exit(1);
}

const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, BASE);

// route (relative to BASE) -> page template and metadata
const PAGES = [
  { route: '', file: 'home.html', page: 'home', title: 'CSCA Test: free CSCA practice tests online', description: 'Free CSCA practice tests in Mathematics, Physics and Chemistry in the real exam format: 60-minute module tests, full 2–3 hour exams and 15-minute quick tests, with instant scores. Popular with students in Algeria.', jsonld: ['org', 'website', 'faq'] },
  { route: 'csca-algeria/', file: 'algeria.html', page: 'algeria', title: 'CSCA exam in Algeria: guide and free practice tests | CSCA Test', description: 'What the CSCA is, who needs it in Algeria, how to register on csca.cn and how to prepare with free online practice tests in the real format. Guide en français inclus.', jsonld: ['article', 'faq'] },
  { route: 'tests/', file: 'tests.html', page: 'tests', title: 'Choose your CSCA practice test | CSCA Test', description: 'Start a 60-minute module test in Mathematics, Physics or Chemistry, a full CSCA exam of 2 or 3 modules, or a 15-minute quick test. Free, timed, questions change every time.' },
  { route: 'exam/', file: 'exam.html', page: 'exam', title: 'Test in progress | CSCA Test', layout: 'bare', script: 'exam.js', noindex: true },
  { route: 'results/', file: 'results.html', page: 'results', title: 'Your result | CSCA Test', noindex: true },
  { route: 'admin/', file: 'admin.html', page: 'admin', title: 'Admin | CSCA Test', script: 'admin.js', noindex: true, footer: false },
  { route: 'faq/', file: 'faq.html', page: 'faq', title: 'CSCA practice test FAQ: formats, scoring, accounts | CSCA Test', description: 'How CSCA Test works: the 15-minute quick test, 60-minute module test and full exam, scoring out of 100, the inactivity rule, accounts and results.', jsonld: ['faq'] },
  { route: 'terms/', file: 'terms.html', page: 'terms', title: 'Terms of use | CSCA Test', description: 'Terms of use for cscatest.org, operated by Juniors Academy.' },
  { route: 'privacy/', file: 'privacy.html', page: 'privacy', title: 'Privacy policy | CSCA Test', description: 'How Juniors Academy collects, uses and protects your data on cscatest.org.' },
  { route: '404/', file: '404.html', page: '404', title: 'Page not found | CSCA Test', noindex: true },
];

const read = (p) => fs.readFileSync(p, 'utf8');
const partial = (name) => read(path.join(SRC, 'partials', `${name}.html`));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Chinese key-fret (回纹) meander, the site's decorative pattern, fading out from a corner. */
let patternN = 0;
function fret(cls) {
  const id = `fret${++patternN}`;
  const unit = 'M4 28V4h24v18H10V10h12v8h-8v-2.5'; // one 回 spiral per 32-unit cell
  return `<svg class="pattern ${cls}" viewBox="0 0 480 480" aria-hidden="true"><defs>`
    + `<pattern id="${id}" width="32" height="32" patternUnits="userSpaceOnUse"><path d="${unit}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></pattern>`
    + `<radialGradient id="${id}g"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fff" stop-opacity=".55"/><stop offset=".95" stop-color="#000"/></radialGradient>`
    + `<mask id="${id}m"><rect width="480" height="480" fill="url(#${id}g)"/></mask></defs>`
    + `<rect width="480" height="480" fill="url(#${id})" mask="url(#${id}m)"/></svg>`;
}

/** Q&A pairs from <details> blocks, for FAQPage structured data. */
function faqPairs(html) {
  const out = [];
  const re = /<details><summary>([\s\S]*?)<\/summary><div>([\s\S]*?)<\/div><\/details>/g;
  let m;
  while ((m = re.exec(html))) out.push({ q: stripTags(m[1]), a: stripTags(m[2]) });
  return out;
}

function jsonld(p, body) {
  const url = SITE_URL + p.route;
  const blocks = [];
  const org = { '@type': 'Organization', name: 'Juniors Academy', url: 'https://juniors.academy', logo: `${SITE_URL}assets/img/og-image.png` };
  for (const kind of p.jsonld || []) {
    if (kind === 'org') blocks.push({ '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: 'CSCA Test', alternateName: 'cscatest.org', url: SITE_URL, logo: `${SITE_URL}assets/img/og-image.png`, description: p.description, parentOrganization: org, areaServed: ['DZ', 'Worldwide'], email: 'support@cscatest.org' });
    if (kind === 'website') blocks.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'CSCA Test', url: SITE_URL, inLanguage: 'en', publisher: org });
    if (kind === 'article') blocks.push({ '@context': 'https://schema.org', '@type': 'Article', headline: p.title.split(' | ')[0], description: p.description, url, inLanguage: 'en', datePublished: '2026-09-29', dateModified: '2026-09-29', author: org, publisher: org, image: `${SITE_URL}assets/img/og-image.png` });
    if (kind === 'faq') {
      const pairs = faqPairs(body);
      if (pairs.length) blocks.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pairs.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });
    }
  }
  return blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n');
}

function render(p) {
  const body = read(path.join(SRC, 'pages', p.file));
  const bare = p.layout === 'bare';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${BASE}">
<title>${esc(p.title)}</title>
${p.description ? `<meta name="description" content="${esc(p.description)}">` : ''}
${p.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE_URL}${p.route}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="CSCA Test">
<meta property="og:title" content="${esc(p.title)}">
${p.description ? `<meta property="og:description" content="${esc(p.description)}">` : ''}
<meta property="og:url" content="${SITE_URL}${p.route}">
<meta property="og:image" content="${SITE_URL}assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
${p.noindex ? '' : jsonld(p, body)}
<meta name="theme-color" content="#1fb59e">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/BricolageGrotesque-Regular.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="assets/fonts/BricolageGrotesque-Bold.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="assets/css/style.css">
<script type="module" src="assets/js/${p.script || 'app.js'}"></script>
</head>
<body data-page="${p.page}"${bare ? ' class="exam-body"' : ''}>
${bare ? '' : partial('header')}
${body}
${bare || p.footer === false ? '' : partial('footer')}
${MOCK ? '<div class="demo-badge">Demo mode: no Firebase, data stays in this browser</div>' : ''}
</body>
</html>
`;
  // {{SELF}} = this page's own path, for in-page anchors (a <base> tag would otherwise send "#x" to the home page)
  return html.replace(/\{\{PATTERN (\w+)\}\}/g, (_, cls) => fret(cls))
    .replaceAll('{{BRAND}}', brand()).replaceAll('{{SEAL}}', tile({ size: 44 }))
    .replaceAll('{{SELF}}', p.route).replaceAll('{{BASE}}', BASE);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const p of PAGES) {
  const dir = path.join(OUT, p.route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(p));
}
// Firebase Hosting and GitHub Pages look for /404.html at the site root.
fs.writeFileSync(path.join(DIST, '404.html'), render(PAGES.find((p) => p.page === '404')));

// SEO: sitemap for public pages, robots.txt at the site root
const publicPages = PAGES.filter((p) => !p.noindex);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages.map((p) => `  <url><loc>${SITE_URL}${p.route}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>${p.route === '' ? 'weekly' : 'monthly'}</changefreq><priority>${p.route === '' ? '1.0' : p.page === 'tests' || p.page === 'algeria' ? '0.9' : '0.6'}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: ${BASE}admin/
Disallow: ${BASE}exam/
Disallow: ${BASE}results/
Sitemap: ${SITE_URL}sitemap.xml
`);

copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
fs.writeFileSync(path.join(OUT, 'assets', 'img', 'favicon.svg'), favicon());
fs.writeFileSync(
  path.join(OUT, 'assets', 'js', 'config.js'),
  `// Generated by build.mjs. Edit site.config.json instead.\nexport default ${JSON.stringify({ basePath: BASE, region: cfg.region, mock: MOCK, firebase: cfg.firebase }, null, 2)};\n`,
);

if (MOCK) {
  // The demo runs the real test engine in the browser. Never deployed.
  const mockDir = path.join(OUT, 'assets', 'mock');
  fs.mkdirSync(path.join(mockDir, 'questions'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'functions', 'engine.js'), path.join(mockDir, 'engine.js'));
  for (const f of fs.readdirSync(path.join(ROOT, 'functions', 'questions'))) {
    fs.copyFileSync(path.join(ROOT, 'functions', 'questions', f), path.join(mockDir, 'questions', f));
  }
} else {
  fs.rmSync(path.join(OUT, 'assets', 'js', 'backend-mock.js'), { force: true });
}

console.log(`Built ${PAGES.length} pages into dist${BASE} for ${SITE_URL}${MOCK ? ' (demo mode)' : ''}`);

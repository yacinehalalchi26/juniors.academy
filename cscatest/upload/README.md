# cscatest.org

Free CSCA practice tests in Mathematics, Physics and Chemistry, operated by Juniors Academy.
The site is live at **juniors.academy/cscatest** for now and will move to **cscatest.org** later.
It runs on Firebase project **`cscatestorg`**.

## What it does

**Test formats**

| Format | Modules | Questions | Time |
|---|---|---|---|
| Quick test | 1 of the student's choice | 12, spread across all topics | 15 min |
| Module test | 1 | 48 (real exam format) | 60 min |
| Full exam | 2 or 3, back to back | 48 each | 60 min each (2 h or 3 h) |

**Rules**

- **Inactivity:** after 8 minutes with no activity, the student sees a warning. At 10 minutes, the test is cancelled and a red "Test cancelled" notice appears. The server enforces this rule too (every minute), so closing the browser also cancels the test.
- **No accounts.** A student types their name, email and country and the test starts. No password, no email link, no SMS code, nothing to log back into. The browser gets an anonymous Firebase session so the server still owns the answer key and the timers.
- **Results:** shown instantly and emailed through the "Trigger Email" extension.
- **One test at a time.** Unlimited retakes. Questions and options are shuffled for each attempt.
- **Colours:** each format has its own colour everywhere it appears: Module test magenta, Full exam purple, Quick test gold. Deep coral is reserved for errors and cancellations.
- **Admin area** at `/cscatest/admin/`, reached from the small **Admin** link at the bottom of every page. One account only: `director@juniors.academy`.
- **Security:** correct answers never reach the browser before submission. The browser can't read or write Firestore directly; every access goes through Cloud Functions.

## How it's built

```
src/                  static site (HTML templates, CSS, browser JS)
build.mjs             builds src/ into dist/<base path>/  (default /cscatest/)
functions/            Cloud Functions (Node 22)
  engine.js           all test rules: formats, timers, inactivity, grading (unit-tested)
  index.js            callable functions + 1-minute sweeper + account-deletion cleanup
  emails.js           result email
  questions/*.json    question banks (server-side only)
firestore.rules       denies all direct browser access
firebase.json         hosting, functions, firestore config
site.config.json      base path + Firebase web config  <-- you edit this
functions/.env        SITE_URL for links in emails     <-- and this
.github/workflows/    deploy on push to main
```

The site is plain static files, so it can be hosted anywhere. Pages use a `<base href>` and relative links. A page that needs an id takes it as a query parameter, for example `exam/?id=…` or `results/?id=…`.

## Try it locally (no Firebase needed)

```bash
npm run dev          # demo build + server on http://localhost:5173/cscatest/
npm test             # engine tests
```

The demo runs the real test engine in your browser and stores data in localStorage. For the admin area, sign in at `/admin/` with `director@juniors.academy` and the password `demo1234`. To test the inactivity rule quickly, run `localStorage.setItem('csca-demo-idle-ms','20000')` in the browser console.

---

## One-time Firebase setup

Do this in the [Firebase console](https://console.firebase.google.com/project/cscatestorg).

1. **Upgrade to the Blaze plan.** Cloud Functions and scheduled functions require it. Usage at this scale sits mostly within the free allowances. There is no SMS, which removes the main cost risk, but set a budget alert in Google Cloud Billing anyway.
2. **Create the Firestore database.** Go to Build → Firestore Database → Create. Choose production mode and the location `europe-west1` (Belgium), which is close to Algeria. The location can't be changed later. Put the same location in the privacy policy placeholder.
3. **Set up Authentication.** Go to Build → Authentication.
   - **Sign-in method:** enable **Anonymous** (this is what students use, invisibly) and **Email/Password** (for your admin account only). Do **not** enable Phone; the site sends no SMS.
   - **Settings → Authorized domains:** add `juniors.academy`, `cscatest.org` and `www.cscatest.org`. `cscatestorg.web.app` and `localhost` are there by default.
   - **Users → Add user:** create `director@juniors.academy` with a strong password. This is your admin login. There is no sign-up page, so the account can only be created here.
   - **Templates:** set the sender name to "CSCA Test" and edit the password reset email, which is the only one Firebase sends.
4. **Web app config.** This is already done: your web app's config is in **`site.config.json`**. These values are public by design; security comes from the rules and functions. If you ever re-create the web app, paste the new values there.
5. **Install the email extension.** Go to Extensions and install **Trigger Email from Firestore** (`firebase/firestore-send-email`).
   - Location: `europe-west1`.
   - Email documents collection: `mail`.
   - SMTP connection URI: the details from your email provider. Examples: Zoho `smtps://results@cscatest.org@smtp.zoho.eu:465` (password in the secret field), Resend SMTP `smtps://resend@smtp.resend.com:465` with your API key as the password, or Brevo or Google Workspace.
   - Default FROM: `CSCA Test <results@cscatest.org>`.
   - Set up SPF and DKIM for the sending domain as your provider explains, or results will land in spam.
6. **Automatic deletion (TTL).** `firestore.indexes.json` declares TTL policies on `mail.expireAt` and `ratelimits.expireAt`, and `firebase deploy` applies them. Check under Firestore → Time-to-live.

## Deploy from GitHub

1. Push this folder to a GitHub repository.
2. Create a service account for deployment. In [Google Cloud → IAM → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=cscatestorg), create `github-deploy` with these roles:
   - Firebase Admin;
   - Cloud Functions Admin;
   - Service Account User;
   - Cloud Scheduler Admin;
   - Artifact Registry Administrator;
   - Cloud Build Editor;
   - Secret Manager Viewer.

   Or, for simplicity, give it the **Editor** role plus Service Account User. Then create a JSON key for it.
3. In the repository, go to Settings → Secrets and variables → Actions:
   - Secret `FIREBASE_SERVICE_ACCOUNT` = the whole JSON key.
   - Variable `BASE_PATH` = `/cscatest/`. This is optional, since it's the default.
4. Push to `main`. The workflow tests the engine, builds the site, and deploys hosting, functions and Firestore rules and indexes.
   - The first deploy takes a few minutes. It may ask you to enable some Google Cloud APIs; follow the links in the log, then re-run the workflow.
   - After it finishes, the site is at **https://cscatestorg.web.app/cscatest/**.

Don't commit the JSON key. The `.gitignore` excludes `service-account*.json`.

To deploy manually instead:

```bash
npm i -g firebase-tools && firebase login
npm install --prefix functions
npm run deploy
```

## Serving it at juniors.academy/cscatest

Firebase serves the app at `cscatestorg.web.app/cscatest/`. To show it at `juniors.academy/cscatest/`, the host of juniors.academy has to route that path to it. How depends on where juniors.academy is hosted:

- **Cloudflare (DNS proxied).** Add a Worker on route `juniors.academy/cscatest*`:
  ```js
  export default { fetch(req) { const u = new URL(req.url); u.hostname = 'cscatestorg.web.app'; return fetch(new Request(u, req)); } };
  ```
- **Nginx.**
  ```nginx
  location /cscatest/ { proxy_pass https://cscatestorg.web.app/cscatest/; proxy_ssl_server_name on; proxy_set_header Host cscatestorg.web.app; }
  ```
- **Vercel** (`vercel.json`).
  ```json
  { "rewrites": [{ "source": "/cscatest/:path*", "destination": "https://cscatestorg.web.app/cscatest/:path*" }] }
  ```
- **Netlify** (`_redirects`).
  ```
  /cscatest/*  https://cscatestorg.web.app/cscatest/:splat  200
  ```
- **GitHub Pages or any static host.** No proxy is needed. Run `node build.mjs` and copy `dist/cscatest/` into the juniors.academy site as a `cscatest/` folder. Authentication and the functions work from any authorized domain.
- **Firebase Hosting in another project.** Proxying across projects isn't supported, so use the static-copy approach above.

The `functions/.env` file sets `SITE_URL=https://juniors.academy/cscatest/` so that email links point to the right place.

## Moving to cscatest.org later

1. In Firebase Hosting, choose **Add custom domain** and add `cscatest.org`, then set the DNS records it shows. The `cscatest.org` domain is already in Authorized domains.
2. Pick the URL:
   - **Keep `cscatest.org/cscatest/`:** nothing else changes, because the site already redirects `/` to `/cscatest/`.
   - **Use the root, `cscatest.org/`:**
     1. set the GitHub variable `BASE_PATH` to `/`;
     2. delete the `redirects` block in `firebase.json`;
     3. update `SITE_URL` in `functions/.env`;
     4. add a redirect on juniors.academy so that `/cscatest/*` points to `https://cscatest.org/*`.
3. Update "currently available at juniors.academy/cscatest" in the Terms and Privacy pages.

## Firestore data (project cscatestorg)

| Collection | Contents |
|---|---|
| `students/{uid}` | name, email, country, phone, termsVersion, createdAt, plus the question ids already shown to that browser. `{uid}` is the anonymous Firebase session, not an account. |
| `attempts/{id}` | userId, email, name, type (`quick`/`module`/`full`), subjects, status (`in_progress`/`submitted`/`cancelled`), cancelReason (`inactivity`/`user`), current module, sections (questions, option order, answers, flags, start/end times), lastActivityAt, createdAt, submittedAt, results (overall and per-module scores, topics) |
| `mail/{id}` | result emails for the extension (auto-deleted after 30 days) |
| `students/{uid}` (counters) | testsStarted, testsSubmitted, testsCancelled, lastScore, lastTestAt |
| `ratelimits/{hash}` | sign-up and test-start counters (auto-deleted) |

All times are milliseconds since epoch. Firebase Authentication holds only the anonymous student sessions and your admin password.

**Deleting a student** (privacy request): open the admin area, Students tab, search their email and press Delete. That removes their details, every attempt and the anonymous session.

**Useful admin views:** Firestore → `attempts` → filter by `status == cancelled` to see cancellations, and Functions → Logs for errors and the sweeper.

## Admin

**1. Getting in.**
1. `functions/.env` already contains `ADMIN_EMAILS=director@juniors.academy`. Only addresses listed there can open the admin area.
2. Create that account in the Firebase console under Authentication → Users → Add user, with a strong password.
3. On the site, scroll to the bottom of any page and click the small **Admin** link, then sign in.

Students never see a login. If someone finds the admin URL, they get the sign-in card and nothing else.

**2. What admins can do.**
- **Overview:** totals (students, tests, completed, cancelled, in progress now), then by format, by module, the last 14 days, score bands, and the reasons for cancellations.
- **Tests:** every attempt, filtered by status or format.
  - Open any completed result with the full answer review.
  - Cancel a test in progress; the student sees "cancelled by an administrator".
  - Click a student's name to see all their tests.
- **Students:** everyone who has started a test, searchable by exact email or by the start of a name.
  - See each one's email, phone, country, tests taken and last score.
  - Delete a student and all their tests, for example for a privacy request. You must type DELETE to confirm.
- **Questions:** per module, how often each question is answered correctly, hardest first. Use this to find unclear questions or wrong answer keys.
- **CSV export** of students and tests (up to 5,000 rows each), which opens in Excel.

**3. How it's secured.**
- Every admin action is a Cloud Function that checks the caller's signed-in email is listed in `ADMIN_EMAILS`. Changing who is an admin means editing that file and pushing.
- The admin page itself holds no data.
- Admin actions are written to the Functions logs.

In the local demo (`npm run dev`), sign in at `/admin/` with `director@juniors.academy` and the password `demo1234`.

## Design

- **Typeface:** Bricolage Grotesque (bold headings, regular text), self-hosted so it renders the same everywhere, including in China.
- **Colours:** gold `#FFCB3E`, coral `#FB836F`, magenta `#C1549C`, purple `#7E549F`. Magenta and purple are dark enough to carry white text, so they make the hero gradient and the primary buttons; gold and coral are accents. Each has a deepened variant for type on white: gold `#8A6100`, coral `#C4442C`, magenta `#A33B7E`, purple `#6B4189`. Text is plum-tinted ink `#2A1F33`. Formats: Module test magenta, Full exam purple, Quick test gold. Errors and cancellations use the deep coral. A four-colour ribbon under the hero and above the footer shows the whole palette.
- **Pattern:** the Chinese key-fret (回纹) meander, drawn as a fine line pattern that fades out from the corners (`fret()` in `build.mjs`).
- **Home page:** a magenta-to-purple hero with white text, two white cards for the Module test and the Full exam, and the Quick test offered below as "Need a quick check first?".
- **Responsive:** phone, tablet and desktop layouts were checked at 390, 768, 1024 and 1366 px. On phones the menu becomes a full-screen drawer and the exam's question grid becomes a bottom sheet with a sticky Previous / Next bar.

## Questions: how each test is assembled

Each module has a bank of 72 original questions (`functions/questions/*.json`). Every test is built fresh:

1. **Blueprint.** `BLUEPRINT` in `functions/engine.js` gives each topic its share of a paper, following the CSCA syllabus (for example Mechanics is about a quarter of Physics). Quotas are computed for the paper length: 48 for a module test, 12 for a quick test.
2. **Random draw per topic.** Within each topic the questions are drawn at random from the bank.
3. **No repeats while possible.** Each student's recent question ids are stored per module (`users/{uid}.seen`, up to 120 per module). Unseen questions are chosen first; if a topic runs out, the ones seen longest ago come back.
4. **Shuffled order.** Question order and answer order are shuffled on every attempt.

So a student who takes two module tests in a row gets 24 new questions in the second one, and quick tests don't repeat a question until the bank is used up. **To increase variety further, add questions:** append objects to the JSON files in the same format (`id`, `t` topic, `q` text, `o` options, `a` index of the correct option) and push. New topics are picked up automatically.

## SEO

- Every public page has a unique title, meta description, canonical URL, Open Graph tags and a share image (`assets/img/og-image.png`).
- Structured data (JSON-LD): EducationalOrganization and WebSite on the home page, FAQPage on the FAQ, Article on the Algeria guide.
- `sitemap.xml` and `robots.txt` are generated by the build. The robots file must sit at the domain root, so **if juniors.academy is proxied, add these lines to juniors.academy's own `robots.txt`**: `Disallow: /cscatest/admin/`, `/cscatest/exam/`, `/cscatest/results/` and `Sitemap: https://juniors.academy/cscatest/sitemap.xml`.
- A dedicated landing page, `/cscatest/csca-algeria/`, targets searches such as "CSCA Algeria", "CSCA exam", "test CSCA Algérie" and "préparation CSCA", with a French summary for Algerian students.
- `siteUrl` in `site.config.json` drives all absolute URLs. Change it when moving to cscatest.org, then submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Brand

- **Logo:** the wordmark itself, "CSCA" bold plus "Test" regular, set in Bricolage Grotesque. There is no icon. It's rendered as live text (`tools/logo.mjs`), so it stays sharp at any size and always matches the page font.
- **Square icon:** where a square is unavoidable (favicon, phone home screens), the name is stacked two-by-two in white on deep purple. `tile()` in `tools/logo.mjs`.
- **Source:** `tools/logo.mjs`. The build inserts it into every page and writes the favicon.
- **Email logo:** `src/assets/img/email-logo.png` is a PNG copy for emails, because Gmail blocks SVG. Regenerate it if you change the logo.
- **Colours:** see Design above.

## Recommended hardening

- **App Check** with reCAPTCHA Enterprise, enforced on Cloud Functions. Worth adding: with no sign-up step, App Check is the main defence against someone scripting test starts. The site already limits starts per IP address and per session.
- In Google Cloud → APIs & Services → Credentials, restrict the browser API key to HTTP referrers `juniors.academy/*`, `cscatest.org/*` and `cscatestorg.web.app/*`.
- A budget alert on the Cloud Billing account.

## Before launch: legal checklist

1. Replace every highlighted `[placeholder]` in `src/pages/terms.html` and `src/pages/privacy.html`:
   - address and registration number;
   - DPO;
   - ANPDP numbers;
   - Firestore location;
   - email provider.
2. **File the ANPDP declaration** (Law 18-07 as amended by Law 25-11) before collecting data.
3. **Get ANPDP authorisation for transfers abroad.** Firebase stores and processes data outside Algeria.
4. **Appoint a DPO** and put a breach procedure in place (notify the ANPDP within 5 days).
5. Have an Algerian lawyer review the Terms and Privacy policy before launch.
6. Set up the `support@` and `privacy@cscatest.org` mailboxes.

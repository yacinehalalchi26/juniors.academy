# CSCA Test

Free CSCA practice tests (Mathematics, Physics, Chemistry) for Juniors Academy.
A plain static website: **upload these files and it works.** No build step, no Node,
no GitHub Actions. Data is stored in Firebase project **cscatestorg**.

## Files

```
index.html      everything a student sees: the three exams, the details form,
                the test itself and the grade. It all happens on this one page.
result.html     used only by the admin, to open a student's result
admin.html      admin sign-in and dashboard (director@juniors.academy only)
faq.html  terms.html  privacy.html
assets/         style.css, fonts, and the JavaScript
firestore.rules the security rules to paste into the Firebase console
```

## The student flow

Three exams: **Mathematics, Physics and Chemistry**. Each is taken on its own and
graded on its own, 48 questions in 60 minutes, as in the real papers. A student
clicks an exam, enters their name, email and country, presses Start, and the test
opens in the same page: no navigation, no account, no password. When they finish,
the grade replaces the test on the same page and a copy is emailed.

## Put it online (GitHub Pages)

1. Upload everything in this folder to the **cscatest** repository, so that
   `index.html` is at the top level, not inside another folder.
2. In the repository: **Settings → Pages**. Under "Build and deployment", set
   Source to **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
3. After a minute the site is live at **https://juniors.academy/cscatest/**

## Firebase (project cscatestorg)

Three things, all in the console at console.firebase.google.com:

1. **Firestore Database → Create database.** Production mode, location `europe-west1`.
2. **Firestore Database → Rules.** Paste everything from `firestore.rules`, press Publish.
3. **Authentication → Sign-in method.** Enable **Anonymous** (students, invisible to them)
   and **Email/Password** (your admin login). Then **Authentication → Users → Add user**
   and create `director@juniors.academy` with a strong password. That is the only account.
4. **Authentication → Settings → Authorized domains:** add `juniors.academy`.

The free Spark plan is enough. No Blaze plan, no Cloud Functions, no service account.

### Result emails (optional)

Results always appear on screen. To email them too, install the Firebase extension
**Trigger Email from Firestore**: collection `mail`, your SMTP details, and a FROM
address such as `CSCA Test <results@cscatest.org>`. The site writes the email there
automatically. Without the extension the site works fine, minus the email.

## Admin

The small **Admin** link at the bottom of every page opens the sign-in card. Only
`director@juniors.academy` can read the data; this is enforced by the security rules,
not just hidden in the page. You get totals, every test with its score, a student list
and CSV export.

## Adding questions

Open `assets/questions.js` and add objects in the same shape:

```js
{ "id": "m73", "t": "Algebra", "q": "Question text?", "o": ["A","B","C","D"], "a": 0 }
```

`t` is the topic, `o` the options, `a` the index of the correct one (0 = first).
Each module has 72 questions today. More questions means more variety between retakes.

## Good to know

- Each test picks questions by topic quota, avoids the ones this browser has already
  seen, and shuffles the order, so retakes differ.
- A test in progress survives a page refresh: a bar offers to resume or cancel it.
- After 10 minutes without activity a test is cancelled and not scored.
- Because there is no server, the questions and answers are in the page. A determined
  student could read them with developer tools. That is the trade-off for a site with
  no backend, and it is normal for free practice tests.
- Before launch, fill in the highlighted placeholders in `terms.html` and
  `privacy.html`, and have an Algerian lawyer review them (Law 18-07 as amended).

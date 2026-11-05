# Managing and reviewing questions

Questions live in the database and are managed at **`/admin`** (D-025). You can add a question,
copy one into a new question, mark a draft reviewed, and archive a question. There is no editing
and no deleting: the database itself refuses both.

- **Added:** every new question starts as a **draft** and records when it was added.
- **Reviewed:** production (`REQUIRE_REVIEWED_QUESTIONS=true`) asks only reviewed questions.
  Marking reviewed records the time and can't be undone; to withdraw a question, archive it.
- **Archived:** no longer asked or answerable; records when. Answers already given are kept and
  stay in each person's history and profile, marked "Question retired".
- **To change wording:** open the question, choose **Copy**, edit the copy, and leave "Archive the
  original" checked. The copy records which question it came from. People who answered the
  original will be asked the new version, because it is a different question.

Locally `REQUIRE_REVIEWED_QUESTIONS=false`, so drafts are asked too while you work.

## Setting up the admin password

Admin pages are off (404) until `ADMIN_PASSWORD_HASH` is set.

1. Run `npm run admin:password`. It prints a random password and its hash.
2. Save the password in your password manager.
3. Put the `ADMIN_PASSWORD_HASH=...` line in `.env` (local) or `/opt/political-views/.env`
   (server), and restart the app. The hash never goes in git.
4. Sign in at `/admin`. Sessions last 12 hours (`ADMIN_SESSION_HOURS`). After 10 wrong passwords
   in 15 minutes, sign-in pauses for everyone until the window passes.

## Review checklist

Read each draft against this before marking it reviewed:

- The prompt is neutral: no loaded words, no assumed answer, no framing that favors a side.
- The choices cover the reasonable positions people actually hold, both ends and the middle.
- Each choice is worded as its supporters would word it, at a similar length and tone.
- Choices are distinct; none is a straw man or a better-sounding version of another.
- Single vs. multi-select fits: one scale is single choice; independent approaches are
  multi-select.
- Choices marked "can't be combined" really can't be combined with the others.
- Each choice reads as a belief on its own, because it becomes a suggested belief in the profile.
- Plain language (about 8th-grade reading level), no unexplained jargon or acronyms.

## Who should review

The PRD asks for a human review, ideally by a politically diverse panel. At minimum, ask one
reader who leans differently from you to read the drafts; disagreements about wording are the
useful part. The app's credibility depends on users of every leaning finding the questions fair.

## Already flagged for extra care

- Transgender-specific policy questions (roadmap ticket 13) are not written yet; each needs its own
  especially careful review.
- Abortion, firearms, immigration and race-related questions draw the strongest reactions to
  wording; read them aloud and compare choice lengths and tone.

## The starting set

`prisma/seed-data.ts` holds the starting questions. Seeding (`npm run db:seed`, or `deploy.sh seed`
on the server) inserts any of them whose slug is missing, as drafts, and never changes or re-adds
existing ones, archived ones included. After the first seed, `/admin` is where questions change.

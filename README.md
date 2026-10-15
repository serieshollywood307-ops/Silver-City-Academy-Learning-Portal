# Silver City Academy Learning Portal

Mobile-friendly Classes 9–12 student portal using the Manus-managed web server and database. The current task is limited to a Cloud Preview; it does **not** publish the app or push source to the user's separate GitHub repository.

## Features

- Public student sections for study resources, original sample learning packs, an NCERT book catalogue, CBSE syllabus references, on-demand original chapter notes, randomized quizzes, local planner, cited GK/current-affairs summaries and school-attributed faculty details.
- The study shelf filters starter packs and approved staff resources by class and subject, with chapter/title search; the notes request independently selects class, subject, book and chapter/topic.
- Official NCERT PDF/book links remain on NCERT's site; this project does not mirror or re-upload those PDFs. NCERT licence and source attribution appear in the UI.
- Students can request chapter notes without providing a name, email or account. Notes are generated server-side with the built-in Manus model, validated, cached by class/subject/book/chapter, and shown as shared educational material. Generation is rate-limited.
- Teacher sign-in uses a Manus identity. A normal account remains `user`; an owner-issued high-entropy invite is redeemed once during signup, stored as a hash, and expires after seven days. After redemption, the teacher role belongs to that account until the owner revokes it. The invite is not a login token.
- Teachers and the portal owner can upload validated PDF school resources to managed storage. Files are drafts until owner approval; only published files appear in the student library. Archiving hides metadata and does not physically erase cloud bytes.
- Only the owner can issue/revoke invites, revoke teacher roles and publish current-affairs drafts.
- Planner tasks, schedule and quiz history are local to the browser.

## Cloud setup

The Cloud WebDev project has the managed server and database enabled. The portal owner email is a protected project setting (`PORTAL_OWNER_EMAIL`); values are not in code or repository. On first sign-in, the server assigns the `admin` role only to the authenticated Manus account with the matching email. Do not add owner values to chat, front-end configuration, source or logs.

Schema changes are in the Drizzle migration directory. Development and any later published instance share this managed database. Do not create throwaway user/invite/upload records as acceptance-test data.

## Project commands

```bash
pnpm check
pnpm db:push
pnpm dev
```

The route declaration at `client/public/manus-routes.json` lists the student homepage and staff signup/dashboard routes.

## Research and content notes

- `client/src/data/ncert-catalog.json`: dated filtered NCERT selector snapshot with official catalogue links only. Availability and prescribed editions can change, so use the visible review date and advisory.
- `client/src/data/gk.json` and `gk-expanded.json`: source-attributed facts and current-affairs snapshot. Forecasts should be labelled; the page clearly states this is not a live news feed.
- `client/src/data/faculty.json`: names/roles published on the school site, with source and review date. It is not guaranteed to be a complete/current staffing list.
- `data-source-notes.md`: provenance, coverage and source notes used for curation.

The learning content is educational support, not official CBSE material or a substitute for school-prescribed textbooks/syllabus. Teacher-uploaded files must be authorised for sharing.

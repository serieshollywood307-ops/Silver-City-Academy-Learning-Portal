# Silver City Academy Learning Portal — Implementation Plan

## 1. Maqsad aur approved scope

Classes 9–12 ke students ke liye ek responsive, mobile-first learning portal banana hai. Is cloud project ka title **Silver City Academy Learning Portal** rahega. Existing static demo ka approved visual style, content aur interactions React/Express/Drizzle full-stack project mein port aur improve honge.

Portal mein yeh outcomes honge:

- Classes 9–12 ke liye subject/chapter learning resources, original notes, worksheets aur practice questions.
- Search/filter wali NCERT catalogue. Textbook/PDF ke liye NCERT ke official page/download links use honge; PDFs ko local ya portal storage mein mirror nahi kiya jayega jab tak reuse ki permission confirm na ho.
- CBSE 2026–27 official curriculum links, NCERT ki kitab-transition advisory aur attribution/licence notices.
- Har quiz play par question/option order shuffle karke alag attempt; answer explanation aur score. Public student practice ke liye account zaruri nahi; planner aur score student ke apne device/browser mein hi rahenge.
- Class, subject aur chapter chun kar notes request. Built-in Manus AI original, structured study notes generate karega (key ideas, terms, examples, revision points); generated notes database mein shared resource ke roop mein cache honge. Book text ki copying/paraphrasing nahi hogi; request form student ka naam/email collect nahi karega. Server request limits aur validation rakhega.
- Bahut se source-linked evergreen GK facts aur date/source ke saath current-affairs cards. Roz ka GK card curated bank se rotate hoga. Current-affairs item publish karne se pehle authorised teacher/owner date aur credible source link dega; portal unreviewed AI/live-news ko apne-aap fact ke roop mein publish nahi karega.
- School website par published faculty directory, source aur review date ke saath; school ke role/subject assignments ko provisional note ke saath dikhaya jayega aur school se confirm karna hoga.
- Sirf authorised teachers aur owner ke liye file upload/organisation dashboard. Uploads server-side role check ke baad managed object storage mein jayenge; teacher draft aur student-facing published materials alag rahenge.
- Developer intro/preloader aur footer mein **Shivansh Goswami**, chhota creator bio, mobile/tablet/desktop layout, keyboard access aur reduced-motion support.

## 2. Identity, signup aur authorisation

- Manus OAuth starter flow se account sign-in hoga. Signed-in normal visitor ko `user` role milega—signin ya signup apne-aap kisi ko teacher nahi banayega. Student/public learning pages aur notes request bina account ke chalenge.
- Portal owner ko pehli baar identify karne ke liye protected project input `PORTAL_OWNER_EMAIL` lagega. Email sirf platform ke secure input card mein diya jayega; chat, code, logs ya repository mein nahi. Manus sign-in ke verified profile se match hone ke baad owner ko `admin` role milega; role application database mein persist hoga.
- Admin teacher invitation generate karega. Random high-entropy code issue hote waqt ek hi baar plaintext dikhaya/copy kiya ja sakega; database mein keval SHA-256 hash, expiry aur redemption metadata hoga. Unused invite 7 din baad expire hoga. Signup par redemption ko transaction mein single-use mark karke us account ko `teacher` role diya jayega. Redeem hone ke baad wahi code dobara nahi chalega; teacher role tab tak rahega jab tak owner account revoke na kare.
- Invite banana, redeem karna, role dena, files upload/manage karna aur roles revoke karna backend par `admin`/`teacher` procedures se enforce hoga—sirf UI hide karna security control nahi hoga.
- Teacher ko alag reusable bearer-token se login nahi karaya jayega: invite sirf pehli signup ke liye hai; baad ki login Manus identity se hogi. Isse invite leak hone par kisi ko lifetime bearer credential nahi milta.

## 3. Data aur backend architecture

Project ka existing React 19/Vite + Express/tRPC + Drizzle/MySQL starter use hoga. `server:true`, `database:true` aur built-in AI effective hain; platform object storage stable file addresses deta hai.

Drizzle schema/migrations mein yeh application records rahenge:

- Users aur role/revocation state.
- Hashed, expiring, single-redemption teacher invitations.
- Portal resources: class, subject, chapter, content type, publication status, source/edition metadata aur uploader.
- AI-generated chapter notes aur generation/cache metadata.
- Teacher-uploaded files ke object key/metadata aur draft/published status.
- GK/current-affairs entries ke category, published date, source link aur review status.

Public read procedures sirf published learning content expose karengi. `teacherProcedure` aur `adminProcedure` backend mein current database role check karenge. File upload mein role/type/size validation pehle hogi, phir presigned upload; object key database mein save hoga. Draft file public nahi hogi; published resource hi students ko milega. Runtime storage ka physical deletion contract limited hai, isliye UI sirf hide/archive ki guarantee degi—storage object ke physical erase ka vaada nahi.

AI notes ke liye server-side built-in `invokeLLM` use hoga; secret browser mein nahi jayega. Request ko canonical class/subject/chapter tak bound rakhna, output structure/length validate karna, timeout/error state sambhalna aur duplicate requests ko cached note se serve karna hoga. Student personal identity note request ke saath persist nahi hogi.

## 4. Existing content aur source policy

Current portal mein 170 dated official NCERT catalogue links, 11 school-published staff entries, 60 source-linked GK facts aur 11 dated current-affairs examples hain. Source review date **14 October 2026** hai; current-affairs pages par date/source visible honge, aur badal sakne wali jankari ko live guarantee nahi dikhaya jayega. Existing source evidence `data-source-notes.md` mein documented hai.

NCERT ke official textbook/CBSE pages link targets honge, NCERT copyright/licence notice visible rahega. Portal notes/quizzes original learning aids ke roop mein likhe jayenge, official syllabus ya textbook chapter ka substitute claim nahi karenge. Faculty data school ke public source se hai—ye exhaustive/current appointment list hone ka claim nahi karega.

## 5. Design direction (approved demo ko continue karte hue)

- **Design movement:** Contemporary editorial schoolhouse—shaant, student-friendly, content-first learning portal.
- **Core principles:** (1) Class/chapter discovery turant samajh aaye; (2) source/licence/status hamesha visible ho; (3) padhne aur quiz karne ke flows chhote hon; (4) pehle phone par achchha chale, phir large screen par expand ho.
- **Colour philosophy:** Maujooda deep navy `#17385f` bharosa aur structure ke liye; teal `#21847e` active learning/actions ke liye; warm paper `#fffdf9` aur cream `#fbf7ef` lambe reading ke liye; gold `#efbb58` chhote emphasis aur book-spine highlights ke liye. Contrast WCAG-friendly rakhenge.
- **Layout paradigm:** Existing split hero aur CSS book/notebook illustration; uske baad left-aligned editorial section headings, class chooser, filterable book/resource shelves, ek focused quiz column aur compact date-stamped GK/current-affairs strip. Teacher management alag restrained dashboard layout hoga; generic card-grid har section par force nahi hoga.
- **Signature elements:** Open-book wordmark; stacked navy/teal/gold book-spine accents; source/date ko pin-note jaisi visible treatment.
- **Interaction philosophy:** Search/filter turant feedback dein; quiz ek waqt mein ek clear question dikhaye; saved/generated content status samajh aaye; upload/request errors field ke paas batayein. Mobile controls bade touch targets rakhenge.
- **Animation:** Shivansh Goswami credit wala ek chhota, skippable intro; short fades/hover lifts sirf zaruri jagah; `prefers-reduced-motion` par animation band. Quiz/AI generation mein visible loading state aur retryable error hoga; long/blocking spinner nahi.
- **Typography:** Body/UI ke liye existing Inter/system sans; large editorial headings ke liye isi family ka strong weight/tight hierarchy; occasional quote/notebook accent ke liye Georgia, existing prototype ke mutabik.
- **Brand essence:** “Silver City Academy students ke liye ek trusted, chapter-wise study space jo official book links ko original practice aur GK se jodta hai.” Personality: clear, curious, dependable.
- **Brand voice:** Short, encouraging aur seedha; official material ko official tabhi kahega jab source ho. Example lines: “Choose a class. Find your next chapter.” / “Study one idea, then try it yourself.”
- **Wordmark/logo:** Existing custom open-book mark ke saath “Learning Portal” wordmark aur chhota “Silver City Academy” label; default text-only logo nahi.
- **Signature brand colour:** Deep navy `#17385f`, teal ko action/accent ke liye saath rakhenge.

## 6. Project structure

- `client/src/pages/Home.tsx` — public portal, class discovery, catalogue, notes request, quiz, planner aur GK sections.
- `client/src/pages/StaffAccess.tsx` — Manus sign-in ke baad invite signup, teacher upload/editorial workspace aur owner controls.
- `client/src/data/` — filtered NCERT catalogue, school-published faculty, GK facts/current-affairs snapshots aur source metadata.
- `server/routers.ts` — public reads aur feature routers ka entry point.
- `server/modules/staff.ts` — hashed invites, redemption, teacher directory management aur owner-only role controls.
- `server/modules/staffContent.ts` — role-protected PDF upload lifecycle, draft/publish/archive aur current-affairs editorial workflow.
- `server/modules/notes.ts`, `quizzes.ts`, `portal.ts` — validated cached AI notes, randomized quizzes aur student-facing feed.
- `server/db.ts`, `drizzle/schema.ts`, `drizzle/` — managed MySQL persistence, queries aur additive migration.
- `shared/quiz-bank.json` aur `sample-resources.json` — original practice bank aur chapter-wise starter materials.
- `client/public/manus-routes.json` — user-facing routes ka platform route manifest; APIs/assets isme nahi.
- `plan.md`, `TODO.md` aur `README.md` — implementation decisions, required outcomes, run/source/hosting notes.

## 7. Development, review aur release boundary

Pehle project diagnostics register honge; routes ke final set ke saath static `manus-routes.json` banega; uske baad full-stack process port 3000 par start hoga. Existing feature content ko React pages/data modules mein migrate karke additive Drizzle migrations ke saath backend routers banenge. Development, tests aur future published runtime ek hi managed database use karte hain; isliye schema/data tests non-destructive honge, koi dummy teacher/student account ya dummy file upload shared database mein nahi banega.

Pehle stable WebDev Preview par phone/desktop ke liye demo diya jayega. Is approval mein user ke `serieshollywood307-ops/Shivansh-Goswami-` GitHub repository par push ya permanent/public publish shamil nahi hai. User ke review aur alag instruction tak dono nahi honge.

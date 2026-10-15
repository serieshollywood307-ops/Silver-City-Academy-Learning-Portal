import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, ExternalLink, FileText, GraduationCap, Search, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import catalogue from "../data/ncert-catalog.json";
import faculty from "../data/faculty.json";
import gkSeed from "../data/gk.json";
import expandedGk from "../data/gk-expanded.json";
import studyPacks from "../../../shared/sample-resources.json";
import "../portal-base.css";

type Book = (typeof catalogue.books)[number];
type Fact = (typeof gkSeed.facts)[number] | (typeof expandedGk.facts)[number];
type CalendarItem = { eventDate: string; topic: string; title: string; summary: string; sourceTitle: string; sourceUrl: string };
type StudyPack = (typeof studyPacks)[number];
type QuizQuestion = { id: string; topic: string; prompt: string; options: string[]; correctIndex: number; explanation: string };
const classLabels: Record<string, string> = { "class-9": "Class 9", "class-10": "Class 10", "class-11": "Class 11", "class-12": "Class 12" };
const classKeys = Object.keys(classLabels);
const books = catalogue.books as Book[];
const allFacts = [...gkSeed.facts, ...expandedGk.facts] as Fact[];
const topicButtons = ["All topics", ...Array.from(new Set(allFacts.map(fact => fact.topic)))];
const dayNumber = (date: Date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
const safeRead = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const safeWrite = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing/quota */ } };
const relativeDate = (date: Date | string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

function BookIllustration() {
  return <div className="hero-art" role="img" aria-label="An illustrated stack of study books and a notebook">
    <div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <div className="art-plant" aria-hidden="true"><i /><i /><i /><i /><span /></div>
    <div className="art-book-stack" aria-hidden="true"><div className="book book-blue"><span>LEARN</span><b /></div><div className="book book-teal"><span>EXPLORE</span><b /></div><div className="book book-gold"><span>GROW</span><b /></div></div>
    <div className="art-notebook" aria-hidden="true"><span className="spiral" /><strong>Small steps<br />every day.</strong><small>YOUR NEXT IDEA</small></div>
    <div className="art-pencil pencil-one" aria-hidden="true" /><div className="art-pencil pencil-two" aria-hidden="true" />
    <span className="art-caption caption-top">Curiosity lives here</span><span className="art-caption caption-bottom">Make learning yours</span>
  </div>;
}

export default function Home() {
  const [introVisible, setIntroVisible] = useState(() => {
    try { return sessionStorage.getItem("sca-intro-seen") !== "1" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookClass, setBookClass] = useState("all");
  const [bookSubject, setBookSubject] = useState("all");
  const [booksExpanded, setBooksExpanded] = useState(false);
  const [factSearch, setFactSearch] = useState("");
  const [factTopic, setFactTopic] = useState("all");
  const [factIndex, setFactIndex] = useState(() => Math.abs(dayNumber(new Date()) % allFacts.length));
  const [classKey, setClassKey] = useState("class-9");
  const [noteSubject, setNoteSubject] = useState("");
  const [noteBookTitle, setNoteBookTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteFeedback, setNoteFeedback] = useState("");
  const [menuFilter, setMenuFilter] = useState("All classes");
  const [materialSubject, setMaterialSubject] = useState("all");
  const [materialSearch, setMaterialSearch] = useState("");
  const [quizTopic, setQuizTopic] = useState("All topics");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizMessage, setQuizMessage] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; subject: string; dueDate: string; done: boolean }>>(() => safeRead("sca-homework-v1", []));
  const [timetable, setTimetable] = useState<Record<string, string>>(() => safeRead("sca-timetable-v1", {}));
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("Science");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");

  const utils = trpc.useUtils();
  const latestNotesQuery = trpc.notes.latest.useQuery(undefined, { retry: false });
  const portalQuery = trpc.portal.feed.useQuery(undefined, { retry: false });
  const notesMutation = trpc.notes.generate.useMutation({
    onSuccess: result => {
      setNoteText(result.note.markdown);
      setNoteFeedback(result.cached ? "These chapter notes were already available in the shared portal." : "Original chapter notes generated and saved for students.");
      setChapter(result.note.chapter);
      void utils.notes.latest.invalidate();
      void utils.portal.recentNotes.invalidate();
    },
    onError: error => setNoteFeedback(error.message || "Notes could not be generated. Please try again."),
  });
  const quizMutation = trpc.quizzes.create.useMutation();
  const currentBooks = useMemo(() => books.filter(book => book.classKey === classKey), [classKey]);
  const subjectOptions = useMemo(() => Array.from(new Set(currentBooks.map(book => book.subject))).sort((a, b) => a.localeCompare(b)), [currentBooks]);
  const noteBooks = useMemo(() => currentBooks.filter(book => !noteSubject || book.subject === noteSubject), [currentBooks, noteSubject]);
  const bookSubjects = useMemo(() => Array.from(new Set(books.filter(book => bookClass === "all" || book.classKey === bookClass).map(book => book.subject))).sort((a, b) => a.localeCompare(b)), [bookClass]);
  const filteredBooks = useMemo(() => books.filter(book =>
    (bookClass === "all" || book.classKey === bookClass) &&
    (bookSubject === "all" || book.subject === bookSubject) &&
    `${book.subject} ${book.title} ${book.classLabel}`.toLowerCase().includes(bookSearch.trim().toLowerCase()),
  ), [bookClass, bookSubject, bookSearch]);
  const visibleBooks = filteredBooks.slice(0, booksExpanded ? filteredBooks.length : 15);
  const selectedFact = allFacts[factIndex % allFacts.length];
  const factMatches = useMemo(() => allFacts.filter(fact => {
    const matchesTopic = factTopic === "all" || fact.topic === factTopic;
    const matchesSearch = `${fact.topic} ${fact.title} ${fact.copy}`.toLowerCase().includes(factSearch.trim().toLowerCase());
    return matchesTopic && matchesSearch;
  }), [factSearch, factTopic]);
  const mergedAffairs = useMemo(() => {
    const backendItems = portalQuery.data?.currentAffairs ?? [];
    const seen = new Set(backendItems.map(item => item.sourceUrl));
    const seededItems: CalendarItem[] = gkSeed.currentAffairs
      .filter(item => !seen.has(item.sourceUrl))
      .map(({ date, ...item }) => ({ ...item, eventDate: date }));
    return [...backendItems, ...seededItems]
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate)).slice(0, 20) as CalendarItem[];
  }, [portalQuery.data]);
  const materialSubjects = useMemo(() => {
    const packSubjects = (studyPacks as StudyPack[]).filter(pack => menuFilter === "All classes" || pack.classLabel === menuFilter).map(pack => pack.subject);
    const uploadSubjects = (portalQuery.data?.uploads ?? []).filter(item => menuFilter === "All classes" || classLabels[item.classKey] === menuFilter).map(item => item.subject);
    return Array.from(new Set([...packSubjects, ...uploadSubjects])).sort((a, b) => a.localeCompare(b));
  }, [menuFilter, portalQuery.data]);
  const materialSearchQuery = materialSearch.trim().toLowerCase();
  const matchesMaterial = (subject: string, chapterTitle: string, extra = "") =>
    (materialSubject === "all" || subject === materialSubject) &&
    `${subject} ${chapterTitle} ${extra}`.toLowerCase().includes(materialSearchQuery);
  const visibleStudyPacks = useMemo(() => (studyPacks as StudyPack[]).filter(pack =>
    (menuFilter === "All classes" || pack.classLabel === menuFilter) && matchesMaterial(pack.subject, pack.chapter, `${pack.title} ${pack.summary}`),
  ), [menuFilter, materialSubject, materialSearchQuery]);
  const visibleUploads = useMemo(() => (portalQuery.data?.uploads ?? []).filter(item =>
    (menuFilter === "All classes" || classLabels[item.classKey] === menuFilter) && matchesMaterial(item.subject, item.chapter, item.title),
  ), [portalQuery.data, menuFilter, materialSubject, materialSearchQuery]);
  const currentQuestion = questions[questionIndex];
  const quizScore = safeRead<Record<string, number>>("sca-quiz-scores-v1", {});

  useEffect(() => {
    if (!introVisible) return;
    const timer = window.setTimeout(() => dismissIntro(), 1600);
    return () => window.clearTimeout(timer);
  }, [introVisible]);
  useEffect(() => { setMaterialSubject("all"); setMaterialSearch(""); }, [menuFilter]);
  useEffect(() => safeWrite("sca-homework-v1", tasks), [tasks]);
  useEffect(() => safeWrite("sca-timetable-v1", timetable), [timetable]);
  useEffect(() => {
    if (!subjectOptions.includes(noteSubject)) setNoteSubject(subjectOptions[0] ?? "");
  }, [subjectOptions, noteSubject]);
  useEffect(() => {
    if (!noteBooks.some(book => book.title === noteBookTitle)) setNoteBookTitle(noteBooks[0]?.title ?? "");
  }, [noteBooks, noteBookTitle]);

  function dismissIntro() {
    setIntroVisible(false);
    try { sessionStorage.setItem("sca-intro-seen", "1"); } catch { /* optional preference */ }
  }
  async function startQuiz() {
    setQuizLoading(true); setQuizMessage(""); setChoice(null); setQuizFinished(false); setCorrectCount(0);
    try {
      const recentQuestionIds = safeRead<string[]>(`sca-recent-quiz-${quizTopic}`, []);
      const data = await quizMutation.mutateAsync({ topic: quizTopic as "All topics" | "Science" | "History" | "Geography" | "India & World" | "Mathematics", recentQuestionIds });
      setQuestions(data);
      setQuestionIndex(0);
      if (!data.length) setQuizMessage("There are no questions for this topic yet.");
    } catch {
      setQuizMessage("The quiz could not load. Check your connection and try again.");
    } finally { setQuizLoading(false); }
  }
  function submitAnswer(index: number) {
    if (!currentQuestion || choice !== null) return;
    setChoice(index);
    if (index === currentQuestion.correctIndex) setCorrectCount(value => value + 1);
  }
  function advanceQuiz() {
    if (!currentQuestion) return;
    if (questionIndex + 1 >= questions.length) {
      const score = correctCount;
      setQuizFinished(true);
      const key = quizTopic;
      safeWrite("sca-quiz-scores-v1", { ...quizScore, [key]: Math.max(quizScore[key] ?? 0, score) });
      const prior = safeRead<string[]>(`sca-recent-quiz-${key}`, []);
      safeWrite(`sca-recent-quiz-${key}`, [...new Set([...prior, ...questions.map(question => question.id)])].slice(-35));
      return;
    }
    setQuestionIndex(value => value + 1); setChoice(null);
  }
  function submitNotes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNoteText(""); setNoteFeedback("");
    if (!classKey || !noteSubject || !noteBookTitle || chapter.trim().length < 2) {
      setNoteFeedback("Choose the class, subject and book, then enter a chapter or topic."); return;
    }
    notesMutation.mutate({ classKey: classKey as "class-9" | "class-10" | "class-11" | "class-12", subject: noteSubject, bookTitle: noteBookTitle, chapter: chapter.trim() });
  }
  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;
    setTasks(items => [{ id: crypto.randomUUID(), title: taskTitle.trim(), subject: taskSubject, dueDate: taskDueDate, done: false }, ...items]);
    setTaskTitle(""); setScheduleMessage("Task saved on this device.");
  }
  function saveTimetable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); safeWrite("sca-timetable-v1", timetable); setScheduleMessage("Weekly plan saved on this device.");
  }
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const classHref = (_key: string) => "#materials";
  const latestNotes = latestNotesQuery.data ?? [];
  const totalQuestionCount = safeRead<number>("sca-total-quiz-count-v1", 0);

  return <>
    {introVisible && <div className="developer-preloader" role="status" aria-live="polite"><span className="preloader-mark" aria-hidden="true">✦</span><p>Silver City Academy<br /><strong>Learning Portal</strong></p><span className="preloader-line" aria-hidden="true" /><small>Developer <strong>Shivansh Goswami</strong></small><button type="button" onClick={dismissIntro}>Skip intro</button></div>}
    <div className="topline"><div className="container topline-inner"><span>Silver City Academy <span className="topline-separator">/</span> Student learning portal</span><span className="prototype-label"><span className="status-dot" /> Preview · content checked 14 Oct 2026</span></div></div>
    <header className="site-header"><div className="container nav-wrap">
      <a className="brand" href="#home" aria-label="Silver City Academy Learning Portal home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M7 10.5c6.3-2.2 12.1-1.4 17 2.1v26c-4.9-3.5-10.7-4.3-17-2.1v-26Z" fill="currentColor" opacity=".16"/><path d="M41 10.5c-6.3-2.2-12.1-1.4-17 2.1v26c6.3-2.2 10.7-4.3 17-2.1v-26Z" fill="currentColor" opacity=".28"/><path d="M7 10.5c6.3-2.2 12.1-1.4 17 2.1v26c-4.9-3.5-10.7-4.3-17-2.1v-26ZM41 10.5c-6.3-2.2-12.1-1.4-17 2.1v26c6.3-2.2 10.7-4.3 17-2.1v-26Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/></svg></span><span className="brand-copy"><strong>Learning Portal</strong><small>Silver City Academy</small></span></a>
      <button className="menu-toggle" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-controls="primary-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><span /><span /><span /></button>
      <nav id="primary-nav" className={`nav-links ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation" onClick={() => setMenuOpen(false)}>{[["Home", "#home"], ["Classes", "#classes"], ["Books", "#books"], ["CBSE syllabus", "#syllabus"], ["Study shelf", "#materials"], ["Request notes", "#notes-request"], ["GK", "#general-knowledge"], ["Teachers", "#faculty"], ["Planner", "#planner"]].map(([label, href]) => <a key={href} className="nav-link" href={href}>{label}</a>)}</nav>
      <a className="nav-cta" href="/staff/signup">Staff access <ArrowRight size={15} /></a>
    </div></header>

    <main>
      <section className="hero container" id="home"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-mark" /> A STUDY SPACE FOR CURIOUS MINDS</p><h1>Learn. Explore.<br /><em>Grow.</em></h1><p className="hero-description">Chapter-wise study help, official book links, quick practice, and a little daily curiosity—all in one friendly place.</p><div className="hero-actions"><a className="button button-primary" href="#classes">Explore classes <ArrowRight size={16} /></a><a className="button button-secondary" href="#books">Browse NCERT books <ExternalLink size={15} /></a></div><ul className="hero-highlights"><li><span className="check-mark"><Check size={12} /></span> Classes 9–12</li><li><span className="check-mark"><Check size={12} /></span> Original notes & practice</li><li><span className="check-mark"><Check size={12} /></span> Planner & sourced GK</li></ul></div><BookIllustration /></section>
      <section className="quick-stats container" aria-label="Learning portal highlights"><div className="quick-stat"><span className="stat-icon stat-icon-teal">01</span><span><strong>Pick your class</strong><small>Explore notes by subject & chapter</small></span></div><div className="quick-stat"><span className="stat-icon stat-icon-gold">02</span><span><strong>Practice as you learn</strong><small>Quizzes, original questions & explanations</small></span></div><div className="quick-stat"><span className="stat-icon stat-icon-blue">03</span><span><strong>Plan your week</strong><small>Keep homework in one checklist</small></span></div></section>

      <section className="section classes-section" id="classes"><div className="container"><div className="section-heading section-heading-row"><div><p className="eyebrow">YOUR LEARNING, YOUR PACE</p><h2>Choose your class</h2><p className="section-intro">Open a class shelf for chapter notes, questions, and printable practice.</p></div><a className="text-link" href="#materials">See the study shelf <ArrowRight size={15} /></a></div><div className="class-grid">{classKeys.map((key, index) => <a key={key} className={`class-card ${["class-card-mint", "class-card-cream", "class-card-blue", "class-card-lilac"][index]}`} href={classHref(key)} onClick={() => { setClassKey(key); setMenuFilter(classLabels[key]); }}><span className="class-icon"><BookOpen size={30} /></span><span className="class-card-copy"><small>BUILD YOUR NEXT STEP</small><strong>{classLabels[key]}</strong><span>Subjects · Chapters · Practice</span></span><span className="card-arrow">↗</span></a>)}</div></div></section>

      <section className="section books-section" id="books"><div className="container"><div className="section-heading section-heading-row"><div><p className="eyebrow">OFFICIAL NCERT CATALOG</p><h2>Books & chapter PDFs</h2><p className="section-intro">Search official NCERT editions currently listed for Classes 9–12. Open a book’s NCERT page for chapter PDFs and complete-book links.</p></div><span className="catalog-date-badge">Checked 14 Oct 2026</span></div><div className="catalog-source-note"><span className="approval-icon"><ExternalLink size={13} /></span><span>Files stay on NCERT’s site—we do not mirror textbook PDFs. NCERT owns its e-content; follow its <a href={catalogue.license} target="_blank" rel="noopener noreferrer">official licence terms</a> for any reuse or redistribution.</span></div><div className="catalog-filter-bar"><label className="search-box"><Search size={18} /><input type="search" aria-label="Search NCERT books" value={bookSearch} onChange={event => { setBookSearch(event.target.value); setBooksExpanded(false); }} placeholder="Search book titles or subjects…" /></label><label className="select-wrap"><span>Class</span><select value={bookClass} onChange={event => { setBookClass(event.target.value); setBookSubject("all"); setBooksExpanded(false); }}><option value="all">All classes</option>{classKeys.map(key => <option key={key} value={key}>{classLabels[key]}</option>)}</select></label><label className="select-wrap"><span>Subject</span><select value={bookSubject} onChange={event => setBookSubject(event.target.value)}><option value="all">All subjects</option>{bookSubjects.map(subject => <option key={subject}>{subject}</option>)}</select></label><button className="reset-button" type="button" onClick={() => { setBookClass("all"); setBookSubject("all"); setBookSearch(""); setBooksExpanded(false); }}>Reset</button></div><p className="results-meta" aria-live="polite">{filteredBooks.length} official book pages</p><div className="catalog-grid">{visibleBooks.map((book, index) => <article key={`${book.classKey}-${book.subject}-${book.title}-${index}`} className="catalog-card"><span className="resource-badge">{book.classLabel}</span><p className="catalog-subject">{book.subject}</p><h3>{book.title}</h3><a className="text-link" href={book.officialUrl} target="_blank" rel="noopener noreferrer">Open NCERT book page <ExternalLink size={14} /></a></article>)}</div>{filteredBooks.length > visibleBooks.length && <button className="button button-secondary catalog-more" onClick={() => setBooksExpanded(true)}>Show all {filteredBooks.length} books <ChevronDown size={15} /></button>}{!filteredBooks.length && <div className="catalog-empty"><strong>No books match that search.</strong><p>Try another class, subject or title.</p></div>}<p className="catalog-footnote">This is a dated snapshot of the NCERT selector. Availability can change; confirm the school’s prescribed edition and subject combination.</p></div></section>

      <section className="section syllabus-section" id="syllabus"><div className="container"><div className="section-heading section-heading-row"><div><p className="eyebrow">CURRENT BOARD REFERENCE</p><h2>CBSE curriculum · 2026–27</h2><p className="section-intro">Open CBSE’s official subject curriculum and syllabus portal.</p></div><span className="curriculum-stamp">Official source · 2026–27</span></div><div className="syllabus-grid">{classKeys.map((key, index) => <a className="syllabus-card" key={key} href="https://cbseacademic.nic.in/curriculum_2027.html" target="_blank" rel="noopener noreferrer"><span>{["IX", "X", "XI", "XII"][index]}</span><strong>{classLabels[key]}</strong><small>Official curriculum and syllabus ↗</small></a>)}</div><div className="transition-note"><strong>NCERT textbook transition</strong><span>NCERT’s March 2026 advisory says new Class 9 books are for 2026–27; current Class 10 and 11 books continue for 2026–27, with new books planned from 2027–28. Always confirm your prescribed edition.</span><a href="https://ncert.nic.in/pdf/announcement/notices/Advisory_ncertbooks.pdf" target="_blank" rel="noopener noreferrer">Read NCERT advisory ↗</a></div></div></section>

      <section className="section materials-section" id="materials"><div className="container"><div className="section-heading"><p className="eyebrow">THE RESOURCE SHELF</p><h2>Notes, practice & learning resources</h2><p className="section-intro">Filter by class, subject, or chapter. Explore original starter notes, practice questions, and print-ready worksheets.</p></div><div className="filter-bar"><label className="select-wrap"><span>Class</span><select value={menuFilter} onChange={event => setMenuFilter(event.target.value)}><option>All classes</option>{classKeys.map(key => <option key={key}>{classLabels[key]}</option>)}</select></label><label className="select-wrap"><span>Subject</span><select value={materialSubject} onChange={event => setMaterialSubject(event.target.value)}><option value="all">All subjects</option>{materialSubjects.map(subject => <option key={subject}>{subject}</option>)}</select></label><label className="search-box"><Search size={18} /><input type="search" aria-label="Search chapters or resources" value={materialSearch} onChange={event => setMaterialSearch(event.target.value)} placeholder="Search chapter or title…" /></label><a className="button button-secondary" href="#notes-request">Request chapter notes <ArrowRight size={15} /></a></div><div className="resource-intro-note"><span className="approval-icon"><Check size={14} /></span><span><strong>Original study aids:</strong> demo learning packs are independently written, not a substitute for current board materials.</span></div><p className="results-meta" aria-live="polite">Showing {visibleStudyPacks.length} learning packs for these filters · request any missing chapter below.</p>{!visibleStudyPacks.length && <p className="resource-empty" role="status">No learning packs match these filters. Try another class, subject, or chapter.</p>}<div className="resource-grid">{visibleStudyPacks.map((pack, index) => <article className="resource-card" key={`${pack.classLabel}-${pack.subject}-${pack.chapter}-${index}`}><div className="resource-topline"><span className="resource-badge">{pack.classLabel}</span><span>{pack.subject}</span></div><h3>{pack.chapter}</h3><p className="resource-chapter">{pack.title}</p><p>{pack.summary}</p><details className="resource-details"><summary>Open notes & practice</summary><p>{pack.description}</p><p><strong>Key point:</strong> {pack.keyPoint}</p>{pack.questions.map((question, n) => <div className="practice-question" key={n}><strong>{question.q}</strong><p className="answer-text">{question.a}</p></div>)}<button className="button button-secondary" type="button" onClick={() => window.print()}>Print this pack</button></details></article>)}</div><div className="published-files"><h3>Teacher-approved school resources</h3><p>Only files approved by portal staff appear here.</p>{portalQuery.isLoading ? <p>Checking approved resources…</p> : visibleUploads.length ? visibleUploads.map(file => <a key={file.id} className="published-file" href={file.url} target="_blank" rel="noopener noreferrer"><span><strong>{file.title}</strong><small>{classLabels[file.classKey] ?? file.classKey} · {file.subject} · {file.chapter} · {Math.max(1, Math.round(file.byteSize / 1024))} KB</small></span><FileText size={18} /></a>) : <p>{(portalQuery.data?.uploads.length ?? 0) ? "No teacher-approved uploads match these filters." : "No approved teacher uploads yet. Files uploaded by staff stay private until the portal owner approves them."}</p>}</div><p className="resource-footnote">Ask for a missing chapter below; AI-generated notes are saved as shared study resources after validation.</p></div></section>

      <section className="section notes-request-section" id="notes-request"><div className="container request-layout"><div className="request-intro"><p className="eyebrow">NEED A CHAPTER EXPLAINED?</p><h2>Request original study notes</h2><p>Choose an NCERT book and enter a chapter title. The portal creates a structured explanation in original language, then makes the result available as a shared learning resource.</p><div className="request-demo-note"><strong>No account needed</strong><span>Your name, email, or phone number is not requested. Notes are cached for other students; please enter only a chapter/topic label.</span></div><p className="original-content-note">Notes are educational aids, not a replacement for textbooks or the current school syllabus. Copyrighted book text is not reproduced.</p><div className="recent-notes"><h3>Recently requested notes</h3>{latestNotesQuery.isLoading ? <p>Loading the notes shelf…</p> : latestNotes.length ? latestNotes.slice(0, 6).map(note => <a key={note.id} href="#note-result" onClick={() => { setClassKey(note.classKey); setNoteSubject(note.subject); setNoteBookTitle(note.bookTitle); setChapter(note.chapter); setNoteText(note.markdown); setNoteFeedback("Opened saved chapter notes."); }}><strong>{note.chapter}</strong><span>{classLabels[note.classKey] ?? note.classKey} · {note.subject}</span></a>) : <p>Be the first to request a chapter explanation.</p>}</div></div><div className="request-card"><h3>Request notes for a chapter</h3><form className="notes-request-form" onSubmit={submitNotes}><div className="form-row"><label>Class<select required value={classKey} onChange={event => { setClassKey(event.target.value); setNoteSubject(""); setNoteBookTitle(""); }}><option value="class-9">Class 9</option><option value="class-10">Class 10</option><option value="class-11">Class 11</option><option value="class-12">Class 12</option></select></label><label>Subject<select required value={noteSubject} onChange={event => { setNoteSubject(event.target.value); setNoteBookTitle(""); }}><option value="">Choose subject</option>{subjectOptions.map(subject => <option key={subject}>{subject}</option>)}</select></label></div><label>NCERT book<select required value={noteBookTitle} onChange={event => setNoteBookTitle(event.target.value)}><option value="">Choose a book</option>{noteBooks.map((book, index) => <option key={`${book.title}-${index}`} value={book.title}>{book.title}</option>)}</select></label><label>Chapter or topic<input required minLength={2} maxLength={180} value={chapter} onChange={event => setChapter(event.target.value)} placeholder="Type the chapter or curriculum topic" /></label><button className="button button-primary" type="submit" disabled={notesMutation.isPending || !noteBookTitle}>{notesMutation.isPending ? "Creating original notes…" : "Generate chapter notes"} <Sparkles size={15} /></button><p className="request-feedback" role="status" aria-live="polite">{noteFeedback || "Structured notes include key ideas, terms, examples, revision points and self-check questions."}</p></form>{noteText && <article id="note-result" className="generated-note"><div><span className="eyebrow">ORIGINAL CHAPTER NOTES</span><button type="button" className="reset-button" onClick={() => window.print()}>Print notes</button></div><h3>{chapter}</h3><div className="generated-note-copy">{noteText}</div></article>}</div></div></section>

      <section className="section practice-section" id="practice"><div className="container practice-layout"><div className="practice-copy"><p className="eyebrow">PRACTICE MAKES PROGRESS</p><h2>A quick quiz, with the why behind every answer.</h2><p>Each start selects a fresh, randomized five-question set from the chosen topic whenever the question pool allows. Your scores and recent questions stay in this browser.</p><div className="score-strip"><span className="score-medal">✦</span><span><strong>Best: {quizScore[quizTopic] ?? "not played yet"}{typeof quizScore[quizTopic] === "number" ? " / 5" : ""}</strong><small>Stored only on this device</small></span></div><label className="quiz-topic-label">Choose a topic<select value={quizTopic} onChange={event => { setQuizTopic(event.target.value); setQuestions([]); setQuizFinished(false); }}><option>All topics</option><option>Science</option><option>Mathematics</option><option>Geography</option><option>History</option><option>India & World</option></select></label><button type="button" className="button button-primary start-quiz-button" onClick={startQuiz} disabled={quizLoading}>{quizLoading ? "Creating a new set…" : questions.length ? "Start a different quiz" : "Start a random quiz"} <ArrowRight size={15} /></button>{quizMessage && <p role="status">{quizMessage}</p>}</div><div className="quiz-card"><div className="quiz-topline"><span className="quiz-icon">?</span><span>QUICK KNOWLEDGE CHECK</span><span className="quiz-step">{quizFinished ? "Complete" : questions.length ? `${questionIndex + 1} / ${questions.length}` : "Ready"}</span></div>{quizFinished ? <div className="quiz-result"><h3>Nice work!</h3><p>Your score: <strong>{correctCount} / {questions.length}</strong></p><p>Start again for a fresh, shuffled set.</p><button className="button button-primary" onClick={startQuiz}>Play another quiz</button></div> : currentQuestion ? <><h3>{currentQuestion.prompt}</h3><div className="quiz-options">{currentQuestion.options.map((option, index) => <button className={`quiz-option ${choice !== null && index === currentQuestion.correctIndex ? "is-correct" : ""} ${choice === index && index !== currentQuestion.correctIndex ? "is-incorrect" : ""}`} key={`${currentQuestion.id}-${option}`} onClick={() => submitAnswer(index)} disabled={choice !== null}>{option}</button>)}</div>{choice !== null && <><p className="quiz-feedback">{choice === currentQuestion.correctIndex ? "Correct! " : "Not quite. "}{currentQuestion.explanation}</p><button className="button button-primary quiz-next" onClick={advanceQuiz}>{questionIndex + 1 === questions.length ? "See your score" : "Next question"} <ArrowRight size={15} /></button></>}</> : <div className="quiz-placeholder"><p>Choose a topic, then start a quiz. Answers and explanations appear after each choice.</p></div>}<p className="quiz-footnote">Questions are original practice samples; check the latest prescribed syllabus.</p></div></div></section>

      <section className="section curiosity-section" id="general-knowledge"><div className="container"><div className="section-heading gk-heading"><p className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p><h2>General Knowledge for everyone</h2><p className="section-intro">Explore 60 source-linked facts in science, history, geography, India, world affairs, culture and sports.</p></div><div className="gk-grid"><article className="daily-fact-card"><div className="gk-card-kicker"><span className="fact-spark">✳</span><span>DAILY GK · REVIEWED FACT</span></div><p className="fact-date">Daily selection · {relativeDate(new Date())}</p><h3>{selectedFact.title}</h3><p>{selectedFact.copy}</p><span className="gk-topic-chip">{selectedFact.topic}</span><div className="fact-actions"><a href={selectedFact.sourceUrl} target="_blank" rel="noopener noreferrer">{selectedFact.sourceTitle} ↗</a><button type="button" className="subtle-button" onClick={() => setFactIndex(index => (index + 1) % allFacts.length)}>Show another fact ↻</button></div></article><article className="current-affairs-card"><div className="current-card-top"><span className="news-icon">▤</span><span className="live-badge"><i /> SOURCE-LINKED</span></div><p className="eyebrow">CURRENT AFFAIRS DESK</p><h3>News worth learning from.</h3><p>Read concise, dated summaries with a link to the original primary source. This is a reviewed snapshot, not a live news feed.</p><div className="source-reminder"><strong>Reviewed through 14 Oct 2026</strong><span>Forecasts are labelled as forecasts; check the source for the latest position.</span></div><a className="text-link" href="#current-feed">Browse dated updates <ArrowRight size={14} /></a></article></div><div className="gk-library"><div className="gk-library-heading"><div><p className="eyebrow">QUICK FACTS, TRUSTED SOURCES</p><h3>Explore the GK library</h3></div><label className="gk-search-label">Search facts<input type="search" value={factSearch} onChange={event => setFactSearch(event.target.value)} placeholder="Try ‘Parliament’ or ‘water cycle’" /></label></div><div className="gk-filter-row" aria-label="Filter GK topics">{topicButtons.map((topic, index) => <button key={topic} className={(factTopic === "all" ? index === 0 : factTopic === topic) ? "is-active" : ""} type="button" onClick={() => setFactTopic(index === 0 ? "all" : topic)}>{topic}</button>)}</div><p className="gk-fact-count" role="status">Showing {factMatches.length} of {allFacts.length} verified facts</p><div className="gk-fact-grid">{factMatches.map(fact => <article className="gk-fact" key={"id" in fact ? fact.id : fact.title}><span className="gk-topic-chip">{fact.topic}</span><h4>{fact.title}</h4><p>{fact.copy}</p><a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">Source: {fact.sourceTitle} ↗</a></article>)}{!factMatches.length && <p>No facts match that search. Try another topic.</p>}</div></div><div className="current-feed" id="current-feed"><h3>Dated current-affairs reading list</h3>{mergedAffairs.map(item => <article className="current-item" key={`${item.eventDate}-${item.sourceUrl}`}><span className="current-item-date">{relativeDate(item.eventDate)} · {item.topic}</span><h4>{item.title}</h4><p>{item.summary}</p><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceTitle} ↗</a></article>)}</div></div></section>

      <section className="section faculty-section" id="faculty"><div className="container"><div className="section-heading section-heading-row"><div><p className="eyebrow">PUBLISHED SCHOOL DIRECTORY</p><h2>Meet the teaching team</h2><p className="section-intro">Names and subject or role descriptions as published by Silver City Academy.</p></div><span className="catalog-date-badge">Checked {faculty.reviewedOn}</span></div><p className="faculty-caveat">{faculty.notice}</p><div className="faculty-grid">{faculty.teachers.map(teacher => <article className="faculty-card" key={teacher.name}><span className="faculty-avatar"><GraduationCap size={20} /></span><div><h3>{teacher.name}</h3><p>{teacher.subjects.join(" · ")}</p></div></article>)}</div><a className="text-link faculty-source" href={faculty.sourceUrl} target="_blank" rel="noopener noreferrer">Verify details on the school website <ExternalLink size={14} /></a></div></section>

      <section className="section planner-section" id="planner"><div className="container"><div className="section-heading section-heading-row"><div><p className="eyebrow">A PLAN THAT FEELS DOABLE</p><h2>Your study planner</h2><p className="section-intro">Add homework and sketch a weekly routine. It stays in this browser, not in a cloud profile.</p></div><span className="local-save-badge"><span className="local-dot" /> Saved on this device</span></div><div className="planner-grid"><article className="planner-panel"><div className="panel-heading"><span className="panel-icon panel-icon-teal">✓</span><div><h3>Homework checklist</h3><p>Small tasks, one at a time.</p></div></div><form className="task-form" onSubmit={addTask}><label>What do you need to do?<input maxLength={100} required value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="e.g. Revise chapter 3" /></label><div className="form-row"><label>Subject<select value={taskSubject} onChange={event => setTaskSubject(event.target.value)}>{["Science", "Mathematics", "English", "Social Science", "Other"].map(subject => <option key={subject}>{subject}</option>)}</select></label><label>Due date<input required type="date" value={taskDueDate} onChange={event => setTaskDueDate(event.target.value)} /></label></div><button className="button button-primary" type="submit">Add to checklist +</button></form><p className="task-summary">{tasks.filter(task => !task.done).length} tasks remaining</p><ul className="task-list">{tasks.map(task => <li className={`task-item ${task.done ? "is-done" : ""}`} key={task.id}><input type="checkbox" checked={task.done} aria-label={`Mark ${task.title} ${task.done ? "not done" : "done"}`} onChange={() => setTasks(items => items.map(item => item.id === task.id ? { ...item, done: !item.done } : item))} /><span className="task-copy"><strong>{task.title}</strong><small>{task.subject} · Due {relativeDate(task.dueDate)}</small></span><button className="task-remove" type="button" aria-label={`Remove ${task.title}`} onClick={() => setTasks(items => items.filter(item => item.id !== task.id))}>×</button></li>)}</ul>{!tasks.length && <p className="task-empty">Your list is clear. Add one task to get started.</p>}</article><article className="planner-panel"><div className="panel-heading"><span className="panel-icon panel-icon-gold">◷</span><div><h3>Weekly study timetable</h3><p>Write a simple focus for each day.</p></div></div><form className="timetable-form" onSubmit={saveTimetable}><div className="timetable-grid">{days.map(day => <label className="day-plan" key={day}>{day}<input maxLength={80} value={timetable[day] ?? ""} onChange={event => setTimetable(value => ({ ...value, [day]: event.target.value }))} placeholder="Study focus" /></label>)}</div><button className="button button-secondary" type="submit">Save weekly plan ✓</button></form><span className="save-feedback" role="status">{scheduleMessage}</span></article></div><p className="planner-privacy-note">No account or cloud sync. Planner items are stored in this browser’s local storage; clearing browser data will remove them.</p></div></section>

      <section className="section teacher-section" id="teacher-tools"><div className="container teacher-layout"><div className="teacher-intro"><p className="eyebrow">RESTRICTED SCHOOL STAFF AREA</p><h2>Teacher tools belong behind a real sign-in.</h2><p>Only school-approved teacher accounts and the portal owner can upload learning resources or manage reviewed current affairs.</p><div className="teacher-safety"><strong>Teacher invitations are single-use</strong><span>An owner-issued code is required for staff signup. The code is not a reusable login token; your staff role remains on your signed-in account until the owner revokes it.</span></div></div><div className="teacher-form-card locked-access-card"><div className="teacher-form-heading"><span className="teacher-icon">⌑</span><div><h3>Staff access</h3><p>Teacher invite · Manus sign-in</p></div></div><div className="lock-message"><span>🔒</span><div><strong>Access is checked by the cloud server</strong><p>Students can study without an account. Staff must sign in and use an unredeemed teacher invite; only verified teacher/owner roles can upload files.</p></div></div><a href="/staff/signup" className="button button-primary">Teacher signup / sign in <ArrowRight size={15} /></a><div className="upload-policy"><strong>Uploads: verified teachers and portal owner only</strong><span>PDFs are stored in managed cloud storage. Teacher drafts are not public until the owner approves them.</span></div></div></div></section>

      <section className="section about-section" id="about"><div className="container about-panel"><div className="about-mark">✦</div><div className="about-copy"><p className="eyebrow">MADE FOR LEARNING, BUILT TO GROW</p><h2>One helpful place for the next question.</h2><p>Silver City Academy Learning Portal connects official book links with independently written practice, chapter notes and sourced General Knowledge for Classes 9–12.</p></div><a className="button button-light" href="#materials">Explore the study shelf <ArrowRight size={15} /></a></div><div className="container demo-note"><strong>Content note</strong><span>NCERT pages remain on NCERT’s site. Notes and practice are original educational aids—not official board documents or a substitute for prescribed resources.</span></div></section>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><a className="brand brand-footer" href="#home"><span className="brand-mark"><BookOpen size={32} /></span><span className="brand-copy"><strong>Learning Portal</strong><small>Silver City Academy</small></span></a><div className="developer-credit"><strong>Developer · Shivansh Goswami</strong><span>A student-built learning space bringing useful study resources, original chapter help, and daily curiosity together.</span></div><span className="footer-copy">© Silver City Academy · Preview</span></div></footer>
  </>;
}

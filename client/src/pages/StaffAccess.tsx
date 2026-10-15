import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Copy, FileText, FileUp, KeyRound, Loader2, LogOut, Plus, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import catalogue from "../data/ncert-catalog.json";

const relativeDate = (date: Date | string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="staff-app"><header className="staff-bar"><Link href="/" className="text-link"><ArrowLeft size={16} /> Student portal</Link><span className="brand-copy"><strong>Silver City Academy</strong><small>Protected staff area</small></span></header>{children}<footer className="staff-foot">Staff access · protected by server-side account roles</footer></main>;
}

function SignInCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return <section className="staff-card sign-in-card"><span className="staff-icon"><ShieldCheck size={25} /></span><p className="eyebrow">MANUS ACCOUNT SIGN-IN</p><h1>{title}</h1><p>Your account proves your identity. A sign-in by itself does not grant teacher or upload permissions.</p>{children}<button className="button button-primary" onClick={() => startLogin()}>Sign in with Manus <ArrowLeft className="arrow-forward" size={16} /></button></section>;
}

export default function StaffAccess() {
  const [path] = useLocation();
  const isSignup = path === "/staff/signup";
  const auth = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [issuedInvite, setIssuedInvite] = useState<{ id: number; token: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadClass, setUploadClass] = useState("class-9");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadChapter, setUploadChapter] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [affairDate, setAffairDate] = useState(new Date().toISOString().slice(0, 10));
  const [affairTopic, setAffairTopic] = useState("");
  const [affairTitle, setAffairTitle] = useState("");
  const [affairSummary, setAffairSummary] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [affairStatus, setAffairStatus] = useState("");

  const utils = trpc.useUtils();
  const redeem = trpc.staff.redeemInvite.useMutation({ onSuccess: () => { setInviteStatus("Teacher signup is complete. Your account now has teacher access."); setInviteCode(""); void auth.refresh(); } });
  const issue = trpc.staff.issueInvite.useMutation({ onSuccess: value => { setIssuedInvite(value); void utils.staff.listInvites.invalidate(); } });
  const revokeInvite = trpc.staff.revokeInvite.useMutation({ onSuccess: () => void utils.staff.listInvites.invalidate() });
  const revokeTeacher = trpc.staff.revokeTeacher.useMutation({ onSuccess: () => void utils.staff.listTeachers.invalidate() });
  const publishFile = trpc.staffContent.publishUpload.useMutation({ onSuccess: () => void utils.staffContent.myUploads.invalidate() });
  const archiveFile = trpc.staffContent.archiveUpload.useMutation({ onSuccess: () => void utils.staffContent.myUploads.invalidate() });
  const setAffair = trpc.staffContent.setCurrentAffairStatus.useMutation({ onSuccess: () => { void utils.staffContent.myCurrentAffairs.invalidate(); void utils.portal.feed.invalidate(); } });
  const createAffair = trpc.staffContent.createCurrentAffair.useMutation({ onSuccess: () => { setAffairStatus("Saved as a draft. An owner must review it before students can see it."); setAffairTitle(""); setAffairSummary(""); setSourceTitle(""); setSourceUrl(""); setAffairTopic(""); void utils.staffContent.myCurrentAffairs.invalidate(); } });
  const invites = trpc.staff.listInvites.useQuery(undefined, { enabled: auth.user?.role === "admin", retry: false });
  const teachers = trpc.staff.listTeachers.useQuery(undefined, { enabled: auth.user?.role === "admin", retry: false });
  const uploads = trpc.staffContent.myUploads.useQuery(undefined, { enabled: auth.user?.role === "teacher" || auth.user?.role === "admin", retry: false });
  const affairs = trpc.staffContent.myCurrentAffairs.useQuery(undefined, { enabled: auth.user?.role === "teacher" || auth.user?.role === "admin", retry: false });
  const beginUpload = trpc.staffContent.beginUpload.useMutation();
  const completeUpload = trpc.staffContent.completeUpload.useMutation({ onSuccess: () => { setUploadStatus("File uploaded as a private draft. The owner can approve it for students."); setSelectedFile(null); setUploadTitle(""); setUploadChapter(""); void utils.staffContent.myUploads.invalidate(); } });

  if (auth.loading) return <PageFrame><section className="staff-card"><Loader2 className="animate-spin" /> Checking your sign-in…</section></PageFrame>;
  if (!auth.isAuthenticated) return <PageFrame><SignInCard title={isSignup ? "Create your teacher account" : "Sign in to staff tools"}>{isSignup && <p>Sign in with the same Manus account you will use as a teacher, then enter the single-use invitation supplied by the portal owner.</p>}</SignInCard></PageFrame>;

  if (isSignup) {
    if (auth.user?.role === "teacher" || auth.user?.role === "admin") return <PageFrame><section className="staff-card sign-in-card"><span className="staff-icon"><Check size={24} /></span><p className="eyebrow">STAFF ACCOUNT ACTIVE</p><h1>You already have {auth.user.role} access.</h1><p>Your role is attached to this signed-in account. The teacher invitation is not needed again.</p><Link className="button button-primary" href="/staff">Open staff dashboard <ArrowLeft className="arrow-forward" size={16} /></Link></section></PageFrame>;
    return <PageFrame><section className="staff-card sign-in-card"><span className="staff-icon"><KeyRound size={25} /></span><p className="eyebrow">ONE-TIME TEACHER INVITATION</p><h1>Complete teacher signup</h1><p>This code is issued by the portal owner, can be redeemed once, and expires in seven days. After signup, sign in with your Manus account—not the invitation code.</p><form className="staff-form" onSubmit={event => { event.preventDefault(); setInviteStatus(""); redeem.mutate({ token: inviteCode.trim() }); }}><label>Teacher invitation<input autoComplete="one-time-code" minLength={20} maxLength={100} required value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="SCA-…" /></label><button className="button button-primary" disabled={redeem.isPending}>{redeem.isPending ? "Checking invitation…" : "Redeem invitation and sign up"} <Check size={15} /></button><p role="status" className="form-feedback">{redeem.error?.message || inviteStatus}</p></form><button className="button button-secondary" onClick={() => void auth.logout()}>Sign out</button></section></PageFrame>;
  }

  if (auth.user?.role !== "teacher" && auth.user?.role !== "admin") return <PageFrame><section className="staff-card sign-in-card"><span className="staff-icon"><KeyRound size={24} /></span><p className="eyebrow">STUDENT/VISITOR ACCOUNT</p><h1>This account has no staff role.</h1><p>Only an owner-issued invitation can grant teacher access. Normal signup and sign-in never make an account a teacher.</p><Link className="button button-primary" href="/staff/signup">Redeem a teacher invitation</Link><button className="button button-secondary" onClick={() => void auth.logout()}>Sign out</button></section></PageFrame>;

  const isAdmin = auth.user.role === "admin";
  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploadStatus("");
    if (!selectedFile) { setUploadStatus("Choose a PDF file first."); return; }
    if (selectedFile.type !== "application/pdf" || !selectedFile.name.toLowerCase().endsWith(".pdf")) { setUploadStatus("Only PDF files are accepted."); return; }
    if (selectedFile.size > 25 * 1024 * 1024) { setUploadStatus("The maximum file size is 25 MB."); return; }
    try {
      const target = await beginUpload.mutateAsync({ classKey: uploadClass as "class-9" | "class-10" | "class-11" | "class-12", subject: uploadSubject, title: uploadTitle.trim(), chapter: uploadChapter.trim(), fileName: selectedFile.name, mimeType: "application/pdf", byteSize: selectedFile.size });
      const response = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: selectedFile });
      if (!response.ok) throw new Error("File transfer failed. Check your connection and start the upload again.");
      await completeUpload.mutateAsync({ objectKey: target.objectKey });
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed. Please retry.");
    }
  }
  const busy = beginUpload.isPending || completeUpload.isPending;
  const subjectOptions = Array.from(new Set(catalogue.books.filter(book => book.classKey === uploadClass).map(book => book.subject))).sort();

  return <PageFrame><div className="staff-dashboard"><div className="staff-dashboard-head"><div><p className="eyebrow">SIGNED IN AS {isAdmin ? "PORTAL OWNER" : "TEACHER"}</p><h1>Staff workspace</h1><p>{auth.user.name || "School staff"} · {auth.user.email || "Manus account"}</p></div><button className="button button-secondary" onClick={() => void auth.logout()}><LogOut size={15} /> Sign out</button></div>
    {isAdmin && <section className="staff-panel"><div className="staff-panel-heading"><span className="staff-icon"><KeyRound size={20} /></span><div><h2>Teacher signup invitations</h2><p>Only you can create and revoke teacher invites.</p></div></div><button className="button button-primary" onClick={() => { setIssuedInvite(null); setCopied(false); issue.mutate(); }} disabled={issue.isPending}><Plus size={15} /> {issue.isPending ? "Creating one-time code…" : "Create single-use invite"}</button>{issue.error && <p role="alert" className="form-feedback">{issue.error.message}</p>}{issuedInvite && <div className="issued-token"><strong>Copy this code now. It will not be shown again.</strong><code>{issuedInvite.token}</code><p>Expires {relativeDate(issuedInvite.expiresAt)} · one signup only</p><button className="button button-secondary" onClick={() => { void navigator.clipboard?.writeText(issuedInvite.token); setCopied(true); }}><Copy size={14} /> {copied ? "Copied" : "Copy invitation"}</button></div>}<h3>Invite history (codes are not stored or shown)</h3>{invites.data?.map(item => <div className="staff-row" key={item.id}><span>Issued {relativeDate(item.createdAt)} · expires {relativeDate(item.expiresAt)} · {item.redeemedAt ? "redeemed" : item.revokedAt ? "revoked" : new Date(item.expiresAt) < new Date() ? "expired" : "available"}</span>{!item.redeemedAt && !item.revokedAt && <button className="reset-button" onClick={() => revokeInvite.mutate({ id: item.id })}>Revoke</button>}</div>)}<h3>Teacher accounts</h3>{teachers.data?.map(teacher => <div className="staff-row" key={teacher.id}><span>{teacher.name || "Teacher"} · {teacher.email}</span><button className="reset-button" onClick={() => { if (window.confirm("Revoke this teacher’s portal role? Their Manus account will remain, but staff tools will be disabled.")) revokeTeacher.mutate({ userId: teacher.id }); }}>Revoke staff role</button></div>)}</section>}

    <div className="staff-grid"><section className="staff-panel"><div className="staff-panel-heading"><span className="staff-icon"><FileUp size={20} /></span><div><h2>Study-file uploads</h2><p>PDF only · up to 25 MB · new files stay private drafts.</p></div></div><form className="staff-form" onSubmit={uploadFile}><label>Class<select value={uploadClass} onChange={event => { setUploadClass(event.target.value); setUploadSubject(""); }}>{[["class-9","Class 9"],["class-10","Class 10"],["class-11","Class 11"],["class-12","Class 12"]].map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Subject<select required value={uploadSubject} onChange={event => setUploadSubject(event.target.value)}><option value="">Choose subject</option>{subjectOptions.map(subject => <option key={subject}>{subject}</option>)}</select></label><label>Resource title<input required maxLength={180} value={uploadTitle} onChange={event => setUploadTitle(event.target.value)} placeholder="Original worksheet or school resource" /></label><label>Chapter or topic<input required maxLength={180} value={uploadChapter} onChange={event => setUploadChapter(event.target.value)} /></label><label className="file-picker">Choose a PDF<input required type="file" accept="application/pdf,.pdf" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} /><small>{selectedFile ? `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Maximum 25 MB. Use only materials you are authorised to share."}</small></label><button className="button button-primary" disabled={busy}>{busy ? "Uploading securely…" : "Upload as private draft"} <FileUp size={15} /></button><p role="status" className="form-feedback">{uploadStatus || "A portal owner reviews teacher-uploaded drafts before students can see them."}</p></form><h3>Your upload records</h3>{uploads.data?.map(file => <div className="staff-row" key={file.id}><span><strong>{file.title}</strong><small>{file.classKey} · {file.subject} · {file.status} · {(file.byteSize / 1024 / 1024).toFixed(1)} MB</small></span><span className="staff-row-actions">{isAdmin && file.status === "draft" && <button className="reset-button" onClick={() => publishFile.mutate({ id: file.id })}>Approve</button>}{file.status === "draft" && <button className="reset-button" onClick={() => archiveFile.mutate({ id: file.id })}>Archive</button>}</span></div>)}</section>

    <section className="staff-panel"><div className="staff-panel-heading"><span className="staff-icon"><FileText size={20} /></span><div><h2>Current-affairs drafts</h2><p>Add a publication date and direct source. Drafts are not visible to students.</p></div></div><form className="staff-form" onSubmit={event => { event.preventDefault(); createAffair.mutate({ eventDate: affairDate, topic: affairTopic.trim(), title: affairTitle.trim(), summary: affairSummary.trim(), sourceTitle: sourceTitle.trim(), sourceUrl: sourceUrl.trim() }); }}><label>Event/publication date<input type="date" required value={affairDate} onChange={event => setAffairDate(event.target.value)} /></label><label>Topic<input required maxLength={100} value={affairTopic} onChange={event => setAffairTopic(event.target.value)} placeholder="Science, India & civics…" /></label><label>Headline<input required maxLength={180} minLength={8} value={affairTitle} onChange={event => setAffairTitle(event.target.value)} /></label><label>Student-friendly summary<textarea required minLength={30} maxLength={1800} rows={4} value={affairSummary} onChange={event => setAffairSummary(event.target.value)} /></label><label>Source title<input required maxLength={220} value={sourceTitle} onChange={event => setSourceTitle(event.target.value)} /></label><label>Direct HTTPS source link<input required type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://…" /></label><button className="button button-primary" disabled={createAffair.isPending}>{createAffair.isPending ? "Saving draft…" : "Save sourced draft"}</button><p role="status" className="form-feedback">{createAffair.error?.message || affairStatus}</p></form><h3>Your editorial items</h3>{affairs.data?.map(item => <div className="staff-row" key={item.id}><span><strong>{item.title}</strong><small>{relativeDate(item.eventDate)} · {item.status} · {item.sourceTitle}</small></span><span className="staff-row-actions">{item.status === "draft" && <button className="reset-button" onClick={() => setAffair.mutate({ id: item.id, status: "published" })}>{isAdmin ? "Publish" : "Submit for review"}</button>}{item.status === "published" && <button className="reset-button" onClick={() => setAffair.mutate({ id: item.id, status: "archived" })}>Archive</button>}</span></div>)}</section></div>
    <p className="planner-privacy-note">Invitations are single-use signup codes; after redeeming, teachers always sign in using their own Manus identity. Archiving hides stored files but does not physically erase cloud storage.</p></div></PageFrame>;
}

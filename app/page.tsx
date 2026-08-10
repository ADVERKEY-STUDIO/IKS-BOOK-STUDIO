"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "dashboard" | "wizard" | "analysis" | "editor";

type Chapter = {
  id: number;
  title: string;
  pages: number;
  status: "planned" | "draft" | "approved";
  locked: boolean;
  body: string;
};

type Project = {
  title: string;
  source: string;
  sourcePages: number;
  sourceWords: number;
  audience: string;
  readingLevel: string;
  tone: string;
  language: string;
  bookType: string;
  maxPages: number;
  aesthetic: string;
  imageFrequency: string;
  adaptation: string;
  chapters: Chapter[];
  updatedAt: string;
};

const seedProject: Project = {
  title: "The Art of Wise Governance",
  source: "Arthashastra_textbook.pdf",
  sourcePages: 131,
  sourceWords: 39861,
  audience: "Young adults (15–18)",
  readingLevel: "Accessible academic",
  tone: "Clear and engaging",
  language: "English",
  bookType: "Illustrated learning book",
  maxPages: 72,
  aesthetic: "Classical Indian",
  imageFrequency: "Medium — 1 per 3 pages",
  adaptation: "Faithful, reader-friendly adaptation",
  updatedAt: "Today",
  chapters: [
    {
      id: 1,
      title: "The Thinker and His World",
      pages: 12,
      status: "approved",
      locked: true,
      body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>The Thinker<br/>and His World</h1><p class="chapter-deck">Before the Arthashastra became a guide to governance, it was a response to a changing world—one in which knowledge, discipline and public welfare had to work together.</p><blockquote>Good governance begins with understanding people, place and purpose.</blockquote><h2>A landscape of new ideas</h2><p>Ancient India was home to many schools of thought. Teachers, rulers and communities debated how prosperity could be created and protected. The Arthashastra brought these conversations into a practical framework for leadership.</p><div class="illustration"><span>ILLUSTRATION 01</span><strong>A learning hall at dawn</strong><small>Suggested visual: a teacher, students, manuscripts and a map of the subcontinent.</small></div><h2>Why the text still matters</h2><p>The work asks questions that remain familiar today: What makes an institution trustworthy? How should leaders balance strength and compassion? How can public resources be used wisely?</p><div class="takeaway"><b>KEY IDEA</b><p>Knowledge is valuable when it improves decisions and serves the wider community.</p></div>`,
    },
    {
      id: 2,
      title: "Knowledge, Learning and Discipline",
      pages: 10,
      status: "draft",
      locked: false,
      body: `<p class="chapter-kicker">CHAPTER TWO</p><h1>Knowledge, Learning<br/>and Discipline</h1><p class="chapter-deck">A practical education joins careful study with reflection, observation and responsible action.</p><h2>Learning as preparation</h2><p>The text treats education as preparation for sound judgment. It connects intellectual training with self-control and attention to real conditions.</p><div class="illustration"><span>ILLUSTRATION 02</span><strong>Four paths of learning</strong><small>Suggested visual: a precise editorial diagram built from the approved source.</small></div>`,
    },
    {
      id: 3,
      title: "Leadership and Public Welfare",
      pages: 14,
      status: "draft",
      locked: false,
      body: `<p class="chapter-kicker">CHAPTER THREE</p><h1>Leadership and<br/>Public Welfare</h1><p class="chapter-deck">Leadership is presented not as privilege, but as a demanding responsibility.</p><h2>The work of leadership</h2><p>A capable leader listens, studies evidence, chooses advisers carefully and keeps public welfare at the centre of policy.</p>`,
    },
    {
      id: 4,
      title: "Economy, Trade and Resources",
      pages: 14,
      status: "planned",
      locked: false,
      body: `<p class="chapter-kicker">CHAPTER FOUR</p><h1>Economy, Trade<br/>and Resources</h1><p class="chapter-deck">Prosperity depends on systems that are understood, measured and maintained.</p>`,
    },
    {
      id: 5,
      title: "Strategy, Diplomacy and Peace",
      pages: 14,
      status: "planned",
      locked: false,
      body: `<p class="chapter-kicker">CHAPTER FIVE</p><h1>Strategy, Diplomacy<br/>and Peace</h1><p class="chapter-deck">Wise strategy begins with a realistic view of relationships, risks and possible futures.</p>`,
    },
  ],
};

const emptyProject: Project = {
  ...seedProject,
  title: "Untitled adaptation",
  source: "No source selected",
  sourcePages: 0,
  sourceWords: 0,
  audience: "General readers (18+)",
  readingLevel: "Clear and accessible",
  maxPages: 60,
  chapters: [
    { id: 1, title: "Opening chapter", pages: 10, status: "planned", locked: false, body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>Opening chapter</h1><p class="chapter-deck">Your generated chapter will appear here after the book brief is approved.</p>` },
  ],
};

const wizardSteps = ["Source", "Reader", "Writing", "Design", "Review"];

function saveTextFile(name: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [project, setProject] = useState<Project>(seedProject);
  const [activeChapter, setActiveChapter] = useState(1);
  const [wizardStep, setWizardStep] = useState(0);
  const [toast, setToast] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<{ label: string; date: string; snapshot: Project }[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("iks-book-studio-project");
    if (saved) {
      try { setProject(JSON.parse(saved)); } catch { /* keep seed */ }
    }
  }, []);

  const active = project.chapters.find((chapter) => chapter.id === activeChapter) ?? project.chapters[0];
  const allocatedPages = useMemo(() => project.chapters.reduce((sum, chapter) => sum + chapter.pages, 8), [project.chapters]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };
  const patchProject = (patch: Partial<Project>) => setProject((current) => ({ ...current, ...patch }));

  function startNewBook() {
    setProject({ ...emptyProject, chapters: emptyProject.chapters.map((chapter) => ({ ...chapter })) });
    setWizardStep(0);
    setView("wizard");
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    patchProject({ source: file.name, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") });
    notify(`${file.name} is ready`);
  }

  function saveProject() {
    const next = { ...project, updatedAt: "Just now" };
    setProject(next);
    window.localStorage.setItem("iks-book-studio-project", JSON.stringify(next));
    notify("Book saved on this device");
  }

  function saveChapterBody() {
    if (!active || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    patchProject({ chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body: html, status: "draft" } : chapter) });
    notify("Chapter updated");
  }

  async function aiAction(action: string) {
    const selected = window.getSelection()?.toString().trim();
    const prompt = `Edit the book “${project.title}”, adapted from “${project.source}”. ${action}. Audience: ${project.audience}. Reading level: ${project.readingLevel}. Tone: ${project.tone}. Preserve factual accuracy and source traceability. Text: ${selected || active?.body.replace(/<[^>]+>/g, " ")}`;
    try { await navigator.clipboard.writeText(prompt); } catch { /* clipboard can be unavailable */ }
    notify(`${action} request copied for ChatGPT`);
  }

  function createVersion() {
    setVersions((current) => [{ label: `Editorial checkpoint ${current.length + 1}`, date: new Date().toLocaleString(), snapshot: JSON.parse(JSON.stringify(project)) }, ...current]);
    notify("Version checkpoint created");
  }

  function exportDoc() {
    const chapters = project.chapters.map((chapter) => `<section><h1>${chapter.title}</h1>${chapter.body}</section>`).join("");
    saveTextFile(`${project.title.replace(/\s+/g, "-").toLowerCase()}.doc`, `<html><head><meta charset="utf-8"><title>${project.title}</title></head><body><h1>${project.title}</h1><p>Adapted from ${project.source}</p>${chapters}</body></html>`, "application/msword");
    notify("Editable document downloaded");
  }

  if (view === "dashboard") return <Dashboard project={project} onNew={startNewBook} onOpen={() => { setView("editor"); setActiveChapter(project.chapters[0]?.id ?? 1); }} />;

  return (
    <div className="studio-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></button>
        <div className="current-project"><i /> <span><strong>{project.title}</strong><small>{project.source}</small></span></div>
        <div className="top-actions">
          <button onClick={() => setShowVersions(true)}>↺ <span>Versions</span></button>
          <button onClick={saveProject}>✓ <span>Save</span></button>
          <button onClick={() => setShowPreview(true)}>Preview</button>
          <button className="export-button" onClick={exportDoc}>↓ Export</button>
        </div>
      </header>

      {view === "wizard" && <Wizard step={wizardStep} project={project} onPatch={patchProject} onFile={handleFile} onBack={() => wizardStep === 0 ? setView("dashboard") : setWizardStep((step) => step - 1)} onNext={() => wizardStep < 4 ? setWizardStep((step) => step + 1) : setView("analysis")} />}
      {view === "analysis" && <Analysis project={project} onBack={() => { setView("wizard"); setWizardStep(4); }} onContinue={() => { setActiveChapter(project.chapters[0]?.id ?? 1); setView("editor"); }} />}
      {view === "editor" && <Editor project={project} active={active} activeId={activeChapter} allocated={allocatedPages} onSelect={setActiveChapter} onSaveBody={saveChapterBody} editorRef={editorRef} onAi={aiAction} onToggleLock={() => patchProject({ chapters: project.chapters.map((chapter) => chapter.id === active?.id ? { ...chapter, locked: !chapter.locked } : chapter) })} />}

      {showPreview && <Preview project={project} onClose={() => setShowPreview(false)} onPrint={() => window.print()} />}
      {showVersions && <Versions versions={versions} onCreate={createVersion} onRestore={(snapshot) => { setProject(snapshot); setShowVersions(false); notify("Version restored"); }} onClose={() => setShowVersions(false)} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Dashboard({ project, onNew, onOpen }: { project: Project; onNew: () => void; onOpen: () => void }) {
  return <main className="dashboard">
    <header><div className="brand"><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></div><button className="primary" onClick={onNew}>＋ New book</button></header>
    <section className="hero">
      <div><p className="eyebrow">YOUR AI-GUIDED EDITORIAL WORKSPACE</p><h1>Turn any source into a book<br/><em>made for its reader.</em></h1><p className="hero-copy">Upload a source, choose the audience and aesthetic, then shape every chapter in one beautiful workspace.</p><button className="hero-cta" onClick={onNew}>Start a new adaptation <span>→</span></button><small>PDF · DOCX · TXT · UP TO 100 PAGES</small></div>
      <div className="hero-books" aria-hidden="true"><div className="book back"><span>THE SOURCE</span></div><div className="book front"><span>THE ART OF</span><strong>WISE<br/>GOVERNANCE</strong><i>AN ILLUSTRATED GUIDE</i><b>✦</b></div></div>
    </section>
    <section className="library-section">
      <div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Continue where you left off</h2></div><span>1 project</span></div>
      <div className="project-grid">
        <button className="new-card" onClick={onNew}><b>＋</b><strong>New adaptation</strong><small>Begin with any source book</small></button>
        <button className="project-card" onClick={onOpen}><div className="mini-cover"><span>{project.chapters.length}</span><small>CHAPTERS</small></div><div><span className="status">IN EDITING</span><h3>{project.title}</h3><p>{project.source}</p><footer><span>{project.updatedAt}</span><strong>Open project →</strong></footer></div></button>
      </div>
    </section>
    <section className="workflow"><div><span>01</span><b>Upload</b><small>Any source book</small></div><i>→</i><div><span>02</span><b>Shape</b><small>Audience and style</small></div><i>→</i><div><span>03</span><b>Edit</b><small>Text and visuals</small></div><i>→</i><div><span>04</span><b>Publish</b><small>PDF or editable file</small></div></section>
  </main>;
}

function Wizard({ step, project, onPatch, onFile, onBack, onNext }: { step: number; project: Project; onPatch: (patch: Partial<Project>) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onBack: () => void; onNext: () => void }) {
  return <div className="wizard-layout">
    <aside className="step-rail"><p>NEW BOOK</p>{wizardSteps.map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><b>{label}</b></div>)}<blockquote>Every uploaded book starts a fresh project. Nothing is tied to Arthashastra.</blockquote></aside>
    <main className="wizard-main">
      <p className="eyebrow">STEP {step + 1} OF 5</p><h1>{["Choose the source.", "Who is the reader?", "Shape the writing.", "Choose the visual world.", "Review your brief."][step]}</h1><p className="lead">{["Upload the book you are authorised to adapt.", "The same source becomes a different book for a different reader.", "Set the voice, language and level of transformation.", "Give the whole book one consistent design direction.", "These choices guide every generated chapter and illustration."][step]}</p>
      {step === 0 && <section className="form-card"><label className="upload"><input type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile}/><span>↑</span><strong>{project.source}</strong><small>Click to choose a PDF, DOCX or TXT book</small></label><div className="fields two"><label>New book title<input value={project.title} onChange={(e) => onPatch({ title: e.target.value })}/></label><label>Source book<input value={project.source} readOnly/></label></div></section>}
      {step === 1 && <section className="form-card"><div className="fields two"><label>Reader age<select value={project.audience} onChange={(e) => onPatch({ audience: e.target.value })}><option>Children (7–10)</option><option>Young readers (11–14)</option><option>Young adults (15–18)</option><option>General readers (18+)</option><option>University students</option></select></label><label>Reading level<select value={project.readingLevel} onChange={(e) => onPatch({ readingLevel: e.target.value })}><option>Very simple</option><option>Clear and accessible</option><option>Accessible academic</option><option>Advanced academic</option></select></label><label>Book type<select value={project.bookType} onChange={(e) => onPatch({ bookType: e.target.value })}><option>Illustrated learning book</option><option>Children’s story</option><option>Popular non-fiction</option><option>Academic guide</option><option>Training manual</option></select></label><label>Maximum pages <b>{project.maxPages}</b><input type="range" min="10" max="100" value={project.maxPages} onChange={(e) => onPatch({ maxPages: Number(e.target.value) })}/></label></div></section>}
      {step === 2 && <section className="form-card"><div className="fields two"><label>Writing tone<select value={project.tone} onChange={(e) => onPatch({ tone: e.target.value })}><option>Clear and engaging</option><option>Warm and conversational</option><option>Story-led</option><option>Formal and academic</option></select></label><label>Language<select value={project.language} onChange={(e) => onPatch({ language: e.target.value })}><option>English</option><option>Hindi</option><option>English + Hindi</option></select></label><label className="wide">Adaptation style<select value={project.adaptation} onChange={(e) => onPatch({ adaptation: e.target.value })}><option>Faithful, reader-friendly adaptation</option><option>Concise illustrated summary</option><option>Creative reinterpretation</option><option>Teaching-focused adaptation</option></select></label></div></section>}
      {step === 3 && <section className="form-card"><div className="theme-grid">{["Classical Indian", "Modern academic", "Minimal editorial", "Warm children’s"].map((theme) => <button className={project.aesthetic === theme ? "selected" : ""} onClick={() => onPatch({ aesthetic: theme })} key={theme}><i/><i/><i/><strong>{theme}</strong></button>)}</div><div className="fields"><label>Illustration frequency<select value={project.imageFrequency} onChange={(e) => onPatch({ imageFrequency: e.target.value })}><option>Low — 1 per chapter</option><option>Medium — 1 per 3 pages</option><option>High — 1 per page</option></select></label></div></section>}
      {step === 4 && <section className="brief-review"><div><span>SOURCE</span><strong>{project.source}</strong></div><div><span>READER</span><strong>{project.audience}</strong></div><div><span>BOOK</span><strong>{project.bookType}</strong></div><div><span>VOICE</span><strong>{project.tone}</strong></div><div><span>DESIGN</span><strong>{project.aesthetic}</strong></div><div><span>LIMIT</span><strong>{project.maxPages} pages</strong></div></section>}
      <footer className="wizard-footer"><button className="secondary" onClick={onBack}>← Back</button><button className="primary" onClick={onNext}>{step === 4 ? "Analyse source" : "Continue"} →</button></footer>
    </main>
  </div>;
}

function Analysis({ project, onBack, onContinue }: { project: Project; onBack: () => void; onContinue: () => void }) {
  const headings = project.sourcePages ? ["Foundations and Context", "Knowledge and Learning", "Leadership and Welfare", "Economy and Resources", "Strategy and Diplomacy"] : ["Opening chapter"];
  return <main className="analysis-page"><button className="text-button" onClick={onBack}>← Change setup</button><p className="eyebrow">SOURCE ANALYSIS</p><h1>Your source is ready.</h1><p className="lead">Review the detected structure before entering the editorial studio.</p><section className="stats"><div><span>PAGES</span><strong>{project.sourcePages || "—"}</strong></div><div><span>WORDS</span><strong>{project.sourceWords ? project.sourceWords.toLocaleString() : "Pending"}</strong></div><div><span>QUALITY</span><strong>{project.sourcePages ? "Good" : "Upload ready"}</strong></div><div><span>OUTPUT LIMIT</span><strong>{project.maxPages}</strong></div></section><div className="analysis-grid"><section className="analysis-card"><header><div><p className="eyebrow">DETECTED OUTLINE</p><h2>{headings.length} chapter candidates</h2></div><span className="good">✓ Reviewable</span></header>{headings.map((heading, index) => <div className="heading-row" key={heading}><span>{String(index + 1).padStart(2, "0")}</span><input defaultValue={heading}/></div>)}</section><aside><div className="analysis-card"><p className="eyebrow">KEY TERMS</p><div className="tags"><span>governance</span><span>learning</span><span>welfare</span><span>strategy</span><span>ethics</span></div></div><div className="analysis-card note"><p className="eyebrow">FRESH FOR EVERY BOOK</p><p>This analysis belongs only to <strong>{project.source}</strong>. Uploading another source begins again.</p></div></aside></div><footer className="analysis-footer"><span>You can change every chapter later.</span><button className="primary" onClick={onContinue}>Open Editorial Studio →</button></footer></main>;
}

function Editor({ project, active, activeId, allocated, onSelect, editorRef, onSaveBody, onAi, onToggleLock }: { project: Project; active?: Chapter; activeId: number; allocated: number; onSelect: (id: number) => void; editorRef: React.RefObject<HTMLDivElement | null>; onSaveBody: () => void; onAi: (action: string) => void; onToggleLock: () => void }) {
  if (!active) return null;
  return <main className="editor-layout"><aside className="chapters"><header><p className="eyebrow">BOOK STRUCTURE</p><button>＋</button></header><div className="front-matter"><span>FM</span><div><b>Front matter</b><small>Cover · Contents · Preface</small></div></div>{project.chapters.map((chapter) => <button className={chapter.id === activeId ? "chapter active" : "chapter"} onClick={() => onSelect(chapter.id)} key={chapter.id}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small>{chapter.pages} pages · {chapter.status}</small></div><i>{chapter.locked ? "◆" : ""}</i></button>)}<div className="page-budget"><span><b>{allocated}</b> / {project.maxPages} pages</span><i><b style={{ width: `${Math.min(100, allocated / project.maxPages * 100)}%` }}/></i><small>{project.maxPages - allocated} pages available</small></div></aside><section className="canvas"><nav className="editor-tools"><div><button onClick={() => document.execCommand("bold")}><b>B</b></button><button onClick={() => document.execCommand("italic")}><i>I</i></button><button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button><button onClick={() => document.execCommand("insertUnorderedList")}>• List</button></div><div className="chapter-meter"><span>{active.pages} target pages</span><i><b style={{ width: "67%" }}/></i><button onClick={onToggleLock}>{active.locked ? "◆ Locked" : "◇ Lock"}</button></div></nav><div className="page-stage"><article className="paper"><header><span>{project.title}</span><span>{project.aesthetic}</span></header><div className="ornament">✦</div><div key={active.id} ref={editorRef} className="book-copy" contentEditable={!active.locked} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: active.body }}/><footer><span>{project.source}</span><span>{active.id}</span></footer></article></div><button className="save-float" onClick={onSaveBody}>✓ Save chapter</button></section><aside className="assistant"><nav><button className="active">✦<span>AI EDIT</span></button><button>◈<span>DESIGN</span></button><button>⌕<span>SOURCES</span></button></nav><div className="assistant-body"><div className="assistant-title"><span>✦</span><div><b>Editorial assistant</b><small>Select text, then choose an action.</small></div></div><p className="selection-tip">AI actions are copied to this ChatGPT conversation—no API key is used.</p><div className="ai-list">{["Simplify language", "Shorten selection", "Expand with examples", "Make age-appropriate", "Improve storytelling", "Check against source", "Suggest an illustration"].map((action) => <button onClick={() => onAi(action)} key={action}><span>✦</span>{action}<i>→</i></button>)}</div><div className="memory-box"><p className="eyebrow">BOOK MEMORY</p><p>Clear sentences · Preserve specialist terms · Explain Sanskrit words on first use</p><button onClick={() => onAi("Remember this editorial preference for the whole book")}>＋ Remember a preference</button></div></div></aside></main>;
}

function Preview({ project, onClose, onPrint }: { project: Project; onClose: () => void; onPrint: () => void }) {
  return <div className="modal-backdrop"><section className="preview-modal"><header><div><p className="eyebrow">BOOK PREVIEW</p><h2>{project.title}</h2></div><div><button onClick={onPrint}>Print / Save PDF</button><button onClick={onClose}>×</button></div></header><div className="preview-scroll"><article className="preview-cover"><p>{project.bookType}</p><h1>{project.title}</h1><span>Adapted from {project.source}</span><b>✦</b></article>{project.chapters.map((chapter) => <article className="preview-page" key={chapter.id}><span>CHAPTER {chapter.id}</span><h2>{chapter.title}</h2><div dangerouslySetInnerHTML={{ __html: chapter.body }}/></article>)}</div></section></div>;
}

function Versions({ versions, onCreate, onRestore, onClose }: { versions: { label: string; date: string; snapshot: Project }[]; onCreate: () => void; onRestore: (project: Project) => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="versions-modal"><header><div><p className="eyebrow">VERSION HISTORY</p><h2>Editorial checkpoints</h2></div><button onClick={onClose}>×</button></header><button className="primary full" onClick={onCreate}>＋ Create checkpoint</button>{versions.length === 0 ? <p className="empty">No checkpoints yet. Create one before a major edit.</p> : versions.map((version) => <div className="version" key={version.date}><span>↺</span><div><b>{version.label}</b><small>{version.date}</small></div><button onClick={() => onRestore(version.snapshot)}>Restore</button></div>)}</section></div>;
}

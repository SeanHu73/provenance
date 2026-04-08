import { useState, useRef, useEffect, useCallback } from "react";

const SEED_PINS = [
  { id: 1, title: "Memorial Church mosaics", type: "guided", era: "1900s", lat: 37.4275, lng: -122.1711, contributor: { name: "Prof. Elena Voss", role: "Historian" }, tags: ["Mission Revival", "Stanford founding", "Religious architecture"], upvotes: { accurate: 18, helpful: 43 }, photo: "church", annotations: [
    { x: 50, y: 22, note: "Look at the mosaic above the entrance. Notice how the gold tessera on the left seems brighter?", question: "Why might one section look newer than the rest?" },
    { x: 30, y: 65, note: "The sandstone facade uses a warm buff color typical of Mission Revival style.", question: "Can you spot where earthquake repairs used a slightly different stone?" },
    { x: 75, y: 80, note: "The cornerstone reads 1903 — but Stanford was founded in 1891.", question: "What happened between 1891 and 1903 that required rebuilding?" }
  ], description: "Stanford Memorial Church is one of the most visited buildings on campus, but most people walk past without noticing the layers of rebuilding visible in its stone.", resources: [{ label: "Stanford Archives — Church collection", type: "archive" }, { label: "Mission Revival Architecture in California (book)", type: "book" }] },
  { id: 2, title: "The Cactus Garden's hidden origin", type: "story", era: "1880s", lat: 37.4265, lng: -122.1735, contributor: { name: "Maria Santos", role: "Local" }, tags: ["Landscape architecture", "Stanford founding", "Leland Stanford Jr."], upvotes: { accurate: 7, helpful: 22 }, photo: "cactus", annotations: [], description: "Most people think the Cactus Garden is just decorative. But it was originally planted by Leland Stanford himself, who had a fascination with desert botany after trips through Arizona Territory. The garden predates the university.", resources: [] },
  { id: 3, title: "Where the oak grove stood", type: "memory", era: "1970s", lat: 37.4255, lng: -122.1690, contributor: { name: "James Whitfield", role: "Alumnus" }, tags: ["Campus life", "Environmental history", "Student activism"], upvotes: { accurate: 4, helpful: 15 }, photo: "oak", annotations: [], description: "There used to be a massive oak grove right here — I remember studying under those trees in '74. They were cut down for the science building expansion. There was a student protest, but it didn't save them. If you look at the ground carefully near the east wall, you can still see where two stumps were paved over.", resources: [] },
  { id: 4, title: "What is this symbol?", type: "request", era: null, lat: 37.4280, lng: -122.1700, contributor: { name: "Traveling_Soph", role: "Explorer" }, tags: [], upvotes: { accurate: 0, helpful: 3 }, photo: "symbol", annotations: [{ x: 48, y: 52, note: "I found this carved into the base of a lamp post near the quad. It looks like intertwined letters but I can't make them out.", question: null }], description: "Found this while walking around the Main Quad. Anyone know what it means?", resources: [], replies: [{ name: "David Chen", role: "Local", text: "Those are the intertwined initials L.S. and J.S. — Leland and Jane Stanford. You'll find them on a lot of the original campus fixtures." }] },
  { id: 5, title: "Rodin sculpture garden — the casting debate", type: "guided", era: "1980s", lat: 37.4322, lng: -122.1642, contributor: { name: "Art History Society", role: "Organisation" }, tags: ["Public art", "Rodin", "Bronze casting", "Museum collections"], upvotes: { accurate: 12, helpful: 31 }, photo: "rodin", annotations: [
    { x: 35, y: 40, note: "This is a posthumous cast of The Burghers of Calais. Rodin died in 1917 — this was cast in the 1980s.", question: "If a sculpture is cast after the artist's death from the original molds, is it still 'a Rodin'? What makes art authentic?" },
    { x: 65, y: 70, note: "Run your hand along the base (gently). The patina here is different from older casts in Paris.", question: "What does the surface texture tell you about the age of a bronze?" }
  ], description: "Stanford's Rodin collection is one of the largest outside Paris, but almost all of it was cast decades after Rodin's death. This raises fascinating questions about authenticity in art.", resources: [{ label: "Cantor Arts Center — free admission", type: "museum" }, { label: "Rodin casting history (Stanford exhibit guide)", type: "guide" }] }
];

const TOPIC_PAGES = [
  { id: "mission-revival", name: "Mission Revival architecture", description: "A style drawing on the Spanish missions of early California, characterized by smooth stucco walls, red clay tile roofs, and rounded arches. Popular from the 1890s through the 1920s, it became Stanford's signature aesthetic.", relatedPins: [1], era: "1890s–1920s" },
  { id: "stanford-founding", name: "Stanford founding era", description: "The university was founded in 1885 and opened in 1891 by Leland and Jane Stanford in memory of their son. The original campus was designed by Frederick Law Olmsted and Charles Coolidge.", relatedPins: [1, 2], era: "1880s–1900s" }
];

const TYPE_ICONS = { guided: "\u{1F9ED}", story: "\u{1F4D6}", memory: "\u{1F4AD}", request: "\u2753", observation: "\u{1F50D}" };
const TYPE_LABELS = { guided: "Guided look", story: "Story", memory: "Memory", request: "Question", observation: "Observation" };
const ROLE_COLORS = { Historian: "#0C447C", Local: "#0F6E56", Alumnus: "#534AB7", Explorer: "#D85A30", Organisation: "#993556" };
const ERA_OPTIONS = ["Pre-1850s", "1850s", "1860s", "1870s", "1880s", "1890s", "1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

function PhotoPlaceholder({ type, annotations, onAnnotationClick, activeAnnotation }) {
  const bgColors = { church: "#D5C4A1", cactus: "#A8C99A", oak: "#8B9E7C", symbol: "#C4B8A8", rodin: "#B8AFA3" };
  const icons = { church: "\u26EA", cactus: "\u{1F335}", oak: "\u{1F333}", symbol: "\u{1F523}", rodin: "\u{1F3DB}" };
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: `linear-gradient(135deg, ${bgColors[type] || "#ccc"} 0%, ${bgColors[type] || "#ccc"}dd 100%)`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 64, opacity: 0.3 }}>{icons[type] || "\u{1F4CD}"}</span>
      {annotations?.map((a, i) => (
        <button key={i} onClick={() => onAnnotationClick?.(i)} style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: activeAnnotation === i ? "var(--color-text-info)" : "rgba(255,255,255,0.9)", color: activeAnnotation === i ? "#fff" : "var(--color-text-primary)", border: activeAnnotation === i ? "2px solid var(--color-text-info)" : "2px solid rgba(0,0,0,0.3)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>{i + 1}</button>
      ))}
    </div>
  );
}

function Tag({ label, onClick }) {
  return <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 20, background: "var(--color-background-info)", color: "var(--color-text-info)", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer" }}>{label}</button>;
}

function RoleBadge({ role }) {
  return <span style={{ padding: "2px 8px", borderRadius: 10, background: (ROLE_COLORS[role] || "#888") + "18", color: ROLE_COLORS[role] || "#888", fontSize: 11, fontWeight: 500 }}>{role}</span>;
}

function UpvoteBar({ accurate, helpful }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--color-text-secondary)" }}>
      <button style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px 0", fontSize: 13 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
        <span>{accurate} accurate</span>
      </button>
      <button style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px 0", fontSize: 13 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-6 0v4H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-5z"/></svg>
        <span>{helpful} helpful</span>
      </button>
    </div>
  );
}

function MapView({ pins, onPinClick, selectedPin }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#E8E4DA", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
        {[...Array(12)].map((_, i) => <div key={`h${i}`} style={{ position: "absolute", top: `${i * 8.33}%`, left: 0, right: 0, height: "0.5px", background: "var(--color-text-tertiary)" }}/>)}
        {[...Array(12)].map((_, i) => <div key={`v${i}`} style={{ position: "absolute", left: `${i * 8.33}%`, top: 0, bottom: 0, width: "0.5px", background: "var(--color-text-tertiary)" }}/>)}
      </div>
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 5 }}>
        {["All", "Guided", "Story", "Memory", "Question"].map(f => (
          <button key={f} style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: f === "All" ? "var(--color-text-primary)" : "var(--color-background-primary)", color: f === "All" ? "var(--color-background-primary)" : "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", cursor: "pointer" }}>{f}</button>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-md)", padding: "6px 10px", fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", border: "0.5px solid var(--color-border-tertiary)", zIndex: 5 }}>Stanford campus — prototype view</div>
      {pins.map(pin => {
        const x = ((pin.lng - (-122.175)) / 0.012) * 100;
        const y = (1 - (pin.lat - 37.424) / 0.01) * 100;
        const isSelected = selectedPin?.id === pin.id;
        return (
          <button key={pin.id} onClick={() => onPinClick(pin)} style={{ position: "absolute", left: `${Math.max(5, Math.min(95, x))}%`, top: `${Math.max(15, Math.min(85, y))}%`, transform: "translate(-50%,-100%)", background: "none", border: "none", cursor: "pointer", zIndex: isSelected ? 4 : 3, filter: isSelected ? "none" : "none", transition: "transform 0.15s" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ background: isSelected ? "var(--color-text-info)" : "var(--color-background-primary)", width: 36, height: 36, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", border: isSelected ? "2px solid var(--color-text-info)" : "2px solid var(--color-border-secondary)", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                <span style={{ transform: "rotate(45deg)", fontSize: 16 }}>{TYPE_ICONS[pin.type]}</span>
              </div>
              {isSelected && <div style={{ marginTop: 4, padding: "3px 8px", background: "var(--color-background-primary)", borderRadius: 6, fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap", border: "0.5px solid var(--color-border-tertiary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{pin.title}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PinDetail({ pin, onBack, onTagClick }) {
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const currentAnn = pin.annotations?.[activeAnnotation];
  return (
    <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "12px 16px 0" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px 0", fontSize: 14, marginBottom: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to map
        </button>
      </div>
      <PhotoPlaceholder type={pin.photo} annotations={pin.annotations} onAnnotationClick={(i) => { setActiveAnnotation(i); setShowQuestion(false); setUserResponse(""); }} activeAnnotation={activeAnnotation} />
      {activeAnnotation !== null && currentAnn && (
        <div style={{ margin: "0 16px", padding: 12, background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", marginTop: -8, position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-info)", fontWeight: 500, marginBottom: 4 }}>Annotation {activeAnnotation + 1} of {pin.annotations.length}</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px", color: "var(--color-text-primary)" }}>{currentAnn.note}</p>
          {currentAnn.question && !showQuestion && (
            <button onClick={() => setShowQuestion(true)} style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, textAlign: "left" }}>
              Think about it: {currentAnn.question}
            </button>
          )}
          {showQuestion && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-info)", margin: "0 0 6px" }}>{currentAnn.question}</p>
              <textarea value={userResponse} onChange={e => setUserResponse(e.target.value)} placeholder="What do you think? (optional)" rows={2} style={{ width: "100%", boxSizing: "border-box", borderRadius: "var(--border-radius-md)", padding: 8, fontSize: 13, resize: "none", fontFamily: "var(--font-sans)" }}/>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {activeAnnotation < pin.annotations.length - 1 && (
                  <button onClick={() => { setActiveAnnotation(activeAnnotation + 1); setShowQuestion(false); setUserResponse(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next point →</button>
                )}
                {activeAnnotation === pin.annotations.length - 1 && (
                  <button onClick={() => setActiveAnnotation(null)} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Finish exploration</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ padding: "12px 16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{TYPE_ICONS[pin.type]}</span>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{TYPE_LABELS[pin.type]}</span>
          {pin.era && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--color-background-tertiary)", color: "var(--color-text-secondary)" }}>{pin.era}</span>}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: "4px 0 8px", lineHeight: 1.3, color: "var(--color-text-primary)" }}>{pin.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: (ROLE_COLORS[pin.contributor.role] || "#888") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: ROLE_COLORS[pin.contributor.role] }}>{pin.contributor.name.split(" ").map(n => n[0]).join("")}</div>
          <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{pin.contributor.name}</span>
          <RoleBadge role={pin.contributor.role}/>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 12px" }}>{pin.description}</p>
        {pin.annotations?.length > 0 && activeAnnotation === null && (
          <button onClick={() => { setActiveAnnotation(0); setShowQuestion(false); }} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            {pin.type === "guided" ? `Start guided exploration (${pin.annotations.length} points)` : `View annotations (${pin.annotations.length})`}
          </button>
        )}
        <UpvoteBar accurate={pin.upvotes.accurate} helpful={pin.upvotes.helpful}/>
        {pin.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {pin.tags.map(t => <Tag key={t} label={t} onClick={() => onTagClick?.(t)}/>)}
          </div>
        )}
        {pin.replies?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Replies</div>
            {pin.replies.map((r, i) => (
              <div key={i} style={{ padding: 10, background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
                  <RoleBadge role={r.role}/>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "var(--color-text-primary)" }}>{r.text}</p>
              </div>
            ))}
          </div>
        )}
        {pin.resources?.length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Go deeper</div>
            {pin.resources.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <span style={{ fontSize: 14 }}>{r.type === "archive" ? "\u{1F4C1}" : r.type === "book" ? "\u{1F4D6}" : r.type === "museum" ? "\u{1F3DB}" : "\u{1F517}"}</span>
                <span style={{ fontSize: 13, color: "var(--color-text-info)" }}>{r.label}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, padding: 12, border: "0.5px dashed var(--color-border-secondary)", borderRadius: "var(--border-radius-md)" }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>Notice something the contributor didn't mention?</p>
          <button style={{ padding: "8px 16px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Add your observation</button>
        </div>
      </div>
    </div>
  );
}

const CONTRIB_TYPES = [
  { key: "guided", icon: "\u{1F9ED}", label: "A guided look at this place", desc: "Walk visitors through what to notice" },
  { key: "story", icon: "\u{1F4D6}", label: "A story about this place", desc: "Share what happened here" },
  { key: "memory", icon: "\u{1F4AD}", label: "A personal memory", desc: "Something you remember" },
  { key: "observation", icon: "\u{1F50D}", label: "Something I noticed", desc: "A detail worth pointing out" },
  { key: "freeform", icon: "\u270F\uFE0F", label: "Write your own", desc: "None of the above — tell it your way" }
];

function ContributorFlow({ onCancel }) {
  const [step, setStep] = useState(0);
  const [contribType, setContribType] = useState(null);
  const [title, setTitle] = useState("");
  const [era, setEra] = useState("");
  const [storyText, setStoryText] = useState("");
  const [source, setSource] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [annotationNote, setAnnotationNote] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [photoTaken, setPhotoTaken] = useState(false);

  const totalSteps = contribType === "guided" ? 7 : 6;

  function addAnnotation(x, y) {
    if (annotationNote.trim()) {
      setAnnotations([...annotations, { x, y, note: annotationNote, question: questionText }]);
      setAnnotationNote("");
      setQuestionText("");
    }
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>What are you sharing?</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>Choose the type that fits best — you can always change later.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CONTRIB_TYPES.map(ct => (
              <button key={ct.key} onClick={() => { setContribType(ct.key); setStep(1); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: "var(--border-radius-lg)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 22 }}>{ct.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{ct.label}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{ct.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Capture the place</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>Take a photo or upload one. This is what explorers will see.</p>
          {!photoTaken ? (
            <button onClick={() => setPhotoTaken(true)} style={{ width: "100%", aspectRatio: "4/3", borderRadius: "var(--border-radius-lg)", border: "2px dashed var(--color-border-secondary)", background: "var(--color-background-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--color-text-secondary)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M8 5l1-2h6l1 2"/></svg>
              <span style={{ fontSize: 14 }}>Tap to take photo</span>
              <span style={{ fontSize: 12 }}>or upload from gallery</span>
            </button>
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: "var(--border-radius-lg)", background: "linear-gradient(135deg, #D5C4A1 0%, #C4B897 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 48, opacity: 0.3 }}>{"\u{1F4F7}"}</span>
              <div style={{ position: "absolute", bottom: 8, right: 8, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 11 }}>Photo captured</div>
            </div>
          )}
        </div>
      );
    }
    if (step === 2) {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Name this place</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>What should explorers see when they find this on the map?</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., 'The hidden courtyard behind Building 10'" style={{ width: "100%", boxSizing: "border-box", fontSize: 15, padding: "12px", borderRadius: "var(--border-radius-md)", fontFamily: "var(--font-sans)" }}/>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>When does this story take place?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ERA_OPTIONS.slice(3, 14).map(e => (
                <button key={e} onClick={() => setEra(e)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, background: era === e ? "var(--color-text-primary)" : "var(--color-background-secondary)", color: era === e ? "var(--color-background-primary)" : "var(--color-text-secondary)", border: era === e ? "none" : "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>{e}</button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (step === 3 && contribType === "guided") {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Build your guided look</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Tap on the photo to place a point of interest, then tell visitors what to notice and ask them a question.</p>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: "var(--border-radius-lg)", background: "linear-gradient(135deg, #D5C4A1 0%, #C4B897 100%)", overflow: "hidden", cursor: "crosshair", marginBottom: 12 }} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; if (annotationNote.trim()) addAnnotation(x, y); }}>
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 48, opacity: 0.2 }}>{"\u{1F4F7}"}</span>
            {annotations.map((a, i) => (
              <div key={i} style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%)", width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "2px solid var(--color-text-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "var(--color-text-info)" }}>{i + 1}</div>
            ))}
          </div>
          {annotations.length > 0 && (
            <div style={{ marginBottom: 12, padding: 8, background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", fontSize: 12, color: "var(--color-text-secondary)" }}>
              {annotations.length} point{annotations.length !== 1 ? "s" : ""} added
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={annotationNote} onChange={e => setAnnotationNote(e.target.value)} placeholder="What should visitors notice here? Write as if you're standing next to them." rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, borderRadius: "var(--border-radius-md)", padding: 10, resize: "none", fontFamily: "var(--font-sans)" }}/>
            <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="Now ask them a question about what they're seeing..." rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, borderRadius: "var(--border-radius-md)", padding: 10, resize: "none", fontFamily: "var(--font-sans)", background: "var(--color-background-info)" }}/>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>Write your note and question above, then tap on the photo to place it.</p>
          </div>
        </div>
      );
    }
    if ((step === 3 && contribType !== "guided") || (step === 4 && contribType === "guided")) {
      const prompts = {
        story: { label: "Tell the story", placeholder: "Tell the story in your own words. What happened here, and why does it matter?", hint: "Speak naturally — imagine you're telling a friend." },
        memory: { label: "What do you remember?", placeholder: "Share your memory of this place. What was it like? What do you remember most vividly?", hint: "Details make memories come alive — sounds, smells, who was there." },
        observation: { label: "What caught your eye?", placeholder: "Describe what you noticed and what you think it means.", hint: "It's okay to guess — your interpretation is part of the story." },
        guided: { label: "Add context", placeholder: "Is there anything else visitors should know about this place that isn't in the annotations?", hint: "Optional — your annotations may be enough." },
        freeform: { label: "Tell us about this place", placeholder: "Share whatever feels right — a story, a fact, a feeling, a question.", hint: "There's no wrong way to do this." }
      };
      const p = prompts[contribType] || prompts.freeform;
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>{p.label}</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>{p.hint}</p>
          <textarea value={storyText} onChange={e => setStoryText(e.target.value)} placeholder={p.placeholder} rows={5} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, borderRadius: "var(--border-radius-md)", padding: 12, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.7 }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              Voice input
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>How do you know this?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["I was there", "Someone told me", "I read about it", "I researched it"].map(s => (
                <button key={s} onClick={() => setSource(s)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, background: source === s ? "var(--color-text-primary)" : "var(--color-background-secondary)", color: source === s ? "var(--color-background-primary)" : "var(--color-text-secondary)", border: source === s ? "none" : "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    const tagStep = contribType === "guided" ? 5 : 4;
    const resourceStep = contribType === "guided" ? 6 : 5;
    if (step === tagStep) {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Connect your story</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Tags help explorers find related places and stories. What themes connect here?</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { setTags([...tags, tagInput.trim()]); setTagInput(""); }}} placeholder="Add a tag..." style={{ flex: 1, fontSize: 14, padding: "10px 12px", borderRadius: "var(--border-radius-md)", fontFamily: "var(--font-sans)" }}/>
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {tags.map((t, i) => <Tag key={i} label={t} onClick={() => setTags(tags.filter((_, j) => j !== i))}/>)}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Suggestions from nearby pins:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Mission Revival", "Stanford founding", "Campus life", "Public art", "Architecture"].filter(t => !tags.includes(t)).map(t => (
              <button key={t} onClick={() => setTags([...tags, t])} style={{ padding: "5px 10px", borderRadius: 20, fontSize: 12, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>+ {t}</button>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 6px" }}>Does this connect to another pin nearby?</p>
            <button style={{ padding: "6px 12px", borderRadius: "var(--border-radius-md)", fontSize: 12, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)", cursor: "pointer" }}>Link to another pin...</button>
          </div>
        </div>
      );
    }
    if (step === resourceStep) {
      return (
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Help explorers go deeper</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>Is there a museum, library, book, or guide where someone could learn more? This is optional but valuable.</p>
          {[{ icon: "\u{1F3DB}", label: "Nearby museum or exhibit" }, { icon: "\u{1F4DA}", label: "Library or archive" }, { icon: "\u{1F4D6}", label: "Book recommendation" }, { icon: "\u{1F517}", label: "Website or article" }, { icon: "\u{1F6B6}", label: "Guided tour or walking route" }].map((r, i) => (
            <button key={i} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", textAlign: "left", marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize: 14, color: "var(--color-text-primary)" }}>+ {r.label}</div>
              </div>
            </button>
          ))}
          <div style={{ marginTop: 16, padding: 16, background: "var(--color-background-success)", borderRadius: "var(--border-radius-lg)", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-success)", margin: "0 0 4px" }}>Ready to share!</p>
            <p style={{ fontSize: 12, color: "var(--color-text-success)", margin: "0 0 12px" }}>Your contribution will appear on the map for explorers to discover.</p>
            <button onClick={onCancel} style={{ padding: "10px 24px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-success)", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Publish to map</button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => step === 0 ? onCancel() : setStep(step - 1)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px 0", fontSize: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step > 0 && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Step {step} of {totalSteps}</span>}
      </div>
      {step > 0 && (
        <div style={{ height: 3, background: "var(--color-background-secondary)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / totalSteps) * 100}%`, background: "var(--color-text-info)", borderRadius: 2, transition: "width 0.3s" }}/>
        </div>
      )}
      {renderStep()}
      {step > 0 && step < (contribType === "guided" ? 6 : 5) && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => setStep(step + 1)} style={{ flex: 1, padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Continue</button>
          <button onClick={() => setStep(step + 1)} style={{ padding: "12px 16px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 14 }}>Skip</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("explorer");
  const [view, setView] = useState("map");
  const [selectedPin, setSelectedPin] = useState(null);
  const [contributing, setContributing] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);

  const topicPage = selectedTag ? TOPIC_PAGES.find(t => t.name === selectedTag) : null;

  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setView("detail");
  };

  const handleBack = () => {
    if (selectedTag) { setSelectedTag(null); return; }
    setSelectedPin(null);
    setView("map");
  };

  const handleTagClick = (tag) => {
    const tp = TOPIC_PAGES.find(t => t.name === tag);
    if (tp) { setSelectedTag(tag); setSelectedPin(null); setView("topic"); }
  };

  return (
    <div style={{ width: "100%", maxWidth: 390, margin: "0 auto", height: 720, background: "var(--color-background-primary)", borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", fontFamily: "var(--font-sans)" }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid var(--color-border-tertiary)", flexShrink: 0, background: "var(--color-background-primary)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Situ</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-background-info)", color: "var(--color-text-info)", fontWeight: 500, letterSpacing: "0.02em" }}>PROTOTYPE</span>
        </div>
        <div style={{ display: "flex", background: "var(--color-background-secondary)", borderRadius: 20, padding: 2 }}>
          <button onClick={() => { setMode("explorer"); setContributing(false); }} style={{ padding: "5px 12px", borderRadius: 18, fontSize: 12, fontWeight: 500, background: mode === "explorer" ? "var(--color-background-primary)" : "transparent", color: mode === "explorer" ? "var(--color-text-primary)" : "var(--color-text-secondary)", border: mode === "explorer" ? "0.5px solid var(--color-border-tertiary)" : "none", cursor: "pointer", transition: "all 0.2s" }}>Explorer</button>
          <button onClick={() => setMode("contributor")} style={{ padding: "5px 12px", borderRadius: 18, fontSize: 12, fontWeight: 500, background: mode === "contributor" ? "var(--color-background-primary)" : "transparent", color: mode === "contributor" ? "var(--color-text-primary)" : "var(--color-text-secondary)", border: mode === "contributor" ? "0.5px solid var(--color-border-tertiary)" : "none", cursor: "pointer", transition: "all 0.2s" }}>Storyteller</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {contributing ? (
          <ContributorFlow onCancel={() => setContributing(false)}/>
        ) : view === "detail" && selectedPin ? (
          <PinDetail pin={selectedPin} onBack={handleBack} onTagClick={handleTagClick}/>
        ) : view === "topic" && topicPage ? (
          <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 24px" }}>
            <button onClick={handleBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px 0", fontSize: 14, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back
            </button>
            <div style={{ padding: 16, background: "var(--color-background-info)", borderRadius: "var(--border-radius-lg)", marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-info)", fontWeight: 500 }}>TOPIC</span>
              <h2 style={{ fontSize: 20, fontWeight: 500, margin: "4px 0 6px", color: "var(--color-text-primary)" }}>{topicPage.name}</h2>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{topicPage.era}</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 16px" }}>{topicPage.description}</p>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Related pins</div>
            {topicPage.relatedPins.map(pid => {
              const rp = SEED_PINS.find(p => p.id === pid);
              return rp && (
                <button key={pid} onClick={() => handlePinClick(rp)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", textAlign: "left", marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{TYPE_ICONS[rp.type]}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{rp.title}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{rp.contributor.name} · {rp.era}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <MapView pins={SEED_PINS} onPinClick={handlePinClick} selectedPin={selectedPin}/>
        )}
      </div>

      {!contributing && mode === "contributor" && view === "map" && (
        <button onClick={() => setContributing(true)} style={{ position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: 28, background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 6, zIndex: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Add to map
        </button>
      )}

      <div style={{ display: "flex", borderTop: "0.5px solid var(--color-border-tertiary)", flexShrink: 0, background: "var(--color-background-primary)", zIndex: 10 }}>
        {[
          { key: "map", label: "Map", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg> },
          { key: "search", label: "Search", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
          { key: "saved", label: "Saved", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> },
          { key: "profile", label: "Profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg> }
        ].map(tab => (
          <button key={tab.key} onClick={() => { if (tab.key === "map") { setView("map"); setSelectedPin(null); setContributing(false); setSelectedTag(null); }}} style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: (tab.key === "map" && view === "map") ? "var(--color-text-info)" : "var(--color-text-secondary)", fontSize: 10, fontWeight: 500 }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";

const AI_DELAY = 900;

function Spinner({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
      <div style={{ width: 14, height: 14, border: "2px solid var(--color-border-tertiary)", borderTop: "2px solid var(--color-text-info)", borderRadius: "50%", animation: "sp .7s linear infinite" }}/>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{text || "Thinking..."}</span>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function PhotoMock({ points, activeIdx, onTap, tapping }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "linear-gradient(145deg,#C9B896,#B8A882 50%,#D1C4A0)", borderRadius: "var(--border-radius-lg)", overflow: "hidden", cursor: tapping ? "crosshair" : "default" }} onClick={e => { if (!tapping) return; const r = e.currentTarget.getBoundingClientRect(); onTap(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100); }}>
      <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 72, opacity: .1 }}>{"\u26EA"}</span>
      {tapping && points.length === 0 && <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center" }}><span style={{ padding: "5px 12px", borderRadius: 16, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 11 }}>Tap where you want explorers to look first</span></div>}
      {tapping && <div style={{ position: "absolute", inset: 0, border: "2px dashed rgba(24,95,165,.35)", borderRadius: "var(--border-radius-lg)", pointerEvents: "none" }}/>}
      {points.map((p, i) => {
        const active = activeIdx === i;
        const done = p.note?.trim();
        return (
          <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: active ? 30 : 24, height: active ? 30 : 24, borderRadius: "50%", background: active ? "#fff" : done ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.5)", border: active ? "2.5px solid #185FA5" : done ? "2px solid #0F6E56" : "2px dashed rgba(0,0,0,.25)", color: active ? "#185FA5" : done ? "#0F6E56" : "rgba(0,0,0,.3)", fontSize: active ? 12 : 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", zIndex: active ? 3 : 2, boxShadow: "0 1px 3px rgba(0,0,0,.12)", cursor: "pointer" }} onClick={e => { e.stopPropagation(); }}>{done && !active ? "\u2713" : i + 1}</div>
        );
      })}
    </div>
  );
}

const EXAMPLE_WALKTHROUGH = [
  { label: "Explorer sees a question", img: "What do you notice about the colours in the mosaic?", type: "question" },
  { label: "They look at the real thing, then tap to reveal", img: "The left section was restored after 1906 — original glass on the right, modern replacement on the left.", type: "insight" },
  { label: "The insight builds on the last one", img: "Each point adds a piece. By the end, the explorer sees the building differently.", type: "summary" }
];

const CONNECTION_PROMPTS = [
  "How does this relate to what you described at point {prev}?",
  "Is this the same story as point {prev}, or a different layer?",
  "Would an explorer need to understand point {prev} before this one makes sense?",
  "What changed between what you described at point {prev} and what you're describing here?"
];

function getConnectionPrompt(idx) {
  if (idx === 0) return null;
  const template = CONNECTION_PROMPTS[(idx - 1) % CONNECTION_PROMPTS.length];
  return template.replace("{prev}", String(idx));
}

const AI_SUGGESTIONS = {
  questions: [
    "Can you spot where the old mosaic meets the restored section?",
    "Does the stone look the same from top to bottom?",
    "The date reads 1903 — but Stanford opened in 1891. What happened?",
    "Does this tower look like it belongs with the rest of the building?"
  ],
  insights: [
    "You're looking at two eras of craftsmanship side by side — original Venetian glass on the right, modern replacement on the left.",
    "The colour shift marks two different earthquakes. Upper courses survived 1906; lower courses were replaced after 1989.",
    "The 'original' church was only three years old when the 1906 quake destroyed it. This is a reconstruction of something barely finished.",
    "The tower was added post-1906, borrowing from Spanish colonial missions further up the coast. It's an invention, not a restoration."
  ],
  bigPicture: "What looks like a preserved historic building is actually layers of destruction and rebuilding — each generation deciding what to keep, what to change, and what 'historic' means.",
  sequenceRationale: "Suggested order: start with the most visible detail (mosaic), move down the facade (stone), ground it with the cornerstone date, then end with the tower — the twist that reframes everything.",
  connections: [
    { from: 0, to: 1, thread: "Both show earthquake damage but from different events" },
    { from: 1, to: 2, thread: "The stone tells you there were repairs; the cornerstone tells you why" },
    { from: 2, to: 3, thread: "If the building was rebuilt, then additions like the tower are design choices, not preservation" }
  ]
};

export default function App() {
  const [phase, setPhase] = useState("orient");
  const [exStep, setExStep] = useState(0);

  const [points, setPoints] = useState([]);
  const [activeIdx, setActiveIdx] = useState(null);
  const [tapping, setTapping] = useState(true);
  const [connectionNotes, setConnectionNotes] = useState({});

  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [insights, setInsights] = useState([]);
  const [bigPicture, setBigPicture] = useState("");
  const [order, setOrder] = useState([]);
  const [editingField, setEditingField] = useState(null);

  const [prevIdx, setPrevIdx] = useState(null);
  const [prevPhase, setPrevPhase] = useState(0);

  function addPoint(x, y) {
    const np = [...points, { x, y, note: "", connection: "" }];
    setPoints(np);
    setActiveIdx(np.length - 1);
    setTapping(false);
  }

  function updateNote(i, val) {
    const np = [...points]; np[i] = { ...np[i], note: val }; setPoints(np);
  }

  function updateConnection(i, val) {
    setConnectionNotes({ ...connectionNotes, [i]: val });
  }

  function removePoint(i) {
    const np = [...points]; np.splice(i, 1); setPoints(np);
    if (activeIdx === i) setActiveIdx(null);
    else if (activeIdx > i) setActiveIdx(activeIdx - 1);
  }

  function runAI() {
    setAiLoading(true);
    setTimeout(() => {
      setQuestions(AI_SUGGESTIONS.questions.slice(0, points.length));
      setInsights(AI_SUGGESTIONS.insights.slice(0, points.length));
      setBigPicture(AI_SUGGESTIONS.bigPicture);
      setOrder(points.map((_, i) => i));
      setAiLoading(false);
      setAiDone(true);
    }, 1400);
  }

  function moveUp(pos) {
    if (pos <= 0) return;
    const no = [...order]; [no[pos - 1], no[pos]] = [no[pos], no[pos - 1]]; setOrder(no);
  }
  function moveDown(pos) {
    if (pos >= order.length - 1) return;
    const no = [...order]; [no[pos], no[pos + 1]] = [no[pos + 1], no[pos]]; setOrder(no);
  }

  const orderedData = order.map(i => ({ ...points[i], question: questions[i], insight: insights[i], origIdx: i }));

  const filledCount = points.filter(p => p.note?.trim()).length;

  if (phase === "orient") {
    return (
      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Create a guided look</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", padding: "16px" }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px", lineHeight: 1.4 }}>You're about to help someone see this place the way you do.</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>Here's what an explorer will experience from what you create:</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {EXAMPLE_WALKTHROUGH.map((ex, i) => (
              <div key={i} style={{ display: "flex", gap: 10, opacity: exStep >= i ? 1 : 0.3, transition: "opacity .4s" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: ex.type === "question" ? "var(--color-background-info)" : ex.type === "insight" ? "var(--color-background-success)" : "var(--color-background-warning)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 2 }}>
                  {ex.type === "question" ? "?" : ex.type === "insight" ? "\u2192" : "\u2211"}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>{ex.label}</p>
                  <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.5, fontStyle: ex.type === "question" ? "italic" : "normal" }}>"{ex.img}"</p>
                </div>
              </div>
            ))}
          </div>

          {exStep < 2 ? (
            <button onClick={() => setExStep(exStep + 1)} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Show next step</button>
          ) : (
            <div style={{ padding: "12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: "0 0 6px", lineHeight: 1.6 }}>Your job is to share what you know. The platform will help you turn it into this kind of experience — suggesting questions, finding connections, and shaping the flow.</p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>You don't need to be a teacher. Just tell it like you'd tell a friend.</p>
            </div>
          )}
        </div>
        {exStep >= 2 && (
          <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
            <button onClick={() => setPhase("build")} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Let's start</button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "build") {
    const connPrompt = activeIdx !== null && activeIdx > 0 ? getConnectionPrompt(activeIdx) : null;
    return (
      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Build your guided look</span>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{filledCount} point{filledCount !== 1 ? "s" : ""} described</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "8px 16px 0" }}>
            <PhotoMock points={points} activeIdx={activeIdx} onTap={addPoint} tapping={tapping}/>
          </div>

          <div style={{ padding: "8px 16px" }}>
            {!tapping && points.length > 0 && (
              <button onClick={() => setTapping(true)} style={{ width: "100%", padding: "8px", borderRadius: "var(--border-radius-md)", background: "none", border: "1px dashed var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 12, marginBottom: 8 }}>+ Tap photo to add another point</button>
            )}
          </div>

          {activeIdx !== null && points[activeIdx] && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ padding: "12px", border: "1.5px solid var(--color-text-info)", borderRadius: "var(--border-radius-md)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--color-background-info)", color: "var(--color-text-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{activeIdx + 1}</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Point {activeIdx + 1}</span>
                  </div>
                  <button onClick={() => removePoint(activeIdx)} style={{ fontSize: 11, color: "var(--color-text-danger)", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                </div>

                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>What's here? What should someone notice?</label>
                <textarea value={points[activeIdx].note} onChange={e => updateNote(activeIdx, e.target.value)} placeholder="Describe what you see and why it matters. Keep it natural — you're talking to a curious friend, not writing an essay." rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 13, borderRadius: 6, padding: 8, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.6, marginBottom: 6 }}/>

                <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: "none", cursor: "pointer", fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                  Say it instead
                </button>

                {connPrompt && (
                  <div style={{ padding: "8px 10px", background: "var(--color-background-warning)", borderRadius: "var(--border-radius-md)", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-warning)", margin: "0 0 4px" }}>Connection check</p>
                    <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: "0 0 6px", lineHeight: 1.5 }}>{connPrompt}</p>
                    <textarea value={connectionNotes[activeIdx] || ""} onChange={e => updateConnection(activeIdx, e.target.value)} placeholder="Optional — jot down how they connect, or skip this" rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, borderRadius: 6, padding: 6, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}/>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {activeIdx > 0 && <button onClick={() => setActiveIdx(activeIdx - 1)} style={{ padding: "6px 12px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-tertiary)", fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>{"\u2190"} Prev</button>}
                  {activeIdx < points.length - 1 && <button onClick={() => setActiveIdx(activeIdx + 1)} style={{ padding: "6px 12px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-tertiary)", fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>Next {"\u2192"}</button>}
                  <button onClick={() => { setActiveIdx(null); setTapping(true); }} style={{ padding: "6px 12px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-tertiary)", fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer", marginLeft: "auto" }}>Done with this point</button>
                </div>
              </div>
            </div>
          )}

          {points.length > 0 && activeIdx === null && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Your points so far</div>
              {points.map((p, i) => (
                <button key={i} onClick={() => { setActiveIdx(i); setTapping(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", padding: "8px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.note?.trim() ? "var(--color-background-success)" : "var(--color-background-secondary)", color: p.note?.trim() ? "var(--color-text-success)" : "var(--color-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{p.note?.trim() ? "\u2713" : i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: p.note?.trim() ? "var(--color-text-primary)" : "var(--color-text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note?.trim() || "Tap to describe..."}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8 }}>
          <button onClick={() => setPhase("orient")} style={{ padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Back</button>
          <button onClick={() => { setPhase("connect"); if (!aiDone) runAI(); }} disabled={filledCount < 2} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: filledCount < 2 ? "var(--color-background-secondary)" : "var(--color-text-primary)", color: filledCount < 2 ? "var(--color-text-secondary)" : "var(--color-background-primary)", border: "none", cursor: filledCount < 2 ? "default" : "pointer", fontSize: 13, fontWeight: 500 }}>Shape into exploration{filledCount < 2 ? ` (need ${2 - filledCount} more)` : ""}</button>
        </div>
      </div>
    );
  }

  if (phase === "connect") {
    return (
      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Shape the exploration</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", padding: "8px 16px 16px" }}>
          {aiLoading && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Spinner text="Reading your notes and finding connections..."/>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>Drafting questions, insights, and a suggested sequence.</p>
            </div>
          )}
          {aiDone && (
            <>
              <div style={{ padding: "8px 10px", background: "var(--color-background-success)", borderRadius: "var(--border-radius-md)", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "var(--color-text-success)", margin: 0, lineHeight: 1.5 }}>Here's what the platform built from your notes. Everything is editable — tap "edit" on anything you want to change.</p>
              </div>

              {AI_SUGGESTIONS.connections.filter(c => c.from < points.length && c.to < points.length).length > 0 && (
                <div style={{ padding: "8px 10px", background: "var(--color-background-warning)", borderRadius: "var(--border-radius-md)", marginBottom: 12, borderLeft: "3px solid var(--color-text-warning)" }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-warning)", margin: "0 0 4px" }}>Connections spotted</p>
                  {AI_SUGGESTIONS.connections.filter(c => c.from < points.length && c.to < points.length).map((c, i) => (
                    <p key={i} style={{ fontSize: 12, color: "var(--color-text-primary)", margin: "2px 0", lineHeight: 1.5 }}>Points {c.from + 1} → {c.to + 1}: {c.thread}</p>
                  ))}
                </div>
              )}

              <div style={{ padding: "8px 10px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", marginBottom: 12, borderLeft: "3px solid var(--color-text-info)" }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-info)", margin: "0 0 2px" }}>Suggested sequence</p>
                <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.5 }}>{AI_SUGGESTIONS.sequenceRationale}</p>
              </div>

              {order.map((origIdx, pos) => (
                <div key={origIdx} style={{ marginBottom: 10, padding: "10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <button onClick={() => moveUp(pos)} disabled={pos === 0} style={{ background: "none", border: "none", cursor: pos > 0 ? "pointer" : "default", color: pos > 0 ? "var(--color-text-secondary)" : "var(--color-border-tertiary)", fontSize: 10, padding: 0, lineHeight: 1 }}>{"\u25B2"}</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-info)", textAlign: "center" }}>{pos + 1}</span>
                      <button onClick={() => moveDown(pos)} disabled={pos === order.length - 1} style={{ background: "none", border: "none", cursor: pos < order.length - 1 ? "pointer" : "default", color: pos < order.length - 1 ? "var(--color-text-secondary)" : "var(--color-border-tertiary)", fontSize: 10, padding: 0, lineHeight: 1 }}>{"\u25BC"}</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Your note: "{points[origIdx]?.note?.slice(0, 45)}..."</p>
                    </div>
                  </div>
                  <div style={{ marginLeft: 28 }}>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-info)", textTransform: "uppercase", letterSpacing: ".03em" }}>Question for explorer</span>
                        <button onClick={() => setEditingField(editingField === `q${origIdx}` ? null : `q${origIdx}`)} style={{ fontSize: 10, color: "var(--color-text-info)", background: "none", border: "none", cursor: "pointer" }}>{editingField === `q${origIdx}` ? "done" : "edit"}</button>
                      </div>
                      {editingField === `q${origIdx}` ? (
                        <textarea value={questions[origIdx]} onChange={e => { const q = [...questions]; q[origIdx] = e.target.value; setQuestions(q); }} rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, borderRadius: 4, padding: 6, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.5, marginTop: 2 }}/>
                      ) : (
                        <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: "2px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>{questions[origIdx]}</p>
                      )}
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".03em" }}>Insight revealed</span>
                        <button onClick={() => setEditingField(editingField === `i${origIdx}` ? null : `i${origIdx}`)} style={{ fontSize: 10, color: "var(--color-text-info)", background: "none", border: "none", cursor: "pointer" }}>{editingField === `i${origIdx}` ? "done" : "edit"}</button>
                      </div>
                      {editingField === `i${origIdx}` ? (
                        <textarea value={insights[origIdx]} onChange={e => { const ins = [...insights]; ins[origIdx] = e.target.value; setInsights(ins); }} rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, borderRadius: 4, padding: 6, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.5, marginTop: 2 }}/>
                      ) : (
                        <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: "2px 0 0", lineHeight: 1.5 }}>{insights[origIdx]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ padding: "10px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-info)", textTransform: "uppercase", letterSpacing: ".03em" }}>The big picture</span>
                  <button onClick={() => setEditingField(editingField === "bp" ? null : "bp")} style={{ fontSize: 10, color: "var(--color-text-info)", background: "none", border: "none", cursor: "pointer" }}>{editingField === "bp" ? "done" : "edit"}</button>
                </div>
                {editingField === "bp" ? (
                  <textarea value={bigPicture} onChange={e => setBigPicture(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, borderRadius: 4, padding: 6, resize: "none", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}/>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{bigPicture}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8 }}>
          <button onClick={() => setPhase("build")} style={{ padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Back</button>
          <button onClick={() => { setPhase("preview"); setPrevIdx(null); setPrevPhase(0); }} disabled={!aiDone} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: aiDone ? "var(--color-text-primary)" : "var(--color-background-secondary)", color: aiDone ? "var(--color-background-primary)" : "var(--color-text-secondary)", border: "none", cursor: aiDone ? "pointer" : "default", fontSize: 13, fontWeight: 500 }}>Preview as explorer</button>
        </div>
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Explorer preview</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-background-warning)", color: "var(--color-text-warning)", fontWeight: 500 }}>PREVIEW</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
          <PhotoMock points={orderedData} activeIdx={prevIdx} tapping={false}/>

          <div style={{ padding: "12px 16px" }}>
            {prevIdx === null && (
              <>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--color-text-primary)", margin: "0 0 4px" }}>This guide builds an understanding piece by piece.</p>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Each point adds to the picture.</p>
                <button onClick={() => { setPrevIdx(0); setPrevPhase(0); }} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Start ({orderedData.length} points)</button>
              </>
            )}

            {prevIdx !== null && prevIdx < orderedData.length && (
              <>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {orderedData.map((_, i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < prevIdx ? "var(--color-text-info)" : i === prevIdx ? "var(--color-text-primary)" : "var(--color-background-secondary)" }}/>
                  ))}
                </div>
                {prevPhase === 0 && (
                  <>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{orderedData[prevIdx].note?.slice(0, 60)}</p>
                    <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--color-text-primary)", margin: "0 0 10px" }}>{orderedData[prevIdx].question}</p>
                    <button onClick={() => setPrevPhase(1)} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>See what this reveals →</button>
                  </>
                )}
                {prevPhase === 1 && (
                  <>
                    <div style={{ padding: "10px 12px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
                      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0, fontWeight: 500 }}>{orderedData[prevIdx].insight}</p>
                    </div>
                    {prevIdx > 0 && (
                      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                        {orderedData.slice(0, prevIdx).map((d, i) => (
                          <span key={i} style={{ padding: "3px 8px", borderRadius: 10, background: "var(--color-background-secondary)", fontSize: 10, color: "var(--color-text-secondary)" }}>{i + 1}. {d.insight?.split("—")[0]?.slice(0, 25)?.trim()}</span>
                        ))}
                      </div>
                    )}
                    {prevIdx < orderedData.length - 1 ? (
                      <button onClick={() => { setPrevIdx(prevIdx + 1); setPrevPhase(0); }} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next piece →</button>
                    ) : (
                      <button onClick={() => setPrevIdx(orderedData.length)} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>See the full picture →</button>
                    )}
                  </>
                )}
              </>
            )}

            {prevIdx !== null && prevIdx >= orderedData.length && (
              <div style={{ padding: "12px 0" }}>
                <div style={{ padding: "14px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-lg)", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-info)", margin: "0 0 4px" }}>The big picture</p>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0, fontWeight: 500 }}>{bigPicture}</p>
                </div>
                {orderedData.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, padding: "3px 0" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--color-background-info)", color: "var(--color-text-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                    <p style={{ fontSize: 11, lineHeight: 1.5, color: "var(--color-text-secondary)", margin: 0 }}>{d.insight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8 }}>
          <button onClick={() => setPhase("connect")} style={{ padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Edit</button>
          <button style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-success)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Publish to map</button>
        </div>
      </div>
    );
  }

  return null;
}

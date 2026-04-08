import { useState } from "react";

const PIN_DATA = {
  title: "Memorial Church mosaics",
  contributor: "Prof. Elena Voss",
  role: "Historian",
  era: "1900s",
  tags: ["Mission Revival", "Stanford founding", "Earthquake rebuilding"],
  connectedPins: [
    { id: 2, title: "The cornerstone tradition", distance: "50m", type: "guided" },
    { id: 3, title: "Post-quake rebuilding path", distance: "200m", type: "story" },
    { id: 4, title: "Mission Revival on Palm Drive", distance: "400m", type: "guided" }
  ]
};

const ANNOTATIONS_A = [
  { x: 50, y: 20, label: "The mosaic", note: "Gold tessera above the entrance. Left side looks brighter — restored after the 1906 earthquake.", question: "Can you spot where the old meets the new?" },
  { x: 28, y: 62, label: "The sandstone", note: "Warm buff stone, hand-cut. Typical Mission Revival. But look at the lower courses — slightly different colour.", question: null },
  { x: 72, y: 78, label: "The cornerstone", note: "1903. Stanford opened in 1891. Twelve-year gap. The 1906 earthquake destroyed the original — this is a rebuild.", question: "What does it mean that a 'historic' building is actually a reconstruction?" },
  { x: 85, y: 40, label: "The bell tower", note: "Not part of the original design. Added during reconstruction. Architecturally, it borrows from Spanish colonial missions up the coast.", question: null }
];

const ANNOTATIONS_B = [
  { x: 50, y: 20, reveal: "Before you read anything — just look at the mosaic. What colours do you see? Do they look uniform?", followup: "The left section was restored after 1906. Original Venetian glass on the right, modern replacement on the left. Most people can't tell." },
  { x: 28, y: 62, reveal: "Run your eyes down the facade. The stone changes about a third of the way down.", followup: "Upper courses are the 1903 original. Lower courses were replaced after the 1989 Loma Prieta earthquake. This building has survived two major quakes." },
  { x: 72, y: 78, reveal: "Find the cornerstone. What year does it say?", followup: "1903 — but Stanford opened in 1891. The original church was destroyed in 1906, three years after this version was completed. It was rebuilt again. The church you're looking at is the third version." },
  { x: 85, y: 40, reveal: "Look up at the bell tower. Does it match the rest of the building?", followup: "It doesn't — it was added during the post-1906 reconstruction and draws from Spanish colonial missions further up the California coast. The architect blended two eras." }
];

const ANNOTATIONS_C = [
  { x: 50, y: 20, note: "The mosaic above the entrance.", scaffoldQ: "What do you notice about the colours?", scaffoldHint: "Compare left and right sections carefully.", buildingIdea: "You're looking at two different eras of craftsmanship side by side." },
  { x: 28, y: 62, note: "The sandstone facade.", scaffoldQ: "Does the stone look the same all the way down?", scaffoldHint: "Pay attention to the colour shift about a third of the way down.", buildingIdea: "This building carries the scars of two earthquakes — 1906 and 1989." },
  { x: 72, y: 78, note: "The cornerstone.", scaffoldQ: "The date reads 1903. Stanford opened in 1891. What happened in between?", scaffoldHint: null, buildingIdea: "The 'original' was only 3 years old when the 1906 quake destroyed it. What you see is a reconstruction of a reconstruction." },
  { x: 85, y: 40, note: "The bell tower.", scaffoldQ: "Given what you now know about this building's history — do you think this tower is original?", scaffoldHint: null, buildingIdea: "It's not. It was added post-1906, borrowing from missions up the coast. Every piece of this building is a decision someone made about what 'historic' should look like." }
];

const FULL_TEXT = "Stanford Memorial Church was built in 1903 by Jane Stanford as a memorial to her husband Leland. It was the centerpiece of the campus — the building she cared about most. Three years later, the 1906 San Francisco earthquake destroyed much of it. The reconstruction that followed wasn't a faithful restoration — the architects made deliberate changes, adding the bell tower and simplifying some of the interior stonework. Then in 1989, the Loma Prieta earthquake caused further damage, leading to another round of repairs that are visible in the lower facade stones today. What you see when you stand in front of Memorial Church is not a preserved artifact but a palimpsest — layers of destruction and rebuilding stacked on top of each other, each generation deciding what to keep, what to change, and what 'historic' means to them.";

function PhotoMock({ annotations, activeIdx, onTap }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "linear-gradient(145deg, #C9B896 0%, #B8A882 50%, #D1C4A0 100%)", borderRadius: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 72, opacity: 0.12 }}>{"\u26EA"}</span>
      </div>
      {annotations.map((a, i) => {
        const isActive = activeIdx === i;
        const isPast = activeIdx !== null && i < activeIdx;
        const isFuture = activeIdx !== null && i > activeIdx;
        return (
          <button key={i} onClick={() => onTap(i)} style={{
            position: "absolute", left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%)",
            width: isActive ? 32 : 26, height: isActive ? 32 : 26, borderRadius: "50%",
            background: isActive ? "#fff" : isPast ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.5)",
            border: isActive ? "2.5px solid #185FA5" : isPast ? "2px solid rgba(0,0,0,0.2)" : "2px solid rgba(0,0,0,0.15)",
            color: isActive ? "#185FA5" : isPast ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.3)",
            fontSize: isActive ? 13 : 11, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", zIndex: isActive ? 3 : 2,
            boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.1)"
          }}>{i + 1}</button>
        );
      })}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(transparent, rgba(0,0,0,0.3))" }}/>
      {activeIdx !== null && (
        <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>
          {annotations.map((_, i) => (
            <div key={i} style={{ width: i === activeIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === activeIdx ? "#fff" : "rgba(255,255,255,0.5)", transition: "all 0.2s" }}/>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", zIndex: 5 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 4, display: "flex" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{title}</span>
    </div>
  );
}

function PinMeta() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#185FA518", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#185FA5" }}>EV</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{PIN_DATA.contributor}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{PIN_DATA.role} · {PIN_DATA.era}</div>
      </div>
      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 10, background: "var(--color-background-info)", color: "var(--color-text-info)", fontWeight: 500 }}>Guided</span>
    </div>
  );
}

function ConnectedPinsReturn({ onSelect }) {
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-background-success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 18 }}>{"\u2713"}</div>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Exploration complete</p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>3 connected pins are highlighted on your map</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {PIN_DATA.connectedPins.map(cp => (
          <button key={cp.id} onClick={() => onSelect(cp)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-info)", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-text-info)", flexShrink: 0, boxShadow: "0 0 0 3px rgba(24,95,165,0.15)" }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{cp.title}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{cp.distance} away</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Back to map</button>
        <button style={{ padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "none", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>Add observation</button>
      </div>
    </div>
  );
}

function FullTextSection({ expanded, onToggle }) {
  return (
    <div style={{ padding: "0 16px 12px" }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0", background: "none", border: "none", borderTop: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", color: "var(--color-text-secondary)" }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Full story</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {expanded && <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-text-primary)", margin: "0 0 8px" }}>{FULL_TEXT}</p>}
    </div>
  );
}

function ResourcesSection() {
  return (
    <div style={{ margin: "0 16px 16px", padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Go deeper</div>
      {[{ icon: "\u{1F3DB}", label: "Cantor Arts Center — church exhibit" }, { icon: "\u{1F4D6}", label: "Stanford: A History (R. Lyman)" }, { icon: "\u{1F6B6}", label: "Quad architecture walking route" }].map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none", fontSize: 13, color: "var(--color-text-info)" }}>
          <span>{r.icon}</span>{r.label}
        </div>
      ))}
    </div>
  );
}

function TagRow() {
  return (
    <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", flexWrap: "wrap" }}>
      {PIN_DATA.tags.map(t => (
        <span key={t} style={{ padding: "4px 10px", borderRadius: 20, background: "var(--color-background-info)", color: "var(--color-text-info)", fontSize: 11, fontWeight: 500 }}>{t}</span>
      ))}
    </div>
  );
}


function FlowA() {
  const [idx, setIdx] = useState(null);
  const [showFullText, setShowFullText] = useState(false);
  const [finished, setFinished] = useState(false);
  const ann = idx !== null ? ANNOTATIONS_A[idx] : null;

  if (finished) return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Header title="Memorial Church mosaics" onBack={() => { setFinished(false); setIdx(null); }}/>
      <ConnectedPinsReturn onSelect={() => {}}/>
    </div>
  );

  return (
    <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
      <Header title="Memorial Church mosaics" onBack={() => setIdx(null)}/>
      <PinMeta/>
      <PhotoMock annotations={ANNOTATIONS_A} activeIdx={idx} onTap={setIdx}/>
      {idx === null ? (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: "0 0 12px" }}>Stand in front of the church and look up. This building isn't what it seems.</p>
          <button onClick={() => setIdx(0)} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Start guided look ({ANNOTATIONS_A.length} points)</button>
          <TagRow/>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-info)", fontWeight: 500, marginBottom: 2 }}>{ann.label}</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: "0 0 8px" }}>{ann.note}</p>
          {ann.question && (
            <div style={{ padding: "10px 12px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: "var(--color-text-info)", margin: 0, fontStyle: "italic" }}>{ann.question}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {idx < ANNOTATIONS_A.length - 1 ? (
              <button onClick={() => setIdx(idx + 1)} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next →</button>
            ) : (
              <button onClick={() => setFinished(true)} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Finish → return to map</button>
            )}
          </div>
        </div>
      )}
      <FullTextSection expanded={showFullText} onToggle={() => setShowFullText(!showFullText)}/>
      <ResourcesSection/>
    </div>
  );
}


function FlowB() {
  const [idx, setIdx] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [finished, setFinished] = useState(false);
  const ann = idx !== null ? ANNOTATIONS_B[idx] : null;

  if (finished) return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Header title="Memorial Church mosaics" onBack={() => { setFinished(false); setIdx(null); }}/>
      <ConnectedPinsReturn onSelect={() => {}}/>
    </div>
  );

  return (
    <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
      <Header title="Memorial Church mosaics" onBack={() => setIdx(null)}/>
      <PinMeta/>
      <PhotoMock annotations={ANNOTATIONS_B} activeIdx={idx} onTap={(i) => { setIdx(i); setRevealed(false); }}/>
      {idx === null ? (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: "0 0 12px" }}>This guide asks you to look first, then reveals what you're seeing. Put your phone down between steps.</p>
          <button onClick={() => { setIdx(0); setRevealed(false); }} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Begin ({ANNOTATIONS_B.length} stops)</button>
          <TagRow/>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: revealed ? "var(--color-text-success)" : "var(--color-text-warning)" }}>{revealed ? "Revealed" : "Look first"}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>· {idx + 1} of {ANNOTATIONS_B.length}</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--color-text-primary)", margin: "0 0 10px", fontWeight: 500 }}>{ann.reveal}</p>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "none", border: "1.5px dashed var(--color-border-secondary)", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)" }}>
              I've looked — reveal the answer
            </button>
          ) : (
            <>
              <div style={{ padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderLeft: "3px solid var(--color-text-info)", marginBottom: 10 }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0 }}>{ann.followup}</p>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {idx < ANNOTATIONS_B.length - 1 ? (
                  <button onClick={() => { setIdx(idx + 1); setRevealed(false); }} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next stop →</button>
                ) : (
                  <button onClick={() => setFinished(true)} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Finish → return to map</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <FullTextSection expanded={showFullText} onToggle={() => setShowFullText(!showFullText)}/>
      <ResourcesSection/>
    </div>
  );
}


function FlowC() {
  const [idx, setIdx] = useState(null);
  const [phase, setPhase] = useState(0);
  const [showFullText, setShowFullText] = useState(false);
  const [finished, setFinished] = useState(false);
  const ann = idx !== null ? ANNOTATIONS_C[idx] : null;

  if (finished) return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Header title="Memorial Church mosaics" onBack={() => { setFinished(false); setIdx(null); }}/>
      <div style={{ padding: "16px" }}>
        <div style={{ padding: "16px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>What you've built</p>
          {ANNOTATIONS_C.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--color-background-info)", color: "var(--color-text-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-text-primary)", margin: 0 }}>{a.buildingIdea}</p>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-info)", margin: 0, fontWeight: 500 }}>The big picture: What looks like a preserved artifact is actually layers of rebuilding — each generation deciding what "historic" means.</p>
          </div>
        </div>
      </div>
      <ConnectedPinsReturn onSelect={() => {}}/>
    </div>
  );

  return (
    <div style={{ height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
      <Header title="Memorial Church mosaics" onBack={() => { setIdx(null); setPhase(0); }}/>
      <PinMeta/>
      <PhotoMock annotations={ANNOTATIONS_C} activeIdx={idx} onTap={(i) => { setIdx(i); setPhase(0); }}/>
      {idx === null ? (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: "0 0 4px" }}>This guide builds an understanding piece by piece.</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Each point adds to the picture — by the end, you'll see this building differently.</p>
          <button onClick={() => { setIdx(0); setPhase(0); }} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Start building ({ANNOTATIONS_C.length} pieces)</button>
          <TagRow/>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {ANNOTATIONS_C.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < idx ? "var(--color-text-info)" : i === idx ? "var(--color-text-primary)" : "var(--color-background-secondary)" }}/>
            ))}
          </div>

          {phase === 0 && (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{ann.note}</p>
              <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--color-text-primary)", margin: "0 0 10px" }}>{ann.scaffoldQ}</p>
              {ann.scaffoldHint && (
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px", fontStyle: "italic" }}>Hint: {ann.scaffoldHint}</p>
              )}
              <button onClick={() => setPhase(1)} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>See what this reveals →</button>
            </>
          )}

          {phase === 1 && (
            <>
              <div style={{ padding: "10px 12px", background: "var(--color-background-info)", borderRadius: "var(--border-radius-md)", marginBottom: 10 }}>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0, fontWeight: 500 }}>{ann.buildingIdea}</p>
              </div>
              {idx > 0 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                  {ANNOTATIONS_C.slice(0, idx).map((prev, i) => (
                    <span key={i} style={{ padding: "3px 8px", borderRadius: 10, background: "var(--color-background-secondary)", fontSize: 10, color: "var(--color-text-secondary)" }}>{i + 1}. {prev.buildingIdea.split("—")[0].trim()}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {idx < ANNOTATIONS_C.length - 1 ? (
                  <button onClick={() => { setIdx(idx + 1); setPhase(0); }} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next piece →</button>
                ) : (
                  <button onClick={() => setFinished(true)} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>See the full picture</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <FullTextSection expanded={showFullText} onToggle={() => setShowFullText(!showFullText)}/>
      <ResourcesSection/>
    </div>
  );
}


export default function App() {
  const [activeFlow, setActiveFlow] = useState(null);

  if (activeFlow === "A") return (
    <div style={{ maxWidth: 390, margin: "0 auto", height: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
      <div style={{ padding: "6px 16px", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-info)" }}>Flow A: Annotation-led</span>
        <button onClick={() => setActiveFlow(null)} style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}>Switch flow</button>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}><FlowA/></div>
    </div>
  );

  if (activeFlow === "B") return (
    <div style={{ maxWidth: 390, margin: "0 auto", height: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
      <div style={{ padding: "6px 16px", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-warning)" }}>Flow B: Look-then-reveal</span>
        <button onClick={() => setActiveFlow(null)} style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}>Switch flow</button>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}><FlowB/></div>
    </div>
  );

  if (activeFlow === "C") return (
    <div style={{ maxWidth: 390, margin: "0 auto", height: 720, borderRadius: "var(--border-radius-xl)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
      <div style={{ padding: "6px 16px", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-success)" }}>Flow C: Scaffolded understanding</span>
        <button onClick={() => setActiveFlow(null)} style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}>Switch flow</button>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}><FlowC/></div>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", padding: "24px 16px", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Explorer flow iterations</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>Same pin, three different ways to experience it. Tap to try each.</p>
      {[
        { key: "A", color: "#185FA5", bg: "#E6F1FB", label: "Annotation-led", desc: "Tap points on the photo. Each shows a short note + an optional question. Fastest flow — read, absorb, move on. Questions sit quietly, never blocking." },
        { key: "B", color: "#854F0B", bg: "#FAEEDA", label: "Look-then-reveal", desc: "Each stop asks you to observe first, then reveals what you're seeing. Designed to get you to put the phone down and look at the real thing between steps." },
        { key: "C", color: "#0F6E56", bg: "#E1F5EE", label: "Scaffolded understanding", desc: "Each point poses a question, then reveals an insight that builds on the last. At the end, you see how the pieces connect into a bigger idea." }
      ].map(f => (
        <button key={f.key} onClick={() => setActiveFlow(f.key)} style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--border-radius-lg)", background: f.bg, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: f.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{f.key}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: f.color }}>{f.label}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-primary)", margin: 0 }}>{f.desc}</p>
        </button>
      ))}
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 12, lineHeight: 1.6 }}>All three share: visual-first entry, short text during exploration, full story available at end, connected pins highlighted on map return. The difference is how they structure attention and questioning.</p>
    </div>
  );
}

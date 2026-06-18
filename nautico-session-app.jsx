import { useState, useEffect, useRef, useCallback } from "react";
import BUILTIN_QUESTIONS from "./Questions/naut-preguntas-2026-06-18.json";
import EXERCISES from "./Questions/exercises.json";

// ─── CONSTANTS & STORAGE KEYS ──────────────────────────────────────────────

const LS = {
  customQ:  "naut_custom_q_v2",
  history:  "naut_history_v2",
  settings: "naut_settings_v2",
};

const DIFFICULTIES = [
  { id: "normal", label: "Normal",  sprintTime: 10, qTimer: 25, minFatigue: 1, restSeconds: 20 },
  { id: "hard",   label: "Difícil", sprintTime: 7,  qTimer: 20, minFatigue: 1, restSeconds: 20 },
  { id: "brutal", label: "Brutal",  sprintTime: 5,  qTimer: 15, minFatigue: 2, restSeconds: 12 },
];

const CAT_COLORS  = { NAV: "#38BDF8", MAN: "#34D399", DEC: "#FB923C", REG: "#A78BFA", SIT: "#F0A500" };
const CAT_LABELS  = { NAV: "Navegación", MAN: "Maniobras", DEC: "Decisiones", REG: "Reglamento", SIT: "Situacional" };
const INT_COLORS  = { 1: "#38BDF8", 2: "#34D399", 3: "#FB923C", 4: "#F43F5E" };
const INT_LABELS  = { 1: "Baja", 2: "Media", 3: "Alta", 4: "Muy alta" };
const FAT_LABELS  = { 1: "Fresco", 2: "Activado", 3: "Fatigado", 4: "Al límite" };

const S = {
  font:   "'Space Mono', monospace",
  bg:     "#060C14",
  bg2:    "#0D1826",
  bg3:    "#111D2E",
  border: "#1E293B",
  text:   "#F1F5F9",
  muted:  "#64748B",
  dim:    "#475569",
};

// ─── EXERCISES ─── (loaded from Questions/exercises.json) ─────────────────

// ─── SESSION TEMPLATES ─────────────────────────────────────────────────────

const SESSION_TEMPLATES = {
  "30min": {
    label: "30 min — Completa",
    phases: [
      { id: "warm",   label: "Calentamiento",       duration: 300,  color: "#0EA5E9" },
      { id: "cardio", label: "Carga cardiovascular", duration: 600,  color: "#F43F5E" },
      { id: "man",    label: "Maniobras",            duration: 600,  color: "#34D399" },
      { id: "sprint", label: "Sprint mental",        duration: 300,  color: "#A78BFA" },
    ],
  },
  "20min": {
    label: "20 min — Express",
    phases: [
      { id: "warm",   label: "Calentamiento",  duration: 180,  color: "#0EA5E9" },
      { id: "cardio", label: "Cardiovascular", duration: 480,  color: "#F43F5E" },
      { id: "sprint", label: "Sprint mental",  duration: 300,  color: "#A78BFA" },
    ],
  },
  "15min": {
    label: "15 min — Sprint",
    phases: [
      { id: "cardio", label: "Cardiovascular", duration: 480,  color: "#F43F5E" },
      { id: "sprint", label: "Sprint mental",  duration: 300,  color: "#A78BFA" },
    ],
  },
};

const PHASE_EX_MAP = {
  warm:   ["JJ", "HK", "SQ", "CC", "TAP", "EQ", "EQC", "INH", "STR"],
  cardio: ["BU", "MC", "HK", "LS", "SL", "BJ", "JR", "JRA", "SHC", "BC"],
  man:    ["WS", "PL", "PLI", "PLD", "EQ", "EQC", "EQA", "CC", "TAP"],
  sprint: [],
};

const PHASE_Q_MAP = {
  warm:   ["NAV", "SIT"],
  cardio: ["NAV", "DEC", "SIT"],
  man:    ["MAN", "DEC", "SIT"],
  sprint: ["NAV", "MAN", "DEC", "REG", "SIT"],
};

const ROLES = [
  { id: "ALL", label: "General",         color: "#64748B" },
  { id: "GEN", label: "Trimmer Genova",  color: "#38BDF8" },
  { id: "MAY", label: "Trimmer Mayor",   color: "#34D399" },
  { id: "PRO", label: "Proel",           color: "#FB923C" },
  { id: "TOD", label: "Todos los roles", color: "#A78BFA" },
];

// ─── HOOKS ─────────────────────────────────────────────────────────────────

function useLocalStorage(key, defaultVal) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultVal;
    } catch { return defaultVal; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value]);

  return [value, setValue];
}

function useCountdown(seconds, active, onDone) {
  const [t, setT] = useState(seconds);
  const ref = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => { setT(seconds); }, [seconds]);

  useEffect(() => {
    clearInterval(ref.current);
    if (!active) return;
    ref.current = setInterval(() => {
      setT(prev => {
        if (prev <= 1) { clearInterval(ref.current); onDoneRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [active, seconds]);

  return t;
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAllQuestions(customQ) {
  return [...BUILTIN_QUESTIONS, ...customQ];
}

function getMaxId(allQ) {
  return Math.max(0, ...allQ.map(q => q.id ?? 0));
}

function getQuestionsForPhase(phaseId, role, fatigueLevel, count, usedIds, diff, allQ) {
  const cats = PHASE_Q_MAP[phaseId] || PHASE_Q_MAP.sprint;

  const roleMatch = (q) => role === "TOD" || q.role === "ALL" || q.role === role;

  let pool = allQ.filter(q =>
    cats.includes(q.cat) &&
    roleMatch(q) &&
    !usedIds.has(q.id) &&
    q.fatigue >= diff.minFatigue
  );

  if (fatigueLevel >= 3) {
    const hard = pool.filter(q => q.fatigue >= 2);
    if (hard.length >= count) pool = hard;
  }

  if (pool.length < count) {
    pool = allQ.filter(q =>
      cats.includes(q.cat) &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue
    );
  }

  return shuffle(pool).slice(0, count);
}

function getExercisesForPhase(phaseId) {
  const pool = PHASE_EX_MAP[phaseId] || [];
  return shuffle(EXERCISES.filter(e => pool.includes(e.id)));
}

function buildSession(templateKey, role, difficultyId, allQ) {
  const tmpl = SESSION_TEMPLATES[templateKey];
  const diff = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[0];
  const rounds = [];
  const usedIds = new Set();
  let exercisesDone = 0;

  tmpl.phases.forEach(phase => {
    if (phase.id === "sprint") {
      const questions = getQuestionsForPhase("sprint", role, 3, 10, usedIds, diff, allQ);
      questions.forEach(q => usedIds.add(q.id));
      rounds.push({
        type: "sprint",
        phaseLabel: phase.label,
        phaseColor: phase.color,
        questions,
        questionTimer: diff.sprintTime,
      });
      return;
    }

    const exList = getExercisesForPhase(phase.id);
    const numRounds = phase.id === "warm" ? 2 : 5;

    for (let i = 0; i < numRounds; i++) {
      const ex = exList[i % exList.length];
      exercisesDone++;
      const fatigueLevel = Math.min(4, Math.ceil(exercisesDone / 3));

      const qs = getQuestionsForPhase(phase.id, role, fatigueLevel, 1, usedIds, diff, allQ);
      const question = qs[0] ?? null;
      if (question) usedIds.add(question.id);

      const isWarm = phase.id === "warm";
      const dualTask = !isWarm && (i + 1) % 3 === 0 && !!question;

      rounds.push({
        type: "round",
        phaseLabel: phase.label,
        phaseColor: phase.color,
        roundIndex: i + 1,
        totalRounds: numRounds,
        exercise: ex,
        restSeconds: diff.restSeconds,
        question,
        questionTimer: isWarm ? 30 : diff.qTimer,
        fatigueLevel: Math.max(1, fatigueLevel),
        dualTask,
      });
    }
  });

  return rounds;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateImportedQuestions(raw) {
  if (!Array.isArray(raw)) throw new Error("Debe ser un array JSON");
  const validCats  = ["NAV", "MAN", "DEC", "REG", "SIT"];
  const validRoles = ["ALL", "GEN", "MAY", "PRO"];
  return raw.map((item, idx) => {
    if (typeof item.cat !== "string" || !validCats.includes(item.cat))
      throw new Error("Item " + (idx + 1) + ": cat debe ser NAV/MAN/DEC/REG");
    if (typeof item.q !== "string" || !item.q.trim())
      throw new Error("Item " + (idx + 1) + ": q (pregunta) es obligatorio");
    if (typeof item.a !== "string" || !item.a.trim())
      throw new Error("Item " + (idx + 1) + ": a (respuesta) es obligatorio");
    return {
      cat:    item.cat,
      role:   validRoles.includes(item.role) ? item.role : "ALL",
      fatigue: [1, 2, 3].includes(item.fatigue) ? item.fatigue : 1,
      q:      item.q.trim(),
      a:      item.a.trim(),
      d:      typeof item.d === "string" ? item.d.trim() : "",
    };
  });
}

// ─── UI HELPERS ────────────────────────────────────────────────────────────

function BottomNav({ screen, setScreen }) {
  const tabs = [
    { id: "home",    label: "Sesion",    icon: "⚓" },
    { id: "library", label: "Banco",     icon: "📚" },
    { id: "history", label: "Historial", icon: "📊" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: S.bg2, borderTop: "1px solid " + S.border,
      display: "flex", zIndex: 100,
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setScreen(tab.id)} style={{
          flex: 1, padding: "11px 0 9px",
          background: "none", border: "none",
          color: screen === tab.id ? "#0EA5E9" : S.muted,
          fontFamily: S.font, fontSize: 8, letterSpacing: 1,
          textTransform: "uppercase", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          borderTop: screen === tab.id ? "2px solid #0EA5E9" : "2px solid transparent",
        }}>
          <span style={{ fontSize: 17 }}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ width: "100%", maxWidth: 380, marginBottom: 24 }}>
      <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, marginBottom: 10, textTransform: "uppercase" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ChoiceBtn({ active, color, onClick, children, extraStyle }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", padding: "13px 14px",
      borderRadius: 10, textAlign: "left", cursor: "pointer",
      background: active ? color + "18" : S.bg2,
      border: active ? "1.5px solid " + color : "1.5px solid " + S.border,
      color: active ? color : S.muted,
      fontFamily: S.font, fontSize: 11, fontWeight: 700,
      letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
      ...extraStyle,
    }}>{children}</button>
  );
}

function FormField({ label, value, onChange, multiline, placeholder }) {
  const sharedStyle = {
    width: "100%", background: S.bg3, border: "1px solid " + S.border,
    borderRadius: 8, padding: "12px", color: S.text,
    fontFamily: S.font, fontSize: 12, boxSizing: "border-box",
    outline: "none",
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
            style={{ ...sharedStyle, resize: "vertical", minHeight: 70 }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={sharedStyle} />
      }
    </div>
  );
}

function PauseOverlay({ onResume }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(6,12,20,0.93)", backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: S.font,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 6, color: S.muted, textTransform: "uppercase", marginBottom: 14 }}>
        PAUSADO
      </div>
      <div style={{ fontSize: 56, marginBottom: 36 }}>⏸</div>
      <button onClick={onResume} style={{
        padding: "18px 52px",
        background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
        border: "none", borderRadius: 12, color: "#fff",
        fontFamily: S.font, fontSize: 14, fontWeight: 700, letterSpacing: 3, cursor: "pointer",
      }}>CONTINUAR</button>
    </div>
  );
}

// ─── HOME SCREEN ───────────────────────────────────────────────────────────

function HomeScreen({ onStart, settings, setSettings }) {
  const [template,   setTemplate]   = useState("30min");
  const [role,       setRole]       = useState("ALL");
  const [difficulty, setDifficulty] = useState(settings.difficulty || "hard");

  const diff = DIFFICULTIES.find(d => d.id === difficulty);

  const handleStart = () => {
    setSettings(s => ({ ...s, difficulty }));
    onStart(template, role, difficulty);
  };

  return (
    <div style={{
      minHeight: "100vh", background: S.bg, fontFamily: S.font,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 20px 96px",
    }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 38, marginBottom: 4 }}>⚓</div>
        <div style={{ fontSize: 9, letterSpacing: 5, color: "#38BDF8", marginBottom: 6, textTransform: "uppercase" }}>
          Entrenamiento Nautico Cognitivo
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: S.text }}>Nueva Sesion</div>
      </div>

      <Section label="Duracion">
        {Object.entries(SESSION_TEMPLATES).map(([k, v]) => (
          <ChoiceBtn key={k} active={template === k} color="#0EA5E9" onClick={() => setTemplate(k)}>
            <strong>{v.label}</strong>
            <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 10 }}>{v.phases.length} fases</span>
          </ChoiceBtn>
        ))}
      </Section>

      <Section label="Tu rol hoy">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ROLES.map(r => (
            <ChoiceBtn key={r.id} active={role === r.id} color={r.color}
              extraStyle={{ flex: "1 1 40%", width: "auto", marginBottom: 0 }}
              onClick={() => setRole(r.id)}>
              {r.label}
            </ChoiceBtn>
          ))}
        </div>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 8, lineHeight: 1.5 }}>
          Preguntas de maniobra filtradas por rol + generales ALL.
        </div>
      </Section>

      <Section label="Dificultad">
        <div style={{ display: "flex", gap: 8 }}>
          {DIFFICULTIES.map(d => {
            const col = d.id === "normal" ? "#34D399" : d.id === "hard" ? "#FB923C" : "#F43F5E";
            return (
              <ChoiceBtn key={d.id} active={difficulty === d.id} color={col}
                extraStyle={{ flex: 1, width: "auto", textAlign: "center", marginBottom: 0 }}
                onClick={() => setDifficulty(d.id)}>
                {d.label}
              </ChoiceBtn>
            );
          })}
        </div>
        {diff && (
          <div style={{ fontSize: 10, color: S.dim, marginTop: 8, lineHeight: 1.7 }}>
            Sprint: {diff.sprintTime}s/pregunta · Descanso: {diff.restSeconds}s
            {difficulty === "brutal" && " · Solo preguntas dificiles"}
          </div>
        )}
      </Section>

      <Section label="Fases">
        {SESSION_TEMPLATES[template].phases.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
            <div style={{ width: 3, height: 32, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: S.text, fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: S.muted }}>{Math.round(p.duration / 60)} min</div>
            </div>
          </div>
        ))}
      </Section>

      <button onClick={handleStart} style={{
        width: "100%", maxWidth: 380, padding: "18px",
        background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
        border: "none", borderRadius: 12, color: "#fff",
        fontFamily: S.font, fontSize: 14, fontWeight: 700,
        letterSpacing: 3, cursor: "pointer", textTransform: "uppercase",
      }}>COMENZAR →</button>
    </div>
  );
}

// ─── LIBRARY SCREEN ────────────────────────────────────────────────────────

const IMPORT_EXAMPLE = `[
  {
    "cat": "NAV",
    "role": "ALL",
    "fatigue": 2,
    "q": "Tu pregunta aqui...",
    "a": "Respuesta aqui",
    "d": "Detalle o explicacion (opcional)"
  }
]`;

function LibraryScreen({ customQ, setCustomQ }) {
  const [filterCat,  setFilterCat]  = useState("ALL");
  const [editingId,  setEditingId]  = useState(null);
  const [showFormat, setShowFormat] = useState(false);
  const [importMsg,  setImportMsg]  = useState(null);
  const [form, setForm] = useState({ cat: "NAV", role: "ALL", fatigue: 2, q: "", a: "", d: "" });
  const fileRef = useRef(null);

  const allQ       = getAllQuestions(customQ);
  const builtinIds = new Set(BUILTIN_QUESTIONS.map(q => q.id));
  const filtered   = filterCat === "ALL" ? allQ : allQ.filter(q => q.cat === filterCat);

  const openNew = () => {
    setForm({ cat: "NAV", role: "ALL", fatigue: 2, q: "", a: "", d: "" });
    setEditingId("new");
  };

  const openEdit = (q) => {
    setForm({ cat: q.cat, role: q.role, fatigue: q.fatigue, q: q.q, a: q.a, d: q.d || "" });
    setEditingId(q.id);
  };

  const saveForm = () => {
    if (!form.q.trim() || !form.a.trim()) return;
    if (editingId === "new") {
      setCustomQ(prev => [...prev, { ...form, id: getMaxId(getAllQuestions(prev)) + 1, fatigue: Number(form.fatigue) }]);
    } else {
      setCustomQ(prev => prev.map(q => q.id === editingId ? { ...q, ...form, fatigue: Number(form.fatigue) } : q));
    }
    setEditingId(null);
  };

  const deleteQ = (id) => {
    setCustomQ(prev => prev.filter(q => q.id !== id));
  };

  const handleExport = () => {
    downloadJSON(allQ, "naut-preguntas-" + new Date().toISOString().slice(0, 10) + ".json");
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const raw  = JSON.parse(text);
      const validated = validateImportedQuestions(raw);
      const existingTexts = new Set(allQ.map(q => q.q));
      const newOnes = validated.filter(q => !existingTexts.has(q.q));
      if (newOnes.length === 0) { setImportMsg("Sin preguntas nuevas para importar."); return; }
      let nextId = getMaxId(allQ) + 1;
      const withIds = newOnes.map(q => ({ ...q, id: nextId++ }));
      setCustomQ(prev => [...prev, ...withIds]);
      setImportMsg("✓ " + withIds.length + " pregunta(s) importada(s) correctamente.");
    } catch (err) {
      setImportMsg("✗ Error: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  if (editingId !== null) {
    const isNew = editingId === "new";
    return (
      <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, padding: "24px 20px 96px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setEditingId(null)} style={{
            background: "none", border: "none", color: S.muted, fontFamily: S.font, fontSize: 11, cursor: "pointer",
          }}>← VOLVER</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>
            {isNew ? "Nueva pregunta" : "Editar pregunta"}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Categoria</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["NAV", "MAN", "DEC", "REG", "SIT"].map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, cat: c }))} style={{
                flex: 1, padding: "10px 4px", borderRadius: 8, cursor: "pointer",
                background: form.cat === c ? CAT_COLORS[c] + "22" : S.bg2,
                border: form.cat === c ? "1.5px solid " + CAT_COLORS[c] : "1.5px solid " + S.border,
                color: form.cat === c ? CAT_COLORS[c] : S.muted,
                fontFamily: S.font, fontSize: 10, fontWeight: 700,
              }}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Rol</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setForm(f => ({ ...f, role: r.id }))} style={{
                flex: "1 1 40%", padding: "9px 6px", borderRadius: 8, cursor: "pointer",
                background: form.role === r.id ? r.color + "18" : S.bg2,
                border: form.role === r.id ? "1.5px solid " + r.color : "1.5px solid " + S.border,
                color: form.role === r.id ? r.color : S.muted,
                fontFamily: S.font, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
              }}>{r.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Dificultad</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map(f => (
              <button key={f} onClick={() => setForm(fv => ({ ...fv, fatigue: f }))} style={{
                flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                background: Number(form.fatigue) === f ? INT_COLORS[f] + "22" : S.bg2,
                border: Number(form.fatigue) === f ? "1.5px solid " + INT_COLORS[f] : "1.5px solid " + S.border,
                color: Number(form.fatigue) === f ? INT_COLORS[f] : S.muted,
                fontFamily: S.font, fontSize: 10, fontWeight: 700,
              }}>{INT_LABELS[f]}</button>
            ))}
          </div>
        </div>

        <FormField label="Pregunta" value={form.q} onChange={v => setForm(f => ({ ...f, q: v }))} multiline placeholder="Cual es el rumbo magnetico si..." />
        <FormField label="Respuesta" value={form.a} onChange={v => setForm(f => ({ ...f, a: v }))} placeholder="128° M" />
        <FormField label="Detalle / Explicacion (opcional)" value={form.d} onChange={v => setForm(f => ({ ...f, d: v }))} placeholder="120 + 8 = 128" />

        <button onClick={saveForm} disabled={!form.q.trim() || !form.a.trim()} style={{
          width: "100%", padding: "16px",
          background: form.q.trim() && form.a.trim() ? "linear-gradient(135deg, #0EA5E9, #0D9488)" : S.bg3,
          border: "none", borderRadius: 12,
          color: form.q.trim() && form.a.trim() ? "#fff" : S.muted,
          fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
        }}>GUARDAR PREGUNTA</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, padding: "28px 20px 96px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, textTransform: "uppercase" }}>Banco de Preguntas</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: S.text, marginTop: 4 }}>
          Biblioteca <span style={{ fontSize: 13, color: S.muted, fontWeight: 400 }}>({allQ.length})</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleExport} style={{
          flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
          background: S.bg2, border: "1px solid " + S.border, color: "#34D399",
          fontFamily: S.font, fontSize: 9, letterSpacing: 1,
        }}>↓ EXPORTAR JSON</button>
        <button onClick={() => fileRef.current?.click()} style={{
          flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
          background: S.bg2, border: "1px solid " + S.border, color: "#38BDF8",
          fontFamily: S.font, fontSize: 9, letterSpacing: 1,
        }}>↑ IMPORTAR JSON</button>
        <button onClick={() => setShowFormat(f => !f)} style={{
          padding: "12px 14px", borderRadius: 10, cursor: "pointer",
          background: showFormat ? "rgba(167,139,250,0.1)" : S.bg2,
          border: showFormat ? "1px solid #A78BFA55" : "1px solid " + S.border,
          color: "#A78BFA", fontFamily: S.font, fontSize: 9,
        }}>?</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImportFile} />
      </div>

      {showFormat && (
        <div style={{
          background: S.bg3, border: "1px solid " + S.border, borderRadius: 10,
          padding: "14px", marginBottom: 12,
        }}>
          <div style={{ fontSize: 9, color: "#A78BFA", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
            Formato JSON esperado
          </div>
          <pre style={{ fontSize: 10, color: S.muted, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {IMPORT_EXAMPLE}
          </pre>
          <div style={{ fontSize: 9, color: S.dim, marginTop: 8 }}>
            fatigue: 1=Baja · 2=Media · 3=Alta &nbsp; | &nbsp; role: ALL / GEN / MAY / PRO
          </div>
        </div>
      )}

      {importMsg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 14,
          background: importMsg.startsWith("✓") ? "rgba(52,211,153,0.1)" : "rgba(244,63,94,0.1)",
          border: "1px solid " + (importMsg.startsWith("✓") ? "rgba(52,211,153,0.3)" : "rgba(244,63,94,0.3)"),
          color: importMsg.startsWith("✓") ? "#34D399" : "#F43F5E",
          fontSize: 11, fontFamily: S.font, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          {importMsg}
          <button onClick={() => setImportMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", "NAV", "MAN", "DEC", "REG", "SIT"].map(c => {
          const count = c === "ALL" ? allQ.length : allQ.filter(q => q.cat === c).length;
          const color = c === "ALL" ? "#64748B" : CAT_COLORS[c];
          return (
            <button key={c} onClick={() => setFilterCat(c)} style={{
              padding: "6px 12px", borderRadius: 6, cursor: "pointer",
              background: filterCat === c ? color + "22" : S.bg2,
              border: "1px solid " + (filterCat === c ? color : S.border),
              color: filterCat === c ? color : S.muted,
              fontFamily: S.font, fontSize: 9, fontWeight: 700, letterSpacing: 1,
            }}>{c === "ALL" ? "TODAS (" + count + ")" : c + " (" + count + ")"}</button>
          );
        })}
      </div>

      {filtered.map(q => {
        const isCustom  = !builtinIds.has(q.id);
        const catColor  = CAT_COLORS[q.cat] || S.muted;
        return (
          <div key={q.id} style={{
            background: S.bg2, borderRadius: 10, border: "1px solid " + S.border,
            padding: "12px 14px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7, alignItems: "center" }}>
              <span style={{
                fontSize: 8, padding: "2px 7px", borderRadius: 4,
                background: catColor + "18", color: catColor, letterSpacing: 1, fontWeight: 700,
              }}>{q.cat}</span>
              <span style={{
                fontSize: 8, padding: "2px 7px", borderRadius: 4,
                background: INT_COLORS[q.fatigue] + "18", color: INT_COLORS[q.fatigue], letterSpacing: 1,
              }}>{INT_LABELS[q.fatigue]}</span>
              {q.role !== "ALL" && (
                <span style={{ fontSize: 8, color: S.dim }}>{q.role}</span>
              )}
              {isCustom && (
                <span style={{ fontSize: 8, color: "#A78BFA", marginLeft: "auto" }}>CUSTOM</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: S.text, lineHeight: 1.55, whiteSpace: "pre-line", marginBottom: 5 }}>{q.q}</div>
            <div style={{ fontSize: 11, color: "#34D399", fontWeight: 700 }}>→ {q.a}</div>
            {q.d && <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>{q.d}</div>}
            {isCustom && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => openEdit(q)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.3)",
                  color: "#38BDF8", fontFamily: S.font, fontSize: 9, letterSpacing: 1,
                }}>EDITAR</button>
                <button onClick={() => deleteQ(q.id)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)",
                  color: "#F43F5E", fontFamily: S.font, fontSize: 9, letterSpacing: 1,
                }}>ELIMINAR</button>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={openNew} style={{
        width: "100%", padding: "16px", marginTop: 8,
        background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
        border: "none", borderRadius: 12, color: "#fff",
        fontFamily: S.font, fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
      }}>+ NUEVA PREGUNTA</button>
    </div>
  );
}

// ─── HISTORY SCREEN ────────────────────────────────────────────────────────

function HistoryScreen({ history, onClearHistory }) {
  const [selected, setSelected] = useState(null);

  if (selected !== null) {
    const entry     = selected;
    const all       = entry.results.flat().filter(r => r && r.q);
    const correct   = all.filter(r => r.correct).length;
    const score     = all.length ? Math.round((correct / all.length) * 100) : 0;
    const wrong     = all.filter(r => !r.correct);
    const scoreColor = score >= 75 ? "#34D399" : score >= 55 ? "#FB923C" : "#F43F5E";
    const diffObj   = DIFFICULTIES.find(d => d.id === entry.difficulty) || DIFFICULTIES[0];

    return (
      <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, padding: "24px 20px 96px" }}>
        <button onClick={() => setSelected(null)} style={{
          background: "none", border: "none", color: S.muted, fontFamily: S.font, fontSize: 11, cursor: "pointer", marginBottom: 20,
        }}>← HISTORIAL</button>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: S.muted, textTransform: "uppercase", marginBottom: 4 }}>{entry.date}</div>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 10 }}>
            {SESSION_TEMPLATES[entry.template]?.label} · {ROLES.find(r => r.id === entry.role)?.label} · {diffObj.label}
          </div>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1, color: scoreColor }}>{score}%</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 6 }}>{correct} / {all.length} correctas</div>
        </div>

        {wrong.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, marginBottom: 12, textTransform: "uppercase" }}>
              Para repasar ({wrong.length})
            </div>
            {wrong.map((r, i) => (
              <div key={i} style={{ background: S.bg2, borderRadius: 10, border: "1px solid " + S.border, padding: "12px", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "#F43F5E", marginBottom: 4, letterSpacing: 1 }}>{r.q.cat} · {INT_LABELS[r.q.fatigue]}</div>
                <div style={{ fontSize: 11, color: S.muted, whiteSpace: "pre-line", marginBottom: 4, lineHeight: 1.5 }}>{r.q.q}</div>
                <div style={{ fontSize: 12, color: "#34D399", fontWeight: 700 }}>→ {r.q.a}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const reversed = [...history].reverse();

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, padding: "28px 20px 96px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, textTransform: "uppercase" }}>Sesiones anteriores</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: S.text, marginTop: 4 }}>Historial</div>
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: "center", color: S.muted, fontSize: 12, marginTop: 48 }}>
          Aun no hay sesiones registradas.<br />
          <span style={{ fontSize: 10, color: S.dim }}>Completa una sesion y guardala desde los resultados.</span>
        </div>
      ) : (
        <>
          {reversed.map((entry, i) => {
            const all     = entry.results.flat().filter(r => r && r.q);
            const correct = all.filter(r => r.correct).length;
            const score   = all.length ? Math.round((correct / all.length) * 100) : 0;
            const scoreColor = score >= 75 ? "#34D399" : score >= 55 ? "#FB923C" : "#F43F5E";
            const diffObj = DIFFICULTIES.find(d => d.id === entry.difficulty) || DIFFICULTIES[0];
            return (
              <button key={i} onClick={() => setSelected(entry)} style={{
                display: "block", width: "100%", textAlign: "left",
                background: S.bg2, border: "1px solid " + S.border,
                borderRadius: 12, padding: "16px", marginBottom: 10, cursor: "pointer",
                fontFamily: S.font,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 12, color: S.text, fontWeight: 700 }}>
                      {SESSION_TEMPLATES[entry.template]?.label}
                    </div>
                    <div style={{ fontSize: 9, color: S.muted, marginTop: 3 }}>{entry.date}</div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: scoreColor }}>{score}%</div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 9, color: S.muted }}>{ROLES.find(r => r.id === entry.role)?.label}</span>
                  <span style={{ fontSize: 9, color: S.dim }}>·</span>
                  <span style={{ fontSize: 9, color: S.muted }}>{diffObj.label}</span>
                  <span style={{ fontSize: 9, color: S.dim }}>·</span>
                  <span style={{ fontSize: 9, color: S.muted }}>{correct}/{all.length} correctas</span>
                </div>
              </button>
            );
          })}
          <button onClick={onClearHistory} style={{
            width: "100%", padding: "12px", marginTop: 8,
            background: "none", border: "1px solid " + S.border,
            borderRadius: 10, color: S.dim,
            fontFamily: S.font, fontSize: 9, letterSpacing: 1, cursor: "pointer",
          }}>BORRAR HISTORIAL</button>
        </>
      )}
    </div>
  );
}

// ─── EXERCISE TIMER ────────────────────────────────────────────────────────

function ExerciseTimer({ round, paused, onDone }) {
  const [stage,            setStage]            = useState("exercise");
  const [running,          setRunning]          = useState(true);
  const [questionRevealed, setQuestionRevealed] = useState(false);

  const ex          = round.exercise;
  const isTimeBased = !!ex.dur;

  const totalSecs = stage === "exercise"
    ? (isTimeBased ? ex.dur : 90)
    : stage === "rest"
      ? round.restSeconds
      : round.questionTimer;

  const handleStageDone = useCallback(() => {
    if (stage === "exercise") {
      setStage("rest");
      setRunning(true);
    } else if (stage === "rest") {
      if (round.question) {
        setStage("question");
        setRunning(true);
        setQuestionRevealed(false);
      } else {
        onDone(null);
      }
    } else if (stage === "question") {
      setQuestionRevealed(true);
    }
  }, [stage, round, onDone]);

  const active = running && !paused;
  const t      = useCountdown(totalSecs, active, handleStageDone);
  const pct    = totalSecs > 0 ? (t / totalSecs) * 100 : 0;

  const stageColor = stage === "exercise" ? round.phaseColor
    : stage === "rest" ? "#64748B"
    : "#A78BFA";

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: round.phaseColor }} />
        <div style={{ fontSize: 9, letterSpacing: 3, color: round.phaseColor, textTransform: "uppercase", flex: 1 }}>
          {round.phaseLabel} · Ronda {round.roundIndex}/{round.totalRounds}
        </div>
        <div style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 4,
          background: INT_COLORS[round.fatigueLevel] + "18",
          color: INT_COLORS[round.fatigueLevel], letterSpacing: 1,
        }}>{FAT_LABELS[round.fatigueLevel]}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 16px 0" }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: stageColor, textTransform: "uppercase", marginBottom: 12 }}>
          {stage === "exercise" ? "ejercicio" : stage === "rest" ? "descanso" : round.dualTask ? "¿la recordas?" : "pregunta cognitiva"}
        </div>

        {stage === "exercise" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: S.text }}>{ex.name}</div>
              {round.dualTask && (
                <span style={{
                  fontSize: 8, letterSpacing: 2, padding: "3px 7px", borderRadius: 4,
                  background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontWeight: 700,
                }}>DUAL TASK</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <span style={{
                padding: "4px 10px", borderRadius: 4,
                background: INT_COLORS[ex.intensity] + "18",
                color: INT_COLORS[ex.intensity], fontSize: 10, letterSpacing: 1,
              }}>{INT_LABELS[ex.intensity]}</span>
              <span style={{ color: S.muted, fontSize: 12, display: "flex", alignItems: "center" }}>
                {isTimeBased ? ex.dur + "s" : ex.reps + " " + ex.unit}
              </span>
            </div>
            {ex.desc && (
              <div style={{ fontSize: 11, color: S.dim, lineHeight: 1.6, marginBottom: 14 }}>
                {ex.desc}
              </div>
            )}
            {round.dualTask && round.question && (
              <div style={{
                background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 4,
              }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: "#FBBF24", marginBottom: 6, textTransform: "uppercase" }}>
                  Memoriza · vas a responder despues
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.text, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {round.question.q}
                </div>
              </div>
            )}
          </div>
        )}

        {stage === "rest" && (
          <div style={{ fontSize: 22, fontWeight: 700, color: S.muted, marginBottom: 16 }}>
            Recupera la respiracion
          </div>
        )}

        {stage === "question" && round.question && (
          <div>
            {round.question.context && (
              <div style={{
                background: "rgba(240,165,0,0.07)", border: "1px solid rgba(240,165,0,0.25)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 14,
                fontFamily: S.font,
              }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: "#F0A500", marginBottom: 7, textTransform: "uppercase" }}>Escenario</div>
                <div style={{ fontSize: 12, color: S.text, lineHeight: 1.7, whiteSpace: "pre-line", fontFamily: "monospace" }}>
                  {round.question.context}
                </div>
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 700, color: S.text, lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: 16 }}>
              {round.question.q}
            </div>
            {questionRevealed && (
              <div style={{
                background: "#0F172A", border: "1px solid #A78BFA55",
                borderRadius: 12, padding: "16px", marginBottom: 12,
                animation: "fadeIn .2s ease",
              }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#A78BFA", marginBottom: 6, textTransform: "uppercase" }}>Respuesta</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 6 }}>{round.question.a}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{round.question.d}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", margin: "auto 0 24px" }}>
          <div style={{ position: "relative", width: 160, height: 160 }}>
            <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="80" cy="80" r="70" fill="none" stroke={S.border} strokeWidth="8" />
              <circle cx="80" cy="80" r="70" fill="none"
                stroke={stageColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={"" + (2 * Math.PI * 70)}
                strokeDashoffset={"" + (2 * Math.PI * 70 * (1 - pct / 100))}
                style={{ transition: "stroke-dashoffset .8s linear" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: stageColor }}>{t}</span>
              <span style={{ fontSize: 10, color: S.muted, letterSpacing: 2 }}>SEG</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px 36px", display: "flex", gap: 10 }}>
        {stage === "question" && !questionRevealed && (
          <button onClick={() => { setRunning(false); setQuestionRevealed(true); }} style={{
            flex: 1, padding: "16px",
            background: "rgba(167,139,250,0.12)", border: "1.5px solid rgba(167,139,250,0.4)",
            borderRadius: 12, color: "#A78BFA",
            fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
          }}>✓ YA RESPONDI</button>
        )}
        {stage === "question" && questionRevealed && (
          <>
            <button onClick={() => onDone(false)} style={{
              flex: 1, padding: "16px",
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 12, color: "#F43F5E",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✗ ERRE</button>
            <button onClick={() => onDone(true)} style={{
              flex: 1, padding: "16px",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 12, color: "#34D399",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✓ ACERTE</button>
          </>
        )}
        {stage === "exercise" && !isTimeBased && (
          <button onClick={() => { setRunning(false); handleStageDone(); }} style={{
            flex: 1, padding: "16px",
            background: S.bg2, border: "1px solid " + S.border,
            borderRadius: 12, color: S.muted,
            fontFamily: S.font, fontSize: 11, letterSpacing: 2, cursor: "pointer",
          }}>LISTO ({ex.reps} {ex.unit}) → DESCANSO</button>
        )}
        {stage === "rest" && (
          <button onClick={() => { setRunning(false); handleStageDone(); }} style={{
            flex: 1, padding: "16px",
            background: S.bg2, border: "1px solid " + S.border,
            borderRadius: 12, color: S.muted,
            fontFamily: S.font, fontSize: 11, letterSpacing: 2, cursor: "pointer",
          }}>SALTEAR DESCANSO →</button>
        )}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── SPRINT SCREEN ─────────────────────────────────────────────────────────

function SprintScreen({ round, paused, onDone }) {
  const [qIdx,     setQIdx]     = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results,  setResults]  = useState([]);
  const [running,  setRunning]  = useState(true);

  const questions = round.questions;
  const current   = questions[qIdx];

  const handleDone = useCallback(() => setRevealed(true), []);
  const active     = running && !paused && !revealed;
  const t          = useCountdown(round.questionTimer, active, handleDone);
  const pct        = (t / round.questionTimer) * 100;
  const timerColor = t > round.questionTimer * 0.5 ? "#A78BFA" : t > 3 ? "#FB923C" : "#F43F5E";

  const next = (correct) => {
    const updated = [...results, { q: current, correct }];
    setResults(updated);
    if (qIdx + 1 >= questions.length) { onDone(updated); return; }
    setQIdx(qIdx + 1);
    setRevealed(false);
    setRunning(true);
  };

  if (!current) return null;

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: "#A78BFA" }} />
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#A78BFA", textTransform: "uppercase", flex: 1 }}>Sprint Mental</div>
        <div style={{ fontSize: 11, color: S.muted }}>{qIdx + 1}/{questions.length}</div>
      </div>

      <div style={{ padding: "10px 16px 0", display: "flex", gap: 4 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < qIdx ? "#34D399" : i === qIdx ? "#A78BFA" : S.border,
            transition: "background .3s",
          }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: "20px 16px 0" }}>
        <div style={{
          display: "inline-block", padding: "3px 8px", borderRadius: 4,
          background: CAT_COLORS[current.cat] + "18",
          border: "1px solid " + CAT_COLORS[current.cat] + "44",
          fontSize: 9, color: CAT_COLORS[current.cat], letterSpacing: 2, marginBottom: 16, textTransform: "uppercase",
        }}>{CAT_LABELS[current.cat]}</div>

        {current.context && (
          <div style={{
            background: "rgba(240,165,0,0.07)", border: "1px solid rgba(240,165,0,0.25)",
            borderRadius: 10, padding: "12px 14px", marginBottom: 14,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "#F0A500", marginBottom: 7, textTransform: "uppercase" }}>Escenario</div>
            <div style={{ fontSize: 12, color: S.text, lineHeight: 1.7, whiteSpace: "pre-line", fontFamily: "monospace" }}>
              {current.context}
            </div>
          </div>
        )}

        <div style={{ fontSize: 18, fontWeight: 700, color: S.text, lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: 20 }}>
          {current.q}
        </div>

        {!revealed && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", position: "relative", flexShrink: 0,
              background: "conic-gradient(" + timerColor + " " + (pct * 3.6) + "deg, " + S.border + " " + (pct * 3.6) + "deg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                position: "absolute", inset: 5, borderRadius: "50%", background: S.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: timerColor }}>{t}</span>
              </div>
            </div>
            <button onClick={() => { setRunning(false); setRevealed(true); }} style={{
              flex: 1, padding: "14px",
              background: "rgba(167,139,250,0.1)", border: "1.5px solid rgba(167,139,250,0.4)",
              borderRadius: 12, color: "#A78BFA",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            }}>✓ YA RESPONDI</button>
          </div>
        )}

        {revealed && (
          <div style={{
            background: "#0F172A", border: "1px solid #A78BFA55",
            borderRadius: 12, padding: "16px", marginBottom: 12,
            animation: "fadeIn .2s ease",
          }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#A78BFA", marginBottom: 6, textTransform: "uppercase" }}>Respuesta</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>{current.a}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{current.d}</div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px 36px", display: "flex", gap: 10 }}>
        {revealed ? (
          <>
            <button onClick={() => next(false)} style={{
              flex: 1, padding: "16px",
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 12, color: "#F43F5E",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✗ ERRE</button>
            <button onClick={() => next(true)} style={{
              flex: 1, padding: "16px",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 12, color: "#34D399",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✓ ACERTE</button>
          </>
        ) : <div style={{ flex: 1 }} />}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── RESULTS SCREEN ────────────────────────────────────────────────────────

function ResultsScreen({ sessionResults, sessionMeta, onRestart, onSave }) {
  const [saved, setSaved] = useState(false);

  const all      = sessionResults.flat().filter(r => r && r.q);
  const correct  = all.filter(r => r.correct).length;
  const total    = all.length;
  const score    = total ? Math.round((correct / total) * 100) : 0;
  const scoreColor = score >= 75 ? "#34D399" : score >= 55 ? "#FB923C" : "#F43F5E";

  const byCat = {};
  all.forEach(r => {
    const c = r.q.cat;
    if (!byCat[c]) byCat[c] = { correct: 0, total: 0 };
    byCat[c].total++;
    if (r.correct) byCat[c].correct++;
  });

  const wrongOnes = all.filter(r => !r.correct);
  const diffObj   = DIFFICULTIES.find(d => d.id === sessionMeta?.difficulty) || DIFFICULTIES[0];

  const handleSave = () => {
    onSave();
    setSaved(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, padding: "28px 20px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: 32, paddingTop: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: S.muted, marginBottom: 10, textTransform: "uppercase" }}>
          Resultado · {diffObj.label}
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: scoreColor }}>{score}%</div>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 10 }}>
          {correct} correctas · {total - correct} errores · {total} preguntas
        </div>
      </div>

      {Object.keys(byCat).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, marginBottom: 12, textTransform: "uppercase" }}>Por categoria</div>
          {Object.entries(byCat).map(([cat, v]) => {
            const p = Math.round((v.correct / v.total) * 100);
            const c = CAT_COLORS[cat] || "#64748B";
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: c, letterSpacing: 2 }}>{CAT_LABELS[cat]}</span>
                  <span style={{ fontSize: 10, color: S.muted }}>{v.correct}/{v.total} · {p}%</span>
                </div>
                <div style={{ height: 4, background: S.border, borderRadius: 2 }}>
                  <div style={{ height: "100%", width: p + "%", background: c, borderRadius: 2, transition: "width .5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wrongOnes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, marginBottom: 12, textTransform: "uppercase" }}>
            Para repasar ({wrongOnes.length})
          </div>
          {wrongOnes.map((r, i) => (
            <div key={i} style={{ background: S.bg2, borderRadius: 10, border: "1px solid " + S.border, padding: "13px", marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: "#F43F5E", marginBottom: 4, letterSpacing: 1 }}>{r.q.cat} · {INT_LABELS[r.q.fatigue]}</div>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 4, whiteSpace: "pre-line", lineHeight: 1.5 }}>{r.q.q}</div>
              <div style={{ fontSize: 13, color: "#34D399", fontWeight: 700 }}>→ {r.q.a}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!saved ? (
          <button onClick={handleSave} style={{
            width: "100%", padding: "14px",
            background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
            borderRadius: 12, color: "#34D399",
            fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
          }}>💾 GUARDAR EN HISTORIAL</button>
        ) : (
          <div style={{ textAlign: "center", fontSize: 11, color: "#34D399", padding: "8px 0" }}>
            ✓ Sesion guardada en historial
          </div>
        )}
        <button onClick={onRestart} style={{
          width: "100%", padding: "16px",
          background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
          border: "none", borderRadius: 12, color: "#fff",
          fontFamily: S.font, fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
        }}>NUEVA SESION</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────

export default function App() {
  const [navScreen,    setNavScreen]    = useState("home");
  const [sessionState, setSessionState] = useState(null);
  const [paused,       setPaused]       = useState(false);
  const [customQ,      setCustomQ]      = useLocalStorage(LS.customQ, []);
  const [history,      setHistory]      = useLocalStorage(LS.history, []);
  const [settings,     setSettings]     = useLocalStorage(LS.settings, { difficulty: "hard" });

  const allQ       = getAllQuestions(customQ);
  const isInSession = sessionState !== null;

  const handleStart = (template, role, difficulty) => {
    const rounds = buildSession(template, role, difficulty, allQ);
    setSessionState({ rounds, roundIdx: 0, results: [], meta: { template, role, difficulty }, done: false });
    setPaused(false);
  };

  const handleRoundDone = (result) => {
    setSessionState(prev => {
      if (!prev) return prev;
      const qResult = Array.isArray(result)
        ? result
        : result !== null
          ? [{ q: prev.rounds[prev.roundIdx]?.question, correct: result }]
          : [];
      const newResults = [...prev.results, qResult];
      const nextIdx    = prev.roundIdx + 1;
      const done       = nextIdx >= prev.rounds.length;
      return { ...prev, results: newResults, roundIdx: nextIdx, done };
    });
  };

  const handleSaveHistory = () => {
    if (!sessionState) return;
    setHistory(h => [...h, {
      date:       new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
      template:   sessionState.meta.template,
      role:       sessionState.meta.role,
      difficulty: sessionState.meta.difficulty,
      results:    sessionState.results,
    }]);
  };

  const handleRestart = () => {
    setSessionState(null);
    setPaused(false);
  };

  const handleClearHistory = () => {
    if (window.confirm("Borrar todo el historial?")) setHistory([]);
  };

  if (isInSession) {
    if (sessionState.done) {
      return (
        <>
          <ResultsScreen
            sessionResults={sessionState.results}
            sessionMeta={sessionState.meta}
            onRestart={handleRestart}
            onSave={handleSaveHistory}
          />
          <style>{`body{margin:0;background:#060C14}`}</style>
        </>
      );
    }

    const round = sessionState.rounds[sessionState.roundIdx];
    if (!round) return null;

    return (
      <>
        {paused && <PauseOverlay onResume={() => setPaused(false)} />}
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            position: "fixed", top: 14, right: 16, zIndex: 150,
            background: S.bg2, border: "1px solid " + S.border,
            borderRadius: 8, padding: "8px 14px",
            color: S.muted, fontFamily: S.font, fontSize: 10,
            cursor: "pointer", letterSpacing: 1,
          }}
        >⏸ PAUSA</button>

        {round.type === "sprint"
          ? <SprintScreen  key={sessionState.roundIdx} round={round} paused={paused} onDone={handleRoundDone} />
          : <ExerciseTimer key={sessionState.roundIdx} round={round} paused={paused} onDone={handleRoundDone} />
        }
        <style>{`body{margin:0;background:#060C14}`}</style>
      </>
    );
  }

  return (
    <>
      {navScreen === "home" && (
        <HomeScreen onStart={handleStart} settings={settings} setSettings={setSettings} />
      )}
      {navScreen === "library" && (
        <LibraryScreen customQ={customQ} setCustomQ={setCustomQ} />
      )}
      {navScreen === "history" && (
        <HistoryScreen history={history} onClearHistory={handleClearHistory} />
      )}
      <BottomNav screen={navScreen} setScreen={setNavScreen} />
      <style>{`body{margin:0;background:#060C14}`}</style>
    </>
  );
}
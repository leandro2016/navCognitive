import { useState, useEffect, useRef, useCallback } from "react";
import BUILTIN_QUESTIONS from "./Questions/naut-preguntas-2026-06-18.json";

// ─── LIB MODULES ───────────────────────────────────────────────────────────
import {
  LS, SCHEMA_VERSION, DIFFICULTIES, CAT_COLORS, CAT_LABELS, CAT_DESC, CAT_ORDER,
  INT_COLORS, INT_LABELS, ROLE_MAP,
  FAT_LABELS, RPE_TO_FATIGUE, RPE_LABELS, S, SESSION_TEMPLATES, PHASE_EX_MAP,
  PHASE_Q_MAP, ROLES,
} from "./src/lib/constants.js";
import {
  shuffle, getAllQuestions, getMaxId, nextCustomId, normalizeQuestion,
  getDueReviews, getOverdueCount, updateReviews,
  computeCategoryStats, categoryWeights, weightedShuffle,
  getQuestionsForPhase, getExercisesForPhase, buildSession,
  downloadJSON, validateImportedQuestions, migrateSchema,
} from "./src/lib/session.js";
import { CUE, vibrate, acquireWakeLock, releaseWakeLock } from "./src/lib/feedback.js";
import { useLocalStorage, useCountdown } from "./src/lib/hooks.js";

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

function PauseOverlay({ onResume, onSaveExit, onExitNoSave }) {
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
        marginBottom: 14,
      }}>CONTINUAR</button>
      <button onClick={onSaveExit} style={{
        padding: "12px 32px",
        background: "none", border: "1px solid " + S.border,
        borderRadius: 10, color: S.muted,
        fontFamily: S.font, fontSize: 10, letterSpacing: 2, cursor: "pointer",
        marginBottom: 10,
      }}>💾 GUARDAR Y SALIR</button>
      <button onClick={onExitNoSave} style={{
        padding: "12px 32px",
        background: "none", border: "1px solid rgba(244,63,94,0.3)",
        borderRadius: 10, color: "#F43F5E",
        fontFamily: S.font, fontSize: 10, letterSpacing: 2, cursor: "pointer",
      }}>✕ SALIR SIN GUARDAR</button>
    </div>
  );
}

// ─── HOME SCREEN ───────────────────────────────────────────────────────────

function HomeScreen({ onStart, onResumeSaved, savedSession, settings, setSettings, reviews }) {
  const [template,   setTemplate]   = useState("30min");
  const [role,       setRole]       = useState("ALL");
  const [difficulty, setDifficulty] = useState(settings.difficulty || "hard");
  const [customCats, setCustomCats] = useState(["NAV", "MAN", "DEC", "REG", "SIT"]);
  const [customCount, setCustomCount] = useState(15);

  const diff = DIFFICULTIES.find(d => d.id === difficulty);
  const dueCount = getOverdueCount(reviews);

  const handleStart = () => {
    setSettings(s => ({ ...s, difficulty }));
    onStart(template, role, difficulty, { cats: customCats, count: customCount });
  };

  const DIFFICULTY_OPTIONS = DIFFICULTIES.filter(d => d.id !== "notimer" && d.id !== "shrinking");

  const toggleCustomCat = (cat) => {
    setCustomCats(prev => {
      if (prev.includes(cat)) {
        if (prev.length <= 1) return prev;
        return prev.filter(c => c !== cat);
      }
      return [...prev, cat];
    });
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

      {savedSession && (
        <div style={{
          width: "100%", maxWidth: 380, marginBottom: 20,
          background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.3)",
          borderRadius: 12, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#0EA5E9", marginBottom: 6, textTransform: "uppercase" }}>Sesion guardada</div>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>
            {SESSION_TEMPLATES[savedSession.meta.template]?.label} · Ronda {savedSession.roundIdx + 1}/{savedSession.rounds.length}
          </div>
          <button onClick={onResumeSaved} style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
            border: "none", borderRadius: 10, color: "#fff",
            fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
          }}>▶ CONTINUAR SESION</button>
        </div>
      )}

      <Section label="Duracion">
        {Object.entries(SESSION_TEMPLATES).map(([k, v]) => (
          <ChoiceBtn key={k} active={template === k} color={k === "walk" ? "#34D399" : k === "custom" ? "#FBBF24" : k === "repaso" ? "#F472B6" : "#0EA5E9"} onClick={() => setTemplate(k)}>
            <strong>{v.label}</strong>
            {k !== "custom" && k !== "repaso" && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 10 }}>{v.phases.length} fases</span>}
            {k === "walk" && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 10 }}>30s/pregunta</span>}
            {k === "custom" && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 10 }}>Vos elegis</span>}
            {k === "repaso" && (
              <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 10 }}>
                {dueCount > 0 ? dueCount + " pendientes" : "sin pendientes"}
              </span>
            )}
          </ChoiceBtn>
        ))}
      </Section>

      {template === "custom" && (
        <Section label="Categorias">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {CAT_ORDER.map(c => {
              const active = customCats.includes(c);
              const col = CAT_COLORS[c];
              return (
                <button key={c} title={CAT_DESC[c]} onClick={() => toggleCustomCat(c)} style={{
                  padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                  background: active ? col + "22" : S.bg2,
                  border: active ? "1.5px solid " + col : "1.5px solid " + S.border,
                  color: active ? col : S.muted,
                  fontFamily: S.font, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                }}>{c}</button>
              );
            })}
          </div>
          {customCats.length === 1 && (
            <div style={{ fontSize: 10, color: CAT_COLORS[customCats[0]], marginBottom: 10, lineHeight: 1.5 }}>
              {CAT_DESC[customCats[0]]}
            </div>
          )}
          <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>
            Cantidad de preguntas
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[5, 10, 15, 20, 30].map(n => (
              <button key={n} onClick={() => setCustomCount(n)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 8, cursor: "pointer",
                background: customCount === n ? "rgba(251,191,36,0.15)" : S.bg2,
                border: customCount === n ? "1.5px solid #FBBF24" : "1.5px solid " + S.border,
                color: customCount === n ? "#FBBF24" : S.muted,
                fontFamily: S.font, fontSize: 11, fontWeight: 700,
              }}>{n}</button>
            ))}
          </div>
        </Section>
      )}

      <Section label="Tu rol hoy">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ROLES.map(r => (
            <ChoiceBtn key={r.id} active={role === r.id} color={r.color}
              extraStyle={{ flex: "1 1 40%", width: "auto", marginBottom: 0 }}
              onClick={() => setRole(r.id)}>
              {r.label}
            </ChoiceBtn>
          ))}
        </div>
        <div style={{ fontSize: 10, color: ROLE_MAP[role]?.color || S.dim, marginTop: 8, lineHeight: 1.5 }}>
          {ROLE_MAP[role]?.desc || "Preguntas de maniobra filtradas por rol + generales ALL."}
        </div>
      </Section>

      <Section label="Dificultad">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DIFFICULTY_OPTIONS.map(d => {
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
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <ChoiceBtn active={difficulty === "notimer"} color="#64748B"
            extraStyle={{ flex: 1, textAlign: "center", marginBottom: 0 }}
            onClick={() => setDifficulty("notimer")}>
            Sin reloj
          </ChoiceBtn>
          <ChoiceBtn active={difficulty === "shrinking"} color="#FBBF24"
            extraStyle={{ flex: 1, textAlign: "center", marginBottom: 0 }}
            onClick={() => setDifficulty("shrinking")}>
            Degradable
          </ChoiceBtn>
        </div>
        {difficulty === "shrinking" && (
          <div style={{ fontSize: 10, color: "#FBBF24", marginTop: 8, lineHeight: 1.7 }}>
            Timer actual: {settings.shrinkingBase || 10}s
            {settings.personalBest && settings.personalBest < Infinity && (
              <span style={{ color: S.muted }}> · Record: {settings.personalBest}s prom.</span>
            )}
            <br /><span style={{ color: S.dim }}>Baja 1s automaticamente por sesion completada</span>
          </div>
        )}
        {diff && difficulty !== "shrinking" && (
          <div style={{ fontSize: 10, color: S.dim, marginTop: 8, lineHeight: 1.7 }}>
            {difficulty === "notimer"
              ? "Sin timer · Solo precision · Ideal para repasar"
              : `Sprint: ${diff.sprintTime}s/pregunta · Descanso: ${diff.restSeconds}s${difficulty === "brutal" ? " · Solo preguntas dificiles" : ""}`}
          </div>
        )}
      </Section>

      <Section label="Fases">
        {template === "walk" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
            <div style={{ width: 3, height: 32, borderRadius: 2, background: "#34D399", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: S.text, fontWeight: 700 }}>Caminata continua</div>
              <div style={{ fontSize: 10, color: S.muted }}>20 min · 1 pregunta cada 30s · Sin ejercicios</div>
            </div>
          </div>
        )}
        {template === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
            <div style={{ width: 3, height: 32, borderRadius: 2, background: "#FBBF24", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: S.text, fontWeight: 700 }}>{customCount} preguntas · {customCats.map(c => CAT_LABELS[c]).join(" + ")}</div>
              <div style={{ fontSize: 10, color: S.muted }}>Sin ejercicios · Sprint puro · Timer: {diff?.sprintTime || 10}s</div>
            </div>
          </div>
        )}
        {template === "repaso" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
            <div style={{ width: 3, height: 32, borderRadius: 2, background: "#F472B6", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: S.text, fontWeight: 700 }}>Repaso espaciado</div>
              <div style={{ fontSize: 10, color: S.muted }}>
                {dueCount > 0 ? dueCount + " preguntas pendientes" : "Sin pendientes · repaso general"} · Timer: {diff?.sprintTime || 10}s
              </div>
            </div>
          </div>
        )}
        {template !== "walk" && template !== "custom" && template !== "repaso" && SESSION_TEMPLATES[template].phases.map(p => (
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
  const [form, setForm] = useState({ cat: "NAV", role: "ALL", fatigue: 2, q: "", a: "", d: "", tags: [], difficulty: null });
  const fileRef = useRef(null);

  const allQ       = getAllQuestions(customQ);
  const builtinIds = new Set(BUILTIN_QUESTIONS.map(q => q.id));
  const filtered   = filterCat === "ALL" ? allQ : allQ.filter(q => q.cat === filterCat);

  const openNew = () => {
    setForm({ cat: "NAV", role: "ALL", fatigue: 2, q: "", a: "", d: "", tags: [], difficulty: null });
    setEditingId("new");
  };

  const openEdit = (q) => {
    setForm({ cat: q.cat, role: q.role, fatigue: q.fatigue, q: q.q, a: q.a, d: q.d || "", tags: q.tags || [], difficulty: q.difficulty ?? null });
    setEditingId(q.id);
  };

  const saveForm = () => {
    if (!form.q.trim() || !form.a.trim()) return;
    const tagsArr = Array.isArray(form.tags)
      ? form.tags.flatMap(s => String(s).split(",").map(x => x.trim())).filter(Boolean)
      : [];
    const payload = { ...form, tags: tagsArr, difficulty: form.difficulty || null, fatigue: Number(form.fatigue) };
    if (editingId === "new") {
      setCustomQ(prev => [...prev, { ...payload, id: nextCustomId(getAllQuestions(prev)) }]);
    } else {
      setCustomQ(prev => prev.map(q => q.id === editingId ? { ...q, ...payload } : q));
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
      let nextId = nextCustomId(allQ);
      const withIds = newOnes.map(q => ({ ...q, id: nextId-- }));
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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CAT_ORDER.map(c => (
              <button key={c} title={CAT_DESC[c]} onClick={() => setForm(f => ({ ...f, cat: c }))} style={{
                padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                background: form.cat === c ? CAT_COLORS[c] + "22" : S.bg2,
                border: form.cat === c ? "1.5px solid " + CAT_COLORS[c] : "1.5px solid " + S.border,
                color: form.cat === c ? CAT_COLORS[c] : S.muted,
                fontFamily: S.font, fontSize: 10, fontWeight: 700,
              }}>{c}</button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: CAT_COLORS[form.cat] || S.dim, marginTop: 6, lineHeight: 1.4 }}>
            {CAT_DESC[form.cat] || ""}
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
        <FormField label="Tags (separados por coma)" value={Array.isArray(form.tags) ? form.tags.join(", ") : ""} onChange={v => setForm(f => ({ ...f, tags: v.split(",").map(x => x.trim()) }))} placeholder="rumbo, corriente" />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: S.muted, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Dificultad (1-5, opcional)</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[null, 1, 2, 3, 4, 5].map(f => {
              const active = (form.difficulty ?? null) === f;
              return (
                <button key={String(f)} onClick={() => setForm(fv => ({ ...fv, difficulty: f }))} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 8, cursor: "pointer",
                  background: active ? "rgba(56,189,248,0.15)" : S.bg2,
                  border: active ? "1.5px solid #38BDF8" : "1.5px solid " + S.border,
                  color: active ? "#38BDF8" : S.muted,
                  fontFamily: S.font, fontSize: 10, fontWeight: 700,
                }}>{f === null ? "—" : f}</button>
              );
            })}
          </div>
        </div>

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
            fatigue: 1=Baja · 2=Media · 3=Alta &nbsp; | &nbsp; cat: NAV/MAN/DEC/REG/SIT/TRIM/TACT/METEO/SEG &nbsp; | &nbsp; role: ALL/GEN/MAY/PRO/TAC/TIM/PIT/NAVEG/TOD
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
        <button onClick={() => setFilterCat("ALL")} style={{
          padding: "6px 12px", borderRadius: 6, cursor: "pointer",
          background: filterCat === "ALL" ? "#64748B22" : S.bg2,
          border: "1px solid " + (filterCat === "ALL" ? "#64748B" : S.border),
          color: filterCat === "ALL" ? "#64748B" : S.muted,
          fontFamily: S.font, fontSize: 9, fontWeight: 700, letterSpacing: 1,
        }}>TODAS ({allQ.length})</button>
        {CAT_ORDER.map(c => {
          const count = allQ.filter(q => q.cat === c).length;
          if (count === 0) return null;
          const col = CAT_COLORS[c];
          return (
            <button key={c} title={CAT_DESC[c]} onClick={() => setFilterCat(c)} style={{
              padding: "6px 12px", borderRadius: 6, cursor: "pointer",
              background: filterCat === c ? col + "22" : S.bg2,
              border: "1px solid " + (filterCat === c ? col : S.border),
              color: filterCat === c ? col : S.muted,
              fontFamily: S.font, fontSize: 9, fontWeight: 700, letterSpacing: 1,
            }}>{c} ({count})</button>
          );
        })}
      </div>

      {filtered.map((q, idx) => {
        const isCustom  = !builtinIds.has(q.id);
        const catColor  = CAT_COLORS[q.cat] || S.muted;
        return (
          <div key={q.id + '-' + idx} style={{
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
              {q.role && q.role !== "ALL" && ROLE_MAP[q.role] && (
                <span style={{
                  fontSize: 8, padding: "2px 7px", borderRadius: 4,
                  background: ROLE_MAP[q.role].color + "18", color: ROLE_MAP[q.role].color, letterSpacing: 1, fontWeight: 700,
                }}>{ROLE_MAP[q.role].label}</span>
              )}
              {isCustom && (
                <span style={{ fontSize: 8, color: "#A78BFA", marginLeft: "auto" }}>CUSTOM</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: S.text, lineHeight: 1.55, whiteSpace: "pre-line", marginBottom: 5 }}>{q.q}</div>
            <div style={{ fontSize: 11, color: "#34D399", fontWeight: 700 }}>→ {q.a}</div>
            {q.d && <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>{q.d}</div>}
            {Array.isArray(q.tags) && q.tags.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                {q.tags.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 8, padding: "1px 6px", borderRadius: 3,
                    background: S.bg3, color: S.dim, letterSpacing: 0.5,
                  }}>#{t}</span>
                ))}
              </div>
            )}
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
  const [qStart,           setQStart]           = useState(Date.now());
  const [qTimeUp,          setQTimeUp]          = useState(false);
  const [rpe,              setRpe]              = useState(null);

  const ex          = round.exercise;
  const isTimeBased = !!ex.dur;

  const totalSecs = stage === "exercise"
    ? (isTimeBased ? ex.dur : 90)
    : stage === "rest"
      ? round.restSeconds
      : round.questionTimer;

  const handleStageDone = useCallback(() => {
    if (stage === "exercise") {
      CUE.stage(); vibrate(60);
      setStage("rpe");
      setRunning(false);
    } else if (stage === "rest") {
      if (round.question) {
        CUE.stage(); vibrate(60);
        setStage("question");
        setRunning(true);
        setQuestionRevealed(false);
        setQStart(Date.now());
      } else {
        onDone(null);
      }
    } else if (stage === "question") {
      CUE.timeUp(); vibrate([100, 50, 100]);
      setQTimeUp(true);
      setRunning(false);
    }
  }, [stage, round, onDone]);

  const submitRpe = (val) => {
    setRpe(val);
    CUE.tick(); vibrate(30);
    setStage("rest");
    setRunning(true);
  };

  const isNoTimer = round.questionTimer >= 90;
  const active = running && !paused && !(stage === "question" && isNoTimer);
  const t      = useCountdown(totalSecs, active, handleStageDone);
  const pct    = totalSecs > 0 ? (t / totalSecs) * 100 : 0;

  const stageColor = stage === "exercise" ? round.phaseColor
    : stage === "rest" ? "#64748B"
    : "#A78BFA";

  const timerColor = t > totalSecs * 0.5 ? stageColor : t > 3 ? "#FB923C" : "#F43F5E";

  // keyboard shortcuts during the question stage
  useEffect(() => {
    if (stage !== "question") return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!questionRevealed && !qTimeUp) { setRunning(false); setQuestionRevealed(true); }
        else if (qTimeUp && !questionRevealed) { setQuestionRevealed(true); }
      } else if (e.key === "ArrowLeft" && questionRevealed) {
        e.preventDefault(); CUE.wrong(); vibrate(120);
        onDone({ correct: false, time: (Date.now() - qStart) / 1000, rpe });
      } else if (e.key === "ArrowRight" && questionRevealed) {
        e.preventDefault(); CUE.correct(); vibrate(40);
        onDone({ correct: true, time: (Date.now() - qStart) / 1000, rpe });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

        {stage === "rpe" && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#FBBF24", textTransform: "uppercase", marginBottom: 10 }}>
              ¿Cuanto te costo? (RPE)
            </div>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>
              {rpe ? RPE_LABELS[rpe] + " (" + rpe + "/10)" : "Tocá un valor del 1 al 10"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 16 }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const fat = RPE_TO_FATIGUE[n];
                const col = INT_COLORS[fat];
                return (
                  <button key={n} onClick={() => submitRpe(n)} style={{
                    padding: "14px 0", borderRadius: 8, cursor: "pointer",
                    background: rpe === n ? col + "22" : S.bg2,
                    border: rpe === n ? "1.5px solid " + col : "1.5px solid " + S.border,
                    color: rpe === n ? col : S.muted,
                    fontFamily: S.font, fontSize: 13, fontWeight: 700,
                  }}>{n}</button>
                );
              })}
            </div>
            <button onClick={() => submitRpe(rpe || 5)} style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
              border: "none", borderRadius: 10, color: "#fff",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            }}>CONFIRMAR → DESCANSO</button>
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
          {round.questionTimer < 90 ? (
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
          ) : (
            <div style={{ fontSize: 9, letterSpacing: 3, color: S.dim, textTransform: "uppercase" }}>Sin reloj</div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px 36px", display: "flex", gap: 10 }}>
        {stage === "question" && !questionRevealed && !qTimeUp && (
          <button onClick={() => { setRunning(false); setQuestionRevealed(true); }} style={{
            flex: 1, padding: "16px",
            background: "rgba(167,139,250,0.12)", border: "1.5px solid rgba(167,139,250,0.4)",
            borderRadius: 12, color: "#A78BFA",
            fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
          }}>✓ YA RESPONDI</button>
        )}
        {stage === "question" && !questionRevealed && qTimeUp && (
          <button onClick={() => setQuestionRevealed(true)} style={{
            flex: 1, padding: "16px",
            background: "rgba(251,191,36,0.1)", border: "1.5px solid rgba(251,191,36,0.4)",
            borderRadius: 12, color: "#FBBF24",
            fontFamily: S.font, fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            animation: "pulse 1.5s ease-in-out infinite",
          }}>VER RESPUESTA →</button>
        )}
        {stage === "question" && questionRevealed && (
          <>
            <button onClick={() => { CUE.wrong(); vibrate(120); next(false); }} style={{
              flex: 1, padding: "16px",
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 12, color: "#F43F5E",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✗ ERRE</button>
            <button onClick={() => { CUE.correct(); vibrate(40); next(true); }} style={{
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
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`}</style>
    </div>
  );
}

// ─── SPRINT SCREEN ─────────────────────────────────────────────────────────

function SprintScreen({ round, paused, onDone }) {
  const [qIdx,     setQIdx]     = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results,  setResults]  = useState([]);
  const [running,  setRunning]  = useState(true);
  const [qStart,   setQStart]   = useState(Date.now());
  const [qTimeUp,  setQTimeUp]  = useState(false);

  const questions = round.questions;
  const current   = questions[qIdx];
  const isWalk    = round.isWalk;

  const handleDone = useCallback(() => {
    CUE.timeUp(); vibrate([100, 50, 100]);
    setQTimeUp(true);
    setRunning(false);
  }, []);
  const isNoTimer  = round.questionTimer >= 90;
  const active     = running && !paused && !revealed && !isNoTimer;
  const t          = useCountdown(round.questionTimer, active, handleDone);
  const pct        = isNoTimer ? 100 : (t / round.questionTimer) * 100;
  const timerColor = t > round.questionTimer * 0.5 ? "#A78BFA" : t > 3 ? "#FB923C" : "#F43F5E";

  const revealAnswer = () => {
    setRevealed(true);
    setQTimeUp(false);
  };

  const next = (correct) => {
    const elapsed = (Date.now() - qStart) / 1000;
    const updated = [...results, { q: current, correct, time: elapsed }];
    setResults(updated);
    if (qIdx + 1 >= questions.length) { onDone(updated); return; }
    setQIdx(qIdx + 1);
    setRevealed(false);
    setRunning(true);
    setQTimeUp(false);
    setQStart(Date.now());
  };

  // keyboard shortcuts: Space=reveal/ya respondi, ArrowLeft=erre, ArrowRight=acerte
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === " " || e.code === "Space") {
        if (!revealed && !qTimeUp) { e.preventDefault(); setRunning(false); revealAnswer(); }
      } else if (e.key === "ArrowLeft" && revealed) {
        e.preventDefault(); CUE.wrong(); vibrate(120); next(false);
      } else if (e.key === "ArrowRight" && revealed) {
        e.preventDefault(); CUE.correct(); vibrate(40); next(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

        {!revealed && !qTimeUp && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {round.questionTimer < 90 && (
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
            )}
            <button onClick={() => { setRunning(false); revealAnswer(); }} style={{
              flex: 1, padding: "14px",
              background: "rgba(167,139,250,0.1)", border: "1.5px solid rgba(167,139,250,0.4)",
              borderRadius: 12, color: "#A78BFA",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            }}>✓ YA RESPONDI</button>
          </div>
        )}

        {qTimeUp && !revealed && (
          <button onClick={revealAnswer} style={{
            width: "100%", padding: "16px", marginBottom: 16,
            background: "rgba(251,191,36,0.1)", border: "1.5px solid rgba(251,191,36,0.4)",
            borderRadius: 12, color: "#FBBF24",
            fontFamily: S.font, fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            animation: "pulse 1.5s ease-in-out infinite",
          }}>VER RESPUESTA →</button>
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
            <button onClick={() => { CUE.wrong(); vibrate(120); next(false); }} style={{
              flex: 1, padding: "16px",
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 12, color: "#F43F5E",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✗ ERRE</button>
            <button onClick={() => { CUE.correct(); vibrate(40); next(true); }} style={{
              flex: 1, padding: "16px",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 12, color: "#34D399",
              fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>✓ ACERTE</button>
          </>
        ) : <div style={{ flex: 1 }} />}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`}</style>
    </div>
  );
}

// ─── RESULTS SCREEN ────────────────────────────────────────────────────────

function ResultsScreen({ sessionResults, sessionMeta, onRestart, onSave, settings }) {
  const [saved, setSaved] = useState(false);
  const [showPR, setShowPR] = useState(false);

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

  // fatigue curve: RPE per round (exercise rounds only carry rpe)
  const rpePoints = sessionResults
    .flat()
    .map(r => r?.rpe)
    .filter(r => typeof r === "number");
  const hasRpe = rpePoints.length > 0;

  const handleSave = () => {
    onSave();
    setSaved(true);
    if (sessionMeta?.difficulty === "shrinking" && settings?.newPR) {
      setShowPR(true);
    }
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

      {showPR && (
        <div style={{
          marginBottom: 24, padding: "16px",
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 12, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#FBBF24", letterSpacing: 2, marginBottom: 4 }}>
            NUEVO RECORD PERSONAL
          </div>
          <div style={{ fontSize: 11, color: S.muted }}>
            Promedio: {settings?.personalBest}s · Timer proximo: {(settings?.shrinkingBase || 10)}s
          </div>
        </div>
      )}

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

      {hasRpe && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: S.muted, marginBottom: 12, textTransform: "uppercase" }}>
            Curva de fatiga (RPE)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60, padding: "0 2px" }}>
            {rpePoints.map((rpe, i) => {
              const h = (rpe / 10) * 100;
              const col = INT_COLORS[RPE_TO_FATIGUE[rpe]] || S.muted;
              return (
                <div key={i} title={"Ronda " + (i + 1) + ": " + rpe + "/10"} style={{
                  flex: 1, minWidth: 6, height: h + "%",
                  background: col, borderRadius: 2, opacity: 0.85,
                  transition: "height .4s",
                }} />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: S.dim, marginTop: 6 }}>
            <span>Inicio</span>
            <span>Fin · promedio {Math.round(rpePoints.reduce((a, b) => a + b, 0) / rpePoints.length * 10) / 10}/10</span>
          </div>
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
  // run schema migration once on mount
  useEffect(() => { migrateSchema(); }, []);

  const [navScreen,    setNavScreen]    = useState("home");
  const [sessionState, setSessionState] = useState(null);
  const [paused,       setPaused]       = useState(false);
  const [customQ,      setCustomQ]      = useLocalStorage(LS.customQ, []);
  const [history,      setHistory]      = useLocalStorage(LS.history, []);
  const [settings,     setSettings]     = useLocalStorage(LS.settings, { difficulty: "hard" });
  const [savedSession, setSavedSession] = useLocalStorage(LS.savedSession, null);
  const [reviews,      setReviews]      = useLocalStorage(LS.reviews, {});

  const allQ        = getAllQuestions(customQ);
  const isInSession = sessionState !== null;

  // persist session on every round so phone sleep/calls don't lose progress
  useEffect(() => {
    if (sessionState && !sessionState.done) {
      setSavedSession(sessionState);
    } else if (sessionState?.done) {
      setSavedSession(null);
    }
  }, [sessionState]);

  // keep screen awake during a session, release when done/idle
  useEffect(() => {
    if (isInSession && !sessionState.done) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [isInSession, sessionState?.done]);

  // play completion cue when session transitions to done
  const prevDoneRef = useRef(false);
  useEffect(() => {
    const done = !!sessionState?.done;
    if (done && !prevDoneRef.current) { CUE.done(); vibrate([60, 40, 60, 40, 120]); }
    prevDoneRef.current = done;
  }, [sessionState?.done]);

  const handleStart = (template, role, difficulty, opts) => {
    let effectiveOpts = { ...opts };
    if (difficulty === "shrinking") {
      const base = settings.shrinkingBase || 10;
      effectiveOpts.shrinkingBase = base;
    }
    if (template === "repaso") {
      effectiveOpts.reviews = reviews;
    }
    // adaptive category weighting from history
    const stats = computeCategoryStats(history);
    effectiveOpts.weights = categoryWeights(stats);
    const rounds = buildSession(template, role, difficulty, allQ, effectiveOpts);
    setSavedSession(null);
    setSessionState({ rounds, roundIdx: 0, results: [], meta: { template, role, difficulty }, done: false });
    setPaused(false);
  };

  const handleResumeSaved = () => {
    if (!savedSession) return;
    setSessionState(savedSession);
    setPaused(false);
  };

  const handleSaveExit = () => {
    // savedSession already persisted via useEffect — just exit
    setSessionState(null);
    setPaused(false);
  };

  const handleExitNoSave = () => {
    if (!window.confirm("Salir sin guardar? Se perdera el progreso de esta sesion.")) return;
    setSavedSession(null);
    setSessionState(null);
    setPaused(false);
  };

  const handleRoundDone = (result) => {
    setSessionState(prev => {
      if (!prev) return prev;
      let qResult;
      const round = prev.rounds[prev.roundIdx];
      if (Array.isArray(result)) {
        qResult = result;
      } else if (result !== null && typeof result === "object") {
        qResult = [{ q: round?.question, correct: result.correct, time: result.time, rpe: result.rpe ?? null }];
      } else if (result !== null) {
        qResult = [{ q: round?.question, correct: result }];
      } else {
        qResult = [];
      }
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
    setSavedSession(null);

    // update spaced-repetition state from this session's results
    const flatResults = sessionState.results.flat().filter(r => r && r.q);
    if (flatResults.length > 0) {
      setReviews(prev => updateReviews(prev, flatResults));
    }

    if (sessionState.meta.difficulty === "shrinking") {
      const allTimes = sessionState.results.flat().filter(r => r && r.time).map(r => r.time);
      const avgTime = allTimes.length ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : null;
      setSettings(s => {
        const newBase = Math.max(3, (s.shrinkingBase || 10) - 1);
        const update = { ...s, shrinkingBase: newBase };
        if (avgTime !== null) {
          const prevBest = s.personalBest || Infinity;
          if (avgTime < prevBest) {
            update.personalBest = Math.round(avgTime * 10) / 10;
            update.newPR = true;
          }
        }
        return update;
      });
    }
  };

  const handleRestart = () => {
    setSavedSession(null);
    setSessionState(null);
    setPaused(false);
    setSettings(s => ({ ...s, newPR: false }));
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
            settings={settings}
          />
          <style>{`body{margin:0;background:#060C14}`}</style>
        </>
      );
    }

    const round = sessionState.rounds[sessionState.roundIdx];
    if (!round) return null;

    return (
      <>
        {paused && <PauseOverlay onResume={() => setPaused(false)} onSaveExit={handleSaveExit} onExitNoSave={handleExitNoSave} />}
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
        <HomeScreen onStart={handleStart} onResumeSaved={handleResumeSaved} savedSession={savedSession} settings={settings} setSettings={setSettings} reviews={reviews} />
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
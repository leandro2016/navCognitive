// Pure utilities: questions, exercises, session building, spaced repetition,
// adaptive weighting, schema migration. No React — fully testable.

// Archivo maestro de preguntas builtin. Para cambiar el banco, editar esta
// constante (o usar import.meta.env si se prefiere env-based).
import BUILTIN_QUESTIONS from "../../Questions/naut-preguntas-master.json";
import EXERCISES from "../../Questions/exercises.json";
import {
  DIFFICULTIES, SESSION_TEMPLATES, PHASE_EX_MAP, PHASE_Q_MAP, SCHEMA_VERSION, LS,
  CAT_ORDER, CAT_LABELS, Q_TYPE_MAP,
} from "./constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── shuffle ───────────────────────────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── questions ─────────────────────────────────────────────────────────────
export function normalizeQuestion(q) {
  if (!q || typeof q !== "object") return q;
  return {
    ...q,
    d:        typeof q.d === "string" ? q.d : "",
    tags:     Array.isArray(q.tags) ? q.tags : [],
    difficulty: typeof q.difficulty === "number" ? q.difficulty : null,
    type:     Q_TYPE_MAP[q.type] ? q.type : "recall",
    steps:    Array.isArray(q.steps) ? q.steps.map(String) : [],
  };
}

export function getAllQuestions(customQ) {
  // Custom questions with positive IDs override builtins (edits de builtin).
  // Custom questions with negative IDs are nuevas.
  const customById = new Map();
  for (const q of customQ) customById.set(q.id, q);
  const builtins = BUILTIN_QUESTIONS.map(bq => {
    const override = customById.get(bq.id);
    return override ? normalizeQuestion(override) : bq;
  });
  // Agregar custom nuevas (IDs negativos o IDs no-builtin).
  const builtinIds = new Set(BUILTIN_QUESTIONS.map(q => q.id));
  const newCustom = customQ.filter(q => !builtinIds.has(q.id)).map(normalizeQuestion);
  return [...builtins, ...newCustom];
}

export function getMaxId(allQ) {
  return Math.max(0, ...allQ.map(q => q.id ?? 0));
}

// Custom questions use negative IDs (descending from -1) so they can never
// collide with future builtin question additions (which use positive IDs).
export function nextCustomId(allQ) {
  const customIds = allQ.filter(q => q.id < 0).map(q => q.id);
  return customIds.length ? Math.min(...customIds) - 1 : -1;
}

// Per-question timer: override explícito (q.timeLimit) o multiplicador por tipo.
// Las preguntas procedurales (sequence/invalid/filter) reciben más tiempo.
export function questionTimer(base, q) {
  if (q?.timeLimit && q.timeLimit > 0) return q.timeLimit;
  const mult = Q_TYPE_MAP[q?.type]?.timerMult ?? 1;
  return Math.round(base * mult);
}

// Shuffle determinista de steps basado en el id de la pregunta (estable entre renders).
export function shuffleSteps(steps, seed) {
  if (!Array.isArray(steps) || steps.length <= 1) return steps ? [...steps] : [];
  const indices = steps.map((_, i) => i);
  // PRNG simple (mulberry32) con seed = id de la pregunta.
  let s = (seed | 0) || 1;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.map(i => steps[i]);
}

// ─── spaced repetition (SM-2-lite) ──────────────────────────────────────────
export function getDueReviews(reviews, allQ, now = Date.now()) {
  const dueIds = new Set();
  for (const [id, st] of Object.entries(reviews || {})) {
    if (st.due && st.due <= now) dueIds.add(Number(id));
  }
  return allQ.filter(q => dueIds.has(q.id));
}

export function getOverdueCount(reviews, now = Date.now()) {
  if (!reviews) return 0;
  return Object.values(reviews).filter(st => st.due && st.due <= now).length;
}

export function updateReviews(reviews, results, now = Date.now()) {
  const next = { ...(reviews || {}) };
  for (const r of results) {
    if (!r?.q?.id) continue;
    const id = r.q.id;
    const prev = next[id] || { interval: 1, ease: 2.2, due: now };
    let interval, ease;
    if (r.correct) {
      ease = Math.min(2.5, prev.ease + 0.1);
      interval = Math.max(1, Math.round(prev.interval * ease));
    } else {
      ease = Math.max(1.3, prev.ease - 0.2);
      interval = 1;
    }
    next[id] = { interval, ease, due: now + interval * DAY_MS };
  }
  return next;
}

// ─── adaptive category weighting ───────────────────────────────────────────
export function computeCategoryStats(history) {
  const stats = {};
  for (const entry of history || []) {
    for (const r of (entry.results || []).flat()) {
      if (!r?.q?.cat) continue;
      const c = r.q.cat;
      if (!stats[c]) stats[c] = { correct: 0, total: 0 };
      stats[c].total++;
      if (r.correct) stats[c].correct++;
    }
  }
  return stats;
}

export function categoryWeights(stats) {
  const w = {};
  for (const cat of CAT_ORDER) {
    const s = stats[cat];
    if (!s || s.total < 5) { w[cat] = 1.0; continue; }
    const acc = s.correct / s.total;
    w[cat] = Math.max(1.0, Math.min(2.0, 2.0 - acc));
  }
  return w;
}

export function weightedShuffle(questions, weights) {
  const expanded = [];
  for (const q of questions) {
    const w = weights[q.cat] ?? 1;
    const reps = Math.round(w * 3);
    for (let i = 0; i < reps; i++) expanded.push(q);
  }
  const shuffled = shuffle(expanded);
  const seen = new Set();
  const out = [];
  for (const q of shuffled) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

// ─── session building ───────────────────────────────────────────────────────
export function getQuestionsForPhase(phaseId, role, fatigueLevel, count, usedIds, diff, allQ, weights) {
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

  // G: Fatiga progresiva — a medida que avanzan las rondas (más usedIds),
  // priorizar preguntas de fatigue más alto para simular fatiga acumulada.
  const progress = usedIds.size / Math.max(1, allQ.length);
  if (progress > 0.3 && pool.length > count * 2) {
    const harder = pool.filter(q => q.fatigue >= Math.min(4, 2 + Math.floor(progress * 2)));
    if (harder.length >= count) pool = harder;
  }

  if (pool.length < count) {
    pool = allQ.filter(q =>
      cats.includes(q.cat) &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue
    );
  }

  const ordered = weights ? weightedShuffle(pool, weights) : shuffle(pool);
  return ordered.slice(0, count);
}

export function getExercisesForPhase(phaseId) {
  const pool = PHASE_EX_MAP[phaseId] || [];
  return shuffle(EXERCISES.filter(e => pool.includes(e.id)));
}

export function buildSession(templateKey, role, difficultyId, allQ, opts) {
  const tmpl = SESSION_TEMPLATES[templateKey];
  const diff = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[0];
  const rounds = [];
  const usedIds = new Set();
  let exercisesDone = 0;
  const weights = opts?.weights || null;

  const roleMatch = (q) => role === "TOD" || q.role === "ALL" || q.role === role;
  const effectiveSprintTime = difficultyId === "shrinking" ? (opts?.shrinkingBase || 10) : diff.sprintTime;

  if (templateKey === "walk") {
    let pool = allQ.filter(q => roleMatch(q) && q.fatigue >= 1);
    if (weights) pool = weightedShuffle(pool, weights); else pool = shuffle(pool);
    const maxQ = Math.min(40, pool.length);
    const questions = pool.slice(0, maxQ);
    questions.forEach(q => usedIds.add(q.id));
    rounds.push({
      type: "sprint",
      phaseLabel: "Caminata",
      phaseColor: "#34D399",
      questions,
      questionTimer: 30,
      questionTimers: questions.map(q => questionTimer(30, q)),
      isWalk: true,
    });
    return rounds;
  }

  if (templateKey === "custom") {
    const cats = opts?.cats || ["NAV", "MAN", "DEC", "REG", "SIT"];
    const count = opts?.count || 15;
    const sourceFilter = opts?.sourceFilter || null;
    let pool = allQ.filter(q =>
      cats.includes(q.cat) &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue &&
      (!sourceFilter || q.source === sourceFilter)
    );
    if (pool.length < count) {
      pool = allQ.filter(q =>
        cats.includes(q.cat) &&
        roleMatch(q) &&
        (!sourceFilter || q.source === sourceFilter)
      );
    }
    pool = weights ? weightedShuffle(pool, weights) : shuffle(pool);
    const questions = pool.slice(0, Math.min(count, pool.length));
    questions.forEach(q => usedIds.add(q.id));
    rounds.push({
      type: "sprint",
      phaseLabel: "Sprint personalizado",
      phaseColor: "#FBBF24",
      questions,
      questionTimer: effectiveSprintTime,
      questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
    });
    return rounds;
  }

  if (templateKey === "repaso") {
    const reviews = opts?.reviews || {};
    const due = getDueReviews(reviews, allQ);
    const roleOk = due.filter(q => role === "TOD" || q.role === "ALL" || q.role === role);
    let pool = roleOk;
    const count = opts?.count || Math.min(20, roleOk.length || 10);
    if (pool.length < count) {
      const dueIds = new Set(roleOk.map(q => q.id));
      const extra = shuffle(allQ.filter(q =>
        !dueIds.has(q.id) &&
        (role === "TOD" || q.role === "ALL" || q.role === role)
      ));
      pool = [...roleOk, ...extra];
    }
    const questions = shuffle(pool).slice(0, Math.min(count, pool.length));
    questions.forEach(q => usedIds.add(q.id));
    rounds.push({
      type: "sprint",
      phaseLabel: "Repaso espaciado",
      phaseColor: "#F472B6",
      questions,
      questionTimer: effectiveSprintTime,
      questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
      isRepaso: true,
    });
    return rounds;
  }

  if (templateKey === "procedural") {
    // Solo preguntas procedurales (sequence/invalid/filter), filtradas por rol.
    let pool = allQ.filter(q =>
      q.type && q.type !== "recall" &&
      Array.isArray(q.steps) && q.steps.length > 0 &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue
    );
    if (pool.length < 5) {
      // Fallback: si hay pocas procedurales, no filtrar por fatigue.
      pool = allQ.filter(q =>
        q.type && q.type !== "recall" &&
        Array.isArray(q.steps) && q.steps.length > 0 &&
        roleMatch(q)
      );
    }
    pool = weights ? weightedShuffle(pool, weights) : shuffle(pool);
    const count = opts?.count || Math.min(15, pool.length);
    const questions = pool.slice(0, count);
    questions.forEach(q => usedIds.add(q.id));
    rounds.push({
      type: "sprint",
      phaseLabel: "Práctica procedural",
      phaseColor: "#2DD4BF",
      questions,
      questionTimer: effectiveSprintTime,
      questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
      isProcedural: true,
    });
    return rounds;
  }

  if (templateKey === "race") {
    // A: Simulación de regata — preguntas encadenadas como un leg de regata.
    // Secuencia temática: DEC (decisión) → MAN/TRIM (maniobra/trimado) → NAV/TACT (navegación/táctica)
    // Cada pregunta tiene un contexto que se acumula del resultado anterior.
    const raceCats = ["DEC", "MAN", "TRIM", "NAV", "TACT", "SIT", "METEO"];
    const count = opts?.count || 8;
    let pool = allQ.filter(q =>
      raceCats.includes(q.cat) &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue
    );
    if (pool.length < count) {
      pool = allQ.filter(q => raceCats.includes(q.cat) && roleMatch(q));
    }
    // Agrupar por categoría y tomar de cada una para armar la secuencia.
    const byCat = {};
    for (const q of shuffle(pool)) {
      if (!byCat[q.cat]) byCat[q.cat] = [];
      byCat[q.cat].push(q);
    }
    // Secuencia de un leg: DEC → MAN/TRIM → NAV/TACT → repetir
    const sequence = ["DEC", "MAN", "TRIM", "NAV", "TACT", "SIT", "METEO", "DEC", "MAN", "TRIM"];
    const questions = [];
    const usedIds = new Set();
    for (const cat of sequence) {
      if (questions.length >= count) break;
      const candidates = (byCat[cat] || []).filter(q => !usedIds.has(q.id));
      if (candidates.length > 0) {
        const q = candidates[0];
        questions.push(q);
        usedIds.add(q.id);
      }
    }
    // Si no llegamos a count, completar con cualquier pregunta del pool.
    if (questions.length < count) {
      const rest = shuffle(pool.filter(q => !usedIds.has(q.id)));
      for (const q of rest) {
        if (questions.length >= count) break;
        questions.push(q);
        usedIds.add(q.id);
      }
    }
    rounds.push({
      type: "sprint",
      phaseLabel: "Leg de regata",
      phaseColor: "#F472B6",
      questions,
      questionTimer: effectiveSprintTime,
      questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
      isRace: true,
    });
    return rounds;
  }

  if (templateKey === "focus") {
    // Modo Focus: sesión 100% de la categoría más débil del historial.
    // Progresión: empieza con fatigue baja, sube a medida que acertás.
    const focusCat = opts?.focusCat || "NAV";
    const count = opts?.count || 15;
    let pool = allQ.filter(q =>
      q.cat === focusCat &&
      roleMatch(q) &&
      q.fatigue >= diff.minFatigue
    );
    if (pool.length < count) {
      // Fallback: sin filtro de fatigue ni rol si hay pocas.
      pool = allQ.filter(q => q.cat === focusCat);
    }
    pool = shuffle(pool);
    // Progresión de fatigue: ordenar por fatigue ascendente para que empiece suave.
    const sorted = [...pool].sort((a, b) => (a.fatigue || 2) - (b.fatigue || 2));
    const questions = sorted.slice(0, Math.min(count, sorted.length));
    questions.forEach(q => usedIds.add(q.id));
    rounds.push({
      type: "sprint",
      phaseLabel: "Focus · " + (CAT_LABELS?.[focusCat] || focusCat),
      phaseColor: "#F43F5E",
      questions,
      questionTimer: effectiveSprintTime,
      questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
      isFocus: true,
      focusCat,
    });
    return rounds;
  }

  tmpl.phases.forEach(phase => {
    if (phase.id === "sprint") {
      const questions = getQuestionsForPhase("sprint", role, 3, 10, usedIds, diff, allQ, weights);
      questions.forEach(q => usedIds.add(q.id));
      rounds.push({
        type: "sprint",
        phaseLabel: phase.label,
        phaseColor: phase.color,
        questions,
        questionTimer: effectiveSprintTime,
        questionTimers: questions.map(q => questionTimer(effectiveSprintTime, q)),
      });
      return;
    }

    const exList = getExercisesForPhase(phase.id);
    const numRounds = phase.id === "warm" ? 2 : 5;

    for (let i = 0; i < numRounds; i++) {
      const ex = exList[i % exList.length];
      exercisesDone++;
      const fatigueLevel = Math.min(4, Math.ceil(exercisesDone / 3));

      const qs = getQuestionsForPhase(phase.id, role, fatigueLevel, 1, usedIds, diff, allQ, weights);
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
        questionTimer: isWarm ? questionTimer(30, question) : questionTimer(diff.qTimer, question),
        fatigueLevel: Math.max(1, fatigueLevel),
        dualTask,
      });
    }
  });

  return rounds;
}

// ─── import/export ─────────────────────────────────────────────────────────
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateImportedQuestions(raw) {
  if (!Array.isArray(raw)) throw new Error("Debe ser un array JSON");
  const validCats  = CAT_ORDER;
  const validRoles = ["ALL", "GEN", "MAY", "PRO", "TAC", "TIM", "PIT", "NAVEG", "TOD"];
  const validTypes = ["recall", "sequence", "invalid", "filter"];
  return raw.map((item, idx) => {
    if (typeof item.cat !== "string" || !validCats.includes(item.cat))
      throw new Error("Item " + (idx + 1) + ": cat debe ser uno de " + validCats.join("/"));
    if (typeof item.q !== "string" || !item.q.trim())
      throw new Error("Item " + (idx + 1) + ": q (pregunta) es obligatorio");
    if (typeof item.a !== "string" || !item.a.trim())
      throw new Error("Item " + (idx + 1) + ": a (respuesta) es obligatorio");
    const type = validTypes.includes(item.type) ? item.type : "recall";
    const steps = Array.isArray(item.steps) ? item.steps.map(String) : [];
    const invalidIndex = Number.isInteger(item.invalidIndex) && item.invalidIndex >= 0 && item.invalidIndex < steps.length
      ? item.invalidIndex : null;
    const validMask = Array.isArray(item.validMask) && item.validMask.length === steps.length
      ? item.validMask.map(Boolean) : null;
    const timeLimit = typeof item.timeLimit === "number" && item.timeLimit > 0 ? item.timeLimit : null;
    return {
      cat:    item.cat,
      role:   validRoles.includes(item.role) ? item.role : "ALL",
      fatigue: [1, 2, 3, 4].includes(item.fatigue) ? item.fatigue : 1,
      q:      item.q.trim(),
      a:      item.a.trim(),
      d:      typeof item.d === "string" ? item.d.trim() : "",
      tags:   Array.isArray(item.tags) ? item.tags.map(String) : [],
      difficulty: [1,2,3,4,5].includes(item.difficulty) ? item.difficulty : null,
      type,
      steps,
      invalidIndex,
      validMask,
      timeLimit,
    };
  });
}

// ─── schema migration ──────────────────────────────────────────────────────
export function migrateSchema() {
  try {
    const ver = Number(localStorage.getItem(LS.schema)) || 0;
    if (ver >= SCHEMA_VERSION) return;

    if (ver < 2) {
      const raw = localStorage.getItem(LS.customQ);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const builtinIds = new Set(BUILTIN_QUESTIONS.map(q => q.id));
          let nextNeg = -1;
          const remapped = arr.map(q => {
            const nq = normalizeQuestion(q);
            if (nq.id > 0 && !builtinIds.has(nq.id)) {
              nq.id = nextNeg--;
            }
            return nq;
          });
          localStorage.setItem(LS.customQ, JSON.stringify(remapped));
        }
      }
    }
    localStorage.setItem(LS.schema, String(SCHEMA_VERSION));
  } catch { /* corrupt storage — leave as-is */ }
}
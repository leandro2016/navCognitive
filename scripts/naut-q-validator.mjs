#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// naut-q-validator: Validador semántico de preguntas cognitivas de regata
// Ejecutar: npm run validate
// Reporta issues semánticos que la validación estructural no detecta.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";

const QUESTIONS_FILE = "Questions/naut-preguntas-master.json";
const questions = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));

// ─── Taxonomía de roles y sus velas/controles asociados ───────────────────
const ROLE_DOMAIN = {
  GEN:  { velas: ["genoa", "génova", "genoa", "foque", "estay"], controles: ["escota", "patín", "patin", "punto de escota", "brisa", "cunningham", "papel", "outhaul", "entrenador", "baten", "driza", "sag", "burdas"] },
  MAY:  { velas: ["mayor", "botavara", "baluma", "cataviento", "traveller", "carro", "cunningham", "outhaul", "contra", "vang", "amantillo", "rizo", "driza"], controles: ["traveller", "carro", "escota", "contra", "vang", "cunningham", "outhaul", "amantillo", "driza"] },
  PRO:  { velas: ["spinnaker", "spi", "gennaker", "asimétrico", "tangón", "tangon", "braza", "gratil", "driza"], controles: ["braza", "escota", "tangón", "tangon", "driza"] },
  TAC:  { velas: [], controles: ["borneo", "layline", "vmg", "cobrir", "estirar", "flota", "start", "estrategia", "recorrido"] },
  TIM:  { velas: [], controles: ["rumbo", "timón", "timon", "orzar", "derivar", "virar", "trasluchar", "velocidad", "ángulo"] },
  PIT:  { velas: [], controles: ["driza", "winche", "stopper", "amante", "escota", "copit"] },
  NAVEG:{ velas: [], controles: ["rumbo", "variación", "variacion", "desvío", "desvio", "demora", "eta", "sog", "stw", "corriente", "deriva", "gps", "corredera", "milla", "carta"] },
  ALL:  { velas: [], controles: [] }, // ALL = cualquier cosa
  TOD:  { velas: [], controles: [] },
};

// ─── Reglas de validación semántica ───────────────────────────────────────
// Cada regla devuelve un array de issues (vacío si no hay problema).

const RULES = [
  // R1: Role vs contenido de la respuesta
  {
    id: "R1_ROLE_VELA_MISMATCH",
    severity: "error",
    desc: "El rol responde sobre una vela que no le corresponde",
    check: (q) => {
      if (q.role === "ALL" || q.role === "TOD") return [];
      const domain = ROLE_DOMAIN[q.role];
      if (!domain || domain.velas.length === 0) return [];
      const text = (q.q + " " + q.a + " " + q.d).toLowerCase();
      // Velas que NO corresponden al rol
      const otherVelas = {
        GEN: ["spinnaker", "spi ", "mayor", "botavara", "cataviento"],
        MAY: ["spinnaker", "spi ", "genoa", "génova", "foque", "estay"],
        PRO: ["genoa", "génova", "mayor", "botavara", "cataviento", "traveller", "carro"],
      };
      const wrong = otherVelas[q.role];
      if (!wrong) return [];
      const found = wrong.filter(v => text.includes(v));
      // Excepción: si la pregunta menciona explícitamente la vela del rol
      const ownVelaMentioned = domain.velas.some(v => text.includes(v));
      if (found.length > 0 && !ownVelaMentioned) {
        return [{ rule: "R1_ROLE_VELA_MISMATCH", severity: "error",
          msg: `Role ${q.role} responde sobre ${found.join("/")} pero no menciona su propia vela (${domain.velas.join("/")})` }];
      }
      return [];
    },
  },

  // R2: TRIM sin contexto de condición (viento, rumbo, intensidad)
  {
    id: "R2_TRIM_NO_CONTEXT",
    severity: "warning",
    desc: "Pregunta de TRIM sin contexto de viento/condición/ola",
    check: (q) => {
      if (q.cat !== "TRIM") return [];
      const text = (q.q + " " + q.a).toLowerCase();
      const contextWords = ["viento", "kn", "nudo", "racha", "role", "borneo", "ceñida", "popa", "través", "traves", "largo", "ola", "marejada", "escora", "rumbo", "grado", "°", "calma", "flojo", "fuerte", "medio", "liviano", "agua", "río", "rio"];
      const hasContext = contextWords.some(w => text.includes(w));
      // Excepción: preguntas conceptuales puras (¿qué es X?)
      const isConceptual = /^(¿qué es|¿qué son|¿cómo|¿por qué|¿cuál es|filosof|principio|indicador|¿qué controla|¿qué función)/i.test(q.q);
      if (!hasContext && !isConceptual) {
        return [{ rule: "R2_TRIM_NO_CONTEXT", severity: "warning",
          msg: "TRIM sin contexto de viento/condición — agregar intensidad, rumbo u ola" }];
      }
      return [];
    },
  },

  // R3: Respuesta demasiado larga (>80 chars = no es concisa)
  {
    id: "R3_ANSWER_TOO_LONG",
    severity: "warning",
    desc: "Respuesta demasiado larga (debe ser concisa: número, rumbo o frase corta)",
    check: (q) => {
      if (q.a.length > 80) {
        return [{ rule: "R3_ANSWER_TOO_LONG", severity: "warning",
          msg: `Respuesta de ${q.a.length} chars — debería ser concisa (<80)` }];
      }
      return [];
    },
  },

  // R4: Respuesta que mezcla múltiples velas sin contexto
  {
    id: "R4_MULTI_VELA_CONFUSION",
    severity: "error",
    desc: "Respuesta mezcla síntomas de múltiples velas sin contexto",
    check: (q) => {
      const a = q.a.toLowerCase();
      const velasMentioned = [];
      if (/genoa|génova|foque/.test(a)) velasMentioned.push("genoa");
      if (/mayor|botavara|cataviento/.test(a)) velasMentioned.push("mayor");
      if (/spi|spinnaker|gratil/.test(a)) velasMentioned.push("spi");
      if (velasMentioned.length >= 2 && q.cat === "TRIM" && q.role !== "ALL" && q.role !== "TOD") {
        return [{ rule: "R4_MULTI_VELA_CONFUSION", severity: "error",
          msg: `Respuesta mezcla ${velasMentioned.join(" + ")} — confusa para role=${q.role}` }];
      }
      return [];
    },
  },

  // R5: Fatigue incoherente con dificultad
  {
    id: "R5_FATIGUE_MISMATCH",
    severity: "warning",
    desc: "Fatigue no coherente con el tipo de pregunta",
    check: (q) => {
      const text = q.q.toLowerCase();
      // Cálculo simple → fatigue 1-2
      if (/^\s*[a-z]+\s*=\s*\d/.test(text) || /\d+\s*[+\-\/]\s*\d+/.test(q.d)) {
        if (q.fatigue >= 3) return [{ rule: "R5_FATIGUE_MISMATCH", severity: "warning",
          msg: `Cálculo simple con fatigue=${q.fatigue} — debería ser 1-2` }];
      }
      // Reglas combinadas / casos de protesta → fatigue 3-4
      if (q.cat === "REG" && /combinad|audiencia|protesta/i.test(q.q) && q.fatigue <= 2) {
        return [{ rule: "R5_FATIGUE_MISMATCH", severity: "warning",
          msg: `Caso complejo con fatigue=${q.fatigue} — debería ser 3-4` }];
      }
      return [];
    },
  },

  // R6: Pregunta duplicada (mismo texto normalizado, order-aware)
  {
    id: "R6_DUPLICATE",
    severity: "error",
    desc: "Pregunta duplicada (mismo texto normalizado)",
    check: (q, allQ) => {
      const norm = q.q.trim().toLowerCase().replace(/\s+/g, " ");
      const dups = allQ.filter(o => o.id !== q.id && o.q.trim().toLowerCase().replace(/\s+/g, " ") === norm);
      if (dups.length > 0) {
        return [{ rule: "R6_DUPLICATE", severity: "error",
          msg: `Duplicada con ID(s): ${dups.map(d => d.id).join(", ")}` }];
      }
      return [];
    },
  },

  // R6b: Near-duplicate (Jaccard > 0.85 + sequence ratio order-aware)
  {
    id: "R6b_NEAR_DUPLICATE",
    severity: "warning",
    desc: "Pregunta casi duplicada (Jaccard > 0.85, sequence ratio > 0.85)",
    check: (q, allQ) => {
      const tokenize = (s) => new Set(s.trim().toLowerCase().replace(/\s+/g, " ").split(" "));
      const seqRatio = (a, b) => {
        // Simple sequence ratio: longest common subsequence / max length
        if (a === b) return 1.0;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (shorter.length === 0) return 0;
        let matches = 0;
        let j = 0;
        for (let i = 0; i < longer.length && j < shorter.length; i++) {
          if (longer[i] === shorter[j]) { matches++; j++; }
        }
        return matches / longer.length;
      };
      const qTokens = tokenize(q.q);
      const qNorm = q.q.trim().toLowerCase().replace(/\s+/g, " ");
      const nearDups = [];
      for (const o of allQ) {
        if (o.id === q.id) continue;
        const oTokens = tokenize(o.q);
        const oNorm = o.q.trim().toLowerCase().replace(/\s+/g, " ");
        // Jaccard
        const intersection = [...qTokens].filter(t => oTokens.has(t)).length;
        const union = new Set([...qTokens, ...oTokens]).size;
        const jaccard = union > 0 ? intersection / union : 0;
        // Sequence ratio (order-aware)
        const sr = seqRatio(qNorm, oNorm);
        if (jaccard >= 0.85 && sr >= 0.85 && qNorm !== oNorm) {
          nearDups.push({ id: o.id, jaccard: jaccard.toFixed(2), sr: sr.toFixed(2) });
        }
      }
      if (nearDups.length > 0) {
        return [{ rule: "R6b_NEAR_DUPLICATE", severity: "warning",
          msg: `Near-dup de ID(s): ${nearDups.map(d => `${d.id} (J=${d.jaccard},SR=${d.sr})`).join(", ")}` }];
      }
      return [];
    },
  },

  // R7: Deducción vacía o sin valor cognitivo
  {
    id: "R7_WEAK_DEDUCTION",
    severity: "warning",
    desc: "Deducción vacía o que repite la respuesta sin agregar valor",
    check: (q) => {
      if (!q.d || q.d.trim().length < 3) {
        return [{ rule: "R7_WEAK_DEDUCTION", severity: "warning",
          msg: "Deducción vacía o muy corta" }];
      }
      // Si la deducción es igual a la respuesta
      if (q.d.trim().toLowerCase() === q.a.trim().toLowerCase()) {
        return [{ rule: "R7_WEAK_DEDUCTION", severity: "warning",
          msg: "Deducción repite la respuesta sin agregar valor" }];
      }
      return [];
    },
  },

  // R8: Source faltante
  {
    id: "R8_NO_SOURCE",
    severity: "error",
    desc: "Campo source obligatorio faltante",
    check: (q) => {
      if (!q.source || q.source.trim().length < 2) {
        return [{ rule: "R8_NO_SOURCE", severity: "error",
          msg: "Source faltante — indicar origen documental" }];
      }
      return [];
    },
  },

  // R9: Pregunta procedurales sin steps
  {
    id: "R9_PROC_NO_STEPS",
    severity: "error",
    desc: "Pregunta procedural (type != recall) sin steps",
    check: (q) => {
      if (q.type && q.type !== "recall") {
        if (!Array.isArray(q.steps) || q.steps.length < 2) {
          return [{ rule: "R9_PROC_NO_STEPS", severity: "error",
            msg: `type=${q.type} pero no tiene steps válidos` }];
        }
        if (q.type === "invalid" && (q.invalidIndex === null || q.invalidIndex === undefined)) {
          return [{ rule: "R9_PROC_NO_STEPS", severity: "error",
            msg: "type=invalid pero invalidIndex no definido" }];
        }
        if (q.type === "filter" && (!Array.isArray(q.validMask) || q.validMask.length !== q.steps.length)) {
          return [{ rule: "R9_PROC_NO_STEPS", severity: "error",
            msg: "type=filter pero validMask no coincide con steps.length" }];
        }
      }
      return [];
    },
  },

  // R10: Pregunta ambigua (sin signos de pregunta ni contexto suficiente)
  {
    id: "R10_AMBIGUOUS",
    severity: "warning",
    desc: "Pregunta ambigua — falta contexto o es demasiado genérica",
    check: (q) => {
      // Preguntas de una palabra o muy cortas
      if (q.q.trim().length < 15 && !q.q.includes("\n")) {
        return [{ rule: "R10_AMBIGUOUS", severity: "warning",
          msg: `Pregunta muy corta (${q.q.length} chars) — falta contexto` }];
      }
      return [];
    },
  },

  // R11: Respuesta con "wait" o notas de debug
  {
    id: "R11_DEBUG_ARTIFACT",
    severity: "error",
    desc: "Respuesta o deducción contiene artefactos de generación (wait, ...)",
    check: (q) => {
      const text = (q.a + " " + q.d).toLowerCase();
      if (/wait:|\.+\.+\.+|^\.\.\./.test(text) || /wait /.test(text)) {
        return [{ rule: "R11_DEBUG_ARTIFACT", severity: "error",
          msg: "Contiene artefactos de generación (wait, ...)" }];
      }
      return [];
    },
  },

  // R12: Cálculo de navegación con resultado incorrecto
  {
    id: "R12_NAV_CALC_ERROR",
    severity: "error",
    desc: "Cálculo de navegación con resultado aparentemente incorrecto",
    check: (q) => {
      if (q.cat !== "NAV") return [];
      // Extraer números de la pregunta y la deducción
      const qNums = q.q.match(/-?\d+\.?\d*/g) || [];
      const dNums = q.d.match(/-?\d+\.?\d*/g) || [];
      // Si la deducción tiene "wait" o "..." es un artefacto
      if (/wait/i.test(q.d)) {
        return [{ rule: "R12_NAV_CALC_ERROR", severity: "error",
          msg: "Deducción contiene 'wait' — cálculo no verificado" }];
      }
      return [];
    },
  },

  // R13: Autocontención — clasificación A/B/C (gate de autocontención)
  {
    id: "R13_NO_SCENE",
    severity: "warning",
    desc: "Pregunta de diagnóstico/síntoma/acción sin escena (categoría C del rubric)",
    check: (q) => {
      const text = q.q.toLowerCase();
      // Categoría C: diagnóstico/síntoma/acción — NUNCA sin escena
      const isDiagnosis = /síntoma|sintoma|diagnóstico|diagnostico|diagnós|qué hacer|que hacer|qué hace|que hace|qué pasa|que pasa|error:|corrección|correccion/.test(text);
      if (!isDiagnosis) return [];
      // Excepción: si la pregunta menciona vela + condición, está OK
      const hasVela = /genoa|génova|mayor|spinnaker|spi|cataviento|lanita|baluma|gratil|tangón|tangon|botavara/.test(text);
      const hasCondition = /viento|kn|nudo|racha|role|borneo|ceñida|popa|través|traves|largo|ola|escora|rumbo|grado|°|calma|flojo|fuerte|medio|liviano/.test(text);
      if (isDiagnosis && !hasVela) {
        return [{ rule: "R13_NO_SCENE", severity: "warning",
          msg: "Diagnóstico/síntoma sin vela específica — agregar qué vela" }];
      }
      if (isDiagnosis && hasVela && !hasCondition) {
        return [{ rule: "R13_NO_SCENE", severity: "warning",
          msg: "Diagnóstico/síntoma con vela pero sin condición — agregar viento/rumbo/ola" }];
      }
      return [];
    },
  },

  // R14: Contradicción de fuentes — mismo control mapeado a efectos distintos
  {
    id: "R14_SOURCE_CONTRADICTION",
    severity: "warning",
    desc: "Mismo control mapeado a efectos distintos entre fuentes",
    check: (q, allQ) => {
      // Mapeo control → efecto esperado (de la documentación canónica)
      const controlMap = {
        "sag": { expected: "burdas", sources: ["05_AERODINAMICA", "07_GENOVA"] },
        "papel": { expected: "outhaul", sources: ["05_AERODINAMICA", "06_MAYOR"] },
        "brisa": { expected: "cunningham", sources: ["05_AERODINAMICA", "07_GENOVA"] },
      };
      const text = (q.q + " " + q.a + " " + q.d).toLowerCase();
      for (const [control, info] of Object.entries(controlMap)) {
        if (text.includes(control) && text.includes(info.expected)) {
          // Esta pregunta mapea control → expected, verificar si otra fuente
          // mapea el mismo control a algo distinto
          for (const o of allQ) {
            if (o.id === q.id) continue;
            const oText = (o.q + " " + o.a + " " + o.d).toLowerCase();
            if (oText.includes(control) && !oText.includes(info.expected) && o.source !== q.source) {
              // Encontró otra fuente que menciona el mismo control pero sin el expected
              const otherControl = Object.keys(controlMap).find(c => c !== control && oText.includes(c));
              if (otherControl) {
                return [{ rule: "R14_SOURCE_CONTRADICTION", severity: "warning",
                  msg: `${control}→${info.expected} en ${q.source} vs ${control}→${otherControl} en ${o.source} (ID ${o.id})` }];
              }
            }
          }
        }
      }
      return [];
    },
  },
];

// ─── Ejecutar validación ──────────────────────────────────────────────────
const allIssues = [];
const byRule = {};
const bySeverity = { error: 0, warning: 0 };

for (const q of questions) {
  for (const rule of RULES) {
    const issues = rule.check(q, questions);
    for (const issue of issues) {
      allIssues.push({ id: q.id, cat: q.cat, role: q.role, q: q.q.substring(0, 70), ...issue });
      byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
      bySeverity[issue.severity]++;
    }
  }
}

// ─── Reporte ───────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  NAUT-Q-VALIDATOR — Validación semántica de preguntas       ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log();
console.log(`Total preguntas: ${questions.length}`);
console.log(`Issues encontrados: ${allIssues.length} (${bySeverity.error} errors, ${bySeverity.warning} warnings)`);
console.log(`Preguntas con issues: ${new Set(allIssues.map(i => i.id)).size}/${questions.length}`);
console.log();

console.log("── Resumen por regla ──────────────────────────────────────────");
for (const rule of RULES) {
  const count = byRule[rule.id] || 0;
  const icon = count > 0 ? (rule.severity === "error" ? "❌" : "⚠️ ") : "✅";
  console.log(`${icon} ${rule.id.padEnd(28)} ${String(count).padStart(4)}  ${rule.severity.padEnd(7)} ${rule.desc}`);
}
console.log();

// Mostrar errores primero
const errors = allIssues.filter(i => i.severity === "error");
const warnings = allIssues.filter(i => i.severity === "warning");

if (errors.length > 0) {
  console.log("── ERRORES (deben corregirse) ──────────────────────────────────");
  errors.slice(0, 50).forEach(i => {
    console.log(`  #${i.id} [${i.cat}/${i.role}] ${i.rule}`);
    console.log(`    Q: ${i.q}`);
    console.log(`    → ${i.msg}`);
    console.log();
  });
  if (errors.length > 50) console.log(`  ... y ${errors.length - 50} errores más`);
}

if (warnings.length > 0) {
  console.log("── WARNINGS (revisar) ──────────────────────────────────────────");
  warnings.slice(0, 30).forEach(i => {
    console.log(`  #${i.id} [${i.cat}/${i.role}] ${i.rule}`);
    console.log(`    Q: ${i.q}`);
    console.log(`    → ${i.msg}`);
    console.log();
  });
  if (warnings.length > 30) console.log(`  ... y ${warnings.length - 30} warnings más`);
}

if (allIssues.length === 0) {
  console.log("✅ No se encontraron issues semánticos. El banco está limpio.");
}

// Exit code: 1 si hay errores, 0 si solo warnings o limpio
process.exit(bySeverity.error > 0 ? 1 : 0);
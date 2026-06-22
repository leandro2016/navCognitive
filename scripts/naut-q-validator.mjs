#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// naut-q-validator: Validador mecánico + semántico de preguntas de regata
// Port de mechanical_checks.py (skill naut-q-validator) a Node.js.
// Ejecutar: npm run validate
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";

const QUESTIONS_FILE = "Questions/naut-preguntas-master.json";
const questions = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));

// ─── Constantes ───────────────────────────────────────────────────────────
const VALID_CAT = new Set(["NAV","MAN","DEC","REG","SIT","TRIM","TACT","METEO","SEG"]);
const VALID_ROLE = new Set(["ALL","GEN","MAY","PRO","TAC","TIM","PIT","NAVEG","TOD"]);
const KNOWN_SOURCES = new Set(["15_NAVEGACION","17_CORRIENTES","16_METEOROLOGIA","04_MANIOBRAS","05_AERODINAMICA","06_MAYOR","07_GENOVA","08_SPINNAKER","01_RRS","02_COLREG","03_IALA","13_LUCES","14_PROTESTA","18_SENALES_DE_REGATA","general","relato"]);

const DIAGNOSTIC_SIGNALS = [/\bsíntomas?\b/i,/\bdiagnóstico\b/i,/\bcausas?\s+posibles?\b/i,/\brevisar\b/i,/\bacción\b/i,/\bqué hacer\b/i,/\bindica\b/i,/\bsospech/i,/\bqué pasa\b/i,/\bqué problema\b/i];
const SITUATION_SIGNALS = [/\d+\s*(kn|nudos|°|grados|mn|kg)?/i,/\bceñida\b/i,/\btravés\b/i,/\btraves\b/i,/\blargo\b/i,/\bpopa\b/i,/\bracha\b/i,/\bola\b/i,/\bborneo\b/i,/\bviento (liviano|flojo|medio|fuerte)\b/i];
const DEFINITION_SIGNALS = [/\bqué (es|mide|controla|sostiene)\b/i,/\bcontrol principal\b/i,/\bfunción\b/i,/\bdefinición\b/i];
const HEADER_LIKE_PATTERNS = [/^[A-ZÁÉÍÓÚÑa-záéíóúñ0-9 /()]+\s*[·:]\s*¿/,/^¿Qué (es|controla|produce|genera|significa)\b/i,/^¿Cuál es el control principal\b/i,/control principal\?$/i];

function stripAccents(s) { return s.normalize("NFKD").replace(/[\u0300-\u036f]/g,""); }
function normalizeQ(s) { return stripAccents(s.toLowerCase()).replace(/\s+/g," ").trim().replace(/[^\w \->]/g,""); }
function tokenSet(s) { return new Set(normalizeQ(s).split(" ")); }
function jaccard(a,b) { if(!a.size&&!b.size)return 1; const i=[...a].filter(x=>b.has(x)).length; const u=new Set([...a,...b]).size; return u?i/u:0; }
function seqRatio(a,b) { if(a===b)return 1; const lg=a.length>b.length?a:b, sh=a.length>b.length?b:a; if(!sh.length)return 0; let m=0,j=0; for(let i=0;i<lg.length&&j<sh.length;i++){if(lg[i]===sh[j]){m++;j++;}} return m/lg.length; }

// ─── Chequeo mecánico: schema ─────────────────────────────────────────────
function checkSchema(data) {
  const issues=[], seen={};
  for (const q of data) {
    for (const f of ["id","cat","role","fatigue","q","a","d","source"]) {
      if (!(f in q) || q[f]===null || q[f]==="") issues.push({id:q.id,issue:"missing_field",field:f});
    }
    if (q.cat && !VALID_CAT.has(q.cat)) issues.push({id:q.id,issue:"invalid_cat",value:q.cat});
    if (q.role && !VALID_ROLE.has(q.role)) issues.push({id:q.id,issue:"invalid_role",value:q.role});
    if (q.fatigue && ![1,2,3,4].includes(q.fatigue)) issues.push({id:q.id,issue:"invalid_fatigue",value:q.fatigue});
    const t=q.type||"recall";
    if (!["recall","sequence","invalid","filter"].includes(t)) issues.push({id:q.id,issue:"invalid_type",value:t});
    if (t!=="recall" && !Array.isArray(q.steps)) issues.push({id:q.id,issue:"procedural_missing_steps"});
    if (t==="invalid" && q.invalidIndex===undefined) issues.push({id:q.id,issue:"invalid_missing_invalidIndex"});
    if (t==="filter" && !Array.isArray(q.validMask)) issues.push({id:q.id,issue:"filter_missing_validMask"});
    if (q.id in seen) issues.push({id:q.id,issue:"duplicate_id",other:seen[q.id]}); else seen[q.id]=q.id;
  }
  return issues;
}

// ─── Near-duplicates (order-aware) ─────────────────────────────────────────
function checkNearDuplicates(data, threshold=0.82) {
  const byCat={};
  for (const q of data) { (byCat[q.cat]??=[]).push({id:q.id,q:q.q,tokens:tokenSet(q.q)}); }
  const pairs=[];
  for (const group of Object.values(byCat)) {
    for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) {
      const jc=jaccard(group[i].tokens,group[j].tokens);
      if (jc<threshold) continue;
      const sr=seqRatio(normalizeQ(group[i].q),normalizeQ(group[j].q));
      if (sr>=threshold) pairs.push({id_a:group[i].id,id_b:group[j].id,jaccard:+jc.toFixed(2),sequence_ratio:+sr.toFixed(2),likely_true_duplicate:sr>=0.95});
    }
  }
  return pairs;
}

// ─── Context anchor (triage A/B/C) ────────────────────────────────────────
function checkContextAnchor(data) {
  const highConf=[], needsLlm=[], bareDef=[];
  for (const q of data) {
    const text=q.q;
    const hasSignal=SITUATION_SIGNALS.some(p=>new RegExp(p,"i").test(text));
    const isDiag=DIAGNOSTIC_SIGNALS.some(p=>new RegExp(p,"i").test(text));
    const isDef=DEFINITION_SIGNALS.some(p=>new RegExp(p,"i").test(text));
    const headerLike=HEADER_LIKE_PATTERNS.some(p=>new RegExp(p).test(text));
    const veryShort=text.split(/\s+/).length<=8;
    if (hasSignal) continue;
    const entry={id:q.id,cat:q.cat,source:q.source,q:text,a:q.a};
    if (isDiag) highConf.push(entry);
    else if (isDef && (headerLike||veryShort)) bareDef.push({id:entry.id,cat:entry.cat,source:entry.source,q:entry.q});
    else if (headerLike||veryShort) needsLlm.push(entry);
  }
  return {high_confidence_no_scene:highConf,needs_llm_review:needsLlm,bare_definition:bareDef};
}

// ─── Reglas semánticas ────────────────────────────────────────────────────
const ROLE_DOMAIN={GEN:{v:["genoa","génova","foque","estay"]},MAY:{v:["mayor","botavara","baluma","cataviento","traveller","carro","cunningham","outhaul","contra","vang","amantillo","rizo","driza"]},PRO:{v:["spinnaker","spi","gennaker","asimétrico","tangón","tangon","braza","gratil"]},TAC:{v:[]},TIM:{v:[]},PIT:{v:[]},NAVEG:{v:[]},ALL:{v:[]},TOD:{v:[]}};

const RULES=[
  {id:"R1_ROLE_VELA_MISMATCH",severity:"error",desc:"Rol responde sobre vela que no le corresponde",
   check:(q)=>{if(q.role==="ALL"||q.role==="TOD")return[];const d=ROLE_DOMAIN[q.role];if(!d||!d.v.length)return[];const t=(q.q+" "+q.a+" "+q.d).toLowerCase();const ow={GEN:["spinnaker","spi ","mayor","botavara","cataviento"],MAY:["spinnaker","spi ","genoa","génova","foque","estay"],PRO:["genoa","génova","mayor","botavara","cataviento","traveller","carro"]}[q.role];if(!ow)return[];const f=ow.filter(v=>t.includes(v));const own=d.v.some(v=>t.includes(v));return(f.length&&!own)?[{rule:"R1",severity:"error",msg:`Role ${q.role} responde sobre ${f.join("/")} sin mencionar su vela`}]:[];}},
  {id:"R2_TRIM_NO_CONTEXT",severity:"warning",desc:"TRIM sin contexto de viento/condición",
   check:(q)=>{if(q.cat!=="TRIM")return[];const t=(q.q+" "+q.a).toLowerCase();const ctx=["viento","kn","nudo","racha","role","borneo","ceñida","popa","través","traves","largo","ola","escora","rumbo","grado","°","calma","flojo","fuerte","medio","liviano","agua","río","rio","regata"];const has=ctx.some(w=>t.includes(w));const con=/^(¿qué es|¿qué son|¿cómo|¿por qué|¿cuál es|filosof|principio|indicador|¿qué controla|¿qué función)/i.test(q.q);return(!has&&!con)?[{rule:"R2",severity:"warning",msg:"TRIM sin contexto"}]:[];}},
  {id:"R3_ANSWER_TOO_LONG",severity:"warning",desc:"Respuesta >80 chars",
   check:(q)=>q.a.length>80?[{rule:"R3",severity:"warning",msg:`Respuesta de ${q.a.length} chars`}]:[]},
  {id:"R4_MULTI_VELA_CONFUSION",severity:"error",desc:"Respuesta mezcla múltiples velas",
   check:(q)=>{const a=q.a.toLowerCase();const v=[];if(/genoa|génova|foque/.test(a))v.push("genoa");if(/mayor|botavara|cataviento/.test(a))v.push("mayor");if(/spi|spinnaker|gratil/.test(a))v.push("spi");return(v.length>=2&&q.cat==="TRIM"&&q.role!=="ALL"&&q.role!=="TOD")?[{rule:"R4",severity:"error",msg:`Mezcla ${v.join(" + ")} para role=${q.role}`}]:[];}},
  {id:"R5_FATIGUE_MISMATCH",severity:"warning",desc:"Fatigue no coherente",
   check:(q)=>{const t=q.q.toLowerCase();if(/^\s*[a-z]+\s*=\s*\d/.test(t)||/\d+\s*[+\-\/]\s*\d+/.test(q.d)){if(q.fatigue>=3)return[{rule:"R5",severity:"warning",msg:`Cálculo simple con fatigue=${q.fatigue}`}];}if(q.cat==="REG"&&/combinad|audiencia|protesta/i.test(q.q)&&q.fatigue<=2)return[{rule:"R5",severity:"warning",msg:`Caso complejo con fatigue=${q.fatigue}`}];return[];}},
  {id:"R6_DUPLICATE",severity:"error",desc:"Pregunta duplicada",
   check:(q,all)=>{const n=normalizeQ(q.q);const d=all.filter(o=>o.id!==q.id&&normalizeQ(o.q)===n);return d.length?[{rule:"R6",severity:"error",msg:`Duplicada con ID(s): ${d.map(x=>x.id).join(", ")}`}]:[];}},
  {id:"R7_WEAK_DEDUCTION",severity:"warning",desc:"Deducción vacía o repetida",
   check:(q)=>{if(!q.d||q.d.trim().length<3)return[{rule:"R7",severity:"warning",msg:"Deducción vacía"}];if(q.d.trim().toLowerCase()===q.a.trim().toLowerCase())return[{rule:"R7",severity:"warning",msg:"Deducción repite respuesta"}];return[];}},
  {id:"R8_NO_SOURCE",severity:"error",desc:"Source faltante",
   check:(q)=>(!q.source||q.source.trim().length<2)?[{rule:"R8",severity:"error",msg:"Source faltante"}]:[]},
  {id:"R9_PROC_NO_STEPS",severity:"error",desc:"Procedural sin steps",
   check:(q)=>{if(q.type&&q.type!=="recall"){if(!Array.isArray(q.steps)||q.steps.length<2)return[{rule:"R9",severity:"error",msg:`type=${q.type} sin steps`}];if(q.type==="invalid"&&(q.invalidIndex===null||q.invalidIndex===undefined))return[{rule:"R9",severity:"error",msg:"invalid sin invalidIndex"}];if(q.type==="filter"&&(!Array.isArray(q.validMask)||q.validMask.length!==q.steps.length))return[{rule:"R9",severity:"error",msg:"filter sin validMask válido"}];}return[];}},
  {id:"R10_AMBIGUOUS",severity:"warning",desc:"Pregunta ambigua",
   check:(q)=>(q.q.trim().length<15&&!q.q.includes("\n"))?[{rule:"R10",severity:"warning",msg:`Muy corta (${q.q.length} chars)`}]:[]},
  {id:"R11_DEBUG_ARTIFACT",severity:"error",desc:"Artefactos de generación",
   check:(q)=>/wait[:\s]|\.+\.+\.+/.test((q.a+" "+q.d).toLowerCase())?[{rule:"R11",severity:"error",msg:"Contiene wait/..."}]:[]},
  {id:"R12_NAV_CALC_ERROR",severity:"error",desc:"Cálculo NAV con artefacto",
   check:(q)=>(q.cat==="NAV"&&/wait/i.test(q.d))?[{rule:"R12",severity:"error",msg:"Deducción con 'wait'"}]:[]},
  {id:"R13_NO_SCENE",severity:"warning",desc:"Diagnóstico sin escena (categoría C)",
   check:(q)=>{const t=q.q.toLowerCase();const diag=/síntoma|sintoma|diagnóstico|diagnostico|qué hacer|que hacer|qué hace|que hace|qué pasa|que pasa|error:|corrección|correccion|qué produce|que produce|qué efecto|que efecto|qué representa|que representa|qué significa|que significa|qué revisar|que revisar/.test(t);if(!diag)return[];const hasVela=/genoa|génova|mayor|spinnaker|spi|cataviento|lanita|baluma|gratil|tangón|tangon|botavara|estay|slot|driza|cunningham|outhaul|contra|vang|amantillo|traveller|carro|escota|patín|patin|papel|brisa|baten|sag|burdas/.test(t);const hasCond=/viento|kn|nudo|racha|role|borneo|ceñida|popa|través|traves|largo|ola|escora|rumbo|grado|°|calma|flojo|fuerte|medio|liviano|regata|prestart|preparados|ejecutar|mark|baliza|start|largada|noche|canal|costera/.test(t);if(diag&&hasVela&&hasCond)return[];if(diag&&(q.cat==="REG"||q.cat==="SEG"||q.cat==="METEO")&&hasCond)return[];if(diag&&q.cat==="NAV"&&/\d/.test(t))return[];if(diag&&!hasVela)return[{rule:"R13",severity:"warning",msg:"Sin vela específica"}];if(diag&&hasVela&&!hasCond)return[{rule:"R13",severity:"warning",msg:"Con vela pero sin condición"}];return[];}},
  {id:"R14_SOURCE_CONTRADICTION",severity:"warning",desc:"Control mapeado a efectos distintos",
   check:(q,all)=>{const cm={sag:{e:"burdas"},papel:{e:"outhaul"},brisa:{e:"cunningham"}};const t=(q.q+" "+q.a+" "+q.d).toLowerCase();for(const[c,i]of Object.entries(cm)){if(t.includes(c)&&t.includes(i.e)){for(const o of all){if(o.id===q.id)continue;const ot=(o.q+" "+o.a+" "+o.d).toLowerCase();if(ot.includes(c)&&!ot.includes(i.e)&&o.source!==q.source){const oc=Object.keys(cm).find(x=>x!==c&&ot.includes(x));if(oc)return[{rule:"R14",severity:"warning",msg:`${c}→${i.e} en ${q.source} vs ${c}→${oc} en ${o.source}`}];}}}}return[];}},
];

// ─── Ejecutar ──────────────────────────────────────────────────────────────
const schemaIssues=checkSchema(questions);
const nearDups=checkNearDuplicates(questions);
const ctxAnchor=checkContextAnchor(questions);
const allIssues=[];const byRule={};const bySev={error:0,warning:0};
for(const q of questions){for(const rule of RULES){const issues=rule.check(q,questions);for(const issue of issues){allIssues.push({id:q.id,cat:q.cat,role:q.role,q:q.q.substring(0,70),...issue});byRule[issue.rule]=(byRule[issue.rule]||0)+1;bySev[issue.severity]++;}}}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  NAUT-Q-VALIDATOR — Validación mecánica + semántica          ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`\nTotal preguntas: ${questions.length}\n`);
console.log("── Chequeo mecánico (skill naut-q-validator) ──────────────────");
console.log(`  Schema issues:        ${schemaIssues.length}`);
console.log(`  Near-duplicate pairs:  ${nearDups.length} (${nearDups.filter(d=>d.likely_true_duplicate).length} true dups)`);
console.log(`  High conf no scene:    ${ctxAnchor.high_confidence_no_scene.length} (candidatos a reescritura)`);
console.log(`  Needs LLM review:      ${ctxAnchor.needs_llm_review.length} (mixto, requiere lectura)`);
console.log(`  Bare definition:      ${ctxAnchor.bare_definition.length} (probablemente OK)`);
console.log(`\n── Reglas semánticas ──────────────────────────────────────────`);
for(const rule of RULES){const c=byRule[rule.id]||0;const icon=c>0?(rule.severity==="error"?"❌":"⚠️ "):"✅";console.log(`${icon} ${rule.id.padEnd(28)} ${String(c).padStart(4)}  ${rule.severity.padEnd(7)} ${rule.desc}`);}
console.log(`\nIssues semánticos: ${allIssues.length} (${bySev.error} errors, ${bySev.warning} warnings)`);
console.log(`Preguntas con issues: ${new Set(allIssues.map(i=>i.id)).size}/${questions.length}\n`);

const errors=allIssues.filter(i=>i.severity==="error");
if(errors.length>0){console.log("── ERRORES ────────────────────────────────────────────────────");errors.forEach(i=>{console.log(`  #${i.id} [${i.cat}/${i.role}] ${i.rule}\n    Q: ${i.q}\n    → ${i.msg}\n`);});}
if(nearDups.length>0){console.log("── NEAR-DUPLICATES (order-aware) ────────────────────────────────");nearDups.forEach(d=>{console.log(`${d.likely_true_duplicate?"❌":"⚠️ "} #${d.id_a} ↔ #${d.id_b}  J=${d.jaccard} SR=${d.sequence_ratio}  ${d.likely_true_duplicate?"TRUE DUP":"near"}`);});console.log();}
if(ctxAnchor.high_confidence_no_scene.length>0){console.log("── HIGH CONFIDENCE NO SCENE (candidatos a reescritura) ────────");console.log("   (ver grounding-rubric.md para falsos positivos conocidos)");ctxAnchor.high_confidence_no_scene.slice(0,20).forEach(e=>console.log(`  #${e.id} [${e.cat}/${e.source}] ${e.q.substring(0,70)}`));if(ctxAnchor.high_confidence_no_scene.length>20)console.log(`  ... y ${ctxAnchor.high_confidence_no_scene.length-20} más`);console.log();}
if(allIssues.length===0&&schemaIssues.length===0&&nearDups.length===0)console.log("✅ Banco limpio.");
process.exit(bySev.error>0||schemaIssues.length>0?1:0);
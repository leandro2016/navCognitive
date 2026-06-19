// Shared constants for NavCognitive

export const LS = {
  customQ:   "naut_custom_q_v2",
  history:   "naut_history_v2",
  settings:  "naut_settings_v2",
  savedSession: "naut_saved_session_v1",
  reviews:   "naut_reviews_v1",
  schema:    "naut_schema_version",
};

export const SCHEMA_VERSION = 2;

export const DIFFICULTIES = [
  { id: "normal", label: "Normal",  sprintTime: 10, qTimer: 25, minFatigue: 1, restSeconds: 20 },
  { id: "hard",   label: "Difícil", sprintTime: 7,  qTimer: 20, minFatigue: 1, restSeconds: 20 },
  { id: "brutal", label: "Brutal",  sprintTime: 5,  qTimer: 15, minFatigue: 2, restSeconds: 12 },
  { id: "notimer",label: "Sin reloj", sprintTime: 99, qTimer: 99, minFatigue: 1, restSeconds: 20 },
  { id: "shrinking", label: "Degradable", sprintTime: 0, qTimer: 20, minFatigue: 1, restSeconds: 20 },
];

export const CAT_COLORS = {
  NAV: "#38BDF8", MAN: "#34D399", DEC: "#FB923C", REG: "#A78BFA", SIT: "#F0A500",
  TRIM: "#2DD4BF", TACT: "#F472B6", METEO: "#818CF8", SEG: "#EF4444",
};
export const CAT_LABELS = {
  NAV: "Navegación", MAN: "Maniobras", DEC: "Decisiones", REG: "Reglamento", SIT: "Situacional",
  TRIM: "Trimado", TACT: "Táctica", METEO: "Meteorología", SEG: "Seguridad",
};
export const CAT_DESC = {
  NAV: "Rumbos, declinación, VMG, laylines, corriente",
  MAN: "Virada, trasluchada, rizos, spinnaker, mark rounding",
  DEC: "Lado del recorrido, cuándo virar, cobrir/estirar",
  REG: "Derecho de paso, baliza, cambio de rumbo, protestas",
  SIT: "Borneos, tráfico, olas, comunicación, prioridades",
  TRIM: "Escota, traveler, cunningham, driza, barber, mayor",
  TACT: "Posicionamiento flota, cobertura, start, laylines tácticas",
  METEO: "Lectura viento, rachas, gradientes, nubes, corriente",
  SEG: "Hombre al agua, vela de tormenta, emergencias, equipo",
};
// Orden canónico para iterar UI y pesos adaptativos.
export const CAT_ORDER = ["NAV", "MAN", "DEC", "REG", "SIT", "TRIM", "TACT", "METEO", "SEG"];

// Tipos de pregunta: recall (texto) + procedurales (sequence/invalid/filter).
// timerMult: multiplicador del timer base según el tipo (más tiempo para leer pasos).
export const Q_TYPES = [
  { id: "recall",   label: "Recall",        timerMult: 1.0 },
  { id: "sequence", label: "Secuencia",    timerMult: 1.5 },
  { id: "invalid",  label: "Paso inválido", timerMult: 1.3 },
  { id: "filter",   label: "Filtrar",      timerMult: 1.3 },
];
export const Q_TYPE_MAP = Object.fromEntries(Q_TYPES.map(t => [t.id, t]));
export const INT_COLORS = { 1: "#38BDF8", 2: "#34D399", 3: "#FB923C", 4: "#F43F5E" };
export const INT_LABELS = { 1: "Baja", 2: "Media", 3: "Alta", 4: "Muy alta" };
export const FAT_LABELS = { 1: "Fresco", 2: "Activado", 3: "Fatigado", 4: "Al límite" };

export const RPE_TO_FATIGUE = { 1:1, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4, 10:4 };
export const RPE_LABELS = {
  1: "Muy fácil", 2: "Fácil", 3: "Moderado", 4: "Algo duro", 5: "Duro",
  6: "Duro+", 7: "Muy duro", 8: "Muy duro+", 9: "Extremo", 10: "Máximo",
};

export const S = {
  font:   "'Space Mono', monospace",
  bg:     "#060C14",
  bg2:    "#0D1826",
  bg3:    "#111D2E",
  border: "#1E293B",
  text:   "#F1F5F9",
  muted:  "#64748B",
  dim:    "#475569",
};

export const SESSION_TEMPLATES = {
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
  "walk": {
    label: "Caminata cognitiva",
    phases: [
      { id: "sprint", label: "Caminata",  duration: 1200, color: "#34D399" },
    ],
  },
  "custom": {
    label: "Sprint personalizado",
    phases: [
      { id: "sprint", label: "Sprint",  duration: 0, color: "#FBBF24" },
    ],
  },
  "repaso": {
    label: "Repaso (espaciado)",
    phases: [
      { id: "sprint", label: "Repaso",  duration: 0, color: "#F472B6" },
    ],
  },
  "procedural": {
    label: "Práctica procedural",
    phases: [
      { id: "sprint", label: "Procedural",  duration: 0, color: "#2DD4BF" },
    ],
  },
};

export const PHASE_EX_MAP = {
  warm:   ["JJ", "HK", "SQ", "CC", "TAP", "EQ", "EQC", "INH", "STR"],
  cardio: ["BU", "MC", "HK", "LS", "SL", "BJ", "JR", "JRA", "SHC", "BC"],
  man:    ["WS", "PL", "PLI", "PLD", "EQ", "EQC", "EQA", "CC", "TAP"],
  sprint: [],
};

export const PHASE_Q_MAP = {
  warm:   ["NAV", "SIT", "METEO"],
  cardio: ["NAV", "DEC", "SIT", "METEO"],
  man:    ["MAN", "TRIM", "DEC", "SIT"],
  sprint: ["NAV", "MAN", "DEC", "REG", "SIT", "TRIM", "TACT", "METEO", "SEG"],
};

export const ROLES = [
  { id: "ALL",  label: "General",          color: "#64748B", desc: "Cualquier tripulante" },
  { id: "GEN",  label: "Trimmer Génova",   color: "#38BDF8", desc: "Genoa, escota, barber, traveler de proa" },
  { id: "MAY",  label: "Trimmer Mayor",    color: "#34D399", desc: "Mayor, cunningham, botavara, traveler" },
  { id: "PRO",  label: "Proel",            color: "#FB923C", desc: "Proa, spinnaker, gennaker, maniobras de proa" },
  { id: "TAC",  label: "Táctico",          color: "#F472B6", desc: "Decisiones de recorrido, lectura de viento" },
  { id: "TIM",  label: "Timonel",          color: "#A78BFA", desc: "Rumbo, orza/escora, gobierno del barco" },
  { id: "PIT",  label: "Pit",              color: "#FBBF24", desc: "Drizas, escotas, winches, maniobras de cubierta" },
  { id: "NAVEG", label: "Navegante",       color: "#818CF8", desc: "Posición, cálculos, instrumentos, routing" },
  { id: "TOD",  label: "Todos los roles",  color: "#A78BFA", desc: "Decisiones de equipo completo" },
];
export const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]));
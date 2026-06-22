// Fix DEC/TACT/SIT questions: remove artifacts, dedup, add racing context
import { readFileSync, writeFileSync } from 'fs';

const path = 'Questions/naut-preguntas-master.json';
const bank = JSON.parse(readFileSync(path, 'utf8'));

const fixes = {
  // === FIX: Chinese character artifact ===
  509: { q: "Ceñida · Layline con tráfico adelante\n→ ¿Qué evitar?", a: "Llegar pasado o con tráfico en la layline", d: "Llegar justo o antes, sin bad air" },

  // === DEDUP: #197 vs #323 — merge into one better question, rewrite the other ===
  197: { q: "Recorrido barlovento-sotavento, viento borneando 20° a la derecha\n→ ¿Qué lado del recorrido cubrir?", a: "Lado derecho (cobrar el borneo)", d: "Borneo derecho favorece lado derecho del recorrido" },
  323: { q: "Recorrido barlovento-sotavento · Borneo persistente a la izquierda\n→ ¿Qué lado buscar?", a: "Lado izquierdo (navegar hacia el borneo futuro)", d: "Borneo persistente: navegar hacia donde rolará el viento" },

  // === DEDUP: #198 vs #500 — make them distinct ===
  198: { q: "Ceñida, bordo estribor · Borneo de 30° a la derecha (lift)\n→ ¿Virar o mantener?", a: "Mantener (el lift te favorece)", d: "Lift en estribor permite orzar, cobrar ángulo" },
  500: { q: "Ceñida, bordo estribor · Header de 25°\n→ ¿Virar o mantener?", a: "Virar (el header te perjudica)", d: "Header obliga a derivar, mejor virar al nuevo lift" },

  // === DEDUP: #199 vs #330 — make distinct ===
  199: { q: "Post virada sin velocidad, viento flojo 6 kn\n→ ¿Qué priorizar?", a: "Velocidad antes que altura", d: "Sin velocidad no se puede orzar", tags: ["viento-flojo","velocidad","post-virada"] },
  330: { q: "Ceñida, 18 kn, barco bajo presión tras virada\n→ ¿Qué viene primero: velocidad o altura?", a: "Velocidad, luego altura", d: "Acelerar primero, cerrar después" },

  // === DEDUP: #207 vs #510 — make distinct ===
  207: { q: "Posicionamiento en flota · ¿Qué busca el táctico?", a: "Lado con más viento o borneo favorable", d: "Estrategia de recorrido: viento + borneo" },
  510: { q: "Ceñida con flota numerosa · ¿Qué prioriza el táctico además del borneo?", a: "Lado con menos tráfico y bad air", d: "Borneo + viento + espacio limpio" },

  // === DEDUP: #209 vs #327 — make distinct ===
  209: { q: "Racha fuerte en ceñida, 18 kn · ¿Qué comunica el trimmer de mayor?", a: "\"Racha\" → bajar traveller", d: "Anticipar descarga con traveller antes que escota" },
  327: { q: "Racha fuerte en ceñida · ¿Qué hace el trimmer de mayor al pasar la racha?", a: "Subir traveller y re-trimar", d: "Recuperar potencia tras la racha" },

  // === DEDUP: #211 vs #511 — make distinct ===
  211: { q: "Maniobra de rizos · ¿Qué coordina los roles entre proel y copit?", a: "Disparadores verbales claros", d: "\"Rizo listo\" coordina el re-izado" },
  511: { q: "Virada en ceñida · ¿Qué coordina el momento exacto de soltar escota?", a: "Disparador verbal del timonel", d: "\"¡Vira!\" coordina el soltar" },

  // === DEDUP: #205 vs #206 — make more distinct ===
  205: { q: "Start, 30 s antes del cañón · ¿Qué controla el timonel?", a: "Posición en la línea y hueco", d: "No pasarse, no quedarse atrás" },
  206: { q: "Start, acelerando al cañón · ¿Qué controla el trimmer de génova?", a: "Trimado fino para máxima aceleración", d: "Velocidad al cruzar la línea" },

  // === IMPROVE: Make abstract questions more concrete ===
  200: { q: "Ceñida · ¿Gana quien navega más alto o quien tiene mejor VMG?", a: "Mejor VMG", d: "VMG = avance efectivo hacia barlovento, no altura" },
  201: { q: "Popa · ¿Gana quien baja más o quien tiene mejor VMG?", a: "Mejor VMG", d: "VMG = avance efectivo hacia sotavento, no ángulo" },
  202: { q: "Barco A: 7 kn STW con corriente adversa 2 kn\nBarco B: 6 kn STW con corriente favorable 2 kn\n→ ¿Quién llega antes?", a: "B", d: "SOG de B=8 kn vs SOG de A=5 kn" },
  203: { q: "Ceñida · Llegaste a la layline con tráfico adelante\n→ ¿Virar o continuar?", a: "Virar (no pasarse de la layline)", d: "Layline + tráfico = bad air, mejor virar" },
  204: { q: "Cobrir vs estirar · Borneo favorece tu lado\n→ ¿Cobrir o estirar?", a: "Cobrir (proteger el lado favorable)", d: "Cobrir = tapar al barco de atrás en tu lado" },
  324: { q: "Cobrir vs estirar · Borneo desfavorable, hay más viento adelante\n→ ¿Cobrir o estirar?", a: "Estirar (buscar viento nuevo)", d: "Estirar = navegar hacia viento nuevo y mejor" },
  325: { q: "Layline con tráfico denso · ¿Qué hacer?", a: "Virar antes para evitar bad air", d: "Tráfico en layline rompe el rumbo y el viento" },
  326: { q: "Start · ¿Qué busca el táctico en la línea?", a: "Lado con ventaja de viento y hueco limpio", d: "Posición + viento + tráfico" },
  506: { q: "Start · ¿Cómo elegir lado de línea de largada?", a: "Lado con más viento o borneo favorable", d: "Estrategia: viento + borneo del recorrido" },
  507: { q: "Flota · Barco de atrás cerca, puede pasarte\n→ ¿Cubrir o estirar?", a: "Cubrir (tapar su viento)", d: "Cobrir = proteger posición" },
  508: { q: "Flota · Barco de adelante, hay más viento en otro lado\n→ ¿Cubrir o estirar?", a: "Estirar (buscar viento nuevo)", d: "Estirar = navegar hacia mejor viento" },
  208: { q: "Borneo oscuro a 200 m en ceñida\n→ ¿Qué comunicar al timonel?", a: "\"Borneo a la derecha, intensidad baja, preparar orzar\"", d: "Oscuro = menos viento; anticipar orza" },
  210: { q: "Tráfico en la layline · ¿Qué priorizar?", a: "Evitar tráfico, mantener rumbo limpio", d: "Tráfico rompe el layline y genera bad air" },
  212: { q: "Ceñida, 15 kn, bajo presión tras virada\n→ ¿Qué hacer primero?", a: "Velocidad, luego altura", d: "Sin velocidad no se puede orzar" },
  328: { q: "Borneo oscuro adelante en ceñida, 10 kn\n→ ¿Qué hacer?", a: "Preparar orzar, comunicar intensidad baja", d: "Oscuro = menos viento, anticipar" },
  329: { q: "Tras borneo de 30° a la derecha en ceñida, bordo estribor\n→ ¿Qué hace el trimmer de genoa?", a: "Soltar ~10cm de escota", d: "Lift = mayor ángulo de incidencia → soltar escota" },
  331: { q: "Spinnaker en popa inestable, spi oscilando\n→ ¿Qué priorizar?", a: "Estabilidad y coordinación con timonel", d: "Evitar death roll" },
  512: { q: "Olas en ceñida, mar formado · ¿Qué ajustar?", a: "Trim más abierto, no orzar en la ola", d: "Atravesar la ola con velocidad" },
  513: { q: "Ola corta en ceñida · Génova · ¿Qué hacer?", a: "Trim más abierto", d: "Más ángulo para atravesar la ola" },
  514: { q: "Borneo a la derecha en ceñida · ¿Qué comunica el trimmer de mayor?", a: "\"Lift\" o \"header\" según el bordo", d: "Comunicar el cambio para decidir virar" },
  515: { q: "Tráfico en ceñida · ¿Qué evitar?", a: "Bad air (viento sucio de otros barcos)", d: "El viento de otro barco te frena" },
  516: { q: "Spi colapsando frecuentemente en popa\n→ ¿Qué comunicar?", a: "\"Colapso\" → ajustar escota o rumbo", d: "Coordinar con timonel" },
};

let fixed = 0;
for (const q of bank) {
  if (fixes[q.id]) {
    const f = fixes[q.id];
    if (f.q) q.q = f.q;
    if (f.a) q.a = f.a;
    if (f.d) q.d = f.d;
    if (f.tags) q.tags = f.tags;
    fixed++;
  }
}

writeFileSync(path, JSON.stringify(bank, null, 2) + '\n', 'utf8');
console.log(`Fixed ${fixed} questions`);
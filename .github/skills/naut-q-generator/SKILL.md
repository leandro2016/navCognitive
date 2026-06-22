---
name: naut-q-generator
description: 'Generador de preguntas cognitivas de regata para NavCognitive. Usa cuando: agregar preguntas al banco maestro (Questions/naut-preguntas-master.json), transformar una situacion/relato/manual de regata en preguntas y respuestas, crear preguntas de navegacion/trimado/maniobras/reglamento/situacional en español, expandir el banco de preguntas cognitivas, generar preguntas on-the-fly para una sesion activa. Cubre racing, navigation, trimming, maneuvers, decisions, rules, situational awareness, meteorologia, seguridad. Palabras clave: pregunta, pregunta cognitiva, regata, trimado, maniobra, navegacion, rumbo, genoa, spinnaker, layline, VMG, reglamento, situacion, ingerir material, transformar situacion, agregar pregunta, base de preguntas, on the fly, runtime.'
argument-hint: 'tema y cantidad, o pega una situacion para transformar, o "runtime: <tema>"'
---

# Generador de preguntas cognitivas de regata (NavCognitive)

Genera y agrega preguntas al banco de NavCognitive en español, con el schema
exacto que usa la app. Trabaja en tres modos:

- **Generar**: a partir de un tema + cantidad (y opcionalmente cat/role/fatigue).
- **Ingerir/Transformar**: a partir de una situacion, relato, incidente o
  parrafo de manual de regata → extrae puntos enseñables y los convierte en Q&A.
- **Runtime**: genera un bloque de preguntas frescas **sin persistir** (para que
  un agente las inyecte en la sesion activa de la app on-the-fly).

En los modos Generar e Ingerir el destino es el JSON maestro
`Questions/naut-preguntas-master.json` (append, IDs positivos secuenciales).
En modo Runtime el destino es la salida del agente (no se escribe archivo).

## Cuando usar

- "agregá 10 preguntas de trimado de génova"
- "transformá esta situacion en preguntas: <relato>"
- "ingerí este manual y sacá preguntas de reglamento"
- "necesito más preguntas de maniobras de spinnaker"
- "expandí la base con preguntas de layline y VMG"
- "runtime: generá 5 preguntas de regla 18 para esta sesión"
- "generá preguntas on the fly de meteorología"

## Documentacion fuente

El banco se alimenta de la documentacion recopilada en `Questions/nautica-reg/`,
organizada por temas. Cada carpeta mapea a categorias del schema:

| Carpeta doc | Categorias |
|-------------|-----------|
| `navegacion/15_NAVEGACION_COSTERA_Y_RIO_DE_LA_PLATA.md` | NAV |
| `navegacion/17_CORRIENTES_Y_MAREAS.md` | NAV, METEO |
| `metereologia/16_METEOROLOGIA_PARA_REGATISTAS.md` | METEO, TACT |
| `maniobras/04_MANIOBRAS_Y_ACCIONES.md` | MAN, TRIM, SIT |
| `trimming/05_AERODINAMICA.md` | TRIM |
| `trimming/06_MAYOR.md` | TRIM |
| `trimming/07_GENOVA.md` | TRIM |
| `trimming/08_SPINNAKER.md` | TRIM |
| `reglamento/01_RRS.md` | REG |
| `reglamento/02_COLREG.md` | REG, SEG |
| `reglamento/03_IALA_LUCES_MARCAS.md` | REG, SEG |
| `reglamento/13_LUCES_AVANZADAS.md` | SEG |
| `reglamento/14_CASOS_DE_PROTESTA.md` | REG |

Al generar preguntas de un tema, **leer primero la documentacion relevante**
para basar las preguntas en el material (no inventar hechos). Si el tema no
tiene documentacion, generar de conocimiento general de regata pero marcar
`source: "general"`.

## Schema obligatorio de pregunta

Ver `./references/question-schema.md` para el detalle completo. Resumen:

```json
{
  "id": <number positivo y unico>,
  "cat": "NAV" | "MAN" | "DEC" | "REG" | "SIT" | "TRIM" | "TACT" | "METEO" | "SEG",
  "role": "ALL" | "GEN" | "MAY" | "PRO" | "TAC" | "TIM" | "PIT" | "NAVEG" | "TOD",
  "fatigue": 1 | 2 | 3 | 4,
  "q": "texto (puede usar \\n para multilinea)",
  "a": "respuesta concisa",
  "d": "deduccion / calculo / razonamiento corto",
  "tags": ["..."],
  "difficulty": <number|null>,
  "source": "15_NAVEGACION" | "17_CORRIENTES" | "16_METEOROLOGIA" | "maniobras" | "05_AERODINAMICA" | "06_MAYOR" | "07_GENOVA" | "08_SPINNAKER" | "01_RRS" | "02_COLREG" | "03_IALA" | "13_LUCES" | "14_PROTESTA" | "general" | "relato"
}
```

- `cat`: NAV=Navegacion, MAN=Maniobras, DEC=Decisiones, REG=Reglamento, SIT=Situacional, TRIM=Trimado, TACT=Tactica, METEO=Meteorologia, SEG=Seguridad.
- `role`: ALL=General, GEN=Trimmer Genova, MAY=Trimmer Mayor, PRO=Proel, TAC=Tactico, TIM=Timonel, PIT=Pit, NAVEG=Navegante, TOD=Todos.
- `fatigue`: 1=Fresco, 2=Activado, 3=Fatigado, 4=Al limite.
- `difficulty`: opcional (numero 1-4). Dejar `null` si no aplica.
- `source`: **campo obligatorio**. Indica el archivo doc de origen (sin
  extension) para trazabilidad. Usar `"general"` si no viene de la docs, o
  `"relato"` si viene de un relato ingerido.
- `type`: opcional, `"recall"` (default), `"sequence"`, `"invalid"`, `"filter"`.
- `steps`, `invalidIndex`, `validMask`: para preguntas procedurales (ver
  `./references/procedural-examples.md`).

## Procedimiento

### 0. Detectar modo

- Si el input empieza con `runtime:` o pide "on the fly" / "para esta sesión"
  sin persistir → modo **Runtime**.
- Si el input trae un **tema + cantidad** (o filtros cat/role/fatigue) → modo **Generar**.
- Si el input trae un **relato/situacion/texto de manual** → modo **Ingerir**.
- Si trae ambos, hacer Ingerir primero (el material prima sobre el tema suelto).

### 1. Leer el estado actual del banco

1. Leer `Questions/naut-preguntas-master.json`.
2. Calcular `maxId = max(q.id)` (IDs existentes son positivos secuenciales).
3. Construir un `Set` de textos `q` existentes para evitar duplicados.
4. Si el archivo no existe o esta vacio, partir de id=1.

### 2. Leer documentacion relevante

- Segun el tema/categoria, leer el archivo correspondiente de
  `Questions/nautica-reg/` (ver tabla arriba).
- Extraer conceptos, calculos, reglas, secuencias y diagnosticos del material.
- Basar las preguntas en el contenido real de la documentacion.

### 3. Generar las preguntas

#### Modo Generar
- Pedir/confirmar: tema, cantidad, y opcional `cat`, `role`, `fatigue`.
- Si no se especifica cat/role/fatigue, distribuir de forma realista segun el
  tema (no poner todo en ALL).
- Cada pregunta debe ser respondible en ~20-25 s (tiempo de qTimer de la app).
- Asignar `source` segun el archivo doc de origen.

#### Modo Ingerir/Transformar
- Leer el material y **extraer puntos enseñables**: decisiones, calculos,
  reglas aplicables, secuencias de maniobra, claves situacionales.
- No inventar hechos que no esten en el material; si el material es ambiguo,
  generar la pregunta sobre lo que si esta claro y marcarla con tag
  `ingerido` + tag del origen (ej. `manual`, `relato`, `incidente`).
- Una situacion puede rendir 2-6 preguntas; no forzar cantidad fija.
- Asignar `source: "relato"` o el archivo doc correspondiente.

#### Modo Runtime
- Generar un bloque JSON de preguntas frescas (array de objetos) **sin
  escribir archivo**.
- Los IDs pueden ser temporales (ej. negativos o `null`); la app los
  reasignara al inyectarlos.
- El agente que invoca este modo recibe el JSON y lo inyecta en la sesion
  activa via el mecanismo de preguntas custom de la app (IDs negativos).
- Ideal para sesiones tematicas dinamicas: "5 preguntas de regla 18", "3 de
  trimado de spinnaker en viento flojo", etc.
- Devolver **solo el array JSON**, sin prose explicativa (el agente lo consume).

### 3.5. Gate de autocontención (obligatorio antes de escribir cualquier `q`)

Antes de aceptar una pregunta como terminada — en CUALQUIER modo (Generar,
Ingerir, Runtime) — aplicar esta prueba a cada `q` individualmente:

**¿Puede alguien que NUNCA leyó el documento fuente entender e imaginar la
escena completa solo leyendo `q`?**

Esto importa especialmente para preguntas extraídas de un subtítulo de
documento (patrón `## Concepto` → pregunta directa). El subtítulo de un doc
SIEMPRE asume el contexto del párrafo que lo rodea; una pregunta extraída
de un subtítulo sin reconstruir ese contexto pierde la escena.

Clasificar cada `q` candidata en una de tres categorías antes de aceptarla:

1. **Definición/función pura** ("¿Qué controla el outhaul?", "¿Qué mide la
   corredera?") → OK sin escena. No requiere viento/rumbo/vela.

2. **Relación causal universal** ("Más profundidad → ¿qué genera?") → OK
   sin escena SOLO SI la relación es verdaderamente incondicional (no
   depende del punto de vela, viento, ni rumbo). Si la respuesta que estás
   por escribir empieza con "depende de..." o "solo cuando...", la pregunta
   necesita esa condición explícita en `q`, no escondida en `a`.

3. **Diagnóstico/síntoma/acción recomendada** ("¿Síntoma de X?",
   "¿Diagnóstico ante Y?", "¿Qué hacer si Z?") → NUNCA sin escena. Estas
   SIEMPRE necesitan: qué vela, qué viento/rumbo (aproximado está bien:
   "8-25kn" es el rango de realismo ya definido en Criterios de calidad), y
   qué se observó. Si no podés escribir esa escena en una línea, la pregunta
   no está lista — volvé al documento fuente y leé el párrafo completo, no
   solo el subtítulo.

**Chequeo adicional — una pregunta, un hecho:** si al escribir `a` te
encontrás listando síntomas/acciones de MÁS DE UNA vela o situación
distinta (ej. "lanitas caídas, spi colapsando, mayor sobretrimada" — tres
velas en una respuesta), es señal de que estás comprimiendo varias
preguntas en una. Dividir en preguntas separadas, una por vela/situación,
cada una con su propia escena. No fusionar para "ahorrar" — cada pregunta
debe poder responderse pensando en UNA escena, no en una lista genérica de
síntomas de toda la categoría.

**Ejemplo de rechazo y reescritura:**

❌ Mal (subtítulo directo, sin escena, mezcla 3 velas):
```json
{ "q": "Ángulo de ataque demasiado grande · ¿Síntoma?",
  "a": "Lanitas caídas, spi colapsando, mayor sobretrimada" }
```

✅ Bien (escena concreta, una vela por pregunta):
```json
{ "q": "Ceñida, 10kn, escota de génova muy cazada\n→ ¿Qué indican las lanitas?",
  "a": "Lanita interior cae (señal de pérdida)" }
```

Si tenés dudas sobre si una pregunta pasa este gate, preferí pecar de
agregar una línea de contexto de más antes que dejarla abstracta — el costo
de una línea extra es mucho menor que el de una pregunta sin sentido en la
sesión de un usuario real.

### 4. Criterios de calidad (todas las preguntas)

- **En español**, terminologia nautica de regata (rumbo, escora, borneo, orza,
  ceñida, traverso, largo, popa, layline, VMG, VMC, spinnaker, genoa, mayor,
  proel, popa, escota, driza, rizos, etc.).
- **`q` concisa**: puede usar `\n` para separar datos (ej. viento, rumbo, angulo).
- **`a` concisa**: un numero, un rumbo, o una frase corta (<80 chars). No parrafos.
- **`d` obligatoria**: mostrar el calculo o el porque en una linea
  (ej. `"9/6=1.5h"`, `"Dec W → sumar al rumbo verdadero"`).
- **Realismo de regata**: situaciones plausibles (viento 8-25 kn, olas, borneos,
  trafico, laylines, reglas de derecho de paso).
- **Sin duplicados**: comparar el texto `q` (normalizado, sin espacios/minusculas)
  contra el Set del paso 1. Si coincide, descartar o reformular.
- **fatigue coherente**: calculos simples → 1-2; decisiones bajo presion/maniobras
  rapidas → 2-3; calculos multiples o reglas complejas → 3-4.
- **difficulty** (opcional): 1=facil, 2=media, 3=dificil, 4=avanzada. `null` si
  no se quiere asignar.
- **source obligatorio**: toda pregunta debe indicar su origen.

### Reglas semánticas obligatorias (ver ./references/validation-rules.md)

El banco se valida con `npm run validate` (12 reglas semánticas). Las preguntas
generadas deben pasar el validador sin errores. Reglas clave:

- **R1_ROLE_VELA_MISMATCH**: el rol debe responder sobre su vela. Si la pregunta
  es de aerodinámica general (afecta genoa, mayor y spi), usar `role: "ALL"`.
  - GEN → genoa/escota/patín/brisa/papel/entrenador/baten/sag
  - MAY → mayor/cataviento/traveller/cunningham/outhaul/contra/amantillo
  - PRO → spinnaker/tangón/braza/gratil/driza
- **R2_TRIM_NO_CONTEXT**: las preguntas de TRIM deben incluir contexto de
  condición (viento, rumbo, ola, escora) o ser claramente conceptuales.
  - Mal: "Ángulo de ataque demasiado grande · ¿Síntoma?"
  - Bien: "Ceñida, 15 kn, ángulo de ataque demasiado grande · ¿Síntoma en genoa?"
- **R4_MULTI_VELA_CONFUSION**: la respuesta no debe mezclar síntomas de múltiples
  velas sin contexto. Si es de genoa, la respuesta es sobre genoa.
  - Mal: "Lanitas caídas, spi colapsando, mayor sobretrimada"
  - Bien: "Lanita interior cae" (si es de genoa)
- **R11_DEBUG_ARTIFACT**: no incluir `wait`, `...`, ni notas de proceso interno.

### 5. Asignar IDs y armar el bloque (modos Generar e Ingerir)

- Primer id nuevo = `maxId + 1`, luego secuenciales.
- Construir el array de nuevas preguntas en el mismo orden de IDs.

### 6. Append al JSON maestro (modos Generar e Ingerir)

- Editar `Questions/naut-preguntas-master.json` agregando las nuevas
  preguntas al final del array, manteniendo el formato existente (2 espacios de
  indentacion, misma estructura de campos).
- **No** renumerar ni reordenar preguntas existentes.
- **No** tocar `id` existentes.
- Preservar el cierre `]` del array.

### 7. Validar (modos Generar e Ingerir)

- Ejecutar `npm run validate` para validar semánticamente las preguntas nuevas.
- Si hay errores (R1, R4, R6, R8, R9, R11, R12), corregir las preguntas antes
  de confirmar.
- Si hay warnings (R2, R3, R5, R7, R10), revisar y mejorar si es posible.
- Reportar el resultado del validador en el resumen.

### 8. Reportar (modos Generar e Ingerir)

Devolver un resumen corto:
- Cantidad agregada y rango de IDs nuevos.
- Desglose por `cat` y por `role`.
- 1-2 ejemplos de las preguntas agregadas.
- Si se descartaron duplicados, indicar cuantos.

## Anti-patrones

- No crear un JSON aparte por tanda (el usuario eligio append al maestro).
- No usar IDs negativos en el maestro (esos son para preguntas custom del
  usuario en la app; el builtin siempre usa positivos).
- No generar preguntas sin `d` (la deduccion es parte del valor cognitivo).
- No generar preguntas sin `source` (la trazabilidad es obligatoria).
- No inventar datos en modo Ingerir; solo transformar lo que el material dice.
- No mezclar idiomas; todo en español.
- No editar `src/lib/session.js` ni la app; este skill solo toca el JSON de
  preguntas (excepto modo Runtime que devuelve JSON sin tocar archivos).
- No ignorar la documentacion de `Questions/nautica-reg/`; leerla antes de
  generar.

## Referencias

- [Schema y taxonomia completa](./references/question-schema.md)
- [Reglas de validación semántica](./references/validation-rules.md)
- [Ejemplos por categoria](./references/examples.md)
- [Como describir situaciones para ingerir](./references/input-guide.md)
- [Ejemplos de preguntas procedurales](./references/procedural-examples.md)
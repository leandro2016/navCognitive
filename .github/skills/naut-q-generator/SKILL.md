---
name: naut-q-generator
description: 'Generador de preguntas cognitivas de regata para NavCognitive. Usa cuando: agregar preguntas a la base builtin (Questions/naut-preguntas-*.json), transformar una situacion/relato/manual de regata en preguntas y respuestas, crear preguntas de navegacion/trimado/maniobras/reglamento/situacional en español, expandir el banco de preguntas cognitivas. Cubre racing, navigation, trimming, maneuvers, decisions, rules, situational awareness. Palabras clave: pregunta, pregunta cognitiva, regata, trimado, maniobra, navegacion, rumbo, genoa, spinnaker, layline, VMG, reglamento, situacion, ingerir material, transformar situacion, agregar pregunta, base de preguntas.'
argument-hint: 'tema y cantidad, o pega una situacion para transformar'
---

# Generador de preguntas cognitivas de regata (NavCognitive)

Genera y agrega preguntas al banco builtin de NavCognitive en español, con el
schema exacto que usa la app. Trabaja en dos modos:

- **Generar**: a partir de un tema + cantidad (y opcionalmente cat/role/fatigue).
- **Ingerir/Transformar**: a partir de una situacion, relato, incidente o
  parrafo de manual de regata → extrae puntos enseñables y los convierte en Q&A.

En ambos casos el destino es el JSON builtin
`Questions/naut-preguntas-2026-06-18.json` (append, IDs positivos secuenciales).

## Cuando usar

- "agregá 10 preguntas de trimado de génova"
- "transformá esta situacion en preguntas: <relato>"
- "ingerí este manual y sacá preguntas de reglamento"
- "necesito más preguntas de maniobras de spinnaker"
- "expandí la base con preguntas de layline y VMG"

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
  "difficulty": <number|null>
}
```

- `cat`: NAV=Navegacion, MAN=Maniobras, DEC=Decisiones, REG=Reglamento, SIT=Situacional, TRIM=Trimado, TACT=Tactica, METEO=Meteorologia, SEG=Seguridad.
- `role`: ALL=General, GEN=Trimmer Genova, MAY=Trimmer Mayor, PRO=Proel, TAC=Tactico, TIM=Timonel, PIT=Pit, NAVEG=Navegante, TOD=Todos.
- `fatigue`: 1=Fresco, 2=Activado, 3=Fatigado, 4=Al limite.
- `difficulty`: opcional (numero). Dejar `null` si no aplica.

## Procedimiento

### 0. Detectar modo

- Si el input trae un **tema + cantidad** (o filtros cat/role/fatigue) → modo **Generar**.
- Si el input trae un **relato/situacion/texto de manual** → modo **Ingerir**.
- Si trae ambos, hacer Ingerir primero (el material prima sobre el tema suelto).

### 1. Leer el estado actual del banco

1. Leer `Questions/naut-preguntas-2026-06-18.json`.
2. Calcular `maxId = max(q.id)` (IDs existentes son positivos secuenciales).
3. Construir un `Set` de textos `q` existentes para evitar duplicados.
4. Si el archivo no existe o esta vacio, partir de id=1.

### 2. Generar las preguntas

#### Modo Generar
- Pedir/confirmar: tema, cantidad, y opcional `cat`, `role`, `fatigue`.
- Si no se especifica cat/role/fatigue, distribuir de forma realista segun el
  tema (no poner todo en ALL).
- Cada pregunta debe ser respondible en ~20-25 s (tiempo de qTimer de la app).

#### Modo Ingerir/Transformar
- Leer el material y **extraer puntos enseñables**: decisiones, calculos,
  reglas aplicables, secuencias de maniobra, claves situacionales.
- No inventar hechos que no esten en el material; si el material es ambiguo,
  generar la pregunta sobre lo que si esta claro y marcarla con tag
  `ingerido` + tag del origen (ej. `manual`, `relato`, `incidente`).
- Una situacion puede rendir 2-6 preguntas; no forzar cantidad fija.

### 3. Criterios de calidad (todas las preguntas)

- **En español**, terminologia nautica de regata (rumbo, escora, borneo, orza,
  ceñida, traverso, largo, popa, layline, VMG, VMC, spinnaker, genoa, mayor,
  proel, popa, escota, driza, rizos, etc.).
- **`q` concisa**: puede usar `\n` para separar datos (ej. viento, rumbo, angulo).
- **`a` concisa**: un numero, un rumbo, o una frase corta. No parrafos.
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

### 4. Asignar IDs y armar el bloque

- Primer id nuevo = `maxId + 1`, luego secuenciales.
- Construir el array de nuevas preguntas en el mismo orden de IDs.

### 5. Append al JSON builtin

- Editar `Questions/naut-preguntas-2026-06-18.json` agregando las nuevas
  preguntas al final del array, manteniendo el formato existente (2 espacios de
  indentacion, misma estructura de campos).
- **No** renumerar ni reordenar preguntas existentes.
- **No** tocar `id` existentes.
- Preservar el cierre `]` del array.

### 6. Reportar

Devolver un resumen corto:
- Cantidad agregada y rango de IDs nuevos.
- Desglose por `cat` y por `role`.
- 1-2 ejemplos de las preguntas agregadas.
- Si se descartaron duplicados, indicar cuantos.

## Anti-patrones

- No crear un JSON aparte por tanda (el usuario eligio append al builtin).
- No usar IDs negativos (esos son para preguntas custom del usuario en la app;
  el builtin siempre usa positivos).
- No generar preguntas sin `d` (la deduccion es parte del valor cognitivo).
- No inventar datos en modo Ingerir; solo transformar lo que el material dice.
- No mezclar idiomas; todo en español.
- No editar `src/lib/session.js` ni la app; este skill solo toca el JSON de
  preguntas.

## Referencias

- [Schema y taxonomia completa](./references/question-schema.md)
- [Ejemplos por categoria](./references/examples.md)
- [Como describir situaciones para ingerir](./references/input-guide.md)
- [Ejemplos de preguntas procedurales](./references/procedural-examples.md)
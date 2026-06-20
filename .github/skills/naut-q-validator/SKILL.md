---
name: naut-q-validator
description: 'Auditor de calidad para el banco de preguntas de NavCognitive (Questions/naut-preguntas-master.json). Usa cuando: el usuario pide validar, auditar, revisar calidad, chequear, o limpiar el banco de preguntas; sospecha que hay preguntas sin sentido, sin contexto, ambiguas o contradictorias; quiere detectar duplicados; quiere poner en cuarentena una fuente conflictiva; o quiere un reporte de salud del banco antes/despues de una sesion de generacion masiva con naut-q-generator. Tambien usa esto ANTES de aprobar un lote grande de preguntas nuevas generadas por naut-q-generator, como gate de calidad. Palabras clave: validar, auditar, revisar, calidad, sin sentido, sin contexto, contradiccion, duplicado, cuarentena, limpiar banco, chequear preguntas, reporte de salud.'
argument-hint: 'modo: "auditoria completa" | "solo TRIM" | "cuarentena <source>" | "revisar lote nuevo <rango de ids>"'
---

# Validador de preguntas cognitivas (NavCognitive)

Audita `Questions/naut-preguntas-master.json` en busca de tres clases de
defecto, encontradas en una auditoría real de 646 preguntas (ver hallazgos
abajo). Este skill **nunca edita el banco maestro directamente** — siempre
produce un reporte y/o un archivo `.NEW.json` separado que el usuario revisa
y reemplaza manualmente. La razón: una reescritura mal hecha es peor que una
pregunta sin revisar, porque parece arreglada.

## Contexto: por qué existe este skill

Una auditoría sobre el banco real encontró que el 95% de las preguntas de
categoría `TRIM` carecen de un ancla situacional (viento, rumbo, vela,
síntoma observado) — son subtítulos de documento convertidos directo en
`q`/`a`, perdiendo el párrafo que les daba sentido. Ejemplo real:

```json
{ "id": 61, "cat": "TRIM",
  "q": "Ángulo de ataque demasiado grande · ¿Síntoma?",
  "a": "Lanitas caídas, spi colapsando, mayor sobretrimada" }
```

Esta pregunta mezcla síntomas de TRES velas distintas sin decir de cuál se
habla — el lector no tiene ninguna escena que razonar. Además se encontró
una fuente (`charla-genoa-manzoli`, 110 preguntas) cuyo vocabulario de
controles **contradice** a los docs base (mapea sag→outhaul cuando
`05_AERODINAMICA.md` dice sag→burdas). Esa fuente fue puesta en cuarentena.

El defecto no es aleatorio: viene de que `naut-q-generator` (modo Generar)
extrae preguntas de subtítulos de markdown sin verificar autocontención. Si
solo arreglás las preguntas existentes pero no tocás ese pipeline, el
defecto vuelve la próxima vez que generes. Por eso este skill también sirve
como **gate de calidad** a correr después de cualquier sesión de generación
masiva, no solo como limpieza única.

## Modos

### 1. Auditoría completa
Corre todos los chequeos sobre el banco entero y produce un reporte.

### 2. Auditoría acotada (por categoría/fuente/rango de ids)
Igual que arriba pero filtrado — útil para revisar solo lo que se generó en
una sesión reciente antes de darla por buena.

### 3. Cuarentena de fuente
Saca todas las preguntas de un `source` específico a un archivo separado,
sin tocar el maestro original. Para cuando se detecta una fuente con
vocabulario contradictorio (ver `references/contradiction-detection.md`).

### 4. Revisión de lote nuevo (post-generación)
Variante de (2) pensada para correr inmediatamente después de que
`naut-q-generator` agregue preguntas nuevas, sobre el rango de ids nuevo,
antes de que el usuario las dé por aceptadas.

## Procedimiento

### Paso 1 — Correr el chequeo mecánico (siempre, es gratis y determinístico)

```bash
python3 scripts/mechanical_checks.py Questions/naut-preguntas-master.json --out /tmp/mech_report.json
```

Esto NO juzga sentido ni contexto — solo schema, duplicados casi-exactos por
similitud de texto, distribución por fuente/categoría, fuentes desconocidas,
y una triple categorización por heurística de "¿tiene esta pregunta su
propia escena?":

- `high_confidence_no_scene`: lenguaje diagnóstico (síntoma/diagnóstico/
  causa/acción) sin ningún ancla numérica o situacional. En la auditoría
  manual, esta categoría tuvo prácticamente cero falsos positivos — son
  candidatos seguros para reescritura directa.
- `needs_llm_review`: forma de subtítulo o muy corta, pero sin verbo
  diagnóstico claro. Es una bolsa mixta — incluye definiciones legítimas
  Y preguntas vagas con otra forma. Esto SÍ requiere lectura (paso 2).
- `bare_definition`: preguntas de definición/función puras
  ("¿Qué controla el outhaul?"). Generalmente están bien así. Revisar solo
  si el término usado es ambiguo (ver categoría B de la rúbrica).

Leer el resumen (`report["summary"]`) primero para dimensionar el trabajo
antes de entrar a la lista pregunta por pregunta.

### Paso 2 — Revisión semántica (requiere leer, no es regex)

Leer `references/grounding-rubric.md` ANTES de evaluar cualquier pregunta de
`needs_llm_review` o `high_confidence_no_scene`. La rúbrica define tres
categorías (definición / causal-directa / diagnóstica) con criterios
distintos — no tratar todo lo "corto" como defectuoso, ni todo lo "con
síntoma" como aceptable.

Para cada pregunta marcada como defectuosa (categoría C de la rúbrica, o B
mal disfrazada):

1. Releer el párrafo completo del doc fuente (no solo el subtítulo) —
   `source` en el JSON apunta al archivo (ej. `05_AERODINAMICA` →
   `nautica-reg/trimming/05_AERODINAMICA.md`).
2. Identificar el dato de contexto faltante (viento/rumbo/vela/fase).
3. Proponer una reescritura concreta de `q` (y de `a`/`d` si hace falta
   ajustarlas a la escena), siguiendo el ejemplo completo en la rúbrica.
4. Si la respuesta original mezclaba conceptos de más de una vela/situación
   (como el caso #61), proponer dividir en preguntas separadas en vez de
   forzar un solo enunciado a cubrir todo.

No escribir estas reescrituras directo al JSON maestro. Acumularlas en un
archivo de propuestas (ver Paso 4).

### Paso 3 — Detección de contradicciones cruzadas

Cuando el banco tenga más de una fuente cubriendo el mismo sub-tema (ej. dos
fuentes hablando de qué controla el sag), seguir
`references/contradiction-detection.md` para comparar los mapeos
control→efecto y decidir si coexisten, se fusionan, o una va a cuarentena.

Para poner una fuente en cuarentena:

```bash
python3 scripts/quarantine_source.py Questions/naut-preguntas-master.json \
  --source <nombre-de-source> \
  --reason "<por qué, con el conflicto específico citado>" \
  --quarantine-out Questions/cuarentena-<nombre-de-source>.json \
  --master-out Questions/naut-preguntas-master.NEW.json
```

Esto nunca sobreescribe el original. Reportar al usuario el conteo
cuarentenado y el conflicto detectado; el usuario decide si reemplaza el
maestro con el `.NEW.json` o no.

### Paso 4 — Reportar

Nunca aplicar cambios al JSON maestro automáticamente. Producir:

1. **Resumen ejecutivo**: conteos por categoría de hallazgo (schema,
   duplicados, sin-contexto-alta-confianza, sin-contexto-revisado,
   contradicciones, fuentes desconocidas) Y un conteo de cuántas preguntas
   de `high_confidence_no_scene` resultaron ser falsos positivos del
   heurístico tras la lectura (ver "El heurístico se equivoca" en la
   rúbrica) — esto importa para calibrar confianza en corridas futuras.

2. **Archivo de propuestas** `Questions/propuestas-revision-<fecha>.json`
   con este schema FIJO (no improvisar variantes):

   ```json
   {
     "_meta": {
       "generated_at": "<ISO timestamp>",
       "source_master": "Questions/naut-preguntas-master.json",
       "total_reviewed": 50,
       "false_positives_found": 6,
       "proposals_count": 38
     },
     "proposals": [
       {
         "id": 61,
         "cat": "TRIM",
         "rubric_category": "C",
         "issue": "Mezcla síntomas de 3 velas distintas sin anclar ninguna; sin viento/rumbo.",
         "action": "split",
         "q_original": "Ángulo de ataque demasiado grande · ¿Síntoma?",
         "a_original": "Lanitas caídas, spi colapsando, mayor sobretrimada",
         "split_into": [
           { "q": "Ceñida, 10kn, escota de génova muy cazada\n→ ¿Qué indican las lanitas?",
             "a": "Lanita interior cae (señal de pérdida)",
             "d": "Exceso de ángulo de ataque en el génova" },
           { "q": "Popa con spinnaker, escota sobrecazada\n→ ¿Qué le pasa a la vela?",
             "a": "Colapsa detrás de la mayor / pierde proyección",
             "d": "Exceso de ángulo de ataque en el spi" },
           { "q": "Mayor con demasiada escota cazada en ceñida\n→ ¿Qué se observa?",
             "a": "Mayor sobretrimada, timón pesado",
             "d": "Exceso de ángulo de ataque en la mayor" }
         ]
       },
       {
         "id": 77,
         "cat": "TRIM",
         "rubric_category": "C",
         "issue": "Diagnóstico de mayor sin viento ni rumbo.",
         "action": "rewrite",
         "q_original": "Cataviento escondido permanentemente · ¿Diagnóstico?",
         "a_original": "Falta twist, baluma cerrada",
         "q_propuesta": "Ceñida, 15kn, cataviento superior de la mayor nunca aparece\n→ ¿Diagnóstico?",
         "a_propuesta": "Falta twist, baluma cerrada",
         "d_propuesta": "Falta twist, baluma cerrada"
       },
       {
         "id": 418,
         "cat": "TRIM",
         "rubric_category": "B",
         "issue": "FALSO POSITIVO del heurístico — relación causal universal, no necesita escena.",
         "action": "no_change"
       }
     ]
   }
   ```

   Reglas del schema:
   - `action` es uno de: `"rewrite"` (cambia `q`/`a`/`d` manteniendo 1
     pregunta), `"split"` (una pregunta original se vuelve N preguntas
     nuevas, usar `split_into`), `"no_change"` (revisado y está bien —
     incluir SIEMPRE estos casos en el archivo, no omitirlos, para que el
     usuario vea que fueron chequeados y no saltados).
   - `rubric_category` es A, B, o C según la rúbrica — siempre presente,
     incluso en `no_change`, porque documenta el razonamiento.
   - Nunca usar `id` nuevo en este archivo para preguntas tipo `rewrite` —
     el id se mantiene, solo cambia el contenido. Los ids para `split_into`
     se asignan recién cuando el usuario aprueba y se hace el append real
     (mismo criterio que `naut-q-generator`: `maxId + 1` en adelante).

3. Si el usuario confirma que aplique las propuestas, recién ahí editar el
   JSON maestro pregunta por pregunta (mismo id para `rewrite`, ids nuevos
   secuenciales solo para `split_into` reemplazando el id original que se
   da de baja), y mostrar un diff antes/después de cada cambio aplicado.

### Referencia de calibración (golden set)

Antes de confiar en una corrida completa sobre las ~267 preguntas
candidatas del banco, está disponible una revisión humana de referencia
sobre las primeras 50 (`high_confidence_no_scene` del banco post-cuarentena
de manzoli, 536 preguntas totales). Resultado verificado de esa revisión:
**42 de 50 eran candidatos reales a reescritura** (categoría C, diagnóstico
sin escena), **5 falsos positivos del heurístico** (ids 219, 337, 402 — la
escena ya estaba en el texto pero el regex no la reconoció — y 418, 419 —
categoría B, relación causal universal, no diagnóstico), y **3 aceptables
tal cual** (ids 305, 332, 334 — categoría B legítima o protocolo de
emergencia con nombre de evento propio, que ya funciona como ancla). Si una
corrida nueva sobre el mismo banco clasifica estos 8 ids específicos (219,
305, 332, 334, 337, 402, 418, 419) como candidatos a reescritura, es señal
de que el modelo no está aplicando la rúbrica correctamente — revisar
contra la sección "El heurístico se equivoca" antes de seguir.

## Anti-patrones

- No marcar como defectuosa una pregunta de definición pura solo por ser
  corta — ver categoría A de la rúbrica.
- No tratar el heurístico de `mechanical_checks.py` como veredicto final;
  es triage para acotar qué leer, no un juez.
- No editar `naut-preguntas-master.json` in-place nunca, ni siquiera para
  "una sola pregunta obviamente mal" — siempre vía archivo de propuestas o
  `.NEW.json`, para que el usuario pueda revisar antes de commitear.
- No inventar contexto/datos que el documento fuente no sugiere al
  reescribir (ver "Qué NO hacer" en la rúbrica).
- No declarar una fuente "contradictoria" sin citar el par de ids
  específico en conflicto y el texto exacto de cada uno.
- No asumir que todas las preguntas largas/numéricas están bien — la
  rúbrica categoriza por TIPO de pregunta, no por longitud.
- No tocar `naut-q-generator/SKILL.md` sin que el usuario lo pida
  explícitamente — este skill solo valida, no genera. Si la auditoría
  revela que el generador necesita un gate de autocontención (paso previo
  a escribir cualquier `q` nueva), señalarlo como recomendación separada,
  no aplicarlo de oficio.

## Referencias

- [Rúbrica de autocontención](./references/grounding-rubric.md) — cómo
  juzgar si una pregunta tiene escena suficiente, con ejemplos A/B/C.
- [Detección de contradicciones](./references/contradiction-detection.md) —
  cómo comparar mapeos control→efecto entre fuentes y decidir cuarentena.
- `scripts/mechanical_checks.py` — chequeos determinísticos (schema,
  duplicados, triage de contexto). Nunca escribe al maestro.
- `scripts/quarantine_source.py` — extrae una fuente a archivo separado sin
  tocar el original.

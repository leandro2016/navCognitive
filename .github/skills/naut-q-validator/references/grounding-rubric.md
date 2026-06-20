# Rúbrica de autocontención (grounding)

Esta rúbrica se aplica a cada pregunta en `needs_llm_review` (y opcionalmente
a `high_confidence_no_scene` para confirmar el fix propuesto). No es un
checklist mecánico — requiere leer la pregunta como la leería un regatista
que NUNCA vio el documento fuente, y decidir si puede responderla con lo que
tiene delante.

## La pregunta central

**¿Puedo imaginar la escena completa solo leyendo `q`, sin haber leído el
documento fuente?**

Si la respuesta requiere que el lector ya sepa de qué subtítulo del doc viene
la pregunta — está mal. Una pregunta de regata real ocurre en un momento:
hay viento, hay rumbo, hay una vela, alguien observa algo. El documento tiene
esa info en el párrafo de alrededor; la pregunta extraída la perdió.

## Tres categorías de pregunta — cada una tiene su propio criterio

### A. Preguntas de definición/función (legítimas sin escena)
"¿Qué controla el outhaul?", "¿Qué mide la corredera?", "¿Qué es el twist?"

Estas son glosario. No diagnostican nada, no requieren que el lector
imagine una situación — preguntan un hecho fijo. **Son válidas tal cual.**
No las reescribas a menos que el wording sea ambiguo o el término esté
indefinido (ej. "el papel" sin decir a qué control físico se refiere).

### B. Preguntas de relación causal directa (legítimas sin escena, con cuidado)
"Más sag → ¿qué efecto en la génova?", "Menos contra → ¿qué produce?"

Estas describen una relación física fija (si X aumenta, Y pasa). Son
válidas SI la relación es verdaderamente universal — no depende del punto
de la regata, del viento, ni de otra vela. Ejemplo válido: "Más profundidad
→ más potencia, más escora" (es una ley aerodinámica). Ejemplo INVÁLIDO
disfrazado de causal: "Amantillo · ¿cuándo se libera?" — esto no es una
relación causal, es una regla de uso condicional que SÍ depende de la
situación (viento extremadamente liviano, rumbos abiertos) y merece
quedar explícita en la pregunta, no solo en la respuesta.

Heurística: si la respuesta (`a`) ya es condicional ("depende de...", "solo
en...", "excepto cuando...") pero la pregunta (`q`) no lo refleja, la
pregunta está mal formada — esconde la condición en la respuesta en vez de
plantearla en el enunciado.

### C. Preguntas diagnósticas/situacionales (INVÁLIDAS sin escena)
"Ángulo de ataque demasiado grande · ¿Síntoma?", "Cataviento desaparece
constantemente · ¿Revisar?", "Filosofía de trimado en regata"

Estas piden que el lector diagnostique, reconozca un síntoma, o recuerde una
filosofía operativa general — y ESO siempre depende de un contexto
(qué vela, qué viento, qué se observó). Sin ese contexto, la pregunta solo
es respondible por quien ya memorizó el título de la sección del documento.
**Estas requieren reescritura.**

## Señales adicionales de "demasiado abierta" (más allá de A/B/C)

- La pregunta usa "¿qué pasa?" o "¿qué problema?" sin decir QUÉ es lo que
  está pasando (ej. "Río de la Plata · ¿qué puede influir más que la marea
  astronómica?" — el lector no tiene ningún dato para razonar, solo puede
  adivinar o recordar el documento de memoria).
- La pregunta nombra un rol sin fase de maniobra (ej. "Trasluchada · ¿Qué
  hace el copit?" — una trasluchada tiene varias fases; sin decir cuál,
  la pregunta es ambigua incluso para alguien que sabe maniobrar).
- La pregunta es una transición de filosofía/lema general ("Filosofía de
  trimado en regata") sin pedir aplicarla a nada concreto.

## Proceso de reescritura

Para cada pregunta marcada como categoría C (o B mal disfrazada):

1. Volver al documento fuente (`source` en el JSON) y leer el párrafo
   completo alrededor del concepto, no solo el subtítulo.
2. Identificar qué dato de contexto falta: ¿viento?, ¿rumbo?, ¿vela
   específica?, ¿fase de maniobra?, ¿síntoma observado?
3. Construir una escena mínima y realista (consistente con
   `procedural-examples.md` / `examples.md` del banco — viento 8-25kn, rumbos
   plausibles) que el documento soporte SIN inventar datos que el doc no
   menciona.
4. Si el documento no da suficiente detalle para anclar la pregunta con un
   número o situación concreta, está bien anclarla con un verbo de
   observación ("Ves que..." / "Notás que...") en vez de un dato numérico —
   lo importante es que describa una escena, no que tenga decimales.
5. La respuesta (`a`) y la deducción (`d`) deben seguir siendo verdaderas
   para la escena reescrita. Si cambian de sentido, la reescritura está mal.

### Ejemplo de reescritura (la que motivó esta auditoría)

**Antes (id 61, categoría C):**
```
q: "Ángulo de ataque demasiado grande · ¿Síntoma?"
a: "Lanitas caídas, spi colapsando, mayor sobretrimada"
```
Problema: mezcla síntomas de TRES velas distintas (génova, spinnaker, mayor)
en una sola respuesta, sin que la pregunta diga de cuál vela se habla. El
lector no puede saber si está cazando demasiado el génova, el spi, o la
mayor — la pregunta no ancla NINGUNA vela ni situación.

**Después (propuesta, dividida en 3 preguntas — una por vela, cada una con
su propio escenario):**
```
q: "Ceñida, 10kn, escota de génova muy cazada\n→ ¿Qué indican las lanitas?"
a: "Lanita interior cae (señal de pérdida)"
d: "Exceso de ángulo de ataque en el génova"
source: "05_AERODINAMICA"

q: "Popa con spinnaker, escota sobrecazada\n→ ¿Qué le pasa a la vela?"
a: "Colapsa detrás de la mayor / pierde proyección"
d: "Exceso de ángulo de ataque en el spi"
source: "05_AERODINAMICA"

q: "Mayor con demasiada escota cazada en ceñida\n→ ¿Qué se observa?"
a: "Mayor sobretrimada, timón pesado"
d: "Exceso de ángulo de ataque en la mayor"
source: "05_AERODINAMICA"
```
Nota: dividir en 3 no es obligatorio en todos los casos, pero acá es
necesario porque la respuesta original ya mezclaba 3 velas — la fusión
original ocultaba que eran 3 hechos distintos, no una sola pregunta.

## El heurístico de `mechanical_checks.py` se equivoca — casos reales

Esto no es teórico. Al revisar las 50 preguntas que el script marcó como
`high_confidence_no_scene` sobre el banco real (post-cuarentena de
`charla-genoa-manzoli`, 536 preguntas), **5 de 50 resultaron ser falsos
positivos puros** del regex (más 3 adicionales que son categoría B legítima
o protocolo con nombre de evento propio — aceptables tal cual, no
"defectuosos" pero tampoco necesitan reescritura) — el regex las marcó por
contener una palabra diagnóstica ("síntoma", "qué hacer", "revisar"), pero
al leerlas con criterio SÍ tenían escena suficiente o eran causalidad
directa. Antes de reescribir CUALQUIER pregunta de
`high_confidence_no_scene`, releerla con este criterio — no asumir que
estar en esa lista significa que está mal.

### Falso positivo tipo 1 — la escena ya está, el regex no la reconoció

```
id 219: "Noche · Veo roja y verde de frente\n→ ¿Qué hacer?"
id 337: "Noche · Demora constante con buque, distancia decreciente\n→ ¿Qué hacer?"
id 402: "Lanitas estables pero el barco no acelera\n→ ¿Qué revisar?"
```
Las tres SÍ describen una observación concreta (qué ves, qué notás) antes
de preguntar qué hacer. El regex las marcó porque su lista de "señales de
situación" (`SITUATION_SIGNALS` en el script) no incluye frases como "veo
roja y verde" o "lanitas estables pero no acelera" — son escenas válidas
que el patrón no anticipó. **No reescribir estas.**

### Falso positivo tipo 2 — relación causal universal (categoría B), no diagnóstico situacional (C)

```
id 418: "Génova · Más sag → ¿qué pasa con la profundidad?"
        a: "Más profundidad, más potencia, más aceleración"
id 419: "Génova · Menos sag → ¿qué pasa?"
        a: "Menos profundidad, menos escora, más control"
```
Son leyes aerodinámicas fijas (si sube X, sube Y — siempre, sin importar
viento ni rumbo). El regex las marcó porque "¿qué pasa?" matchea contra
lenguaje diagnóstico, pero no hay nada que diagnosticar — es causalidad
directa. **No reescribir estas** (son categoría B legítima, ver arriba).

### Falso positivo parcial — protocolo fijo, la situación ya está en el nombre del evento

```
id 332: "Hombre al agua · ¿Segunda acción tras flotador y grito?"
id 334: "Broach con spinnaker · ¿Primera acción?"
```
"Hombre al agua" y "Broach" SON la escena — son eventos discretos con
nombre propio, no estados ambiguos. No hace falta agregar viento/rumbo
porque el procedimiento de emergencia no depende de eso. **No reescribir.**

### Verdadero positivo confirmado — para contraste

```
id 61: "Ángulo de ataque demasiado grande · ¿Síntoma?"
       a: "Lanitas caídas, spi colapsando, mayor sobretrimada"
```
Acá sí falta todo: qué vela, qué viento, y además mezcla 3 velas en una
respuesta (ver ejemplo de reescritura completo arriba). **Este sí se
reescribe.**

### Regla práctica

Antes de aceptar una pregunta de `high_confidence_no_scene` como candidata
real a reescritura, hacé esta pregunta primero: **¿el texto de `q` ya
contiene una observación o nombre de evento específico, aunque no tenga
número?** Si sí ("veo roja y verde", "hombre al agua", "lanitas estables
pero no acelera"), probablemente es un falso positivo del regex — dejarla
como está. Si la pregunta es un concepto abstracto sin ningún anclaje
("ángulo de ataque demasiado grande", "poco twist"), es candidata real.

## Qué NO hacer al reescribir

- No inventar números que el documento no sugiere (si el doc dice "viento
  fuerte" sin cuantificar, podés usar "18-20kn" como interpretación
  razonable, pero no inventes "47kn" o cifras absurdas).
- No fusionar artificialmente preguntas que el documento trata por separado
  solo para "agregar contexto" — si necesitás 3 frases de contexto distintas
  para 3 hechos distintos, son 3 preguntas.
- No agregar contexto que cambie la respuesta original sin querer (revisar
  que `a` y `d` sigan siendo correctas después de anclar la escena).
- No agregar `boat_class` ni otro campo nuevo al schema — los docs base son
  agnósticos de clase, por decisión explícita del usuario.

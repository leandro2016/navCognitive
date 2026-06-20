# Detección de contradicciones entre fuentes

El validador mecánico (`mechanical_checks.py`) NO puede detectar
contradicciones de contenido — eso requiere leer y comparar texto con
juicio. Esta es la guía para hacerlo cuando se ejecuta el modo
`validar-contradicciones`.

## Por qué esto es necesario (caso real encontrado)

El banco actual mezcla dos fuentes con mapeos control→efecto incompatibles
para el génova:

| Concepto | `05_AERODINAMICA.md` (doc estructurado) | `charla-genoa-manzoli` (transcripción de charla) |
|---|---|---|
| Controla el **sag** del estay | Burdas | "Papel" (outhaul) |
| Controla la **ubicación de profundidad** | Driza | "Brisa" (cunningham) |

Esto no es solo terminología distinta para lo mismo — son **asignaciones
físicas distintas**. Si la app le hace una pregunta de `05_AERODINAMICA` a
alguien que aprendió con el vocabulario de `charla-genoa-manzoli` (o
viceversa), va a fallar una pregunta correcta, o peor: va a aprender un
mapeo equivocado para SU barco real.

Conclusión aplicada: `charla-genoa-manzoli` salió del banco maestro
(decisión del usuario) hasta reconciliar. Este documento existe para que
la próxima vez que se ingiera una fuente nueva (otra charla, otro PDF, otro
relato), el skill la chequee ANTES de mezclarla, no después.

## Procedimiento al ingerir una fuente nueva

1. **Identificar el vocabulario de controles que usa la fuente nueva.**
   Hacer una tabla control físico → nombre que usa la fuente. Ejemplo:
   "papel" = outhaul, "brisa" = cunningham, "patín" = car/punto de escota,
   "entrenador" = ¿qué control físico es exactamente? (si no se puede
   determinar con certeza, NO ingerir esa pregunta — marcarla para que el
   usuario confirme el mapeo).

2. **Comparar esa tabla contra el vocabulario ya establecido** en
   `01_RRS.md` ... `08_SPINNAKER.md` (los docs base, que son la fuente de
   verdad por defecto porque ya están validados y son agnósticos de clase).

3. **Para cada concepto que aparece en ambos lados, verificar si el mapeo
   control→efecto coincide.** No alcanza con que el nombre del control
   "suene parecido" — hay que verificar que controla lo mismo.
   - Coincide → se puede fusionar, usando el término de los docs base como
     canónico y el de la fuente nueva como sinónimo/alias (no reemplazo).
   - No coincide o es ambiguo → la fuente nueva entra en **cuarentena**
     (ver abajo), no al banco maestro.

4. **Verificar si la fuente nueva es específica de una clase de barco /
   aparejo no genérico** (señales: menciona un barco por nombre, un
   simulador específico, "nuestro J35", controles que no existen en
   aparejos estándar). Si es así, aunque no contradiga nada, no debería
   mezclarse con preguntas agnósticas de clase sin un campo que lo
   distinga — y el usuario decidió no agregar ese campo al schema, así que
   por ahora estas fuentes quedan fuera del banco maestro.

## Qué es "cuarentena"

Cuarentena = sacar las preguntas del JSON maestro y guardarlas en un archivo
separado (`Questions/cuarentena-<fuente>.json`) con una nota de por qué
quedaron afuera. No se borran — se preservan para reconciliar después, pero
no contaminan el banco activo ni se le presentan al usuario en sesión.

El skill nunca debe fusionar contenido de fuentes que fallan el paso 3 sin
intervención explícita del usuario indicando cuál mapeo es el correcto para
SU barco.

## Cómo correr este chequeo sobre el banco actual

1. Agrupar preguntas de `cat: TRIM` por `source`.
2. Para cada par de fuentes que cubran el mismo sub-tema (ej. ambas hablan
   de "qué controla el sag del génova"), extraer las respuestas y comparar.
3. Si hay desacuerdo, reportarlo como hallazgo con: los dos IDs en
   conflicto, el texto de cada uno, y una recomendación (cuarentena /
   reconciliar / el usuario decide).
4. No autoresolver el conflicto inventando cuál fuente tiene razón — eso
   requiere que el usuario confirme con su propio conocimiento del barco o
   vuelva a la fuente original.

# Ejemplos de preguntas por categoria

Ejemplos canonicos del estilo del banco, para calibrar tono, longitud y
deduccion. No copiar literal; usar como referencia de formato.

## NAV — Navegacion

```json
{ "id": 1, "cat": "NAV", "role": "ALL", "fatigue": 1,
  "q": "Rumbo verdadero 120° (Dec 8°W)\n→ Rumbo magnetico?",
  "a": "128° M", "d": "120 + 8 = 128",
  "tags": ["rumbo", "declinacion"], "difficulty": 1 }

{ "id": 5, "cat": "NAV", "role": "ALL", "fatigue": 2,
  "q": "V=6kn · D=9mn\n→ Tiempo?",
  "a": "1h 30min", "d": "9/6=1.5h",
  "tags": ["tiempo", "distancia"], "difficulty": 2 }
```

## MAN — Maniobras

```json
{ "cat": "MAN", "role": "GEN", "fatigue": 2,
  "q": "Traslucho con viento 18kn y olas\n→ Que suelta primero?",
  "a": "Escota de mayor antes de la genoa",
  "d": "Mayor primero para controlar el borneo de proa",
  "tags": ["trasluchada", "mayor"], "difficulty": 2 }

{ "cat": "MAN", "role": "PRO", "fatigue": 3,
  "q": "Spinnaker asimetrico, jibe-set en baliza\n→ Orden de driza/escota?",
  "a": "Driza nueva, luego escota, luego liberar vieja",
  "d": "Driza primero para cargar, escota para trimar, vieja ultima",
  "tags": ["spinnaker", "jibe-set", "proel"], "difficulty": 3 }
```

## DEC — Decisiones

```json
{ "cat": "DEC", "role": "TOD", "fatigue": 3,
  "q": "Recorrido barlovento-sotavento. Viento borneando a la derecha\n→ Que lado cubrir?",
  "a": "Lado derecho (cobrar)",
  "d": "Borneo a la derecha favorece el lado derecho del recorridoo",
  "tags": ["estrategia", "borneo", "recorridoo"], "difficulty": 3 }
```

## REG — Reglamento

```json
{ "cat": "REG", "role": "ALL", "fatigue": 2,
  "q": "Barlovento y sotavento en ceñida, mismo rumbo\n→ Quien tiene derecho?",
  "a": "Barlovento (regla 11)",
  "d": "Regla 11: barlovento se mantiene alejado de sotavento",
  "tags": ["regla-11", "derecho-de-paso"], "difficulty": 2 }
```

## SIT — Situacional

```json
{ "cat": "SIT", "role": "ALL", "fatigue": 3,
  "q": "Veis un borneo oscuro a 200m adelante en ceñida\n→ Que comunicar?",
  "a": "Borneo a la derecha, intensidad baja, preparar a orzar",
  "d": "Oscuro = menos viento; borneo derecho; anticipar orza",
  "tags": ["borneo", "lectura-viento", "comunicacion"], "difficulty": 3 }
```

## Ejemplo de modo Ingerir

Material de entrada (relato):
> "Ibamos ceñidos por la derecha cuando vimos un borneo de 30° a la derecha.
> Viramos inmediatamente y ganamos 200m sobre la flota. El trimmer de genoa
> tuvo que soltar 10cm de escota por el aumento de angulo."

Preguntas extraidas:

```json
{ "cat": "DEC", "role": "TOD", "fatigue": 3,
  "q": "Ceñida, borneo de 30° a la derecha\n→ Virar o mantener?",
  "a": "Virar (cobrar el borneo)",
  "d": "Borneo derecho favorece virar para cobrar el angulo",
  "tags": ["borneo", "virada", "ingerido", "relato"], "difficulty": 3 }

{ "cat": "MAN", "role": "GEN", "fatigue": 2,
  "q": "Tras borneo de 30° a la derecha en ceñida\n→ Que hace el trimmer de genoa?",
  "a": "Soltar ~10cm de escota",
  "d": "Mayor angulo de incidencia → soltar escota para retrimar",
  "tags": ["trimado", "genoa", "borneo", "ingerido", "relato"], "difficulty": 2 }
```

Notar: los tags incluyen `ingerido` y `relato` para trazabilidad.
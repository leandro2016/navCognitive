# Ejemplos de preguntas procedurales (sequence / invalid / filter)

Los 3 tipos procedurales se usan para maniobras y secuencias donde el orden o
la seleccion de pasos es lo critico. El skill genera estos tipos
automaticamente cuando el relato ingerido tiene fases ordenadas.

## type: "sequence" — ordenar pasos

El usuario ve los pasos desordenados y los ordena con botones ▲▼.
Correcto = orden exacto. `steps` va en el ORDEN CORRECTO (la app los mezcla).

```json
{
  "id": 226,
  "cat": "MAN",
  "role": "PIT",
  "fatigue": 3,
  "type": "sequence",
  "q": "Toma de rizos de mayor — TOMAR RIZOS\n→ Ordená la secuencia del copit",
  "a": "Libera escota → libera stopper → baja driza → caza amante de rizo",
  "d": "Quitar carga (escota) → liberar driza (stopper) → arriar → cazar amante",
  "steps": [
    "Libera escota",
    "Libera stopper",
    "Baja driza",
    "Caza amante de rizo"
  ],
  "tags": ["rizos", "mayor", "copit", "secuencia", "procedural", "ingerido"],
  "difficulty": 3
}
```

## type: "invalid" — detectar el paso incorrecto

El usuario ve una secuencia con un paso incorrecto y debe tocarlo.
Correcto = toca el paso en `invalidIndex`.

```json
{
  "id": 233,
  "cat": "MAN",
  "role": "PRO",
  "fatigue": 2,
  "type": "invalid",
  "q": "Toma de rizos de mayor — PREPARADOS\n→ Hay un paso incorrecto. Tocalo.",
  "a": "El proel baja la driza (es el copit quien la maneja)",
  "d": "En preparados el proel va al palo; la driza la maneja el copit",
  "steps": [
    "Proel va al palo",
    "Copit aduja la driza y saca de la cornamuza",
    "Proel baja la driza",
    "Copit confirma todo libre"
  ],
  "invalidIndex": 2,
  "tags": ["rizos", "mayor", "proel", "copit", "procedural", "ingerido"],
  "difficulty": 2
}
```

## type: "filter" — marcar cuáles aplicar

El usuario ve pasos y marca cuáles aplicar (checkbox).
Correcto = set exacto de `validMask`.

```json
{
  "id": 234,
  "cat": "MAN",
  "role": "PIT",
  "fatigue": 2,
  "type": "filter",
  "q": "Toma de rizos — al oir 'rizo listo'\n→ Marcá qué hace el copit",
  "a": "Izar driza + hacerla firme",
  "d": "El grito del proel dispara el re-izado; driza firme para cargar",
  "steps": [
    "Vuelve a izar la driza",
    "Hace firme la driza",
    "Libera la escota de nuevo",
    "Baja el amante de rizo"
  ],
  "validMask": [true, true, false, false],
  "tags": ["rizos", "mayor", "copit", "procedural", "ingerido"],
  "difficulty": 2
}
```

## Reglas del skill para generar procedurales

- **sequence**: cuando el relato tiene fases ordenadas (preparados → listos →
  ejecutar) o una secuencia de pasos de un rol. `steps` en orden correcto.
- **invalid**: cuando el relato menciona un error comun o cuando se puede
  construir una secuencia con un paso fuera de lugar. `invalidIndex` apunta al
  paso mal.
- **filter**: cuando hay una lista de acciones y solo algunas aplican a un rol
  o fase. `validMask` marca cuáles.
- Siempre incluir `d` (deduccion) y `a` (respuesta resumen).
- Tags: agregar `procedural` para trazabilidad.
# Schema de pregunta y taxonomia (NavCognitive)

## Schema JSON

```json
{
  "id": 42,
  "cat": "NAV",
  "role": "ALL",
  "fatigue": 2,
  "q": "Rumbo verdadero 120° (Dec 8°W)\n→ Rumbo magnetico?",
  "a": "128° M",
  "d": "120 + 8 = 128",
  "tags": ["rumbo", "declinacion"],
  "difficulty": 1
}
```

### Campos

| Campo | Tipo | Req | Notas |
|-------|------|-----|-------|
| `id` | number | si | Builtin: positivos secuenciales unicos. Custom (app): negativos. |
| `cat` | string | si | Una de: `NAV`, `MAN`, `DEC`, `REG`, `SIT`, `TRIM`, `TACT`, `METEO`, `SEG`. |
| `role` | string | si | Una de: `ALL`, `GEN`, `MAY`, `PRO`, `TAC`, `TIM`, `PIT`, `NAVEG`, `TOD`. |
| `fatigue` | number | si | 1-4. |
| `q` | string | si | Texto de la pregunta. `\n` para multilinea. |
| `a` | string | si | Respuesta concisa. |
| `d` | string | si | Deduccion / calculo / razonamiento en una linea. |
| `tags` | string[] | no | Default `[]`. Palabras clave en minusculas. |
| `difficulty` | number\|null | no | 1-4 o `null`. |
| `source` | string | si | Archivo doc de origen (sin extension). Ej: `"01_RRS"`, `"07_GENOVA"`, `"general"`, `"relato"`. |
| `type` | string | no | `"recall"` (default), `"sequence"`, `"invalid"`, `"filter"`. |
| `steps` | string[] | no | Pasos. Obligatorio si `type !== "recall"`. |
| `invalidIndex` | number | no | Indice del paso incorrecto. Solo `type: "invalid"`. |
| `validMask` | boolean[] | no | Cuales pasos aplicar. Solo `type: "filter"`. Mismo length que `steps`. |
| `timeLimit` | number\|null | no | Override de timer en segundos. |

## Categorias (`cat`)

| Code | Label | Color | Cubre |
|------|-------|-------|-------|
| `NAV` | Navegacion | #38BDF8 | Rumbos, declinacion, desvio, tiempo-distancia-velocidad, VMG/VMC, laylines, corriente, mareas, posicionamiento, GPS, balizas. |
| `MAN` | Maniobras | #34D399 | Virada, trasluchada, rizos, izado/bajada de spinnaker, jibe-set, douse, mark rounding, orza/escora, cambios de vela. |
| `DEC` | Decisiones | #FB923C | Lado del recorridoo,何时 virar, cobrir/estirar, empezar/abandonar, riesgo-recompensa, lectura del viento, estrategia vs tactica. |
| `REG` | Reglamento | #A78BFA | Reglas de derecho de paso (10, 11, 12, 13), reglas de baliza (18), cambio de rumbo (16), protestas, banderas, penalizaciones. |
| `SIT` | Situacional | #F0A500 | Deteccion de borneos, trafico, olas, cambios de intensidad, comunicacion de tripulacion, priorizacion de tareas bajo presion. |
| `TRIM` | Trimado | #2DD4BF | Escota, traveler, cunningham, driza, barber, mayor, genoa, spinnaker, ajustes por intensidad/angulo de viento. |
| `TACT` | Tactica | #F472B6 | Posicionamiento en flota, cobertura, start, laylines tacticas, cobrir/estirar, decisiones de recorrido. |
| `METEO` | Meteorologia | #818CF8 | Lectura de viento, rachas, gradientes, nubes, corriente, mareas, pronostico en agua. |
| `SEG` | Seguridad | #EF4444 | Hombre al agua, vela de tormenta, emergencias, equipo de seguridad, abandono, RLS. |

## Roles (`role`)

| Code | Label | Notas |
|------|-------|-------|
| `ALL` | General | Aplica a cualquier tripulante. |
| `GEN` | Trimmer Genova | Trimado de genoa, escota, barber, traveler de proa. |
| `MAY` | Trimmer Mayor | Trimado de mayor, cunningham, botavara, traveler. |
| `PRO` | Proel | Proa, spinnaker, gennaker, maniobras de proa. |
| `TAC` | Tactico | Decisiones de recorrido, lectura de viento. |
| `TIM` | Timonel | Rumbo, orza/escora, gobierno del barco. |
| `PIT` | Pit | Drizas, escotas, winches, maniobras de cubierta. |
| `NAVEG` | Navegante | Posicion, calculos, instrumentos, routing. |
| `TOD` | Todos los roles | Decision/equipo completo. |

## Fatigue (`fatigue`)

| Valor | Label | Uso |
|-------|-------|-----|
| 1 | Fresco | Calculo simple, regla directa. |
| 2 | Activado | Calculo de 2 pasos, decision estandar. |
| 3 | Fatigado | Calculo multiple, regla con excepcion, maniobra rapida. |
| 4 | Al limite | Calculo encadenado, decision bajo presion, reglas combinadas. |

## Difficulty (`difficulty`, opcional)

| Valor | Nivel |
|-------|-------|
| 1 | Facil |
| 2 | Media |
| 3 | Dificil |
| 4 | Avanzada |
| `null` | No asignada |

## Reglas de IDs

- **Builtin** (este skill): positivos, secuenciales desde `max(existing) + 1`.
  Archivo destino: `Questions/naut-preguntas-master.json`.
- **Custom** (app, no este skill): negativos descendentes desde -1.
- **Runtime** (modo runtime del skill): IDs temporales (null o negativos), la
  app los reasigna al inyectarlos como custom.
- Nunca renumerar existentes.

## Deteccion de duplicados

Normalizar `q` existente y nuevo: `q.trim().toLowerCase().replace(/\s+/g, " ")`.
Si coinciden, descartar o reformular. Reportar descartes.
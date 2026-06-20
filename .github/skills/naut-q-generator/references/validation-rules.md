# Reglas de validación semántica (naut-q-validator)

El validador semántico (`npm run validate`) ejecuta 12 reglas que van más allá
de la validación estructural. Estas reglas detectan problemas de **sentido**,
**contexto** y **coherencia** que la validación de campos no puede capturar.

El skill debe respetar estas reglas al generar preguntas. Si una pregunta
generada viola una regla, debe reformularse antes de agregarla al banco.

## Reglas

### R1_ROLE_VELA_MISMATCH (error)
El rol debe responder sobre su vela/controles correspondientes.
- `GEN` → genoa, escota, patín, brisa, papel, entrenador, baten, sag, burdas
- `MAY` → mayor, botavara, cataviento, traveller, carro, cunningham, outhaul, contra, vang, amantillo
- `PRO` → spinnaker, spi, gennaker, tangón, braza, gratil, driza
- `TIM` → rumbo, timón, orzar, derivar, virar, velocidad
- `TAC` → borneo, layline, VMG, cobrir, estirar, flota, start, estrategia
- `PIT` → driza, winche, stopper, amante, escota, copit
- `NAVEG` → rumbo, variación, desvío, demora, ETA, SOG, STW, corriente, deriva, GPS, corredera

**Error**: `GEN` responde sobre "spi colapsando, mayor sobretrimada" sin mencionar genoa.
**Fix**: Si la pregunta es de aerodinámica general, usar `role: "ALL"`.

### R2_TRIM_NO_CONTEXT (warning)
Las preguntas de TRIM deben incluir contexto de condición: intensidad de viento,
rumbo, ola, escora, o marca de que es conceptual (¿qué es X?).

**Error**: "Ángulo de ataque demasiado grande · ¿Síntoma?" — sin viento, rumbo ni condición.
**Fix**: "Ceñida, 15 kn, ángulo de ataque demasiado grande · ¿Síntoma en genoa?"

### R3_ANSWER_TOO_LONG (warning)
La respuesta debe ser concisa: un número, un rumbo, o una frase corta (<80 chars).
Si la respuesta es una lista larga, dividir en múltiples preguntas o resumir.

### R4_MULTI_VELA_CONFUSION (error)
La respuesta no debe mezclar síntomas de múltiples velas sin contexto.
Si la pregunta es de genoa, la respuesta debe ser sobre genoa.

**Error**: "Lanitas caídas, spi colapsando, mayor sobretrimada" (mezcla 3 velas).
**Fix**: Si es sobre genoa: "Lanita interior cae". Si es sobre spi: "Gratil colapsa".

### R5_FATIGUE_MISMATCH (warning)
- Cálculos simples (tiempo/distancia, conversión de rumbo) → fatigue 1-2
- Decisiones bajo presión, maniobras rápidas → fatigue 2-3
- Cálculos encadenados, reglas combinadas → fatigue 3-4

### R6_DUPLICATE (error)
No puede haber dos preguntas con el mismo texto normalizado
(`q.trim().toLowerCase().replace(/\s+/g, " ")`).

### R7_WEAK_DEDUCTION (warning)
La deducción `d` debe agregar valor, no repetir la respuesta.
- ✅ `"120 + 8 = 128"` (muestra el cálculo)
- ❌ `"128° M"` (repite la respuesta)

### R8_NO_SOURCE (error)
Toda pregunta debe tener `source` indicando el origen documental.

### R9_PROC_NO_STEPS (error)
Las preguntas procedurales (`type: "sequence"`, `"invalid"`, `"filter"`)
deben tener `steps` válidos, y `invalidIndex` o `validMask` según corresponda.

### R10_AMBIGUOUS (warning)
Preguntas demasiado cortas (<15 chars) o sin contexto suficiente.

### R11_DEBUG_ARTIFACT (error)
La respuesta o deducción no debe contener artefactos de generación:
`wait`, `...`, notas de debug, o texto de proceso interno.

### R12_NAV_CALC_ERROR (error)
Los cálculos de navegación deben estar verificados. La deducción no debe
contener `wait` ni notas de proceso.

## Cómo usar el validador

```bash
# Validar el banco completo
npm run validate

# Exit code 1 = hay errores que deben corregirse
# Exit code 0 = solo warnings o limpio
```

## Workflow recomendado para el skill

1. **Generar** preguntas (modo Generar/Ingerir/Runtime).
2. **Validar** con `npm run validate` antes de confirmar el append.
3. **Corregir** cualquier error (R1, R4, R6, R8, R9, R11, R12).
4. **Revisar** warnings (R2, R3, R5, R7, R10) y mejorar si es posible.
5. **Append** solo cuando el validador pase sin errores.
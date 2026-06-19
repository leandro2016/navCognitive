# Cómo describir situaciones para ingerir (guia de input)

El modo Ingerir/Transformar funciona mejor cuando el material de entrada tiene
estructura. Esta guia muestra el formato ideal y por que.

## Plantilla recomendada

```
MANIOBRA/ESCENARIO: <nombre>
FASES: preparados | listos | ejecutar | post

POR FASE Y ROL:
  [fase] [rol]: <accion concreta>
  [fase] [rol]: <accion concreta>
  ...

DISPARADORES: <que grito/senal coordina entre roles>
ESTADO FINAL: <como queda el barco / que falta>
```

## Ejemplo canonico (toma de rizos de mayor)

```
MANIOBRA: Toma de rizos de mayor
FASES: preparados | listos | tomar rizos | post

  preparados  proel:  va al palo
  preparados  copit:  aduja la driza para que este clara y saca de la cornamuza
  listos      proel:  espera
  listos      copit:  confirma que todo esta libre
  tomar rizos proel:  acomoda la mayor cuando se arria, garruchos abajo,
                      engancha el rizo, grita "rizo listo"
  tomar rizos copit:  libera escota, libera stopper, baja driza,
                      caza el amante de rizo
  tomar rizos copit:  al oir "rizo listo" vuelve a izar la driza y la hace firme
  post        trimmer: vuelve a trimmar la vela mayor

DISPARADORES: "rizo listo" gritado por el proel dispara el re-izado del copit
ESTADO FINAL: mayor con rizo puesto, re-trimmada
```

Esto rindio 7 preguntas (IDs 226-232) cubriendo cada rol × fase + coordinacion
+ post-maniobra.

## Por que funciona

- **Una maniobra por relato**: no mezclar rizos con trasluchada. Una maniobra
  clara rinde 5-8 preguntas enfocadas.
- **Fases explicitas** (preparados / listos / ejecutar / post): generan
  preguntas "que hace X en fase Y" naturalmente, una por celda rol×fase.
- **Rol + accion por linea**: si decís "el proel acomoda y el copit libera" en
  una sola frase, el skill puede perder el rol. Una linea por rol.
- **Verbos de accion concretos** (aduja, caza, libera, arriar, engancha):
  rinden deducciones `d` precisas. Evitar "se prepara" o "ayuda".
- **Disparadores verbales explicitos** ("grita rizo listo"): rinden preguntas
  de coordinacion (cat SIT) y de "que hace X al oir Y".
- **Estado final** ("se re-trimma la mayor"): rinde preguntas de post-maniobra
  (cat TRIM/MAN).
- **Detalles de causa** cuando los haya ("garruchos abajo para que el rizo
  tome bien"): eso va directo a la deduccion `d`.

## Que NO ayuda

- Prosa narrativa larga sin separar fases/roles.
- "Se hace la maniobra" sin decir que exactamente.
- Mezclar varias maniobras en un relato (mejor una por vez).
- Omision del estado final (pierde la pregunta de post-maniobra).

## Cuantas preguntas rinde

- 1 maniobra con 3-4 fases × 2-3 roles → 5-8 preguntas.
- Un incidente (hombre al agua, colision) → 3-5 preguntas (DEC/SEG/SIT).
- Un parrafo de reglamento → 2-4 preguntas (REG).
- Un caso tactico (borneo, layline) → 2-4 preguntas (DEC/TACT/METEO).

No forzar cantidad: el material dicta cuantas. El skill reporta cuantas rindio.
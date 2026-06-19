# ⚓ NAUTICAL RACING SKILL — DATASET FULL (ARG)

Lenguaje: Regata argentina (cazar, filar, orzar, derivar)

---

# 🧭 ESTRUCTURA

FASES:
- preparados
- listos
- ejecutar
- post

ROLES:
- TIMONEL
- GEN
- MAY
- PROEL
- COPIT
- ALL

---

# ⚓ MANIOBRAS

---

## 1. TOMA DE RIZOS MAYOR

MANIOBRA/ESCENARIO: Toma de rizos de mayor

FASES: preparados | listos | ejecutar | post

POR FASE Y ROL:

  preparados PROEL: Ir al palo, verificar puntos de rizo y recorrido libre.
  preparados COPIT: Aclarar driza, sacarla de cornamusa y preparar amante de rizo.

  listos PROEL: Confirmar listo en palo.
  listos COPIT: Confirmar driza libre y sistema listo.

  ejecutar COPIT: Filar escota de mayor.
  ejecutar COPIT: Bajar driza controlado.
  ejecutar PROEL: Acompañar bajada y guiar garruchos.
  ejecutar PROEL: Enganchar rizo.
  ejecutar PROEL: “¡Rizo listo!”
  ejecutar COPIT: Cazar amante.
  ejecutar COPIT: Izar driza y hacer firme.

  post COPIT: Re-trimar mayor.
  post ALL: Verificar tensión general.

DISPARADORES:
  - “Preparados para rizar”
  - “Tomar rizos”
  - “¡Rizo listo!”

ESTADO FINAL:
  Mayor con rizo firme, barco balanceado.

ERRORES:
  - No coordinar con proel
  - No filar escota

---

## 2. VIRADA EN CEÑIDA

MANIOBRA/ESCENARIO: Virada

  preparados TIMONEL: Verificar velocidad.
  preparados GEN: Preparar escotas.
  preparados PROEL: Cabos libres.

  ejecutar TIMONEL: Orzar progresivo.
  ejecutar GEN: Mantener tensión, soltar al flameo.
  ejecutar GEN: Cazar nueva.
  ejecutar PROEL: Ayudar paso.

  post ALL: Acelerar y luego cerrar.

ERRORES:
  - Soltar antes de tiempo
  - Cazar antes de cruzar

---

## 3. TRASLUCHADA

MANIOBRA/ESCENARIO: Trasluchada

  preparados COPIT: Control de escota.
  ejecutar TIMONEL: Derivar progresivo.
  ejecutar COPIT: Cazar mayor al centro.
  ejecutar COPIT: Pasar botavara y filar.

ESTADO FINAL:
  Estable en nuevo bordo

---

## 4. IZADO DE SPI

MANIOBRA/ESCENARIO: Izado spinnaker

  preparados PROEL: Spi listo.
  preparados COPIT: Escotas claras.

  ejecutar PROEL: Izar.
  ejecutar COPIT: Ajustar forma.

ESTADO FINAL:
  Spi lleno

---

## 5. ARRIADA SPI

MANIOBRA/ESCENARIO: Arriada spinnaker

  ejecutar COPIT: Soltar braza.
  ejecutar PROEL: Traer vela.
  ejecutar COPIT: Bajar driza.

ERRORES:
  - Tirarlo al agua

---

## 6. PEELING GÉNOVA

MANIOBRA/ESCENARIO: Cambio de génova

  ejecutar PROEL: Izar nueva.
  ejecutar COPIT: Trimar nueva.
  ejecutar COPIT: Filar vieja.
  ejecutar PROEL: Arriar vieja.

---

## 7. SALIDA VIENTO FLOJO

MANIOBRA/ESCENARIO: Post virada sin velocidad

  ejecutar GEN: Filar escota
  ejecutar MAY: Mantener potencia
  ejecutar TIMONEL: No orzar

CLAVE:
  Velocidad > altura

---

## 8. RACHAS CEÑIDA

MANIOBRA/ESCENARIO: Racha fuerte

  ejecutar COPIT: Bajar traveller
  ejecutar TIMONEL: Mantener ángulo

ERRORES:
  - Filar escota primero

---

## 9. DEATH ROLL

MANIOBRA/ESCENARIO: Popa inestable

  ejecutar TIMONEL: Control suave
  ejecutar TRIMMER: Cazar sotavento

---

## 10. LARGADA

MANIOBRA/ESCENARIO: Prestart

  ejecutar TIMONEL: Posición
  ejecutar GEN: Velocidad fina

---

# 🧠 TRIMMING — GÉNOVA (LANITAS)

## PRINCIPIO

- Abajo = potencia
- Arriba = twist

---

## CASOS

### 1 SOBRETRIM

SEÑAL: Lanita baja sotavento cae  
ZONA: BAJO  
ACCIÓN: Filar escota  
ERROR: Cazar más  

---

### 2 FALTA DE TRIM

SEÑAL: Lanita barlovento flamea  
ZONA: BAJO  
ACCIÓN: Cazar  

---

### 3 MUCHO TWIST

SEÑAL: Lanita alta flamea  
ZONA: ALTO  
ACCIÓN: Carro a proa  

---

### 4 SOBRETRIM ARRIBA

SEÑAL: Lanita alta cae  
ZONA: ALTO  
ACCIÓN: Carro atrás o filar leve  

---

### 5 PERFECTO PERO LENTO

SEÑAL: Todas bien  
PROBLEMA: Overtrim  
ACCIÓN: Filar apenas  

---

### 6 ARRIBA MAL / ABAJO BIEN

ACCIÓN: Ajustar carro  

---

### 7 ABAJO MAL

ACCIÓN: Ajustar escota  

---

### 8 VIENTO FLOJO

ACCIÓN: Filar + carro proa  

---

### 9 OLA

ACCIÓN: Trim más abierto  

---

### 10 SOBRECAZADO

ACCIÓN: Abrir todo  

---

# ⛵ TRIMMING MAYOR

### ESCORA

ACCIÓN: Bajar traveller  

---

### SLOT

ACCIÓN: Abrir mayor o génova  

---

### VIENTO FLOJO

ACCIÓN: Filar mayor  

---

### POPA

ACCIÓN: Cazar vang  

---

# 🧠 CLAVES PARA IA

- Siempre diagnosticar:
  1. Arriba vs abajo
  2. Escota vs carro
  3. Velocidad vs altura

- Errores humanos:
  - Cazar de más
  - Orzar en vez de trimar
  - Ajustar solo una vela

---

# ✅ RESULTADO

Dataset listo para:

- Generación de QA
- Simulación de scenarios
- Entrenamiento por rol
- Evaluación táctica
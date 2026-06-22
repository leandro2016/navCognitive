// Appends new questions to the master JSON.
// Usage: node scripts/append-questions.mjs
import { readFileSync, writeFileSync } from 'fs';

const path = 'Questions/naut-preguntas-master.json';
const bank = JSON.parse(readFileSync(path, 'utf8'));
const maxId = Math.max(...bank.map(q => q.id));

// Build set of normalized q for duplicate check
const existingQ = new Set(bank.map(q => q.q.trim().toLowerCase().replace(/\s+/g, ' ')));

const newQs = [
  // ===== NAV: Estima directa/inversa, abatimiento, Dv, FIX =====
  { id: maxId+1, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación por estima\n→ ¿Qué es la estima directa?", a:"Calcular posición a la que se arriba desde punto conocido, rumbo y distancia", d:"Desde A conocido, navegar Rv y D → nuevo punto", tags:["estima","directa"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+2, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación por estima\n→ ¿Qué es la estima inversa?", a:"Calcular rumbo a gobernar y hora de arribo entre dos puntos conocidos", d:"Desde A y B en carta, medir Rv y despejar Rc", tags:["estima","inversa"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+3, cat:"NAV", role:"NAVEG", fatigue:1, q:"Navegación por estima\n→ ¿Qué simbología tiene un punto de estima?", a:"Punto rodeado de un triángulo", d:"Triángulo = estimado (sin certeza)", tags:["estima","simbologia"], difficulty:1, source:"15_NAVEGACION" },
  { id: maxId+4, cat:"NAV", role:"NAVEG", fatigue:1, q:"Navegación por estima\n→ ¿Qué simbología tiene un punto FIX?", a:"Punto rodeado de un círculo", d:"Círculo = posición cierta", tags:["fix","simbologia"], difficulty:1, source:"15_NAVEGACION" },
  { id: maxId+5, cat:"NAV", role:"NAVEG", fatigue:2, q:"Rc=75°, Dc=+5°, dm=10°W\n→ ¿Rumbo verdadero?", a:"70°", d:"Rv=75+5-10=70", tags:["rumbo","conversion"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+6, cat:"NAV", role:"NAVEG", fatigue:2, q:"Estima directa: 3 Nd durante 1h 10m\n→ ¿Distancia recorrida?", a:"3,5 Mn", d:"D=3×1,1666=3,5 Mn", tags:["estima","distancia"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+7, cat:"NAV", role:"NAVEG", fatigue:3, q:"Estima inversa: Rv=113°, Dc=+3°, dm=6°W\n→ ¿Rumbo de compás a gobernar?", a:"116°", d:"Rc=113-3+6=116", tags:["estima","inversa","rumbo"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+8, cat:"NAV", role:"NAVEG", fatigue:3, q:"Estima inversa: D=3,2 Mn, V=4,9 Nd\n→ ¿Tiempo de navegación?", a:"39 min", d:"T=3,2/4,9=0,653h×60=39min", tags:["estima","tiempo"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+9, cat:"NAV", role:"NAVEG", fatigue:3, q:"Hb1=12:15, T=39 min\n→ ¿Hora de arribo (Hb2)?", a:"12:54", d:"12h15m+39m=12h54m", tags:["estima","eta"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+10, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación\n→ ¿Qué es el abatimiento?", a:"Desplazamiento lateral del barco provocado por el viento", d:"Viento empuja el casco lateralmente sobre el agua", tags:["abatimiento"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+11, cat:"NAV", role:"NAVEG", fatigue:2, q:"Abatimiento\n→ ¿Cuándo es máximo?", a:"Con viento por las amuras", d:"Máxima superficie expuesta al viento lateral", tags:["abatimiento"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+12, cat:"NAV", role:"NAVEG", fatigue:2, q:"Abatimiento\n→ ¿Cuándo es nulo?", a:"Con viento de popa", d:"Viento alineado con crujía, sin componente lateral", tags:["abatimiento"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+13, cat:"NAV", role:"NAVEG", fatigue:2, q:"Abatimiento a estribor\n→ ¿Qué signo tiene?", a:"Positivo (se suma al rumbo)", d:"Estribor=+ para Dv=Rv+a", tags:["abatimiento","signo"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+14, cat:"NAV", role:"NAVEG", fatigue:3, q:"Rc=180°, Dc=-6°, dm=8°W, abat=10°E\n→ ¿Derrota verdadera?", a:"176°", d:"Dv=180-6-8+10=176", tags:["abatimiento","derrota"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+15, cat:"NAV", role:"NAVEG", fatigue:4, q:"Dv deseada=240°, dm=6°E, Dc=-3°, abat=15°W\n→ ¿Rc a gobernar?", a:"252°", d:"Rc=240+3-6+15=252", tags:["abatimiento","estima","inversa"], difficulty:4, source:"15_NAVEGACION" },
  { id: maxId+16, cat:"NAV", role:"NAVEG", fatigue:2, q:"Fórmula de derrota verdadera con abatimiento\n→ ¿Cuál es?", a:"Dv = Rc + Dc + dm + a", d:"Rumbo compás + desvío + declinación + abatimiento", tags:["abatimiento","formula"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+17, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación\n→ ¿Qué es la derrota verdadera (Dv)?", a:"Rumbo real seguido por el barco sobre el agua", d:"Diferente del rumbo de proa por abatimiento", tags:["derrota"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+18, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación\n→ ¿Qué es un punto FIX?", a:"Posición cierta obtenida por métodos independientes de la estima", d:"GPS, enfilaciones, demoras cruzadas, astronómico", tags:["fix"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+19, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación costera\n→ ¿Qué métodos dan un punto FIX?", a:"GPS, puntos notables, enfilaciones, demoras cruzadas, astronómico", d:"Métodos independientes de la estima", tags:["fix","metodos"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+20, cat:"NAV", role:"NAVEG", fatigue:2, q:"Abatimiento\n→ ¿Cómo se mide prácticamente?", a:"Ángulo entre crujía y estela, o cabo naranja flotante desde popa", d:"Método visual, depende del ojo del marino", tags:["abatimiento","medicion"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+21, cat:"NAV", role:"NAVEG", fatigue:3, q:"Ceñida, viento no favorece derrota directa\n→ ¿Qué hace el patrón?", a:"Ceñir al máximo y calcular Dv sobre la carta", d:"No puede seguir derrota ideal, abatimiento corrige", tags:["abatimiento","regata"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+22, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación por estima\n→ ¿Por qué se corrige con un FIX?", a:"La estima acumula errores", d:"FIX da posición cierta para reiniciar estima", tags:["fix","estima"], difficulty:2, source:"15_NAVEGACION" },
  { id: maxId+23, cat:"NAV", role:"NAVEG", fatigue:3, q:"Rc=090°, Dc=+2°, dm=7°W, abat=5°W\n→ ¿Dv?", a:"80°", d:"Dv=90+2-7-5=80", tags:["abatimiento","derrota"], difficulty:3, source:"15_NAVEGACION" },
  { id: maxId+24, cat:"NAV", role:"NAVEG", fatigue:4, q:"Dv deseada=200°, dm=4°E, Dc=-1°, abat=8°E\n→ ¿Rc a gobernar?", a:"189°", d:"Rc=200+1-4-8=189", tags:["abatimiento","estima","inversa"], difficulty:4, source:"15_NAVEGACION" },
  { id: maxId+25, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación: 1h 20m a 6 Nd\n→ ¿Distancia recorrida?", a:"8 Mn", d:"D=6×1,333=8 Mn", tags:["distancia","velocidad"], difficulty:2, source:"15_NAVEGACION" },

  // ===== NAV: Triángulo vectorial, doceavos, rumbo de gobierno =====
  { id: maxId+26, cat:"NAV", role:"NAVEG", fatigue:3, q:"Navegación\n→ ¿Qué es el triángulo de corriente?", a:"Suma vectorial del barco + corriente = derrota sobre el fondo", d:"Vector barco + vector corriente = vector resultante", tags:["corriente","vectorial"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+27, cat:"NAV", role:"NAVEG", fatigue:3, q:"Triángulo de corriente\n→ ¿Qué representa el vector resultante?", a:"Derrota verdadera sobre el fondo y SOG", d:"Resultante de barco + corriente", tags:["corriente","vectorial"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+28, cat:"NAV", role:"NAVEG", fatigue:3, q:"Navegación\n→ ¿Qué es el rumbo de gobierno?", a:"Rv a gobernar para compensar corriente y mantener derrota deseada", d:"Se calcula con triángulo vectorial en la carta", tags:["corriente","gobierno"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+29, cat:"NAV", role:"NAVEG", fatigue:3, q:"Marea: rango=3,0 m, altura a la 3ª hora\n→ ¿Cuánto subió desde bajamar?", a:"1,5 m (6/12 del rango)", d:"3ª hora acumula 6/12=0,5×3,0=1,5", tags:["marea","doceavos"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+30, cat:"NAV", role:"NAVEG", fatigue:3, q:"Marea: bajamar=1,0 m, pleamar=4,0 m, altura a la 4ª hora\n→ ¿Altura?", a:"3,25 m", d:"4ª hora acumula 9/12=0,75×3,0+1,0=3,25", tags:["marea","doceavos"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+31, cat:"NAV", role:"NAVEG", fatigue:2, q:"Regla de los doceavos\n→ ¿Cuándo es máximo el cambio de marea?", a:"En las horas 3 y 4", d:"3/12 cada una, máximo del ciclo", tags:["marea","doceavos"], difficulty:2, source:"17_CORRIENTES" },
  { id: maxId+32, cat:"NAV", role:"NAVEG", fatigue:2, q:"Regla de los doceavos\n→ ¿Cuándo es mínimo el cambio de marea?", a:"En las horas 1 y 6", d:"1/12 cada una, mínimo del ciclo", tags:["marea","doceavos"], difficulty:2, source:"17_CORRIENTES" },
  { id: maxId+33, cat:"NAV", role:"NAVEG", fatigue:3, q:"Corriente de proa en ceñida\n→ ¿Cómo afecta la layline?", a:"Acorta la layline efectiva, más bordos", d:"Componente contra el avance alarga el recorrido", tags:["corriente","layline"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+34, cat:"NAV", role:"NAVEG", fatigue:3, q:"Corriente de popa en ceñida\n→ ¿Cómo afecta la layline?", a:"Alarga la layline efectiva, menos bordos", d:"Componente a favor acorta el recorrido", tags:["corriente","layline"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+35, cat:"NAV", role:"NAVEG", fatigue:3, q:"Corriente transversal en ceñida\n→ ¿Qué hace con la layline?", a:"Desplaza la layline a barlovento o sotavento", d:"El set determina el lado de desplazamiento", tags:["corriente","layline"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+36, cat:"NAV", role:"NAVEG", fatigue:3, q:"Regata con corriente conocida\n→ ¿Qué calcular antes de elegir borde?", a:"Layline efectiva y VMG sobre el fondo de cada borde", d:"Set+drift modifican laylines geográficas", tags:["corriente","tactica"], difficulty:3, source:"17_CORRIENTES" },
  { id: maxId+37, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación\n→ ¿Qué es la enfilación?", a:"Alineación de dos puntos notables que define una línea de posición", d:"Si los dos puntos se ven alineados, estás sobre esa línea", tags:["enfilacion"], difficulty:2, source:"03_IALA" },
  { id: maxId+38, cat:"NAV", role:"NAVEG", fatigue:2, q:"Navegación nocturna\n→ ¿Qué es el alcance nominal de una luz?", a:"Distancia máxima visible con visibilidad meteorológica de 10 Mn", d:"Se indica en cartas y publicaciones", tags:["alcance","luces"], difficulty:2, source:"03_IALA" },

  // ===== REG: RRS reglas 19, 20, 42, 44, 31 =====
  { id: maxId+39, cat:"REG", role:"ALL", fatigue:2, q:"RRS\n→ ¿Qué es el compromiso (overlap)?", a:"Cuando los cascos se superponen longitudinalmente", d:"Ninguno tiene proa clara sobre el otro", tags:["comprometido","definicion"], difficulty:2, source:"01_RRS" },
  { id: maxId+40, cat:"REG", role:"ALL", fatigue:2, q:"RRS\n→ ¿Qué es la zona de marca?", a:"Área dentro de 3 esloras del barco más cercano a la marca", d:"Dentro cambia las reglas de espacio en marca", tags:["zona","marca"], difficulty:2, source:"01_RRS" },
  { id: maxId+41, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 19\n→ ¿Cuándo aplica?", a:"Dos barcos comprometidos se aproximan a una obstrucción", d:"Obstrucción = objeto que no se puede pasar por ambos lados", tags:["regla19","obstruccion"], difficulty:2, source:"01_RRS" },
  { id: maxId+42, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 19\n→ ¿Quién da espacio en una obstrucción?", a:"El barco exterior al interior", d:"Interior recibe espacio para pasar la obstrucción", tags:["regla19","espacio"], difficulty:3, source:"01_RRS" },
  { id: maxId+43, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 19: bordes opuestos ceñida, uno debe apartarse por Regla 10\n→ ¿Aplica Regla 19?", a:"No, entre bordes opuestos en ceñida no aplica", d:"Regla 10 domina sobre Regla 19", tags:["regla19","excepcion"], difficulty:3, source:"01_RRS" },
  { id: maxId+44, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 20\n→ ¿Cuándo se pide agua para virar?", a:"Cuando una obstrucción a barlovento impide continuar ceñida", d:"Se grita '¡Agua para virar!'", tags:["regla20","virar"], difficulty:2, source:"01_RRS" },
  { id: maxId+45, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 20: gritás '¡Agua para virar!'\n→ ¿Qué debe hacer el barco pedido?", a:"Virar lo antes posible o responder '¡Virá!' y dar espacio", d:"Debe dar espacio para que el que pide vire", tags:["regla20","procedimiento"], difficulty:3, source:"01_RRS" },
  { id: maxId+46, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 20: pedís agua por un competidor lento a barlovento\n→ ¿Aplica?", a:"No, un competidor no es obstrucción si se puede caer y pasarlo", d:"Regla 20 solo aplica a obstrucciones reales", tags:["regla20","excepcion"], difficulty:3, source:"01_RRS" },
  { id: maxId+47, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 42\n→ ¿Qué prohíbe?", a:"Bombeo, rocking, ooching y sculling", d:"Movimientos prohibidos para propulsarse", tags:["regla42","propulsion"], difficulty:2, source:"01_RRS" },
  { id: maxId+48, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 42: bombeo una vez al entrar una racha\n→ ¿Es legal?", a:"Sí, un bombeo por racha está permitido", d:"Excepción: un bombeo por racha o cambio de viento", tags:["regla42","bombeo"], difficulty:2, source:"01_RRS" },
  { id: maxId+49, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 42: bombeo repetido de la mayor en ceñida\n→ ¿Infringe?", a:"Sí, pumping repetido está prohibido", d:"Solo 1 bombeo por racha es legal", tags:["regla42","bombeo"], difficulty:3, source:"01_RRS" },
  { id: maxId+50, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 42: timón repetido para avanzar en viento flojo\n→ ¿Infringe?", a:"Sí, sculling está prohibido", d:"Movimientos repetidos del timón para avanzar", tags:["regla42","sculling"], difficulty:3, source:"01_RRS" },
  { id: maxId+51, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 44: infracción de Parte 2 sin contacto\n→ ¿Qué penalización?", a:"Una vuelta (2 viradas + 2 trasluchadas)", d:"Penalización estándar según instrucciones", tags:["regla44","penalizacion"], difficulty:2, source:"01_RRS" },
  { id: maxId+52, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 44: infracción con contacto y daño\n→ ¿Qué penalización?", a:"Dos vueltas", d:"Contacto con daño agrava la penalización", tags:["regla44","penalizacion"], difficulty:3, source:"01_RRS" },
  { id: maxId+53, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 44\n→ ¿Cuándo hacer la penalización?", a:"Lo antes posible tras la infracción", d:"Fuera de zona de influencia de otros barcos", tags:["regla44","procedimiento"], difficulty:2, source:"01_RRS" },
  { id: maxId+54, cat:"REG", role:"ALL", fatigue:3, q:"RRS Regla 44: infracción en última pierna antes de meta\n→ ¿Cuándo penalizar?", a:"Antes de cruzar la meta", d:"No se puede penalizar después de cruzar", tags:["regla44","meta"], difficulty:3, source:"01_RRS" },
  { id: maxId+55, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 31\n→ ¿Qué prohíbe?", a:"Tocar una marca del recorrido", d:"Infracción leve con penalización de una vuelta", tags:["regla31","marca"], difficulty:2, source:"01_RRS" },
  { id: maxId+56, cat:"REG", role:"ALL", fatigue:2, q:"RRS Regla 31: tocaste una marca\n→ ¿Qué penalización?", a:"Una vuelta (1 virada + 1 trasluchada) lo antes posible", d:"Regla 31 + 44, penalización rápida", tags:["regla31","penalizacion"], difficulty:2, source:"01_RRS" },
  { id: maxId+57, cat:"REG", role:"ALL", fatigue:3, q:"RRS: A estribor, B babor, B vira delante de A sin espacio\n→ ¿Qué reglas intervienen?", a:"10, 13 y 15", d:"B debía apartarse (10), virando (13), adquiere derecho (15)", tags:["regla","combinado"], difficulty:4, source:"14_PROTESTA" },
  { id: maxId+58, cat:"REG", role:"ALL", fatigue:3, q:"RRS: A interior pide espacio por obstrucción, B no deja\n→ ¿Quién infringe?", a:"B, Regla 19", d:"Exterior debe dar espacio al interior", tags:["regla19","protesta"], difficulty:3, source:"14_PROTESTA" },
  { id: maxId+59, cat:"REG", role:"ALL", fatigue:3, q:"RRS: A pide agua para virar, B responde '¡Virá!', A vira pero B no da espacio\n→ ¿Quién infringe?", a:"B, Regla 20", d:"B debe dar espacio tras responder", tags:["regla20","protesta"], difficulty:3, source:"14_PROTESTA" },
  { id: maxId+60, cat:"REG", role:"ALL", fatigue:3, q:"RRS: A hace penalización pero no completa las vueltas\n→ ¿Vale la penalización?", a:"No, debe completar las vueltas requeridas", d:"Penalización incompleta no exonera", tags:["regla44","protesta"], difficulty:3, source:"14_PROTESTA" },

  // ===== SEG/REG: COLREG regla 19, señales fónicas, remolque, fondeo =====
  { id: maxId+61, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG Regla 19\n→ ¿Cuándo aplica?", a:"En visibilidad restringida (niebla, bruma, lluvia intensa)", d:"No aplica jerarquía normal de Regla 18", tags:["colreg","regla19","niebla"], difficulty:2, source:"02_COLREG" },
  { id: maxId+62, cat:"SEG", role:"ALL", fatigue:3, q:"COLREG Regla 19: dos barcos en niebla\n→ ¿Quién cede?", a:"No hay regla de quién cede, ambos deben alterar rumbo temprano", d:"Cada barco maniobra con precaución extrema", tags:["colreg","regla19","niebla"], difficulty:3, source:"02_COLREG" },
  { id: maxId+63, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: velero navegando en niebla\n→ ¿Qué señal fónica emite?", a:"1 sonido largo + 2 cortos cada 2 minutos", d:"Señal de velero en visibilidad restringida", tags:["colreg","fonica","niebla"], difficulty:2, source:"02_COLREG" },
  { id: maxId+64, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: barco a motor navegando en niebla\n→ ¿Qué señal fónica emite?", a:"1 sonido largo cada 2 minutos", d:"Señal de propulsión mecánica en navegación", tags:["colreg","fonica","niebla"], difficulty:2, source:"02_COLREG" },
  { id: maxId+65, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: barco fondeado en niebla\n→ ¿Qué señal emite?", a:"Campana rápida 5 s cada 1 minuto", d:"Señal de fondeado en visibilidad restringida", tags:["colreg","fonica","fondeo"], difficulty:2, source:"02_COLREG" },
  { id: maxId+66, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: 5 sonidos cortos\n→ ¿Qué significan?", a:"No entiendo tus intenciones (advertencia)", d:"Señal de advertencia entre barcos", tags:["colreg","fonica"], difficulty:2, source:"02_COLREG" },
  { id: maxId+67, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: 1 sonido corto\n→ ¿Qué significa?", a:"Altero rumbo a estribor", d:"Señal de maniobra a estribor", tags:["colreg","fonica"], difficulty:2, source:"02_COLREG" },
  { id: maxId+68, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: 2 sonidos cortos\n→ ¿Qué significan?", a:"Altero rumbo a babor", d:"Señal de maniobra a babor", tags:["colreg","fonica"], difficulty:2, source:"02_COLREG" },
  { id: maxId+69, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: 3 sonidos cortos\n→ ¿Qué significan?", a:"Estoy dando atrás", d:"Señal de máquina atrás", tags:["colreg","fonica"], difficulty:2, source:"02_COLREG" },
  { id: maxId+70, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: barco sin gobierno en niebla\n→ ¿Qué señal emite?", a:"2 sonidos largos seguidos cada 2 minutos", d:"Sin gobierno o maniobra restringida", tags:["colreg","fonica","niebla"], difficulty:2, source:"02_COLREG" },
  { id: maxId+71, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: remolcador de noche\n→ ¿Qué luz lo identifica?", a:"Luz amarilla de remolque sobre la blanca de popa", d:"Luz amarilla encima de popa", tags:["colreg","remolque","luces"], difficulty:2, source:"02_COLREG" },
  { id: maxId+72, cat:"SEG", role:"ALL", fatigue:3, q:"COLREG: remolque > 200 m de noche\n→ ¿Qué adicional muestra?", a:"Luz de tope adicional y marca de diamante", d:"Remolque largo requiere señales extra", tags:["colreg","remolque","luces"], difficulty:3, source:"02_COLREG" },
  { id: maxId+73, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: buque fondeado de noche\n→ ¿Qué luces muestra?", a:"Luz blanca todo horizonte en la parte más alta", d:"Si >50m, segunda luz blanca más baja", tags:["colreg","fondeo","luces"], difficulty:2, source:"02_COLREG" },
  { id: maxId+74, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG: buque fondeado de día\n→ ¿Qué marca diurna muestra?", a:"Esfera negra en la parte más alta", d:"Marca diurna de fondeado", tags:["colreg","fondeo","marca"], difficulty:2, source:"02_COLREG" },
  { id: maxId+75, cat:"SEG", role:"ALL", fatigue:3, q:"COLREG: buque varado de noche\n→ ¿Qué luces muestra?", a:"Luces de fondeado + 2 luces rojas verticales", d:"Varadura agrega 2 rojas sobre las de fondeo", tags:["colreg","varadura","luces"], difficulty:3, source:"02_COLREG" },
  { id: maxId+76, cat:"SEG", role:"ALL", fatigue:3, q:"COLREG: buque varado de día\n→ ¿Qué marca diurna muestra?", a:"3 esferas negras verticales", d:"Marca diurna de varadura", tags:["colreg","varadura","marca"], difficulty:3, source:"02_COLREG" },
  { id: maxId+77, cat:"SEG", role:"ALL", fatigue:2, q:"COLREG Regla 37\n→ ¿Qué señales indican peligro?", a:"Bandera NC, luces rojas intermitentes, bengalas rojas", d:"Señales de socorro y peligro", tags:["colreg","peligro","socorro"], difficulty:2, source:"02_COLREG" },
  { id: maxId+78, cat:"SEG", role:"ALL", fatigue:3, q:"Niebla en Río de la Plata, visibilidad < 50 m\n→ ¿Qué considerar?", a:"Abandono, reducir velocidad, señales fónicas cada 2 min", d:"Emergencia náutica en visibilidad crítica", tags:["colreg","niebla","rio-plata"], difficulty:3, source:"02_COLREG" },

  // ===== SEG: IALA ritmos, enfilación, sectoriales =====
  { id: maxId+79, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz Fl\n→ ¿Qué significa?", a:"Destellante (destellos regulares)", d:"Fl = flashing, destellos a intervalos regulares", tags:["iala","ritmo","luces"], difficulty:2, source:"03_IALA" },
  { id: maxId+80, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz Q\n→ ¿Qué significa?", a:"Destellos rápidos (50-79 por minuto)", d:"Q = quick flashing", tags:["iala","ritmo","luces"], difficulty:2, source:"03_IALA" },
  { id: maxId+81, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz VQ\n→ ¿Qué significa?", a:"Destellos muy rápidos (80-159 por minuto)", d:"VQ = very quick flashing", tags:["iala","ritmo","luces"], difficulty:2, source:"03_IALA" },
  { id: maxId+82, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz Iso\n→ ¿Qué significa?", a:"Isófase (luz y oscuridad iguales)", d:"Iso = isophase, períodos iguales", tags:["iala","ritmo","luces"], difficulty:2, source:"03_IALA" },
  { id: maxId+83, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz Occ\n→ ¿Qué significa?", a:"Ocultaciones (más tiempo encendida que apagada)", d:"Occ = occulting, luz predominante", tags:["iala","ritmo","luces"], difficulty:2, source:"03_IALA" },
  { id: maxId+84, cat:"SEG", role:"NAVEG", fatigue:3, q:"IALA: Fl(2) 10s\n→ ¿Qué significa?", a:"Grupos de 2 destellos cada 10 segundos", d:"Período = 10s, 2 destellos por grupo", tags:["iala","ritmo","periodo"], difficulty:3, source:"03_IALA" },
  { id: maxId+85, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz Mo(A)\n→ ¿Qué significa?", a:"Código Morse 'A' (·−)", d:"Morse A en luz, marca de aguas seguras", tags:["iala","ritmo","morse"], difficulty:2, source:"03_IALA" },
  { id: maxId+86, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: ¿qué es el período de una luz?", a:"Tiempo total de un ciclo completo de la luz", d:"Se expresa en segundos", tags:["iala","periodo"], difficulty:2, source:"03_IALA" },
  { id: maxId+87, cat:"SEG", role:"NAVEG", fatigue:3, q:"Navegación nocturna: dos boyas cercanas\n→ ¿Cómo distinguirlas?", a:"Por el ritmo y período de la luz", d:"Cada boya tiene un ritmo único en la carta", tags:["iala","ritmo","navegacion"], difficulty:3, source:"03_IALA" },
  { id: maxId+88, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz sectorial roja\n→ ¿Qué indica?", a:"Peligro a babor del sector seguro", d:"Sector rojo = zona peligrosa", tags:["iala","sectorial"], difficulty:2, source:"03_IALA" },
  { id: maxId+89, cat:"SEG", role:"NAVEG", fatigue:2, q:"IALA: luz sectorial blanca\n→ ¿Qué indica?", a:"Agua segura dentro del canal", d:"Sector blanco = zona navegable", tags:["iala","sectorial"], difficulty:2, source:"03_IALA" },
  { id: maxId+90, cat:"SEG", role:"NAVEG", fatigue:3, q:"Navegación: enfilación de dos faros alineados\n→ ¿Qué indica?", a:"El barco está sobre esa línea de posición", d:"Si los dos puntos se ven alineados", tags:["enfilacion","posicion"], difficulty:3, source:"03_IALA" },
  { id: maxId+91, cat:"SEG", role:"NAVEG", fatigue:3, q:"Navegación: alcance nominal vs geográfico\n→ ¿Cuál limita la curvatura terrestre?", a:"El geográfico (depende de altura del observador)", d:"Nominal depende de visibilidad meteorológica", tags:["alcance","navegacion"], difficulty:3, source:"03_IALA" },

  // ===== METEO: Beaufort, nubes, persistent vs oscillating =====
  { id: maxId+92, cat:"METEO", role:"TAC", fatigue:2, q:"Beaufort 4 (11-16 kn)\n→ ¿Cómo son las condiciones?", a:"Bonacilla, regata ideal", d:"Beaufort 4 = condiciones óptimas para trimado fino", tags:["beaufort"], difficulty:2, source:"16_METEOROLOGIA" },
  { id: maxId+93, cat:"METEO", role:"TAC", fatigue:2, q:"Beaufort 6 (22-27 kn)\n→ ¿Qué priorizar?", a:"Rizos y cuidado con spi", d:"Fresco, inicio de despotenciar", tags:["beaufort"], difficulty:2, source:"16_METEOROLOGIA" },
  { id: maxId+94, cat:"METEO", role:"TAC", fatigue:2, q:"Beaufort 3 (7-10 kn)\n→ ¿Cómo son las condiciones?", a:"Flojo, trimado fino", d:"Beaufort 3 = viento flojo ideal para táctica", tags:["beaufort"], difficulty:2, source:"16_METEOROLOGIA" },
  { id: maxId+95, cat:"METEO", role:"TAC", fatigue:3, q:"Cumulonimbus a la vista en regata\n→ ¿Qué riesgo genera?", a:"Racha brusca y rolete impredecible", d:"Inestabilidad severa, cambio de dirección repentino", tags:["nubes","cumulonimbus"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+96, cat:"METEO", role:"TAC", fatigue:2, q:"Cirros altos y finos\n→ ¿Qué indican?", a:"Aproximación de frente en 12-24 h", d:"Cirros = cambio de viento próximo", tags:["nubes","cirros"], difficulty:2, source:"16_METEOROLOGIA" },
  { id: maxId+97, cat:"METEO", role:"TAC", fatigue:3, q:"Altostratus grisácea tapando el sol\n→ ¿Qué indica?", a:"Frente cálido aproximándose, lluvia en horas", d:"Capa que avanza antes del frente", tags:["nubes","altostratus"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+98, cat:"METEO", role:"TAC", fatigue:3, q:"Borneo oscilante en ceñida\n→ ¿Qué estrategia usar?", a:"Navegar el lift del momento, virar en el header", d:"No hay borde favorecido permanente", tags:["borneo","oscilante"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+99, cat:"METEO", role:"TAC", fatigue:3, q:"Borneo persistente en ceñida\n→ ¿Qué estrategia usar?", a:"Navegar hacia el lado donde rolará el viento", d:"El borneo futuro favorece ese borde", tags:["borneo","persistente"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+100, cat:"METEO", role:"TAC", fatigue:3, q:"Brisa marina estableciéndose\n→ ¿Cómo rota?", a:"Rota hacia la derecha (sur/sureste en hemisferio sur)", d:"Brisa marina rola al establecerse", tags:["brisa","borneo"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+101, cat:"METEO", role:"TAC", fatigue:2, q:"Brisa marina vs terrestre\n→ ¿Cuál es más fuerte?", a:"La brisa marina", d:"Especialmente en verano, 10-15 kn", tags:["brisa"], difficulty:2, source:"16_METEOROLOGIA" },
  { id: maxId+102, cat:"METEO", role:"TAC", fatigue:3, q:"Gradiente y brisa marina en direcciones opuestas\n→ ¿Qué pasa?", a:"La brisa puede no establecerse o ser muy débil", d:"Se anulan mutuamente", tags:["brisa","gradiente"], difficulty:3, source:"16_METEOROLOGIA" },
  { id: maxId+103, cat:"METEO", role:"TAC", fatigue:2, q:"Niebla de advección en Río de la Plata\n→ ¿Cuándo es común?", a:"Primavera y otoño", d:"Aire cálido y húmedo sobre agua más fría", tags:["niebla","rio-plata"], difficulty:2, source:"16_METEOROLOGIA" }
];

// Filter out duplicates
const filtered = newQs.filter(q => {
  const norm = q.q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (existingQ.has(norm)) {
    console.log('DUPLICATE skipped:', q.id, q.q.substring(0,50));
    return false;
  }
  existingQ.add(norm);
  return true;
});

console.log(`\nGenerated: ${newQs.length}, After dedup: ${filtered.length}`);

// Append
const updated = [...bank, ...filtered];
writeFileSync(path, JSON.stringify(updated, null, 2) + '\n', 'utf8');
console.log(`Appended ${filtered.length} questions. New total: ${updated.length}`);
console.log(`ID range: ${filtered[0].id} - ${filtered[filtered.length-1].id}`);
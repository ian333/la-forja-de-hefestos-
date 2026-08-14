# ORDEN: EL DADO CON SU MOLDE — el video final del llenado, con el acero en cuadro

BASE: 224445a

OBJETIVO: ian, antes de arrancar la E6: *"regresemos con el último video del llenado
del dado — con todo bien y con la referencia, ahora sí debe llenar todo el molde…
pero NO HE VISTO EL MOLDE"*. Cierto: en el video del dado el acero son fantasmas
tenues y la cámara nunca lo enseña como MOLDE. El arsenal para verlo YA existe
(EL CORTE: MoldSectionReveal con secciones sólidas + opacidades por rol) — solo no
es manejable desde el arnés de video.

## LO QUE SE CONSTRUYE
1. `__forgeBrep.moldVista(opacidades?, xray?)` en `ForgeBRepStudio.tsx`: expone los
   setters EXISTENTES (setMoldOpacity / setMoldXray) al arnés — ~8 líneas, cero
   lógica nueva. ENMIENDA de honestidad: el CORTE en-escena de las partes E5 NO
   existe (MoldSectionReveal es una experiencia aparte y el slice solo corta la
   vista térmica) — la vista es "MOLDE DE VIDRIO" como las referencias de Futaba:
   opacidades por rol. El corte de partes queda como deuda declarada si el vidrio
   no basta.
2. `llenado-video.cjs` env `MOLDE=1`: tras cargar la E5, `moldVista` con opacidades
   que lean como molde de vidrio (cavidad/núcleo/placas presentes, el líquido
   visible adentro). Sonda de encuadre en baja resolución ANTES del 4K (regla
   peek-antes-de-4K).
3. Render 4K `dado-llenado-4k.mp4` final: el molde EN CUADRO, el llenado COMPLETO
   (colada→pieza al 100 %) — juzgado (8 criterios) + mis ojos + AMBAS PCs + deploy.

## YA-EXISTE
- MoldSectionReveal (secciones SÓLIDAS, orden EL CORTE) · moldOpacity por rol ·
  el arnés E5=1 con juez · FrenteSuperficie continuo (el fundido, entero).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- sonda 720p con OJOS antes del 4K (encuadre + el corte del lado correcto).
- video 4K APROBADO por el juez (los 8 criterios, una-tubería incluido) + crops 1:1
  míos: el ACERO se lee como acero, el líquido baja el bebedero y llena el 100 %.
- gate 110 verdes (no se toca lógica) · orden-gate VERDE · AMBAS PCs · deploy.

## CIERRE (2026-08-14)

- **VIDEO 4K APROBADO** (8/8 del juez: monótono · arranca 0.02 % · TERMINA 100 % ·
  sin saltos · repartido · consola limpia · una-tubería · imagen cambia) →
  `dado-llenado-4k.mp4` a AMBAS PCs. Gate 110 verdes (sin tocar lógica) ·
  orden-gate VERDE.

- **Con OJOS**: el molde POR FIN se lee como molde — el bloque de la cavidad
  translúcido abrazando al dado, la base debajo, el bebedero atravesando el acero,
  el líquido bajando ADENTRO y el cubo formándose completo con su gradiente de
  llenado (cian arriba → ámbar en las patas, lo último). Sonda 720p ANTES del 4K
  (regla peek) — el encuadre se aprobó con ojos en baja resolución.

- **ENMIENDA de honestidad ejecutada**: el CORTE en-escena de las partes E5 NO
  existe (MoldSectionReveal es experiencia aparte; el slice solo corta la vista
  térmica) → la vista entregada es "MOLDE DE VIDRIO" (opacidades por rol vía
  `moldVista`, ~8 líneas de manija sobre setters existentes), como las referencias
  de Futaba que ian acaba de calibrar. El corte de partes queda como deuda
  declarada si algún día el vidrio no basta.

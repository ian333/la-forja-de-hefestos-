# Economía de Atención — ciencia verificada → features del verificador

> Tercer doc de la trilogía: `NEUROCIENCIA-DEL-GANCHO.md` (0-0.5s, captura) y
> `RETENCION-CEREBRO-LENTO.md` (el lazo causal, guion). ESTE doc cubre lo que
> el PIXEL y el AUDIO pueden medir segundo a segundo — cada hallazgo con su
> estudio y su feature computable en `scripts/atencion-verify.py`.

## 1 · El video DEBE cambiar visualmente — el audio solo no retiene

- Teoría de doble canal (Mayer, multimedia learning; Paivio dual-coding):
  narración hablada + imagen > texto + imagen (dos canales sin sobrecarga).
  Nuestro formato (voz + cine + texto mínimo) es el correcto según la teoría.
- El efecto redundancia: REPETIR lo mismo en dos canales daña; los canales
  deben COMPLEMENTAR (la voz explica, el pixel muestra otra cosa).
- Saliencia visual (Itti-Koch 1998): la atención de abajo-arriba la capturan
  CONTRASTES de color (doble-oponente), intensidad, orientación y MOVIMIENTO;
  los onsets súbitos de movimiento recapturan la mente que vaga.
- Industria (benchmarks 2025-26): cambio visual cada 2-4s previene fatiga;
  "pattern interrupts" (corte, zoom, cambio de ritmo) resetean el foco.
- → FEATURE: curva de energía de movimiento por segundo (frame-diff);
  FLAG "valle muerto" si el movimiento cae bajo umbral >2.5s.
  Hipótesis Ian confirmada por la teoría: audio chingón + pantalla estática
  = el canal visual se queda sin error de predicción → fuga.

## 2 · Colorfulness es MEDIBLE (Hasler & Süsstrunk 2003)

- Métrica psicofísica validada (95.3% de correlación con juicios humanos):
  ejes oponentes rg = R−G, yb = (R+G)/2 − B;
  M = sqrt(σ_rg² + σ_yb²) + 0.3·sqrt(μ_rg² + μ_yb²)
- Pensada para VIDEO en tiempo real. Es EL número de "qué tan vivo se ve".
- → FEATURE: M por frame → media, y flag de "segundo lavado/gris".

## 3 · El color de O₂ tiene ciencia: figura-fondo (Palmer & Schloss 2011)

- Berkeley Color Project: la ARMONÍA de un par sube con similitud de matiz,
  pero la preferencia por la FIGURA sube con el CONTRASTE de matiz contra el
  fondo. No es contradicción: fondo cohesivo + figura contrastante.
- O₂ viral = fondo frío (azul/violeta) + figura cálida (oro/ámbar/naranja):
  activa los dos ejes oponentes del sistema visual A LA VEZ (rojo-verde y
  azul-amarillo) — máxima señal en el hardware del ojo.
- → FEATURES: (a) contraste de matiz centro-vs-periferia (figura pop);
  (b) "firma O₂": presencia simultánea de cluster cálido (20-60°) y frío
  (200-290°) en el histograma de matiz; (c) cohesión del fondo.

## 4 · Sincronía audio-visual = atención de abajo-arriba

- La proximidad temporal entre eventos bimodales promueve integración y
  DIRIGE la atención de forma stimulus-driven (binding audiovisual).
- Cortes on-beat vs off-beat tienen efectos atencionales medibles; la
  sincronía cerebral delta entre espectadores (iScience 2025) trackea el
  engagement con la pieza.
- → FEATURE: correlación cruzada entre envolvente de onsets de audio y la
  curva de movimiento visual (pico cerca de lag 0 = sincronizado).

## 5 · La forma de la curva de retención (empírico de plataformas)

- Acantilado: la mayor pérdida en el primer 15-25% ("death valley" en ads
  TikTok); IG Reels promedia ~65% de completion (peor que TT ~78%).
- Meta razonable 60-70s: >30-40% de watch-time promedio; 5-10% llega al
  final (los datos de Ian coinciden EXACTO con la literatura).
- → FEATURES: score del gancho (0-5s aparte: movimiento+color+figura+tiempo
  al primer pico) + curva de interés por segundo + predicción de retención
  (hazard sube donde el interés cae) — v0 heurística, SE CALIBRA con las
  métricas reales de IG/YT conforme lleguen (el ciclo del Acto 10).

## Fuentes

- Hasler & Süsstrunk (2003), "Measuring colourfulness in natural images", SPIE — infoscience.epfl.ch/record/33994
- Schloss & Palmer (2011), "Aesthetic response to color combinations", Attention, Perception & Psychophysics — doi 10.3758/s13414-010-0027-0
- Palmer, Schloss & Sammartino (2013), "Visual Aesthetics and Human Preference", Annual Review of Psychology
- Itti, Koch & Niebur (1998), "A model of saliency-based visual attention", IEEE PAMI
- Mayer — principios de aprendizaje multimedia (modalidad/redundancia); revisiones Frontiers Psychology 2023
- iScience (2025), "Delta-band audience brain synchrony tracks engagement with live and recorded dance"
- Zannettou et al. (CHI 2024), "Analyzing User Engagement with TikTok's Short Format Video"
- Benchmarks industria 2025-26: OpusClip, Retensis, AIR Media-Tech (cortes 2-4s, death valley, completion por plataforma)

## 6 · HALLAZGOS DEL CORPUS PROPIO (2026-07-06, atencion-verify v0)

Ranking (score) vs realidad conocida: O₂ viral (33.5K vistas) 73.8 · F₂v2 62.4 ·
Fe (779 vistas) 61.9 · H 58.5 · Au 56.2 · H₂ 54.5 · O₂parte2 41.7 ·
O₂v2 37.9 · C₂ 37.1 · N₂ 32.0

**La huella numérica del VIRAL (el objetivo a igualar):**
- firma-O₂ (cálido+frío simultáneos): **98%** del tiempo (los demás: 9-84%)
- contraste figura-fondo: **118.5°** (los demás: 14-42°)
- quemado sostenido: **0 segundos** — N₂/O₂v2/C₂ traen 10-17s de pantalla
  >15% reventada (los clavados al núcleo + boost): pantalla blanca NO es luz,
  es información quemada
- gancho ~94 e interés ~0.67 — IGUALES al resto: el gancho ya está resuelto
  en toda la serie; el diferenciador es COLOR + cero quemado

**Leyes para el siguiente episodio (la cadena):**
1. Dual-cluster SIEMPRE: figura cálida (oro/ámbar) sobre fondo frío
   (azul/violeta) ≥90% del film, figura-fondo >100°
2. Cero quemado sostenido (flash de SNAP sí; columna blanca 10s no)
3. Gate de publicación: atencion-verify score — no sale nada <60 sin revisión

**Paper CHI 2024 (Zannettou, 347 users, 9.2M vistas TikTok):** atención estable
en ~45% de videos vistos al final; 55% se abandona ANTES de la mitad; la gente
pone MÁS atención a cuentas que NO sigue (descubrimiento > following) — el
contenido de descubrimiento como el nuestro juega con ventaja algorítmica.

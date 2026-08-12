# ORDEN: LA ALARMA DE BALANCE — mover todo el layout sin que nada grite, nunca más

BASE: 5a39b65

OBJETIVO: ian: *"moviste el cubo, se desplazó a la derecha, TODO se desplazó, y eso no
levantó alarmas… una alarma es que se desplazó todo y no te levantó ninguna"*. Y no sólo
faltó la alarma: **yo mismo edité el check del marco** ('comparten marco' → 'vive donde
la COLOCACIÓN declara') para que ESPERARA el desplazamiento — el gate del que comete el
error midiendo su propia coherencia, el patrón que CLAUDE.md ya tiene documentado.

La lectura del libro (abajo) dice además que el desplazamiento era un PARCHE mío, no la
solución del libro. Esta orden construye la alarma — que HOY debe salir en ROJO — y deja
la decisión del layout a ian.

## LO QUE EL LIBRO DICE (la vuelta que pidió ian)

- **§7.2.1 (p.163), literal**: *"The sprue gate is **most commonly used in single cavity
  molds** in which the mold's sprue bushing **directly abuts the surface of the mold
  cavity**… Since it has no length, there is no pressure drop associated with the sprue
  gate."* Y la **Fig 7.2 ES nuestra pieza**: un recipiente abierto moldeado BOCA ABAJO,
  con el bebedero cayendo al centro de la base cerrada. Cavidad AL CENTRO.
- **§6.6 (p.158)**: *"All feed systems should **minimize the feed system length**…
  feed system designs should be **naturally balanced**."*
- **§4.3 (Figs 4.17-4.20)**: TODOS los layouts del libro (serie, rejilla, circular,
  híbrido) son SIMÉTRICOS alrededor del centro del molde.
- Los trade-offs del sprue directo, honestos (**p.164**): des-gateo difícil (⌀ grande,
  cortador) y vestigio en la base — remedios del propio libro: el RIM perimetral
  (Fig 7.2) o el POZO rebajado (Fig 7.3). La alternativa fina es pin-point con molde de
  3 placas (§7.2.2, Fig 7.4) — pero la E2 eligió 2 placas por economía.

**CONCLUSIÓN**: para UNA cavidad de caja abierta, el libro no desplaza la cavidad —
**voltea la pieza** (boca hacia B) y usa **sprue directo al centro de la base**. El
desplazamiento de 29.2 mm fue mi parche con las reglas de runner de §6.3.1 (que son
para multi-cavidad / edge gate). Consecuencias del layout del libro, estimadas:
cavidad centrada (balance ✓) · cero runner/compuerta/pozo/puller · L_sprue ≈ 62 mm
(cara del clamp → base volteada) · regrind ≈ 15 % → **CUMPLE §6.2.3** · y el "sprue que
no llena ciertas cavidades" (artefacto de resolución sobre el tubo + la compuerta de
1 mm apenas voxelizada) desaparece casi entero porque esos tramos dejan de existir.

## LO QUE SE CONSTRUYE (esta orden: SOLO la alarma)
- **BALANCE**: distancia del centroide de la cavidad (en la partición) al eje de la
  máquina (bushing/anillo = centro de la base). Umbral: EXTENSIÓN DECLARADA (el libro
  da el principio, no el número): dispara si > 5 % del ancho de la base (9.8 mm).
- **HOY DEBE SALIR ROJA**: desbalance = 29.2 mm. El gate queda con esa falla DECLARADA
  (como el 71/1 del generador) hasta que ian decida el layout.
- **CONTROL**: el layout centrado (sintético) da 0 → verde. Si el control no distingue,
  no es alarma.
- En el panel E5: la fila de balance junto a la de tubería.
- **NO se voltea la pieza en esta orden** — es LA decisión de layout de ian (con el
  trade-off del vestigio §7.2.1 sobre la mesa).

## TOCA
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

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
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- la alarma DISPARA hoy: desbalance 29.2 mm > 9.8 mm → check en ROJO con el anuncio
  (retorno a la E3: voltear la pieza —Fig 7.2— o justificar el desbalance).
- el CONTROL centrado da 0 mm → verde.
- el panel E5 muestra la fila (roja hoy), con el número y el umbral declarado.
- `node scripts/orden-gate.cjs` VERDE · el ciclo-dado-test queda **con 1 falla A
  PROPÓSITO** hasta la decisión de ian — se declara en el CIERRE, no se maquilla.

## CIERRE (2026-08-12)

- **LA ALARMA EXISTE Y ESTÁ ROJA, a propósito**: gate **83 pasan · 1 falla** =
  `BALANCE: desbalance 29.2 mm vs umbral 9.8 (5 % de 196)`, con el retorno anunciado
  (E3: voltear la pieza —Fig 7.2— o justificar el desbalance). El CONTROL centrado da
  0.0 mm y pasa: la alarma distingue.
- En el panel E5, la fila de BALANCE vive junto a la de tubería: roja hoy, con el número
  y el umbral declarado (EXTENSIÓN — el libro da el principio §6.6/§4.3, no el número).
- **Se confiesa el patrón**: el check del marco lo edité yo ('comparten marco' → 'vive
  donde la COLOCACIÓN declara') para que ESPERARA el desplazamiento — coherencia
  interna, no criterio externo. La alarma nueva ancla a un criterio del LIBRO (el eje
  de la máquina), no a lo que declare mi propio código de colocación.
- **PENDIENTE — la decisión de ian**: el libro dice que para UNA cavidad de caja abierta
  no se desplaza la cavidad: se VOLTEA la pieza (boca a B) y el bebedero cae directo al
  centro de la base (§7.2.1, Fig 7.2 — que es literalmente nuestra pieza dibujada).
  Estimado si se voltea: balance 0 · cero runner/compuerta/pozo · L_sprue ≈ 62 mm ·
  regrind ≈ 15 % (CUMPLE §6.2.3) · y el artefacto visual del sprue casi desaparece.
  Trade-off honesto (p.164): vestigio en la base y des-gateo del ⌀ grande — remedios
  del libro: rim perimetral (Fig 7.2) o pozo rebajado (Fig 7.3).

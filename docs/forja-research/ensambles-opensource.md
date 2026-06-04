# Ensambles open-source para La Forja — robots, mecanismos, partes (gratis · educación)

Catálogo curado de fuentes **realmente abiertas** (CC / dominio público / OSHW / MIT/GPL),
no "gratis pero propietario". Para cada una: **licencia** + **formato** + **cómo entra a La Forja**.

> **Cómo entra a La Forja:** el CAD importa **STEP** (B-Rep editable, `importSTEP` ya en `occt.ts`)
> → esos se vuelven **piezas de la biblioteca / componentes del ensamble** (guardar/cargar ya existe).
> Los **STL/3MF** son malla (3D-print): sirven de **referencia visual / para medir y reconstruir**,
> no se editan como B-Rep. Lo **nativo FreeCAD** se exporta a STEP primero (gratis, en FreeCAD).

---

## ⭐ 1. LO MEJOR para La Forja (STEP, se importa directo)

- **step.parts — 12,000+ STEP open-source** · MIT (material propio) · **STEP** ⭐⭐⭐
  https://www.step.parts/ · repo: https://github.com/earthtojake/step.parts
  Rodamientos, **engranes, poleas, ejes, bandas, husillos**, servos, motores, **actuadores de robot**,
  reductores, perfiles de extrusión, placas, brackets, conectores. *Es EL feed natural del ensamble.*
- **FreeCAD-Library** · LGPL · **STEP/FCStd** — enorme librería de partes (tornillería, perfiles, etc.)
  https://github.com/FreeCAD/FreeCAD-library
- **OpenBuilds — STEP Parts Library** · open · **STEP** — perfiles V-slot, ruedas, placas, CNC/impresora.
  https://builds.openbuilds.com/projectresources/step-parts-library.162/
- **CADCloud / justyour.parts** · MIT (plataforma) · **STEP/IGES** — repositorio colaborativo de partes.
  https://justyour.parts

## 🤖 2. ROBOTS open-source educativos

- **BCN3D MOVEO** — brazo 5 ejes, hecho con la *Generalitat de Catalunya* para enseñanza · CAD + STL + BOM + manual.
  https://github.com/BCN3D/BCN3D-Moveo  (revisar licencia del repo; CAD nativo → exportar STEP)
- **Thor** — brazo 6-DOF, diseñado en **FreeCAD** · **CC-BY-SA-4.0** · FreeCAD→STEP exportable. ⭐
  https://github.com/AngelLM/Thor
- **openDog (XRobots / James Bruton)** — perro robótico · **GPL-3** · CAD + código por episodio.
  https://github.com/XRobots/openDog
- **Poppy Humanoid (Inria)** — humanoide para **investigación y educación**, modular · open-source · STL/CAD.
  (ojo: el nombre "Poppy" es marca registrada; el diseño es abierto)
  https://github.com/poppy-project/poppy-humanoid · https://www.poppy-project.org/
- **InMoov (Gael Langevin)** — humanoide tamaño real impreso · **STL** · ⚠️ **CC-BY-NC** (NO comercial — relevante para GAIA).
  https://inmoov.fr

## ⚙️ 3. MECANISMOS para enseñar (linkages, levas, engranes)

- **KMODDL — Reuleaux (Cornell)** · acceso abierto educativo ⭐⭐ — la colección histórica de modelos
  cinemáticos del s.XIX (Reuleaux): linkages, engranes raros, juntas. Multimedia para enseñar *kinemática*.
  https://engineering.library.cornell.edu/kmoddl/ · https://digital.library.cornell.edu/collections/kmoddl
- **507 Mechanical Movements (Henry Brown, 1868)** · **DOMINIO PÚBLICO** — el clásico de 507 mecanismos.
  Cornell eCommons: https://ecommons.cornell.edu/handle/1813/57668 · web animada: https://507movements.com
- **Pyslvs-UI** · open-source — **síntesis** de mecanismos planos de barras (diseñar el linkage que da un movimiento).
  https://github.com/KmolYuan/Pyslvs-UI
- **SolveSpace** · open-source CAD — analiza la **trayectoria** de linkages móviles (joints pin/ball/slide).
  https://solvespace.com
- **mechanism (Python)** · open — linkages, levas, engranes (cuaderno de cuatro-barras).
  https://github.com/gabemorris12/mechanism

## 🌐 4. DOMINIO PÚBLICO (sin restricciones)

- **NASA 3D Resources** · dominio público · naves, planetas, asteroides, hardware espacial.
  https://nasa.github.io/NASA-3D-Resources/ · repo: https://github.com/nasa/NASA-3D-Resources
- **507 Mechanical Movements** y **KMODDL** (arriba) — educativos / dominio público.

## 🖨️ 5. MALLA (3D-print) — referencia visual, no B-Rep editable

- **Printables (Prusa)** · CC por-modelo · https://printables.com
- **Thingiverse** · CC por-modelo (revisar cada uno) · https://thingiverse.com
- **MyMiniFactory** · mixto · https://myminifactory.com

## ⚠️ 6. CUIDADO: "gratis" ≠ "open-source"

- **GrabCAD** — millones de modelos *descargables gratis*, PERO bajo licencia GrabCAD **restrictiva**
  (no es CC/OSHW; uso comercial/redistribución limitados). Úsalo solo de **referencia para medir**, no como
  fuente open. Igual con TurboSquid/CGTrader/Cults (mixto, casi nunca open real).

---

## Plan de integración a La Forja
1. **Feed STEP → biblioteca**: jalar engranes/rodamientos/servos de **step.parts** (MIT) → `importSTEP` →
   guardar como piezas de la biblioteca → usarlas de **componentes** en ensambles. *(El multiplicador inmediato.)*
2. **Mecanismos educativos**: recrear los de **507 Movements / KMODDL** en La Forja (linkages, levas) — material
   de enseñanza gratis y de dominio público, alineado a la misión LATAM.
3. **Robots**: **Thor** (CC-BY-SA, FreeCAD→STEP) y **MOVEO** como ensambles-demo educativos.
4. **Licencias**: preferir **dominio público / MIT / CC-BY / GPL** para uso libre; marcar **CC-BY-NC** (InMoov)
   como NO comercial. Siempre conservar **atribución** donde la licencia lo pida.

# Competencia y mercado — módulo AERO de La Forja

**Fecha del análisis:** 4 de agosto de 2026 · **Para:** La Forja (CAD conceptual en navegador, React + R3F + OCCT-WASM)
**Encargo:** inteligencia de mercado para el pliego AERO · **Español mexicano**

> **Regla de este documento: cero cifras inventadas.** Cada precio, velocidad, cliente y ronda de
> capital lleva su URL. Cuando un dato no se pudo verificar, dice **NO VERIFICADO** con esas letras.
> Si una empresa no publica precios, este documento dice que no los publica — no inventa un rango.

---

## RESUMEN EJECUTIVO — las doce cosas que hay que saber

1. **El eje de la competencia cambió.** De 2023 a 2026 el mercado dejó de competir por *modelos
   físicos* y pasó a competir por *tiempo hasta la respuesta*. Hay dos olas distintas y la prensa las
   confunde: **solver nativo en GPU** (misma física, 10–100× más rápido) y **sustituto neuronal**
   (no resuelve nada, interpola un campo aprendido; 1000×+ pero solo dentro de su distribución).

2. **La ventaja "GPU" ya se está cerrando.** Los legados la copiaron en dos años: un A100 supera a
   80 cores Xeon por >5× en Fluent, y 8 A100 dan >30×; STAR-CCM+ reporta 25× con 8 H100. La
   diferencia estructural entre Flow360 y Fluent en 2026 es mucho menor que en 2023.

3. **El dinero está en la ola de ML, y es dinero grande.** PhysicsX: $300M Serie C a $2.4B de
   valuación (junio 2026). Neural Concept: $100M Serie C con Goldman Sachs (diciembre 2025).
   Luminary Cloud: $72M Serie B (septiembre 2025), ~$187M totales. Emmi AI la compró Mistral en mayo
   2026. Navasto la compró Autodesk en diciembre 2024. Ansys la compró Synopsys por $35 mil millones
   (cierre 17 de julio de 2025). El sector se está consolidando a toda velocidad.

4. **Casi ninguno publica precios — pero los que sí, dan la vara.** La excepción es **Siemens**, que
   vende STAR-CCM+ en su propia tienda: **US$29,165.76/año** el asiento base de 1 core y
   **US$56,190/año** el Power Session de cores ilimitados. Lo que se paga de verdad, según usuarios:
   **35–50 k€** (descuento de 15–40%). Ansys es quote-only pero su partner publica un rango de
   **"$10k–$50k"**, y hay contratos federales de STAR-CCM+ adjudicados por **US$503,233**.
   COMSOL CFD Module: **€5,343** perpetua (lista académica). Todo lo demás —CATIA, XFlow, PowerFLOW,
   Fidelity, Cradle, Altair, y las siete empresas de Physics AI— es opaco. **La opacidad es la
   característica estructural del mercado**, y un producto que publique precio sin exigir demo tiene
   una ventaja de fricción que ellos no pueden copiar sin canibalizar su canal.

4b. **El sector se consolidó en 24 meses y quedó irreconocible.** Synopsys cerró la compra de **Ansys
   por US$35,000 M el 17-jul-2025**. Siemens cerró la de **Altair por ~US$10,000 M el 26-mar-2025** —
   y al 4-ago-2026 **la marca Altair ya no existe**: todo `altair.com` redirige a Siemens y los
   productos salen como Simcenter HyperMesh / Inspire / PhysicsAI. Cadence pasó de cero a
   consolidador: NUMECA (2021), Pointwise (2021, no 2022), BETA CAE (US$1,240 M, 2024) y **Hexagon
   D&E con MSC y Cradle CFD por €2,700 M, cerrada el 23-feb-2026**. **En cada absorción, el producto
   de nicho —el que servía al diseño conceptual— pierde prioridad. Eso abre espacio abajo.**

4c. **La era de cobrar por core se está acabando.** Ansys lanzó **CFD HPC Ultimate en feb-2025**
   ("cualquier número de cores y GPUs, sin HPC Packs adicionales"): copió el Power Session de
   Siemens. Dassault y Altair convergieron a curvas cóncavas. COMSOL ya no limita nodos de cómputo.
   **Ojo estratégico: "el software es caro por core" dejará de ser un argumento de venta nuestro.**

5. **El surrogate se despeina en transónico.** El modelo abierto SHIFT-Wing de Luminary/Otto/NVIDIA
   pasa de 1.26% de error mediano en CM a Mach 0.50 a **5.30% a Mach 0.85**. No es un defecto de
   ellos: es la naturaleza del método. Argumento honesto para el cliente: **el surrogate es lupa
   para explorar, no juez para certificar.**

6. **Aero 3D en el cliente está literalmente vacío, y lo puedo probar.** Búsquedas contra la API de
   GitHub el 4-ago-2026: `vortex lattice` top 20 por estrellas → **cero repos en JavaScript,
   TypeScript o WASM** (todo es MATLAB, Python, Julia, C++, C#, VB.NET y Fortran).
   `aerodynamics --language JavaScript` → el máximo tiene **9 estrellas**. `webgpu cfd` → **un
   resultado, 0 estrellas**. **La técnica base del diseño conceptual de aeronaves nunca ha sido
   portada a la web.**

7. **Pero el 2D ya se cerró, y hay que decirlo.** El **17 de marzo de 2026**, Flexcompute —la empresa
   de Flow360— publicó **FlexFoil**: XFOIL reimplementado en **Rust → WASM, 100% del lado del
   cliente**, con meta de 60 Hz y bundle <500 KB, y vendido con *nuestro* argumento ("tus datos nunca
   salen de tu navegador"). No construyamos otro XFOIL web: esa ventana se cerró.

8. **NeuralFoil sigue siendo el atajo accionable.** Surrogate de XFOIL, licencia MIT, NumPy puro,
   1.4 ms por evaluación contra 73 ms de XFOIL, error medio de arrastre de 0.37%. **Verificado: no
   tiene export a ONNX ni puerto a JS.** Y el detalle competitivo: `aircraftdesign.io` **ya lo usa,
   pero del lado del servidor**.

9. **RDS-Professional, el software de nuestro propio cliente, cuesta US$23,900** la primera copia +
   US$2,800/año de soporte — y su licencia **prohíbe contractualmente usarlo para diseño real**
   (*"may not be used for final design or analysis of… actual aircraft"*). Es una app de 32 bits con
   herencia DOS, activación manual por correo, sin API y sin comunidad pública.

10. **XFLR5 murió el 30 de junio de 2026.** La herramienta de entrada de estudiantes y aficionados
    cerró hace cinco semanas. Su sucesor flow5 es un proyecto de una persona con API "experimental
    hasta fin de 2026". **Hay una generación de usuarios sin casa.**

11. **El hueco del cliente está documentado en literatura arbitrada, no solo en la cita de Raymer.**
    Una revisión crítica de 2024 sobre todo el catálogo de herramientas de diseño conceptual concluye
    que *"None covers all the aspects of the conceptual and preliminary design process"* y que
    *"No design tools have configurational optimization capability"*.

12. **Advertencia:** Ondsel —CAD en el navegador— **cerró el 22 de noviembre de 2024** por no
    encontrar adopción comercial. Un CAD generalista en el navegador ya fracasó. Lo que nos salva es
    la vertical, el cliente que paga, y la aero acoplada como razón para pagar.

---

## A. LOS GRATUITOS / OPEN SOURCE — la base de comparación

### A.0 Las cinco noticias que cambian el mapa

1. **XFLR5 MURIÓ.** Declaración textual en el sitio oficial: *"The xflr5 project has has been closed
   on **June 30th, 2026**. There will be no new releases nor code updates."* Su sucesor **flow5** se
   liberó open source el **1-ene-2026** ([flow5.tech](https://www.flow5.tech/xflr5/xflr5.html),
   [repo](https://github.com/techwinder/flow5) — GPL-3.0, 213 ⭐, API todavía "experimental hasta fin
   de 2026"). **La herramienta de entrada de estudiantes y aficionados se quedó sin casa hace cinco
   semanas.**
2. **XFOIL despertó tras 12 años.** Drela publicó **6.996 el 1-ene-2026**, después de que 6.99 fuera
   de diciembre de 2013 — pero **solo en fuente/binario Unix**; el binario de Windows sigue siendo el
   de 2013 y el manual sigue fechado **30 de noviembre de 2001**.
3. **RDS-Professional, el software de nuestro cliente, cuesta $23,900 USD** la primera copia — y su
   licencia **prohíbe contractualmente usarlo para diseño real**.
4. **El autor de XFLR5 escribió, en documento oficial:** *"Whatever the flow conditions, do not
   expect accuracy of xflr5 results."*
5. **Ningún código libre cubre el flujo completo de diseño conceptual.** Eso es exactamente lo que
   RDS vende por $23,900.

### A.1 Tabla comparativa

| Herramienta | Método | Qué NO hace (límite duro) | Edad del código / última versión | Licencia | Queja #1 | Fuente |
|---|---|---|---|---|---|---|
| **XFOIL** | Paneles de vorticidad lineal + capa límite integral de 2 ec. acoplada por Newton + transición e^N + Kármán-Tsien | Post-stall real; transónico (>M 1.05 local "no confiar"); 3D; multi-elemento | **Fortran 77 fijo**, 40,762 líneas en `src/`, **574 `GO TO`**, `PARAMETER IQX=601`. v6.99 dic-2013 → **v6.996 1-ene-2026 (solo Unix)**; manual de **2001** | **GPL v2+** | **No converge y se cuelga**: *"every non-convergence freezes the Xfoil window"* | [MIT](https://web.mit.edu/drela/Public/web/xfoil/) · [hilo](https://groups.google.com/g/machup_forum/c/n_Spd2w-7D0) |
| **XFLR5** | XFOIL portado a C++ (2D) + LLT no lineal / VLM / paneles 3D | Sin lazo viscoso en 3D; estela plana (1–10% de error en L y Di); compresible; fuselajes (*"do not include the fuselage"*) | C++/Qt. v6.62 24-mar-2026. **PROYECTO CERRADO 30-jun-2026** | GPL-3.0 | **No converge donde XFOIL sí** — y el autor dice que no esperes precisión | [SourceForge](https://sourceforge.net/projects/xflr5/files/) · [flow5.tech](https://www.flow5.tech/xflr5/xflr5.html) |
| **AVL** | Vortex lattice extendido (herradura, estela ‖ x) + slender body para fuselajes + Prandtl-Glauert | **Viscoso real** (solo la polar CD(CL) que TÚ le das); stall; transónico (*"PG hopeless"* en M 0.8–0.9); α y β grandes | Fortran + C, requiere **X11**. v3.52 **sep-2025**; el manual sigue siendo el de **AVL 3.36 (2014)** | **GPL** | Sin viscoso ni stall, y el deck de entrada es texto a mano + dependencia de X11/XQuartz | [MIT AVL](https://web.mit.edu/drela/Public/web/avl/) · [version_notes](https://web.mit.edu/drela/Public/web/avl/version_notes.txt) |
| **OpenVSP** | Geometría paramétrica por componentes (**no B-Rep**) + CFDMesh/FEAMesh + wave drag + build-up de drag parásito | No es CAD (sin sólidos B-Rep); sin estructuras reales; sin física propia salvo VSPAERO | C/C++. **v3.51.2, 26-jul-2026**; repo desde 2012, muy activo, 819 ⭐ | **NASA Open Source Agreement v1.3** (LAR-17916-1) — **incompatible con GPL** | **VSPAERO no cuadra con datos de túnel**; el tutorial oficial dice *"under construction"* desde **29-jun-2015** | [CHANGELOG](https://github.com/OpenVSP/OpenVSP/blob/main/CHANGELOG.md) · [LICENSE](https://raw.githubusercontent.com/OpenVSP/OpenVSP/main/LICENSE) |
| **VSPAERO** | VLM lineal + discos actuadores + modo paneles + supersónico linealizado; fricción por placa plana | Cp de superficie en modo VLM (solo ΔCp); CD0 *"handbook-style"*; borde de fuga romo revienta el solver | Dentro de OpenVSP; autor original David Kinney (NASA Ames) | NOSA | **La escala y la geometría rompen la solución; NaNs y crashes** | [hilo](https://groups.google.com/g/openvsp/c/9UP6htxR6YI/m/eJ1wa8CjpAgJ) · [issue #65](https://github.com/OpenVSP/OpenVSP/issues/65) |
| **SU2** | FVM no estructurado; Euler/NS/**RANS** (SA, SST); **adjunto continuo y discreto (AD)** para optimización de forma | No trae mallador ni GUI; sin curva de validación oficial exhaustiva | C++ (13 MB) + Python. **v8.5.0 "Harrier", 27-abr-2026**; repo desde 2013, 1,768 ⭐, **106 issues abiertos** | **LGPL v2.1** ← **limpia para producto comercial** | *"being research codes they can be difficult to learn and sometimes even compile and get running"* | [releases](https://github.com/su2code/SU2/releases) · [HN](https://news.ycombinator.com/item?id=48900337) |
| **OpenFOAM** | FVM colocado en C++ templatizado; semi-implícito (SIMPLE/PISO/PIMPLE); RANS/LES/DNS/multifase | GUI nativa; mallado de capa límite decente; compatibilidad entre sus **3 forks incompatibles** | **v14 Foundation 14-jul-2026** · **v2606 ESI/Keysight** · foam-extend. Primer release 10-dic-2004 | GPL-3.0 | **Curva de aprendizaje brutal + documentación inútil**: *"OpenFOAM's documentation may as well not exist. It is useless."* | [openfoam.org](https://openfoam.org/download/) · [cfd.university](https://cfd.university/blog/learn-openfoam-the-good-the-bad-and-the-evil/) |
| **Digital DATCOM** | Build-up por componentes con tablas empíricas del handbook USAF (secc. 4–7) | **No tiene timón** (¡sin rudder!); máximo 2 superficies sustentadoras (no canard+ala+cola); entradas/stores/protuberancias; derivadas dinámicas con alas no rectas-cónicas | **FORTRAN IV.** Iniciado feb-1976, terminado nov-1978, reporte nov-1979 (AFFDL-TR-79-3032). **Sin soporte de la USAF** | **Dominio público** | Namelists de FORTRAN en un archivo que **debe llamarse `FOR005.DAT`**, salida de **132 columnas**; la precisión *"se cae rápido al aumentar α"* | [Wikipedia](https://en.wikipedia.org/wiki/United_States_Air_Force_Stability_and_Control_Digital_DATCOM) · [PDAS](https://www.pdas.com/datcom.html) |
| **RDS-Professional** | Métodos clásicos del libro de Raymer + CAD propio + **MDO de 8 variables** | **Prohibido por licencia para diseño final**; sin CFD; sin viscoso real; **Windows 32 bits** | ~88,000 líneas (paper 2016) → *"over 120,000"* (web 2026). **App de 32 bits**, predecesor DOS. **Versión 14, "Updated 1-2025"** | **Propietaria, $23,900** | El precio y el candado legal. **No existe foro ni issue tracker público** | [pricing](https://aircraftdesign.com/rdswin-pro-pricing/) · [AIAA-2016-1277](https://aircraftdesign.com/wp-content/uploads/2024/04/Raymer-ASM2016-AIAApaper-RDSwin.pdf) |
| **SUAVE** | Multi-fidelidad en Python | — | **Último commit en master: 23-dic-2022.** Sunset en favor de RCAIDE | LGPL-2.1, 523 ⭐ | Abandonado | [GitHub](https://github.com/suavecode/SUAVE) |
| **RCAIDE** | Sucesor de SUAVE; backend opcional de diferenciación automática en GPU | Muy joven | Repo creado 27-sep-2023, push **3-ago-2026** (activo), 29 ⭐ | **AGPL-3.0** ← **mata cualquier SaaS propietario** | Poca base instalada | [GitHub](https://github.com/leadsgroup/RCAIDE_LEADS) |
| **MachUpX** | Lifting-line numérica de Phillips + correcciones de Reid/Hunsaker para flecha | Flujo potencial; fuselajes gruesos; stall real | Python, último commit **23-may-2024**, 135 ⭐ | **MIT** | *"Poor Nonlinear Convergence"* es una sección propia de su documentación | [docs](https://machupx.readthedocs.io/en/latest/introduction.html) |
| **AeroSandbox** | Optimización con AD (CasADi) + VLM/paneles + surrogates NN (NeuralFoil) | No es CFD; no viscoso de alta fidelidad | Python, **1,291 ⭐**, push **5-jul-2026** | **MIT** | *"the code is pretty obviously written for people who know their way around aerodynamics and not so much around programming"* | [HN](https://news.ycombinator.com/item?id=46799442) |
| **FlightStream** | Solver de vorticidad sobre malla de superficie no estructurada (*"panel methods, reimagined"*) | Comercial | **Adquirido por Altair el 1-may-2024**. 800+ licencias/año, 70+ clientes | Propietaria | **Precio no publicado** | [researchinflight.com](http://researchinflight.com) |
| **Tornado VLM** | VLM en MATLAB | Viscoso, stall, compresible más allá de PG | Changelog último **19-ago-2021**; **sitio caído al 4-ago-2026** | GPL v2+ **pero exige MATLAB propietario** | Sitio muerto + dependencia de MATLAB | [archive.org](http://web.archive.org/web/2023/http://tornado.redhammer.se/) |
| **PANUKL** | Método de paneles (Politécnica de Varsovia) | — | **NO VERIFICADO** | **NO VERIFICADO** | — | Páginas oficiales dan 404, sin snapshot en Wayback |

### A.2 XFOIL — el abuelo que sigue vivo, y sus 574 GOTOs

**Lo que hace, en palabras de Drela** (`xfoil_doc.txt`): *"Viscous (or inviscid) analysis of an
existing airfoil, allowing forced or free transition, transitional separation bubble(s), **limited
trailing edge separation**, **lift and drag predictions just beyond CLmax**, Karman-Tsien
compressibility correction."*

**Lo que NO hace, también en sus palabras:**
- Post-stall: *"The effect of this approximation… will be felt mainly **near or past stall, where
  accuracy tends to degrade anyway**."*
- Transónico: *"One should always be wary of trusting solutions which show regions of supersonic
  flow… **As a rule of thumb, if the maximum Mach number doesn't exceed 1.05 anywhere**, shock losses
  will be very small."*
- No guarda solo: *"Saving of the data to files is NOT normally performed automatically."*

**Métricas del código, medidas sobre `xfoil6.996.tgz`:**

| Métrica | Valor |
|---|---|
| Líneas Fortran en `src/` | **40,762** (55,083 con la librería de plot) |
| Sentencias `GO TO` | **574** |
| Bloques `COMMON` en `XFOIL.INC` | 29 |
| Límite de paneles | `PARAMETER (IQX=601, IPX=5, ISX=2)` — hard-coded |
| Estilo | Fortran fijo (F77), comentarios con `C` en columna 1 |

Y del propio `version_notes.txt` de la 6.996: *"Changed **computed goto's (1980's leftovers)** to
equivalent if-then-else logic"*.

**La queja #1 documentada** — foro MachUp (Google Groups), Lucas, 21-abr-2021:
> *"Some values will not converge as I saw in XFLR5 but XFLR5 doesn't get stuck by that"* …
> *"using AirfoilDatabase **every non-convergence freezes the Xfoil window** and the program is [stuck]"*

Respuesta del desarrollador (Cory, 22-abr-2021): *"if execution fails at any point, whatever has yet
to be computed just gets forgotten."*
([hilo](https://groups.google.com/g/machup_forum/c/n_Spd2w-7D0))

**Queja #2 — portabilidad.** HN, `addaon`, 28-mar-2026: *"There's a bunch of old Fortran stuff I use
regularly (AVL, XFoil), but that's all X, not Wayland, and XQuartz has worked great for decades."*
([HN](https://news.ycombinator.com/item?id=47556512))

**Señal de mercado.** Alguien ya lo portó a JS con IA: HN, `argon`, 15-ene-2026 — *"This is a
numerically faithful port of the XFOIL airfoil analysis code from the original FORTRAN to an
interactive Javascript web app. This was **vibe-ported in a weekend with Codex**."* (vibefoil.com;
1 punto, sin tracción — [HN](https://news.ycombinator.com/item?id=46629156)). El hecho de que ya haya
tres intentos independientes de llevar XFOIL a la web en 2026 (vibefoil, WebXFOIL, FlexFoil) dice que
la necesidad es real y que **la ventana en 2D ya se cerró**.

### A.3 XFLR5 — el testamento del autor

André Deperrois publicó *"Part IV — Theoretical limitations and shortcomings of xflr5"*
([PDF](https://flow5.tech/xflr5/docs/Part%20IV:%20Limitations.pdf)). Sus propias palabras:

- **Sin lazo viscoso en 3D:** *"The IBL loop is not implemented"* en los métodos de paneles → la
  sustentación sale **lineal** con α. Muestra 20% de diferencia en CL a α=4° entre LLT y paneles para
  un Clark-Y.
- **Drag viscoso:** *"The VLM and 3d method merely interpolate 2d viscous drag from local wing
  lift"* → *"viscous drag estimation is **an order of magnitude, at best**"* → *"**Main consequence:
  Underestimation of total drag and over-estimation of glide ratio**."*
- **Fuselaje:** *"**Do not include the fuselage in the analysis**."*
- **Estela plana:** *"for a stand-alone wing, the error can be in the order of magnitude of **1 to
  10% for the lift and induced drag**."*
- **Y el cierre:** *"**Whatever the flow conditions, do not expect accuracy of xflr5 results.**
  … Use xflr5 to get orders of magnitude, trends, and to understand sensitivity to design
  parameters."*

**La queja #1** — SourceForge, Libby, 23-ene-2018: *"at relatively low Reynolds numbers, the analysis
stops converging at moderate angles of attack… except that when I load the same airfoil into XFOIL
and run the same analysis, it **does** converge."* Respuesta del autor: *"The two codes have their
engines written and compiled in different languages: **Fortran for the original XFoil and C++ for
xflr5**. The two frameworks don't handle floating point numbers in exactly the same way."*
([hilo](https://sourceforge.net/p/xflr5/discussion/679396/thread/1cdd3981/))

### A.4 AVL — la tabla de vergüenza del Prandtl-Glauert

Del User Primer, §3, textual: *"Like any computational method, AVL has limitations on what it can
do."*

| Mach | Veredicto del propio autor |
|---|---|
| 0.0–0.5 | PG expected valid |
| 0.6 | **"PG suspect (transonic flow likely)"** |
| 0.7 | **"PG unreliable (transonic flow certain)"** |
| 0.8–0.9 | **"PG hopeless"** |

Y sobre cuerpos: *"the experience with this model is relatively limited, and hence **modeling of
bodies should be done with caution**. If a fuselage is expected to have little influence on the
aerodynamic loads, it's simplest to just leave it out of the AVL model."*

Sobre viscoso: **no hay**. Solo puedes darle a mano una polar `CD(CL)` por sección con 6 pares de
puntos. No predice CLmax; el primer avisa que `clT` como indicador de stall *"is probably
meaningless"* en ciertas configuraciones.

**La documentación va 16 versiones atrás:** el PDF oficial se titula *"MIT AVL User Primer — AVL
3.36"*, y 3.36 es de **mayo de 2014**. El código va en 3.52 (sep-2025).

El veredicto experto que mejor resume el campo, de aviation.stackexchange (19-mar-2023, 6 votos):
> *"AVL, XFLR5, and VSPAERO use fundamentally similar techniques — i.e. they basically amount to a
> **thin-surface vortex lattice potential flow code**. XFLR5 is essentially **AVL with a boundary
> layer model added on**. **The most important difference between the tools is how easy it is to
> build the input model.**"*
> ([hilo](https://aviation.stackexchange.com/questions/98220/xflr5-vs-avl-vs-datcom-vs-openvsp))

**Léelo otra vez: la diferencia que importa entre las tres herramientas del oficio no es la física.
Es lo fácil que sea armar el modelo de entrada.** Eso es exactamente el problema que resuelve un CAD
paramétrico con croquis acotado. Es nuestra tesis, dicha por un tercero.

### A.5 OpenVSP — el más vivo, y el que peor documenta

**Actividad real:** v3.51.2 (26-jul-2026), y antes 3.51.1 (18-jul), 3.51.0 (29-jun), 3.50.5 (5-jun),
3.50.3 (15-may). Es esencialmente el proyecto de una persona (Rob McDonald) con contribuciones; el
changelog está escrito en primera persona, incluyendo *"there are probably bugs that only I would
ever run into — but I ran into them, so they get fixed."*

**Licencia:** NASA Open Source Agreement v1.3, con *"User Registration Requested"*. GitHub la
clasifica como `NOASSERTION / Other`. **Nota práctica: NOSA es aprobada por OSI pero incompatible
con GPL**, lo que complica mezclar OpenVSP con XFOIL/AVL/OpenFOAM en un producto derivado.

**Queja #1 — VSPAERO no cuadra con el túnel.** Google Group, Peter Conway, 13-ene-2022:
> *"**The aerodynamic coefficients as well as longitudinal stability derivatives that I'm getting
> from VSP Aero do not seem to line up with experimental values at all**"*

Respuesta de Rob McDonald el mismo día: *"At a minimum, you need to increase the spanwise resolution
of your wing components. You'll probably want about **20 spanwise elements**…"*
([hilo](https://groups.google.com/g/openvsp/c/-0JJcxZXW2I)). El default de fábrica es **6**.

**Queja #2 — el solver revienta con geometría normal.** Hilo "VSPAero: Panel Method Crashing",
22-mar-2022. Rob McDonald: *"you're trying to run in VLM mode and have a fuselage with rounded
rectangle XSecs. **Unfortunately, that causes problems.**"* Brandon Litherland: *"With Panel method,
**blunt TE or any 'vertical' aft-facing surface will crash the solver**."*
([hilo](https://groups.google.com/g/openvsp/c/yNg65ULetsI))

**Queja #3 — la escala del modelo cambia la respuesta.** GitHub issue #65, 22-sep-2016: *"**There is
a scale dependence on the VSPAERO solution, small scale geometry returns invalid results.**"*
([issue](https://github.com/OpenVSP/OpenVSP/issues/65))

**Queja #4 — documentación congelada.** El tutorial oficial de VSPAERO sigue encabezado con:
*"**June 29, 2015**: A new tutorial is under construction and will be updated to include the
operation with OpenVSP 3.x.x."* — **once años "under construction"** mientras el código va en 3.51.2.
([wiki](https://openvsp.org/wiki/doku.php?id=vspaerotutorial))

**Y lo que los propios devs dicen que VSPAERO no puede** (Rob McDonald, 6-may-2015):
*"**The thin surface representation leaves you with only a delta Cp.** That means you can get lift and
induced drag, but **you don't get surface velocities / Cp**."* · *"**The CD_0 calculated by VSPAERO is
extremely simple… based on a handbook-style form drag buildup.**"*
([hilo](https://groups.google.com/g/openvsp/c/9UP6htxR6YI/m/eJ1wa8CjpAgJ))

### A.6 SU2 y OpenFOAM — el escalón de alta fidelidad

**SU2** (LGPL-2.1, v8.5.0 "Harrier" 27-abr-2026, 1,768 ⭐, 106 issues abiertos). Su diferenciador real
es el **adjunto**: gradiente completo respecto a cientos de variables de diseño en un solo run.

- **Queja #1:** HN, `precsim`, 13-jul-2026 — *"being research codes they can be difficult to learn
  and sometimes even compile and get running"* ([HN](https://news.ycombinator.com/item?id=48900337)).
  Lo confirman sus issues más comentados: casi todos son de build/instalación/restart, no de física.
- **Regresión seria abierta:** issue **#2390, abierto desde 4-dic-2024**, *"Symmetry BC not working
  (perfectly)"*. Una condición de frontera elemental, rota más de año y medio
  ([issue](https://github.com/su2code/SU2/issues/2390)).

**OpenFOAM** (GPL-3.0). El problema estructural son **tres forks incompatibles**: Foundation (v14,
14-jul-2026), ESI/Keysight (v2606, jun-2026) y foam-extend.

- **La queja #1 es el consenso de la industria.** Tom-Robin Teschner (cfd.university): *"**OpenFOAM's
  documentation may as well not exist. It is useless.**"* · un caso básico de perfil requiere *"700
  lines of code spread over 13 different files"* · sobre los forks: *"**if you look up the syntax for
  one version, it may or may not work in another**"* · *"**I am still not sure if there is any
  software testing going on at OpenFOAM HQ.**"* · sobre mallado de capa límite: *"**OpenFOAM's
  capability is really poor**"*
  ([cfd.university](https://cfd.university/blog/learn-openfoam-the-good-the-bad-and-the-evil/)).
- Usuarios verificados en Capterra (11 reseñas, 4.6/5): *"The learning curve is very slow"* ·
  *"**Not up-to-date documentation, not very thorough performance documentation, undocumented
  stuff**"* · *"The absence of a GUI is consistently seen as one of OpenFOAM's worst drawbacks"*
  ([Capterra](https://www.capterra.com/p/228637/OpenFOAM/reviews/)).
- **Dato de salud del ecosistema abierto**, banner activo en openfoam.org al 4-ago-2026:
  *"Supporting organisations currently provide **€250k** for maintenance of OpenFOAM, i.e. of the
  order of **0.1% of the revenue of big commercial CFD**. **This current total is inadequate.**"*
  El CFD open source más usado del mundo se mantiene con un cuarto de millón de euros al año.

### A.7 Digital DATCOM — FORTRAN IV de 1978, y no tiene timón

Trabajo iniciado **febrero de 1976**, concluido **noviembre de 1978**, reporte AFFDL-TR-79-3032 de
noviembre de 1979, ejecutado por McDonnell Douglas para la USAF. *"The program is written in FORTRAN
IV and has since been updated; however, **the core of the program remains the same**."* Y: *"Digital
DATCOM **is no longer supported by the USAF** and is now public domain software."*

**Límites duros, textuales:**
- *"Inlets, external stores, and other protuberances cannot be input because Digital DATCOM analyzes
  the **fuselage as a body of revolution**."*
- *"There is no method to input **twin vertical tails** mounted on the fuselage."*
- *"**Digital DATCOM cannot provide outputs for the control derivatives with regard to the rudder
  control surface.** According to the manual, there is no any input parameters which define the
  geometry of rudder."* ← **no tiene timón, en 2026.**
- *"Digital DATCOM cannot analyze **three lifting surfaces at once**, such as a canard-wing-horizontal
  tail configuration."*
- Precisión: *"Raw results provide good correlation with wind tunnel data at very low angles of
  attack, but **accuracy deteriorates rapidly as the angle of attack increases**."*

**La queja #1 es la ergonomía de 1979:** el input son namelists de FORTRAN en un archivo que **tiene
que llamarse `FOR005.DAT`**, y la salida es texto de **132 columnas** *"not easily imported into
another application"*. Veredicto experto (aviation.SE, 19-mar-2023): *"**DATCOM is a very different
world**… if you're classically using the paper copy of DATCOM, **it is a laborious process to get a
full set of results**."* Y la propia Wikipedia concluye: *"**Digital DATCOM may seem antiquated**."*
([Wikipedia](https://en.wikipedia.org/wiki/United_States_Air_Force_Stability_and_Control_Digital_DATCOM))

### A.8 RDS-Professional — el software de nuestro cliente, con precio y candado

#### El precio (verificado, literal)

> *"PRICE AND TERMS: RDSwin-Professional is distributed by **Conceptual Research Corporation** on a
> one-time-fee permanent license basis."*

| Concepto | Precio |
|---|---|
| **Licencia permanente, copia inicial** | **$23,900** |
| Copias adicionales | **$9,900** |
| Upgrades mayores | **25% del precio de licencia vigente** |
| Lease anual | **30% del precio de site license** (upgrades gratis) |
| Contrato de soporte | **$2,800/año** |
| Instalación y capacitación in situ | **$5,000** + viáticos (CONUS) |
| Shipping/handling | +$80 · Impuesto CA +9.5% |
| Fee de procesamiento (papeleo extra, alta en tu sistema financiero, o pago que no sea cheque validado/transferencia) | **+$500** |
| Tarjeta de crédito | **+5% "convenience fee"** |

Fuente literal: [aircraftdesign.com/rdswin-pro-pricing](https://aircraftdesign.com/rdswin-pro-pricing/)

#### El candado legal (más importante que el precio)

Cláusula 2 del acuerdo de licencia, textual:
> *"This software is licensed **SOLELY for use in aircraft conceptual design**, and **may not be used
> for final design or analysis of existing, modified, or new actual aircraft**, including but not
> limited to the prediction of aerodynamic, weight, propulsion, stability, cost, range, and
> performance characteristics. **No data produced by this software may be used for prediction of
> flight characteristics of actual aircraft.**"*

Cláusula 1 — la única garantía es que **arranca**:
> *"…warrants the program **only to be free of material or logical defects that would prevent loading
> the software** onto the user's Windows-based computer system and running the program."*

Cláusula 4: *"**RDS was developed without government funds at private expense** and in all respects
is proprietary data copyrighted solely to Daniel P. Raymer."*

#### Arquitectura, tamaño y deuda técnica

- **~88,000 líneas** de código original (paper AIAA-2016-1277 del propio Raymer) → *"over 120,000
  lines"* según la web en 2026. Interfaz: *"a single pulldown menu with **551 menu and submenu
  commands**"* → *"over 600"* hoy.
- **MDO real:** *"simultaneously optimizes for eight key variables: T/W, W/S, aspect ratio, sweep,
  taper ratio, wing thickness, fuselage fineness ratio, and wing design lift coefficient."*
- *"**RDSwin and its DOS predecessor** have been used to design and/or analyze a wide variety of
  vehicles for organizations including DARPA, RAND, USAF-AFRL, NASA, Boeing, and Composite
  Engineering."*
- **Fracaso técnico documentado por el propio autor:** intentó usar HTML Forms + Java para la entrada;
  un upgrade de Windows cambió dónde se guardaban los datos y todo dejó de funcionar. Textual:
  *"This seemed too risky, so **those ~5,000 lines of code were thrown away**."*
- De su propio FAQ ([tips-tricks-and-faqs](https://aircraftdesign.com/rdswin-tips-tricks-and-faqs/)):
  **"RDSwin is a 32-bit application"**, probado en Windows 7, 8 y 10 (**ninguna mención de Windows
  11**); bug de layout en Win10 con *"**gray areas below and to the right**"*; activación **manual por
  correo electrónico** con un humano del otro lado; el antivirus lo bloquea; formatos propietarios
  `.RTD`/`.DAF`/`.DAA`; y la página **todavía enlaza a "old RDS-DOS tips and tricks"**.
- **Lenguaje de programación: NO VERIFICADO.** No aparece ni en el sitio ni en el paper AIAA.

#### Base instalada y ausencia de comunidad

La página de usuarios lista ~35 empresas (Boeing Australia, BAE Systems UK, Northrop Grumman,
Lockheed Martin Georgia, General Atomics, Scaled Composites, Israel Aircraft Industries, Mitsubishi
Heavy Industry, SAAB, de Havilland Canada, New Piper, RAND, Honeywell, Kratos…), 19 organismos de
gobierno y 8 universidades. **No hay ni una sola cita de usuario en toda la página.**

> **Advertencia de honestidad:** **no encontré ni un solo hilo público de quejas de usuarios de
> RDS.** No hay repo, ni issue tracker, ni foro, ni Google Group. **Ese vacío es en sí mismo el
> hallazgo:** un producto de $23,900 cuya retroalimentación de usuario, si existe, es un correo
> privado a Raymer. (Reddit, eng-tips y cfd-online bloquearon al investigador, así que tampoco puedo
> descartar que existan en esos foros.)

**RDS-Student** se vende por AIAA junto con el libro (7ª ed., 2024); el sitio lo describe como
*"fairly cheap, priced for students"*, prohíbe uso comercial y prohíbe instalarlo en *"multi-user or
class laboratory computers"*. **Precio actual: NO VERIFICADO** (arc.aiaa.org devolvió 403). La página
de comparación lista **33 funciones exclusivas de Pro**, incluyendo exportación IGES/DXF, carpet
plots automáticos, el MDO de 8 variables, trade studies automáticos, y el módulo de costo con curva
de aprendizaje.

### A.9 El competidor conceptual más peligroso: AeroSandbox

De todo el catálogo libre, **AeroSandbox** (Peter Sharpe, MIT) es el que más se parece a lo que
queremos ser: **MIT, 1,291 ⭐, push del 5-jul-2026**, y combina optimización con gradientes exactos
(CasADi) + VLM/paneles + surrogates neuronales (NeuralFoil). Ataca exactamente el nicho de "diseño
conceptual rápido" de RDS.

Su debilidad, dicha por un usuario en HN (28-ene-2026): *"**the code is pretty obviously written for
people who know their way around aerodynamics and not so much around programming**"* — y no tiene ni
CAD, ni interfaz, ni escuela, ni costo. Es una librería de Python. **Esa es la grieta por donde
entramos.**

### A.10 Lo que esta sección deja claro para la estrategia

1. **La queja transversal NO es la física — es la entrada y la convergencia.** XFOIL se cuelga cuando
   no converge. VSPAERO revienta con un fuselaje de esquinas redondeadas y sus defaults de fábrica no
   dan resultados usables. AVL pide un deck de texto. DATCOM pide namelists en `FOR005.DAT`.
   OpenFOAM pide 700 líneas en 13 archivos para un perfil. **Nadie se queja de las ecuaciones.**
2. **Todo el stack libre corre sobre Fortran 77 de los 80** (XFOIL, AVL) **o Fortran IV de 1978**
   (DATCOM): 574 GOTOs, límites de arreglo hard-coded, gráficos X11, y documentación entre 12 y 24
   años atrasada respecto al código.
3. **Ningún código libre cubre el flujo completo de diseño conceptual** (layout → aero → pesos →
   propulsión → sizing de misión → performance → costo → optimización). Lo único que se acerca en
   libre es RCAIDE (AGPL, 29 ⭐) y AeroSandbox (MIT, 1,291 ⭐, sin CAD ni costo).
4. **RDS es vulnerable por tres flancos a la vez:** precio ($23,900 + $2,800/año), el candado legal
   que prohíbe usarlo para diseño real, y la deuda técnica (32 bits, herencia DOS, activación por
   correo, sin API, sin comunidad, un solo autor). Su foso es la credibilidad del libro de Raymer y
   la base instalada de 35+ empresas aeroespaciales. **Ese foso es exactamente lo que el cliente nos
   está prestando.**
5. **Cuidado con las licencias si vamos a construir encima.** XFOIL / AVL / XFLR5 / flow5 / OpenFOAM
   son **GPL (viral)**. OpenVSP es **NOSA (incompatible con GPL)**. RCAIDE es **AGPL (mata el SaaS
   propietario)**. Los únicos limpios para un producto comercial son **SU2 (LGPL-2.1)**, **MachUpX
   (MIT)**, **AeroSandbox (MIT)** y **NeuralFoil (MIT)**.

---

## B. LOS GRANDES DE PAGA

> **Nota de método.** Los cinco grandes casi no publican precio. Lo que sí se pudo hacer —y es de
> donde salen los números duros de esta sección— fue ir a **fuentes primarias que no son listas de
> precios: las tiendas propias de los vendors, las APIs de contratación pública de EE.UU.
> (USAspending, FPDS) y del Reino Unido (Contracts Finder), y las tablas de precio académico que
> publican las universidades.** Ahí aparece lo que **realmente se paga**.
>
> Sitios que bloquearon al investigador (403): **cfd-online, G2, TrustRadius, eng-tips**. De
> cfd-online **no se extrajo ni una sola cita** — los hilos existen indexados pero no citamos lo que
> no pudimos leer. Reddit sí se leyó, vía `old.reddit.com`: las citas de r/CFD de abajo son reales.

### B.1 Tabla comparativa

| Producto | Qué hace | Modelo de licencia | Precio (con fuente) | Ciclo típico | Dolor #1 |
|---|---|---|---|---|---|
| **Ansys Fluent / CFX** | CFD general de volúmenes finitos, el estándar de facto | Suscripción o perpetua + ~20% mant.; **HPC Packs en escalones de 4×** | Quote-only. Partner oficial Ozen: **"$10k–$50k"** ([blog.ozeninc.com](https://blog.ozeninc.com/industry-applications/ansys-pricing)). Adjudicado UK: STFC RAL **£28,905.80**; NPL perpetua **£42,487.50** | 2.2 B celdas: **38.5 h → 1.5 h** en 1,024 GPU MI250X | **HPC Packs**: *"archaic and punishing"* |
| **Ansys Discovery** | CFD/FEA en GPU en tiempo real para exploración temprana | Suscripción, quote-only | **NO VERIFICADO** | Interactivo (segundos) | *"extremely limited without a 'full' ANSYS workbench license"* |
| **Ansys SimAI** | Surrogates de IA sobre tus propios resultados. En **2026 R1** se parte en **Pro** (GPU local) y **Premium SaaS** (datasets >15 TB) | Licencia Ansys | **NO VERIFICADO** | "10× a 100×" más variantes | Precio opaco |
| **Ansys Cloud Direct** | HPC gestionado sobre Azure | — | — | — | 🔴 **FIN DE VIDA: 31-dic-2025** ([foro oficial](https://innovationspace.ansys.com/forum/forums/topic/ansys-cloud-direct-end-of-life-as-of-31-dec-2025/)) |
| **Simcenter STAR-CCM+** | CFD flagship; rey del mallado automático | Suscripción; **Power Session = cores ILIMITADOS**; Power-on-Demand por hora | 🥇 **LISTA PÚBLICA**: base **US$29,165.76/año**; **Power Session US$56,190/año** ([dex.siemens.com SKU STAR1002](https://www.dex.siemens.com/ccrz__ProductDetails?sku=STAR1002)). Pagado real: **35–50 k€** | Avión CRM-HL **110 M celdas: 40 min en 24× A100** | Ventas que nunca devuelven la llamada; NDA que impide comparar |
| **Simcenter 3D / FLOEFD** | CAE integrado / CFD dentro del CAD | **Value-based licensing** (tokens) | Lista **NO VERIFICADO**. Adjudicado: Simcenter 3D **US$411,129** (US Army); FLOEFD **US$201,103** (USAF) | FLOEFD: mallado *"de días a horas"* | Sin precio público |
| **Cadence Fidelity CFD** (ex-Numeca + Pointwise) | CFD aero/turbo + el mejor mallado del mercado | **NO VERIFICADO** | Lista **NO VERIFICADO**. Adjudicado NASA: Pointwise **US$63,072** y **US$39,900**; FINE/Turbo ~**US$35k/año**. Millennium M2000 ≈ **US$2M** ⚠️ prensa única | **Millennium M1: airframe JSM 185 M celdas → 13.9 h** | Costo oculto de hardware; cero transparencia |
| **CATIA** | CAD aeronáutico estándar | Suscripción / plataforma | Lista **NO VERIFICADO** (3ds.com/store da 404). Usuario: **"hasta 100k al año"** ([HN](https://news.ycombinator.com/item?id=48299014)); otro: **"~$600/mes por usuario"** ([HN](https://news.ycombinator.com/item?id=48298048)) | — | Costo y complejidad; es CAD **de producción** — el problema exacto de Raymer §2.1.4 |
| **SOLIDWORKS Flow Simulation** | CFD embebido en el CAD | Perpetua + mant. obligatorio, o suscripción | 🥇 **US$2,435 – US$8,118** ([hawkridgesys.com](https://hawkridgesys.com/product/solidworks-flow-simulation)). Perpetua UE: **€6,300 + €1,824/año**, con 2 años de mantenimiento obligatorio ([OhMyCAD](https://ohmycad.com/en/official-price-list-3dexperience-solidworks/)) | — | Mantenimiento subió ~30%; multa por dejarlo caducar |
| **SIMULIA XFlow / PowerFLOW** | Lattice-Boltzmann para aero y aeroacústica | **SimUnit**: tokens + créditos por core-hora | **Quote-only confirmado.** Consultora independiente documenta descuentos **"up to 90+% off"** ([Fidelis](https://www.fidelisfea.com/post/how-much-does-simulation-in-the-3dexperience-platform-cost-and-what-is-included)) | PowerFLOW aeroacústico ~1.1 B voxels: **86 h** ⚠️; en GPU *"un día → horas"* | Precio 100% opaco |
| **Altair** (AcuSolve, ultraFluidX, HyperWorks) | CFD FEM / LBM en GPU | **Altair Units** en pool compartido, curva cóncava | **NO VERIFICADO** — ningún precio público | ultraFluidX: DrivAer **<8 h en 8× H100** ⚠️ extrapolado | Cotización por **"Peak Usage"**; *"stacking and leveling rules make manual calculation impossible"* |
| **SimScale** | CFD/FEA en la nube con UI web (motor **Pacefish®** LBM en GPU) | Suscripción por core-hours | 🔴 **PRECIOS RETIRADOS DEL SITIO.** Community **gratis** (10 simulaciones, 3,000 core-hours, proyectos públicos); Mechanical/Professional/Enterprise = **"custom quote"** ([pricing](https://www.simscale.com/product/pricing/)) | "20–30× más rápido" con Pacefish | *"The minimum annual core hours and fee is a little much for our needs"* |
| **COMSOL Multiphysics** | Multifísica FEM | Perpetua + 20%/año, o anual al 50%. **FNL sin límite de nodos de cómputo** | 🥇 **CFD Module €5,343** perpetua + €1,068.60/año ([lista académica, Uni Hannover](https://www.luis.uni-hannover.de/fileadmin/software-lizenzen/Ueberlassung/comsol_preisliste_luis.pdf)); Cambridge **£3,025/asiento/año** ([Cambridge Eng](https://help.eng.cam.ac.uk/software/comsol/)) | — | El precio bloquea la reproducibilidad científica |
| **Autodesk CFD** | CFD para diseño | Suscripción | **NO VERIFICADO** | — | ⚠️ **El EOL que se rumora quedó REFUTADO** — ver B.6 |
| **Hexagon / MSC Cradle CFD** | scFLOW / scSTREAM / scFAST | **NO VERIFICADO** | Lista **NO VERIFICADO**. Bundles MSC adjudicados al US Army: **US$262,982** | — | 🔴 **Vendido a Cadence; traslape con Fidelity sin resolver** |
| **CONVERGE CFD** | CFD con mallado autónomo en runtime (linaje: combustión) | 🥇 **Tiers y on-demand PUBLICADOS** | **US$12.00 – US$41.85 por job-hour** ([convergecfd.com/horizon](https://convergecfd.com/index.php/about/horizon)); licencia anual LAN adjudicada al gobierno: **US$45,000 – US$52,530** | Hasta 2,880 cores | Linaje de motores; débil en aero externa |

### B.2 🥇 Simcenter STAR-CCM+ — Siemens SÍ publica lista, y casi nadie lo sabe

La tienda propia `dex.siemens.com` vende con precio público en USD. Esto es **lista de Siemens**, no
estimación:

| SKU | Producto | **Anual USD** | 3 años USD |
|---|---|---|---|
| STAR1000 | STAR-CCM+ base (**1 sesión / 1 core**) | **29,165.76** | 87,497.28 |
| STAR1001 | STAR-CCM+ Lite | 15,608.52 | 46,825.56 |
| **STAR1002** | **Power Session (cores ilimitados)** | **56,190.00** | **168,570.00** |
| STAR1004 | Sesión adicional (1 core) | 19,705.20 | 59,115.60 |
| STAR1016 | Power Tokens | 2,529.60 | 7,588.80 |
| STAR1017 | STAR-CCM+ HPC | 2,140.44 | 6,421.32 |
| STAR1007 / 1005 | Client for CATIA V5 / CAD Exchange | 5,523.12 / 2,368.92 | — |
| STAR1008/09/10 | Client Inventor / NX / Creo | 3,153.72 c/u | — |

**Dos hallazgos duros:**
1. **Comprometerse a 3 años NO da ni un dólar de descuento** (56,190 × 3 = 168,570 exacto, en todos
   los SKUs).
2. **La tienda solo vende suscripción.** No hay SKU perpetuo en el canal en línea.

**Confirmación independiente:** el reseller SDA publica *Simcenter STAR-CCM+ Essentials — Annual —
**$29,160.00*** ([store.sdasoftware.com](https://store.sdasoftware.com/products/simcenter-star-ccm-essentials/5102139000000815163)),
a $6 del SKU de Siemens. **El asiento base de 1 core cuesta ~US$29.2k/año, confirmado por dos canales
independientes.** Es el número más sólido de todo este documento.

**Lo que se paga de verdad** — contratos federales de EE.UU. (USAspending.gov): **US$503,233.43**
(W15QKN25FA261, 2025) · US$498,063 (2022) · **US$450,245.88** "STAR-CCM+ POWER SESSION"
(W56HZV19PL226) · US$238,037 (NASA, 2021) · US$125,460 idéntico en 2025 y 2026 · US$9,913 "POWER ON
DEMAND HOUR". Reino Unido: Centre for Process Innovation → Siemens, **£33,435**
([Contracts Finder](https://www.contractsfinder.service.gov.uk/Notice/7ab56e5d-a3b4-4936-babf-5c6ff1883d4c)).

Y lo que reportan los usuarios ([r/CFD, mar-2025](https://www.reddit.com/r/CFD/comments/1j86qkm/licensing_starccm_simcenter_x/)):
> **u/bhalazs:** *"this is company internal and you could get trouble if you are identifiable. general
> ballpark though is **35-50 k€ for a power session**"*
> **u/bitdotben:** *"**1hour POD is ~30€/$**, but you can get better deals obviously"*

→ **35–50 k€ pagados vs US$56,190 de lista = descuento típico de 15–40%.**

**El cálculo que define la competencia — escalar a 100 cores:**

| Ruta | Costo anual |
|---|---|
| Base + 100× HPC por core | ~$243,200 ⚠️ |
| Base + 100× Power Tokens | ~$282,100 ⚠️ |
| **Power Session** | **$56,190** |
| Power-on-Demand | desde ~$15,000 (500 h × ~$30) |

⚠️ La **unidad** del SKU STAR1017 no está documentada por Siemens; se asumió "por core" por analogía
→ esa columna es **NO VERIFICADA**. Pero la arquitectura es inequívoca: **el escalado per-core es
prohibitivo a propósito, para empujarte al Power Session.**

### B.3 Ansys — el modelo que la gente odia, con su fórmula

**HPC Packs.** Fórmula verificada: **cores totales = 4 + [8 × 4^(h−1)]**, con *h* = número de packs
([Exxact](https://www.exxactcorp.com/blog/engineering-mpd/ansys-hpc-pack-for-cpus-and-gpus-explained)):

| Packs | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| **Cores** | 4 | 12 | 36 | 132 | 516 | 2,052 |

Escalones, no rampa: **para pasar de 36 a 132 cores hay que comprar un pack entero.** Y en GPU es
peor: se licencia por **Streaming Multiprocessors**, no por tarjeta — una RTX 6000 Ada (142 SMs) = 3
HPC Packs; **4× RTX 6000 Ada = 5 HPC Packs**. Comprar más GPUs escala la factura de licencia.

🔴 **La confesión: en febrero de 2025 Ansys lanzó CFD HPC Ultimate**, que *"eliminates pack
restrictions entirely, enabling any number of CPU cores or GPUs without the need for additional HPC
Packs"* (misma fuente). **Ansys copió el Power Session de Siemens.** Eso confirma que la queja les
estaba costando cuentas — y este cliente ya se había ido:

> *"Our company use to use Ansys but we spent the last couple of years transitioning most of the
> production work to StarCCM. Main motivation was Ansys were charging the company an arm and a leg
> for licenses and **Ansys' HPC license model is archaic and punishing** if you are trying to run
> solvers with hundreds to thousands of cores."* — u/ncc81701, r/CFD

🥇 **Precio académico verificado** ([University of Washington](https://software.engr.uw.edu/software/ansys), USD/año, nuevo / renovación):

| Producto | Config | Nuevo | Renovación |
|---|---|---|---|
| Mech, Struc, **CFD** | 1 CUL | $1,500 | $880 |
| Mech, Struc, CFD | 25 CUL | $7,000 | $3,500 |
| **HPC** | **100 cores** | **$1,750** | **$875** |
| Teaching | 1 CUL | $55 | $55 |

> Nota textual de la UW: *"One CUL license allows you to run one job across up to 4 cores. To run
> across more cores, requires HPC licenses."*

**Ansys Startup Program:** empresas privadas con **<US$5M de ingreso anual** y **<5 años**, hasta 5
bundles/año ([ansys.com/startup-program](https://www.ansys.com/startup-program)). **Precio del bundle:
NO VERIFICADO.**

**Quejas verbatim (Capterra y SoftwareAdvice, leídas directamente):**
- *"The hardest part of the program is the definition of the mesh"* — PhD Eng, ago-2022
- *"The software is very difficult to apply — significant amount of time needs invested in meshing"*
  — Modelling & Simulation Engineer, Defense & Space, ene-2022
- Soporte: respuestas del sistema de tickets *"within 1 month"* — PhD Student, ene-2022
- Discovery: *"the limitations and clunkiness of the program makes it such that I can hardly use it
  ever"* — Ewen C., dic-2021
  ([Capterra Fluent](https://www.capterra.com/p/238339/ANSYS-Fluent/reviews/) ·
  [Capterra Discovery](https://www.capterra.com/p/245795/Ansys-Discovery/reviews/))
- Costo: *"Maintenance costs for software like Ansys and Matlab are insane and can run into the tens
  of thousands a year"* — [HN 19016622](https://news.ycombinator.com/item?id=19016622)
- Sobre FlexLM: *"a scary piece of software for sysadmins: think of it like a black box that will
  shut down everything if you mess up"* — [HN 12871100](https://news.ycombinator.com/item?id=12871100)

**CFX:** no hay anuncio de fin de desarrollo y sigue recibiendo actualizaciones en 2026 R1, pero el
consenso es que Fluent recibe todo el foco. **"Modo mantenimiento" oficial: NO VERIFICADO.**

### B.4 🔴 La consolidación 2024–2026 — el mapa quedó irreconocible

**En 24 meses el mercado se consolidó en tres bloques.** Esto es lo más importante de la sección.

| Operación | Anuncio | Monto | **Cierre real** | Fuente |
|---|---|---|---|---|
| **Synopsys ⟶ Ansys** | 16-ene-2024 · $197 efectivo + 0.345 acciones SNPS por acción | **~US$35,000 M** | **17-jul-2025** | [Synopsys PR](https://news.synopsys.com/2025-07-17-Synopsys-Completes-Acquisition-of-Ansys) · [Cleary Gottlieb](https://www.clearygottlieb.com/news-and-insights/news-listing/synopsys-to-acquire-ansys) |
| **Siemens ⟶ Altair** | 30-oct-2024 · **$113.00/acción** en efectivo, prima 19% | **~US$10,000 M** | **26-mar-2025** | [Siemens PR anuncio](https://press.siemens.com/global/en/pressrelease/siemens-strengthens-leadership-industrial-software-and-ai-acquisition-altair) · [PR cierre](https://press.siemens.com/global/en/pressrelease/siemens-acquires-altair-create-most-complete-ai-powered-portfolio-industrial-software) |
| **Cadence ⟶ NUMECA** | ene-2021 | no revelado | mar-2021 | Cadence |
| **Cadence ⟶ Pointwise** | **15-abr-2021** ⚠️ *no 2022* | no revelado | 2021 | Cadence |
| **Cadence ⟶ BETA CAE** (ANSA/META) | mar-2024 | **US$1,240 M** (60/40) | Q2-2024 | [Cadence PR](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2024/cadence-to-acquire-beta-cae-expanding-into-structural-analysis.html) |
| **Cadence ⟶ Hexagon D&E (incl. MSC + Cradle CFD)** | 9-sep-2025 | **€2,700 M (~US$3,170 M)** | 🔴 **23-feb-2026** | [Cadence PR cierre](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2026/cadence-completes-acquisition-of-hexagons-design-and-engineering.html) · [HPCwire](https://www.hpcwire.com/off-the-wire/cadence-completes-acquisition-of-hexagons-design-and-engineering-business/) |
| **Altair ⟶ FlightStream** | 1-may-2024 | no revelado | 2024 | researchinflight.com |
| **Autodesk ⟶ Navasto** | dic-2024 | no revelado | 2024 | [Autodesk](https://blogs.autodesk.com/design-studio/2024/12/10/welcome-navasto/) |
| **Mistral AI ⟶ Emmi AI** | may-2026 | no revelado | 2026 | [Emmi](https://www.emmi.ai/news/mistral-ai-acquires-emmi-ai) |

**Hallazgo de campo, 4-ago-2026: la marca Altair YA DESAPARECIÓ.** Todo `altair.com` redirige
(HTTP 307) a Siemens. HyperWorks fue absorbido en Simcenter; el soporte migró al Siemens Support
Center; **AcuSolve y ultraFluidX ya ni se nombran**. Los productos salen rebrandeados: **Simcenter
HyperMesh, Simcenter Inspire, Simcenter PhysicsAI**. Siemens comprometió **>US$500 M/año de sinergias
de ingreso a mediano plazo y >US$1,000 M a largo** — esa es la presión estructural sobre los precios
de todo ese portafolio.

**Cadence pasó de cero a consolidador #1 fuera de Ansys/Siemens**, y ahora controla simultáneamente
Fidelity CFD, Pointwise, ANSA/META, MSC Nastran/Adams **y Cradle CFD** — verificado en campo:
[cradle-cfd.com](https://www.cradle-cfd.com/product/scflow.html) ya rotula "Cradle CFD | **Cadence**".
Tiene **dos líneas CFD solapadas** y ninguna nota de prensa aborda el traslape → riesgo real de
racionalización para clientes de Cradle. Hexagon compró MSC en 2017 por US$834 M y vendió la división
por €2,700 M: **3.8× en 9 años**, y ya no es proveedor de CFD.

> **Léelo junto:** el dueño de Fluent ahora es una empresa de EDA de semiconductores. El dueño de
> HyperWorks es Siemens. El dueño de Cradle CFD es la empresa de Pointwise. El dueño del fork
> industrial de OpenFOAM es Keysight. **El CAE se está absorbiendo dentro de plataformas más
> grandes, y en cada absorción el producto de nicho —el que servía al diseño conceptual— pierde
> prioridad.** Eso abre espacio abajo. Es nuestro espacio.

### B.5 Los otros modelos de licencia (y quién tiene el bueno)

| Vendor | Modelo | Costo de escalar a 100+ cores |
|---|---|---|
| **Ansys** (pre-2025) | HPC Packs, escalones de 4× | Punitivo → por eso lanzaron CFD HPC Ultimate |
| **Siemens** | **Power Session = cores ilimitados por precio fijo** | **US$56,190/año, plano** |
| **Dassault SIMULIA** | SimUnit: tokens + créditos por core-hora, curva cóncava | 4 cores = 19 créditos/h (4.75 por core-h); **92 cores = 60 créditos/h (0.65 por core-h)**. **23× los cores por 3.2× el consumo** ([GoEngineer](https://www.goengineer.com/blog/advancing-engineering-simplicity-simulias-new-unified-licensing-model)). Precio del crédito: **NO VERIFICADO** |
| **Altair** | Units en pool, draw cóncavo | 4→128 cores (**32× cómputo**) sube el draw de **25 a 65 unidades: solo 2.6×** ([Altair docs 2017](https://2017.help.altair.com/2017/hw/intro/product_licensing_unit_draw.htm)). ⚠️ tabla de 2017, vigencia hoy **NO VERIFICADA** |
| **COMSOL** | **FNL sin límite de nodos de cómputo** | 🥇 *"you may run a single model on multiple compute nodes, and **there is no restriction on the number of compute nodes**"* ([comsol.com](https://www.comsol.com/products/licensing)). **Escalar cuesta SOLO hardware** |
| **CONVERGE** | On-demand por job-hour, publicado | **US$12.00–41.85/job-hour** hasta 2,880 cores. Escalar es puro consumo |

**El patrón que hay que ver:** todo el mercado se está moviendo a "cores ilimitados" bajo presión de
los clientes. Ansys copió a Siemens en feb-2025; Dassault y Altair convergieron a curvas cóncavas.
**La era de cobrar por core se está acabando** — lo cual, de paso, significa que "el software es caro
por core" dejará de ser un argumento de venta nuestro dentro de poco.

### B.6 ⚠️ Dos correcciones al brief del encargo

1. **Autodesk CFD NO está descontinuado.** La página oficial de productos retirados de Autodesk
   ([retired-products](https://www.autodesk.com/support/account/manage/billing/retired-products))
   **no lista "Autodesk CFD"**. Lo que sí murió: **CFD *Flex*** (el modelo de tokens, fin de venta
   21-mar-2016) y **Flow Design** (27-mar-2018) — dos productos distintos. La
   [página de producto](https://www.autodesk.com/products/cfd/overview) sigue activa sin aviso de
   discontinuación y el foro sigue abierto. **Veredicto: refutado provisionalmente.** Hay que pedirle
   al cliente la fuente del rumor antes de repetirlo.
2. **Cadence compró Pointwise en 2021, no en 2022.** Y su compra de Hexagon D&E **ya cerró**, hace
   ~5 meses.

### B.7 🔴 La herida abierta de 2026: Dassault cobra royalties a los desarrolladores terceros

Esto no estaba en el encargo y es el conflicto vivo más importante del sector. Dassault impuso a los
desarrolladores de add-ins de SOLIDWORKS: **10% de los ingresos** (no de la utilidad), **US$100 por
asiento** para productos **gratuitos**, y **US$50 por renovación** de community editions. Cronología:
anuncio ago-2025 → deadline **ene-2026** para firmar o dejar de vender → reportes obligatorios desde
**Q3-2026** ([upFront.eZine](https://upfrontezine.substack.com/p/the-backlash-to-dassault-systemes)).

> **Peter Brinkhuis:** *"Share our sales numbers… Pay them at least 10% of our revenue [up from 0%]…
> **In return, we get nothing extra**."*
> **Lee Priest:** *"**If I make a free tool that 100 people download, I have to pay them $10,000 in
> that first year**… There goes any hope of 'giving back'."*

**Por qué nos importa:** el ecosistema de desarrolladores alrededor del CAD dominante se está
volviendo hostil. Es exactamente el momento en que una alternativa abierta y sin peaje encuentra
aliados.

### B.8 Ciclos de trabajo — los números que hay que citarle al cliente

| Fuente | Dato |
|---|---|
| **NASA CFD Vision 2030** ([PDF](https://ntrs.nasa.gov/api/citations/20140003093/downloads/20140003093.pdf)) | *"the generation of suitable meshes for CFD simulations about complex configurations constitutes a **principal bottleneck**… the mesh generation phase constitutes the **dominant cost in terms of human intervention**"* · *"**Few applications can make efficient use of more than O(1,000) cores**"* |
| **Cadence** | El preproceso manual consume *"up to 80% of engineering time"* |
| **STAR-CCM+ / CRM-HL** ([Siemens](https://blogs.sw.siemens.com/simcenter/cfd-coupled-solver-is-taking-off-on-gpu/)) | 110 M celdas poliédricas, RANS SST: **40 min en 24× A100**. Barrido de 25 α (2°→21.5°): **19 h**, *"whereas a whole week would be required on CPU with 576 cores"* |
| **Cadence Millennium M1** | Airframe **JSM 185 M celdas → 13.9 h**; GE E3 combustor 179 M → 7.8 h; DrivAer 144 M → 4.6 h |
| **Ansys + Baker Hughes + ORNL** (abr-2025) | Estator de turbina, **2,200 M celdas: 38.5 h → 1.5 h** en 1,024 GPU AMD MI250X ⚠️ vía resumen del PR |
| **AIAA Drag Prediction Workshop IV** ([NASA](https://ntrs.nasa.gov/api/citations/20100025833/downloads/20100025833.pdf)) | Mallas de **7.2 M (coarse) a 189.4 M (extra-fine)**; hasta **2.4 B**. Malla "Medium" wing-body: **10.9 M** |
| **Combustión (STAR-CCM+, 40 M celdas)** | 1,024 cores CPU: **>4.5 días**; 4× GH200: 2.5 días. *"a single A100 GPU card is performing equivalent to 310 CPU cores"* |
| 🔑 **Regla de escalado (AWS)** | Eficiencia ~100% entre **700k y 60k celdas/core**; ≥80% hasta **25k celdas/core**. **Por debajo de 25k celdas/core estás quemando licencia sin ganar tiempo** ([AWS Compute Blog](https://aws.amazon.com/blogs/compute/efa-enabled-c5n-instances-to-scale-simcenter-star-ccm)) |
| **Horas de MALLADO de un avión completo** | 🔴 **NO VERIFICADO** — nadie lo publica; los papers de AIAA HLPW están tras paywall (arc.aiaa.org da 403) |

### B.9 Por qué los odian aunque los usen — los seis patrones

1. **El precio bloquea el aprendizaje, y eso bloquea la carrera.** El testimonio más duro de toda la
   investigación:
   > *"I have built code level solvers, from full NS to diffusion, advection only in C++, Python and
   > Matlab, **was rejected from most job positions after I graduated because I had no
   > StarCCM+/Ansys experience**. I ended switching fields to data science"* — u/Frosty_Sheepherder71
   > ([r/CFD](https://www.reddit.com/r/CFD/comments/1nq4mzv/how_do_you_guys_learn_starccm_without_a_license/))

   Y el resultado predecible: *"Go sail the high seas, thats how I learned it. Victimless crime.
   **Outside of a student license you wont be able to get enough time to learn anything**."*
   — u/iam_thedoctor, mismo hilo.

2. **El modelo de escalado, no el precio base, es lo que enfurece.** Ver B.3 y B.5.

3. **La opacidad es peor que el precio.** Ni CATIA, ni XFlow, ni PowerFLOW, ni Fidelity, ni Cradle,
   ni Altair Units publican un solo precio. Donde sí hay lista, un consultor documenta descuentos
   *"up to 90+% off"* — la lista no significa nada. Y cuando pides cotización:
   > **u/Live_Mastodon_7552:** *"My Company wants me to come up with the best licensing model and **I
   > find it really hard to get some numbers from Siemens**… They already told me twice that someone
   > from sales will contact me but **somehow I never received a call**"*

   Los usuarios ni siquiera pueden hablar entre ellos: *"this is company internal and you could get
   trouble if you are identifiable"*.

4. **El mallado, no el solver, sigue siendo el cuello de botella — con respaldo de NASA.** Todas las
   ganancias de GPU atacan la mitad *barata* del problema.

5. **El costo oculto arrastra al hardware.** Licencias por core castigan CPUs lentas; licencias por
   SM de GPU castigan comprar más GPUs; y *"I was pricing out servers this morning with 64gb(!) of
   RAM for almost 20k"* ([HN](https://news.ycombinator.com/item?id=48385947)). La factura real es
   2–3× la licencia.

6. **Casi nadie se queja de la física.** Las quejas se agrupan en modelo de negocio, documentación
   (*"guides on all features are basically non existent"*), soporte (tickets contestados *"within 1
   month"*) y ausencia de salida FOSS creíble. **Se quejan del vendedor, no del solver.**

   Contrapunto honesto sobre STAR-CCM+, que hay que respetar: *"Once you start meshing complex parts
   with Star, you'll never want to go back to anything else"* (u/bionicdna) y *"You can jump from
   v3.06 from 20 years ago to todays version without any trouble"* (u/t0mi74). **No encontré
   evidencia de resentimiento por "version churn" en STAR-CCM+; encontré lo contrario.**

### B.10 Lo que NO se pudo verificar en esta sección

- **Precio de lista de Ansys Fluent, CFX, Discovery y SimAI** (comercial) — no existe cifra pública.
- **Precio comercial de COMSOL** (el académico sí está verificado).
- **Precio de lista de Cadence Fidelity CFD, Cradle CFD, Simcenter 3D, FLOEFD, CATIA, XFlow,
  PowerFLOW y de cualquier producto Altair.**
- **Valor de una Altair Unit**; y que la tabla de *unit draw* de 2017 siga vigente en 2026.
- **Unidad del SKU STAR1017 de Siemens** (se asumió "por core").
- **Precio de cualquier tier de pago de SimScale** — los retiraron del sitio.
- **Horas de mallado de un avión completo** — nadie lo publica.
- **Equity value de Altair de "$10.6 mil millones"** — la fuente primaria era `investor.altair.com`
  y **ese dominio ya no resuelve DNS**. Usa los ~US$10,000 M del PR de Siemens.
- **Quejas públicas de usuarios de Altair** — HN da 0 resultados, Capterra 404, cfd-online y eng-tips
  403. **La tesis de "consumo de unidades opaco y caro" NO tiene cita directa de usuario**; lo único
  citable es la evidencia de OpenLM sobre la imposibilidad de calcularlo a mano.
- **Auditorías de licencia de Dassault** y resentimiento por la transición CD-adapco → Siemens (2016)
  — sin soporte citable.
- **COMSOL para aerodinámica externa a alto Reynolds** — sobre el papel tiene los modelos (SA, SST,
  v2-f, LES, DES), pero su propia página **no posiciona aero externa** y no hay ningún caso a escala
  aeronave. **Hueco real.**
- **Citas de cfd-online, G2 y TrustRadius** — los tres dan 403. **Cero citas extraídas de ahí.**

⚠️ **Trampa de datos documentada:** `hexagon.de/pdf/prlist_e.pdf` aparece en buscadores como "Hexagon
Price List 2026" con precios en EUR. **NO es Hexagon AB** — es *HEXAGON Industriesoftware*, una
empresa alemana de cálculo de resortes y engranes. **Cero relación con Cradle CFD. No citar.**

---

## C. LA OLA NUEVA (2023–2026) — GPU + ML

> Esta es la sección que importa. Entre 2023 y 2026 el mercado de simulación cambió de eje: dejó de
> competirse por **modelos físicos** y pasó a competirse por **tiempo hasta la respuesta**. Dos olas
> distintas, que la prensa mezcla y no son lo mismo:
>
> **Ola 1 — solver nativo en GPU.** Sigue siendo Navier-Stokes de verdad, resuelto de cero, pero
> escrito para GPU en lugar de para clústeres de CPU. Gana 10×–100× en pared. Es *exacto* (misma
> física) y *no* necesita datos de entrenamiento. Ejemplos: Flexcompute Flow360, Luminary Cloud,
> Fluent GPU nativo, STAR-CCM+ GPU, Cadence Fidelity sobre Millennium.
>
> **Ola 2 — sustituto neuronal (surrogate / "Physics AI").** Ya no resuelve nada: **interpola** un
> campo aprendido de miles de corridas previas. Gana 1,000×–1,000,000× pero solo dentro del espacio
> en que fue entrenado, y su error es estadístico, no acotado. Ejemplos: Ansys SimAI, Neural Concept,
> PhysicsX, NVIDIA PhysicsNeMo/DoMINO, Luminary SHIFT, Navasto (hoy Autodesk), Emmi AI (hoy Mistral),
> Navier AI, NeuralFoil.
>
> **La Forja NO puede jugar en la Ola 1** (no tenemos ni el solver ni la nube). **La Forja SÍ puede
> jugar en la Ola 2**, porque un surrogate entrenado es un archivo de pesos de pocos MB que corre en
> milisegundos — y eso sí cabe en un navegador. Ese es el hallazgo central de este reporte.

### C.1 Tabla — los jugadores de la ola nueva

| Empresa | Qué es | Números que publica | Cómo cobra | Clientes citados | Movimiento reciente | Fuente |
|---|---|---|---|---|---|---|
| **Flexcompute (Flow360)** | Solver RANS/URANS/DDES/ZDES **nativo en GPU**, en la nube. Física completa, no ML | "100× más rápido que CFD tradicional"; caso Electra: 9 meses menos de ciclo; "50% más barato que túnel de viento" | Usage-based (consumo). **Tarifas no publicadas** | Electra, Wisk, Joby Aviation, Elysian | Series C en julio 2024 (monto no verificado); Elysian firmó en 2025 | [flexcompute.com/flow360](https://www.flexcompute.com/flow360/), [PR Elysian](https://www.prnewswire.com/news-releases/elysian-selects-flexcomputes-flow360-cfd-solver-for-development-of-battery-electric-e9x-aircraft-302544667.html) |
| **Luminary Cloud** | Solver GPU-nativo en la nube **+ "Physics AI"** (modelos SHIFT preentrenados) | SHIFT-Wing: 92% de predicciones dentro del 5% del CFD a M=0.85; 98% a M=0.50; error mediano en CD de 1.73% (M=0.85) y 0.81% (M=0.50); "segundos por candidato de diseño" | **No publica precios** (solo "contacta ventas") | Otto Aviation, Joby Aviation, Piper Aircraft, Trek Bikes, Honda, Northrop Grumman | **$72M Serie B (sep-2025)** liderada por N47 con Sutter Hill y NVentures; total levantado ~$187M. Alianza con Northrop Grumman (oct-2025) | [Luminary SHIFT-Wing](https://luminary.ai/resources/shift-wing-a-physics-ai-model-to-accelerate-aircraft-design-innovation/), [SiliconANGLE $72M](https://siliconangle.com/2025/09/15/luminary-cloud-raises-72m-advance-ai-driven-physical-product-design/), [DefenseScoop Northrop](https://defensescoop.com/2025/10/28/northrop-grumman-luminary-cloud-physics-ai-space/) |
| **Neural Concept** | "AI nativa de CAD": entrena sobre tus propias simulaciones y predice desde la geometría | Ahorro reportado de $50M/año en clientes; 30–50% menos rediseños tardíos; hasta 2 años menos de time-to-market; 4× ingreso empresarial en 18 meses | **Quote-only.** No hay lista de precios pública (verificado: no existe) | GM, GE Vernova, Leonardo Aerospace, Eaton, Safran, Renault, varios equipos de F1 (>50 empresas) | **$100M Serie C (dic-2025)** liderada por Goldman Sachs Growth Equity; alianzas con NVIDIA, Siemens, Ansys, Microsoft, AWS | [PRNewswire $100M](https://www.prnewswire.com/news-releases/neural-concept-closes-100m-funding-round-led-by-growth-equity-at-goldman-sachs-alternatives-to-scale-ai-native-engineering-302645941.html), [Goldman Sachs AM](https://am.gs.com/en-hk/individual/news/press-release/2025/neural-concept-closes--100m-funding-round-led-by-growth-equity-a) |
| **PhysicsX** | "Large Geometry Models" — modelos fundacionales de geometría+física. LGM-Aero para aeroespacial | LGM-Aero preentrenado sobre **25M+ mallas / 10 mil millones de vértices**, con decenas de miles de simulaciones CFD/FEA hechas en STAR-CCM+ y Nastran. "De meses a horas". Ai.rplane: campos de presión "en segundos" | Plataforma empresarial (quote). **Ai.rplane es gratis** | Aeroespacial y defensa, automotriz, semiconductores, energía (nombres específicos no publicados) | **$135M Serie B (jun-2025)** + extensión de NVentures → ~$155M, valuación ~$1B. **$300M Serie C (8-jun-2026) liderada por Temasek, valuación ~$2.4B**. Siemens es inversionista y socio | [PhysicsX Serie C](https://www.physicsx.ai/newsroom/physicsx-announces-300m-series-c-to-accelerate-physics-ai-for-industrial-engineering), [Cooley](https://www.cooley.com/news/coverage/2026/2026-06-08-physicsx-raises-$300-million-series-c), [LGM-Aero](https://www.physicsx.ai/newsroom/introducing-lgm-aero-genai-for-aero-engineering-and-airplane-showcase-application-for-aerostructures), [Ai.rplane](https://www.physicsx.ai/newsroom/welcome-to-airplane) |
| **Ansys SimAI** (hoy bajo Synopsys) | Surrogate entrenado con TUS simulaciones. Desde 2026 R1 se parte en **SimAI Pro** (workstation local con GPU) y **SimAI Premium** (SaaS, campos 3D completos) | "10× a 100× más alternativas de diseño"; predicción "en minutos" | Licencia Ansys (quote). **Precio no publicado** | No publicados | **2026 R1** introduce GeomAI + la partición Pro/Premium. Ansys fue **adquirida por Synopsys, cierre 17-jul-2025, $35 mil millones** | [Ansys SimAI](https://www.ansys.com/products/ai/simai), [GeomAI 2026 R1](https://www.ansys.com/blog/introducing-ansys-geomai-software), [Synopsys cierra](https://investor.synopsys.com/news/news-details/2025/Synopsys-Completes-Acquisition-of-Ansys/default.aspx) |
| **NVIDIA PhysicsNeMo** (ex-Modulus) | **Framework open source** para entrenar surrogates de física. Incluye **DoMINO**, operador neuronal para aerodinámica externa | DoMINO toma STL de entrada y predice presión, esfuerzo cortante en pared y campos de velocidad/presión en el volumen. Entrenamiento bajó de ~5 días a **poco más de 4 h con 8 H100** | **Gratis / open source** (el hardware se paga aparte) | Es la base sobre la que corren Luminary (SHIFT) y otros | Es la infraestructura común de la ola: quien no entrena sobre PhysicsNeMo, entrena sobre algo parecido | [GitHub NVIDIA/physicsnemo](https://github.com/NVIDIA/physicsnemo/tree/main/examples/cfd/external_aerodynamics/domino), [Docs DoMINO](https://docs.nvidia.com/physicsnemo/latest/physicsnemo/examples/cfd/external_aerodynamics/domino/README.html), [paper DoMINO arXiv:2501.13350](https://arxiv.org/html/2501.13350v1) |
| **Navasto** | NavPack: entrena AI física con TUS datasets (CFD, crash, térmico); aerodinámica en tiempo real dentro de Blender/Alias | "De horas a milisegundos"; entrena con **tan solo ~30 muestras** | — | Airbus, Audi, Volkswagen, MAN | **Adquirida por Autodesk (dic-2024)**; su tecnología es hoy Autodesk NavPack | [Autodesk: Welcome NAVASTO](https://blogs.autodesk.com/design-studio/2024/12/10/welcome-navasto/), [NavPack en Alias, nov-2025](https://blogs.autodesk.com/design-studio/2025/11/19/how-navpack-brings-engineering-intelligence-into-alias-the-design-studio-aif-2025/) |
| **Emmi AI** | Surrogates neuronales a escala industrial. Arquitectura **AB-UPT**: >100M de celdas de malla, inferencia sin malla | AB-UPT reporta precisión estado del arte con inferencia mesh-free y predicciones físicamente consistentes | — | Industria automotriz/manufactura europea | **€15M seed (abr-2025)** — la mayor semilla de Austria. **Adquirida por Mistral AI (may-2026)**, precio no revelado; +30 investigadores pasan a Mistral | [Tech.eu €15M](https://tech.eu/2025/04/25/austria-s-emmi-ai-raises-15m-to-bring-real-time-ai-simulations-to-industrial-engineering/), [Mistral adquiere Emmi](https://www.emmi.ai/news/mistral-ai-acquires-emmi-ai), [AB-UPT arXiv:2502.09692](https://arxiv.org/pdf/2502.09692) |
| **Navier AI** | Solver acelerado por ML + **agentes** que arman el caso (geometría → malla → solver → post) | "1000× más rápido"; "simulaciones de calidad ingenieril en segundos" | — | Aeroespacial y automotriz | **$5.6M seed**, GV (Google Ventures), HCVC, Y Combinator (W24). Fundada por ex-SpaceX | [YC Launch](https://www.ycombinator.com/launches/KRn-navier-ai-real-time-cfd-simulations), [Navier platform](https://www.navier.ai/platform) |
| **Dive Solutions** | CFD cloud-native (spin-out de Bosch, 2018), Berlín/Boston | — | — | Manufactura | **$10M Serie A** liderada por D.E. Shaw. **NO está adquirida por Ansys** — eso es falso, no encontré evidencia | [TechCrunch](https://techcrunch.com/2024/06/05/dive-goes-cloud-native-for-its-computational-fluid-dynamics-simulation-service/), [HPCwire](https://www.hpcwire.com/off-the-wire/dive-engineering-software-secures-10m-series-a-to-advance-manufacturing-simulations/) |
| **Cadence** | Millennium — supercomputadora-appliance para CFD acelerado | **M2000: ~$2M** por configuración estándar (~32 GPUs Blackwell); hasta **80× más rápido y 20× menos energía** que el predecesor CPU; CFD específicamente **20×** | Compras de appliance o consumo en la nube | MediaTek, **Boom Supersonic**, Ascendance, Treeline Biosciences, Supermicro. NVIDIA compró 10 sistemas | Lanzado en CadenceLIVE 2025 | [Cadence PR](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2025/cadence-unveils-millennium-m2000-supercomputer-with-nvidia.html), [Tom's Hardware](https://www.tomshardware.com/tech-industry/supercomputers/cadence-releases-new-ai-supercomputer-uses-nvidia-rtx-pro-6000-gpus-to-improve-simulation-run-time) |

**Precios que NO pude verificar (dicho explícitamente):** ninguna de las empresas de la ola nueva
—Flexcompute, Luminary, Neural Concept, PhysicsX, Ansys SimAI, Navasto, Emmi, Navier— publica una
lista de precios. Todas son *quote-only* o *usage-based* sin tarifa pública. Busqué páginas de
pricing directas de Luminary y Flexcompute: no existen. **Cualquier cifra de precio para estas
empresas que veas en otro lado, desconfía: yo no la encontré.**

### C.2 Los números duros de SHIFT-Wing (el benchmark más útil que hay para nosotros)

Luminary publicó, con Otto Aviation y NVIDIA, un modelo abierto para **diseño de alas transónicas**.
Es lo más cercano a nuestro problema y sus números son la vara para medir cualquier surrogate aero:

| Métrica | Mach 0.50 | Mach 0.85 |
|---|---|---|
| Error en CL (mejor / mediano) | 0.55% / 0.76% | 1.65% / 4.15% |
| Error en CD (mejor / mediano) | 0.08% / 0.81% | 0.17% / 1.73% |
| Error en CM (mejor / mediano) | 0.06% / 1.26% | 0.15% / 5.30% |
| Predicciones dentro del 5% del CFD | 98% | 92% |

- Entrenado con **2,276 simulaciones de malla adaptada, ~30M de volúmenes de control cada una**;
  dataset total **3,000+ RANS**, "petabytes de campos anotados".
- Rango: **Mach 0.5–0.85**, relación de aspecto 7.5–11, flecha 25–37.5°.
- Basado en el **NASA Common Research Model**, geometría abierta.
- Dataset publicado en Hugging Face: [luminary-shift/WING](https://huggingface.co/datasets/luminary-shift/WING).
  Licencia: **libre para uso no comercial**, licenciable para comercial.
- Fuente: [luminary.ai/resources/shift-wing…](https://luminary.ai/resources/shift-wing-a-physics-ai-model-to-accelerate-aircraft-design-innovation/)

**Lee la tabla otra vez.** El error del surrogate **crece 5× al entrar en transónico**: CM pasa de
1.26% a 5.30% de mediana. Eso no es un defecto de Luminary; es la naturaleza del método. Donde la
física es suave, el ML interpola muy bien; donde aparece la onda de choque, el ML se despeina. Este
es exactamente el argumento honesto que debemos usar con el cliente: **el surrogate es una lupa para
explorar, no un juez para certificar.**

### C.3 En qué se basa técnicamente la ventaja (por si alguien pregunta)

1. **GPU-nativo ≠ GPU-acelerado.** Los solvers de la ola 1 (Flow360, Luminary) se escribieron desde
   cero con el kernel en GPU y la malla residente en VRAM. Los legados (Fluent, STAR-CCM+) portaron
   sus solvers, y ya alcanzaron números respetables — un A100 supera a 80 cores Xeon Platinum 8380
   por >5×, y 8×A100 dan >30× ([Ansys blog](https://www.ansys.com/blog/unleashing-the-power-of-multiple-gpus-for-cfd-simulations)).
   STAR-CCM+ reporta 16.67× con 8×A100 y 25× con 8×H100 ([Siemens blog](https://blogs.sw.siemens.com/simcenter/cfd-on-gpu-a-seamless-disruption/)).
   O sea: **la ventaja pura de "GPU" ya se está cerrando**; los legados la copiaron en 2 años.
2. **El surrogate cambia el eje de costo.** Entrenar cuesta carísimo una vez (miles de RANS de 30M
   celdas). Inferir cuesta casi cero, siempre. El modelo de negocio de la ola 2 es **amortizar un
   dataset**. Por eso todos están publicando datasets abiertos (DrivAerML, WindsorML, AirfRANS,
   SHIFT): quieren fijar el benchmark.
3. **Datasets abiertos que podemos usar sin pedir permiso:**
   - **DrivAerML** — 500 variantes paramétricas, hybrid RANS-LES, **CC-BY-SA 4.0, uso comercial
     permitido con atribución** ([arXiv:2408.11969](https://arxiv.org/pdf/2408.11969))
   - **WindsorML** — 355 variantes, CC-BY-SA, descarga por S3 sin cuenta AWS ([arXiv:2407.19320](https://arxiv.org/pdf/2407.19320))
   - **AirfRANS** — RANS incompresible 2D sobre perfiles, subsónico, distintos ángulos de ataque
   - **SHIFT-Wing** — no comercial ([HF](https://huggingface.co/datasets/luminary-shift/WING))
   Los tres primeros son automotrices; **para aeronáutica el material abierto es mucho más pobre**.
   Ese es un dato relevante para el plan: si queremos un surrogate aero propio, o lo generamos
   nosotros (iangpu + SU2) o nos limitamos a 2D/perfiles.

### C.4 NeuralFoil — el hallazgo que cambia nuestro plan

De todo lo que investigué, **esto es lo más accionable**. NeuralFoil (Peter Sharpe y R. John Hansman,
MIT) es un surrogate físicamente informado de **XFOIL** — el mismo problema que nosotros tenemos que
resolver para perfiles, ya resuelto y con licencia MIT.

| Dato | Valor | Fuente |
|---|---|---|
| Qué hace | CL, CD, CM, transición arriba/abajo, distribución de velocidad, + una métrica de `analysis_confidence` | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |
| Espacio de entrada | 18 dimensiones de forma de perfil (incl. deflexión de superficies de control), **360° de ángulo de ataque**, **Re de 10² a 10¹⁰**, subsónico hasta el drag rise transónico | [arXiv:2503.16323](https://arxiv.org/pdf/2503.16323) |
| Entrenamiento | ~8 millones de corridas de XFOIL (el paper cita "decenas de millones" en su versión extendida) | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |
| Velocidad | **1.4–6.1 ms por evaluación** según tamaño de modelo vs **73 ms de XFOIL** (~30×). 100,000 corridas: **0.87–12 s vs 42 minutos** de XFOIL (~1000× en multipunto) | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |
| Exactitud | MAE en CL de 0.012–0.040; en ln(CD) de 0.020–0.078; en CM de 0.002–0.007. Error medio de arrastre: **0.37% en casos simples, 2.0% con post-stall/transicional** | [GitHub](https://github.com/peterdsharpe/NeuralFoil), [arXiv:2503.16323](https://arxiv.org/abs/2503.16323) |
| Arquitectura | **25 entradas → 198 salidas**, de 2 a 6 capas ocultas de 48 a 512 unidades, activación Swish. 8 tamaños, de `xxsmall` a `xxxlarge` → **unos cientos de KB** | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |
| Implementación | **Python + NumPy puro** en tiempo de ejecución (entrenado en PyTorch). Sin dependencias exóticas. **Sin export a ONNX, sin puerto a JS** | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |
| Licencia / actividad | **MIT** · 455 ⭐ · último push 19-jul-2026 (vivo) | [GitHub](https://github.com/peterdsharpe/NeuralFoil) |

**Por qué esto importa tanto:** un MLP de 25→198 con ≤6 capas de ≤512 y pesos en un `.npz` es
literalmente **multiplicación de matrices**. Exportarlo a `.onnx` y servirlo con `onnxruntime-web`
(13.1 millones de descargas npm al mes, backend WebGPU estable) es trabajo de días, no de meses, y
corre en el navegador en **microsegundos** porque no hay que cargar Python. **La Forja puede tener
análisis de perfil de calidad-XFOIL, interactivo, sin servidor, sin instalación y sin licencia.**

**Verificado: no existe puerto a ONNX ni a JS.** Y el detalle competitivo que hay que subrayar:
`aircraftdesign.io` **ya usa NeuralFoil, pero del lado del servidor**. La licencia MIT nos deja
pasar y la ventaja de ejecutarlo en el cliente sigue sin tomar dueño.

Bonus didáctico: NeuralFoil expone una salida `analysis_confidence`. Es de los pocos surrogates que
**avisa cuando no sabe**. Para una escuela, eso vale oro: el alumno ve en vivo cómo el modelo pierde
confianza al salirse del dominio, que es exactamente la lección que la regla 4 del contrato pide
("el ingeniero debe saber CUÁNDO la ecuación deja de ver").

### C.5 Lo que la ola nueva NO resolvió (y hay que decirlo en la propuesta)

- **Generalización fuera de distribución.** La literatura 2025-2026 es explícita: los surrogates
  como operadores neuronales supervisados "son potentes dentro de la distribución pero acoplan
  fuertemente el modelo a las variables de condicionamiento y al proceso generador de datos usado
  en el entrenamiento" ([arXiv:2605.08832](https://arxiv.org/pdf/2605.08832)). Traducido: si el
  alumno dibuja un ala que no se parece a nada del dataset, el modelo **no avisa que está mintiendo**
  — salvo que traiga métrica de confianza, como NeuralFoil.
- **El transónico sigue siendo el muro.** Ver la tabla de SHIFT-Wing: el CM se degrada 4× al pasar de
  M=0.5 a M=0.85. Hay trabajo activo específicamente sobre "empujar los surrogates neuronales al
  régimen transónico altamente turbulento" ([arXiv:2511.21474](https://arxiv.org/html/2511.21474)),
  lo que confirma que en 2026 todavía **no** es un problema cerrado.
- **Detección de fuera-de-distribución para diseño de aeronaves** es un área de investigación con
  nombre propio (SmOOD, [arXiv:2209.03438](https://arxiv.org/pdf/2209.03438)); no es un feature
  resuelto de producto.
- **Certificación.** No encontré ningún caso en que una autoridad aeronáutica acepte un surrogate
  neuronal como evidencia de cumplimiento. **NO VERIFICADO que exista.** Todos los casos publicados
  son de *exploración de diseño*, no de *certificación*.

---

## D. SIMULACIÓN EN EL NAVEGADOR — nuestro terreno

> Esta sección responde la pregunta que importa: **¿está vacío el hueco?** La respuesta corta es
> **sí, pero se está empezando a llenar y el 2D ya se llenó en marzo de 2026.**

### D.1 El piso técnico: WebGPU a agosto de 2026

| Dato | Valor | Fuente |
|---|---|---|
| Soporte global | **83.63%** | [caniuse.com/webgpu](https://caniuse.com/webgpu) |
| Chrome escritorio | v113+ (2023); Linux desde v144 (Intel Gen12+), v147 NVIDIA/Wayland | [gpuweb wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) |
| Firefox | Windows desde **v141 (22-jul-2025)**; macOS v145/v147; **Linux y Android todavía en desarrollo**, meta 2026 | [Mozilla gfx](https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/) |
| Safari | **v26 por defecto** (macOS/iOS/iPadOS/visionOS) | [gpuweb wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) |
| Subgroups | Enviado (Chrome 134, feb-2025); `subgroup_id` en Chrome 144 (7-ene-2026); `subgroup_uniformity` en Chrome 145 | [Chrome 144](https://developer.chrome.com/blog/new-in-webgpu-144), [Chrome 145](https://developer.chrome.com/blog/new-in-webgpu-145) |
| Subgroup / cooperative matrices | **TODAVÍA NO ENVIADO**, en investigación desde nov-2024 | [What's next for WebGPU](https://developer.chrome.com/blog/next-for-webgpu) |

**FP64: NO EXISTE, y no está en la ruta corta.** La lista completa de features opcionales de WebGPU
(22 features) no incluye ningún f64; la única precisión extra es `shader-f16`
([MDN GPUSupportedFeatures](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedFeatures)).
El issue del spec [gpuweb#2805 "Double precision floats (IEEE-754 binary64)"](https://github.com/gpuweb/gpuweb/issues/2805)
está abierto desde el **28 de abril de 2022**, con milestone "Milestone 4+" sin fecha y sin actividad
reciente.

**Los límites que de verdad duelen** ([MDN GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits)):

| Límite | Default |
|---|---|
| `maxStorageBufferBindingSize` | **128 MB** |
| `maxBufferSize` | **256 MB** |
| `maxComputeInvocationsPerWorkgroup` | 256 |
| `maxComputeWorkgroupStorageSize` | 16 KB |

Cuenta rápida: un LBM D3Q19 en FP32 gasta 19 floats × 2 buffers = 152 B/celda → con 128 MB por
binding salen ~880k celdas, o sea una malla de **96³**. Se puede subir pidiendo límites mayores al
adapter y particionando en varios buffers, pero esa es la línea base honesta. Para nuestro caso
(VLM/paneles, no CFD volumétrico) es holgadísimo: una matriz de influencia de 2,000 paneles en f64
son 32 MB.

**Decisión de arquitectura que sale de aquí:** el álgebra lineal del solver va en **WASM con f64
nativo**; **WebGPU se usa para campos, streamlines, partículas y render**, no para el solver.

### D.2 CAD en el navegador — quién tiene el kernel del lado del cliente

| Proyecto | ¿Kernel en el cliente? | Tecnología | Madurez (⭐ / último push) | Precio | URL |
|---|---|---|---|---|---|
| **Chili3D** | **SÍ, todo** | OCCT 7.9.1 → WASM + Three.js, TS | **4,717 ⭐ · push 3-ago-2026** · AGPL-3.0 | Gratis | [github](https://github.com/xiangechen/chili3d) |
| **occt-wasm** (andymai) | **SÍ** | OCCT **V8** → WASM, API TS, SIMD + tail calls | 36 ⭐ · push 4-ago-2026 · **~4.5 MB brotli, la mitad que opencascade.js** · 13,662 desc/mes | Gratis | [github](https://github.com/andymai/occt-wasm) |
| **opencascade.js** | **SÍ** | OCCT 7.6.2 → Emscripten | 912 ⭐ · **push 15-ago-2023 → ~3 años dormido** · 74,891 desc/mes | Gratis LGPL-2.1 | [github](https://github.com/donalffons/opencascade.js) |
| **brepkit** | **SÍ** | **Kernel B-Rep escrito de cero en Rust → WASM**, NURBS + analítica exacta | 17 ⭐ · push 4-ago-2026 · MIT/Apache | Gratis | [github](https://github.com/andymai/brepkit) |
| **replicad** | SÍ (sobre opencascade.js) | TS | 661 ⭐ · push 17-jul-2026 · MIT | Gratis | [github](https://github.com/sgenoud/replicad) |
| **CascadeStudio** | SÍ | opencascade.js (OCCT 8.0.0 RC4) | 1,440 ⭐ · push 16-jun-2026 · MIT | Gratis | [github](https://github.com/zalo/CascadeStudio) |
| **JSCAD** | SÍ pero **CSG de malla, NO B-Rep** | JS | 3,217 ⭐ · push 2-ago-2026 · MIT · **152,907 desc/mes** | Gratis | [github](https://github.com/jscad/OpenJSCAD.org) |
| **Onshape** | ❌ **NADA.** Parasolid + D-Cubed en servidores AWS; el navegador recibe teselaciones | — | Producción, líder | Free $0 (todo público) · **Standard $1,500/usuario/año** · **Professional $2,500** (Simulation incluida) · Enterprise a cotizar · Educación gratis | [pricing](https://www.onshape.com/en/pricing) |
| **Zoo / KittyCAD** | ❌ **NADA.** Literal en su FAQ: *"Zoo Design Studio requiere conexión porque el procesamiento y nuestro geometry engine corren en la nube"* | App desktop nativa; engine GPU propietario | modeling-app 1,267 ⭐ · MIT (solo la app) | Text-to-CAD $0.50/min, 20 min gratis | [FAQ](https://zoo.dev/docs/faq) |
| **Fusion (web)** | ❌ Visor / escritorio remoto. **El proyecto WebAssembly ya no está disponible** | — | Producción como visor | Suscripción | [Autodesk](https://www.autodesk.com/support/technical/article/caas/tsarticles/ts/4GAYwrd9SV4MJlh68wUATv.html) |
| **Ondsel** | ☠️ **MUERTO.** Anunció cierre 30-oct-2024, cerró **22-nov-2024**; IP donada a FreeCAD | — | — | — | [blog de cierre](https://www.ondsel.com/blog/goodbye/) |

**Benchmark duro OCCT-WASM vs kernel Rust nativo** (brepkit-wasm 2.115.8, Node/Linux x86_64, 5
iteraciones, 23-jun-2026 — [latest.md](https://raw.githubusercontent.com/andymai/brepjs/main/benchmarks/results/latest.md)):

| Operación | brepkit | OCCT-WASM | Factor |
|---|---|---|---|
| Box 10×20×30 | 0.2 ms | 3.0 ms | 13.4× |
| **Union** | 0.5 ms | **43.2 ms** | 90.8× |
| **Intersection** | 0.3 ms | **61.8 ms** | 243.7× |
| Cut | 62.8 ms | **69.8 ms** | 1.1× |
| Malla de esfera (tol 0.01) | 34.6 ms | 48.0 ms | 1.4× |
| Exportar STEP ×10 | 1.0 ms | 13.5 ms | 13.5× |

> **Lectura para nosotros:** OCCT-en-WASM es lento en booleanas. Un árbol de features de aeronave con
> 30 booleanas son ~1.5–2 s de rebuild. **Presupuesta el rebuild, no el frame.** Para el modo
> conceptual, prefiere lofts de superficie sin booleanas y mete el kernel en un Web Worker.

### D.3 CFD y fluidos en el navegador — casi todo es decorativo

| Proyecto | Corre en cliente | Técnica | Madurez | Fidelidad | URL |
|---|---|---|---|---|---|
| **Kutta** | Todo | Go → WASM, **LBM D2Q9 BGK** | 127 ⭐ · push 3-ago-2026 · MIT | ⚠️ el propio autor: *"qualitative, not validated CFD"* | [github](https://github.com/crgimenes/kutta) |
| **WebGPU-Ocean** | Todo | WebGPU, MLS-MPM + SPH | 540 ⭐ · push 9-jun-2025 · ~300k partículas en dGPU | Visual, no ingenieril | [github](https://github.com/matsuoka-601/WebGPU-Ocean) |
| **kishimisu/WebGPU-Fluid** | Todo | WebGPU, Jos Stam 1999 | 135 ⭐ · push 2023 | Visual | [github](https://github.com/kishimisu/WebGPU-Fluid-Simulation) |
| **MechSimulator Wind Tunnel** | Todo | Flujo potencial: doublet + Kutta-Joukowski + eddies empíricos, 2D | Producto vivo, gratis, sin registro | ⚠️ Cd empíricos; arrastre inducido con **AR=6 forzado** | [mechsimulator.com](https://mechsimulator.com/tools/wind-tunnel/) |
| **SimScale** | ❌ **NADA**, solo UI y visor | **Pacefish®** (LBM en GPU, Numeric Systems GmbH), LES Smagorinsky, SST-DDES/IDDES, k-ω SST. "20–30× más rápido" | Producción, líder | CFD real validado | [Pacefish](https://www.simscale.com/product/integrations-partners/numeric-systems/) |

**SimScale, precio verificado:** Community **gratis** con **3,000 core-hours y 10 simulaciones**
(proyectos públicos solamente; pasado el límite solo da resultados cualitativos). Mechanical /
Professional / Enterprise = **cotización a medida, precio NO publicado**; Professional incluye 10,000
core-hours. "Physics AI" es opcional en los planes medios e incluido en Enterprise.
([pricing](https://www.simscale.com/product/pricing/), [foro oficial](https://www.simscale.com/forum/t/simscale-plans-pricing/27827))

### D.4 Aerodinámica específica en el navegador — aquí está la noticia

| Producto | ¿Física en el cliente? | Tecnología | Estado | Precio | URL |
|---|---|---|---|---|---|
| **FlexFoil** (Flexcompute) | ✅ **SÍ, 100% cliente.** *"El cómputo ocurre en tu máquina, no en la nuestra. Tus datos de perfil nunca salen de tu navegador"* | **Rust → WASM.** Método de Drela fiel: paneles de vorticidad lineal + capa límite integral + transición e^N + acople viscoso-invíscido con Newton global. Multi-cuerpo (slat/flap/main) | **Publicado 17-mar-2026.** Metas del README: **inviscid &lt;16 ms para 200 paneles (60 Hz), bundle WASM &lt;500 KB gzip**. Repo 11 ⭐, MIT, push 25-jul-2026 | App gratis; **el solver Rust se liberará bajo GPL** | [blog](https://hs.flexcompute.com/blog/flexfoil) · [app](https://foil.flexcompute.com/flexfoil/) · [github](https://github.com/flexcompute/flexfoil) |
| **WebXFOIL** (PR-DC) | ✅ Sí | **XFOIL 6.996 en Fortran → flang-wasm + Emscripten**, headless, ESM | 2 ⭐, push 1-mar-2026, GPL-2.0+ | Gratis | [github](https://github.com/PR-DC/WebXFOIL) · [webxfoil.com](https://webxfoil.com) |
| **Ai.rplane** (PhysicsX) | ❌ Nube (inferencia LGM-Aero) | Modelo fundacional | Vivo, es su escaparate | **Gratis** | [physicsx.ai](https://www.physicsx.ai/newsroom/welcome-to-airplane) |
| **aircraftdesign.io** | ❌ Nada. Stack declarado: **Python, OpenVSP, SU2, OpenMDAO, AeroSandbox, NeuralFoil, FastAPI** | Cloud-native | Builder paramétrico vivo; **"Analysis: Coming Soon"** al 4-ago-2026 | **€29 / €99 / €249 al mes** (2k / 10k / 50k créditos), −20% anual, 30 días de garantía. Sin capa gratuita. **No publica quién lo hace** | [sitio](https://aircraftdesign.io/) · [pricing](https://aircraftdesign.io/pricing) |
| **AirShaper** | ❌ Nube (OpenFOAM detrás) | UI web | Maduro | **€990/año** (Discovery, 25 créditos, 1M celdas) · **€2,990/año** (Professional, 100 créditos, 10M celdas) · Enterprise desde 500 créditos (100M celdas) | [pricing](https://airshaper.com/pricing) |
| **Engineering Sketch Pad (ESP)** | ❌ Servidor local, el navegador es la UI | OpenCSM, Haimes (MIT) + Dannenhoffer (Syracuse) | Vivo; **Flexcompute mantiene un fork público** | Open source | [AIAA 2013-3073](https://acdl.mit.edu/ESP/Publications/AIAApaper2013-3073.pdf) · [fork](https://flexcompute.github.io/EngineeringSketchPad/EngSketchPad/ESP/ESP-help.html) |
| **MachUp (machup4/5)** | ❌ Servidor | Línea sustentadora numérica | Académico (Utah State) | Gratis | [MDO Lab](https://mdolab.engin.umich.edu/wiki/aircraft-design-software) |
| **Webfoil** (MDO Lab, Michigan) | ❌ Servidor | Surrogate de datos (Li et al. 2019) | Vivo | Gratis | [MDO Lab](https://mdolab.engin.umich.edu/bibliography/Li2019b) |
| **AeroSandbox** | ❌ Python puro; sus "web apps" son Dash = servidor | CasADi / AD | 1,291 ⭐, push 5-jul-2026, MIT | Gratis | [github](https://github.com/peterdsharpe/AeroSandbox) |
| **OpenVSP** | ❌ Solo escritorio (VSPAERO = VLM + paneles) | C++ | 819 ⭐, push 2-ago-2026, NOSA | Gratis | [github](https://github.com/OpenVSP/OpenVSP) |

### D.5 ML surrogates en el navegador

| Pieza | Estado | Dato duro |
|---|---|---|
| **ONNX Runtime Web** | Producción, backend WebGPU maduro | **13,143,169 descargas npm/mes**; microsoft/onnxruntime 21,270 ⭐, push 4-ago-2026 |
| **transformers.js** | WebGPU experimental (`device: 'webgpu'`, fp32/fp16/q8/q4) | 16,229 ⭐; `@huggingface/transformers` 7,373,660 desc/mes |
| **TensorFlow.js** | Vivo pero desacelerado | 19,133 ⭐, último push 23-jun-2026 |
| **jsfluids / cfdonnx (SIMZERO)** — *el único intento real de servir un surrogate de CFD en navegador* | ☠️ **MUERTO.** El repo `simzero/jsfluids` da 404; toda la organización tiene su último push en 2022-2023 | Anunciado por Microsoft el [25-jul-2023](https://opensource.microsoft.com/blog/2023/07/25/connect-fluid-dynamics-machine-learning-and-virtual-reality-with-onnx-runtime): U-Net por ONNX Runtime + Babylon.js. **Abandonado.** |
| **NeuralFoil** | Sin export ONNX, sin puerto JS | ver §C.4 |

### D.6 La evidencia negativa — el dato más valioso de este reporte

Búsquedas ejecutadas contra la **API de GitHub** el 4 de agosto de 2026:

1. `vortex lattice`, top 20 por estrellas → **cero repos en JavaScript, TypeScript o WASM.** Todo el
   ecosistema es MATLAB (159, 16, 15, 8 ⭐), Python (51, 44, 42, 9, 8, 8, 7), Julia (60, 49, 9), C++
   (32), C# (85), VB.NET (21), Fortran (12). **La técnica base del diseño conceptual de aeronaves no
   ha sido portada a la web ni una sola vez.**
2. `xfoil`, top 20 por estrellas → **cero web.** Las dos únicas implementaciones de navegador que
   existen tienen **11 ⭐ y 2 ⭐** (FlexFoil y WebXFOIL, ambas de 2026).
3. `aerodynamics --language JavaScript` → el máximo es **9 ⭐** (tutorial de lifting-line de 2017).
4. `finite element wasm browser` → **1 resultado, 3 ⭐.** FEA en navegador prácticamente no existe.
5. `webgpu cfd` → **1 resultado, 0 ⭐.**

### D.7 El mapa del hueco

```
                    corre en CLIENTE          corre en SERVIDOR
                ┌──────────────────────┬──────────────────────────┐
  CAD B-Rep     │ MADURO                │ MADURO                   │
  paramétrico   │ Chili3D 4.7k*         │ Onshape, Zoo, Fusion     │
                │ occt-wasm 4.5 MB      │ ($1.5-2.5k/usuario/año)  │
                ├──────────────────────┼──────────────────────────┤
  Aero 2D       │ RECIÉN RESUELTO       │ maduro                   │
  (perfil)      │ FlexFoil (mar 2026)   │ airfoiltools,            │
                │ WebXFOIL              │ aircraftdesign.io        │
                ├──────────────────────┼──────────────────────────┤
  Aero 3D       │ >>> VACÍO <<<         │ MADURO                   │
  (VLM/paneles/ │ CERO repos JS/TS/WASM │ OpenVSP+VSPAERO, AVL,    │
   aeronave)    │ CERO productos        │ SU2, aircraftdesign.io   │
                ├──────────────────────┼──────────────────────────┤
  CFD           │ juguetes (Kutta 127*, │ MADURO                   │
  volumétrico   │ "no validado")        │ SimScale/Pacefish LBM GPU│
                ├──────────────────────┼──────────────────────────┤
  ML surrogate  │ >>> VACÍO <<<         │ aircraftdesign.io usa    │
  aero          │ el único intento      │ NeuralFoil server-side   │
                │ (jsfluids) murió 2023 │                          │
                └──────────────────────┴──────────────────────────┘
```

### D.8 Por qué está vacío (las tres razones reales)

1. **Bifurcación cultural.** Quien sabe aerodinámica escribe Fortran, Python o Julia. Quien sabe
   WebGPU hace efectos de agua bonita. La intersección es casi nula y los datos de GitHub lo muestran
   con brutalidad: 20 repos de VLM y ni uno toca la web.
2. **El modelo de negocio empujó a la nube.** SimScale, Onshape y Zoo **eligieron** servidor porque
   vende licencias por asiento y protege el IP del kernel. Nadie con capital tiene incentivo para
   poner el solver en el cliente.
3. **Y sin embargo el mercado castiga a quien lo intenta sin vertical.** Ondsel cerró en noviembre de
   2024 tras dos años: encontró hobbistas pero no adopción comercial que justificara capital de
   riesgo. Es la advertencia más importante de toda esta investigación.

### D.9 Las señales de que el hueco se está llenando (tenemos 12–24 meses)

- **17-mar-2026 — FlexFoil.** Una empresa de CFD seria (la de Flow360) reimplementó XFOIL completo
  en Rust→WASM del lado del cliente, con meta de 60 Hz. Prueba de que el approach funciona **y de
  que los serios ya lo notaron.** Todavía es 2D.
- **26-jul-2025 — OCP.wasm.** build123d/OCCT completo en el navegador vía Pyodide.
- **2026 — brepkit.** Alguien escribe un kernel B-Rep exacto desde cero en Rust para WASM, con
  booleanas 90–243× más rápidas que OCCT-WASM.

---

## E. LA ESCUELA — contra qué nos van a comparar

> Nota de método: los precios de esta sección vienen de páginas de proveedor, catálogos PDF y
> reportes de usuarios en foros oficiales. Tipo de cambio usado: **1 USD = 17.32 MXN / 0.744 GBP /
> 0.869 EUR** (4 de agosto de 2026). Todo lo que no está confirmado en fuente primaria va marcado
> **NO VERIFICADO**.

### E.1 Los vendors de CFD — "gratis para enganchar, opaco para cobrar"

| Oferta | Proveedor | Formato | Precio (fuente) | Hueco |
|---|---|---|---|---|
| **Ansys Innovation Courses** | Ansys | Self-paced | **$0**, 315+ cursos ([learning-library](https://innovationspace.ansys.com/learning-library/)) | Genérico, sin evaluación. **La plataforma se retira el 31-ago-2026** |
| **Ansys premium courses** | Ansys | Workshop | **Mex$8,550 ≈ US$494** por curso ([premium-courses](https://innovationspace.ansys.com/product-category/premium-learning/premium-courses/)) | Arma un usuario de un botón, no un ingeniero |
| **Ansys certifications** | Ansys | Examen + badge Credly | **Mex$5,000 ≈ US$289** (Foundations) / **Mex$8,500 ≈ US$491** (producto) ([certifications](https://innovationspace.ansys.com/product-category/certifications/)) | Certifica manejo de software, no criterio |
| **Ansys Learning Hub / ALC** | Ansys | Suscripción anual, +300 cursos | **Precio NO publicado.** Reporte de usuario en el foro oficial: *"around 2300 USD"* y *"5 x $2,320?"* ([foro Ansys](https://innovationspace.ansys.com/forum/forums/topic/learning-hub/)) — **NO VERIFICADO como precio de lista** | Opacidad: el cliente no puede comparar |
| **Ansys ILT vía canal (Ozen)** | Partner | Presencial u online | **US$750/día**; **US$2,250** el curso de 3 días ([ozeninc.com](https://ozeninc.com/training/ansys-mechanical-training/)) | Se acaba el viernes y no queda nada |
| **SimScale Community** | SimScale | Cloud | **$0**, 3,000 core-hours, 10 simulaciones ([pricing](https://www.simscale.com/product/pricing/)) | El Learning Center es **solo para suscriptores de pago** |
| **SimScale Professional/Enterprise** | SimScale | Cloud | **"Custom quote", sin precio de lista.** Reseña de tercero de 2024 dice "desde $3,000/año" — **NO VERIFICADO por el vendor** | Formación atada a suscripción |
| **SimScale Academic** | SimScale | Cloud | **$0**, 2,000 core-hours ([academic-program](https://www.simscale.com/academic-program/)) | No aplica a empresa |
| **Siemens Xcelerator Academy** | Siemens | Suscripción anual | **US$1,620/año** (NX Design) y **US$2,112** (Enterprise Teamcenter) — el monto aparece en el parámetro `listFee` de la URL del portal, **no renderizado en la página: SEMI-VERIFICADO** ([portal](https://training.plm.automation.siemens.com/mytraining/viewlibrary.cfm?memTypeID=LAAS80101&memID=LAAS80101&title=NX%20Design&listFee=1620)) | El precio ni siquiera es legible sin pasar por el carrito |
| **Simcenter STAR-CCM+ estudiantes** | Siemens | Self-paced | **$0**, 23 cursos ([blog académico](https://blogs.sw.siemens.com/academic/free-siemens-xcelerator-academy/)) | Se corta al graduarse |
| **Cadence Fidelity — Flow for Aerospace & High-speed** | Cadence | Aula, 2.25 días | **US$1,800** ([catálogo NA de precios, rev. 1-may-2026](https://www.cadence.com/content/dam/cadence-www/global/en_US/documents/training/training-na-catalog-price-list.pdf)) | ~**US$800/día** parejo |
| **Cadence Fidelity Automesh** | Cadence | Aula, 2 días | **US$1,600** (mismo PDF) | — |
| **Cadence Fidelity Turbo – Intro** | Cadence | Aula, 3 días | **US$2,400** (mismo PDF) | — |
| **Altair eLearning / Learning Hub** | Altair | Self-paced | **$0** con cuenta Altair One ([altair.com/altair-learning](https://altair.com/altair-learning)) | ILT sin precio público; el gratis es carnada de licencia |
| **SOLIDWORKS CSWA / CSWP** | Dassault | Examen | **US$99 c/u**; CSWE **US$149** | Cero física, cero aerodinámica. Además hay **3 vouchers gratis 2× al año** por asiento en subscription: la certificación es marketing |

> **Dato caliente y accionable:** el ecosistema de aprendizaje de Ansys está en migración. Innovation
> Space **se retira el 31 de agosto de 2026** —dentro de cuatro semanas— hacia el nuevo Ansys
> Learning Center. Cualquier currícula corporativa colgada de esos links se rompe este mes.
> Fuente: [innovationspace.ansys.com/learning-library](https://innovationspace.ansys.com/learning-library/).

### E.2 Aerodinámica y diseño de aeronaves — el agujero está en medio

| Oferta | Proveedor | Formato | Precio (fuente) |
|---|---|---|---|
| **Introduction to Aeronautical Engineering** | TU Delft / edX | MOOC 8 semanas | **Gratis**; certificado verificado ~US$50 (**NO VERIFICADO para 2026**) ([TU Delft](https://learningforlife.tudelft.nl/introduction-aeronautical-engineering/)) |
| **Coursera Plus** | Coursera | Suscripción | **MX$670/mes ≈ US$39** · **MX$4,590/año ≈ US$265** ([coursera.org/courseraplus](https://www.coursera.org/courseraplus)) |
| **Udemy — ANSYS CFD external aero & turbomachinery** | Udemy | 24.5 h de video | **NO VERIFICADO** (Udemy devuelve 403). Lista típica US$99.99 con promos a US$10–20. Reseñas: *"prioriza el software sobre la física"* |
| **AIAA — Foundations of CFD with OpenFOAM** | AIAA | Online en vivo, 1.6 CEU | **US$895 socio / US$1,095 no socio** ([catálogo AIAA 2025-2026, p.9](https://aiaa.org/wp-content/uploads/2025/07/AIAA-Fall-Course-Catalog-2025.pdf)) |
| **AIAA — Turbulence Modeling for Aerodynamic Flows** | AIAA | Online, 0.8 CEU | **US$595 / US$795** (mismo catálogo, p.24) — 8 horas para EL tema que más errores causa |
| **AIAA — Wind Tunnel Testing for Aircraft Development** | AIAA | Online, 1.8 CEU | **US$995 / US$1,195** (p.25) |
| **AIAA — Electric VTOL Aircraft Design** | AIAA | Online, 2.0 CEU | **US$945 / US$1,145** |
| **AIAA — Machine Learning for Aircraft Applications** | AIAA | Online (inicia 21-sep-2026) | **US$1,195 socio / US$1,395 no socio / US$595 estudiante** ([aiaa.org](https://aiaa.org/courses/machine-learning-for-aircraft-applications/)) |
| **AIAA — rango general** | AIAA | ~90 cursos, 0.8–3.6 CEU | **US$495–1,695**; todos entregan "certificate of completion" **sin examen** |
| **Dan Raymer — 5-Day Aircraft Design Short Course** | Aircraft Design Research LLC | Presencial, 5 días | **US$2,980** (incluye notas + su libro); +$50 wire / +$110 PayPal ([aircraftdesign.com](https://aircraftdesign.com/the-5-day-aircraft-design-course/)) · mismo precio vía [ATI Courses](https://aticourses.com/courses-2/9-aircraft-conceptual-design/) |
| **Raymer — UAV Aircraft Design (vía AIAA)** | AIAA | 3 días / 24 h | **Precio a consulta** ([AIAA](https://aiaa.org/courses/uav-aircraft-design-by-dan-raymer/)) |
| **OpenFOAM oficial (ESI/OpenCFD)** | ESI | Sesiones | **1,400 EUR o US$1,600 por persona por sesión**; **12 días = US$6,950/persona** ([openfoam.com/trainings](https://www.openfoam.com/trainings/training-schedule-and-booking)) |
| **Wolf Dynamics OpenFOAM** | Wolf Dynamics | Módulos | **350 EUR por módulo**, −15% con 2+, −25% con 5+ ([wolfdynamics.com](https://www.wolfdynamics.com/our-services/training/openfoam-intro-training.html)) |
| **CFD Direct** | CFD Direct | 5 cursos de 2 días | **Sin precio publicado.** Su propio marketing: *"equivale a 1–2 semanas del costo de nómina de un ingeniero CFD"* ([cfd.direct](http://cfd.direct/openfoam-training)) |
| **Purdue — Online MS AAE** | Purdue | 30 créditos | **US$1,139/cr in-state → US$34,170** · **US$1,459/cr internacional → US$43,770** ([Purdue AAE](https://engineering.purdue.edu/AAE/academics/graduate/online)) |
| **Georgia Tech — MSAE online** | GT | 33 créditos | **US$3,415 por curso de 3 cr → ≈US$37,500** ([pe.gatech.edu](https://pe.gatech.edu/degrees/aerospace-engineering)) |
| **Cranfield — MSc Computational Fluid Dynamics** | Cranfield | 1 año FT | **£13,005 UK · £29,025 internacional** (2026-27) ([Cranfield](https://www.cranfield.ac.uk/courses/taught/computational-fluid-dynamics)) — el currículo más cercano a "ingeniero CFD real" que existe |

**El curso de Raymer merece párrafo aparte, porque es nuestro cliente.** Es el estándar de facto del
diseño conceptual de aeronaves: US$2,980, 5 días, incluye su libro, y ha pasado por él **más de
5,000 personas**. Su propia página, al 4 de agosto de 2026, dice: *"You just missed it. Contact
Aircraft Design Research LLC to be notified when it is next scheduled."* **La formación más
importante de la industria se imparte una vez al año, por una sola persona.** Ese es el hueco
estructural más grande de toda esta investigación — y es exactamente lo que el cliente nos pidió
resolver.

### E.3 Certificaciones — solo una mide competencia, y es la más barata

| Certificación | Qué mide | Precio |
|---|---|---|
| SOLIDWORKS CSWA/CSWP/CSWE | Manejo de CAD | US$99–149 (gratis con subscription) |
| Ansys "Foundations in Fluid Dynamics" | Manejo de Fluent/Discovery | ~US$289 |
| Ansys "Getting Started with Ansys Fluent" | Manejo de Fluent | ~US$491 |
| **NAFEMS PSE (Professional Simulation Engineer)** | **Competencia en simulación, independiente del vendor, por portafolio + entrevista** | Entry £115/US$154 socio, £175/US$234 no socio · Standard £290/US$399 socio, £430/US$591 no socio · Advanced igual que Standard · entrevista extra £175/£260 ([fees](https://www.nafems.org/professional-development/certification/application-information/fees/)) |

Y para formación software-neutral, la referencia es NAFEMS:
- **"Introduction to Practical CFD"** — e-learning, 6 sesiones de 2–2.5 h, 12 PDH:
  **£341.25 / US$458 socio · £505.17 / US$678 no socio** ([nafems.org](https://www.nafems.org/training/e-learning/introduction-practical-cfd/))
- **e-learning Flexipass** — 10 asientos, 1 año: **£2,957.25 / US$3,969 socio · £4,600.16 / US$6,174
  no socio** → **US$397–617 por ingeniero**, el benchmark más limpio de "escuela para un equipo"
  ([flexipass](https://www.nafems.org/training/e-learning/flexipass/))

**Recomendación:** mapear nuestra currícula a las áreas técnicas del **NAFEMS PSE**. Da credencial
externa reconocible sin que tengamos que inventar una, y cuesta menos que un día de Cadence.

### E.4 Qué dicen los ingenieros de verdad

⚠️ **Advertencia de honestidad:** Reddit y CFD-Online bloquean el fetcher (403). Las URLs están
verificadas; el contenido se leyó **solo vía snippets de buscador**. Si el cliente va a decidir con
esto, hay que abrir los hilos.

- r/CFD — *"How do you recommend people learn CFD?"* [hilo](https://www.reddit.com/r/CFD/comments/16brswf/how_do_you_recommend_people_learn_cfd/)
- r/CFD — *"Very confused as to where to start learning CFD"* → el consejo recurrente es empezar por
  **el libro de John Anderson** [hilo](https://www.reddit.com/r/CFD/comments/ujdell/very_confused_as_to_where_to_start_learning_cfd/)
- r/CFD — *"I want to learn CFD"* → *"OpenFOAM community is probably best if you want to learn cfd"*
  [hilo](https://www.reddit.com/r/CFD/comments/vafklf/i_want_to_learn_cfd/)
- r/CFD — *"Universities for CFD"*: la oferta académica es **inconsistente** entre universidades
  [hilo](https://www.reddit.com/r/CFD/comments/1bqrkbd/)
- r/AerospaceEngineering — *"most engineers in the industry don't have aerospace degrees"*
  [hilo](https://www.reddit.com/r/AerospaceEngineering/comments/mny9am/)
- CFD-Online — *"How to learn CFD (For Absolute Beginners)"*, 69 likes
  [hilo](https://www.cfd-online.com/Forums/main/232703-how-learn-cfd-absolute-beginners.html)
- Foro oficial Ansys sobre el precio del Learning Hub: *"around 2300 USD"*
  [hilo](https://innovationspace.ansys.com/forum/forums/topic/learning-hub/)

**El patrón:** la ruta real que la gente reporta es *libro (Anderson / Versteeg) → OpenFOAM o Fluent
a prueba y error → un senior que te corrige*. **Nadie dice "pagué el curso del vendor y aprendí".**
El vendor enseña la interfaz; la física y el juicio se aprenden por ósmosis con un senior — y ese
senior es el recurso más escaso de la empresa del cliente. Nuestra escuela compite contra el senior
escaso, no contra Udemy.

### E.5 La tendencia 2024–2026: la IA llegó al solver antes que al aula

- **Ansys SimAI** en dos niveles (Pro local / Premium nube) con integración a optiSLang para generar
  datos de entrenamiento ([ansys.com/products/ai/simai](https://www.ansys.com/products/ai/simai)).
- **Ansys Engineering Copilot**: asistente por IA embebido en medini analyze, ModelCenter y Rocky,
  que responde preguntas de física e ingeniería **dentro de la herramienta**.
- **Siemens Designcenter CAD AI**: copiloto + asistente por voz
  ([siemens.com](https://www.siemens.com/en-us/products/designcenter/cad-software-ai/)).
- **Autodesk Neural CAD**: promete automatizar 80–90% de tareas rutinarias con agentes.
- **Altair HyperWorks 2026**: IA integrada en CAE.

Y el dato que hay que leer dos veces: el paper de **NAFEMS World Congress 2025 sobre "democratización"**
([NWC25-0007082](https://www.nafems.org/publications/resource_center/nwc25-0007082-paper/)) propone
explícitamente **reestructurar responsabilidades en vez de entrenar** — que el ingeniero de CAD
genere modelos simulation-ready y que agentes de automatización CAE hagan lo que antes requería un
analista, *"reduciendo la dependencia de la escasa experiencia CAE"*.

> **La industria admite por escrito que no puede formar analistas al ritmo que los necesita, y su
> respuesta es automatizar alrededor del problema.** Esa es a la vez la amenaza y la oportunidad.
> La respuesta de La Forja puede ser la contraria: formarlos de verdad, dentro del CAD, con la IA
> como tutor y no solo como solver.

**¿Alguien enseña ingeniería DENTRO de la herramienta?** Casi nadie:
- **Onshape Learning Center** ([learn.onshape.com](https://learn.onshape.com)) — gratis, in-app, con
  rutas de aprendizaje y certificaciones que se rinden dentro de la plataforma. **Es el modelo más
  cercano al nuestro, y solo llega a CAD.**
- **Ansys Engineering Copilot** — asistencia in-app, pero es Q&A, no currícula.
- **Siemens Learning Maps** — guías por rol, pero viven en el portal, no en el software.
- **Nadie enseña aerodinámica ni CFD dentro de la herramienta, sobre la geometría real del proyecto
  del alumno.** Ese espacio está vacío y es exactamente donde ya vive la escuela de La Forja.

### E.6 Los diez huecos de la formación actual (lo que podemos vender)

1. **Enseñan el software, no el criterio.** La decisión que rompe proyectos —qué modelo de
   turbulencia, qué y+, cuándo la malla ya no importa, cuándo el resultado es mentira— aparece en
   **un solo curso software-neutral de 12 horas** (NAFEMS, US$458) y en un máster de £29,025.
2. **Nadie evalúa si el ingeniero produce resultados correctos.** Los certificados de AIAA son "of
   completion". Los de vendor son exámenes de interfaz. **Cero verificación automática contra la
   física** — que es justo la doctrina de verification-first de La Forja.
3. **La currícula es genérica; la aeronave del cliente no aparece nunca.** Se aprende con el cuerpo
   de Ahmed y luego cada quien traduce solo.
4. **El conocimiento no se queda en la empresa.** US$750–800 por día por cabeza y el viernes no
   queda ni un caso reproducible.
5. **Formación desconectada de la herramienta.** Se aprende en un portal y se trabaja en otro lado.
6. **El material caduca con la versión, y a veces con la plataforma entera** (Innovation Space muere
   el 31-ago-2026; el curso Simcenter 3D Pre/Post ya dice "no longer offered").
7. **Precios opacos.** Un director de ingeniería no puede presupuestar formación sin cinco llamadas
   de ventas. **Publicar precio es diferenciador comercial.**
8. **El diseño conceptual de aeronaves es un cuello de botella de una sola persona** (Raymer, 5 días,
   ~1 vez al año, "you just missed it").
9. **Cero español mexicano.** Todo el catálogo serio —Ansys, AIAA, NAFEMS, Cadence, Cranfield,
   Raymer— es en inglés. Para una plantilla de ingeniería en México eso es fricción real y es un
   diferenciador barato.
10. **Nadie usa la simulación como el aula.**

### E.7 Benchmark de precio — dónde debemos aterrizar

| Nivel | Referencia de mercado | Precio por ingeniero |
|---|---|---|
| Piso gratuito | Ansys Innovation Courses, Altair eLearning, SimScale Community, TU Delft | **US$0** |
| Autoservicio genérico | Coursera Plus | **US$265/año** |
| Curso premium suelto | Ansys premium / certificación | **US$289–494** |
| Escuela para equipo (video) | NAFEMS Flexipass, 10 asientos | **US$397–617/año** |
| Suscripción de vendor | Siemens US$1,620 · Ansys ALH ~US$2,300 (reportado) | **US$1,620–2,320/año** |
| Curso con instructor | Cadence US$800/día · Ozen US$750/día · AIAA US$495–1,695 · ESI US$1,600/sesión | **US$1,600–2,980 por evento** |
| El estándar del sector | Raymer, 5 días | **US$2,980 una vez** |
| Programa completo OpenFOAM | ESI, 12 días | **US$6,950** |
| Maestría online | Purdue US$34,170–43,770 · GT ~US$37,500 · Cranfield £13,005–29,025 | **US$34k–43k total** |

> **Zona de aterrizaje recomendada: US$600 a US$2,300 por ingeniero al año.** Debajo de US$600
> competimos contra video pregrabado y perdemos margen. Arriba de US$2,300 nos comparan con el
> Ansys Learning Hub y con un tercio de una maestría de Purdue. En esa banda el argumento que gana
> no es el precio: son los huecos 1, 2, 3, 4 y 9 — **criterio verificado, sobre la aeronave del
> cliente, dentro de la herramienta, que se queda en la empresa, en español.**

Y el argumento de venta del competidor que podemos voltear: CFD Direct justifica su precio diciendo
que *"equivale a 1–2 semanas de nómina de un ingeniero CFD"*. Un ingeniero mal formado quema mucho
más que eso en un solo estudio mal mallado que llega a revisión de diseño.

---

## F. EL VEREDICTO — dónde está el hueco, y dónde no lo hay

### F.1 Donde La Forja NO puede competir (dilo tú antes de que lo diga el cliente)

Escribo esto primero a propósito. Una propuesta que solo dice en qué somos buenos no es creíble
frente a un ingeniero aeronáutico. Estas son las líneas que **no** vamos a cruzar, y hay que decirlas
en la primera junta:

| No podemos | Por qué | Quién sí lo hace |
|---|---|---|
| **RANS de un avión completo** | Necesitas decenas de millones de celdas y VRAM de servidor. El default de WebGPU es `maxStorageBufferBindingSize` = **128 MB** y `maxBufferSize` = **256 MB**; un LBM D3Q19 en FP32 gasta 152 B/celda → ~880k celdas ≈ una malla de **96³**. No es cuestión de esfuerzo: es un techo. ([MDN GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits)) | Fluent, STAR-CCM+, Flow360, Luminary |
| **Doble precisión en GPU** | **WebGPU no tiene FP64 y no lo va a tener pronto.** El issue [gpuweb#2805](https://github.com/gpuweb/gpuweb/issues/2805) lleva abierto desde el 28-abr-2022 con milestone "4+" y sin actividad reciente. Lo único extra es `shader-f16` | Cualquier solver nativo |
| **Mallado industrial de geometría sucia** | Es el trabajo de 30 años de Pointwise/Fidelity y Fluent Meshing. Ahí se va la mitad del tiempo del ingeniero y es un problema abierto | Cadence Fidelity, Ansys, Siemens |
| **Aeroelasticidad, aeroacústica, combustión, hipersónico con química** | Multi-física acoplada de verdad; cada una es una empresa | Los grandes |
| **Evidencia de certificación** | Ninguna autoridad va a aceptar un panel de vórtices en WASM como sustento de cumplimiento. Tampoco acepta un surrogate neuronal (**no verifiqué ni un solo caso donde sí**) | Túnel de viento + CFD validado + vuelo |
| **Escala HPC** | No tenemos nube. Tenemos una RTX 4070 Ti | Todos |

**Regla de oro para la propuesta:** nunca decir "reemplaza a Fluent". Decir lo que ya dice Raymer en
§1.4 sobre sus propios métodos a mano: *"they are good enough to be used to check the results of the
sophisticated computerized methods, and if they are far apart, the computer results are probably
wrong!"*. **Somos el detector de mentiras del CFD, no su sustituto.** Esa frase es del cliente, no
nuestra, y por eso funciona.

### F.2 Lo que se cerró bajo nuestros pies en 2026 (honestidad primero)

Hay que corregir una suposición cómoda antes de seguir: **el hueco del análisis de PERFIL en el
navegador ya se cerró**, y lo cerró un competidor serio.

- **FlexFoil**, de **Flexcompute** — publicado el **17 de marzo de 2026**. Es una reimplementación
  fiel del método de Drela (paneles de vorticidad lineal + capa límite integral + transición e^N +
  acople viscoso-invíscido con Newton global, multi-cuerpo slat/flap/main) en **Rust → WASM**, con
  meta declarada de **&lt;16 ms para 200 paneles (60 Hz)** y **bundle &lt;500 KB gzip**. Y lo venden
  con exactamente nuestro argumento: *"el cómputo ocurre en tu máquina, no en la nuestra; tus datos
  de perfil nunca salen de tu navegador"*. El solver se liberará bajo GPL.
  ([blog](https://hs.flexcompute.com/blog/flexfoil) · [app](https://foil.flexcompute.com/flexfoil/) ·
  [github](https://github.com/flexcompute/flexfoil))
- **WebXFOIL** (PR-DC) — XFOIL 6.996 en Fortran compilado con flang-wasm + Emscripten, headless.
  ([github](https://github.com/PR-DC/WebXFOIL) · [webxfoil.com](https://webxfoil.com))

**Consecuencia estratégica:** *no* construyamos "otro XFOIL en el navegador" como diferenciador
principal. Ya lo hizo la empresa de Flow360, y con GPL de por medio. Perfil 2D es ahora **mesa de
apuestas**, no ventaja.

### F.3 Donde La Forja SÍ puede ganar — los seis huecos que siguen abiertos

**Hueco 1 — Aero 3D en el cliente: literalmente vacío.** Este es el hallazgo más fuerte de toda la
investigación, y es evidencia negativa verificable, no opinión. Búsquedas contra la API de GitHub
el 4 de agosto de 2026:

- `vortex lattice`, top 20 por estrellas: **cero repos en JavaScript, TypeScript o WASM.** Todo el
  ecosistema VLM es MATLAB, Python, Julia, C++, C#, VB.NET y Fortran. **La técnica base del diseño
  conceptual de aeronaves no ha sido portada a la web ni una sola vez.**
- `aerodynamics --language JavaScript`: el repo con más estrellas tiene **9**, y es un tutorial de
  lifting-line de 2017.
- `webgpu cfd`: **un** resultado, **0 estrellas**.
- Los repos WebGPU de fluidos con tracción (WebGPU-Ocean 540⭐, WaterBall 393⭐) son **todos
  visuales**: MLS-MPM, SPH, Jos Stam. Cero validación, cero Reynolds, cero Cd/Cl.

Traducido: **un VLM/método de paneles 3D, en WASM con f64, acoplado en vivo a geometría paramétrica,
no existe en ningún lado** — ni open source, ni comercial, ni cloud con buena UI. Ahí es donde
debemos poner el peso.

**Hueco 2 — El CAD de conceptual no existe.** Esta es la cita del cliente y es literal (§2.1.4):
*"This emphasis on trade studies poses a problem for high-end CAD systems. They are too good! They've
been tailored for production part design, not the 'everything will change' environment of conceptual
design."* Y no es solo opinión de Raymer: una revisión crítica publicada en *Aerospace Research
Communications* (2024) concluye, sobre todo el catálogo —FLOPS, LEAPS, OpenVSP, AAA, RDS, PASS,
SUAVE, TASOPT, PrADO, MICADO, CEASIOM, VAMPZero—, que **"None covers all the aspects of the
conceptual and preliminary design process"**, que **"most are proprietary"**, que **"MDO is only a
small element in most of the tools"** y que **"No design tools have configurational optimization
capability, i.e., the configuration is decided by designer's choice instead of by design/optimization
process"** ([Frontiers/ARC 2024, doi 10.3389/arc.2024.13096](https://www.frontierspartnerships.org/journals/aerospace-research-communications/articles/10.3389/arc.2024.13096/full)).
Hay un hueco documentado en revista arbitrada. No es una corazonada nuestra.

**Hueco 3 — Nadie más corre la física del CLIENTE en el cliente.** Fuera de FlexFoil (2D), todos
—Ai.rplane, aircraftdesign.io, AirShaper, SimScale, MachUp, Webfoil, ESP, Onshape, Zoo— calculan en
servidor. Zoo lo dice literal en su FAQ: *"Zoo Design Studio requiere conexión porque el
procesamiento y nuestro geometry engine corren en la nube"*. Eso les impone tres costos que nosotros
no tenemos: costo marginal por usuario en GPU-horas, dependencia de red y de cuenta, y **la
geometría del cliente sale de su red**. Para una empresa que diseña aeronaves, ese último punto es
una conversación con legal y con seguridad. Nosotros somos una SPA estática: se sirve desde su
propia intranet, sin telemetría, sin subir nada.

**Hueco 4 — NeuralFoil sigue sin puerto al navegador.** Existe, es MIT, es NumPy puro, arquitectura
**25 entradas → 198 salidas, de 2 a 6 capas ocultas de 48 a 512 unidades** (o sea: unos cientos de
KB), y da CL/CD/CM/transición con **error medio de arrastre de 0.37%** en casos simples y **2.0%**
con post-stall/transicional, a **1.4–6.1 ms** contra **73 ms** de XFOIL; 100,000 corridas en 0.87–12 s
contra **42 minutos** de XFOIL ([github](https://github.com/peterdsharpe/NeuralFoil),
[arXiv:2503.16323](https://arxiv.org/abs/2503.16323)). **No tiene export a ONNX ni puerto a JS
(verificado: no existe).** Exportarlo y servirlo con `onnxruntime-web` es trabajo de días. Y ojo al
detalle competitivo: **aircraftdesign.io ya usa NeuralFoil, pero del lado del servidor.** Ahí está
la diferencia concreta. Además, NeuralFoil trae `analysis_confidence` — es de los pocos surrogates
que **avisa cuando no sabe**, lo cual es didácticamente valiosísimo para la escuela.

**Hueco 5 — La consolidación dejó huérfano el escalón de abajo.** En 24 meses: Synopsys se tragó a
Ansys (US$35 mil M), Siemens a Altair (~US$10 mil M, y la marca ya desapareció), Cadence a NUMECA +
Pointwise + BETA CAE + Hexagon D&E con MSC y Cradle (€2,700 M, cerrada feb-2026). **Cuatro dueños
nuevos en dos años.** Cada absorción empuja al comprador hacia la plataforma completa y hacia el
cliente grande: el de US$500,000 de contrato federal, no el ingeniero que está decidiendo si el ala
lleva 25° o 37° de flecha. Y la presión es explícita: Siemens comprometió **>US$1,000 M/año de
sinergias de ingreso** sobre el portafolio de Altair. **Nadie de ese tamaño va a construir la
herramienta de US$0 que el estudiante y el diseñador conceptual necesitan.** Ese escalón queda libre
justo cuando XFLR5 acaba de morir.

**Hueco 6 — La escuela dentro de la herramienta, y los fixtures del libro como contrato.** Todo el
entrenamiento del mercado vive *fuera* del software: cursos, videos, certificaciones, un LMS con
quizzes. La Forja ya tiene probado el patrón contrario (la escuela vive dentro de `forja-brep.html`):
**el alumno construye la geometría con croquis y cotas y la analiza con un estudio en el mismo
lienzo**. Y encima podemos hacer algo que a las empresas de Physics AI les es estructuralmente
imposible: publicar que *"este solver reproduce el Ejemplo 1.1 de Anderson con 1% de error"*. Su
error es estadístico sobre una distribución; el nuestro es verificable contra un caso canónico.
Ningún producto del mercado publica eso.

### F.4 Las dos advertencias que hay que tener a la vista

1. **Ondsel murió.** Anunció cierre el 30 de octubre de 2024 y cerró el 22 de noviembre de 2024,
   donando su IP a FreeCAD. Encontró usuarios hobbistas pero *no encontró adopción comercial que
   justificara una startup con capital de riesgo* ([blog de cierre](https://www.ondsel.com/blog/goodbye/)).
   **Un CAD generalista en el navegador ya fracasó comercialmente.** Lo que nos salva es
   precisamente lo que Ondsel no tuvo: una vertical (aeronaves), un cliente que paga, y aero
   acoplada como razón para pagar.
2. **La ventana es de 12 a 24 meses.** FlexFoil (mar-2026) demuestra que los serios ya notaron el
   approach cliente. `brepkit` demuestra que alguien está escribiendo un kernel B-Rep exacto en Rust
   para WASM. `aircraftdesign.io` ya cobra €29–€249/mes por CAD paramétrico de avión en navegador,
   con "Analysis: Coming Soon". No tenemos años.

### F.5 Posicionamiento — la frase

> **La Forja Aero es el cuaderno del diseñador conceptual: un CAD paramétrico donde la geometría, la
> aerodinámica 3D y el sizing viven en el mismo lienzo, corren en tu navegador sin instalar ni subir
> nada, y cada número que muestran se puede rastrear al ejemplo del libro que lo justifica.**

Contra quién:
- **vs. XFOIL / AVL / DATCOM** — misma física, pero interactivo, sin Fortran, sin consola, y con la
  geometría acotada en vez de un archivo de texto. AVL sigue siendo 100% consola: ese es el blanco.
- **vs. OpenVSP** — mismo espíritu (geometría paramétrica de conceptual) pero sin instalar, con
  croquis acotado en lugar de sliders, y con la escuela adentro.
- **vs. RDS-Professional** — el proceso de Raymer, en el navegador y multiplataforma. **RDS es del
  cliente: no lo posicionamos como enemigo, sino como la referencia numérica que debemos
  reproducir.** Que el módulo saque los mismos números que RDS es nuestro mejor gate. (Dato de
  contexto para negociar: RDS-Professional cuesta **$23,900 USD** la primera copia.)
- **vs. Fluent / STAR-CCM+ / Flow360** — no competimos. Somos el paso previo: el que decide *qué*
  vale la pena mallar. Y el que revisa que el resultado no sea absurdo.
- **vs. FlexFoil** — nos ganaron el 2D. No peleamos ahí: lo tratamos como estándar de la industria
  y competimos en 3D + acople paramétrico + sizing + escuela.
- **vs. Physics AI (SimAI, Neural Concept, PhysicsX, Luminary)** — ellos venden a la empresa que ya
  tiene 10,000 simulaciones propias para entrenar. Nosotros vendemos al ingeniero que todavía no
  sabe qué configuración quiere. Somos anteriores en el embudo, no competidores.
- **vs. aircraftdesign.io** — el competidor más parecido y hay que vigilarlo semanalmente.

### F.6 Recomendación clara (qué construir, en este orden)

1. **VLM / método de paneles 3D en WASM con f64, acoplado al croquis.** Es EL diferenciador: cero
   competencia verificada en todo GitHub. Bertin trae el método trabajado; son unos cientos a pocos
   miles de paneles, álgebra lineal densa, y cabe de sobra (2,000 paneles en f64 = 32 MB). Meta:
   mueves el diedro o la flecha con una cota y la polar se redibuja.
2. **NeuralFoil → ONNX → `onnxruntime-web`**, con la métrica `analysis_confidence` visible. Es el
   atajo de días que alimenta las secciones 2D viscosas del VLM. Nadie lo ha hecho en cliente.
3. **El bucle de sizing de Raymer (W/S, T/W, carpet plots, MDO) como corazón del producto.** Es lo
   que RDS hace, lo que ninguna herramienta web hace bien, y donde el cliente ve su proceso
   reflejado.
4. **Los fixtures del libro como suite de verificación visible al usuario**, no solo en CI. Una
   pestaña que corra los ejemplos de Anderson y muestre error vs. tolerancia: es control de calidad
   y es marketing al mismo tiempo.
5. **Precomputar en iangpu lo que no cabe en el navegador** (regla 6 del contrato): polares
   transónicas, correcciones de compresibilidad, tablas de campos. Servirlas como datos estáticos.
   La RTX 4070 Ti es nuestra fábrica de datasets, no nuestro servidor de producción.
6. **Arquitectura híbrida, decidida:** el solver va en **WASM con f64** (WebGPU no tiene doble
   precisión y no la tendrá pronto); **WebGPU solo para campos, streamlines y render**.
7. **Migrar de `opencascade.js` a `occt-wasm`** si aún no se hizo: `opencascade.js` lleva **sin un
   push desde el 15-ago-2023** y está pegado a OCCT 7.6.2; `occt-wasm` trae OCCT V8, ~4.5 MB brotli
   (la mitad) y soporte de Web Worker. **Presupuesta el rebuild, no el frame**: en OCCT-WASM un
   `cut` cuesta ~70 ms y un `union` ~43 ms, así que un árbol de 30 booleanas son ~1.5–2 s. Para el
   modo conceptual, prefiere lofts de superficie sin booleanas.
8. **NO construir**: un solver RANS, un mallador industrial, otro XFOIL para el navegador, ni un
   surrogate 3D propio entrenado desde cero. Los cuatro son sumideros y ya tienen dueño.

---

## G. NOTA DE MÉTODO Y CONSOLIDADO DE LO NO VERIFICADO

### G.1 Cómo se hizo

Investigación web ejecutada el **4 de agosto de 2026** por un agente coordinador más cuatro agentes
de investigación en paralelo (open source, comerciales de paga, simulación en navegador, formación).
Se agotó el presupuesto de búsqueda de la sesión (200 llamadas) y el resto se resolvió con `WebFetch`
directo a páginas de proveedor, PDFs de catálogo, la API de GitHub, Hacker News (vía Algolia),
Stack Exchange (vía API), Google Groups y SourceForge.

Tipo de cambio usado donde se convirtió: **1 USD = 17.32 MXN / 0.744 GBP / 0.869 EUR** (4-ago-2026).

### G.2 Sitios que bloquearon al investigador (y qué se perdió con eso)

| Sitio | Error | Qué no pudimos verificar |
|---|---|---|
| **reddit.com** | dominio bloqueado | Quejas de usuarios en r/aerospace, r/AerospaceEngineering, r/CFD, r/RCPlanes. Las URLs de hilos citadas en §E.4 están verificadas; **su contenido se leyó solo por snippets de buscador** |
| **cfd-online.com** | Cloudflare / 403 | Hilos de licencias y costos reales |
| **G2, TrustRadius** | 403 | Citas de esas plataformas. **Sí se obtuvieron citas de Capterra, SoftwareAdvice, Hacker News y r/CFD vía `old.reddit.com`** |
| **eng-tips.com, secretprojects.co.uk, homebuiltairplanes.com** | 403 | Quejas sobre RDS y AAA |
| **Udemy** | 403 | Precios reales de cursos |
| **arc.aiaa.org** | 403 | Precio actual de RDS-Student |

### G.3 Consolidado — TODO lo que este documento NO pudo verificar

**Precios que SÍ se verificaron (para que no se busquen dos veces):** STAR-CCM+ lista completa en
`dex.siemens.com` · Ansys académico en University of Washington · COMSOL en Uni Hannover, Cambridge
y Purdue · CONVERGE en su propio sitio · SOLIDWORKS Flow Simulation en Hawk Ridge · AirShaper ·
Onshape · RDS-Professional · Cadence *training* · y decenas de contratos adjudicados en USAspending,
FPDS y Contracts Finder.

**Precios que no existen públicamente (confirmado por ausencia, no por falta de esfuerzo):**
- Ansys Fluent, CFX, Discovery, SimAI (comercial) — sin precio de lista público
- COMSOL comercial (el académico sí está verificado)
- Dassault CATIA / SIMULIA / XFlow / PowerFLOW / 3DEXPERIENCE — sin precio público
- Altair — valor de la Unit, sin precio público; y la tabla de *unit draw* citada es de 2017
- Cadence Fidelity CFD y Cradle CFD (el software) — sin precio público (la *capacitación* sí lo tiene)
- Simcenter 3D y FLOEFD — sin lista; solo adjudicaciones
- Unidad del SKU STAR1017 de Siemens (se asumió "por core")
- Equity value de Altair de "$10.6 mil millones": la fuente primaria era `investor.altair.com` y
  **ese dominio ya no resuelve DNS**. Usar los ~US$10,000 M del PR de Siemens
- SimScale planes de pago — el vendor solo dice "custom quote"
- Flexcompute Flow360, Luminary Cloud, Neural Concept, PhysicsX, Navasto, Emmi, Navier — **ninguna
  de las empresas de la ola nueva publica tarifa**
- Pacelab APD, FlightStream, AIAA cursos privados, Altair ILT, CFD Direct, SimuTech, LEAP, SAE aero
- Ansys Learning Hub: los US$2,300–2,320 son **reporte de usuario en el foro oficial**, no precio de lista
- Siemens US$1,620 / US$2,112: aparecen en el parámetro `listFee` de la URL, **no renderizados** → semi-verificado
- SimScale "desde $3,000/año": reseña de tercero de 2024, no confirmada por el vendor
- DARcorporation AAA US$3,000: **reporte de foro**, no del vendor
- RDS-Student en AIAA: **NO VERIFICADO** (403)
- Certificado verificado de edX (~US$50): snippet, no confirmado para 2026
- Cursos de Udemy: ni un precio real capturado

**Datos técnicos no verificados:**
- **Lenguaje de programación de RDSwin** — no aparece ni en el sitio ni en el paper AIAA-2016-1277
- **PANUKL** — versión, licencia y estado: páginas oficiales dan 404 y no hay snapshot en Wayback
- **Monto de la Serie C de Flexcompute** (jul-2024) — no divulgado. Nota de conflicto: la nota de
  prensa de 2021 dice "$22M Serie B liderada por Coatue"; Tracxn registra una Serie B de $3.9M
  liderada por GGV y un total de $80.7M. **No pude reconciliar las dos fuentes.**
- **Anuncio primario del sunset de SUAVE** (jul-2023) — verificado solo indirectamente; lo que sí
  confirmé es que `master` no se toca desde el 23-dic-2022
- **Curva de consumo de Altair Units al escalar** — no verificada
- **Que exista algún caso donde una autoridad aeronáutica acepte un surrogate neuronal como evidencia
  de certificación** — **NO ENCONTRÉ NINGUNO**
- **Que exista un puerto de NeuralFoil a JS/ONNX/WASM** — **NO ENCONTRÉ NINGUNO**
- **Quejas públicas de usuarios de RDS** — **no existen** que yo pudiera encontrar: sin repo, sin
  issue tracker, sin foro, sin Google Group. Ese vacío es en sí mismo un hallazgo, pero tampoco puedo
  descartar que existan en los foros que me bloquearon
- **Quejas públicas de usuarios de Altair** — HN devuelve 0 resultados, Capterra 404. La tesis de
  "consumo de Units opaco y caro" **no tiene una sola cita directa de usuario**
- **Auditorías de licencia de Dassault** y resentimiento por la transición CD-adapco → Siemens (2016)
  — sin soporte citable. Sobre STAR-CCM+ encontré **lo contrario** de "version churn": elogios a su
  estabilidad entre versiones
- **COMSOL para aerodinámica externa a alto Reynolds** — tiene los modelos sobre el papel (SA, SST,
  v2-f, LES, DES) pero su propia página **no posiciona aero externa** y no hay caso a escala aeronave
- **Horas de mallado de un avión completo** — nadie lo publica; los papers de AIAA HLPW/DPW están
  tras paywall (arc.aiaa.org da 403)
- **⚠️ Que Autodesk CFD esté descontinuado** — **REFUTADO provisionalmente**: no aparece en la página
  oficial de productos retirados de Autodesk. Lo que sí murió fue *CFD Flex* (2016) y *Flow Design*
  (2018), que son otros productos. Pedirle al cliente la fuente del rumor antes de repetirlo
- **⚠️ Trampa de datos:** `hexagon.de/pdf/prlist_e.pdf` aparece en buscadores como "Hexagon Price
  List 2026". **NO es Hexagon AB** — es una empresa alemana de cálculo de resortes y engranes. Cero
  relación con Cradle CFD. **No citar**

**Fuentes de calidad dudosa que decidí NO usar como dato duro:**
- Reportes de "market size" de sitios tipo marketintelo/coherentmarketinsights (cifras de mercado de
  Physics AI, "26% más rápido en aeroespacial"): parecen generados automáticamente y no tienen
  metodología verificable. **No hay ninguna cifra de tamaño de mercado en este documento.**

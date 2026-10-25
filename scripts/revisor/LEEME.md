# EL REVISOR — manual para el hermano que lo lleva

> Orden 2026-10-24-e-el-revisor. Lo que vendemos es **la revisión antes del acero** (00-PLAN del debate): la pieza del cliente
> juzgada, un molde de referencia y su costo de referencia, con folio y en BORRADOR. Antes de que ese expediente salga a una
> planta, una IA (Fable) lo revisa con una rúbrica y firma como **revisor automático**. No aprueba la fabricación: eso lo firma
> el fabricante del molde (decisión de ian, 2026-10-24).

## En una frase
Desde una sesión de Claude Code en la laptop, en el repo: **`/revisor-forja <ruta.stp> [intake]`**. La skill
(`.claude/skills/revisor-forja/SKILL.md`) hace todo: sube el STEP a iangpu, corre el camino en la app real con el GPU, trae el
paquete, lanza al revisor Fable, verifica que haya mirado de verdad (imagen-control), firma y entrega en `Downloads/revisiones/<folio>/`
de los dos PCs.

## 1 · Qué pedirle al cliente (antes de tocar su archivo)
1. **Orden de servicio por pieza + NDA firmados ANTES del primer STEP** (juez B D7; abogado: «fuera del navegador solo con orden
   de servicio, NDA y borrado a 30 días»). Su STEP es secreto industrial: vive en `/home/ian/el-plan/revisiones/_entrada/` y se
   borra a los 30 días. No va a videos ni a ningún agente que publique.
2. **El STEP de UNA pieza** (no el ensamble, no un STL): si manda un ensamble, que diga cuál pieza se moldea.
3. **El material con su grado** (ej. «ABS Magnum 3504») y, si la tiene, su ficha técnica.
4. **Volumen anual** (piezas/año): decide cavidades y acero (< 5,000 es aluminio/prototipo).
5. **La máquina** donde va a correr (marca, toneladas, diámetro del tornillo).
6. Si quiere costo: **su tarifa en MXN por hora** por centro (CNC, EDM, banco, prueba). Sin tarifa no hay cifra.
7. **Permiso escrito** si su pieza va a salir en algún video (por defecto: NO).

Hoy la app no tiene dónde meter 3–5 (el camino solo pide el STEP; el material, volumen y máquina solo existen en la E1 del curso):
se pasan como `intake` y el revisor compara lo declarado contra lo que la app usó. Si no cuadran, la revisión lo dice (C6).

## 2 · El comando y cuánto tarda
```
/revisor-forja "/mnt/c/Users/sebas/Downloads/<pieza>.stp" material=ABS volumen=100000 maquina="FCS HT-150SV"
```
Medido el 2026-10-24 con la 1594C Box contra el build de main en iangpu (`:4199`):

| Fase | Dónde | Tiempo |
|---|---|---|
| subir STEP + scripts | laptop → iangpu | ~10 s |
| la captura (camino de 9 pasos, 18 stills 4K, números, expediente) | iangpu, GPU, dentro de `gpu.lock` | 4.3–4.8 min medidos (el molde se arma solo en 85–96 s de eso) |
| la fila del GPU (si otra orden o un video lo tiene) | iangpu | 0–10 min (medido: una corrida esperó 10 min) |
| traer el paquete (≈ 28 MB) | iangpu → laptop y su Downloads | ~20 s |
| la revisión de Fable (lee 18 stills + textos) | laptop | 12.3 min medidos (238 k tokens, 35 herramientas) |
| verificar + firmar | laptop | ~1 min |
| **total** | | **≈ 18 min** por pieza con el GPU libre; **≈ 30 min** con fila |

Lo que se puede correr solo, sin GPU:
- `node scripts/revisor/captura.cjs --seco` — arma los gestos, compila cada `eval` y prueba el detector (su par de control).
- `node scripts/revisor/captura.cjs --procesa <paquete>` — rehace textos/números/señales sobre un paquete ya capturado.

## 3 · Qué hay en el paquete (`Downloads/revisiones/<folio>/`)
- `REVISION.md` — **lo que importa**: veredicto, renglón por renglón con su evidencia, still por still, firma.
- `stills/` — los 18 cuadros 4K del camino (lo que el cliente ve).
- `expediente.html` — el archivo exacto que el botón «Descargar» le da al cliente.
- `textos/`, `numeros.json`, `hallazgos-texto.json`, `folio.json`, `indice.json` — la evidencia del revisor.
- `control-revelado.json` — cuál still era la imagen-control y cómo la marcó el revisor (se revela DESPUÉS de revisar).

**El folio** = sesión de la app · commit del build · SHA-256 del STEP (los primeros 12). Con el folio se reproduce la corrida:
mismo STEP (mismo SHA) + mismo commit.

## 4 · Qué hacer con cada veredicto
- **SE DETIENE** (hay al menos un ◆): el expediente **no se manda**. Los ◆ son la lista de arreglos; casi todos ya tienen orden
  (los apagones son la orden A; el tonelaje la B; la puerta de contrasalidas la C; el folio/BORRADOR/firmas la semana 3 del plan).
  Al cliente, si pregunta: «tu revisión está en proceso; la máquina detectó N puntos que un ingeniero tiene que cerrar antes de
  mandártela». Fecha nueva, no excusas.
- **SE ENTREGA CON NOTAS** (sin ◆, con ◇): se manda el expediente + la sección «Notas para el cliente» de `REVISION.md`, tal cual,
  en el mismo correo/WhatsApp. Las notas no se esconden ni se suavizan.
- **SE ENTREGA**: se manda el expediente con su folio. Sigue siendo BORRADOR hasta que el fabricante del molde firme las decisiones.
- **La revisión se tiró** (el revisor aprobó la imagen-control, o faltan renglones): no hay revisión. Se relanza una vez; si se
  repite, se le avisa a ian. Nunca se manda un expediente con una revisión tirada.

## 5 · Qué NO decir (nunca, a nadie)
- «aprobado», «certificado», «validado», «cumple normas», «listo para fabricar», «garantizado».
- «revisado por un ingeniero» o «revisado» a secas: lo revisó **una IA** (revisor automático) y así se dice.
- «simulación de llenado», «CFD», «FEA», «análisis de elemento finito»: son fórmulas del libro, no simulaciones (acuerdo 4).
- «0 puntos débiles»: se dice «0 choques en N pares agua contra barreno; no revisé…».
- «cotización»: se dice «costo de referencia con tu tarifa»; nunca en dólares ni con la tarifa por defecto.
- «tu archivo no sale de tu navegador»: en este servicio SÍ sale (a iangpu, con orden de servicio y borrado a 30 días).
- Nada del molde de otro cliente, ni el nombre de su pieza en un video sin permiso escrito.

## 6 · Cuando algo falla
| Síntoma | Qué es | Qué hacer |
|---|---|---|
| `RC=3 MOLDE_SOSPECHOSO` | la E7 no trajo pines: el molde salió de OTRA pieza (la carrera del arranque, 2026-10-23) | repetir la captura una vez |
| `RC=4 INCOMPLETO` | faltó un still, un paso o el expediente | ver `ESTADO.txt`, `drive/meta.json` y el log; repetir |
| `Error creating WebGL context` / GPU = SwiftShader | el GPU no estaba (juegos en el host, otra corrida) | esa corrida no vale; repetir más tarde |
| `:4199` no da 200 | el preview se cayó (iangpu se reinicia a veces) | levantarlo (paso 2 de la skill), sin tocar src |
| A1 sale ◇ «commit NO VERIFICADO» | el `temis-deploy.json` del build es viejo | verificar el src del build contra main (paso 2 de la skill) y pasar `--commit` |
| Fable con límite de uso | — | la skill relanza con Opus y la firma lo dice |

## 7 · Lo que el revisor NO es
No es un moldista: no verifica que el molde funcione, ni llenado, ni alabeo, ni esfuerzos. Revisa que el **expediente** diga la
verdad, que no prometa lo que no midió, que los números cuadren entre pasos, que el papel no acuse (folio, BORRADOR, cajetín), y que
lo que dice la pantalla se vea. El juicio de fabricar es del fabricante del molde.

# ORDEN: iangpu C: LLENO, CUARTA VEZ — el WSL se apagó a media prueba del paso 6

TIPO: imprevisto

BASE: b62aa27

OBJETIVO: iangpu vuelve a servir (WSL arriba, ssh y tailscaled vivos, ≥40 GB libres en C:) y queda
una regla que impida la quinta vez.

## QUÉ PASÓ (2026-09-07, ~13:00-13:40 CDMX)
- Medido: `fsutil volume diskfree C:` = **−7.6 MB libres** de 930 GB; `wsl -l -v` = Ubuntu **Stopped**;
  después ni el sshd de Windows contesta («timed out during banner exchange»). E: tiene 111 GB libres.
- **Mi parte, dicha clara:** para aislar el dev de vite de los archivos que la otra sesión suelta en
  el repo (cada uno recargaba la página a media prueba), copié el código a `/home/ian/forja-dev`
  DENTRO del WSL. La primera copia arrastró 1.5 GB de cosas que no eran `src/` (un `atom-006…mp4`
  de 199 MB entre ellas) y la segunda, hecha en iangpu desde su propio repo, llegó a 4.8 GB. El vhdx
  NO es sparse: cada byte escrito adentro crece C: y borrar adentro no lo devuelve. C: venía con
  ~66 GB libres el 09-04 y la otra sesión renderiza ahí; mis ~6 GB fueron los últimos.
- Lo que sí quedó probado antes de caer: el STEP soltado ENTRA al kernel (golpe 3: 472 caras,
  55,822 mm³) y la pestaña MOLDE aparece; el ciclo se quedó en «midiendo la pared» por un bug mío
  (las lentes son un arreglo con `id`, no un objeto) que ya corregí en el código SIN verificar.

## LA OTRA PARTE (sesión «Reyes y animaciones canon», medido por ella)
- vhdx = 625.5 GB (el 09-04 eran 561.6: +64 GB hoy). Su gasto: 4 renders 4K (hexámero y anillo, 9:16 y
  16:9) ≈ 20 GB de cuadros regenerables en `dist-video/.hex6bframes*`, `.anillobframes*`; 3 de 4
  entregados. Más ~130 GB de cuadros viejos que Ian tiene pendiente borrar (el clasificador bloquea
  los rm masivos por ssh). `C:\Users\sebas\Videos` = 90.1 GB (la palanca de verdad, cabe en E: y lo
  deja en ~21 GB). WSL 2.5.10 → set-sparse es seguro.
- Reparto acordado: ella lleva el rescate y borra sus cuadros; yo borro `/home/ian/forja-dev` avisando
  antes; el fstrim lo corre UNO SOLO con la palabra de Ian. Orden: set-sparse → arrancar → borrar → fstrim.

## QUÉ NECESITA A IAN (destructivo sobre su C:, no lo corro yo)
1. Liberar C: por la puerta de Windows (`! ssh sebas@100.116.134.86 …`), como el 09-04: mover a E:
   con `robocopy /MOVE` lo grande que no sea de trabajo (Downloads ya se movió; candidatos: cuadros
   de render en `dist-video` DENTRO del vhdx no cuentan — hay que ver qué más vive en C:).
2. Con C: respirando: `wsl --manage Ubuntu --set-sparse true` → `wsl -d Ubuntu -- uptime` →
   `wsl -d Ubuntu -u root -- systemctl start ssh tailscaled` → adentro `rm -rf /home/ian/forja-dev`
   (es MÍO, 6 GB) y `sudo fstrim -av` para que el vhdx sparse devuelva el espacio.

## REGLA NUEVA (para que no haya quinta)
- NUNCA copiar GB al vhdx de iangpu. El dev aislado se arma con `src/` + configs (17 MB) y
  **symlinks** a `public/` y `node_modules` del repo — no copias. Antes de cualquier escritura
  grande en iangpu: `fsutil volume diskfree C:` desde el host.
- Vite dev en iangpu vigila el repo entero: o se aísla por symlinks o se le pasa
  `server.watch.ignored` para `videos/`, `ordenes/`, `src/cinematic/`, `public/comando/`.

## TOCA
- (nada en el repo: es infra)

## CREA
- ordenes/2026-09-07-iangpu-c-lleno-cuarta-vez.md

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- `fsutil volume diskfree C:` ≥ 40 GB · `wsl -l -v` Running · `ssh ian@100.65.173.85 uptime` responde
- `/home/ian/forja-dev` ya no existe · el vhdx es sparse (`wsl --manage Ubuntu --set-sparse` sin error)

## CIERRE (se llena al terminar)
**CERRADO 2026-09-07 ~12:50 CDMX · C: 4.8 → 113.1 GB libres · vhdx DISPERSO + fstrim: por primera vez lo borrado adentro REGRESA a C:.**

- Ian corrió `set-sparse` (WSL 2.5.10, seguro) y arrancó la VM. La sesión «Reyes» borró 164 GB regenerables
  adentro (cuadros de 17 piezas, scratch, entregas/ verificadas 29/29 contra E:) → ext4 605 → 441 GB; y corrió
  el fstrim UNO SOLO por la puerta de Windows (`wsl -d Ubuntu -u root -- fstrim -av`, 542.6 GiB).
- Yo borré `/home/ian/forja-dev` (4.8 GB, mío) avisando antes, y rearmé el dev aislado SIN copias:
  `/home/ian/forja-dev2` = `src/` (17 MB) + configs + symlinks a `public/*` y `node_modules` (76 KB propios).
- Lo que cambia estructuralmente: el vhdx era NO-sparse → cada caída cada 3 días. Ya no.
- Lo que aprendí (memoria): nunca copiar GB al vhdx; `fsutil volume diskfree C:` antes de escribir grande;
  vite dev en el repo vigila TODO (la otra sesión soltando archivos = page reload a media prueba) → dev aislado.

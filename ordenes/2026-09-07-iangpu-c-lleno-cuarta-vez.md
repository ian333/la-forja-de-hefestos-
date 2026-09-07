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

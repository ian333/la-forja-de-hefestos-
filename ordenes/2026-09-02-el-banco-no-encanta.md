# ORDEN: EL BANCO — el lobby no encanta (y tiene otro estilo que el Foco)

ESTADO: proximo
PRIORIDAD: 4
BASE: 8290218

OBJETIVO: ian, con la lámina viva y el lobby lado a lado (2026-09-02): «no tienen nada que ver,
y está bien — una es el Banco y otro es el Foco; pero aunque se entiende que son diferentes,
tienen estilos MEEE. **El Banco actual no me termina de encantar**, pero igual añádelo como ticket».

Hoy el lobby (proyectos, plantillas, Temis, abrir archivo) es un tablero oscuro genérico:
tarjetas con borde, íconos en caja, azul-gris. El Foco ya tiene idioma propio (cristal, tinte
por estado, movimiento que informa). El Banco no tiene idioma todavía — y la doctrina dice que
los dos deben verse DISTINTOS a propósito, no uno diseñado y el otro por defecto.

## EJERCICIOS
- banco-idioma · El Banco tiene su propio idioma visual, escrito · doctrina · una sección en DOCTRINA-FOCO.md que diga qué es el Banco y cómo se ve (sólido, callado, ¿latón/madera/papel?), con referencias del atlas
- banco-lobby · El lobby se re-viste con ese idioma · UI · proyectos, plantillas y Abrir archivo sin tarjetas genéricas; ian lo ve y no dice «meee»
- banco-temis · Temis vive en el mismo idioma · UI · la franja del camino y las columnas comparten paleta y tipografía con el lobby
- banco-no-foco · Nada del Banco imita al Foco · regla · cero cristal, cero lluvia, cero tinte por estado en el Banco: son dos idiomas
- banco-medido · Se mide la mejora, no se declara · antes/después · capturas del mismo lobby antes y después, y el conteo de cajas con borde (hoy: cada tarjeta)
- banco-sin-regresion · Nada del lobby deja de funcionar · gate · abrir archivo, plantillas y Temis siguen manejables por el arnés

## YA-EXISTE
- `ProjectSwitcher.tsx` (el lobby) y `TemisBoard.tsx` (Temis) — se re-visten, no se rehacen.
- El atlas (`docs/ATLAS-INTERFACES.md`) y la doctrina §0: el Banco = mobiliario, sólido, callado.
- Lo que ian ya rechazó para el Foco: café oscuro, papel mate. Para el Banco puede ser distinto —
  pero se decide viéndolo (mocks sobre la app real), no de memoria.

## TOCA
- src/forja/brep/ProjectSwitcher.tsx
- src/forja/brep/TemisBoard.tsx
- docs/DOCTRINA-FOCO.md
- public/temis.json

## CREA
- public/evidencia/2026-09-02-el-banco-no-encanta/resultados.json

## BORRA
- (nada)

## EVIDENCIA (declarada ANTES de trabajar)
- mocks de 2-3 direcciones sobre el lobby REAL, en Downloads, antes de decidir
- capturas antes/después · gate verde · deploy + verificación

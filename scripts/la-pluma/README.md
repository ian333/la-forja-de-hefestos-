# La Pluma — simulación del reductor de 48 V (2026-10-31)

`python3 la_pluma.py` corre 6 casos (A–F); `extra.py` (lazo rápido, 90 A) y `extra2.py` (TVS/snubber).
Necesita ngspice 36. Sin sudo: `apt-get download ngspice && dpkg -x ngspice_*.deb root`, corrige las rutas
de `root/usr/share/ngspice/scripts/spinit` y exporta `NGSPICE` apuntando a un wrapper que fije `SPICE_LIB_DIR`.
Salidas crudas: `*.out`. Netlist de referencia (caso D: tope + detección + Q3): `netlist_referencia_D.cir`.
El contacto/puente/arco es un escenario armado con datos del banco; el circuito es física de ngspice.

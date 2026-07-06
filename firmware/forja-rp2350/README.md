# Firmware FORJA — control del cabezal de metal (RP2350 / Pico 2)

Implementa el control que derivamos en La Forja (`scripts/`): sensado por contacto
`R=V/I` (Kelvin), latigazo (BUSCA→CALIENTA→FUNDE→CORTA→SUELTA), medida de **distancia
sin sensor** (cronometra el puente → gap) y **servo de Z** para mantener el gap mientras
la pieza crece.

## Reparto de cómputo
- **Núcleo 1** — lazo rápido **determinista (~100 kHz)**: lee los 2 ADC, calcula `R=V/I`,
  corre la máquina de estados, dispara el MOSFET, mide el gap por timing y trimea Z.
- **Núcleo 0** — movimiento (Z chase, avance de alambre) + interfaz con el **Raspberry Pi**
  (Linux): el Pi rebana la pieza generativa, manda la trayectoria XY, el **gap objetivo por
  zona** (contacto fino / vuelo relleno) y la Z nominal por capa. El Pi **NO** toca el lazo
  rápido (su jitter de ms se comería los puentes de µs).

## Cableado (pines en `control.c`)
| Pin | Señal |
|-----|-------|
| GP26 (ADC0) | divisor de V de la junta (R1=47k / R2=10k) — *sensado pasivo* |
| GP27 (ADC1) | shunt de derivación 2 mΩ — corriente |
| GP16 | gate driver del MOSFET (potencia + latigazo) |
| GP18/19 | Z step/dir (servo de distancia) |
| GP20/21 | extrusor step/dir (avance de alambre `v_f`) |

Potencia: buck de fusión (MOSFET 60-100V + diodo flyback **obligatorio** + choque/caps de
la SOMI + fuente 24 V). Ver `docs/esquematico-rp2350-fusion.pdf`.

## Compilar y flashear
```sh
export PICO_SDK_PATH=/ruta/a/pico-sdk      # SDK 2.x (soporta RP2350)
cp $PICO_SDK_PATH/external/pico_sdk_import.cmake .
mkdir build && cd build && cmake .. && make
# arrastra build/forja_control.uf2 al Pico 2 en modo BOOTSEL
```

## Pendiente de BANCO (constantes a medir)
- `R_op` (junta fundida) y `L_th` → fijan el boost; medir con `docs/banco-deposicion-metal.tex`.
- Ganancias del servo de Z y del bang-bang de corriente.
- `R1/R2/R_sh` reales (la tolerancia NO importa: el control usa razones — ver
  `scripts/sensado-pasivo-comercial.py`).

> Esqueleto verificado en ESTRUCTURA (la física viene de los scripts simulados). Falta
> el tuning en fierro y cablear el lado del Pi (esclavizado a velocidad + lead balístico).

# Biblioteca del banco del arco

Modelos reales de los componentes del banco del arco (plan `docs/PLAN-MVP-LA-PLUMA.md`). La caja de cada uno se midió con el kernel de La Forja (`importSTEP` más `Bnd_Box AddOptimal`) el 2026-11-04, en iangpu.

| archivo | qué es | caja exacta (mm) | fuente · licencia |
|---|---|---|---|
| `LRS-1200-3D.stp` | fuente Mean Well LRS-1200-48 | 230.0 × 41.0 × 124.0 (con terminales; el cuerpo mide 225) | meanwell.com/upload/pdf/LRS-1200/LRS-1200-3D.zip · descarga pública del fabricante, uso interno |
| `rpi_pico2.step` | Raspberry Pi Pico 2 | 21.0 × 52.3 × 3.8 | datasheets.raspberrypi.com/pico/Pico-2-step-20240708.zip · MIT (`LICENSE-pico2.txt`) |
| `TO-220-3_Vertical.step` | Q1, Q3 (IRFB4227) y D1 (MBR40100CT) | 10.3 × 4.5 × 28.5 | KiCad packages3D · CC-BY-SA 4.0 con excepción para diseños |
| `DIP-14_W7.62mm.step` | IR2110 | 7.9 × 19.1 × 7.0 | KiCad · CC-BY-SA 4.0 |
| `CP_Radial_D35.0mm_P10.00mm_SnapIn.step` | capacitor snap-in Ø35 (genérico) | 35 × 35 × 37 | KiCad · CC-BY-SA 4.0 |
| `CP_Radial_D30.0mm_P10.00mm_SnapIn.step` | capacitor snap-in Ø30 (genérico) | 30 × 30 × 32 | KiCad · CC-BY-SA 4.0 |
| `C_Rect_L31.5mm_W13.0mm_P27.50mm_MKS4.step` | capacitor de película 4.7 µF / 100 V (forma MKS4) | 31.5 × 13.0 × 27.9 | KiCad · CC-BY-SA 4.0 |
| `Heatsink_125x35x50mm_3xFixationM3.step` | disipador para Q1 + D1 | 124.7 × 35.0 × 35.0 | KiCad · CC-BY-SA 4.0 |
| `Fuseholder_Cylinder-6.3x32mm_Schurter_0031-8002_Horizontal_Open.step` | portafusible de F1 | 41.0 × 15.0 × 18.5 | KiCad · CC-BY-SA 4.0 |

## Pendiente de medir en la pieza real

- **Capacitores:** el alto real de los CE-2200 µF / 200 V. El modelo es genérico, de 37 mm.
- **Bobina de 41 µH:** Ø y largo, para hacerla paramétrica.
- **Cuello de la antorcha de la SOMI:** Ø.
- **Sin modelo descargable:**
  - el módulo Hall;
  - el módulo de 48 → 12 V;
  - el ventilador;
  - el PARO de 22 mm;
  - el GX12.
  
  Se modelan paramétricos a partir de la hoja de datos.

Fuente KiCad: https://gitlab.com/kicad/libraries/kicad-packages3D (rama master, 2026-11-04).

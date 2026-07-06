#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lee el serial de la Pico (Test 01) y lo muestra en vivo. Uso:
   python3 scripts/leer-pico.py [/dev/ttyACM0] [segundos]"""
import serial, sys, time
port = sys.argv[1] if len(sys.argv) > 1 else '/dev/ttyACM0'
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 20
try:
    s = serial.Serial(port, 115200, timeout=2)
except Exception as e:
    print(f"No pude abrir {port}: {e}"); sys.exit(1)
print(f"== Leyendo {port} @115200 por {secs:.0f}s ==")
t0 = time.time(); n = 0
while time.time() - t0 < secs:
    line = s.readline().decode(errors='replace').strip()
    if line: print(line); n += 1
print(f"== {n} líneas leídas ==")
s.close()

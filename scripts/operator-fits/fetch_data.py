#!/usr/bin/env python3
"""
Bajar 3 datasets desde FRED CSV público (sin API key) y guardarlos
en /tmp/operator-data/ para los fits posteriores.

FRED expone fredgraph.csv directo sin auth para cualquier serie pública.

Datasets:
  - UNRATE      : tasa de desempleo USA, mensual desde 1948
  - CPIAUCSL    : CPI USA, mensual desde 1947
  - SP500       : S&P 500 close, diario últimos 10 años
  - GDPC1       : Real GDP USA, trimestral desde 1947
  - PAYEMS      : Total Nonfarm Payrolls (proxy de L), mensual desde 1939
  - RKNANPUSA666NRUG : Capital stock at constant prices for USA (PWT, anual)
                       (alternativa si no funciona: NETFINSL netflow)
"""

import os
import sys
import urllib.request
import urllib.error

OUT = "/tmp/operator-data"
os.makedirs(OUT, exist_ok=True)

SERIES = {
    "UNRATE":     "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE",
    "CPIAUCSL":   "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL",
    "SP500":      "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500",
    "GDPC1":      "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPC1",
    "PAYEMS":     "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PAYEMS",
    # Capital stock: usar "Net Stock of Fixed Assets" del BEA serie FRED
    "K1NTOTL1ES000": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=K1NTOTL1ES000",
}

UA = "Mozilla/5.0 (compatible; OperatorFits/1.0)"

for name, url in SERIES.items():
    out = os.path.join(OUT, f"{name}.csv")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(out, "wb") as f:
            f.write(data)
        sz = os.path.getsize(out)
        print(f"OK  {name:18s} {sz:8d} bytes -> {out}")
    except urllib.error.HTTPError as e:
        print(f"ERR {name:18s} HTTP {e.code} :: {url}")
    except Exception as e:
        print(f"ERR {name:18s} {e}")

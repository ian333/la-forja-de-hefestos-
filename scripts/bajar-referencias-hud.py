#!/usr/bin/env python3
"""Baja referencias de HUD desde fuentes que SÍ permiten (CDN de Steam + miniaturas de YouTube).
Verifica el nombre del juego con la API pública de Steam: ninguna imagen sin atribución correcta."""
import json, os, subprocess, sys
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
OUT = "/home/ian/Orkesta/la-forja/docs/referencias-hud"
os.makedirs(OUT, exist_ok=True)

JUEGOS = [
    ("horizon",     1151640, 5),
    ("shipbreaker", 1161580, 6),
    ("deathstr",    1190460, 6),
    ("cyberpunk",   1091500, 5),
    ("titanfall2",  1237970, 4),
    ("deusex",      337000,  4),
    ("armoredcore", 1888160, 5),
    ("nier",        524220,  4),
    ("subnautica",  264710,  4),
    ("prey",        480490,  4),
    ("ghostrunner", 1139900, 3),
    ("stellaris",   281990,  2),
]

def curl(url, dest):
    # el bug de la 1a corrida: la URL nunca entraba a la lista de argumentos.
    r = subprocess.run(["curl", "-sL", "-A", UA, "-o", dest, "-w", "%{http_code}", url],
                       capture_output=True, text=True, timeout=120)
    return r.stdout.strip()

def encoger(dest):
    """1920x1080 a ~600 KB x 50 = 30 MB en el repo. Se reduce a 1280 de ancho:
    suficiente para juzgar una interfaz, una quinta parte del peso."""
    tmp = dest + ".tmp.jpg"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", dest,
                        "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", tmp],
                       capture_output=True, text=True, timeout=120)
    if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 10000:
        os.replace(tmp, dest)
    elif os.path.exists(tmp):
        os.remove(tmp)

manifiesto = []
for slug, appid, n in JUEGOS:
    try:
        r = subprocess.run(["curl", "-sL", "-A", UA,
                            f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english"],
                           capture_output=True, text=True, timeout=90)
        d = json.loads(r.stdout)
        v = d.get(str(appid), {})
        if not v.get("success"):
            print(f"✘ {slug}: la API no lo reconoce"); continue
        data = v["data"]
        nombre = data["name"]
        shots = data.get("screenshots", [])[:n]
        got = []
        for i, sh in enumerate(shots):
            url = sh.get("path_full") or sh.get("path_thumbnail")
            dest = os.path.join(OUT, f"{slug}-{i+1}.jpg")
            code = curl(url, dest)
            ok = code == "200" and os.path.getsize(dest) > 20000
            if not ok:
                os.path.exists(dest) and os.remove(dest)
            else:
                encoger(dest)
                got.append(os.path.basename(dest))
        manifiesto.append({"slug": slug, "appid": appid, "nombre": nombre, "imagenes": got})
        print(f"✔ {nombre}: {len(got)} imágenes")
    except Exception as e:
        print(f"✘ {slug}: {e}")

with open(os.path.join(OUT, "manifiesto.json"), "w", encoding="utf-8") as f:
    json.dump(manifiesto, f, ensure_ascii=False, indent=1)
print(f"\n{sum(len(m['imagenes']) for m in manifiesto)} imágenes de {len(manifiesto)} juegos")

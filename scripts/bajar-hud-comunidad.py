#!/usr/bin/env python3
"""
Baja capturas de la COMUNIDAD de Steam (las que suben los jugadores JUGANDO).
============================================================================
Por qué existe: las capturas de la TIENDA son marketing y esconden el HUD — de 52
bajadas así, solo 6 mostraban interfaz (lo cazó ian: «no hay nada de imágenes del
hud»). Las de la comunidad son de partidas reales: el HUD está encendido.

Los videos de YouTube quedaron descartados: yt-dlp ya exige PO tokens y responde 403.

Fuente: steamcommunity.com/app/<id>/screenshots (público) → images.steamusercontent.com.
Uso: python3 scripts/bajar-hud-comunidad.py [--por-juego 8]
"""
import os, re, subprocess, sys, json, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "referencias-hud", "hud")
OUT = os.path.abspath(OUT)
JUEGOS = [
    ("horizon", 1151640), ("shipbreaker", 1161580), ("deathstr", 1190460),
    ("cyberpunk", 1091500), ("armoredcore", 1888160), ("titanfall2", 1237970),
    ("nier", 524220), ("subnautica", 264710), ("prey", 480490), ("deusex", 337000),
    ("ghostrunner", 1139900), ("stellaris", 281990),
]
POR_JUEGO = 8
if "--por-juego" in sys.argv:
    POR_JUEGO = int(sys.argv[sys.argv.index("--por-juego") + 1])
# el filtro IMPORTA: "toprated" son postales de modo foto (la gente vota lo bonito);
# "mostrecent" son partidas de verdad, que es donde el HUD está encendido. Cazado
# mirando 60 capturas: con toprated, Horizon y Stellaris salieron sin una sola UI.
FILTRO = "toprated"
if "--filtro" in sys.argv:
    FILTRO = sys.argv[sys.argv.index("--filtro") + 1]
SOLO = None
if "--solo" in sys.argv:
    SOLO = set(sys.argv[sys.argv.index("--solo") + 1].split(","))
# HALLAZGO: `toprated` devuelve POSTALES (modo foto, sin HUD) — la comunidad vota lo
# bonito. `mostrecent` devuelve PARTIDAS: ahí el HUD está encendido. Se puede elegir.
FILTRO = "toprated"
if "--filtro" in sys.argv:
    FILTRO = sys.argv[sys.argv.index("--filtro") + 1]
PREFIJO = "" if FILTRO == "toprated" else FILTRO + "-"

def get(url, dest=None, timeout=120):
    cmd = ["curl", "-sL", "-A", UA, "--max-time", str(timeout - 10)]
    if dest:
        cmd += ["-o", dest, "-w", "%{http_code}"]
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=timeout)
    return r.stdout

os.makedirs(OUT, exist_ok=True)
manifiesto = []
for slug, appid in JUEGOS:
    if SOLO and slug not in SOLO:
        continue
    urls = []
    for pagina in (1, 2):
        html = get(f"https://steamcommunity.com/app/{appid}/screenshots/?p={pagina}&browsefilter={FILTRO}")
        # la tarjeta de cada captura trae la versión de 1024 px
        urls += re.findall(r'apphub_CardContentPreviewImage"\s+src="([^"]+)"', html)
        if len(urls) >= POR_JUEGO * 2:
            break
        time.sleep(0.4)
    vistos, got = set(), []
    for u in urls:
        clave = u.split("/ugc/")[-1].split("/")[0]
        if clave in vistos:
            continue
        vistos.add(clave)
        # 1920 px: el HUD trae texto chico y a 1024 no se lee
        u1920 = re.sub(r"imw=\d+", "imw=1920", u)
        dest = os.path.join(OUT, f"{slug}-{PREFIJO}hud-{len(got)+1}.jpg")
        code = get(u1920, dest)
        if code == "200" and os.path.getsize(dest) > 40000:
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", dest,
                            "-vf", "scale='min(1400,iw)':-2", "-q:v", "4", dest + ".t.jpg"], timeout=120)
            if os.path.exists(dest + ".t.jpg"):
                os.replace(dest + ".t.jpg", dest)
            got.append(os.path.basename(dest))
        elif os.path.exists(dest):
            os.remove(dest)
        if len(got) >= POR_JUEGO:
            break
    manifiesto.append({"slug": slug, "appid": appid, "imagenes": got})
    print(f"{'✔' if got else '✘'} {slug}: {len(got)} capturas de comunidad")

with open(os.path.join(OUT, f"manifiesto-hud-{FILTRO}.json"), "w", encoding="utf-8") as f:
    json.dump(manifiesto, f, ensure_ascii=False, indent=1)
print(f"\n{sum(len(m['imagenes']) for m in manifiesto)} capturas en {OUT}")

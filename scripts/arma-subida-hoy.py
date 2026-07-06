#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
arma-subida-hoy.py — empaqueta los 10 mejores del día en UNA carpeta lista
para subir, en orden de fuerza de gancho, con su copy (voz de SUBIDAS.md).

NO toca el audio ni re-codifica: copia el .mp4 nativo (limpio, sin marca de
agua) tal cual. Renombra con prefijo NN- = ORDEN DE SUBIDA (1 = el primero
que sube hoy, el de gancho más fuerte). Genera SUBIDAS-HOY.md (checklist por
plataforma) en la misma carpeta.
"""
import json
import os
import shutil

ROOT = "/home/ian/Orkesta/la-forja"
OUT = os.path.join(ROOT, "dist-video", "HOY")
HOOKS = os.path.join(ROOT, "_hoy_hooks")  # videos con cold-open ya editado
PEAKS = os.path.join(ROOT, "_hoy_peaks", "peaks.json")
# CTA sin URL: TikTok/IG castigan links externos en el caption. Link en la bio
# + pregunta de engagement (el comentario es señal fuerte de retención).
CTA = "⚛️ Sígueme para ver los 118 · link en la bio"

# Selección curada (detector + ojo). Orden = orden de subida (el #1 primero).
# 'src' relativo a dist-video/. 'peak' = segundo del cuadro más fuerte (cold-open).
PICKS = [
    {
        "src": "dna/dna-telomero.mp4", "slug": "adn-telomero", "li": True,
        "titulo": "ADN · telómero — el reloj de tu vida",
        "copy": "El reloj de tu vida está en tus cromosomas. ⏳ Los telómeros (TTAGGG) "
                "son las puntas que se acortan cada vez que una célula se divide. Cada "
                "color es una letra (A·T·G·C) y la música ES su secuencia.",
        "tags": "#adn #telomero #genetica #envejecimiento #ciencia #4k #stem",
    },
    {
        "src": "all-118/018-Ar.mp4", "slug": "atomo-argon", "li": False,
        "titulo": "El átomo de Argón en 4K",
        "copy": "Así se ve un átomo de Argón por dentro. ⚛️ 18 protones, 18 electrones, "
                "sus capas (1s 2s 2p…) llenas — por eso es un gas noble que no reacciona "
                "con nada. Geometría de orbitales real, nada inventado.",
        "tags": "#quimica #atomo #fisica #argon #ciencia #4k #stem",
    },
    {
        "src": "all-118/016-S.mp4", "slug": "atomo-azufre", "li": False,
        "titulo": "El átomo de Azufre en 4K",
        "copy": "El azufre por dentro. 🟡 16 protones y la capa que NO se llena del todo "
                "— por eso forma anillos S₈ y huele a huevo podrido. Sus orbitales, en 4K "
                "y a escala real.",
        "tags": "#quimica #atomo #azufre #ciencia #4k #stem",
    },
    {
        "src": "all-118/017-Cl.mp4", "slug": "atomo-cloro", "li": False,
        "titulo": "El átomo de Cloro en 4K",
        "copy": "Cloro: 17 protones y un hueco de UN electrón. 🟢 Por eso es tan agresivo "
                "— le ROBA un electrón a casi todo lo que toca. Ese hueco es por qué "
                "desinfecta. Orbitales reales en 4K.",
        "tags": "#quimica #atomo #cloro #ciencia #4k #stem",
    },
    {
        "src": "all-118/014-Si.mp4", "slug": "atomo-silicio", "li": True,
        "titulo": "El átomo de Silicio — de qué está hecho un chip",
        "copy": "De ESTO está hecho cada chip que usas. 💻 Silicio: 14 protones, 4 "
                "electrones de valencia que se enlazan en cristal perfecto. Toda la era "
                "digital cabe en este átomo. En 4K, orbitales reales.",
        "tags": "#silicio #chip #tecnologia #quimica #ciencia #4k #stem",
    },
    {
        "src": "all-118/009-F.mp4", "slug": "atomo-fluor", "li": False,
        "titulo": "El átomo de Flúor — el más voraz",
        "copy": "El elemento MÁS voraz de la tabla. 🦷 Flúor: 9 protones que jalan a sus "
                "electrones con tanta fuerza que le arranca electrones hasta a los gases "
                "nobles. El mismo que protege tus dientes. Orbitales reales en 4K.",
        "tags": "#fluor #quimica #atomo #ciencia #4k #stem",
    },
    {
        "src": "all-118/010-Ne.mp4", "slug": "atomo-neon", "li": False,
        "titulo": "El átomo de Neón — por qué brilla",
        "copy": "Por qué el neón brilla rojo-naranja. 🟥 10 protones, capas COMPLETAS — "
                "tan estable que no reacciona, pero si lo excitas con electricidad, "
                "devuelve luz. El alma de los letreros. Orbitales reales en 4K.",
        "tags": "#neon #quimica #atomo #luz #ciencia #4k #stem",
    },
    {
        "src": "all-118/008-O.mp4", "slug": "atomo-oxigeno", "li": True,
        "titulo": "El átomo de Oxígeno — lo que respiras",
        "copy": "Lo que respiras, por dentro. 🫁 Oxígeno: 8 protones y 2 huecos que le "
                "encanta llenar — por eso oxida, quema y te mantiene vivo. Sus orbitales "
                "a escala real, en 4K.",
        "tags": "#oxigeno #quimica #atomo #ciencia #4k #stem #biologia",
    },
    {
        "src": "all-118/006-C.mp4", "slug": "atomo-carbono", "li": True,
        "titulo": "El átomo de Carbono — la base de la vida",
        "copy": "El átomo del que estás hecho TÚ. 🌱 Carbono: 6 protones y 4 enlaces que "
                "construyen desde un diamante hasta tu ADN. Ningún otro átomo arma tanto. "
                "Sus orbitales reales, en 4K.",
        "tags": "#carbono #quimica #vida #atomo #ciencia #4k #stem",
    },
    {
        "src": "dna/dna-tata.mp4", "slug": "adn-tata", "li": True,
        "titulo": "ADN · caja TATA — dónde arranca un gen",
        "copy": "¿Dónde empieza a leerse un gen? 📖 La 'caja TATA' es la señal que le dice "
                "a tu célula 'aquí arranca'. Sin ella, no se lee nada. Geometría B-form "
                "real y la música ES su secuencia.",
        "tags": "#adn #genetica #ciencia #4k #stem #biologia",
    },
]


def load_peaks():
    if not os.path.exists(PEAKS):
        return {}
    with open(PEAKS) as f:
        data = json.load(f)
    return {r["name"]: r for r in data}


def main():
    os.makedirs(OUT, exist_ok=True)
    peaks = load_peaks()
    lines = [
        "# 🔥 SUBIDAS HOY — 2026-06-18  ·  TOP 10 por fuerza de gancho",
        "",
        f"> **CTA fijo (va en todos):** `{CTA}`",
        "> **SIN link en el caption** → TikTok/IG castigan URLs externas. El link va SOLO en la bio del perfil.",
        "> **Orden = orden de subida.** Sube **#1 primero** (mejor gancho), repártelos en el día.",
        "> **NO subas en bache de 10** → TikTok lo lee como spam. 1 cada cierto rato, nativo a CADA plataforma.",
        "> **NUNCA descargues de TikTok para re-subir** → la marca de agua mata el alcance. Usa estos archivos limpios.",
        "> **`peak`** = el segundo del CUADRO MÁS FUERTE de cada video (por si quieres re-cortar el cold-open ahí después).",
        "",
        "Leyenda: **TT** TikTok · **IG** Instagram · **YT** YouTube Shorts · **LI** LinkedIn · ⭐ = digno de LinkedIn",
        "",
        "---",
        "",
    ]
    copied = 0
    for i, p in enumerate(PICKS, 1):
        # preferir el video con cold-open ya editado (_hoy_hooks/<stem>-hook.mp4);
        # si no existe, caer al original (copia limpia sin gancho).
        stem = os.path.splitext(os.path.basename(p["src"]))[0]
        hook = os.path.join(HOOKS, f"{stem}-hook.mp4")
        orig = os.path.join(ROOT, "dist-video", p["src"])
        src = hook if os.path.exists(hook) else orig
        edited = os.path.exists(hook)
        if not os.path.exists(src):
            print(f"  [FALTA] {src}")
            continue
        name = f"{i:02d}-{p['slug']}.mp4"
        dst = os.path.join(OUT, name)
        shutil.copy2(src, dst)
        copied += 1
        star = " ⭐" if p.get("li") else ""
        rec = peaks.get(os.path.basename(p["src"]))
        peak_s = rec["peaks"][0]["t"] if rec and rec.get("peaks") else "?"
        # ordena picos por z para reportar el MÁS fuerte primero
        if rec and rec.get("peaks"):
            best = max(rec["peaks"], key=lambda x: x["z"])
            peak_s = best["t"]
        gancho = "cold-open ✓" if edited else "SIN editar"
        plats = "[ ]TT  [ ]IG  [ ]YT" + ("  [ ]LI" if p.get("li") else "")
        lines += [
            f"**{i:02d}.{star} {p['titulo']}** — `{name}`  ·  {gancho}  ·  pico ≈ {peak_s}s",
            f"`{plats}`",
            f"> {p['copy']} {CTA}",
            f"> `{p['tags']}`",
            "",
        ]
    md = os.path.join(OUT, "SUBIDAS-HOY.md")
    with open(md, "w") as f:
        f.write("\n".join(lines))
    print(f"\n  ✓ {copied}/{len(PICKS)} videos copiados a {OUT}")
    print(f"  ✓ checklist -> {md}")
    print(f"\n  Orden de subida:")
    for i, p in enumerate(PICKS, 1):
        print(f"    {i:2d}. {p['slug']:18} ({p['src']})")


if __name__ == "__main__":
    main()

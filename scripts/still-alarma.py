#!/usr/bin/env python3
"""
still-alarma — mide los stills de una escena y ARMA LA HOJA con los números encima.

POR QUÉ EXISTE (2026-08-31). Los stills se juzgan a ojo, y está bien: el ojo es el juez
final del canon. Pero el ojo de ian NO tiene por qué gastarse en cosas que un número caza
sin discusión — void muerto, pared plana, cuadro quemado. Esta alarma los caza y ESCRIBE
el veredicto sobre la propia imagen, para que la hoja que ian abre ya venga con las
banderas puestas y él decida lo que sí es cuestión de gusto: encuadre, ritmo, belleza.

LO QUE MIDE
  fill   — fracción del cuadro con señal. Los ganadores viven en 0.74-0.82 medido sobre la
           nube; abajo de ~0.12 sostenido es void muerto (canon §pantalla-verify).
  pared  — INFORMATIVO, no bandera. Se intentó cazar en píxeles el corte que ian vio el
           2026-08-30, y NO se logró: contra los dos controles el rey da 0.09-0.24 y el bin
           cortado 0.07-0.25. Se deja el número por si algún día separa, con la advertencia
           puesta. Para ESE defecto el portero es bin-gate.py, en los datos.
  quemado — % de píxeles >240. Destello ~4 % es normal; pared blanca >18 % es defecto.
  morado  — el negro teñido (canon §DEFECTOS): azul > rojo en las zonas oscuras.

  python3 scripts/still-alarma.py <carpeta-de-pngs> --out HOJA.png
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

def medir(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    luma = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    m = luma > 12                                   # máscara de SEÑAL (no negro)

    fill = float(m.mean())
    quemado = float((luma > 240).mean()) * 100

    # ── morado: SOLO sobre el fondo de verdad (luma < 8). Primera versión usaba luma < 40 y
    # daba +19 a +46 en el alcohol — falso positivo: la nube ES magenta, así que su periferia
    # tenue es legítimamente azul>rojo. El defecto del canon es el NEGRO teñido, no la nube.
    osc = luma < 8
    morado = 0.0
    if osc.sum() > 1000:
        b, r = a[..., 2][osc].mean(), a[..., 0][osc].mean()
        morado = float(b - r)

    # ── PARED: un borde de la nube que corre RECTO. Por cada renglón se toma el primer y
    # el último píxel con señal; si ese borde se queda casi en la misma columna durante
    # muchos renglones seguidos, es un corte, no una nube. Se mide en los dos ejes.
    def filo_recto(l):
        """¿Hay un FILO RECTO en la imagen? (Hough pobre, sin dependencias.)

        DOS versiones anteriores fallaron y vale anotar por qué, porque las dos fallaron
        por lo mismo. (1) Seguir el BORDE de la máscara: se ahoga en el polvo de la
        periferia. (2) Buscar columnas/renglones con salto fuerte: solo caza paredes
        ALINEADAS A LOS EJES — y el corte que ian vio era DIAGONAL, porque la caja de
        muestreo está rotada por la cámara. Una alarma que solo ve paredes verticales no
        sirve para una escena con cámara libre.

        Esta versión no supone orientación: toma los píxeles de gradiente fuerte, y para
        cada ángulo proyecta sus coordenadas sobre la normal (rho = x·cos + y·sin). Una
        recta de verdad amontona TODOS sus píxeles en el mismo rho → un pico. Se devuelve
        la fracción de píxeles-borde que caen en el mejor pico: una nube da ~0.02-0.05
        (bordes repartidos en todas direcciones), un corte recto da mucho más."""
        g = np.hypot(np.gradient(l, axis=0), np.gradient(l, axis=1))
        thr = float(np.percentile(g, 99.2))
        ys, xs = np.nonzero(g > max(thr, 4.0))
        if ys.size < 200:
            return 0.0
        if ys.size > 20000:                              # muestra: el pico es estadístico
            k = np.random.default_rng(0).choice(ys.size, 20000, replace=False)
            ys, xs = ys[k], xs[k]
        xs = xs - xs.mean(); ys = ys - ys.mean()
        mejor = 0.0
        for th in np.linspace(0, np.pi, 60, endpoint=False):
            rho = xs * np.cos(th) + ys * np.sin(th)
            h, _ = np.histogram(rho, bins=64)
            mejor = max(mejor, float(h.max()) / rho.size)
        return mejor

    # se mide en una versión chica: la pared es una propiedad de FORMA, no de resolución,
    # y a tamaño completo esto tardaría minutos por still.
    chico = np.asarray(im.resize((240, 427 if im.height > im.width else 135))).astype(np.float32)
    lc = chico @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    pared = filo_recto(lc)

    banderas = []
    # VOID calibrado contra el REY: su cuadro más vacío da 0.165 y su promedio 0.31. Abajo
    # de 0.10 el sujeto ya no sostiene la pantalla (canon: cero void muerto).
    if fill < 0.10: banderas.append('VOID')
    # ⚠ `pared` se MIDE pero NO levanta bandera. MEDIDO 2026-08-31 con los dos controles:
    # el REY (bin sano, video publicado) da 0.09-0.24 y el bin CORTADO da 0.07-0.25. No
    # separa. Tres versiones del detector (borde de máscara → salto por columna → Hough sin
    # orientación) y ninguna distingue un corte de caja del contraste normal de una nube.
    # La lección es la del canon: un gate que no separa no decide nada, y embarcarlo es peor
    # que no tenerlo porque enseña a ignorar las banderas. EL portero de este defecto es
    # scripts/bin-gate.py, que lo mide en los DATOS y ahí sí es inapelable (9.32 % contra 0 %).
    if quemado > 18: banderas.append('QUEMADO')
    # morado: se MIDE y se reporta, pero NO levanta bandera aquí. El defecto del canon es el
    # negro teñido de un GRADE (prueba decisiva: cuadro base vs graded), y estos stills son
    # capturas de escena SIN grade. En una molécula magenta el fondo casi-negro es legítimamente
    # azul>rojo: como bandera daba 8 de 8 falsos positivos. Un portero que grita siempre se ignora.
    return dict(fill=fill, pared=pared, quemado=quemado, morado=morado, banderas=banderas, im=im)


def ventanas_negras(mid):
    """Ventanas donde el cuadro DEBE estar negro, leídas del manifiesto del video.

    Sin esto la alarma reprobaba la figura 3 de la mecánica del O₂ ("quita las nubes"),
    que es justo el momento en que la pieza PRUEBA su frase apagando todas las capas.
    Un portero que reprueba el argumento del video no sirve — es el mismo error que ya
    está anotado en el canon: un gate que reprueba al rey no decide nada."""
    if not mid:
        return []
    f = os.path.join(ROOT, 'videos', f'{mid}.json')
    if not os.path.exists(f):
        return []
    import json
    v = json.load(open(f)).get('render', {}).get('ventanasNegras', '')
    out = []
    for w in str(v).split(','):
        w = w.strip()
        if '-' in w:
            a, b = w.split('-')
            try: out.append((float(a), float(b)))
            except ValueError: pass
    return out


def main():
    carpeta = sys.argv[1]
    mid = sys.argv[sys.argv.index('--video') + 1] if '--video' in sys.argv else ''
    negras = ventanas_negras(mid)
    if negras:
        print(f"(ventanas negras declaradas por {mid}: {negras} — ahí el negro es el argumento, no un defecto)")
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(carpeta, 'HOJA.png')
    files = sorted(glob.glob(os.path.join(carpeta, '*.png')))
    files = [f for f in files if 'HOJA' not in os.path.basename(f)]
    if not files:
        raise SystemExit(f"✗ no hay PNGs en {carpeta}")

    res = []
    print(f"{'still':22s} {'fill':>6s} {'pared':>6s} {'quem%':>6s} {'morado':>7s}  banderas")
    import re
    for f in files:
        d = medir(f)
        # ¿este still cae en una ventana negra declarada? entonces no se le pide llenado.
        mt = re.search(r't(\d+)', os.path.basename(f))
        if mt and negras:
            tt = float(mt.group(1))
            if any(a <= tt <= b for a, b in negras):
                d['banderas'] = [x for x in d['banderas'] if x != 'VOID'] + ['(negra a propósito)']
        res.append((f, d))
        print(f"{os.path.basename(f):22s} {d['fill']:6.3f} {d['pared']:6.2f} {d['quemado']:6.2f} {d['morado']:7.1f}  {' '.join(d['banderas']) or 'ok'}")

    # ── hoja de contacto con el veredicto QUEMADO en la imagen
    cols = min(6, len(res))
    filas = (len(res) + cols - 1) // cols
    tw = 300
    th = int(tw * res[0][1]['im'].height / res[0][1]['im'].width)
    hoja = Image.new('RGB', (cols * tw, filas * (th + 26)), (8, 8, 10))
    dr = ImageDraw.Draw(hoja)
    for i, (f, d) in enumerate(res):
        x, y = (i % cols) * tw, (i // cols) * (th + 26)
        hoja.paste(d['im'].resize((tw, th)), (x, y))
        etq = f"{os.path.basename(f).replace('.png','')}  fill {d['fill']:.2f}"
        malo = [x for x in d['banderas'] if not x.startswith('(')]
        col = (255, 90, 90) if malo else (150, 255, 150)
        if d['banderas']:
            etq += '  ' + ' '.join(d['banderas'])
        dr.text((x + 5, y + th + 7), etq, fill=col)
    if out != '/dev/null':
        hoja.save(out)
    print(f"\n✓ hoja → {out}  ({cols}×{filas})" if out != "/dev/null" else "")

    malos = [os.path.basename(f) for f, d in res if [x for x in d['banderas'] if not x.startswith('(')]]
    if malos:
        print(f"✗ {len(malos)} still(s) con bandera: {', '.join(malos)}")
    else:
        print("✔ ningún still levanta bandera — el juicio que queda es de OJO (encuadre, ritmo, belleza)")
    return 0


if __name__ == '__main__':
    sys.exit(main())

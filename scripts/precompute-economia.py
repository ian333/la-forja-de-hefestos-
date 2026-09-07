#!/usr/bin/env python3
"""EL MOTOR DE ECONOMÍA — dos modelos publicados, simulados de verdad, en formato WAP2.

Por qué existe (ian, 2026-09-07): «¿por qué hay personas más ricas que tú? Siempre hay alguien más
rico, y siempre habrá alguien más rico que el que tú piensas. Por la emergencia de grupos… por eso
no conozco a Steve Jobs, estamos en grupos separados».

Son DOS preguntas y DOS mecanismos distintos, y esta simulación no los mezcla:

  ACTO 1 · LA COLA QUE NO SE ACABA — condensación de riqueza (Bouchaud & Mézard, 2000,
      «Wealth condensation in a simple model of economy»). N agentes con la MISMA riqueza; cada
      uno la multiplica por un rendimiento ALEATORIO (el mismo para todos, en promedio) y además
      intercambia con la media a tasa J. Nadie roba, nadie es más listo: el rendimiento es el
      mismo sorteo para todos. Aun así aparece una cola de Pareto: el más rico termina con
      decenas de veces la media, y por debajo de él siempre hay otro.
      MEDIDO contra las alternativas (2026-09-07, N=12000, misma semilla de comparación): el
      intercambio cinético con ahorro da máx 4.6× la media y el puro (Dragulescu-Yakovenko)
      10.6×; ninguno de los dos sostiene «siempre hay alguien más rico». Con la semilla de
      producción este modelo da **Gini 0.482, top 1 % = 10.6 %, el más rico 41.8× la media**.
      Sigue siendo CONSERVADOR contra el mundo real (top 1 % ≈ 30-45 % según país): el modelo
      se queda corto, no exagera. Eso es lo que se puede decir en el video.

  ACTO 2 · POR QUÉ NO LOS CONOCES — segregación de Schelling.
      Schelling (1971): cada agente mira a sus vecinos y se muda si MENOS de un tercio se le
      parece (aquí, "parecerse" = estar en el mismo quintil de riqueza). Un tercio es una
      preferencia SUAVE: nadie exige mayoría, nadie odia a nadie. Y aun así la ciudad se
      separa sola. Se mide el % de vecinos del propio quintil, antes y después.

Nada se dibuja a mano: las posiciones salen de la dinámica. Lo único declarado como licencia
visual es el MAPA de riqueza→altura (z), que es una lectura, no un resultado.

Salida: public/precomputed/economia-grupos.bin en formato WAP2 (el mismo que leen las nubes de
CinematicMolecule), para que el renderizador que ya existe lo pinte sin tocar una línea:
  · acc  = agentes del quintil bajo      (los muchos)
  · dep  = agentes de los quintiles medios
  · spin = agentes del quintil alto      (los pocos)
  · núcleos = el top 0.1 %, los puntos brillantes que nunca vas a conocer

  python3 scripts/precompute-economia.py [--n 12000] [--k 240]
"""
import os, sys, json, struct
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'precomputed', 'economia-grupos.bin')
OUT_JSON = os.path.join(ROOT, 'public', 'precomputed', 'economia-grupos.json')

N = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 40000
K = int(sys.argv[sys.argv.index('--k') + 1]) if '--k' in sys.argv else 120
J_INTER = 0.03         # tasa de intercambio con la media (Bouchaud-Mézard); más baja = más desigual
SIGMA = 0.25           # volatilidad del rendimiento, IGUAL para todos: ahí está la trampa del modelo
DT = 0.01
TOL = 1 / 3            # Schelling: se muda si menos de 1/3 de sus vecinos es de su quintil
VECINOS = 8            # k vecinos más cercanos que mira cada agente
CAJA = 5.0             # semi-lado de la caja. MEDIDO 2026-09-07: con 12,000 agentes en ±9 la nube
                       # salía INVISIBLE (fill 0.004, solo se veían los núcleos). El renderizador
                       # espera la densidad de una nube electrónica (~100k puntos en pocos bohr),
                       # así que la economía necesita MÁS agentes en MENOS caja para leerse.
ALTURA = 6.0           # altura máxima del mapa riqueza→z (LICENCIA VISUAL, declarada)
SEMILLA = 20260907


def gini(w):
    x = np.sort(w); n = len(x); c = np.cumsum(x)
    return (n + 1 - 2 * (c.sum() / c[-1])) / n


def acto1_riqueza(rng, pasos):
    """Bouchaud-Mézard: dw = w·(ruido multiplicativo) + J·(media − w). Riqueza por cuadro."""
    w = np.ones(N)
    serie = []
    por_cuadro = max(1, pasos // (K // 2))
    for c in range(K // 2):
        for _ in range(por_cuadro):
            eta = rng.normal(0, SIGMA * np.sqrt(DT), N)
            w = w * np.exp(eta - 0.5 * SIGMA * SIGMA * DT) + J_INTER * DT * (w.mean() - w)
            w = np.maximum(w, 1e-9)
        serie.append(w.copy())
    return serie


def vecinos_idx(p, k):
    """k vecinos más cercanos en el ESPACIO SOCIAL (3D)."""
    from scipy.spatial import cKDTree
    return cKDTree(p).query(p, k=k + 1)[1][:, 1:]


def acto2_schelling(rng, p3, quintil, cuadros, barridos_por_cuadro=12):
    """Schelling: el infeliz se muda a un hueco al azar. Devuelve xy por cuadro + la felicidad.

    OJO (medido 2026-09-07): la convergencia depende de cuántas MUDANZAS ocurren, no de cuántos
    cuadros se graben. Con 40,000 agentes y una sola ronda por cuadro se quedaba en 42.8 % de
    vecinos iguales — a medio separar, que no es el resultado de Schelling sino su transitorio.
    Con 12 barridos por cuadro converge y se ve LLEGAR a la meseta."""
    p3 = p3.copy(); serie = []; medida = []
    for c in range(cuadros):
        for _ in range(barridos_por_cuadro):
            vec = vecinos_idx(p3, VECINOS)
            igual = (quintil[vec] == quintil[:, None]).mean(axis=1)
            infeliz = np.where(igual < TOL)[0]
            if not len(infeliz): break
            tope = max(500, len(p3) // 12)
            mueve = infeliz if len(infeliz) <= tope else rng.choice(infeliz, tope, replace=False)
            p3[mueve] = rng.uniform(-CAJA, CAJA, (len(mueve), 3))
        medida.append(float(igual.mean()))
        serie.append(p3.copy())
    return serie, medida


def main():
    rng = np.random.default_rng(SEMILLA)
    print(f'▶ ACTO 1 · condensación Bouchaud-Mézard · N={N} agentes, J={J_INTER}, σ={SIGMA}', flush=True)
    serie_w = acto1_riqueza(rng, pasos=4000)
    w = serie_w[-1]
    q = np.searchsorted(np.quantile(w, [.2, .4, .6, .8]), w)          # quintil 0..4
    orden = np.argsort(w)
    top1 = w[orden[-N // 100:]].sum() / w.sum()
    print(f'   Gini {gini(np.ones(N)):.3f} (inicio, todos iguales) → {gini(w):.3f} (final)')
    print(f'   el 1 % más rico se queda con el {100*top1:.1f} % · el más rico tiene {w.max()/w.mean():.1f}× la media')

    print(f'▶ ACTO 2 · Schelling en 3D · tolerancia {TOL:.2f}, {VECINOS} vecinos', flush=True)
    p0 = rng.uniform(-CAJA, CAJA, (N, 3))
    serie_xy, felicidad = acto2_schelling(rng, p0, q, cuadros=K - len(serie_w))
    print(f'   vecinos del MISMO quintil: {100*felicidad[0]:.1f} % (al azar) → {100*felicidad[-1]:.1f} % (al final)')

    # ── trayectoria completa: acto 1 (quietos, sube la altura) + acto 2 (se mueven, altura fija)
    pos = np.zeros((K, N, 3), dtype=np.float32)
    wmax = np.quantile(serie_w[-1], 0.999)
    # EL ESPACIO SOCIAL ES 3D, y eso es una DECISIÓN, no un descuido. Se probó con un mapa plano
    # (2026-09-07) y desde cualquier ángulo se veía una hoja de papel: de frente un rectángulo, de
    # canto una raya. Un motor de NUBES pide volumen. Y de paso es más honesto: la gente no se
    # agrupa en un mapa, se agrupa en un espacio de muchas dimensiones (barrio, escuela, trabajo,
    # idioma); aquí se dibujan tres de ellas.
    #
    # ACTO 1 · la riqueza se dibuja como CERCANÍA AL CENTRO (licencia declarada): todos empiezan
    # repartidos y el que acumula se va al centro. Al final hay un núcleo brillante y un halo.
    dir0 = rng.normal(size=(N, 3)); dir0 /= np.linalg.norm(dir0, axis=1, keepdims=True)
    for c, wc in enumerate(serie_w):
        cerca = np.clip(wc / wmax, 0, 1.6)                             # 0 = pobre (lejos), 1.6 = rico (centro)
        pos[c] = dir0 * (CAJA * (1.0 - 0.62 * np.clip(cerca, 0, 1))[:, None])
    for c, p3 in enumerate(serie_xy):                                  # ACTO 2 · Schelling en 3D
        pos[len(serie_w) + c] = p3

    # ── reparto en los tres canales del formato + los núcleos
    bajo = np.where(q == 0)[0]
    medio = np.where((q >= 1) & (q <= 3))[0]
    alto = np.where(q == 4)[0]
    ricos = orden[-max(8, N // 1000):]                                 # top 0.1 %: los núcleos
    grupos = {'acc': bajo, 'dep': medio, 'spin': alto}
    posq = 32767 / (max(CAJA, ALTURA) * 1.25)
    qz = lambda a: np.clip(np.round(a * posq), -32767, 32767).astype('<i2')

    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', len(bajo), len(medio), len(alto), K, len(ricos), 0, 0))
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))
        fp.write(np.linspace(0, 1, K).astype('<f4').tobytes())         # Rvals: el "avance" 0→1
        fp.write((np.array(felicidad[:1] * len(serie_w) + felicidad)[:K]).astype('<f4').tobytes())
        fp.write(np.zeros(len(bajo) * 3, dtype=np.uint8).tobytes())    # accColor: sin recolorear
        fp.write(np.full(len(ricos), 8, dtype='<i2').tobytes())        # Z de los núcleos (tamaño)
        for g in ('acc', 'dep', 'spin'):
            fp.write(qz(pos[:, grupos[g], :]).tobytes())
        fp.write(qz(pos[:, ricos, :]).tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  ·  {N} agentes × {K} cuadros')

    json.dump({'modelo_acto1': 'Bouchaud & Mezard (2000), Wealth condensation in a simple model of economy',
               'modelo_acto2': 'Schelling (1971)', 'N': N, 'K': K, 'J_intercambio': J_INTER, 'sigma': SIGMA,
               'tolerancia': TOL, 'vecinos': VECINOS, 'semilla': SEMILLA,
               'gini_inicio': 0.0, 'gini_final': round(float(gini(w)), 4),
               'top1_pct': round(float(100 * top1), 2),
               'mas_rico_x_media': round(float(w.max() / w.mean()), 2),
               'vecinos_mismo_quintil_inicio_pct': round(100 * felicidad[0], 2),
               'vecinos_mismo_quintil_final_pct': round(100 * felicidad[-1], 2),
               'licencia_visual': 'acto 1: riqueza→cercanía al centro. acto 2: el espacio social se dibuja en 3D (la gente se agrupa en muchas dimensiones; aquí van tres). Las dos son LECTURAS declaradas, no resultados.',
               'reparto': {'acc': 'quintil bajo', 'dep': 'quintiles medios', 'spin': 'quintil alto',
                           'nucleos': 'top 0.1 %'}},
              open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)
    # CAMPO VACÍO: el registro de escenas exige un archivo de campo, pero aquí no hay campo
    # eléctrico que dibujar — una economía no tiene líneas de fuerza. Se escribe con NL=0 en vez
    # de apuntar al campo de otra pieza, que sería dibujar física que no es de este modelo.
    ef = OUT.replace('.bin', '-efield.bin')
    with open(ef, 'wb') as fp:
        fp.write(struct.pack('<3i', K, 0, 0))
        fp.write(np.linspace(0, 1, K).astype('<f4').tobytes())
    print(f'OK  {ef}  (campo VACÍO, NL=0: este modelo no tiene campo)')
    print(f'OK  {OUT_JSON}')


if __name__ == '__main__':
    main()

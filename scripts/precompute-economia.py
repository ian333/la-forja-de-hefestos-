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
      parece (aquí, "parecerse" = estar en el mismo grupo de riqueza). Un tercio es una
      preferencia SUAVE: nadie exige mayoría, nadie odia a nadie. Y aun así la ciudad se
      separa sola. Se mide el % de vecinos del propio grupo, antes y después.

Nada se dibuja a mano: las posiciones salen de la dinámica. Lo único declarado como licencia
visual es el MAPA de riqueza→altura (z), que es una lectura, no un resultado.

Salida: public/precomputed/economia-grupos.bin en formato WAP2 (el mismo que leen las nubes de
CinematicMolecule), para que el renderizador que ya existe lo pinte sin tocar una línea:
  · acc  = TODOS los agentes, con COLOR POR PUNTO según su grupo (binColors, el mismo camino
           que usa la nube por elemento del alcohol). Medido 2026-09-08: repartirlos en los tres
           canales acc/dep/spin NO servía — los tres comparten la paleta del Δρ y a esta densidad
           se mezclan en un magenta uniforme, así que la segregación no se veía aunque estuviera.
  · dep / spin = vacíos
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
TOL = 0.5              # Schelling: se muda si menos de la MITAD de sus vecinos es de su grupo.
                       # Con 3 grupos el azar ya da 1/3, así que una tolerancia de 1/3 deja a casi
                       # todos marginalmente contentos y casi nadie se mueve. 1/2 es la del paper
                       # clásico y sigue siendo SUAVE: sólo pides que la mitad se te parezca.
GRUPOS = 3             # terciles, no quintiles: los 3 grupos caen 1:1 en los 3 canales de nube del
                       # renderizador. Con 5 quintiles el canal de en medio mezclaba tres y la
                       # segregación se veía como RUIDO de color en vez de manchas (medido 09-07).
VECINOS = 60           # cuánta gente es «tu barrio». MEDIDO 2026-09-08: con 8 vecinos entre 40,000
                       # agentes el barrio mide ~0.1 unidades y la segregación ocurre a escala
                       # MICROSCÓPICA: el número salía bien (88.9 % de vecinos iguales) y la imagen
                       # se veía uniforme, con los tres colores entreverados hasta en un close-up.
                       # El fenómeno estaba en los datos y NO en la pantalla. Con 120 el barrio es
                       # ~1/7 del diámetro y las manchas se ven. La lección: en un modelo de agentes
                       # el TAMAÑO DEL VECINDARIO es lo que decide si el resultado es visible.
CAJA = 5.0             # semi-lado de la caja. MEDIDO 2026-09-07: con 12,000 agentes en ±9 la nube
                       # salía INVISIBLE (fill 0.004, solo se veían los núcleos). El renderizador
                       # espera la densidad de una nube electrónica (~100k puntos en pocos bohr),
                       # así que la economía necesita MÁS agentes en MENOS caja para leerse.
GROSOR = 0.55          # grosor del disco. LA FORMA ES UN DISCO, no una bola, y es una decisión
                       # medida (2026-09-08): en una bola llena de 40,000 puntos cada rayo de
                       # visión atraviesa muchas manchas de colores distintos y se PROMEDIAN — la
                       # segregación daba 87 % en los datos y la pantalla se veía uniforme, hasta
                       # en close-up. Un disco delgado visto de frente deja que cada rayo cruce UNA
                       # mancha, y entonces se ve. Es la misma razón por la que una radiografía de
                       # cuerpo entero no muestra nada y un corte sí.
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


def _en_disco(rng, n):
    """Un punto al azar en el disco X-Y de radio CAJA y grosor GROSOR."""
    th = rng.random(n) * 2 * np.pi; r = CAJA * rng.random(n) ** 0.5
    return np.stack([r * np.cos(th), r * np.sin(th), rng.normal(0, GROSOR, n)], axis=1)


def acto2_schelling(rng, p3, quintil, cuadros, barridos_por_cuadro=6):
    """Schelling: el infeliz se muda a un hueco al azar. Devuelve xy por cuadro + la felicidad.

    OJO (medido 2026-09-07): la convergencia depende de cuántas MUDANZAS ocurren, no de cuántos
    cuadros se graben. Con 40,000 agentes y una sola ronda por cuadro se quedaba en 42.8 % de
    vecinos iguales — a medio separar, que no es el resultado de Schelling sino su transitorio.
    Con 12 barridos por cuadro converge y se ve LLEGAR a la meseta."""
    """LA MUDANZA ES DIRIGIDA, no al azar (medido 2026-09-08). Con el barrio grande TODOS quedan
    por debajo de la tolerancia, y si todos se mudan a un lugar al azar el resultado es barajar:
    la medida se quedó clavada en 33.3 % → 33.3 %, cero segregación. El Schelling que segrega es
    el de «te mudas a un lugar donde estarías MEJOR»: se propone un destino, se mide ahí mismo, y
    sólo se acepta si mejora. Eso es lo que hace trinquete y forma las manchas."""
    from scipy.spatial import cKDTree
    p3 = p3.copy(); serie = []; medida = []
    for c in range(cuadros):
        for _ in range(barridos_por_cuadro):
            arbol = cKDTree(p3)
            vec = arbol.query(p3, k=VECINOS + 1)[1][:, 1:]
            igual = (quintil[vec] == quintil[:, None]).mean(axis=1)
            infeliz = np.where(igual < TOL)[0]
            if not len(infeliz): break
            tope = max(500, len(p3) // 8)
            mueve = infeliz if len(infeliz) <= tope else rng.choice(infeliz, tope, replace=False)
            destino = _en_disco(rng, len(mueve))
            vc = arbol.query(destino, k=VECINOS)[1]
            igual_ahi = (quintil[vc] == quintil[mueve][:, None]).mean(axis=1)
            acepta = igual_ahi > igual[mueve]
            p3[mueve[acepta]] = destino[acepta]
        medida.append(float(igual.mean()))
        serie.append(p3.copy())
    return serie, medida


def main():
    rng = np.random.default_rng(SEMILLA)
    print(f'▶ ACTO 1 · condensación Bouchaud-Mézard · N={N} agentes, J={J_INTER}, σ={SIGMA}', flush=True)
    serie_w = acto1_riqueza(rng, pasos=4000)
    w = serie_w[-1]
    cortes = np.quantile(w, np.linspace(0, 1, GRUPOS + 1)[1:-1])
    q = np.searchsorted(cortes, w)                                    # grupo 0..GRUPOS-1
    orden = np.argsort(w)
    top1 = w[orden[-N // 100:]].sum() / w.sum()
    print(f'   Gini {gini(np.ones(N)):.3f} (inicio, todos iguales) → {gini(w):.3f} (final)')
    print(f'   el 1 % más rico se queda con el {100*top1:.1f} % · el más rico tiene {w.max()/w.mean():.1f}× la media')

    print(f'▶ ACTO 2 · Schelling en 3D · tolerancia {TOL:.2f}, {VECINOS} vecinos', flush=True)
    p0 = _en_disco(rng, N)
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
    # ACTO 1 · el disco en el plano X-Y (el que la cámara ve DE FRENTE) y la riqueza COMPRIME
    # hacia el centro. Cada agente trae su radio base u^(1/2) —uniforme en área— para que al
    # principio el disco esté parejo; al final los ricos son un núcleo apretado y brillante
    # dentro de un halo de pobres. El mapa riqueza→cercanía al centro es LICENCIA declarada.
    th = rng.random(N) * 2 * np.pi
    u = rng.random(N) ** 0.5
    zz = rng.normal(0, GROSOR, N)
    for c, wc in enumerate(serie_w):
        cerca = np.clip(wc / wmax, 0, 1)                                # 0 = pobre (orilla), 1 = rico (centro)
        r = CAJA * u * (1.0 - 0.85 * cerca)
        pos[c, :, 0] = r * np.cos(th); pos[c, :, 1] = r * np.sin(th); pos[c, :, 2] = zz
    for c, p3 in enumerate(serie_xy):                                  # ACTO 2 · Schelling en 3D
        pos[len(serie_w) + c] = p3

    # ── reparto en los tres canales del formato + los núcleos
    ricos = orden[-max(8, N // 1000):]                                 # top 0.1 %: los núcleos
    # UN SOLO CANAL con color por punto: azul frío el tercil bajo, magenta el medio, oro el alto.
    PAL = np.array([[60, 120, 255], [225, 60, 200], [255, 195, 80]], dtype=np.uint8)
    color = PAL[np.clip(q, 0, GRUPOS - 1)]
    posq = 32767 / (CAJA * 1.25)
    qz = lambda a: np.clip(np.round(a * posq), -32767, 32767).astype('<i2')

    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', N, 0, 0, K, len(ricos), 0, 0))
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))   # R_MIN=0 (final) · R_MAX=1 (inicio)
        # Rvals va DESCENDENTE (1→0) porque así lo lee el motor: R alto = primer cuadro. Con la
        # rampa ascendente que puse primero, la búsqueda de cuadro se iba siempre al final y la
        # simulación no se reproducía (2026-09-08).
        fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())         # Rvals: el avance, 1→0
        fp.write((np.array(felicidad[:1] * len(serie_w) + felicidad)[:K]).astype('<f4').tobytes())
        fp.write(color.astype(np.uint8).tobytes())                      # accColor: el grupo de cada agente
        fp.write(np.full(len(ricos), 8, dtype='<i2').tobytes())        # Z de los núcleos (tamaño)
        fp.write(qz(pos).tobytes())                                     # acc = todos
        fp.write(qz(pos[:, ricos, :]).tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  ·  {N} agentes × {K} cuadros')

    json.dump({'modelo_acto1': 'Bouchaud & Mezard (2000), Wealth condensation in a simple model of economy',
               'modelo_acto2': 'Schelling (1971)', 'N': N, 'K': K, 'J_intercambio': J_INTER, 'sigma': SIGMA,
               'tolerancia': TOL, 'vecinos': VECINOS, 'grupos': GRUPOS, 'semilla': SEMILLA,
               'gini_inicio': 0.0, 'gini_final': round(float(gini(w)), 4),
               'top1_pct': round(float(100 * top1), 2),
               'mas_rico_x_media': round(float(w.max() / w.mean()), 2),
               'vecinos_mismo_quintil_inicio_pct': round(100 * felicidad[0], 2),
               'vecinos_mismo_quintil_final_pct': round(100 * felicidad[-1], 2),
               'licencia_visual': 'acto 1: riqueza→cercanía al centro del disco. La forma es un DISCO delgado (no una bola) para que la segregación se VEA: en un volumen lleno cada rayo promedia muchas manchas. Las dos son LECTURAS declaradas, no resultados del modelo.',
               'reparto': {'acc': 'TODOS, con color por punto (azul=bajo, magenta=medio, oro=alto)', 'dep': 'vacío', 'spin': 'vacío',
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

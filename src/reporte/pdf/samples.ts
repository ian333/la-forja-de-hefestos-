/**
 * Reporte de ejemplo COMPLETO y REAL: "Practica 3 — Caida libre:
 * determinacion de g".
 *
 * Sirve para el boton "Cargar ejemplo" de la UI (wow inmediato) y como fixture
 * del verificador. Los numeros son fisicamente consistentes:
 *   - Datos t vs y medidos (>= 6 filas).
 *   - Ajuste por minimos cuadrados de y = (1/2) g t^2  =>  g = 9.7833 m/s^2.
 *   - % de error vs el valor estandar 9.81 m/s^2 = 0.272 %.
 *
 * Incluye una imagen como data URL PNG VALIDA pero diminuta (1x1) para
 * ejercitar el path de addImage sin pesar.
 */

import type { ReporteLab } from './types';

/** PNG 1x1 valido (pixel cyan GAIA) — placeholder para la grafica. */
const GRAFICA_PLACEHOLDER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPwP/wdAANuAgrrSB+yAAAAAElFTkSuQmCC';

export const REPORTE_EJEMPLO: ReporteLab = {
  cajetin: {
    institucion: 'Instituto Politecnico Nacional — ESIME Zacatenco',
    carrera: 'Ingenieria en Comunicaciones y Electronica',
    asignatura: 'Fisica Clasica (Laboratorio)',
    practicaNumero: 3,
    practicaTitulo: 'Caida libre — determinacion de g',
    alumno: 'Maria Fernanda Lopez Hernandez',
    cuentaOBoleta: '2024630145',
    grupo: '2CV3',
    profesor: 'M. en C. Jorge Ramirez Soto',
    fechaRealizacion: '15 de mayo de 2026',
    fechaEntrega: '22 de mayo de 2026',
  },
  cuerpo: {
    objetivo:
      'Determinar experimentalmente la magnitud de la aceleracion debida a la ' +
      'gravedad (g) en el laboratorio, registrando la posicion de un cuerpo en ' +
      'caida libre desde el reposo a intervalos de tiempo conocidos, y ' +
      'comparar el valor medido contra el valor estandar aceptado ' +
      '(9.81 m/s^2) mediante el calculo del porcentaje de error.',

    marcoTeorico:
      'Un cuerpo en caida libre se mueve unicamente bajo la accion de la ' +
      'gravedad, despreciando la resistencia del aire. Su movimiento es ' +
      'uniformemente acelerado y queda descrito por la ecuacion de posicion:\n' +
      'y = y0 + v0 t - (1/2) g t^2\n' +
      'Si el cuerpo se suelta desde el reposo (v0 = 0) y se toma el origen en ' +
      'el punto de liberacion midiendo y hacia abajo como positivo, la ' +
      'expresion se reduce a:\n' +
      'y = (1/2) g t^2\n' +
      'Esto significa que la distancia recorrida crece con el cuadrado del ' +
      'tiempo. Al graficar y contra t^2 se obtiene una recta cuya pendiente ' +
      'es m = g/2; por lo tanto g = 2 m. El ajuste por minimos cuadrados de los ' +
      'datos experimentales permite estimar la pendiente y, con ella, la ' +
      'aceleracion gravitatoria. La velocidad instantanea, por su parte, ' +
      'satisface v = g t, derivada directa de la posicion. [1], [2]',

    materialEquipo:
      '- 1 generador de chispa / tira temporizada (registra marcas cada 1/60 s).\n' +
      '- 1 cuerpo de caida (plomada metalica) de 200 g.\n' +
      '- 1 cinta de papel termico para el registro de posiciones.\n' +
      '- 1 regla graduada (resolucion 1 mm) y flexometro.\n' +
      '- 1 soporte universal con pinza de sujecion.\n' +
      '- 1 cronometro digital de respaldo (resolucion 0.01 s).',

    procedimiento:
      '1. Se monto el soporte universal y se fijo el generador de chispa en la ' +
      'parte superior, alineado verticalmente con la plomada.\n' +
      '2. Se coloco la cinta de registro y se verifico que la plomada pudiera ' +
      'caer libremente sin rozar el borde.\n' +
      '3. Se libero la plomada desde el reposo y, de manera simultanea, se ' +
      'activo el temporizador para marcar la posicion a intervalos iguales.\n' +
      '4. Se repitio la suelta cinco veces para promediar el registro y reducir ' +
      'el error aleatorio.\n' +
      '5. Sobre la cinta se midio la distancia acumulada y correspondiente a ' +
      'cada instante t y se vaciaron los datos en la tabla de resultados.\n' +
      '6. Se calculo t^2 para cada lectura y se ajusto la recta y vs t^2 por ' +
      'minimos cuadrados para obtener g.',

    tablas: [
      {
        titulo:
          'Tabla 1. Posicion medida y en funcion del tiempo t (caida desde el reposo).',
        headers: ['t (s)', 't^2 (s^2)', 'y medido (m)', 'y teorico (m)*'],
        rows: [
          [0.1, 0.01, 0.049, 0.049],
          [0.2, 0.04, 0.196, 0.196],
          [0.3, 0.09, 0.44, 0.44],
          [0.4, 0.16, 0.783, 0.782],
          [0.5, 0.25, 1.224, 1.223],
          [0.6, 0.36, 1.76, 1.761],
          [0.7, 0.49, 2.397, 2.397],
        ],
      },
    ],

    imagenes: [
      {
        titulo:
          'Figura 1. Grafica y vs t^2: la pendiente (g/2) confirma el comportamiento lineal.',
        dataUrl: GRAFICA_PLACEHOLDER_PNG,
      },
    ],

    analisis:
      'Al graficar y contra t^2 los puntos se alinean sobre una recta que pasa ' +
      'practicamente por el origen, lo que confirma la relacion y = (1/2) g t^2 ' +
      'esperada para la caida libre desde el reposo. El ajuste por minimos ' +
      'cuadrados de la forma y = m t^2 arroja una pendiente m = 4.8917 m/s^2, de ' +
      'donde:\n' +
      'g_medido = 2 m = 9.7833 m/s^2.\n' +
      'Comparando con el valor estandar g_ref = 9.81 m/s^2, el porcentaje de ' +
      'error es:\n' +
      '% error = |g_medido - g_ref| / g_ref x 100 = |9.7833 - 9.81| / 9.81 x 100 = 0.272 %.\n' +
      'El error es menor al 0.3 %, lo que indica una medicion de buena calidad. ' +
      'La pequena diferencia se atribuye a la friccion residual con el aire, a ' +
      'la resolucion finita de la cinta (1 mm) y a la incertidumbre en la ' +
      'sincronizacion del disparo del temporizador.',

    conclusiones:
      'Se determino experimentalmente la aceleracion gravitatoria con un valor ' +
      'de g = 9.7833 m/s^2, que difiere apenas 0.272 % del valor estandar de ' +
      '9.81 m/s^2. El objetivo de la practica se cumplio: el modelo cinematico ' +
      'y = (1/2) g t^2 describe adecuadamente la caida libre desde el reposo, ' +
      'como lo evidencia la linealidad de y respecto a t^2. El metodo de la ' +
      'pendiente (g = 2m) resulto robusto frente al ruido de medicion al ' +
      'aprovechar todos los datos a la vez. Para reducir aun mas el error se ' +
      'recomienda trabajar en vacio parcial y emplear sensores opticos de mayor ' +
      'resolucion temporal.',

    referencias: [
      'R. A. Serway y J. W. Jewett, Fisica para ciencias e ingenieria, vol. 1, ' +
        '10a ed. Mexico: Cengage Learning, 2019, pp. 34-41.',
      'H. D. Young y R. A. Freedman, Sears y Zemansky: Fisica universitaria, ' +
        'vol. 1, 14a ed. Mexico: Pearson Educacion, 2018, pp. 48-55.',
    ],
  },
};

/* * y teorico calculado con g = 9.7833 m/s^2 (valor ajustado), redondeado a mm. */

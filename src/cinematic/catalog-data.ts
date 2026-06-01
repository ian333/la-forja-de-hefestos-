// AUTOGENERADO por scripts/gen-catalog-meta.cjs desde scripts/catalog.json — NO editar a mano.
export const CATALOG_KEYS = new Set<string>(["metanol","etanol","isopropanol","dimetileter","formaldehido","acido-formico","propano","isobutano","ciclohexano","etileno","acetileno","benceno","hcn","o3","so2","ch3nh2","isooctano","acetona","acido-acetico","butadieno","h2o2"]);
export const CATALOG_CONJUGATED = new Set<string>(["benceno","o3","so2","butadieno"]);
export const CATALOG_FIELD: Record<string, 'pi' | 'sigma' | 'none'> = {
  "metanol": "none",
  "etanol": "none",
  "isopropanol": "none",
  "dimetileter": "none",
  "formaldehido": "none",
  "acido-formico": "none",
  "propano": "sigma",
  "isobutano": "sigma",
  "ciclohexano": "sigma",
  "etileno": "sigma",
  "acetileno": "sigma",
  "benceno": "pi",
  "hcn": "none",
  "o3": "pi",
  "so2": "pi",
  "ch3nh2": "none",
  "isooctano": "sigma",
  "acetona": "none",
  "acido-acetico": "none",
  "butadieno": "pi",
  "h2o2": "none"
};
export const CATALOG_FIELD_SUB: Record<string, string> = {
  "propano": "la nube σ envuelve la molécula, fría y pareja",
  "isobutano": "la nube σ envuelve la molécula, fría y pareja",
  "ciclohexano": "la nube σ envuelve la molécula, fría y pareja",
  "etileno": "la nube σ envuelve la molécula, fría y pareja",
  "acetileno": "la nube σ envuelve la molécula, fría y pareja",
  "benceno": "las caras π son ricas en electrones",
  "o3": "las caras π son ricas en electrones",
  "so2": "las caras π son ricas en electrones",
  "isooctano": "la nube σ envuelve la molécula, fría y pareja",
  "butadieno": "las caras π son ricas en electrones"
};
export const CATALOG_META: Record<string, { name: string; formula: string; fact: string }> = {
  "metanol": {
    "name": "Metanol",
    "formula": "CH3OH",
    "fact": "El metanol es venenoso: tu cuerpo lo convierte en formaldehído y ácido fórmico, que atacan el nervio óptico. Por eso un trago puede dejarte ciego. No te confíes, se parece muchísimo al etanol pero le falta un solo carbono."
  },
  "etanol": {
    "name": "Etanol",
    "formula": "C2H5OH",
    "fact": "Este es EL alcohol: el de la cerveza, el tequila y el vino. Solo le sobra un carbono frente al metanol, y por eso tu hígado sí lo puede procesar (lo vuelve acetaldehído, el de la cruda). Las levaduras lo fabrican fermentando azúcar sin oxígeno."
  },
  "isopropanol": {
    "name": "Isopropanol",
    "formula": "C3H8O",
    "fact": "Es el alcohol de tu botiquín, el que huele a hospital. Se evapora rapidísimo y se lleva el calor de tu piel, por eso te sientes fresco. A diferencia del etanol, el –OH está en el carbono CENTRAL, no en la punta: por eso es 'iso'."
  },
  "dimetileter": {
    "name": "Dimetil éter",
    "formula": "CH3OCH3",
    "fact": "Mismos átomos que el etanol (C2H6O), pero el oxígeno va EN MEDIO en vez de en la punta. Son isómeros: misma fórmula, molécula diferente. Por eso el dimetil éter es un gas que hierve a –24°C mientras el etanol es líquido: sin –OH, no hay puentes de hidrógeno que lo amarren."
  },
  "formaldehido": {
    "name": "Formaldehído",
    "formula": "CH2O",
    "fact": "El formaldehído es el carbonilo más pequeño que existe: solo un carbono, un oxígeno y dos hidrógenos, todos en un mismo plano perfecto. Tú lo conoces como conservador y desinfectante, pero en el espacio interestelar flota en nubes de gas y se cree que fue uno de los ladrillos químicos que precedieron a la vida."
  },
  "acido-formico": {
    "name": "Ácido fórmico",
    "formula": "HCOOH",
    "fact": "El ácido fórmico es el ácido orgánico más sencillo, y su nombre viene del latín formica: hormiga. Es literalmente la sustancia que las hormigas y las abejas inyectan cuando te pican y arde. Su grupo carboxilo (–COOH), con un oxígeno por doble enlace y otro sosteniendo el hidrógeno, es el mismo motor que define a todos los ácidos grasos de tu cuerpo."
  },
  "propano": {
    "name": "Propano",
    "formula": "C3H8",
    "fact": "El propano es el gas de tu tanque estacionario y de los encendedores. Solo tres carbonos, pero al quemarse cada molécula libera el calor que necesitas para cocinar. Lo guardamos líquido a presión y se vuelve gas en cuanto abres la válvula."
  },
  "isobutano": {
    "name": "Isobutano (2-metilpropano)",
    "formula": "C4H10",
    "fact": "El isobutano tiene la misma fórmula que el butano (C4H10) pero con la cadena doblada en T. Ese pequeño cambio de forma lo hace más volátil, por eso se usa como refrigerante ecológico (R-600a) en tu refri y como propelente en aerosoles. Misma receta, distinta arquitectura."
  },
  "ciclohexano": {
    "name": "Ciclohexano (silla)",
    "formula": "C6H12",
    "fact": "El ciclohexano parece un hexágono plano en los dibujos, pero en la realidad se pliega en forma de silla. ¿Por qué? Porque así cada carbono conserva su ángulo tetraédrico de 109.5° sin forzar nada. Un anillo plano tendría ángulos de 120° y estaría tensionado; la silla es la naturaleza eligiendo la geometría sin estrés. Sus átomos hasta saltan entre dos sillas miles de millones de veces por segundo."
  },
  "etileno": {
    "name": "Etileno",
    "formula": "C2H4",
    "fact": "El etileno es la molécula orgánica que más se produce en el mundo, pero también es una hormona vegetal: es el gas que tu plátano libera para madurar. Si guardas frutas juntas, el etileno de una apura a las demás. Su doble enlace plano congela toda la molécula en un solo plano: aquí no hay giro, y de esa rigidez nace casi todo el plástico de tu casa."
  },
  "acetileno": {
    "name": "Acetileno",
    "formula": "C2H2",
    "fact": "El acetileno es la molécula totalmente lineal: cuatro átomos en una sola línea recta. Su triple enlace guarda tanta energía que al quemarlo con oxígeno la llama llega a más de 3000 °C, suficiente para cortar acero. Por eso el soplete del soldador es de acetileno. Esa misma molécula recta y energética es el ladrillo con el que la química construye plásticos y medicinas."
  },
  "benceno": {
    "name": "Benceno",
    "formula": "C6H6",
    "fact": "El benceno esconde un truco: aunque lo dibujamos con dobles enlaces alternados, en la realidad TODOS sus enlaces miden lo mismo (1.40 Å), entre un simple y un doble. Sus seis electrones π no pertenecen a ningún enlace: flotan como un anillo continuo arriba y abajo del hexágono. Esa aromaticidad lo hace extraordinariamente estable y es el esqueleto de la aspirina, el TNT y la mayoría de los medicamentos que conoces."
  },
  "hcn": {
    "name": "Cianuro de hidrógeno",
    "formula": "HCN",
    "fact": "El olor a almendras amargas que algunos detectan en el cianuro viene de esta molécula lineal: el carbono y el nitrógeno comparten tres pares de electrones, el enlace más apretado de la química orgánica común. Ese mismo triple enlace bloquea la respiración celular al pegarse al hierro de tu mitocondria."
  },
  "o3": {
    "name": "Ozono",
    "formula": "O3",
    "fact": "El ozono que te protege del Sol allá arriba es la misma molécula que te irrita los pulmones aquí abajo. Su ángulo de 116.8° y sus enlaces idénticos (1.278 Å) son una resonancia: el par de electrones π flota entre los dos enlaces, ni totalmente simple ni doble. Por eso el oxígeno central queda con carga parcial positiva."
  },
  "so2": {
    "name": "Dióxido de azufre",
    "formula": "SO2",
    "fact": "Cuando hueles un cerillo recién apagado o la lluvia ácida, hueles esta V de azufre y oxígeno. El azufre guarda un par de electrones libre que empuja a los oxígenos y deja la molécula doblada a 119°. Sus dos enlaces S=O son idénticos por resonancia, más cortos que un enlace simple normal."
  },
  "ch3nh2": {
    "name": "Metilamina",
    "formula": "CH3NH2",
    "fact": "El olor a pescado podrido es básicamente esta molécula: amoniaco con un metilo pegado. El nitrógeno mantiene su par de electrones libre y su geometría piramidal (ángulos de ~107°), lo que la hace básica y capaz de robar protones. Tu cerebro la detecta en cantidades minúsculas porque señala comida descompuesta."
  },
  "isooctano": {
    "name": "Isooctano (2,2,4-trimetilpentano)",
    "formula": "C8H18",
    "fact": "El isooctano ES la referencia de la gasolina: por definición su octanaje es 100. Su carbono cuaternario (el que carga cuatro carbonos sin un solo hidrógeno) y sus ramas hacen que se queme suave y parejo dentro del motor, sin el golpeteo destructivo del 'cascabeleo'. Cuando ves '91' en la bomba, mides qué tanto se parece tu gasolina a esta molécula."
  },
  "acetona": {
    "name": "Acetona",
    "formula": "CH3COCH3",
    "fact": "La acetona es la cetona más pequeña y la más famosa: es el quitaesmalte y el disolvente que huele tan fuerte. Pero tu propio cuerpo la fabrica: cuando ayunas o haces mucho ejercicio, el hígado produce acetona como cuerpo cetónico para darte energía, y por eso el aliento puede oler dulce. Su carbonilo central plano es el mismo grupo que define a miles de cetonas."
  },
  "acido-acetico": {
    "name": "Ácido acético",
    "formula": "CH3COOH",
    "fact": "El ácido acético es el alma del vinagre: cuando lo hueles agrio, estás oliendo esta molécula. Es lo que producen las bacterias al fermentar el vino o la sidra, y la humanidad lo usa desde hace miles de años para conservar comida. Su grupo carboxilo es idéntico al del ácido fórmico, solo que cambia el hidrógeno por un metilo, mostrándote cómo la química construye familias enteras a partir de la misma pieza."
  },
  "butadieno": {
    "name": "1,3-Butadieno",
    "formula": "C4H6",
    "fact": "El butadieno parece tener dos dobles enlaces separados, pero en realidad sus electrones π se extienden por los cuatro carbonos a la vez: eso es la conjugación. La pista está en el enlace del medio, que se acorta porque no es del todo \"simple\". Esa nube de electrones compartida es la razón de que el butadieno se enlace consigo mismo y forme el caucho sintético de las llantas de tu coche."
  },
  "h2o2": {
    "name": "Peróxido de hidrógeno",
    "formula": "H2O2",
    "fact": "El agua oxigenada de tu botiquín tiene una geometría rarísima: no es plana. Los dos hidrógenos están torcidos 111.5° uno respecto al otro, como un libro a medio abrir. Esa torsión existe porque los cuatro pares libres de los oxígenos se repelen. El enlace O–O es débil (1.475 Å) y por eso se descompone burbujeando sobre tu herida."
  }
};
export const CATALOG_SCALE: Record<string, { what: string; measure: string; meaning: string }> = {
  "metanol": {
    "what": "Lo que ves: el alcohol más simple, un solo carbono unido a un grupo –OH.",
    "measure": "C–O · 1.43 Å",
    "meaning": "Apenas seis átomos: es el ladrillo mínimo de toda la familia de los alcoholes."
  },
  "etanol": {
    "what": "Lo que ves: dos carbonos en cadena y un grupo –OH en la punta: el alcohol que se bebe.",
    "measure": "C–C · 1.54 Å",
    "meaning": "El grupo –OH se lleva bien con el agua, por eso el etanol y el agua se mezclan en cualquier proporción."
  },
  "isopropanol": {
    "what": "Lo que ves: el –OH cuelga del carbono de en medio, con dos metilos abriéndose como una V.",
    "measure": "C–C–C · 109.5°",
    "meaning": "El ángulo de 109.5° entre los carbonos es la firma de un carbono sp3: cuatro enlaces apuntando a las esquinas de un tetraedro."
  },
  "dimetileter": {
    "what": "Lo que ves: un oxígeno haciendo de puente entre dos metilos: no hay –OH, hay –O–.",
    "measure": "C–O–C · 111.7°",
    "meaning": "El oxígeno doblado a 111.7° es el corazón de un éter: el mismo número de átomos que el etanol, pero acomodados distinto."
  },
  "formaldehido": {
    "what": "Lo que ves: el carbonilo más simple, un carbono plano con un oxígeno colgando por un enlace doble corto y tenso.",
    "measure": "C=O · 1.21 Å",
    "meaning": "Ese doble enlace mide apenas 1.21 Å: por eso es tan corto y reactivo, el oxígeno jala los electrones y deja al carbono hambriento."
  },
  "acido-formico": {
    "what": "Lo que ves: el ácido más simple con su grupo carboxilo, dos oxígenos distintos sobre un mismo carbono plano.",
    "measure": "C=O · 1.21 Å vs C–O · 1.34 Å",
    "meaning": "Fíjate en los dos oxígenos: uno está pegado por doble enlace (1.21 Å) y otro por enlace sencillo más largo (1.34 Å) que sostiene al hidrógeno ácido."
  },
  "propano": {
    "what": "Lo que ves: tres carbonos en zig-zag, cada uno rodeado de hidrógenos como una pelusa tetraédrica.",
    "measure": "C–C · 1.54 Å",
    "meaning": "Una cadena diminuta: si la estiraras, mil millones de propanos en fila apenas medirían medio metro."
  },
  "isobutano": {
    "what": "Lo que ves: un carbono central con un solo hidrógeno y tres metilos abriéndose como las aspas de un molinete.",
    "measure": "C–C–C · 109.5°",
    "meaning": "Mismos átomos que el butano normal pero ramificado: la forma compacta hace que hierva más bajo y arda diferente."
  },
  "ciclohexano": {
    "what": "Lo que ves: un anillo de seis carbonos que NO es plano, sino plegado como una silla, con hidrógenos apuntando arriba-abajo (axiales) y hacia los lados (ecuatoriales).",
    "measure": "C–C · 1.54 Å · 110°",
    "meaning": "El anillo se dobla en 'silla' justo para que cada ángulo sea el tetraédrico perfecto: cero tensión, máxima estabilidad."
  },
  "etileno": {
    "what": "Lo que ves: dos carbonos atados por un doble enlace plano, con cuatro hidrógenos abiertos como una estrella.",
    "measure": "C=C · 1.34 Å",
    "meaning": "El doble enlace acorta y endurece la unión: los dos carbonos quedan más juntos que en un enlace simple y ya no pueden girar libremente."
  },
  "acetileno": {
    "what": "Lo que ves: una varilla perfectamente recta, dos carbonos unidos por un triple enlace y un hidrógeno en cada punta.",
    "measure": "C≡C · 1.20 Å",
    "meaning": "El triple enlace es la unión más corta y fuerte entre dos carbonos; obliga a toda la molécula a quedar en línea recta (180°)."
  },
  "benceno": {
    "what": "Lo que ves: un hexágono plano perfecto de seis carbonos, cada uno con su hidrógeno apuntando hacia afuera como rayos de sol.",
    "measure": "C–C anillo · 1.40 Å",
    "meaning": "Todos los enlaces del anillo miden exactamente lo mismo: no son ni simples ni dobles. Los seis electrones π forman un solo aro de carga que envuelve al hexágono."
  },
  "hcn": {
    "what": "Lo que ves: una molécula perfectamente recta de tres átomos, con un triple enlace carbono-nitrógeno muy corto y tenso.",
    "measure": "C≡N · 1.156 Å · 180°",
    "meaning": "El triple enlace C≡N es de los más cortos y fuertes que existen; por eso el cianuro es tan estable y reactivo a la vez."
  },
  "o3": {
    "what": "Lo que ves: tres oxígenos en forma de V abierta, con el par π repartido por igual entre los dos enlaces (resonancia real).",
    "measure": "O–O · 1.278 Å · 116.8°",
    "meaning": "No es ni enlace simple ni doble: el ozono es un híbrido, los dos enlaces miden lo mismo aunque lo dibujemos con uno simple y uno doble."
  },
  "so2": {
    "what": "Lo que ves: un azufre con un par libre solitario que empuja a los dos oxígenos hacia abajo, formando una V ancha.",
    "measure": "S=O · 1.432 Å · 119.0°",
    "meaning": "El par libre del azufre abre el ángulo casi a 120°; los enlaces S=O son cortos y con carácter doble repartido por resonancia."
  },
  "ch3nh2": {
    "what": "Lo que ves: un carbono con tres hidrógenos (un metilo) pegado a un nitrógeno piramidal con su par libre apuntando hacia afuera.",
    "measure": "C–N · 1.471 Å · 109.5° (sp³)",
    "meaning": "Es amoniaco al que le cambiaron un hidrógeno por un grupo CH3; el nitrógeno conserva su par libre y su forma de pirámide."
  },
  "isooctano": {
    "what": "Lo que ves: una cadena de cinco carbonos con un nudo cuaternario (un carbono que sostiene cuatro carbonos) y otra rama más adelante. Pura ramificación.",
    "measure": "C–C · 1.54 Å",
    "meaning": "Esta forma rechoncha y ramificada es justo lo que define el octanaje 100: arde de manera controlada, sin detonar antes de tiempo."
  },
  "acetona": {
    "what": "Lo que ves: una cetona simétrica, el carbonilo C=O en el centro con dos metilos sp3 abriéndose a 116°.",
    "measure": "C=O · 1.21 Å · ∠C–C–C 116°",
    "meaning": "El carbono del carbonilo es plano (sp2) y abre sus dos metilos a 116°, mientras cada CH3 forma su propio tetraedro a 109.5°."
  },
  "acido-acetico": {
    "what": "Lo que ves: el vinagre molecular, un metilo tetraédrico pegado a un grupo carboxilo plano con sus dos oxígenos.",
    "measure": "C=O · 1.21 Å vs C–O · 1.34 Å",
    "meaning": "El carboxilo (–COOH) reúne un oxígeno doble corto (1.21 Å) y un O–H largo (1.34 Å): de ahí sale el hidrógeno que da lo agrio del vinagre."
  },
  "butadieno": {
    "what": "Lo que ves: un zigzag plano de cuatro carbonos con dos dobles enlaces alternados; toda la molécula vive en un mismo plano.",
    "measure": "C–C central · 1.47 Å",
    "meaning": "El enlace simple del centro sale más corto que un C–C normal (1.54 Å): los electrones π no se quedan quietos en sus dobles, se reparten por toda la cadena."
  },
  "h2o2": {
    "what": "Lo que ves: dos oxígenos unidos como un eslabón, con los hidrógenos torcidos en planos diferentes (forma de libro abierto).",
    "measure": "O–O · 1.475 Å · diedro 111.5°",
    "meaning": "Los hidrógenos NO están en el mismo plano: la molécula está retorcida 111.5° para que los pares libres de los oxígenos no choquen."
  }
};

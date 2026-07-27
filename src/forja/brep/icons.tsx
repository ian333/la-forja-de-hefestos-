/** Iconografía del Studio — trazos SVG propios (16×16, stroke currentColor).
 *  Extraído del monolito (paso 2.5) para que los paneles compartan <Ic>
 *  sin import circular. */
const ICONS: Record<string, JSX.Element> = {
  croquis: <><path d="M3.2 12.8 10.6 5.4l2 2-7.4 7.4-2.8.8z" /><path d="M11.6 4.4l1.2-1.2 2 2-1.2 1.2" /></>,
  encara: <><path d="M1.8 11.5 5.6 7h8.6l-3.8 4.5z" /><path d="M4.5 4.5 8 1.6l1.6 1.6" opacity=".55" /></>,
  agujerocara: <><path d="M1.8 11.5 5.6 7h8.6l-3.8 4.5z" /><ellipse cx="8.2" cy="9.2" rx="2" ry="1" /></>,
  extruir: <><rect x="3" y="11" width="10" height="2.6" /><path d="M8 10.6V3.4M5.6 5.6 8 3.2l2.4 2.4" /></>,
  barreno: <><circle cx="8" cy="8" r="5.4" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /></>,
  redondeo: <><path d="M2.8 13.2V8A5.2 5.2 0 0 1 8 2.8h5.2" /><path d="M2.8 2.8 6 6" opacity=".4" /></>,
  chaflan: <><path d="M2.8 13.2V7L7 2.8h6.2" /><path d="M2.8 2.8 7 7" opacity=".4" /></>,
  vaciado: <><path d="M2.8 3v10.2H13.2V3" /><path d="M5.6 3v6.6h7.6" opacity=".6" /></>,
  revolucion: <><path d="M8 1.8v12.4" /><path d="M8 4.6c3 0 5 1.5 5 3.4s-2 3.4-5 3.4" /><path d="M8 11.4c-1.6 0-3-.4-3.9-1.1" opacity=".5" /><path d="M9.6 12.6 8 11.4l1.8-1" /></>,
  transicion: <><ellipse cx="8" cy="3.4" rx="3.4" ry="1.5" /><ellipse cx="8" cy="12.4" rx="5.6" ry="2" /><path d="M4.6 4 2.4 11.2M11.4 4l2.2 7.2" opacity=".7" /></>,
  barrido: <><path d="M2.4 12.4C6 12.4 9.4 4 14 4" /><ellipse cx="2.6" cy="12.4" rx="1.6" ry="2" /></>,
  engrane: <><circle cx="8" cy="8" r="3.2" /><path d="M8 1.6v2.1M8 12.3v2.1M2.5 4.8l1.8 1M11.7 10.2l1.8 1M2.5 11.2l1.8-1M11.7 5.8l1.8-1" /></>,
  cajacic: <><rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.4" /><circle cx="8" cy="8" r="3" /><circle cx="9.8" cy="8" r=".9" opacity=".6" /></>,
  cajera: <><rect x="2.6" y="2.6" width="10.8" height="10.8" /><rect x="6" y="6" width="4" height="4" strokeDasharray="1.6 1.4" /></>,
  patron: <><circle cx="5" cy="5" r="1.7" /><circle cx="11" cy="5" r="1.7" /><circle cx="5" cy="11" r="1.7" /><circle cx="11" cy="11" r="1.7" /></>,
  planotaller: <><rect x="2.4" y="2.4" width="11.2" height="11.2" /><rect x="4.6" y="4.6" width="3.2" height="3.2" opacity=".7" /><rect x="9.4" y="4.6" width="2.4" height="3.2" opacity=".7" /><rect x="4.6" y="9.6" width="3.2" height="2" opacity=".7" /></>,
  seccion: <><rect x="3" y="3" width="10" height="10" /><path d="M1.6 14.4 14.4 1.6" strokeDasharray="2 1.6" /></>,
  encuadrar: <><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" /><circle cx="8" cy="8" r="2.2" opacity=".6" /></>,
  componente: <><rect x="2.4" y="5.6" width="8" height="8" /><path d="M5.4 5.6V2.6h8v8h-3" opacity=".7" /></>,
  careado: <><path d="M2.6 3.4h10.8v3.2H2.6v3.2h10.8v3.2H2.6" /></>,
  cajera2d: <><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2.6" opacity=".7" /></>,
  taladrado: <><path d="M5 2.4h6M8 2.4v7" /><path d="M8 13.6 5.8 9.4h4.4z" /></>,
  roscado: <><path d="M5.4 2.6v8l2.6 2.6 2.6-2.6v-8" /><path d="M5.4 5h5.2M5.4 7.4h5.2M5.4 9.8h5.2" opacity=".7" /></>,
  mandrinado: <><circle cx="8" cy="8" r="5.6" /><path d="M8 3.6A4.4 4.4 0 1 1 3.6 8" opacity=".8" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /></>,
  desbaste3d: <><path d="M2.4 13.4h3.2v-3h3.2v-3H12v-3h1.8" /><path d="M2.4 13.4V2.6" opacity=".35" /></>,
  params: <><path d="M5.2 13 8 3h2.4" /><path d="M4 6.4h5.6" /><path d="M10.4 9.4l3.2 4M13.6 9.4l-3.2 4" opacity=".8" /></>,
  laser: <><path d="M8 1.6v5" /><path d="M8 6.6 5.2 12h5.6z" opacity=".85" /><path d="M2.6 13.4h10.8" /><path d="M4.6 3.4 6.2 5M11.4 3.4 9.8 5" opacity=".5" /></>,
  impresion: <><rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1" /><path d="M5 5.4h6M8 5.4v2.4" opacity=".8" /><path d="M6.4 7.8h3.2v1.6H6.4z" /><path d="M4 11.4h8" strokeDasharray="1.8 1.2" opacity=".7" /></>,
  torno: <><path d="M1.8 8.5h12.4" strokeDasharray="2.2 1.6" opacity=".6" /><path d="M3.2 8.5V4.8h3.2V3h4v2.6h2.4v2.9" /><path d="M13.4 11.6l-2-2M13.4 9.6v2h-2" opacity=".8" /></>,
  opciones: <><circle cx="8" cy="3.4" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="12.6" r="1.1" fill="currentColor" stroke="none" /></>,
};
export function Ic({ name }: { name: string }) {
  return (
    <svg className="fb-ic" width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name] ?? <circle cx="8" cy="8" r="5" />}
    </svg>
  );
}

/**
 * Entry para /library.html — catálogo visual de la masterclass library.
 *
 * Uso:
 *   /library.html
 *
 * Muestra todos los shapes (Capa 2) y GLBs disponibles (Capa 3) en una grid
 * 3D auto-rotada, con toggle de modes (solid/wireframe/edges/atom).
 */

import ReactDOM from 'react-dom/client';
import './main.css';
import LibraryPage from './masterclass/assets/LibraryPage';

ReactDOM.createRoot(document.getElementById('root')!).render(<LibraryPage />);

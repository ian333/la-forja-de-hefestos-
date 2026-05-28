import { createRoot } from 'react-dom/client';
import CinematicAtom from './CinematicAtom';
import '../main.css';

const params = new URLSearchParams(window.location.search);
const Z = Math.max(1, Math.min(118, parseInt(params.get('z') || '6', 10)));

createRoot(document.getElementById('root')!).render(<CinematicAtom Z={Z} />);

import { createRoot } from 'react-dom/client';
import CinematicMolecule from './CinematicMolecule';
import '../main.css';

const params = new URLSearchParams(window.location.search);
const molKey = (params.get('m') || 'h2o').toLowerCase();

createRoot(document.getElementById('root')!).render(<CinematicMolecule molKey={molKey} />);

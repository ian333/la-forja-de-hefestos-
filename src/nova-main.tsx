import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import './nova/nova.css';
import NovaStore from './nova/NovaStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NovaStore />
  </StrictMode>,
);

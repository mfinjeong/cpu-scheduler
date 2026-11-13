import { createRoot } from 'react-dom/client';
import { App } from './features/App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemen root tidak tersedia');
createRoot(root).render(<App />);

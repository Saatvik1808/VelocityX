/**
 * LEARNING NOTE: Application Entry Point
 *
 * This is the Vite entry point referenced by index.html. It mounts the
 * React application, which in turn initializes the game engine imperatively.
 * React 18's createRoot API is used for concurrent rendering support.
 *
 * Key concepts: Vite entry point, React 18 createRoot
 */

import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(<App />);

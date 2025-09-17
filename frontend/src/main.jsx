import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Mount the React application
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error('Root element #root not found in index.html');
}

// Hot Module Replacement (handled automatically by Vite)
if (import.meta.hot) {
    import.meta.hot.accept();
}


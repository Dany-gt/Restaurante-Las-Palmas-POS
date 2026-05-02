import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { StandaloneAdminApp } from './components/StandaloneAdminApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const isStandaloneAdmin = window.location.search.includes('app=admin') || window.location.pathname === '/admin';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isStandaloneAdmin ? <StandaloneAdminApp /> : <App />}
  </React.StrictMode>
);

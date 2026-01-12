import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/home.css';
import './styles/panels.css';
import './styles/portal.css';
import './styles/auth.css';
import './styles/responsive.css';
import { AuthProvider } from './lib/authContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/home.css';
import './styles/panels.css';
import './styles/portal.css';
import './styles/auth.css';
import './styles/account.css';
import './styles/parish.css';
import './styles/cogita.css';
import './styles/responsive.css';
import { AuthProvider } from './lib/authContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);

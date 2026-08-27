import React from 'react';
import ReactDOM from 'react-dom/client';
import TherafamApp from './TherafamApp';
import { initializePreferences } from './lib/preferences';
import './styles.css';
import './theme-polish.css';
import './preferences.css';
import './therapist-interactions.css';

initializePreferences();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TherafamApp />
  </React.StrictMode>
);

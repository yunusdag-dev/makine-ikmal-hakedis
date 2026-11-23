import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/outfit';
import './styles.css';
import './lib/tema';
import App from './App';
import { BildirimSaglayici, OnaySaglayici } from './ui/temel';
import { HataSiniri } from './ui/HataSiniri';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HataSiniri>
      <BildirimSaglayici>
        <OnaySaglayici>
          <App />
        </OnaySaglayici>
      </BildirimSaglayici>
    </HataSiniri>
  </React.StrictMode>,
);

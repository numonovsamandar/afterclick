import React from 'react';
import { createRoot } from 'react-dom/client';
import { InspectPage } from './InspectPage';
import '../styles/globals.css';

const container = document.getElementById('inspect-root')!;
const root = createRoot(container);
root.render(<React.StrictMode><InspectPage /></React.StrictMode>);

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// One stylesheet for the whole app (added 24/11 by Yehia). It styles plain
// HTML as well as classes, so every page picks up the dark theme without
// being edited.
import './styles/theme.css';

createRoot(document.getElementById('root')).render(<App />);

/**
 * TOFLIT18 Client Main Entry
 * ===========================
 *
 * Launching the app.
 */
import React from 'react';
import {render} from 'react-dom';
import App from './components/app.jsx';

// Stylesheet
require('!style!css!sass!../style/toflit18.scss');

// Rendering the app
render(<App />, document.getElementById('mount'));

// Picks the real Firebase backend, or the in-browser demo when built with MOCK=1.
import CONFIG from './config.js';

const backend = CONFIG.mock ? await import('./backend-mock.js') : await import('./backend-firebase.js');
export default backend;

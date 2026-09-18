import { render } from 'solid-js/web';

import { App } from './app/App';
import { registerPwaServiceWorker } from './pwa/register';
import './styles/app.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found');
}

registerPwaServiceWorker();

render(() => <App />, root);

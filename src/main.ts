import './ui/styles.css';
import './world/biomes'; // registers additional locations before settings load
import { App } from './game/App';

function webgl2Available(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (!webgl2Available()) {
  root.innerHTML = '<div class="fatal">SkiFree — The Last Descent needs a browser with WebGL2 enabled (recent Chrome, Edge, Firefox or Safari).</div>';
} else {
  const app = new App(root);
  app.start().catch((e: unknown) => {
    console.error(e);
    root.insertAdjacentHTML('beforeend', `<div class="fatal">Failed to start: ${String(e)}</div>`);
  });
}

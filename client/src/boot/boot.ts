/** Boot overlay and helpers to avoid blank screen. */
class Overlay {
  private logEl: HTMLDivElement;
  private errEl: HTMLDivElement;

  constructor() {
    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.fontFamily = 'monospace';
    root.style.fontSize = '12px';
    root.style.color = '#fff';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '9999';

    this.logEl = document.createElement('div');
    this.logEl.textContent = 'Booting...\n';
    root.appendChild(this.logEl);

    this.errEl = document.createElement('pre');
    this.errEl.style.background = 'rgba(255,0,0,0.8)';
    this.errEl.style.color = '#fff';
    this.errEl.style.marginTop = '4px';
    this.errEl.style.display = 'none';
    this.errEl.style.whiteSpace = 'pre-wrap';
    root.appendChild(this.errEl);

    document.body.appendChild(root);
  }

  step(msg: string) {
    this.logEl.textContent += msg + '\n';
  }

  error(msg: string) {
    this.errEl.style.display = 'block';
    this.errEl.textContent = msg;
    console.error(msg);
  }
}

export const BootOverlay = new Overlay();

// Global error handlers
window.addEventListener('error', (e) => {
  BootOverlay.error(e.error?.stack || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  BootOverlay.error(String(e.reason));
});

export function must<T>(value: T | null | undefined, label: string): T {
  if (!value) throw new Error(label);
  return value;
}

export async function tryStep(label: string, fn: () => void | Promise<void>) {
  try {
    BootOverlay.step(label);
    await fn();
  } catch (e: any) {
    BootOverlay.error(e?.stack || e?.message || String(e));
    throw e;
  }
}

export function ensureWebGL() {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('webgl2');
  if (!gl) throw new Error('WebGL not supported');
}

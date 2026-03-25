export class BootOverlay {
  private element: HTMLDivElement;
  private logs: string[] = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position   = 'absolute';
    this.element.style.top        = '50%';
    this.element.style.left       = '50%';
    this.element.style.transform  = 'translate(-50%, -50%)';
    this.element.style.color      = '#00ff88';
    this.element.style.background = 'rgba(0,0,0,0.75)';
    this.element.style.padding    = '16px 24px';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize   = '13px';
    this.element.style.lineHeight = '1.8';
    this.element.style.borderRadius = '6px';
    this.element.style.zIndex    = '999';
    this.element.style.minWidth  = '260px';
    document.body.appendChild(this.element);

    window.addEventListener('error', e => this.handleError(e.message));
    window.addEventListener('unhandledrejection', e => this.handleError(String(e.reason)));
  }

  log(message: string) {
    this.logs.push('✓ ' + message);
    if (this.logs.length > 6) this.logs.shift();
    this.element.innerText = this.logs.join('\n');
  }

  handleError(message: string) {
    this.element.style.color      = '#ff4444';
    this.element.style.background = 'rgba(80,0,0,0.85)';
    this.element.innerText = `⚠ Error: ${message}\n` + this.logs.join('\n');
  }

  /** Ocultar el overlay una vez que todo cargó */
  done() {
    this.log('Listo. ¡Buen vuelo!');
    setTimeout(() => {
      this.element.style.transition = 'opacity 1s';
      this.element.style.opacity    = '0';
      setTimeout(() => this.element.remove(), 1100);
    }, 1500);
  }
}

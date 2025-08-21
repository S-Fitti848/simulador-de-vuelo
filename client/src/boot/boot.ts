export class BootOverlay {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#fff',
      fontFamily: 'sans-serif',
      fontSize: '24px',
      zIndex: '1000',
    } as CSSStyleDeclaration);
    this.element.innerText = 'Loading...';
    document.body.appendChild(this.element);

    window.addEventListener('error', (e) => this.handleError(e.message));
    window.addEventListener('unhandledrejection', (e) => this.handleError(String(e.reason)));
  }

  log(message: string) {
    this.element.innerText = message;
  }

  done() {
    this.element.remove();
  }

  private handleError(message: string) {
    this.element.style.background = 'rgba(255,0,0,0.8)';
    this.element.innerText = `Error: ${message}`;
  }
}

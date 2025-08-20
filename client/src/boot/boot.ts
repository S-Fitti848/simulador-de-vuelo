/client/src/boot/boot.ts
export class BootOverlay {
  private element: HTMLDivElement;
  private logs: string[] = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.element.style.top = '10px';
    this.element.style.left = '10px';
    this.element.style.color = 'white';
    this.element.style.background = 'rgba(0,0,0,0.5)';
    this.element.style.padding = '5px';
    document.body.appendChild(this.element);

    window.addEventListener('error', (e) => this.handleError(e.message));
    window.addEventListener('unhandledrejection', (e) => this.handleError(e.reason));
  }

  log(message: string) {
    this.logs.push(message);
    if (this.logs.length > 5) this.logs.shift();
    this.element.innerText = this.logs.join('\n');
  }

  private handleError(message: string) {
    this.element.style.background = 'rgba(255,0,0,0.5)';
    this.element.innerText = `Error: ${message}\n` + this.logs.join('\n');
  }
}

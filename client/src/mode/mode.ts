export class ModeManager {
  private mode: string;

  constructor() {
    this.mode = localStorage.getItem('fsim.mode') || 'Practice';
    localStorage.setItem('fsim.mode', this.mode);
  }

  getMode() {
    return this.mode;
  }

  isPractice() {
    return this.mode === 'Practice';
  }
}

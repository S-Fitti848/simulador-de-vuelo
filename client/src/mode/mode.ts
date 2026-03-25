export enum GameMode {
  Practice = 'Practice',
  Multiplayer = 'Multiplayer',
}

export function setMode(mode: GameMode) {
  localStorage.setItem('fsim.mode', mode);
}

export class ModeManager {
  private mode: GameMode;

  constructor() {
    this.mode = (localStorage.getItem('fsim.mode') as GameMode) || GameMode.Practice;
    localStorage.setItem('fsim.mode', this.mode);
  }

  getMode() {
    return this.mode;
  }

  isPractice() {
    return this.mode === GameMode.Practice;
  }
}

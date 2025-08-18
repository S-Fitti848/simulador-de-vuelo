export enum GameMode {
  Practice = 'practice',
  Multiplayer = 'multiplayer',
}

const KEY = 'fsim.mode';

export function getMode(): GameMode {
  const stored = localStorage.getItem(KEY) as GameMode | null;
  return stored === GameMode.Multiplayer ? GameMode.Multiplayer : GameMode.Practice;
}

export function setMode(mode: GameMode) {
  localStorage.setItem(KEY, mode);
}

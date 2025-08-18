import { GameMode } from '../mode/mode';

export function createStatusChip(mode: GameMode) {
  const chip = document.createElement('div');
  chip.style.position = 'absolute';
  chip.style.top = '10px';
  chip.style.right = '10px';
  chip.style.padding = '4px 8px';
  chip.style.background = 'rgba(0,0,0,0.5)';
  chip.style.color = 'white';
  chip.style.fontFamily = 'sans-serif';
  chip.style.fontSize = '12px';
  chip.style.borderRadius = '4px';
  document.body.appendChild(chip);

  function label(m: GameMode) {
    return m === GameMode.Practice ? 'Mode: Practice' : 'Mode: Multiplayer';
  }

  chip.textContent = label(mode);

  return {
    set(m: GameMode) {
      chip.textContent = label(m);
    },
  };
}

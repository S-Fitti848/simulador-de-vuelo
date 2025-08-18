import { GameMode, setMode } from '../mode/mode';

export function createPauseMenu(
  mode: GameMode,
  onResume: () => void,
  onReset: () => void
) {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  document.body.appendChild(overlay);

  const box = document.createElement('div');
  box.style.background = '#222';
  box.style.padding = '20px';
  box.style.borderRadius = '8px';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '10px';
  overlay.appendChild(box);

  function makeBtn(label: string, handler: () => void) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  }

  const resume = makeBtn('Resume', () => {
    overlay.style.display = 'none';
    onResume();
  });

  const reset = makeBtn('Reset Session', () => {
    overlay.style.display = 'none';
    onReset();
  });

  const switchBtn = makeBtn('', () => {
    const next = mode === GameMode.Practice ? GameMode.Multiplayer : GameMode.Practice;
    setMode(next);
    window.location.reload();
  });

  box.append(resume, reset, switchBtn);

  function updateMode(m: GameMode) {
    mode = m;
    switchBtn.textContent =
      mode === GameMode.Practice ? 'Switch to Multiplayer' : 'Switch to Practice';
  }

  updateMode(mode);

  return {
    show(m: GameMode) {
      updateMode(m);
      overlay.style.display = 'flex';
    },
    hide() {
      overlay.style.display = 'none';
    },
  };
}

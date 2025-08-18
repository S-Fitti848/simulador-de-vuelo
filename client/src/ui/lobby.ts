import type { LandingResult } from './landing';
import './landing.css';

/** Simple placeholder lobby screen. Real implementation should show online
 * players and rooms. For now it just provides a Start button.
 */
export function showLobby(result: LandingResult, onStart: (res: LandingResult) => void) {
  const overlay = document.createElement('div');
  overlay.className = 'landing-overlay';

  const box = document.createElement('div');
  box.className = 'landing-box';
  const info = document.createElement('div');
  info.textContent = `Lobby - logged in as ${result.username}`;
  const btn = document.createElement('button');
  btn.textContent = 'Start Match';
  btn.addEventListener('click', () => {
    overlay.remove();
    onStart(result);
  });

  box.append(info, btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export interface HUDData {
  spd: number;
  alt: number;
  pit: number;
  rol: number;
  hp: number;
  name: string;
  aircraft: string;
}

export function createHUD() {
  const hud = document.createElement('div');
  hud.style.position = 'absolute';
  hud.style.top = '10px';
  hud.style.left = '10px';
  hud.style.color = 'white';
  hud.style.fontFamily = 'monospace';
  hud.style.whiteSpace = 'pre';
  document.body.appendChild(hud);

  const killed = document.createElement('div');
  killed.style.position = 'absolute';
  killed.style.top = '50%';
  killed.style.left = '50%';
  killed.style.transform = 'translate(-50%, -50%)';
  killed.style.color = 'red';
  killed.style.fontFamily = 'sans-serif';
  killed.style.fontSize = '32px';
  killed.style.display = 'none';
  killed.textContent = 'KILLED — press R to respawn';
  document.body.appendChild(killed);

  return {
    update(d: HUDData) {
      hud.textContent =
        `SPD ${d.spd.toFixed(0)}kn\nALT ${d.alt.toFixed(0)}m\nPIT ${d.pit.toFixed(0)}\u00b0\nROL ${d.rol.toFixed(0)}\u00b0\nHP ${d.hp}\nACFT ${d.aircraft}\nNAME ${d.name}`;
      killed.style.display = d.hp <= 0 ? 'block' : 'none';
    },
  };
}


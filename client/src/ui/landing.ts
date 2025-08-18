import './landing.css';

export type AircraftChoice = 'raptor' | 'dragon';

export interface LandingResult {
  username: string;
  aircraft: AircraftChoice;
}

/**
 * Shows the landing screen allowing the user to pick a username and aircraft.
 * Calls `onEnter` once the user submits valid data.
 */
export function showLanding(onEnter: (result: LandingResult) => void) {
  const storedName = localStorage.getItem('fsim.username') || '';
  const storedAircraft = (localStorage.getItem('fsim.aircraft') as AircraftChoice) || 'raptor';

  const overlay = document.createElement('div');
  overlay.className = 'landing-overlay';

  const box = document.createElement('div');
  box.className = 'landing-box';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Username';
  nameInput.value = storedName;
  nameInput.maxLength = 20;

  const cards = document.createElement('div');
  cards.className = 'aircraft-cards';

  const cardRaptor = createCard('Raptor-like', 'raptor', storedAircraft === 'raptor');
  const cardDragon = createCard('Mighty-Dragon-like', 'dragon', storedAircraft === 'dragon');

  cards.append(cardRaptor.el, cardDragon.el);

  let selected: AircraftChoice = storedAircraft;
  cardRaptor.btn.addEventListener('click', () => {
    selected = 'raptor';
    cardRaptor.el.classList.add('selected');
    cardDragon.el.classList.remove('selected');
  });
  cardDragon.btn.addEventListener('click', () => {
    selected = 'dragon';
    cardDragon.el.classList.add('selected');
    cardRaptor.el.classList.remove('selected');
  });

  const enterBtn = document.createElement('button');
  enterBtn.textContent = 'Enter';
  enterBtn.className = 'enter-btn';

  enterBtn.addEventListener('click', () => {
    const username = nameInput.value.trim();
    if (username.length < 3 || username.length > 20) {
      alert('Username must be 3-20 characters');
      return;
    }
    localStorage.setItem('fsim.username', username);
    localStorage.setItem('fsim.aircraft', selected);
    overlay.remove();
    onEnter({ username, aircraft: selected });
  });

  box.append(nameInput, cards, enterBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  nameInput.focus();
}

function createCard(label: string, id: AircraftChoice, selected: boolean) {
  const el = document.createElement('div');
  el.className = 'aircraft-card' + (selected ? ' selected' : '');

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  // Placeholder thumbnail using emoji
  thumb.textContent = id === 'raptor' ? '\ud83e\udd85' : '\ud83e\udd96';

  const title = document.createElement('div');
  title.textContent = label;

  const btn = document.createElement('button');
  btn.textContent = 'Select';

  el.append(thumb, title, btn);

  return { el, btn };
}


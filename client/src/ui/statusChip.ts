export function createStatusChip() {
  const chip = document.createElement('div');
  chip.textContent = 'Mode: Practice';
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
  return chip;
}

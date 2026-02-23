// Generate extension icons from icon.webp with a status dot overlay.
// Active  → full-opacity icon + green dot (bottom-right)
// Inactive → semi-transparent icon + gray dot (bottom-right)

async function loadIconBitmap() {
  const res = await fetch(chrome.runtime.getURL('icon.webp'));
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function createIcon(bitmap, size, active) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw the icon, dimmed when inactive
  if (!active) {
    ctx.globalAlpha = 0.4;
  }
  ctx.drawImage(bitmap, 0, 0, size, size);
  ctx.globalAlpha = 1;

  // Status dot — bottom-right corner
  const dotRadius = Math.max(size * 0.15, 2);
  const dotX = size - dotRadius - 1;
  const dotY = size - dotRadius - 1;

  // Outline ring (dark background for contrast)
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  // Colored dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#22c55e' : '#888';
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

let cachedBitmap = null;

export async function setIconActive(active) {
  if (!cachedBitmap) {
    cachedBitmap = await loadIconBitmap();
  }

  const imageData = {};
  for (const size of [16, 32, 48, 128]) {
    imageData[size] = createIcon(cachedBitmap, size, active);
  }
  chrome.action.setIcon({ imageData });
}

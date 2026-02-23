// Generate extension icons as data URLs (simple diamond shape)
// We create a canvas-based icon generator in the background worker

// Active icon — vibrant purple gradient diamond
function createIcon(size, active) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();

  if (active) {
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(0.5, '#a855f7');
    grad.addColorStop(1, '#ec4899');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#555';
  }
  ctx.fill();

  // Inner diamond
  const ir = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ir);
  ctx.lineTo(cx + ir, cy);
  ctx.lineTo(cx, cy + ir);
  ctx.lineTo(cx - ir, cy);
  ctx.closePath();
  ctx.fillStyle = active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

export function setIconActive(active) {
  const imageData = {};
  for (const size of [16, 32, 48, 128]) {
    imageData[size] = createIcon(size, active);
  }
  chrome.action.setIcon({ imageData });
}

// Full-screen celebration for the final achievement: fireworks + falling gold on a canvas.
export function celebrate({ motion = true, sfx = () => {}, html, onClose = () => {} }) {
  const wrap = document.createElement('div');
  wrap.className = 'celebrate';
  wrap.innerHTML = `<canvas class="fx"></canvas><div class="cel-card">${html}</div>`;
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit(); addEventListener('resize', fit);

  const COLORS = ['#fbbf24', '#fde68a', '#f43f5e', '#22c55e', '#38bdf8', '#a78bfa', '#ffffff'];
  const sparks = [], coins = [];
  const burst = (x, y) => {
    const col = COLORS[Math.floor(Math.random() * COLORS.length)], n = 70 + Math.floor(Math.random() * 40);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 5.5;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.008 + Math.random() * 0.012, col, r: 1.5 + Math.random() * 2 });
    }
  };
  const rain = () => coins.push({ x: Math.random() * cv.width, y: -20, vy: 2 + Math.random() * 3, vx: Math.random() * 2 - 1, rot: Math.random() * 6, vr: Math.random() * 0.2 - 0.1, s: 8 + Math.random() * 10, col: COLORS[Math.floor(Math.random() * 3)] });

  let raf = 0, t = 0, alive = true;
  const frame = () => {
    if (!alive) return;
    t++;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'lighter';
    if (t % 28 === 1 || (t < 80 && t % 10 === 1)) burst(cv.width * (0.15 + Math.random() * 0.7), cv.height * (0.12 + Math.random() * 0.45));
    if (t % 4 === 0) rain();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.life -= p.decay;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.x += c.vx; c.y += c.vy; c.rot += c.vr;
      if (c.y > cv.height + 30) { coins.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.abs(Math.cos(c.rot * 2)) * 0.8 + 0.2);
      ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(0, 0, c.s / 2, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  if (motion) { frame(); [0, 250, 520, 900].forEach(d => setTimeout(() => sfx('boom'), d)); }
  sfx('fanfare');

  const close = () => {
    alive = false; cancelAnimationFrame(raf); removeEventListener('resize', fit);
    wrap.classList.add('out'); setTimeout(() => wrap.remove(), 500); onClose();
  };
  wrap.querySelector('[data-close]').addEventListener('click', close);
  return close;
}

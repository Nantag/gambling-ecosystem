// The seven casino games. Each one renders into a container and talks to the
// engine only through stake() / settle(). House edges are ~3–5% before your
// upgrades — charms, levels and venues are what tip the table your way.
import * as C from './core.js';

let ui;                      // { afterBet, toast, sfx, refresh }
export const initGames = u => { ui = u; };

const $ = (root, s) => root.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fast = () => !C.S.settings.motion;

// ── Shared bet box ───────────────────────────────────────────────────────────
function betBox(game, actionsHtml) {
  const last = C.S.bets[game] || Math.min(10, C.maxBet()) || 1;
  return `
    <div class="betbox">
      <label class="bet-label" for="bet-${game}">Bet</label>
      <div class="bet-input">
        <span>$</span><input id="bet-${game}" inputmode="decimal" autocomplete="off" value="${C.fmt(last)}" />
      </div>
      <div class="bet-quick">
        <button type="button" data-q="min">Min</button>
        <button type="button" data-q="half">½</button>
        <button type="button" data-q="double">2×</button>
        <button type="button" data-q="max">Max</button>
      </div>
      <div class="bet-actions">${actionsHtml}</div>
      <div class="bet-hint" id="hint-${game}"></div>
    </div>`;
}

function bindBet(root, game) {
  const input = $(root, `#bet-${game}`);
  const hint = $(root, `#hint-${game}`);
  const upd = () => {
    const v = readRaw();
    hint.textContent = !isFinite(v) || v < 1 ? 'Enter a bet (e.g. 250, 1.5k, 2m)'
      : v > C.tableLimit() ? `Table limit here is ${C.money(C.tableLimit())}`
      : v > C.S.chips ? 'Not enough chips' : `Your wins are boosted ×${C.profitMult(game).toFixed(2)}`;
    hint.classList.toggle('bad', !(v >= 1 && v <= C.S.chips && v <= C.tableLimit()));
  };
  const readRaw = () => Math.floor(C.parseAmount(input.value));
  root.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    let v = readRaw(); if (!isFinite(v) || v < 1) v = 1;
    const q = b.dataset.q;
    v = q === 'min' ? 1 : q === 'half' ? Math.max(1, Math.floor(v / 2)) : q === 'double' ? v * 2 : C.maxBet();
    input.value = C.fmt(Math.min(v, Math.max(1, C.maxBet())), 3);
    ui.sfx('tick'); upd();
  }));
  input.addEventListener('input', upd);
  upd();
  return {
    read() { return readRaw(); },
    take() {
      const v = readRaw();
      if (!C.stake(game, v)) {
        ui.toast(v > C.S.chips ? 'Not enough chips.' : v > C.tableLimit() ? 'Over the table limit.' : 'Invalid bet.', 'bad');
        ui.sfx('nope');
        return 0;
      }
      ui.refresh();
      return v;
    },
    update: upd,
  };
}

function finish(game, bet, payoutX, label) {
  const res = C.settle(game, bet, payoutX);
  ui.afterBet(game, bet, payoutX, res, label);
  return res;
}

const lockAll = (root, on) => root.querySelectorAll('.bet-actions button, .bet-quick button, .bet-input input').forEach(b => { b.disabled = on; });

// ═════════════════════════════════════════════════════════════════════════════
//  COIN FLIP
// ═════════════════════════════════════════════════════════════════════════════
const coin = {
  render(root) {
    let side = 'heads', busy = false, rot = 0;
    root.innerHTML = `
      <div class="stage coin-stage">
        <div class="coin" id="coin"><div class="face heads">H</div><div class="face tails">T</div></div>
        <div class="pick-row">
          <button class="pick on" data-side="heads">Heads</button>
          <button class="pick" data-side="tails">Tails</button>
        </div>
        <p class="odds">Pays <b>2×</b> · base win chance 48%</p>
      </div>
      ${betBox('coin', '<button class="btn-play" id="flip">Flip</button>')}`;
    const bet = bindBet(root, 'coin');
    root.querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      side = b.dataset.side;
      root.querySelectorAll('.pick').forEach(x => x.classList.toggle('on', x === b));
    }));
    $(root, '#flip').addEventListener('click', async () => {
      if (busy) return;
      const amt = bet.take(); if (!amt) return;
      busy = true; lockAll(root, true); ui.sfx('spin');
      let win = Math.random() < 0.48;
      for (let n = C.retries(); !win && n > 0; n--) win = Math.random() < 0.48;
      const result = win ? side : side === 'heads' ? 'tails' : 'heads';
      rot += 1800 + (result === 'tails' ? 180 : 0) - (rot % 360);
      const el = $(root, '#coin');
      el.style.transition = fast() ? 'none' : 'transform 1s cubic-bezier(.2,.8,.3,1)';
      el.style.transform = `rotateY(${rot}deg)`;
      await sleep(fast() ? 50 : 1000);
      finish('coin', amt, win ? 2 : 0, result === 'heads' ? 'Heads!' : 'Tails!');
      busy = false; lockAll(root, false); bet.update();
    });
  },
};

// ═════════════════════════════════════════════════════════════════════════════
//  SCRATCH CARDS
// ═════════════════════════════════════════════════════════════════════════════
const SCRATCH = [
  { sym: '🍋', x: 1,   p: 0.2 },
  { sym: '🍒', x: 2,   p: 0.12 },
  { sym: '🔔', x: 5,   p: 0.04 },
  { sym: '💎', x: 20,  p: 0.01 },
  { sym: '7️⃣', x: 100, p: 0.0008 },
];
function scratchOutcome() {
  let r = Math.random();
  for (const o of SCRATCH) { if (r < o.p) return o; r -= o.p; }
  return null;
}
function scratchLayout(win) {
  const syms = SCRATCH.map(o => o.sym);
  const cells = [];
  if (win) cells.push(win.sym, win.sym, win.sym);
  const counts = {}; if (win) counts[win.sym] = 3;
  while (cells.length < 9) {
    const s = syms[Math.floor(Math.random() * syms.length)];
    if ((counts[s] || 0) >= 2 && !(win && s === win.sym && false)) continue;
    if (win && s === win.sym) continue;
    counts[s] = (counts[s] || 0) + 1; cells.push(s);
  }
  return cells.sort(() => Math.random() - 0.5);
}
const scratch = {
  card: null,
  render(root) {
    root.innerHTML = `
      <div class="stage">
        <div class="scratch-card" id="card"><div class="scratch-empty">Buy a card for the price of your bet.</div></div>
        <div class="paytable">${SCRATCH.map(o => `<span>${o.sym}${o.sym}${o.sym} <b>${o.x}×</b></span>`).join('')}</div>
      </div>
      ${betBox('scratch', '<button class="btn-play" id="buy">Buy card</button><button class="btn-ghost" id="reveal" disabled>Scratch all</button>')}`;
    const bet = bindBet(root, 'scratch');
    const cardEl = $(root, '#card');
    const draw = () => {
      const c = this.card;
      cardEl.innerHTML = `<div class="scratch-grid">${c.cells.map((s, i) => `<button class="cell ${c.open[i] ? 'open' : ''} ${c.open[i] && c.win && s === c.win.sym ? 'hit' : ''}" data-i="${i}" aria-label="Scratch">${c.open[i] ? s : ''}</button>`).join('')}</div>`;
      cardEl.querySelectorAll('.cell').forEach(b => b.addEventListener('click', () => scratchCell(+b.dataset.i)));
    };
    const scratchCell = i => {
      const c = this.card; if (!c || c.open[i]) return;
      c.open[i] = true; ui.sfx('tick'); draw();
      if (c.open.every(Boolean)) settle();
    };
    const settle = () => {
      const c = this.card; if (!c) return;
      this.card = null;
      finish('scratch', c.bet, c.win ? c.win.x : 0, c.win ? `${c.win.sym}${c.win.sym}${c.win.sym}` : 'No match');
      lockAll(root, false); $(root, '#reveal').disabled = true; bet.update();
    };
    this.settleNow = () => { if (this.card) { this.card.open.fill(true); settle(); } };
    $(root, '#buy').addEventListener('click', () => {
      if (this.card) return;
      const amt = bet.take(); if (!amt) return;
      let win = scratchOutcome();
      for (let n = C.retries(); !win && n > 0; n--) win = scratchOutcome();
      this.card = { bet: amt, win, cells: scratchLayout(win), open: Array(9).fill(false) };
      lockAll(root, true); $(root, '#reveal').disabled = false; ui.sfx('card');
      draw();
    });
    $(root, '#reveal').addEventListener('click', () => {
      const c = this.card; if (!c) return;
      c.open.fill(true); draw(); settle();
    });
  },
  destroy() { this.settleNow?.(); },
};

// ═════════════════════════════════════════════════════════════════════════════
//  SLOTS
// ═════════════════════════════════════════════════════════════════════════════
const REEL = [
  { s: '🍒', w: 10, x3: 5 }, { s: '🍋', w: 8, x3: 8 }, { s: '🔔', w: 6, x3: 15 },
  { s: '⭐', w: 4, x3: 40 }, { s: '💎', w: 2, x3: 120 }, { s: '7️⃣', w: 1, x3: 250 },
];
const reelPick = () => C.weighted(REEL, 'w');
function slotPay(r) {
  const [a, b, c] = r.map(x => x.s);
  if (a === b && b === c) return r[0].x3;
  const pair = a === b ? a : b === c ? b : a === c ? a : null;
  return pair === '🍒' ? 2 : 0;
}
const slots = {
  render(root) {
    let busy = false, auto = false;
    root.innerHTML = `
      <div class="stage">
        <div class="slot-machine">
          <div class="reels">${[0, 1, 2].map(i => `<div class="reel" id="reel${i}"><div class="strip">🍒</div></div>`).join('')}</div>
          <div class="payline"></div>
        </div>
        <div class="paytable">${REEL.slice().reverse().map(r => `<span>${r.s}${r.s}${r.s} <b>${r.x3}×</b></span>`).join('')}<span>🍒🍒 <b>2×</b></span></div>
      </div>
      ${betBox('slots', '<button class="btn-play" id="spin">Spin</button><button class="btn-ghost" id="auto">Auto: off</button>')}`;
    const bet = bindBet(root, 'slots');
    const spin = async () => {
      if (busy) return false;
      const amt = bet.take(); if (!amt) return false;
      busy = true; $(root, '#spin').disabled = true; ui.sfx('spin');
      let res = [reelPick(), reelPick(), reelPick()];
      for (let n = C.retries(); slotPay(res) === 0 && n > 0; n--) res = [reelPick(), reelPick(), reelPick()];
      // luck also feeds the jackpot: 1% of luck per spin (100% luck = 1 in 100 spins)
      if (Math.random() < C.luck() * 0.01) res = [REEL[5], REEL[5], REEL[5]];
      for (let i = 0; i < 3; i++) {
        const strip = $(root, `#reel${i} .strip`);
        const frames = fast() ? 1 : 8 + i * 6;
        for (let f = 0; f < frames; f++) { strip.textContent = reelPick().s; strip.classList.toggle('blur', f < frames - 1); await sleep(45); }
        strip.textContent = res[i].s; strip.classList.remove('blur'); ui.sfx('tick');
      }
      const x = slotPay(res);
      if (x === 250) C.S.stats.jackpots++;
      finish('slots', amt, x, res.map(r => r.s).join(' '));
      root.querySelectorAll('.reel').forEach(r => r.classList.toggle('win', x > 0));
      busy = false; $(root, '#spin').disabled = false; bet.update();
      return true;
    };
    $(root, '#spin').addEventListener('click', spin);
    $(root, '#auto').addEventListener('click', async () => {
      auto = !auto;
      $(root, '#auto').textContent = `Auto: ${auto ? 'on' : 'off'}`;
      while (auto && document.body.contains(root)) {
        if (!(await spin())) { auto = false; break; }
        await sleep(fast() ? 150 : 350);
      }
      if (document.body.contains(root)) $(root, '#auto').textContent = 'Auto: off';
    });
    this.stop = () => { auto = false; };
  },
  destroy() { this.stop?.(); },
};

// ═════════════════════════════════════════════════════════════════════════════
//  MINES
// ═════════════════════════════════════════════════════════════════════════════
const minesMult = (mines, picks) => {
  let m = 0.97;
  for (let i = 0; i < picks; i++) m *= (25 - i) / (25 - mines - i);
  return m;
};
const mines = {
  round: null,
  render(root) {
    let count = 3;
    root.innerHTML = `
      <div class="stage">
        <div class="mines-top">
          <label>Mines <select id="mcount">${Array.from({ length: 24 }, (_, i) => `<option ${i + 1 === 3 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <div class="mines-mult">Next: <b id="mnext">${minesMult(3, 1).toFixed(2)}×</b> · Now: <b id="mnow">—</b></div>
        </div>
        <div class="mines-grid" id="mgrid">${Array.from({ length: 25 }, (_, i) => `<button class="tile" data-i="${i}" disabled></button>`).join('')}</div>
      </div>
      ${betBox('mines', '<button class="btn-play" id="mstart">Start</button><button class="btn-cash" id="mcash" disabled>Cash out</button>')}`;
    const bet = bindBet(root, 'mines');
    const grid = $(root, '#mgrid');
    const sel = $(root, '#mcount');
    const info = () => {
      const r = this.round;
      $(root, '#mnext').textContent = minesMult(r ? r.mines : count, (r ? r.picks : 0) + 1).toFixed(2) + '×';
      $(root, '#mnow').textContent = r && r.picks ? minesMult(r.mines, r.picks).toFixed(2) + '×' : '—';
      $(root, '#mcash').disabled = !(r && r.picks);
    };
    sel.addEventListener('change', () => { count = +sel.value; info(); });
    const end = (lost, label) => {
      const r = this.round; this.round = null;
      grid.querySelectorAll('.tile').forEach((t, i) => {
        t.disabled = true;
        if (!t.classList.contains('safe')) { t.classList.add(r.layout[i] ? 'bomb' : 'ghost'); t.textContent = r.layout[i] ? '💣' : '💎'; }
      });
      C.S.stats.bestMinesTiles = Math.max(C.S.stats.bestMinesTiles, r.picks);
      finish('mines', r.bet, lost ? 0 : minesMult(r.mines, r.picks), label);
      lockAll(root, false); sel.disabled = false; $(root, '#mstart').disabled = false; bet.update(); info();
    };
    this.cashNow = () => { if (this.round) { this.round.picks ? end(false, 'Cashed out') : end(false, 'Refunded'); } };
    $(root, '#mstart').addEventListener('click', () => {
      if (this.round) return;
      const amt = bet.take(); if (!amt) return;
      const layout = Array(25).fill(false);
      let placed = 0; while (placed < count) { const i = Math.floor(Math.random() * 25); if (!layout[i]) { layout[i] = true; placed++; } }
      this.round = { bet: amt, mines: count, layout, picks: 0 };
      lockAll(root, true); sel.disabled = true; $(root, '#mstart').disabled = true;
      grid.querySelectorAll('.tile').forEach(t => { t.className = 'tile'; t.textContent = ''; t.disabled = false; });
      ui.sfx('card'); info();
    });
    grid.addEventListener('click', e => {
      const t = e.target.closest('.tile'); const r = this.round;
      if (!t || !r || t.disabled) return;
      const i = +t.dataset.i;
      if (r.layout[i] && C.secondChance()) {
        // the mine was a dud — luck moves it somewhere else
        const free = r.layout.map((m, j) => !m && j !== i && !grid.children[j].classList.contains('safe') ? j : -1).filter(j => j >= 0);
        if (free.length) { r.layout[i] = false; r.layout[free[Math.floor(Math.random() * free.length)]] = true; ui.toast('🍀 Dud mine! Your luck held.', 'luck'); }
      }
      if (r.layout[i]) { t.classList.add('bomb', 'hit'); t.textContent = '💥'; ui.sfx('boom'); end(true, 'BOOM'); return; }
      r.picks++; t.classList.add('safe'); t.textContent = '💎'; t.disabled = true; ui.sfx('tick');
      info();
      if (r.picks === 25 - r.mines) end(false, 'Board cleared!');
    });
    $(root, '#mcash').addEventListener('click', () => { if (this.round?.picks) { ui.sfx('cash'); end(false, 'Cashed out'); } });
    info();
  },
  destroy() { this.cashNow?.(); },
};

// ═════════════════════════════════════════════════════════════════════════════
//  CRASH
// ═════════════════════════════════════════════════════════════════════════════
const crashPoint = () => {
  const u = Math.random();
  return Math.max(1, Math.floor(0.97 / (1 - u) * 100) / 100);
};
const crash = {
  run: null,
  history: [],
  render(root) {
    root.innerHTML = `
      <div class="stage crash-stage">
        <div class="crash-hist" id="chist">${this.history.map(h => `<span class="${h >= 2 ? 'g' : 'r'}">${h.toFixed(2)}×</span>`).join('')}</div>
        <div class="crash-screen" id="cscreen">
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" class="crash-svg"><polyline id="cline" points="0,200" /></svg>
          <div class="crash-mult" id="cmult">1.00×</div>
          <div class="crash-rocket" id="crocket">🚀</div>
        </div>
        <label class="auto-cash">Auto cash-out at <input id="cauto" inputmode="decimal" placeholder="off" size="6" />×</label>
      </div>
      ${betBox('crash', '<button class="btn-play" id="cbet">Launch</button><button class="btn-cash" id="ccash" disabled>Cash out</button>')}`;
    const bet = bindBet(root, 'crash');
    const multEl = $(root, '#cmult'), line = $(root, '#cline'), screen = $(root, '#cscreen'), rocket = $(root, '#crocket');
    const addHist = cp => {
      this.history = [cp, ...this.history].slice(0, 12);
      $(root, '#chist').innerHTML = this.history.map(h => `<span class="${h >= 2 ? 'g' : 'r'}">${h.toFixed(2)}×</span>`).join('');
    };
    const stop = (cashed) => {
      const r = this.run; if (!r) return;
      this.run = null; cancelAnimationFrame(r.raf);
      const m = cashed ? r.m : 0;
      if (cashed) C.S.stats.bestCrash = Math.max(C.S.stats.bestCrash, r.m);
      screen.classList.toggle('crashed', !cashed);
      multEl.textContent = cashed ? `${r.m.toFixed(2)}× ✓` : `💥 ${r.cp.toFixed(2)}×`;
      if (!cashed) ui.sfx('boom'); else ui.sfx('cash');
      addHist(r.cp);
      finish('crash', r.bet, m, cashed ? `Cashed at ${r.m.toFixed(2)}×` : `Crashed at ${r.cp.toFixed(2)}×`);
      lockAll(root, false); $(root, '#cauto').disabled = false; $(root, '#ccash').disabled = true; bet.update();
    };
    this.cashNow = () => { if (this.run) stop(true); };
    $(root, '#cbet').addEventListener('click', () => {
      if (this.run) return;
      const amt = bet.take(); if (!amt) return;
      let cp = crashPoint();
      for (let n = C.retries(); n > 0; n--) cp = Math.max(cp, crashPoint());   // luck: the rocket keeps the best roll
      const autoX = parseFloat($(root, '#cauto').value) || 0;
      const t0 = performance.now(); const pts = [];
      this.run = { bet: amt, cp, m: 1, t0, raf: 0 };
      lockAll(root, true); $(root, '#cauto').disabled = true; $(root, '#ccash').disabled = false;
      screen.classList.remove('crashed'); ui.sfx('spin');
      const frame = now => {
        const r = this.run; if (!r) return;
        const t = (now - t0) / 1000 * (fast() ? 4 : 1);
        r.m = Math.floor(Math.exp(0.13 * t) * 100) / 100;
        if (autoX >= 1.01 && r.m >= autoX && autoX <= r.cp) { r.m = autoX; return stop(true); }
        if (r.m >= r.cp) { r.m = r.cp; return stop(false); }
        multEl.textContent = r.m.toFixed(2) + '×';
        const x = Math.min(400, t * 22), y = 200 - Math.min(190, Math.log(r.m) * 60);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); if (pts.length > 400) pts.shift();
        line.setAttribute('points', '0,200 ' + pts.join(' '));
        rocket.style.left = `${x / 4}%`; rocket.style.bottom = `${(200 - y) / 2}%`;
        r.raf = requestAnimationFrame(frame);
      };
      this.run.raf = requestAnimationFrame(frame);
    });
    $(root, '#ccash').addEventListener('click', () => this.cashNow());
  },
  destroy() { this.cashNow?.(); },
};

// ═════════════════════════════════════════════════════════════════════════════
//  ROULETTE (European)
// ═════════════════════════════════════════════════════════════════════════════
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
const OUTSIDE = [
  ['red', 'Red', 2, n => colorOf(n) === 'red'], ['black', 'Black', 2, n => colorOf(n) === 'black'],
  ['odd', 'Odd', 2, n => n && n % 2], ['even', 'Even', 2, n => n && n % 2 === 0],
  ['low', '1–18', 2, n => n >= 1 && n <= 18], ['high', '19–36', 2, n => n >= 19],
  ['d1', '1st 12', 3, n => n >= 1 && n <= 12], ['d2', '2nd 12', 3, n => n >= 13 && n <= 24], ['d3', '3rd 12', 3, n => n >= 25],
];
function rouletteBet(id) {
  if (id.startsWith('n')) { const k = +id.slice(1); return { label: `Number ${k}`, x: 36, hit: n => n === k }; }
  const o = OUTSIDE.find(o => o[0] === id); return { label: o[1], x: o[2], hit: n => !!o[3](n) };
}
const roulette = {
  render(root) {
    let target = 'red', busy = false;
    const nums = Array.from({ length: 36 }, (_, i) => i + 1);
    root.innerHTML = `
      <div class="stage">
        <div class="r-window"><div class="r-strip" id="rstrip"></div><div class="r-marker"></div></div>
        <div class="r-table">
          <button class="r-num green" data-b="n0">0</button>
          <div class="r-nums">${nums.map(n => `<button class="r-num ${colorOf(n)}" data-b="n${n}">${n}</button>`).join('')}</div>
        </div>
        <div class="r-outside">${OUTSIDE.map(o => `<button class="r-out ${o[0] === 'red' ? 'on' : ''} ${o[0]}" data-b="${o[0]}">${o[1]} <small>${o[2]}×</small></button>`).join('')}</div>
        <p class="odds">Betting on: <b id="rtarget">Red · 2×</b></p>
      </div>
      ${betBox('roulette', '<button class="btn-play" id="rspin">Spin</button>')}`;
    const bet = bindBet(root, 'roulette');
    const strip = $(root, '#rstrip');
    const cell = n => `<span class="${colorOf(n)}">${n}</span>`;
    strip.innerHTML = Array.from({ length: 15 }, () => cell(Math.floor(Math.random() * 37))).join('');
    root.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
      if (busy) return;
      target = b.dataset.b;
      root.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b));
      const rb = rouletteBet(target);
      $(root, '#rtarget').textContent = `${rb.label} · ${rb.x}×`;
      ui.sfx('tick');
    }));
    $(root, '#rspin').addEventListener('click', async () => {
      if (busy) return;
      const amt = bet.take(); if (!amt) return;
      busy = true; lockAll(root, true); ui.sfx('spin');
      const rb = rouletteBet(target);
      let n = Math.floor(Math.random() * 37);
      for (let k = C.retries(); !rb.hit(n) && k > 0; k--) n = Math.floor(Math.random() * 37);
      const seq = Array.from({ length: 44 }, () => Math.floor(Math.random() * 37));
      seq.push(n, ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 37)));
      strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
      strip.innerHTML = seq.map(cell).join('');
      await sleep(30);
      const w = strip.children[0].getBoundingClientRect().width;
      const view = strip.parentElement.getBoundingClientRect().width;
      const offset = 44 * w - view / 2 + w / 2 + (Math.random() - 0.5) * w * 0.6;
      strip.style.transition = fast() ? 'none' : 'transform 3.2s cubic-bezier(.12,.75,.2,1)';
      strip.style.transform = `translateX(${-offset}px)`;
      await sleep(fast() ? 60 : 3300);
      strip.children[44].classList.add('landed');
      const win = rb.hit(n);
      if (win && n === 0) C.S.stats.zeroWins++;
      finish('roulette', amt, win ? rb.x : 0, `${n} ${colorOf(n)}`);
      busy = false; lockAll(root, false); bet.update();
    });
  },
};

// ═════════════════════════════════════════════════════════════════════════════
//  BLACKJACK
// ═════════════════════════════════════════════════════════════════════════════
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function newShoe() {
  const s = [];
  for (let d = 0; d < 6; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, su });
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}
function handValue(h) {
  let v = 0, aces = 0;
  for (const c of h) { if (c.r === 'A') { aces++; v += 11; } else v += ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r; }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}
const isBJ = h => h.length === 2 && handValue(h) === 21;
const cardHtml = (c, hidden) => hidden
  ? '<div class="pcard back"></div>'
  : `<div class="pcard ${c.su === '♥' || c.su === '♦' ? 'red' : ''}"><span>${c.r}</span><span>${c.su}</span></div>`;

const blackjack = {
  shoe: newShoe(),
  hand: null,
  render(root) {
    root.innerHTML = `
      <div class="stage bj">
        <div class="bj-row"><div class="bj-label">Dealer <b id="dval"></b></div><div class="bj-cards" id="dealer"></div></div>
        <div class="bj-msg" id="bjmsg">Place a bet and deal.</div>
        <div class="bj-row"><div class="bj-label">You <b id="pval"></b></div><div class="bj-cards" id="player"></div></div>
      </div>
      ${betBox('blackjack', `
        <button class="btn-play" id="deal">Deal</button>
        <button class="btn-ghost" id="hit" disabled>Hit</button>
        <button class="btn-ghost" id="stand" disabled>Stand</button>
        <button class="btn-ghost" id="double" disabled>Double</button>`)}`;
    const bet = bindBet(root, 'blackjack');
    const draw = () => {
      if (this.shoe.length < 52) this.shoe = newShoe();
      return this.shoe.pop();
    };
    const show = (reveal) => {
      const h = this.hand; if (!h) return;
      const hideHole = !reveal && !h.peek;
      $(root, '#dealer').innerHTML = h.dealer.map((c, i) => cardHtml(c, i === 1 && !reveal)).join('') +
        (h.peek && !reveal ? `<span class="peek" title="Your luck let you peek">🍀 ${h.dealer[1].r}${h.dealer[1].su}</span>` : '');
      $(root, '#player').innerHTML = h.player.map(c => cardHtml(c)).join('');
      $(root, '#pval').textContent = handValue(h.player);
      $(root, '#dval').textContent = reveal ? handValue(h.dealer) : hideHole ? handValue([h.dealer[0]]) + ' + ?' : handValue([h.dealer[0]]) + ' + ?';
    };
    const buttons = (on) => {
      $(root, '#hit').disabled = !on; $(root, '#stand').disabled = !on;
      $(root, '#double').disabled = !on || this.hand?.player.length !== 2 || C.S.chips < this.hand?.bet;
      $(root, '#deal').disabled = on;
      root.querySelectorAll('.bet-quick button, .bet-input input').forEach(b => { b.disabled = on; });
    };
    const done = (x, msg) => {
      const h = this.hand; this.hand = null;
      show(true);
      $(root, '#dealer').innerHTML = h.dealer.map(c => cardHtml(c)).join('');
      $(root, '#dval').textContent = handValue(h.dealer);
      $(root, '#bjmsg').textContent = msg;
      finish('blackjack', h.bet, x, msg);
      buttons(false); bet.update();
    };
    const dealerPlay = async () => {
      const h = this.hand;
      show(true);
      const pv = handValue(h.player);
      while (handValue(h.dealer) < 17) { await sleep(fast() ? 0 : 450); h.dealer.push(draw()); show(true); ui.sfx('card'); }
      const dv = handValue(h.dealer);
      if (dv > 21) done(2, 'Dealer busts — you win!');
      else if (pv > dv) done(2, `${pv} beats ${dv} — you win!`);
      else if (pv === dv) done(1, `Push at ${pv}.`);
      else done(0, `${dv} beats ${pv}.`);
    };
    this.finishNow = () => { if (this.hand) { const h = this.hand; while (handValue(h.dealer) < 17) h.dealer.push(draw()); const pv = handValue(h.player), dv = handValue(h.dealer); done(pv > 21 ? 0 : dv > 21 || pv > dv ? 2 : pv === dv ? 1 : 0, 'Hand auto-resolved.'); } };
    $(root, '#deal').addEventListener('click', () => {
      if (this.hand) return;
      const amt = bet.take(); if (!amt) return;
      this.hand = { bet: amt, player: [draw(), draw()], dealer: [draw(), draw()], peek: C.secondChance() };
      ui.sfx('card'); buttons(true); show(false);
      $(root, '#bjmsg').textContent = this.hand.peek ? 'Your luck lets you peek at the hole card…' : 'Hit, stand, or double?';
      const h = this.hand;
      if (isBJ(h.player)) { C.S.stats.blackjacks++; return done(isBJ(h.dealer) ? 1 : 2.5, isBJ(h.dealer) ? 'Both blackjack — push.' : 'BLACKJACK! Pays 3:2'); }
      if (isBJ(h.dealer)) return done(0, 'Dealer blackjack.');
    });
    $(root, '#hit').addEventListener('click', () => {
      const h = this.hand; if (!h) return;
      h.player.push(draw()); ui.sfx('card'); show(false);
      $(root, '#double').disabled = true;
      const v = handValue(h.player);
      if (v > 21) done(0, `Bust with ${v}.`);
      else if (v === 21) { buttons(false); $(root, '#deal').disabled = true; dealerPlay(); }
    });
    $(root, '#stand').addEventListener('click', () => { if (!this.hand) return; buttons(false); $(root, '#deal').disabled = true; dealerPlay(); });
    $(root, '#double').addEventListener('click', () => {
      const h = this.hand; if (!h || h.player.length !== 2 || C.S.chips < h.bet) return;
      C.S.chips -= h.bet; C.S.stats.wagered += h.bet; h.bet *= 2; ui.refresh();
      h.player.push(draw()); ui.sfx('card'); show(false);
      const v = handValue(h.player);
      if (v > 21) return done(0, `Doubled and bust with ${v}.`);
      buttons(false); $(root, '#deal').disabled = true; dealerPlay();
    });
  },
  destroy() { this.finishNow?.(); },
};

export const GAME_UI = { coin, scratch, slots, mines, crash, roulette, blackjack };

import * as C from './core.js';
import {
  VENUES, GAMES, BUSINESSES, CHARMS, RARITIES, CHARM_MAX_LEVEL, ACE_SHOP, ACHIEVEMENTS, WHEEL, GOLDEN, BROKE_LINES, BIZ_MILESTONES, LUCK_CAP,
  STAFF, INCIDENTS,
} from './data.js';
import { GAME_UI, initGames } from './games.js';
import * as INC from './incidents.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const M = C.money;

// ── Sound (tiny Web Audio blips, no files) ───────────────────────────────────
let actx = null;
function sfx(kind) {
  if (!C.S.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const tone = (f, t = 0, d = 0.08, type = 'square', v = 0.05) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, actx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + d);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + d + 0.02);
    };
    ({
      tick: () => tone(1200, 0, 0.03, 'square', 0.025),
      card: () => tone(500, 0, 0.05, 'triangle', 0.06),
      spin: () => [0, .05, .1].forEach((t, i) => tone(300 + i * 120, t, 0.05, 'triangle', 0.04)),
      win: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle', 0.06)),
      big: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.08, 0.2, 'triangle', 0.07)),
      lose: () => tone(160, 0, 0.18, 'sawtooth', 0.04),
      boom: () => tone(70, 0, 0.35, 'sawtooth', 0.08),
      cash: () => [880, 1320].forEach((f, i) => tone(f, i * 0.06, 0.08, 'square', 0.04)),
      buy: () => tone(700, 0, 0.06, 'triangle', 0.05),
      nope: () => tone(110, 0, 0.12, 'square', 0.04),
      level: () => [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.06)),
    })[kind]?.();
  } catch { /* audio unavailable */ }
}

// ── Toasts / floating text / confetti ────────────────────────────────────────
function toast(html, type = '') {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' t-' + type : ''); t.innerHTML = html;
  box.prepend(t);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => t.classList.add('out'), 3400);
  setTimeout(() => t.remove(), 3900);
}
function floatText(text, cls) {
  const host = $('#game-area .stage') || $('#main');
  if (!host) return;
  const f = document.createElement('div');
  f.className = 'float ' + cls; f.textContent = text;
  host.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}
function confetti(n = 60) {
  if (!C.S.settings.motion) return;
  const colors = ['#fbbf24', '#22c55e', '#f43f5e', '#38bdf8', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
    c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

// ── After every bet ──────────────────────────────────────────────────────────
function afterBet(game, bet, payoutX, res, label) {
  if (res.profit > 0) {
    floatText(`+${M(res.profit)}`, 'win');
    if (payoutX >= 10 || res.profit >= Math.max(1e3, C.S.chips * 0.5)) {
      sfx('big'); confetti(payoutX >= 50 ? 120 : 60);
      toast(`🎉 <b>${esc(label)}</b> — won <b>${M(res.profit)}</b> (${payoutX.toFixed(2)}×)`, 'big');
    } else sfx('win');
  } else if (res.profit < 0) { floatText(`−${M(-res.profit)}`, 'lose'); sfx('lose'); }
  else { floatText('push', 'push'); }
  const last = $('#last-result');
  if (last) last.innerHTML = `<span class="${res.profit > 0 ? 'g' : res.profit < 0 ? 'r' : ''}">${esc(label)} · ${res.profit >= 0 ? '+' : '−'}${M(Math.abs(res.profit))}</span>`;
  achievements();
  refresh();
}

C.onLevelUp(lvl => { sfx('level'); toast(`⬆️ Level <b>${lvl}</b> — winnings +${(lvl - 1) * 2}%`, 'level'); });

function achievements() {
  for (const a of C.checkAchievements()) { sfx('level'); toast(`🏆 <b>${esc(a.name)}</b> — ${esc(a.desc)} <small>(+2% everything)</small>`, 'ach'); }
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function refresh() {
  const S = C.S;
  $('#chips').textContent = M(S.chips);
  $('#ips').textContent = M(C.incomePerSec()) + '/s';
  $('#lvl').textContent = S.level;
  $('#xpbar').style.width = Math.min(100, S.xp / C.xpNeeded(S.level) * 100) + '%';
  $('#xpbar').parentElement.title = `${C.fmt(S.xp)} / ${C.fmt(C.xpNeeded(S.level))} XP`;
  $('#venue-name').textContent = VENUES[S.venue].icon + ' ' + VENUES[S.venue].name;
  $('#aces').textContent = S.aces;
  $('#aces-wrap').hidden = !S.aces && !S.prestiges;
  const debt = $('#debt');
  debt.hidden = !S.loan.debt;
  if (S.loan.debt) {
    const left = (S.loan.deadline - Date.now()) / 1000;
    debt.innerHTML = S.loan.garnish ? `🦈 Owe ${M(S.loan.debt)} · garnishing income` : `🦈 Owe ${M(S.loan.debt)} · ${left > 0 ? C.duration(left) : 'due now'}`;
    debt.classList.toggle('urgent', !S.loan.garnish && left < 180);
  }
  const buffs = S.buffs.filter(b => b.until > Date.now());
  const alert = $('#alert'), pend = S.sim.pending;
  alert.hidden = !pend;
  if (pend) {
    const d = INC.incidentDef(pend.id);
    if (alert.dataset.id !== pend.id + pend.at) { alert.dataset.id = pend.id + pend.at; alert.innerHTML = `${d.icon} <span>${esc(d.title)}</span> <small></small>`; }
    alert.querySelector('small').textContent = Math.max(0, Math.ceil(INC.autoResolveIn())) + 's';
  }
  $('#buffs').innerHTML = buffs.map(b => `<span class="buff">${b.label} · ${Math.ceil((b.until - Date.now()) / 1000)}s</span>`).join('');
  const wheelReady = Date.now() - S.lastWheel >= 864e5;
  document.querySelector('[data-tab="wheel"]')?.classList.toggle('ping', wheelReady);
  const canFold = C.acesOnFold() >= 1;
  document.querySelector('[data-tab="prestige"]')?.classList.toggle('ping', canFold && C.acesOnFold() >= Math.max(1, S.aces + 1));
  liveUpdate();
}

// ═════════════════════════════════════════════════════════════════════════════
//  TABS
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  ['floor', '🎰', 'Casino Floor'], ['casino', '🏢', 'Your Casino'], ['upgrades', '⬆️', 'Upgrades'], ['crates', '🎁', 'Crates & Charms'],
  ['venues', '🗺️', 'Venues'], ['vinnie', '🦈', 'Vinnie'], ['wheel', '🎡', 'Daily Wheel'],
  ['prestige', '🂡', 'Fold'], ['ach', '🏆', 'Achievements'], ['stats', '📊', 'Stats'], ['settings', '⚙️', 'Settings'],
];
let tab = 'floor', currentGame = null, activeGame = null;

function setTab(t) {
  clearInterval(floorTimer);
  if (activeGame) { GAME_UI[activeGame]?.destroy?.(); activeGame = null; }
  tab = t;
  $('#nav').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  render();
  $('#main').scrollTop = 0;
  try { localStorage.setItem('ge-tab', t); } catch { /* ignore */ }
}

function render() {
  const main = $('#main');
  liveUpdate = () => {};
  main.innerHTML = PANELS[tab]();
  MOUNT[tab]?.(main);
}

const PANELS = {}, MOUNT = {};
let liveUpdate = () => {};

// ── Casino floor ─────────────────────────────────────────────────────────────
PANELS.floor = () => {
  const unlocked = GAMES.filter(C.gameUnlocked);
  if (!currentGame || !C.gameUnlocked(C.gameDef(currentGame))) currentGame = unlocked[0].id;
  return `
    <div class="game-tabs">
      ${GAMES.map(g => {
        const ok = C.gameUnlocked(g);
        return `<button class="gtab ${g.id === currentGame ? 'on' : ''} ${ok ? '' : 'locked'}" data-g="${g.id}" ${ok ? '' : 'disabled'} title="${ok ? esc(g.desc) : 'Unlocks at ' + VENUES[g.venue].name}">
          <span class="gi">${ok ? g.icon : '🔒'}</span><span>${g.name}</span></button>`;
      }).join('')}
    </div>
    <div class="game-head">
      <div><h2>${C.gameDef(currentGame).icon} ${C.gameDef(currentGame).name}</h2><p class="muted">${esc(C.gameDef(currentGame).desc)}</p></div>
      <div class="game-meta">
        <span>Table limit <b>${M(C.tableLimit())}</b></span>
        <span>Winnings <b>×${C.profitMult(currentGame).toFixed(2)}</b></span>
        <span>Luck <b>${(C.luck() * 100).toFixed(1)}%</b></span>
      </div>
    </div>
    <div id="game-area" class="game-area"></div>
    <div id="last-result" class="last-result"></div>
    <div id="broke" class="broke" hidden></div>`;
};
MOUNT.floor = main => {
  main.querySelectorAll('.gtab').forEach(b => b.addEventListener('click', () => {
    if (activeGame) { GAME_UI[activeGame]?.destroy?.(); activeGame = null; }
    currentGame = b.dataset.g; sfx('tick'); render();
  }));
  activeGame = currentGame;
  GAME_UI[currentGame].render($('#game-area'));
  const broke = $('#broke');
  liveUpdate = () => {
    const isBroke = C.S.chips < 1 && C.incomePerSec() === 0;
    broke.hidden = !isBroke;
    if (isBroke && !broke.dataset.on) {
      broke.dataset.on = 1;
      broke.innerHTML = `<p>You're broke. 💸</p><button class="btn-play" id="beg">Scrounge for chips</button><p class="muted small">…or borrow from Vinnie.</p>`;
      $('#beg').addEventListener('click', beg);
    }
    if (!isBroke) delete broke.dataset.on;
  };
};
function beg() {
  const wait = 15e3 - (Date.now() - C.S.brokeAt);
  if (wait > 0) { toast(`Nobody's buying it yet. Try again in ${Math.ceil(wait / 1000)}s.`, 'bad'); return; }
  const amt = Math.floor(20 + Math.random() * 60) * Math.max(1, C.S.venue * 4 + 1);
  C.S.brokeAt = Date.now(); C.S.stats.broke++;
  C.earn(amt);
  toast(`${BROKE_LINES[Math.floor(Math.random() * BROKE_LINES.length)]} <b>+${M(amt)}</b>`);
  refresh();
}

// ── Your casino (sim) ────────────────────────────────────────────────────────
let buyMode = 1, casinoView = 'floor';
const stars = r => { const n = r / 20; return '★★★★★'.split('').map((c, i) => `<i class="${i < Math.round(n) ? 'on' : ''}">★</i>`).join(''); };
const pct = x => (x >= 1 ? '+' : '') + Math.round((x - 1) * 100) + '%';

PANELS.casino = () => `
  <div class="panel-head">
    <div><h2>🏢 Your Casino</h2><p class="muted">Run the place. Rig the games, hire staff, keep the customers happy — and keep an eye on the floor.</p></div>
    <div class="buymode subtabs">${[['floor', '🎲 Floor'], ['biz', '🏗️ Businesses'], ['staff', '👥 Staff']].map(([k, l]) => `<button data-v="${k}" class="${casinoView === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  </div>
  <div class="income-banner">
    <span>Net <b id="cas-ips">${M(C.incomePerSec())}/s</b></span>
    <span class="muted">Gross <span id="cas-gross">${M(C.grossIncome())}/s</span> · Salaries <span id="cas-sal">−${M(C.salaries())}/s</span></span>
  </div>
  ${casinoView === 'floor' ? floorView() : casinoView === 'biz' ? bizView() : staffView()}`;

function floorView() {
  const S = C.S;
  return `
  <div class="sim-grid">
    <div class="sim-cards">
      <div class="sim-card"><div class="sc-label">Reputation</div><div class="stars" id="rep-stars">${stars(S.sim.rep)}</div>
        <div class="sc-val"><b id="rep-val">${S.sim.rep.toFixed(0)}</b>/100 <span class="muted small" id="rep-trend"></span></div>
        <div class="muted small">More reputation → more visitors and income.</div></div>
      <div class="sim-card"><div class="sc-label">Visitors</div><div class="sc-val"><b id="vis-val">${C.visitors()}</b> on the floor · <span id="seat-val">${C.seats()}</span> seats</div>
        <div class="bar"><i id="occ-bar" style="width:${C.occupancy() * 100}%"></i></div>
        <div class="muted small">Empty seats earn less. Add promoters, singers and signs.</div></div>
      <div class="sim-card edge-card"><div class="sc-label">House edge — how rigged are your games?</div>
        <div class="edge-row"><input type="range" id="edge" min="${C.EDGE_MIN}" max="${C.EDGE_MAX}" step="1" value="${S.sim.edge}" /><b id="edge-val">${S.sim.edge}%</b></div>
        <div class="muted small" id="edge-note"></div></div>
      <div class="sim-card"><div class="sc-label">Multipliers</div><div class="mults" id="mults"></div></div>
    </div>
    <div class="floor-wrap">
      <div class="floor" id="floor">
        ${BUSINESSES.filter(b => C.bizCount(b.id)).map(b => `<div class="ftile" data-b="${b.id}" title="${esc(b.name)}"><span>${b.icon}</span><small>×${C.bizCount(b.id)}</small></div>`).join('') || '<div class="floor-empty">Your floor is empty. Buy your first business!</div>'}
        <div class="people" id="people"></div>
      </div>
      <div class="inc-log"><div class="sc-label">Incident log</div><div id="inc-log">${incidentLogHtml()}</div></div>
    </div>
  </div>`;
}
function incidentLogHtml() {
  const log = C.S.sim.log || [];
  return log.length ? log.map(l => `<div class="inc-row"><span>${l.icon}</span><span>${esc(l.text)}</span></div>`).join('') : '<div class="muted small">Quiet so far. It won\'t last.</div>';
}

function bizView() {
  return `
  <div class="row-end"><div class="buymode">${[1, 10, 25, 'max'].map(m => `<button data-m="${m}" class="${String(buyMode) === String(m) ? 'on' : ''}">${m === 'max' ? 'Max' : '×' + m}</button>`).join('')}</div></div>
  <div class="biz-list">
    ${BUSINESSES.map((b, i) => {
      const hidden = i > 0 && C.bizCount(BUSINESSES[i - 1].id) === 0 && C.bizCount(b.id) === 0;
      return `<div class="biz ${hidden ? 'mystery' : ''}" data-b="${b.id}">
        <div class="biz-icon">${hidden ? '❓' : b.icon}</div>
        <div class="biz-info">
          <div class="biz-name">${hidden ? '???' : esc(b.name)} <span class="biz-owned" data-owned>${C.bizCount(b.id)}</span></div>
          <div class="biz-sub muted" data-sub></div>
          <div class="ms"><i data-ms></i></div>
        </div>
        <button class="biz-buy" data-buy ${hidden ? 'disabled' : ''}></button>
      </div>`;
    }).join('')}
  </div>`;
}

function staffView() {
  return `
  <div class="staff-list">
    ${STAFF.map(st => `<div class="staff" data-st="${st.id}">
      <div class="st-icon">${st.icon}</div>
      <div class="st-info"><div class="biz-name">${esc(st.name)} <span class="biz-owned" data-n>${C.staffCount(st.id)}/${st.max}</span></div>
        <div class="muted small">${esc(st.desc)}</div>
        <div class="muted small">Salary ${st.salary}% of gross income each.</div></div>
      <div class="st-btns"><button class="btn-ghost" data-fire>Fire</button><button class="biz-buy" data-hire></button></div>
    </div>`).join('')}
  </div>
  <p class="muted small">Staff stay until you Fold. Security also helps against robberies and cheats; cleaners keep inspectors happy.</p>`;
}

MOUNT.casino = main => {
  main.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { casinoView = b.dataset.v; sfx('tick'); render(); }));
  const common = () => {
    $('#cas-ips').textContent = M(C.incomePerSec()) + '/s';
    $('#cas-gross').textContent = M(C.grossIncome()) + '/s';
    $('#cas-sal').textContent = '−' + M(C.salaries()) + '/s';
  };
  if (casinoView === 'floor') return mountFloor(main, common);
  if (casinoView === 'staff') return mountStaff(main, common);
  main.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { buyMode = b.dataset.m === 'max' ? 'max' : +b.dataset.m; render(); }));
  main.querySelectorAll('.biz').forEach(row => {
    const b = BUSINESSES.find(x => x.id === row.dataset.b);
    row.querySelector('[data-buy]').addEventListener('click', () => {
      const n = buyMode === 'max' ? C.bizMaxAffordable(b) : buyMode;
      if (n > 0 && C.buyBiz(b, n)) { sfx('buy'); achievements(); refresh(); if (n && C.bizCount(b.id) === n) render(); }
      else sfx('nope');
    });
  });
  liveUpdate = () => {
    common();
    main.querySelectorAll('.biz').forEach(row => {
      if (row.classList.contains('mystery')) return;
      const b = BUSINESSES.find(x => x.id === row.dataset.b);
      const n = buyMode === 'max' ? Math.max(1, C.bizMaxAffordable(b)) : buyMode;
      const cost = C.bizCost(b, n);
      const btn = row.querySelector('[data-buy]');
      btn.innerHTML = `Buy ${buyMode === 'max' ? C.bizMaxAffordable(b) || 1 : n}<br><b>${M(cost)}</b>`;
      btn.disabled = cost > C.S.chips;
      row.querySelector('[data-owned]').textContent = C.bizCount(b.id);
      const next = C.nextMilestone(b.id);
      const each = b.income * C.bizMilestoneMult(b.id) * C.idleMult();
      row.querySelector('[data-sub]').innerHTML = `${M(each * C.bizCount(b.id))}/s base · ${M(each)}/s each` +
        (next ? ` · <span class="ms-txt">×2 at ${next}</span>` : ' · <span class="ms-txt">all milestones</span>');
      const prev = [...BIZ_MILESTONES].reverse().find(m => m <= C.bizCount(b.id)) || 0;
      row.querySelector('[data-ms]').style.width = next ? ((C.bizCount(b.id) - prev) / (next - prev) * 100) + '%' : '100%';
    });
  };
};

function mountStaff(main, common) {
  main.querySelectorAll('.staff').forEach(row => {
    const st = STAFF.find(x => x.id === row.dataset.st);
    row.querySelector('[data-hire]').addEventListener('click', () => {
      if (C.hire(st)) { sfx('buy'); toast(`${st.icon} Hired a ${st.name.toLowerCase()}.`); refresh(); } else sfx('nope');
    });
    row.querySelector('[data-fire]').addEventListener('click', () => { if (C.fire(st)) { sfx('tick'); refresh(); } });
  });
  liveUpdate = () => {
    common();
    main.querySelectorAll('.staff').forEach(row => {
      const st = STAFF.find(x => x.id === row.dataset.st), n = C.staffCount(st.id), full = n >= st.max, cost = C.hireCost(st);
      row.querySelector('[data-n]').textContent = `${n}/${st.max}`;
      const h = row.querySelector('[data-hire]');
      h.innerHTML = full ? 'Full team' : `Hire<br><b>${M(cost)}</b>`;
      h.disabled = full || cost > C.S.chips;
      row.querySelector('[data-fire]').disabled = !n;
    });
  };
}

let floorTimer = 0;
function mountFloor(main, common) {
  const edge = $('#edge');
  const note = () => {
    const S = C.S, e = S.sim.edge;
    $('#edge-val').textContent = e + '%';
    $('#edge-note').innerHTML = `Income ×${C.edgeMult().toFixed(2)} · reputation target <b>${C.repTarget().toFixed(0)}</b>` +
      (e > 8 ? ' · <span class="r">customers are noticing…</span>' : e < 4 ? ' · <span class="g">customers love the odds</span>' : '');
  };
  edge.addEventListener('input', () => { C.setEdge(+edge.value); note(); refresh(); });
  note();
  // little people wandering around the floor
  const people = $('#people');
  const FACES = ['🧍', '🧍‍♀️', '🧍‍♂️', '🕴️', '💃', '🧑‍🦳', '👩‍🦰', '🤠', '🧔', '👵'];
  const sync = () => {
    const want = Math.min(36, C.visitors());
    while (people.children.length < want) {
      const p = document.createElement('span'); p.className = 'person';
      p.textContent = FACES[Math.floor(Math.random() * FACES.length)];
      p.style.left = Math.random() * 92 + '%'; p.style.top = Math.random() * 85 + '%';
      people.appendChild(p);
    }
    while (people.children.length > want) people.lastChild.remove();
    people.querySelectorAll('.person').forEach(p => {
      if (Math.random() < 0.6) { p.style.left = Math.random() * 92 + '%'; p.style.top = Math.random() * 85 + '%'; }
    });
    const tiles = main.querySelectorAll('.ftile');
    if (tiles.length && C.S.settings.motion) {
      const t = tiles[Math.floor(Math.random() * tiles.length)];
      const pop = document.createElement('i'); pop.className = 'coinpop'; pop.textContent = '+$';
      t.appendChild(pop); setTimeout(() => pop.remove(), 1200);
    }
  };
  sync();
  clearInterval(floorTimer);
  floorTimer = setInterval(() => { if (!document.body.contains(people)) return clearInterval(floorTimer); sync(); }, 2200);
  liveUpdate = () => {
    common();
    const S = C.S, t = C.repTarget();
    $('#rep-stars').innerHTML = stars(S.sim.rep);
    $('#rep-val').textContent = S.sim.rep.toFixed(0);
    $('#rep-trend').textContent = Math.abs(t - S.sim.rep) < 0.5 ? '· steady' : t > S.sim.rep ? `· rising to ${t.toFixed(0)}` : `· falling to ${t.toFixed(0)}`;
    $('#rep-trend').className = 'small ' + (t > S.sim.rep + 0.5 ? 'g' : t < S.sim.rep - 0.5 ? 'r' : 'muted');
    $('#vis-val').textContent = C.visitors();
    $('#seat-val').textContent = C.seats();
    $('#occ-bar').style.width = C.occupancy() * 100 + '%';
    $('#mults').innerHTML = [
      ['Reputation', C.repMult()], ['House edge', C.edgeMult()], ['Occupancy', C.occMult()], ['Staff', C.staffMult()],
      ['Upgrades', 1 + C.upgSum('income') / 100], ['Charms, aces & achievements', C.idleMult()],
    ].map(([k, v]) => `<div><span class="muted">${k}</span><b class="${v >= 1 ? 'g' : 'r'}">${pct(v)}</b></div>`).join('');
    note();
  };
}

// ── Upgrades ─────────────────────────────────────────────────────────────────
let upFilter = 'all';
const UP_GROUPS = { casino: ['income', 'rep', 'visitors', 'security', 'salary', 'offline'], you: ['luck', 'tablelimit'] };
const upGroup = u => u.kind === 'biz' ? 'biz' : u.kind.startsWith('profit:') || UP_GROUPS.you.includes(u.kind) ? 'you' : 'casino';
PANELS.upgrades = () => {
  const all = C.allUpgrades().filter(u => u.kind !== 'biz' || C.bizCount(u.biz) > 0);
  const list = all.filter(u => (upFilter === 'all' || upGroup(u) === upFilter));
  const open = list.filter(u => !C.S.sim.upgrades[u.id]).sort((a, b) => a.cost - b.cost);
  const owned = list.filter(u => C.S.sim.upgrades[u.id]);
  const card = u => {
    const has = C.S.sim.upgrades[u.id], ok = C.upgradeAvailable(u);
    return `<div class="upg ${has ? 'owned' : ''} ${ok ? '' : 'locked'}" data-u="${u.id}">
      <div class="upg-icon">${u.icon}</div>
      <div class="upg-info"><b>${esc(u.name)}</b><div class="muted small">${esc(u.desc)}</div></div>
      ${has ? '<span class="v-tag">Owned</span>' : `<button class="biz-buy" data-buyup="${u.id}" ${ok ? '' : 'disabled'}>${ok ? `Buy<br><b>${M(u.cost)}</b>` : `Need ${u.need}`}</button>`}
    </div>`;
  };
  return `
  <div class="panel-head">
    <div><h2>⬆️ Upgrades</h2><p class="muted">One-time purchases. They last until you Fold.</p></div>
    <div class="buymode subtabs">${[['all', 'All'], ['casino', '🏢 Casino'], ['biz', '🏗️ Businesses'], ['you', '🎰 You']].map(([k, l]) => `<button data-f="${k}" class="${upFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  </div>
  <div class="upg-list">${open.map(card).join('') || '<p class="muted">Nothing left to buy here — for now.</p>'}</div>
  ${owned.length ? `<h3 class="sub">Owned <span class="muted">${owned.length}</span></h3><div class="upg-list">${owned.map(card).join('')}</div>` : ''}`;
};
MOUNT.upgrades = main => {
  main.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { upFilter = b.dataset.f; sfx('tick'); render(); }));
  main.querySelectorAll('[data-buyup]').forEach(b => b.addEventListener('click', () => {
    const u = C.allUpgrades().find(x => x.id === b.dataset.buyup);
    if (C.buyUpgrade(u)) { sfx('level'); toast(`${u.icon} <b>${esc(u.name)}</b> installed.`, 'big'); achievements(); refresh(); render(); }
    else sfx('nope');
  }));
  liveUpdate = () => main.querySelectorAll('[data-buyup]').forEach(b => {
    const u = C.allUpgrades().find(x => x.id === b.dataset.buyup);
    b.disabled = !C.upgradeAvailable(u) || u.cost > C.S.chips;
  });
};

// ── Crates & charms ──────────────────────────────────────────────────────────
PANELS.crates = () => {
  const slots = C.charmSlots();
  const owned = CHARMS.filter(c => C.S.charms[c.id]);
  return `
  <div class="panel-head"><div><h2>🎁 Crates & Charms</h2><p class="muted">Crates hold charms. Duplicates level a charm up (max ${CHARM_MAX_LEVEL}). Better venues mean better odds.</p></div></div>
  <div class="crate-row">
    <div class="crate-box">
      <div class="crate-art">📦</div>
      <button class="btn-play" id="open-crate">Open crate<br><b id="crate-cost">${M(C.crateCost())}</b></button>
      <div class="odds-list">${RARITIES.map(r => `<span style="color:${r.color}">${r.name}</span>`).join(' · ')}</div>
    </div>
    <div class="equipped">
      <h3>Equipped <span class="muted">${C.S.equipped.length}/${slots}</span></h3>
      <div class="slots">${Array.from({ length: slots }, (_, i) => {
        const id = C.S.equipped[i]; const c = id && C.charmDef(id);
        return c ? `<button class="slot full" data-unequip="${id}" style="--rc:${C.rarity(c.r).color}" title="Click to unequip">${c.icon}<small>Lv ${C.S.charms[id]}</small></button>` : `<div class="slot">empty</div>`;
      }).join('')}</div>
      <p class="muted small">Luck: <b>${(C.luck() * 100).toFixed(1)}%</b> (max ${LUCK_CAP}%) · luck gives losing bets a second chance. Above 100% you get extra re-rolls, the rocket flies higher and slots hit 777 more often.</p>
    </div>
  </div>
  <h3 class="sub">Collection <span class="muted">${owned.length}/${CHARMS.length}</span></h3>
  <div class="charm-grid">
    ${CHARMS.map(c => {
      const lvl = C.S.charms[c.id] || 0, r = C.rarity(c.r), on = C.S.equipped.includes(c.id);
      return lvl ? `<button class="charm ${on ? 'on' : ''}" data-equip="${c.id}" style="--rc:${r.color}">
          <span class="ci">${c.icon}</span><b>${esc(c.name)}</b><span class="lv">Lv ${lvl}${lvl >= CHARM_MAX_LEVEL ? ' MAX' : ''}</span>
          <span class="eff">${effectText(c, lvl)}</span><span class="rt" style="color:${r.color}">${r.name}${on ? ' · equipped' : ''}</span></button>`
        : `<div class="charm unknown" style="--rc:${r.color}"><span class="ci">?</span><b>???</b><span class="rt" style="color:${r.color}">${r.name}</span></div>`;
    }).join('')}
  </div>`;
};
function effectText(c, lvl) {
  const v = +(c.value * lvl).toFixed(1);
  if (c.kind.startsWith('profit:')) { const g = c.kind.split(':')[1]; return `+${v}% ${g === 'all' ? 'all winnings' : C.gameDef(g).name + ' winnings'}`; }
  return { luck: `+${v}% luck`, idle: `+${v}% casino income`, xp: `+${v}% XP`, offline: `+${v}h offline cap`, loan: `−${v}% loan interest` }[c.kind];
}
MOUNT.crates = main => {
  $('#open-crate').addEventListener('click', openCrate);
  main.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.equip, eq = C.S.equipped;
    if (eq.includes(id)) eq.splice(eq.indexOf(id), 1);
    else if (eq.length < C.charmSlots()) eq.push(id);
    else { toast('All charm slots are full — unequip one first.', 'bad'); sfx('nope'); return; }
    sfx('tick'); render(); refresh();
  }));
  main.querySelectorAll('[data-unequip]').forEach(b => b.addEventListener('click', () => {
    C.S.equipped.splice(C.S.equipped.indexOf(b.dataset.unequip), 1); sfx('tick'); render(); refresh();
  }));
  liveUpdate = () => { const btn = $('#open-crate'); if (btn) btn.disabled = C.crateCost() > C.S.chips; };
};

let crateBusy = false;
async function openCrate(free = false) {
  if (crateBusy) return;
  const cost = C.crateCost();
  if (!free) {
    if (C.S.chips < cost) { toast('Not enough chips for a crate.', 'bad'); sfx('nope'); return; }
    C.S.chips -= cost; C.S.cratesBought++;
  }
  crateBusy = true;
  const prize = C.rollCharm();
  C.S.stats.crates++;
  // build reel
  const reel = Array.from({ length: 40 }, () => C.rollCharm());
  reel[34] = prize;
  modal(`
    <h2>Opening crate…</h2>
    <div class="reel-window"><div class="reel-strip" id="reel">${reel.map(c => `<div class="reel-item" style="--rc:${C.rarity(c.r).color}">${c.icon}</div>`).join('')}</div><div class="reel-marker"></div></div>
    <div id="crate-result" class="crate-result"></div>`, false);
  const strip = $('#reel');
  await new Promise(r => setTimeout(r, 40));
  const item = strip.children[0].getBoundingClientRect().width + 8;
  const view = strip.parentElement.getBoundingClientRect().width;
  const off = 34 * item - view / 2 + item / 2 + (Math.random() - 0.5) * item * 0.5;
  strip.style.transition = C.S.settings.motion ? 'transform 4s cubic-bezier(.1,.7,.15,1)' : 'none';
  strip.style.transform = `translateX(${-off}px)`;
  sfx('spin');
  await new Promise(r => setTimeout(r, C.S.settings.motion ? 4100 : 80));
  const res = C.grantCharm(prize);
  const r = C.rarity(prize.r);
  strip.children[34].classList.add('won');
  $('#crate-result').innerHTML = `
    <div class="won-charm" style="--rc:${r.color}"><span class="ci">${prize.icon}</span>
    <div><b>${esc(prize.name)}</b><div style="color:${r.color}">${r.name}</div>
    <div>${res.maxed ? 'Already maxed — melted into ' + M(cost * 0.5) : res.isNew ? 'New charm! ' + effectText(prize, 1) : `Levelled up to ${res.level} · ${effectText(prize, res.level)}`}</div></div></div>
    <div class="modal-actions"><button class="btn-ghost" id="m-close">Close</button><button class="btn-play" id="m-again">Open another (${M(C.crateCost())})</button></div>`;
  if (res.maxed) C.earn(cost * 0.5);
  if (prize.r === 'L' || prize.r === 'E') { sfx('big'); confetti(prize.r === 'L' ? 150 : 60); } else sfx('win');
  crateBusy = false;
  achievements(); refresh();
  $('#m-close').addEventListener('click', () => { closeModal(); if (tab === 'crates') render(); });
  $('#m-again').addEventListener('click', () => { closeModal(); openCrate(); });
  $('#m-again').disabled = C.crateCost() > C.S.chips;
}

// ── Venues ───────────────────────────────────────────────────────────────────
PANELS.venues = () => `
  <div class="panel-head"><div><h2>🗺️ Venues</h2><p class="muted">Bigger rooms, bigger tables, bigger multipliers. Each venue unlocks new games and multiplies all winnings.</p></div></div>
  <div class="venues">
    ${VENUES.map((v, i) => {
      const owned = C.S.venue >= i, next = i === C.S.venue + 1;
      const games = GAMES.filter(g => g.venue === i);
      return `<div class="venue ${owned ? 'owned' : ''} ${next ? 'next' : ''} ${i === C.S.venue ? 'current' : ''}">
        <div class="v-icon">${owned || next ? v.icon : '🔒'}</div>
        <div class="v-info"><h3>${owned || next ? esc(v.name) : '???'}</h3>
          <p class="muted">${owned || next ? esc(v.blurb) : 'Keep climbing.'}</p>
          <div class="v-stats"><span>Table limit <b>${M(v.maxBet)}</b></span><span>Winnings <b>×${v.mult}</b></span>${games.length ? `<span>Unlocks ${games.map(g => g.icon + ' ' + g.name).join(', ')}</span>` : ''}</div>
        </div>
        ${owned ? `<span class="v-tag">${i === C.S.venue ? 'You are here' : 'Unlocked'}</span>` : next ? `<button class="btn-play" data-venue="${i}">Move in<br><b>${M(v.cost)}</b></button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
MOUNT.venues = main => {
  main.querySelectorAll('[data-venue]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.venue;
    if (C.buyVenue(i)) { sfx('big'); confetti(80); toast(`${VENUES[i].icon} Welcome to <b>${VENUES[i].name}</b>!`, 'big'); achievements(); refresh(); render(); }
    else { sfx('nope'); toast('Not enough chips.', 'bad'); }
  }));
  liveUpdate = () => main.querySelectorAll('[data-venue]').forEach(b => { b.disabled = C.S.chips < VENUES[+b.dataset.venue].cost; });
};

// ── Vinnie the loan shark ────────────────────────────────────────────────────
PANELS.vinnie = () => {
  const L = C.S.loan, limit = C.loanLimit();
  return `
  <div class="panel-head"><div><h2>🦈 Vinnie</h2><p class="muted">"Short on chips, pal? I'm a reasonable guy. Within reason."</p></div></div>
  <div class="vinnie">
    <div class="v-card">
      <div class="v-row"><span>You owe</span><b id="v-debt">${M(L.debt)}</b></div>
      <div class="v-row"><span>Credit line</span><b id="v-limit">${M(limit)}</b></div>
      <div class="v-row"><span>Interest</span><b>${(C.loanRatePerMin() * 100).toFixed(2)}% per minute</b></div>
      <div class="v-row"><span>Due</span><b id="v-due">${L.debt ? (L.garnish ? 'Overdue — taking half your income' : C.duration((L.deadline - Date.now()) / 1000)) : `${C.LOAN_TERM_MIN} min after borrowing`}</b></div>
    </div>
    <div class="v-actions">
      <div class="v-group"><span class="muted">Borrow</span>
        ${[0.1, 0.25, 0.5, 1].map(p => `<button class="btn-ghost" data-borrow="${p}">${p * 100}%</button>`).join('')}
      </div>
      <div class="v-group"><span class="muted">Repay</span>
        ${[0.25, 0.5, 1].map(p => `<button class="btn-ghost" data-repay="${p}">${p === 1 ? 'All' : p * 100 + '%'}</button>`).join('')}
      </div>
    </div>
    <p class="muted small">If you don't pay by the deadline, Vinnie comes to collect: he takes the chips you have, and until the rest is paid half of your casino income goes straight to him.</p>
  </div>`;
};
MOUNT.vinnie = main => {
  main.querySelectorAll('[data-borrow]').forEach(b => b.addEventListener('click', () => {
    const room = C.loanLimit() - C.S.loan.debt;
    const amt = Math.floor(room * +b.dataset.borrow);
    if (C.borrow(amt)) { sfx('cash'); toast(`🦈 "Pleasure doing business." <b>+${M(amt)}</b>`); achievements(); refresh(); render(); }
    else { sfx('nope'); toast('"You\'re tapped out, pal."', 'bad'); }
  }));
  main.querySelectorAll('[data-repay]').forEach(b => b.addEventListener('click', () => {
    const amt = C.repay(C.S.loan.debt * +b.dataset.repay);
    if (amt) { sfx('buy'); toast(`Paid Vinnie ${M(amt)}.`); refresh(); render(); }
    else sfx('nope');
  }));
  liveUpdate = () => {
    const L = C.S.loan;
    $('#v-debt').textContent = M(L.debt);
    $('#v-due').textContent = L.debt ? (L.garnish ? 'Overdue — taking half your income' : C.duration((L.deadline - Date.now()) / 1000)) : `${C.LOAN_TERM_MIN} min after borrowing`;
  };
};

// ── Daily wheel ──────────────────────────────────────────────────────────────
const wheelReward = w => {
  const ipm = C.incomePerSec() * 60;
  const floor = VENUES[C.S.venue].maxBet * 0.5;
  return Math.max(ipm * w.amount, floor * Math.sqrt(w.amount));
};
PANELS.wheel = () => {
  const seg = 360 / WHEEL.length;
  const grad = WHEEL.map((w, i) => `${w.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  const ready = Date.now() - C.S.lastWheel >= 864e5;
  return `
  <div class="panel-head"><div><h2>🎡 Daily Wheel</h2><p class="muted">One free spin every 24 hours. Prizes grow with your casino.</p></div></div>
  <div class="wheel-wrap">
    <div class="wheel-pointer">▼</div>
    <div class="wheel" id="wheel" style="background:conic-gradient(${grad})">
      ${WHEEL.map((w, i) => `<span class="wl" style="transform:rotate(${i * seg + seg / 2}deg)"><i>${w.label}</i></span>`).join('')}
    </div>
  </div>
  <div class="center"><button class="btn-play big" id="spin-wheel" ${ready ? '' : 'disabled'}>${ready ? 'SPIN' : 'Next spin in <span id="wheel-wait"></span>'}</button></div>`;
};
let wheelRot = 0;
MOUNT.wheel = () => {
  const btn = $('#spin-wheel');
  btn.addEventListener('click', async () => {
    if (Date.now() - C.S.lastWheel < 864e5) return;
    C.S.lastWheel = Date.now(); C.S.stats.wheel++; btn.disabled = true; C.save();
    const prize = C.weighted(WHEEL);
    const i = WHEEL.indexOf(prize), seg = 360 / WHEEL.length;
    wheelRot += 360 * 6 + (360 - (i * seg + seg / 2)) - (wheelRot % 360);
    const w = $('#wheel');
    w.style.transition = C.S.settings.motion ? 'transform 5s cubic-bezier(.15,.8,.2,1)' : 'none';
    w.style.transform = `rotate(${wheelRot}deg)`;
    sfx('spin');
    await new Promise(r => setTimeout(r, C.S.settings.motion ? 5100 : 60));
    if (prize.kind === 'income') { const amt = wheelReward(prize); C.earn(amt); toast(`🎡 You won <b>${M(amt)}</b>!`, 'big'); }
    if (prize.kind === 'xp') { const lvl = C.S.level; C.addXp(0, C.xpNeeded(C.S.level)); toast(`🎡 A whole level of XP! (${lvl} → ${C.S.level})`, 'big'); }
    if (prize.kind === 'ace') { C.S.aces += 1; toast('🎡 A free <b>Ace</b>!', 'big'); }
    sfx('big'); confetti(80); achievements(); refresh();
    if (prize.kind === 'crate') { for (let k = 0; k < prize.amount; k++) await openCrate(true); }
    if (tab === 'wheel') render();
  });
  liveUpdate = () => { const el = $('#wheel-wait'); if (el) el.textContent = C.duration((C.S.lastWheel + 864e5 - Date.now()) / 1000); };
};

// ── Prestige ─────────────────────────────────────────────────────────────────
PANELS.prestige = () => {
  const gain = C.acesOnFold();
  return `
  <div class="panel-head"><div><h2>🂡 Fold Everything</h2><p class="muted">Walk away from it all — chips, businesses, venues — and come back with Aces. Aces buy permanent upgrades. You keep charms, achievements, level and stats.</p></div></div>
  <div class="fold-card">
    <div><div class="muted">You have</div><div class="big-num">🂡 ${C.S.aces}</div></div>
    <div><div class="muted">Folding now gives</div><div class="big-num gold" id="fold-gain">+${gain}</div><div class="muted small">Based on ${M(C.S.runEarned)} earned this run · next Ace at ${M((gain + 1) ** 2 * 1e6)}</div></div>
    <button class="btn-danger" id="fold" ${gain < 1 ? 'disabled' : ''}>Fold</button>
  </div>
  <div class="ace-shop">
    ${ACE_SHOP.map(u => {
      const lvl = C.aceLvl(u.id), maxed = lvl >= u.max, cost = C.aceCost(u);
      return `<div class="ace-up ${maxed ? 'maxed' : ''}">
        <div class="au-icon">${u.icon}</div>
        <div class="au-info"><b>${u.name}</b> <span class="muted">Lv ${lvl}/${u.max}</span><div class="muted small">${u.desc(lvl)}${maxed ? '' : ' → ' + u.desc(lvl + 1)}</div></div>
        <button class="btn-ghost" data-ace="${u.id}" ${maxed || C.S.aces < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `🂡 ${cost}`}</button>
      </div>`;
    }).join('')}
  </div>`;
};
MOUNT.prestige = main => {
  $('#fold').addEventListener('click', () => {
    const gain = C.acesOnFold();
    if (gain < 1) return;
    if (!confirm(`Fold everything for ${gain} Ace${gain > 1 ? 's' : ''}? Your chips, businesses and venues reset.`)) return;
    if (activeGame) { GAME_UI[activeGame]?.destroy?.(); activeGame = null; }
    C.fold(); C.save(); sfx('big'); confetti(150);
    toast(`🂡 You folded for <b>${gain}</b> Ace${gain > 1 ? 's' : ''}. A fresh start.`, 'big');
    achievements(); refresh(); render();
  });
  main.querySelectorAll('[data-ace]').forEach(b => b.addEventListener('click', () => {
    const u = ACE_SHOP.find(x => x.id === b.dataset.ace);
    if (C.buyAce(u)) { sfx('level'); refresh(); render(); } else sfx('nope');
  }));
  liveUpdate = () => { const g = $('#fold-gain'); if (g) g.textContent = '+' + C.acesOnFold(); const f = $('#fold'); if (f) f.disabled = C.acesOnFold() < 1; };
};

// ── Achievements ─────────────────────────────────────────────────────────────
PANELS.ach = () => {
  const n = Object.keys(C.S.ach).length;
  return `
  <div class="panel-head"><div><h2>🏆 Achievements <span class="muted">${n}/${ACHIEVEMENTS.length}</span></h2><p class="muted">Each one gives +2% to all winnings and casino income. Currently <b>+${n * 2}%</b>.</p></div></div>
  <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${C.S.ach[a.id] ? 'got' : ''}"><span>${C.S.ach[a.id] ? '🏆' : '🔒'}</span><div><b>${esc(a.name)}</b><div class="muted small">${esc(a.desc)}</div></div></div>`).join('')}</div>`;
};

// ── Stats ────────────────────────────────────────────────────────────────────
PANELS.stats = () => {
  const s = C.S.stats;
  const rows = [
    ['Bets placed', C.fmt(s.bets)], ['Total wagered', M(s.wagered)], ['Total won', M(s.won)], ['Total lost', M(s.lost)],
    ['Net from gambling', M(s.won - s.lost)], ['Biggest win', M(s.biggestWin)], ['Best multiplier', s.bestMult.toFixed(2) + '×'],
    ['Best win streak', s.bestStreak], ['Worst losing streak', s.worstStreak], ['Crates opened', s.crates], ['Golden chips', s.golden],
    ['Earned this run', M(C.S.runEarned)], ['Earned all time', M(C.S.allTimeEarned)], ['Folds', C.S.prestiges], ['Time played', C.duration(s.played)],
  ];
  return `
  <div class="panel-head"><div><h2>📊 Stats</h2></div></div>
  <div class="stats-grid">${rows.map(([k, v]) => `<div class="stat"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}</div>
  <h3 class="sub">By game</h3>
  <div class="stats-grid">${GAMES.map(g => { const p = s.perGame[g.id] || { bets: 0, net: 0 };
    return `<div class="stat"><span class="muted">${g.icon} ${g.name}</span><b class="${p.net >= 0 ? 'g' : 'r'}">${p.net >= 0 ? '+' : '−'}${M(Math.abs(p.net))}</b><span class="muted small">${C.fmt(p.bets)} bets</span></div>`; }).join('')}</div>`;
};

// ── Settings ─────────────────────────────────────────────────────────────────
PANELS.settings = () => `
  <div class="panel-head"><div><h2>⚙️ Settings</h2><p class="muted">The game saves itself every few seconds in this browser.</p></div></div>
  <div class="settings">
    <label class="toggle"><input type="checkbox" id="set-sound" ${C.S.settings.sound ? 'checked' : ''}/> Sound effects</label>
    <label class="toggle"><input type="checkbox" id="set-motion" ${C.S.settings.motion ? 'checked' : ''}/> Animations</label>
    <div class="set-block">
      <h3>Backup your save</h3>
      <p class="muted small">Copy this code somewhere safe to move your game to another browser or device.</p>
      <div class="row"><button class="btn-ghost" id="exp">Export save</button><button class="btn-ghost" id="imp">Import save</button><button class="btn-ghost" id="dl">Download file</button></div>
      <textarea id="save-code" rows="4" placeholder="Your save code will appear here, or paste one to import."></textarea>
    </div>
    <div class="set-block danger"><h3>Danger zone</h3><button class="btn-danger" id="wipe">Delete save and start over</button></div>
    <p class="muted small">All chips are fake. No real money, ever. If gambling stops being a game for you, help is available — in Italy call 800 558 822 (Telefono Verde Gioco d'Azzardo).</p>
  </div>`;
MOUNT.settings = () => {
  $('#set-sound').addEventListener('change', e => { C.S.settings.sound = e.target.checked; C.save(); });
  $('#set-motion').addEventListener('change', e => { C.S.settings.motion = e.target.checked; document.body.classList.toggle('still', !e.target.checked); C.save(); });
  $('#exp').addEventListener('click', () => { const t = $('#save-code'); t.value = C.exportSave(); t.select(); navigator.clipboard?.writeText(t.value).then(() => toast('Save code copied to clipboard.'), () => {}); });
  $('#dl').addEventListener('click', () => {
    const blob = new Blob([C.exportSave()], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gambling-ecosystem-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#imp').addEventListener('click', () => {
    const code = $('#save-code').value; if (!code.trim()) { toast('Paste a save code first.', 'bad'); return; }
    try { C.importSave(code); toast('Save imported!', 'big'); refresh(); setTab('floor'); }
    catch { toast('That save code is not valid.', 'bad'); }
  });
  $('#wipe').addEventListener('click', () => {
    if (!confirm('Really delete everything and start over? This cannot be undone.')) return;
    if (!confirm('Last chance. Delete your save?')) return;
    C.hardReset(); refresh(); setTab('floor'); toast('Fresh start. Good luck.');
  });
};

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL
// ═════════════════════════════════════════════════════════════════════════════
function modal(html, closable = true) {
  $('#modal-body').innerHTML = html;
  $('#modal').hidden = false;
  $('#modal').dataset.closable = closable ? '1' : '';
  delete $('#modal').dataset.inc;
}
function closeModal() { $('#modal').hidden = true; delete $('#modal').dataset.inc; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && $('#modal').dataset.closable) closeModal(); });

// ═════════════════════════════════════════════════════════════════════════════
//  GOLDEN CHIP
// ═════════════════════════════════════════════════════════════════════════════
let nextGolden = Date.now() + 60e3 + Math.random() * 120e3;
function spawnGolden() {
  const g = document.createElement('button');
  g.className = 'golden'; g.textContent = '🪙'; g.setAttribute('aria-label', 'Golden chip');
  g.style.top = (15 + Math.random() * 65) + 'vh';
  document.body.appendChild(g);
  const kill = setTimeout(() => g.remove(), 13000);
  g.addEventListener('click', () => {
    clearTimeout(kill); g.remove();
    C.S.stats.golden++;
    const r = C.weighted(GOLDEN);
    if (r.kind === 'cash') {
      const amt = Math.max(C.incomePerSec() * 600, Math.min(C.S.chips * 0.15, C.incomePerSec() * 3600 + VENUES[C.S.venue].maxBet * 2), 50);
      C.earn(amt); toast(`🪙 Golden chip! <b>+${M(amt)}</b>`, 'big');
    } else if (r.kind === 'frenzy') { C.addBuff('frenzy', 7, 40, '🔥 Income ×7'); toast('🪙 <b>Frenzy!</b> Casino income ×7 for 40s.', 'big'); }
    else if (r.kind === 'lucky') { C.addBuff('luck', 15, 45, '🍀 +15% luck'); toast('🪙 <b>Lucky streak!</b> +15% luck for 45s.', 'big'); }
    else { openCrate(true); }
    sfx('big'); achievements(); refresh();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOOP
// ═════════════════════════════════════════════════════════════════════════════
let last = performance.now(), saveTimer = 0, secTimer = 0;
function loop(now) {
  const dt = Math.min(1, (now - last) / 1000); last = now;
  const S = C.S;
  // income (garnished by Vinnie if overdue)
  const inc = C.incomePerSec() * dt;
  if (inc > 0) {
    if (S.loan.garnish && S.loan.debt > 0) {
      const cut = Math.min(inc / 2, S.loan.debt);
      S.loan.debt -= cut; C.earn(inc - cut);
      if (S.loan.debt < 0.5) { S.loan = { debt: 0, principal: 0, takenAt: 0, deadline: 0, garnish: false }; toast('🦈 "We\'re square." Vinnie leaves you alone.'); }
    } else C.earn(inc);
  }
  // interest
  if (S.loan.debt > 0) S.loan.debt *= (1 + C.loanRatePerMin()) ** (dt / 60);
  C.tickSim(dt);
  S.stats.played += dt;
  secTimer += dt; saveTimer += dt;
  if (secTimer >= 0.25) {
    secTimer = 0;
    if (S.loan.debt > 0 && !S.loan.garnish && Date.now() > S.loan.deadline) collect();
    C.pruneBuffs();
    incidents();
    if (Date.now() > nextGolden && !document.hidden) { spawnGolden(); nextGolden = Date.now() + 90e3 + Math.random() * 180e3; }
    achievements();
    refresh();
  }
  if (saveTimer >= 5) { saveTimer = 0; C.save(); }
  requestAnimationFrame(loop);
}

// ── Incidents ────────────────────────────────────────────────────────────────
function incidents() {
  const def = INC.maybeSpawn();
  if (def) { sfx(def.id === 'robbery' ? 'boom' : 'cash'); toast(`${def.icon} <b>${esc(def.title)}</b> — click the alert up top to decide.`, 'bad'); }
  if (C.S.sim.pending && INC.autoResolveIn() <= 0) {
    if (!$('#modal').hidden && $('#modal').dataset.inc) closeModal();
    finishIncident(-1, true);
  }
}
function openIncident() {
  const p = C.S.sim.pending;
  if (!p) return;
  const d = INC.incidentDef(p.id);
  modal(`<div class="inc-modal"><div class="inc-icon">${d.icon}</div><h2>${esc(d.title)}</h2>
    <p>${esc(d.text)}</p>
    <div class="inc-choices">${INC.CHOICES[p.id].map((c, i) => {
      const ok = !c.ok || c.ok();
      return `<button class="inc-choice" data-ch="${i}" ${ok ? '' : 'disabled'}><b>${esc(c.label)}</b><small>${esc(c.hint())}</small></button>`;
    }).join('')}</div>
    <p class="muted small">If you don't decide in ${Math.ceil(INC.autoResolveIn())}s, your manager picks the safe option.</p></div>`);
  $('#modal').dataset.inc = '1';
  $('#modal-body').querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { closeModal(); finishIncident(+b.dataset.ch); }));
}
function finishIncident(i, auto = false) {
  const r = INC.resolve(i);
  if (!r) return;
  const good = r.good;
  sfx(good ? 'win' : 'lose');
  toast(`${r.def.icon} ${auto ? '<i>Manager decided:</i> ' : ''}${esc(r.text)}`, good ? 'big' : 'bad');
  const log = $('#inc-log'); if (log) log.innerHTML = incidentLogHtml();
  achievements(); refresh();
}

function collect() {
  const L = C.S.loan;
  const take = Math.min(C.S.chips, L.debt);
  C.S.chips -= take; L.debt -= take;
  C.S.stats.collected++;
  if (L.debt < 0.5) { C.S.loan = { debt: 0, principal: 0, takenAt: 0, deadline: 0, garnish: false }; }
  else L.garnish = true;
  sfx('boom');
  modal(`<h2>🦈 Vinnie came to collect.</h2>
    <p>He took <b>${M(take)}</b> off the table${L.garnish ? `, and until you pay the remaining <b>${M(L.debt)}</b>, half of your casino income goes to him` : ''}.</p>
    <p class="muted">"Nothing personal. Business is business."</p>
    <div class="modal-actions"><button class="btn-play" onclick="document.getElementById('modal').hidden=true">Understood</button></div>`);
  achievements(); refresh();
}

// ═════════════════════════════════════════════════════════════════════════════
//  BOOT
// ═════════════════════════════════════════════════════════════════════════════
C.load();
initGames({ afterBet, toast, sfx, refresh });
document.body.classList.toggle('still', !C.S.settings.motion);

$('#nav').innerHTML = TABS.map(([id, icon, label]) => `<button data-tab="${id}"><span class="ni">${icon}</span><span class="nl">${label}</span></button>`).join('');
$('#alert').addEventListener('click', () => { sfx('tick'); openIncident(); });
$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) { sfx('tick'); setTab(b.dataset.tab); } });

// offline earnings
(() => {
  const away = (Date.now() - C.S.lastSeen) / 1000;
  const capH = 2 + C.mods().offline + C.aceLvl('sleep') * 2;
  const secs = Math.min(away, capH * 3600);
  const inc = C.incomePerSec();
  if (away > 60 && inc > 0) {
    const amt = inc * secs;
    C.earn(amt);
    modal(`<h2>👋 Welcome back</h2>
      <p>You were gone for <b>${C.duration(away)}</b>. Your casino kept the lights on and made <b>${M(amt)}</b>${away > secs ? ` (offline earnings are capped at ${capH}h)` : ''}.</p>
      <div class="modal-actions"><button class="btn-play" onclick="document.getElementById('modal').hidden=true">Collect</button></div>`);
  } else if (!C.S.stats.bets && !localStorage.getItem('ge-intro')) {
    modal(`<h2>🎲 Gambling Ecosystem</h2>
      <p>You have <b>$100</b>, a coin, and a dream. Win chips, buy a rigged gumball machine, build a casino empire, and climb from the Back Alley to The Void.</p>
      <ul class="intro-list">
        <li>🎰 <b>Casino Floor</b> — gamble. Wins earn XP and level you up.</li>
        <li>🏢 <b>Your Casino</b> — buy businesses that earn chips every second, even offline.</li>
        <li>🎁 <b>Crates</b> — charms that boost your winnings, income and luck.</li>
        <li>🪙 Click <b>golden chips</b> when they fly past.</li>
        <li>🂡 When the run slows down, <b>Fold</b> for permanent Aces.</li>
      </ul>
      <p class="muted small">All chips are fake. Progress saves automatically.</p>
      <div class="modal-actions"><button class="btn-play" onclick="document.getElementById('modal').hidden=true">Let's go</button></div>`);
    try { localStorage.setItem('ge-intro', '1'); } catch { /* ignore */ }
  }
})();

let startTab = 'floor';
try { startTab = localStorage.getItem('ge-tab') || 'floor'; } catch { /* ignore */ }
setTab(TABS.some(t => t[0] === startTab) ? startTab : 'floor');
refresh();
requestAnimationFrame(loop);
addEventListener('visibilitychange', () => { if (document.hidden) C.save(); });
addEventListener('beforeunload', () => {
  if (activeGame) GAME_UI[activeGame]?.destroy?.();
  C.save();
});

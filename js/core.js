// Core engine: state, saving, modifiers, money flow. No DOM here.
import {
  VENUES, GAMES, BUSINESSES, BIZ_GROWTH, BIZ_MILESTONES, CHARMS, RARITIES, CHARM_MAX_LEVEL,
  LUCK_CAP, ACE_DIVISOR, ACE_SHOP, ACHIEVEMENTS,
} from './data.js';

export const SAVE_KEY = 'gambling-ecosystem-save';
export const VERSION = 1;

// ── Helpers ──────────────────────────────────────────────────────────────────
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = () => Math.random();
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function weighted(list, key = 'weight') {
  const total = list.reduce((a, x) => a + x[key], 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x[key]; if (r <= 0) return x; }
  return list[list.length - 1];
}

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n, dec = 2) {
  if (n === Infinity) return '∞';
  if (!isFinite(n)) return '0';
  const neg = n < 0; n = Math.abs(n);
  let out;
  if (n < 1000) out = n < 10 && n % 1 ? n.toFixed(2) : Math.floor(n).toLocaleString('en-US');
  else {
    const tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
    if (tier >= SUFFIX.length - 1 && n >= 1e36) out = n.toExponential(2);
    else out = (n / 10 ** (tier * 3)).toFixed(dec).replace(/\.?0+$/, '') + SUFFIX[tier];
  }
  return (neg ? '-' : '') + out;
}
export const money = (n, dec) => '$' + fmt(n, dec);

export function parseAmount(str) {
  if (typeof str === 'number') return str;
  const m = String(str).trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d*\.?\d+)(k|m|b|t|qa|qi)?$/);
  if (!m) { const n = Number(str); return isFinite(n) ? n : NaN; }
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18 }[m[2]] || 1;
  return parseFloat(m[1]) * mult;
}

export function duration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

// ── State ────────────────────────────────────────────────────────────────────
function freshStats() {
  return {
    bets: 0, wagered: 0, won: 0, lost: 0, biggestWin: 0, bestMult: 0,
    streak: 0, bestStreak: 0, worstStreak: 0, loseStreak: 0,
    crates: 0, golden: 0, wheel: 0, loans: 0, collected: 0,
    bestCrash: 0, bestMinesTiles: 0, blackjacks: 0, zeroWins: 0, jackpots: 0,
    perGame: {}, played: 0, broke: 0,
  };
}

export function newState() {
  return {
    v: VERSION,
    chips: 100,
    runEarned: 0,          // earnings this run (drives aces)
    allTimeEarned: 0,
    aces: 0, prestiges: 0,
    xp: 0, level: 1,
    venue: 0,
    biz: {},
    charms: {}, equipped: [],
    cratesBought: 0,
    ace: {},
    loan: { debt: 0, principal: 0, takenAt: 0, deadline: 0, garnish: false },
    lastWheel: 0,
    ach: {},
    stats: freshStats(),
    buffs: [],
    bets: {},
    settings: { sound: true, motion: true },
    lastSeen: Date.now(),
    created: Date.now(),
    brokeAt: 0,
  };
}

export let S = newState();

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) S = migrate(JSON.parse(raw));
  } catch { S = newState(); }
  return S;
}

function migrate(data) {
  const base = newState();
  const s = { ...base, ...data };
  s.stats = { ...freshStats(), ...(data.stats || {}) };
  s.loan = { ...base.loan, ...(data.loan || {}) };
  s.settings = { ...base.settings, ...(data.settings || {}) };
  s.buffs = (data.buffs || []).filter(b => b.until > Date.now());
  s.v = VERSION;
  return s;
}

export function save() {
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch { return false; }
}

export function exportSave() {
  save();
  return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
}
export function importSave(code) {
  const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (typeof data !== 'object' || typeof data.chips !== 'number') throw new Error('Not a save code');
  S = migrate(data);
  save();
  return S;
}
export function hardReset() {
  S = newState();
  save();
  return S;
}

// ── Modifiers ────────────────────────────────────────────────────────────────
export const charmDef = id => CHARMS.find(c => c.id === id);
export const rarity = id => RARITIES.find(r => r.id === id);
export const aceLvl = id => S.ace[id] || 0;
export const charmSlots = () => 3 + aceLvl('pockets');

export function mods() {
  const m = { profit: { all: 0 }, luck: 0, idle: 0, xp: 0, offline: 0, loan: 0 };
  for (const id of S.equipped) {
    const c = charmDef(id); const lvl = S.charms[id] || 0;
    if (!c || !lvl) continue;
    const v = c.value * lvl;
    if (c.kind.startsWith('profit:')) { const g = c.kind.split(':')[1]; m.profit[g] = (m.profit[g] || 0) + v; }
    else m[c.kind] += v;
  }
  const achCount = Object.keys(S.ach).length;
  m.ach = achCount * 2;                    // +2% everything per achievement
  m.levelBonus = (S.level - 1) * 2;        // +2% winnings per level
  m.luck += aceLvl('lucky');
  for (const b of S.buffs) if (b.kind === 'luck' && b.until > Date.now()) m.luck += b.value;
  m.luck = Math.min(LUCK_CAP, m.luck);
  return m;
}

// Multiplier applied to the PROFIT part of a winning bet
export function profitMult(game) {
  const m = mods();
  const venue = VENUES[S.venue].mult;
  return venue
    * (1 + (m.profit.all + (m.profit[game] || 0)) / 100)
    * (1 + m.levelBonus / 100)
    * (1 + m.ach / 100)
    * (1 + aceLvl('stakes') * 0.25);
}

export const luck = () => mods().luck / 100;   // 0 … 0.25

// "Second chance": after a loss, re-roll with probability = luck
export const secondChance = () => Math.random() < luck();

// ── Businesses ───────────────────────────────────────────────────────────────
export const bizCount = id => S.biz[id] || 0;
export function bizCost(b, n = 1) {
  const owned = bizCount(b.id);
  // geometric sum for n purchases
  return b.cost * BIZ_GROWTH ** owned * (BIZ_GROWTH ** n - 1) / (BIZ_GROWTH - 1);
}
export function bizMaxAffordable(b) {
  const owned = bizCount(b.id);
  const k = b.cost * BIZ_GROWTH ** owned;
  return Math.max(0, Math.floor(Math.log(S.chips * (BIZ_GROWTH - 1) / k + 1) / Math.log(BIZ_GROWTH)));
}
export const bizMilestoneMult = id => 2 ** BIZ_MILESTONES.filter(m => bizCount(id) >= m).length;
export const nextMilestone = id => BIZ_MILESTONES.find(m => bizCount(id) < m);

export function idleMult() {
  const m = mods();
  let x = (1 + m.idle / 100) * (1 + m.ach / 100) * (1 + aceLvl('passive') * 0.25);
  for (const b of S.buffs) if (b.kind === 'frenzy' && b.until > Date.now()) x *= b.value;
  return x;
}
export function bizIncome(b) { return b.income * bizCount(b.id) * bizMilestoneMult(b.id); }
export function incomePerSec() {
  return BUSINESSES.reduce((a, b) => a + bizIncome(b), 0) * idleMult();
}

export function buyBiz(b, n = 1) {
  const cost = bizCost(b, n);
  if (n < 1 || cost > S.chips) return false;
  S.chips -= cost;
  S.biz[b.id] = bizCount(b.id) + n;
  return true;
}

// ── Money ────────────────────────────────────────────────────────────────────
export function earn(amount) {
  if (!(amount > 0)) return;
  S.chips += amount;
  S.runEarned += amount;
  S.allTimeEarned += amount;
}

export const maxBet = () => Math.min(VENUES[S.venue].maxBet, Math.max(0, Math.floor(S.chips)));
export const minBet = () => 1;

export function canBet(amount) {
  return amount >= minBet() && amount <= S.chips && amount <= VENUES[S.venue].maxBet;
}

// Take the stake. Returns false if not allowed.
export function stake(game, amount) {
  amount = Math.floor(amount);
  if (!canBet(amount)) return false;
  S.chips -= amount;
  S.bets[game] = amount;
  S.stats.wagered += amount;
  return true;
}

// Settle a bet: payoutX = total return as a multiple of the stake (0 = lost, 1 = push, 2 = even money win…)
// Returns { credited, profit, win }
export function settle(game, amount, payoutX) {
  const st = S.stats;
  st.bets++;
  const g = st.perGame[game] || (st.perGame[game] = { bets: 0, net: 0 });
  g.bets++;
  let credited = 0, profit = -amount;
  if (payoutX > 0) {
    const rawProfit = amount * (payoutX - 1);
    profit = rawProfit > 0 ? rawProfit * profitMult(game) : rawProfit;
    credited = amount + profit;
    S.chips += credited;
    if (profit > 0) { S.runEarned += profit; S.allTimeEarned += profit; }
  }
  g.net += profit;
  const win = profit > 0;
  if (win) {
    st.won += profit;
    st.biggestWin = Math.max(st.biggestWin, profit);
    st.bestMult = Math.max(st.bestMult, payoutX);
    st.streak++; st.loseStreak = 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
  } else if (profit < 0) {
    st.lost += -profit;
    st.loseStreak++; st.streak = 0;
    st.worstStreak = Math.max(st.worstStreak, st.loseStreak);
  }
  addXp(amount);
  return { credited, profit, win };
}

// ── XP / levels ──────────────────────────────────────────────────────────────
export const xpNeeded = lvl => Math.floor(40 * lvl ** 1.55);
let levelUpHook = () => {};
export const onLevelUp = fn => { levelUpHook = fn; };
export function addXp(bet, flat = 0) {
  const gain = (flat || (2 + Math.log10(bet + 1) * 2)) * (1 + mods().xp / 100);
  S.xp += gain;
  while (S.xp >= xpNeeded(S.level)) { S.xp -= xpNeeded(S.level); S.level++; levelUpHook(S.level); }
}

// ── Venues ───────────────────────────────────────────────────────────────────
export function buyVenue(i) {
  const v = VENUES[i];
  if (i !== S.venue + 1 || S.chips < v.cost) return false;
  S.chips -= v.cost;
  S.venue = i;
  return true;
}
export const gameUnlocked = g => S.venue >= g.venue;
export const gameDef = id => GAMES.find(g => g.id === id);

// ── Crates & charms ──────────────────────────────────────────────────────────
export function crateCost() {
  const base = VENUES[S.venue].crate;
  return Math.floor(base * 1.08 ** S.cratesBought * (1 - aceLvl('haggle') * 0.1));
}

// Better venues tilt crate odds toward rare charms
export function rollCharm() {
  const tilt = S.venue * 0.12;
  const weights = RARITIES.map((r, i) => ({ ...r, weight: r.weight * (1 + tilt * i) }));
  const r = weighted(weights);
  return pick(CHARMS.filter(c => c.r === r.id));
}

export function grantCharm(c) {
  const before = S.charms[c.id] || 0;
  const lvl = Math.min(CHARM_MAX_LEVEL, before + 1);
  S.charms[c.id] = lvl;
  // auto-equip if there is a free slot
  if (!before && S.equipped.length < charmSlots()) S.equipped.push(c.id);
  return { isNew: !before, level: lvl, maxed: before >= CHARM_MAX_LEVEL };
}

// ── Buffs ────────────────────────────────────────────────────────────────────
export function addBuff(kind, value, seconds, label) {
  S.buffs = S.buffs.filter(b => b.kind !== kind);
  S.buffs.push({ kind, value, until: Date.now() + seconds * 1000, label });
}
export function pruneBuffs() { S.buffs = S.buffs.filter(b => b.until > Date.now()); }

// ── Loan shark ───────────────────────────────────────────────────────────────
export const LOAN_TERM_MIN = 20;
export const loanLimit = () => Math.max(500, incomePerSec() * 600, S.runEarned * 0.05, VENUES[S.venue].maxBet * 2);
export const loanRatePerMin = () => 0.02 * (1 - Math.min(0.8, mods().loan / 100));

export function borrow(amount) {
  amount = Math.floor(amount);
  const room = loanLimit() - S.loan.debt;
  if (amount <= 0 || amount > room) return false;
  if (!S.loan.debt) { S.loan.takenAt = Date.now(); S.loan.deadline = Date.now() + LOAN_TERM_MIN * 60e3; }
  S.loan.debt += amount;
  S.loan.principal += amount;
  S.chips += amount;
  S.stats.loans++;
  return true;
}
export function repay(amount) {
  amount = Math.min(amount, S.loan.debt, S.chips);
  if (amount <= 0) return 0;
  S.chips -= amount;
  S.loan.debt -= amount;
  if (S.loan.debt < 0.5) S.loan = { debt: 0, principal: 0, takenAt: 0, deadline: 0, garnish: false };
  return amount;
}

// ── Prestige ─────────────────────────────────────────────────────────────────
export const acesOnFold = () => Math.floor(Math.sqrt(S.runEarned / ACE_DIVISOR));
export const aceCost = u => u.base * (aceLvl(u.id) + 1) ** 2;
export function buyAce(u) {
  const c = aceCost(u);
  if (aceLvl(u.id) >= u.max || S.aces < c) return false;
  S.aces -= c;
  S.ace[u.id] = aceLvl(u.id) + 1;
  return true;
}

export function fold() {
  const gain = acesOnFold();
  if (gain < 1) return 0;
  const keep = {
    aces: S.aces + gain, prestiges: S.prestiges + 1, ace: S.ace, charms: S.charms, equipped: S.equipped,
    ach: S.ach, stats: S.stats, settings: S.settings, allTimeEarned: S.allTimeEarned,
    level: S.level, xp: S.xp, lastWheel: S.lastWheel, created: S.created,
  };
  S = { ...newState(), ...keep };
  S.chips = 100 * 10 ** aceLvl('seed');
  S.venue = aceLvl('vip');
  return gain;
}

// ── Achievements ─────────────────────────────────────────────────────────────
export function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.check(S)) { S.ach[a.id] = Date.now(); fresh.push(a); }
  return fresh;
}

export { BUSINESSES, VENUES, GAMES, CHARMS, ACE_SHOP, ACHIEVEMENTS };

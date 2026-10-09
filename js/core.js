// Core engine: state, saving, modifiers, money flow. No DOM here.
import {
  VENUES, GAMES, BUSINESSES, BIZ_GROWTH, BIZ_MILESTONES, CHARMS, RARITIES, CHARM_MAX_LEVEL,
  LUCK_CAP, ACE_DIVISOR, ACE_SHOP, ACHIEVEMENTS,
  STAFF, UPGRADES, BIZ_UPGRADE_TIERS, EDGE_MIN, EDGE_MAX, EDGE_DEFAULT,
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
    sim: freshSim(),
  };
}
function freshSim() {
  return { rep: 50, edge: EDGE_DEFAULT, staff: {}, upgrades: {}, nextIncident: Date.now() + 120e3, incidents: 0 };
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
  s.sim = { ...freshSim(), ...(data.sim || {}) };
  s.sim.staff = { ...(s.sim.staff || {}) }; s.sim.upgrades = { ...(s.sim.upgrades || {}) };
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

// Charm Amplifier (Fold shop): the chosen charm's effect is multiplied.
export const charmAmp = id => (S.spotlight === id && aceLvl('spotlight') > 0) ? 1 + aceLvl('spotlight') : 1;
// Instant Roll (Fold shop): 1 = no animation, 2 adds ×10, 3 adds ×50.
export const bulkSizes = () => [aceLvl('instaroll') >= 2 && 10, aceLvl('instaroll') >= 3 && 50].filter(Boolean);

export function mods() {
  const m = { profit: { all: 0 }, luck: 0, idle: 0, xp: 0, offline: 0, loan: 0 };
  for (const id of S.equipped) {
    const c = charmDef(id); const lvl = S.charms[id] || 0;
    if (!c || !lvl) continue;
    const v = c.value * lvl * charmAmp(id);
    if (c.kind.startsWith('profit:')) { const g = c.kind.split(':')[1]; m.profit[g] = (m.profit[g] || 0) + v; }
    else m[c.kind] += v;
  }
  for (const u of ownedUpgrades()) {
    if (u.kind.startsWith('profit:')) { const g = u.kind.split(':')[1]; m.profit[g] = (m.profit[g] || 0) + u.value; }
    else if (u.kind === 'luck') m.luck += u.value;
    else if (u.kind === 'offline') m.offline += u.value;
  }
  const achCount = Object.keys(S.ach).length;
  m.ach = achCount * 2;                    // +2% everything per achievement
  m.levelBonus = (S.level - 1) * 2;        // +2% winnings per level
  m.luck += aceLvl('lucky');
  for (const b of S.buffs) if (b.kind === 'luck' && b.until > Date.now()) m.luck += b.value;
  m.luck = Math.min(LUCK_CAP, m.luck * (1 + aceLvl('fortune') * 0.5) * (S.ach.all ? 1.25 : 1));
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
    * (1 + aceLvl('stakes') * 0.25)
    * (S.ach.all ? COMPLETION_MULT : 1);
}

export const luck = () => mods().luck / 100;   // 1.0 = 100%, up to LUCK_CAP

// "Second chance": after a loss, re-roll with probability = luck
export const secondChance = () => Math.random() < luck();
// Luck above 100% stacks: 250% = 2 guaranteed re-rolls + a 50% chance of a third.
export function retries() {
  const l = Math.min(luck(), 20);
  return Math.floor(l) + (Math.random() < l % 1 ? 1 : 0);
}

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
export const bizMilestoneMult = id => 2 ** BIZ_MILESTONES.filter(m => bizCount(id) >= m).length
  * 2 ** BIZ_UPGRADE_TIERS.filter((_, t) => S.sim.upgrades[`biz:${id}:${t}`]).length;
export const nextMilestone = id => BIZ_MILESTONES.find(m => bizCount(id) < m);

export function idleMult() {
  const m = mods();
  let x = (1 + m.idle / 100) * (1 + m.ach / 100) * (1 + aceLvl('passive') * 0.25) * (S.ach.all ? COMPLETION_MULT : 1);
  for (const b of S.buffs) if (['frenzy', 'outage', 'rush'].includes(b.kind) && b.until > Date.now()) x *= b.value;
  return x;
}
export function bizIncome(b) { return b.income * bizCount(b.id) * bizMilestoneMult(b.id); }

// ── Casino sim ───────────────────────────────────────────────────────────────
export const staffCount = id => S.sim.staff[id] || 0;
export const totalStaff = () => Object.values(S.sim.staff).reduce((a, b) => a + b, 0);
export const upgSum = kind => ownedUpgrades().filter(u => u.kind === kind).reduce((a, u) => a + u.value, 0);
export const guards = () => staffCount('security') + upgSum('security');

export function allUpgrades() {
  const gen = [];
  for (const b of BUSINESSES) BIZ_UPGRADE_TIERS.forEach((t, i) => gen.push({
    id: `biz:${b.id}:${i}`, name: `${b.name}: ${t.label}`, icon: b.icon, cost: b.cost * t.costMult,
    kind: 'biz', biz: b.id, need: t.need, tier: i, desc: `${b.name} income ×2. Needs ${t.need} owned.`,
  }));
  return [...UPGRADES, ...gen];
}
export function ownedUpgrades() { return allUpgrades().filter(u => S.sim.upgrades[u.id]); }
export const upgradeAvailable = u => u.kind !== 'biz' || bizCount(u.biz) >= u.need;
export function buyUpgrade(u) {
  if (S.sim.upgrades[u.id] || !upgradeAvailable(u) || S.chips < u.cost) return false;
  S.chips -= u.cost; S.sim.upgrades[u.id] = Date.now();
  return true;
}

export const repTarget = () => {
  const c = staffCount('cleaner');
  const t = 45 + (4 * c - 0.15 * c * c) + staffCount('bartender') * 2 + staffCount('singer') * 3 + upgSum('rep')
    - (S.sim.edge - EDGE_DEFAULT) * 6;
  return clamp(t, 0, 100);
};
export const repMult = () => 0.5 + S.sim.rep / 100;                       // 0.5 … 1.5
export const edgeMult = () => 1 + (S.sim.edge - EDGE_DEFAULT) * 0.12;      // 0.52 … 2.2
export const seats = () => Math.max(1, Object.values(S.biz).reduce((a, b) => a + b, 0));
export function visitors() {
  const base = 8 + seats() * 1.2;
  const boost = 1 + staffCount('promoter') * 0.12 + staffCount('singer') * 0.08 + upgSum('visitors') / 100;
  return Math.round(base * Math.pow(Math.max(0.01, S.sim.rep) / 50, 1.5) * boost);
}
export const occupancy = () => Math.min(1, visitors() / seats());
export const occMult = () => 0.4 + 0.6 * occupancy();
export const staffMult = () => 1 + staffCount('dealer') * 0.04 + staffCount('bartender') * 0.03;
export const salaryRate = () => STAFF.reduce((a, st) => a + staffCount(st.id) * st.salary, 0) / 100 * (1 - upgSum('salary') / 100);

export function grossIncome() {
  return BUSINESSES.reduce((a, b) => a + bizIncome(b), 0) * idleMult()
    * (1 + upgSum('income') / 100) * staffMult() * repMult() * edgeMult() * occMult();
}
export const salaries = () => grossIncome() * salaryRate();
export function incomePerSec() { return grossIncome() - salaries(); }

export const hireCost = st => Math.floor(Math.max(st.hire * grossIncome(), 150) * 1.2 ** staffCount(st.id));
export function hire(st) {
  const c = hireCost(st);
  if (staffCount(st.id) >= st.max || S.chips < c) return false;
  S.chips -= c; S.sim.staff[st.id] = staffCount(st.id) + 1;
  return true;
}
export function fire(st) {
  if (!staffCount(st.id)) return false;
  S.sim.staff[st.id]--; return true;
}
export function addRep(d) { S.sim.rep = clamp(S.sim.rep + d, 0, 100); }
export function simLog(icon, text) {
  (S.sim.log ||= []).unshift({ icon, text, at: Date.now() });
  S.sim.log.length = Math.min(S.sim.log.length, 8);
  S.sim.incidents = (S.sim.incidents || 0) + 1;
}
export function setEdge(v) { S.sim.edge = clamp(Math.round(v), EDGE_MIN, EDGE_MAX); }
export function tickSim(dt) {
  const t = repTarget(), r = S.sim.rep;
  const step = 0.25 * dt;                          // reputation drifts ~1 point every 4s
  S.sim.rep = r < t ? Math.min(t, r + step) : Math.max(t, r - step);
}
export const tableMult = () => ownedUpgrades().filter(u => u.kind === 'tablelimit').reduce((a, u) => a * u.value, 1);
export const tableLimit = () => VENUES[S.venue].maxBet * tableMult();

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

export const maxBet = () => Math.min(tableLimit(), Math.max(0, Math.floor(S.chips)));
export const minBet = () => 1;

export function canBet(amount) {
  return amount >= minBet() && amount <= S.chips && amount <= tableLimit();
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
  const tilt = S.venue * 0.12 + aceLvl('charmluck') * 0.35;
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
export const loanLimit = () => Math.max(500, incomePerSec() * 600, S.runEarned * 0.05, tableLimit() * 2);
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
    level: S.level, xp: S.xp, lastWheel: S.lastWheel, created: S.created, spotlight: S.spotlight,
  };
  S = { ...newState(), ...keep };
  S.chips = 100 * 10 ** aceLvl('seed');
  S.venue = aceLvl('vip');
  return gain;
}

// ── Achievements ─────────────────────────────────────────────────────────────
// Completionist (every other achievement): permanent ×2 winnings & income, ×1.25 luck, a one-time Ace gift. Survives Folds.
export const COMPLETION_MULT = 2;
export const COMPLETION_ACES = 100;
export const completionist = () => !!S.ach.all;
export function grantCompletion() { S.aces += COMPLETION_ACES; }

export function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.check(S)) { S.ach[a.id] = Date.now(); fresh.push(a); }
  return fresh;
}

export { BUSINESSES, VENUES, GAMES, CHARMS, ACE_SHOP, ACHIEVEMENTS, STAFF, EDGE_MIN, EDGE_MAX };

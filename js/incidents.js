// Random casino incidents: each one offers a few choices with real consequences.
import * as C from './core.js';
import { INCIDENTS } from './data.js';

const chance = p => Math.random() < p;
const G = () => Math.max(50, C.grossIncome() * 60);   // "one minute of gross income"
const M = C.money;
function gain(x) { C.earn(x); return `+${M(x)}`; }
function lose(x) { x = Math.min(C.S.chips, x); C.S.chips -= x; return `−${M(x)}`; }
const rep = d => { C.addRep(d); return `reputation ${d > 0 ? '+' : '−'}${Math.abs(d)}`; };
const guards = () => C.guards();
const pctTxt = p => Math.round(p * 100) + '%';

// Every choice: label, hint (shown before you pick) and run() → result text.
export const CHOICES = {
  whale: [
    { label: 'Private table', hint: () => '55% to win big, 45% he cleans you out a bit.',
      run: () => chance(0.55) ? `The whale lost. ${gain(20 * G())}.` : `The whale won. ${lose(10 * G())}.` },
    { label: 'Comp him a suite', hint: () => `Costs ${M(3 * G())}. Reputation +8.`,
      run: () => `He tells all his friends. ${lose(3 * G())}, ${rep(8)}.` },
    { label: 'Ignore him', passive: true, hint: () => 'Nothing happens.', run: () => 'He wandered off to the buffet.' },
  ],
  counter: [
    { label: 'Kick him out', hint: () => 'Reputation −3.', run: () => `Escorted out. Some customers grumble — ${rep(-3)}.` },
    { label: 'Let him play', passive: true, hint: () => `He'll take about ${M(5 * G())}.`, run: () => `He counted to ${M(5 * G())}. ${lose(5 * G())}.` },
    { label: 'Hire him as a dealer', hint: () => C.staffCount('dealer') < 20 ? 'A free dealer. Who better?' : 'Dealer team is full.',
      ok: () => C.staffCount('dealer') < 20,
      run: () => { C.S.sim.staff.dealer = C.staffCount('dealer') + 1; return 'He took the job. +1 dealer, no hiring fee.'; } },
  ],
  robbery: [
    { label: 'Send security', passive: true,
      hint: () => `${guards()} guard${guards() === 1 ? '' : 's'} on duty · ${pctTxt(catchP())} catch chance.`,
      run: () => {
        if (chance(catchP())) { C.S.stats.caught = (C.S.stats.caught || 0) + 1; return `Caught them at the door! Reward ${gain(5 * G())}, ${rep(3)}.`; }
        return `They got away. ${lose(20 * G() * (1 - Math.min(0.8, guards() * 0.12)))}.`;
      } },
    { label: 'Pay them off', hint: () => `Costs ${M(8 * G())}, guaranteed.`, run: () => `"Pleasure doing business." ${lose(8 * G())}.` },
  ],
  inspector: [
    { label: 'Show him around', passive: true,
      hint: () => `${pctTxt(passP())} to pass (cleaners help).`,
      run: () => chance(passP()) ? `Spotless! ${rep(6)}.` : `Violations everywhere. Fine ${lose(6 * G())}, ${rep(-6)}.` },
    { label: 'Bribe him', hint: () => `Costs ${M(4 * G())}. 70% it works.`,
      run: () => { const paid = lose(4 * G()); return chance(0.7) ? `He pockets it and smiles. ${paid}, ${rep(2)}.` : `He was wearing a wire. ${paid}, fine ${lose(15 * G())}, ${rep(-10)}.`; } },
  ],
  celebrity: [
    { label: 'Roll out the red carpet', hint: () => `Costs ${M(5 * G())}. Reputation +${10 + (C.staffCount('singer') ? 5 : 0)}.`,
      run: () => `Photos everywhere. ${lose(5 * G())}, ${rep(10 + (C.staffCount('singer') ? 5 : 0))}.` },
    { label: 'Treat them like anyone', passive: true, hint: () => 'Reputation +2.', run: () => `They had a nice time. ${rep(2)}.` },
  ],
  outage: [
    { label: 'Emergency repair', hint: () => `Costs ${M(0.5 * G())}.`, run: () => `Lights back on. ${lose(0.5 * G())}.` },
    { label: 'Wait it out', passive: true, hint: () => 'Income ×0.3 for 60s.',
      run: () => { C.addBuff('outage', 0.3, 60, '💡 Outage ×0.3'); return 'Candles on every table. Income ×0.3 for 60s.'; } },
  ],
  cheat: [
    { label: 'Investigate', hint: () => `${pctTxt(cheatP())} to catch the cheat (guards help).`,
      run: () => chance(cheatP()) ? `Caught red-handed. ${gain(3 * G())}, ${rep(2)}.` : `They slipped away. ${lose(6 * G())}.` },
    { label: 'Just swap the dice', passive: true, hint: () => `Costs ${M(2 * G())}.`, run: () => `New dice, no questions. ${lose(2 * G())}.` },
  ],
  jackpot: [
    { label: 'Pay her out', passive: true, hint: () => `Costs ${M(6 * G())}. Reputation +8.`, run: () => `Grandma is on the news. ${lose(6 * G())}, ${rep(8)}.` },
    { label: '"Machine malfunction"', hint: () => '50% she lets it go. 50% lawyers.',
      run: () => chance(0.5) ? `She bought it, but people talk. ${rep(-10)}.` : `Her grandson is a lawyer. ${lose(15 * G())}, ${rep(-5)}.` },
  ],
  tour: [
    { label: 'Welcome them', passive: true, hint: () => 'Income ×1.5 for 2 minutes.',
      run: () => { C.addBuff('rush', 1.5, 120, '🚌 Rush ×1.5'); return 'The coupons are flowing. Income ×1.5 for 2 minutes.'; } },
    { label: 'Turn them away', hint: () => 'Nothing happens.', run: () => 'The bus drives on to the next casino.' },
  ],
};
const catchP = () => Math.min(0.9, 0.15 + guards() * 0.12);
const passP = () => Math.min(0.95, 0.3 + C.staffCount('cleaner') * 0.1);
const cheatP = () => Math.min(0.95, 0.3 + guards() * 0.1);

export const AUTO_RESOLVE = 90;          // seconds before the passive choice is taken for you
export const incidentDef = id => INCIDENTS.find(i => i.id === id);

// Is it time for a new incident? Returns the new pending incident, or null.
export function maybeSpawn() {
  const S = C.S;
  if (S.sim.pending || Date.now() < S.sim.nextIncident) return null;
  const owned = Object.values(S.biz).reduce((a, b) => a + b, 0);
  if (owned < 5) { S.sim.nextIncident = Date.now() + 60e3; return null; }
  const def = C.weighted(INCIDENTS);
  S.sim.pending = { id: def.id, at: Date.now() };
  S.sim.nextIncident = Date.now() + (150 + Math.random() * 150) * 1000;
  return def;
}
export function resolve(index) {
  const S = C.S, p = S.sim.pending;
  if (!p) return null;
  const def = incidentDef(p.id), list = CHOICES[p.id];
  let ch = list[index];
  if (!ch || (ch.ok && !ch.ok())) ch = list.find(c => c.passive);
  S.sim.pending = null;
  const chips = S.chips, rp = S.sim.rep, staff = C.totalStaff();
  const text = ch.run();
  const good = S.chips >= chips && S.sim.rep >= rp && (S.chips > chips || S.sim.rep > rp || C.totalStaff() > staff || p.id === 'tour' && ch.passive);
  C.simLog(def.icon, `${def.title} — ${text}`);
  return { def, choice: ch, text, good };
}
export const autoResolveIn = () => C.S.sim.pending ? AUTO_RESOLVE - (Date.now() - C.S.sim.pending.at) / 1000 : Infinity;

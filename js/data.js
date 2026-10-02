// ─────────────────────────────────────────────────────────────────────────────
//  GAMBLING ECOSYSTEM — content & balance
//  All money is fake chips. Tweak numbers here; the engine reads everything.
// ─────────────────────────────────────────────────────────────────────────────

// ── Venues: unlock games, raise the max bet, multiply winnings ───────────────
export const VENUES = [
  { id: 'alley',    name: 'Back Alley',      icon: '🗑️', cost: 0,      maxBet: 100,      mult: 1,   crate: 250,
    blurb: 'A milk crate, a coin, and a guy named Sal. Everyone starts somewhere.' },
  { id: 'arcade',   name: 'Neon Arcade',     icon: '🕹️', cost: 2500,   maxBet: 2500,     mult: 1.25, crate: 4000,
    blurb: 'Sticky carpet, flashing lights, slot machines that hum your name.' },
  { id: 'river',    name: 'Riverboat',       icon: '🛶', cost: 75e3,   maxBet: 50e3,     mult: 1.5, crate: 90e3,
    blurb: 'A paddle steamer that never seems to dock. Roulette and rockets.' },
  { id: 'vegas',    name: 'Vegas Strip',     icon: '🌃', cost: 3e6,    maxBet: 2e6,      mult: 2,   crate: 3e6,
    blurb: 'Free drinks, no clocks, no windows. The real tables.' },
  { id: 'monaco',   name: 'Monte Carlo',     icon: '🛥️', cost: 4e8,    maxBet: 2.5e8,    mult: 3,   crate: 3e8,
    blurb: 'Yachts, tuxedos, and a croupier who has seen empires fall.' },
  { id: 'orbit',    name: 'Orbital Casino',  icon: '🛰️', cost: 8e10,   maxBet: 5e10,     mult: 5,   crate: 6e10,
    blurb: 'Zero gravity craps. The dice never land, so the house never loses.' },
  { id: 'void',     name: 'The Void',        icon: '🕳️', cost: 5e13,   maxBet: Infinity, mult: 10,  crate: 3e13,
    blurb: 'There is no table. There is no dealer. There is only the bet.' },
];

// ── Games ────────────────────────────────────────────────────────────────────
export const GAMES = [
  { id: 'coin',      name: 'Coin Flip',     icon: '🪙', venue: 0, desc: 'Call it in the air. Pays 2×.' },
  { id: 'scratch',   name: 'Scratch Cards', icon: '🎫', venue: 0, desc: 'Match three symbols. Up to 100×.' },
  { id: 'slots',     name: 'Slots',         icon: '🎰', venue: 1, desc: 'Three reels, one dream. Up to 250×.' },
  { id: 'mines',     name: 'Mines',         icon: '💣', venue: 1, desc: 'Pick safe tiles. Cash out before the boom.' },
  { id: 'crash',     name: 'Crash',         icon: '🚀', venue: 2, desc: 'Ride the rocket. Bail before it pops.' },
  { id: 'roulette',  name: 'Roulette',      icon: '🎡', venue: 2, desc: 'European wheel. Colours, dozens, or one number at 36×.' },
  { id: 'blackjack', name: 'Blackjack',     icon: '🃏', venue: 3, desc: 'Beat the dealer to 21. Blackjack pays 3:2.' },
];

// ── Your casino: idle businesses ─────────────────────────────────────────────
// cost grows ×1.15 per owned; income doubles at every milestone
export const BUSINESSES = [
  { id: 'gumball',   name: 'Rigged Gumball Machine', icon: '🍬', cost: 15,     income: 0.2 },
  { id: 'dice',      name: 'Back-alley Dice Game',   icon: '🎲', cost: 120,    income: 1.2 },
  { id: 'poker',     name: 'Back-room Poker Table',  icon: '♠️', cost: 1400,   income: 9 },
  { id: 'slotbank',  name: 'Bank of Slot Machines',  icon: '🎰', cost: 18e3,   income: 70 },
  { id: 'sports',    name: 'Sportsbook',             icon: '🏟️', cost: 2.2e5,  income: 520 },
  { id: 'lottery',   name: 'Lottery Franchise',      icon: '🎟️', cost: 3e6,    income: 4200 },
  { id: 'online',    name: 'Online Casino',          icon: '💻', cost: 4.5e7,  income: 3.5e4 },
  { id: 'crypto',    name: 'Crypto Casino',          icon: '🪙', cost: 7e8,    income: 3e5 },
  { id: 'offshore',  name: 'Offshore Empire',        icon: '🏝️', cost: 1.2e10, income: 2.8e6 },
  { id: 'moonbase',  name: 'Moon Casino Chain',      icon: '🌕', cost: 2.5e11, income: 3e7 },
  { id: 'endverse',  name: 'Casino at the End of Time', icon: '⏳', cost: 8e12, income: 4e8 },
];
export const BIZ_GROWTH = 1.15;
export const BIZ_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

// ── Charms: from crates, duplicates level them up (max 10) ───────────────────
export const RARITIES = [
  { id: 'C', name: 'Common',    color: '#b9c0c9', weight: 55 },
  { id: 'U', name: 'Uncommon',  color: '#4ade80', weight: 28 },
  { id: 'R', name: 'Rare',      color: '#38bdf8', weight: 12 },
  { id: 'E', name: 'Epic',      color: '#c084fc', weight: 4.5 },
  { id: 'L', name: 'Legendary', color: '#fbbf24', weight: 0.5 },
];

// effect: { kind, value } — value is per charm level
//   profit:<game|all>  multiplies winnings (profit part)  value = +%
//   luck               bends the odds your way            value = +% points
//   idle               casino income                       value = +%
//   xp                 experience                          value = +%
//   offline            offline earnings cap                value = +hours
//   loan               loan shark interest                 value = −%
export const CHARMS = [
  { id: 'rabbit',   name: "Rabbit's Foot",         icon: '🐇', r: 'C', kind: 'luck',          value: 0.6 },
  { id: 'penny',    name: 'Lucky Penny',           icon: '🪙', r: 'C', kind: 'profit:coin',   value: 25 },
  { id: 'nail',     name: 'Lucky Thumbnail',       icon: '💅', r: 'C', kind: 'profit:scratch',value: 25 },
  { id: 'pitboss',  name: 'Snoozing Pit Boss',     icon: '😴', r: 'C', kind: 'idle',          value: 10 },
  { id: 'diary',    name: "Gambler's Diary",       icon: '📓', r: 'C', kind: 'xp',            value: 25 },
  { id: 'cherry',   name: 'Cherry Keychain',       icon: '🍒', r: 'U', kind: 'profit:slots',  value: 30 },
  { id: 'manual',   name: 'Minesweeper Manual',    icon: '📘', r: 'U', kind: 'profit:mines',  value: 25 },
  { id: 'wobbly',   name: 'Wobbly Wheel',          icon: '🎡', r: 'U', kind: 'profit:roulette',value: 25 },
  { id: 'rocket',   name: 'Rocket Sticker',        icon: '🚀', r: 'U', kind: 'profit:crash',  value: 25 },
  { id: 'shades',   name: 'Poker Sunglasses',      icon: '🕶️', r: 'U', kind: 'profit:blackjack',value: 25 },
  { id: 'magnet',   name: 'Magnet in the Machine', icon: '🧲', r: 'R', kind: 'profit:all',    value: 15 },
  { id: 'nightowl', name: 'Night Shift Owl',       icon: '🦉', r: 'R', kind: 'offline',       value: 2 },
  { id: 'clover',   name: 'Four-Leaf Clover',      icon: '🍀', r: 'R', kind: 'luck',          value: 1.2 },
  { id: 'tooth',    name: 'Shark Tooth',           icon: '🦈', r: 'R', kind: 'loan',          value: 8 },
  { id: 'whale',    name: 'Whale Friend',          icon: '🐋', r: 'E', kind: 'idle',          value: 40 },
  { id: 'ball',     name: 'Crystal Ball',          icon: '🔮', r: 'E', kind: 'luck',          value: 2.2 },
  { id: 'tophat',   name: 'Top Hat of the House',  icon: '🎩', r: 'E', kind: 'profit:all',    value: 40 },
  { id: 'ace',      name: 'Golden Ace',            icon: '🂡', r: 'L', kind: 'profit:all',    value: 100 },
  { id: 'universe', name: 'Pocket Universe',       icon: '🌌', r: 'L', kind: 'idle',          value: 150 },
  { id: 'dragon',   name: 'Jade Dragon',           icon: '🐉', r: 'L', kind: 'luck',          value: 4 },
];
export const CHARM_MAX_LEVEL = 10;
export const LUCK_CAP = 25;   // % points

// ── Prestige: "Fold Everything" for Aces ─────────────────────────────────────
export const ACE_DIVISOR = 1e6;           // aces = floor(sqrt(runEarnings / ACE_DIVISOR))
export const ACE_SHOP = [
  { id: 'seed',    name: 'Seed Money',      icon: '💵', base: 1, max: 8,  desc: l => `Start each run with ${['$100', '$1K', '$10K', '$100K', '$1M', '$10M', '$100M', '$1B', '$10B'][l]}.` },
  { id: 'stakes',  name: 'Table Stakes',    icon: '📈', base: 1, max: 50, desc: l => `+${l * 25}% to all winnings.` },
  { id: 'passive', name: 'Silent Partner',  icon: '🤝', base: 1, max: 50, desc: l => `+${l * 25}% casino income.` },
  { id: 'lucky',   name: 'Born Lucky',      icon: '🍀', base: 2, max: 10, desc: l => `+${l}% luck.` },
  { id: 'pockets', name: 'Deep Pockets',    icon: '👖', base: 5, max: 3,  desc: l => `${3 + l} charm slots.` },
  { id: 'sleep',   name: 'Insomniac',       icon: '🌙', base: 1, max: 10, desc: l => `+${l * 2}h offline earnings cap.` },
  { id: 'vip',     name: 'VIP Card',        icon: '💳', base: 4, max: 3,  desc: l => `Start runs with ${['the Back Alley', 'the Neon Arcade', 'the Riverboat', 'the Vegas Strip'][l]} unlocked.` },
  { id: 'haggle',  name: 'Crate Haggler',   icon: '🏷️', base: 2, max: 5,  desc: l => `Crates cost ${l * 10}% less.` },
];

// ── Daily wheel ──────────────────────────────────────────────────────────────
// amount is in "minutes of current casino income" (with a floor based on venue)
export const WHEEL = [
  { label: '5 min',   kind: 'income', amount: 5,   weight: 22, color: '#1f6f43' },
  { label: 'Crate',   kind: 'crate',  amount: 1,   weight: 14, color: '#7c3aed' },
  { label: '15 min',  kind: 'income', amount: 15,  weight: 18, color: '#0e7490' },
  { label: 'XP',      kind: 'xp',     amount: 1,   weight: 16, color: '#b45309' },
  { label: '1 hour',  kind: 'income', amount: 60,  weight: 10, color: '#be123c' },
  { label: '2 Crates',kind: 'crate',  amount: 2,   weight: 8,  color: '#6d28d9' },
  { label: '4 hours', kind: 'income', amount: 240, weight: 4,  color: '#b91c1c' },
  { label: 'ACE',     kind: 'ace',    amount: 1,   weight: 2,  color: '#a16207' },
];

// ── Achievements: each gives +2% to everything ───────────────────────────────
// check(s) receives the state; keep them cheap
export const ACHIEVEMENTS = [
  { id: 'first',     name: 'First Taste',        desc: 'Place your first bet.',               check: s => s.stats.bets >= 1 },
  { id: 'hundred',   name: 'Regular',            desc: 'Place 100 bets.',                     check: s => s.stats.bets >= 100 },
  { id: 'thousand',  name: 'Problem? What Problem', desc: 'Place 1,000 bets.',                check: s => s.stats.bets >= 1000 },
  { id: 'tenk',      name: 'Furniture',          desc: 'Place 10,000 bets.',                  check: s => s.stats.bets >= 1e4 },
  { id: 'win10x',    name: 'Ten Bagger',         desc: 'Win 10× your bet in one go.',         check: s => s.stats.bestMult >= 10 },
  { id: 'win100x',   name: 'Hundred Bagger',     desc: 'Win 100× your bet in one go.',        check: s => s.stats.bestMult >= 100 },
  { id: 'streak5',   name: 'On Fire',            desc: 'Win 5 bets in a row.',                check: s => s.stats.bestStreak >= 5 },
  { id: 'streak10',  name: 'Untouchable',        desc: 'Win 10 bets in a row.',               check: s => s.stats.bestStreak >= 10 },
  { id: 'lose10',    name: 'Character Building', desc: 'Lose 10 bets in a row.',              check: s => s.stats.worstStreak >= 10 },
  { id: 'k1',        name: 'Pocket Money',       desc: 'Hold $1,000.',                        check: s => s.chips >= 1e3 },
  { id: 'm1',        name: 'Millionaire',        desc: 'Hold $1,000,000.',                    check: s => s.chips >= 1e6 },
  { id: 'b1',        name: 'Billionaire',        desc: 'Hold $1,000,000,000.',                check: s => s.chips >= 1e9 },
  { id: 't1',        name: 'Trillionaire',       desc: 'Hold $1,000,000,000,000.',            check: s => s.chips >= 1e12 },
  { id: 'biz1',      name: 'Entrepreneur',       desc: 'Buy your first business.',            check: s => totalBiz(s) >= 1 },
  { id: 'biz100',    name: 'Franchise',          desc: 'Own 100 businesses.',                 check: s => totalBiz(s) >= 100 },
  { id: 'biz500',    name: 'Conglomerate',       desc: 'Own 500 businesses.',                 check: s => totalBiz(s) >= 500 },
  { id: 'arcade',    name: 'Moving Up',          desc: 'Unlock the Neon Arcade.',             check: s => s.venue >= 1 },
  { id: 'vegas',     name: 'Viva',               desc: 'Unlock the Vegas Strip.',             check: s => s.venue >= 3 },
  { id: 'void',      name: 'Stare Back',         desc: 'Unlock The Void.',                    check: s => s.venue >= 6 },
  { id: 'crate1',    name: 'Unboxing',           desc: 'Open a crate.',                       check: s => s.stats.crates >= 1 },
  { id: 'crate50',   name: 'Loot Goblin',        desc: 'Open 50 crates.',                     check: s => s.stats.crates >= 50 },
  { id: 'legend',    name: 'Legendary',          desc: 'Find a Legendary charm.',             check: s => CHARMS.some(c => c.r === 'L' && s.charms[c.id]) },
  { id: 'allcharms', name: 'Collector',          desc: 'Find every charm.',                   check: s => CHARMS.every(c => s.charms[c.id]) },
  { id: 'maxcharm',  name: 'Polished',           desc: 'Level a charm to 10.',                check: s => Object.values(s.charms).some(l => l >= CHARM_MAX_LEVEL) },
  { id: 'loan',      name: 'Friends in Low Places', desc: 'Borrow from Vinnie.',             check: s => s.stats.loans >= 1 },
  { id: 'collected', name: 'Thumbs Intact',      desc: 'Get collected by Vinnie.',            check: s => s.stats.collected >= 1 },
  { id: 'golden',    name: 'Shiny!',             desc: 'Grab a golden chip.',                 check: s => s.stats.golden >= 1 },
  { id: 'golden25',  name: 'Magpie',             desc: 'Grab 25 golden chips.',               check: s => s.stats.golden >= 25 },
  { id: 'wheel',     name: 'Round and Round',    desc: 'Spin the daily wheel.',               check: s => s.stats.wheel >= 1 },
  { id: 'crash50',   name: 'Astronaut',          desc: 'Cash out of Crash at 50× or more.',   check: s => s.stats.bestCrash >= 50 },
  { id: 'mines20',   name: 'Bomb Squad',         desc: 'Clear 20 safe tiles in one Mines round.', check: s => s.stats.bestMinesTiles >= 20 },
  { id: 'bj',        name: 'Natural',            desc: 'Get dealt a blackjack.',              check: s => s.stats.blackjacks >= 1 },
  { id: 'zero',      name: 'Green Zero',         desc: 'Win on 0 in roulette.',               check: s => s.stats.zeroWins >= 1 },
  { id: 'jackpot',   name: 'Jackpot',            desc: 'Hit 7-7-7 on the slots.',             check: s => s.stats.jackpots >= 1 },
  { id: 'prestige',  name: 'Fold',               desc: 'Prestige once.',                      check: s => s.prestiges >= 1 },
  { id: 'prestige5', name: 'The House',          desc: 'Prestige five times.',                check: s => s.prestiges >= 5 },
];

export function totalBiz(s) { return Object.values(s.biz).reduce((a, b) => a + b, 0); }

// ── Golden chip rewards ──────────────────────────────────────────────────────
export const GOLDEN = [
  { kind: 'cash',   weight: 45 },   // ~10 min of income or 15% of chips, whichever is bigger (capped)
  { kind: 'frenzy', weight: 25 },   // ×7 casino income for 40s
  { kind: 'lucky',  weight: 20 },   // +15% luck for 45s
  { kind: 'crate',  weight: 10 },   // free crate
];

// ── Flavour ──────────────────────────────────────────────────────────────────
export const BROKE_LINES = [
  'You check the couch cushions.',
  'A tourist drops a chip. Finders keepers.',
  'You sell your watch. It was fake anyway.',
  'Sal lends you a few bucks "for the bus".',
  'You return some bottles for the deposit.',
  'A pigeon brings you a coin. Weird, but okay.',
];

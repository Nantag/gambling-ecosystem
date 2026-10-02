# 🎲 Gambling Ecosystem

An idle casino tycoon you play in the browser. Start in a back alley with $100 and a coin, gamble your way up, buy a rigged casino empire, and climb from the Back Alley to The Void.

**All chips are fake. There is no real money anywhere in this game.**

## Play

Open it on GitHub Pages, or run it locally:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

(It uses ES modules, so double-clicking `index.html` won't work — use any local server.)

## What's in it

- **7 games** — Coin Flip, Scratch Cards, Slots (auto-spin), Mines, Crash (auto cash-out), Roulette, Blackjack. Real odds with a small house edge.
- **Your Casino** — a little management sim:
  - **Businesses**: 11 idle businesses that earn every second, with ×2 milestones. They keep earning while you're away (offline cap, upgradable).
  - **Floor**: watch customers wander around. Reputation (0–100) and occupancy (visitors vs. seats) scale your income.
  - **House edge** slider: rig the games harder for more income, but reputation falls.
  - **Staff**: hire dealers, cleaners, security, bartenders, lounge singers and promoters. Each one has a salary.
  - **Incidents**: every few minutes something happens and you pick what to do. Whales, card counters, robberies, health inspectors, celebrities, power outages, loaded dice, jackpots and tour buses. If you don't answer in 90s, your manager plays it safe.
- **Upgrades** — one-time purchases for the casino (income, reputation, visitors, security, salaries), for each business (×2 tiers at 10/25/50 owned), and for you (luck, table limits, per-game winnings).
- **7 venues** — unlock new games, higher table limits and bigger winnings multipliers.
- **Crates & charms** — 20 charms in 5 rarities from a spinning loot reel. Duplicates level them up. Equip up to 3 (6 with upgrades).
- **Luck** — gives losing bets a second chance (capped at 25%).
- **Levels** — every bet earns XP; each level adds +2% winnings.
- **Vinnie the loan shark** — borrow when you're broke. Pay within 20 minutes or he collects.
- **Golden chips** fly across the screen — click them for cash, income frenzies, luck or free crates.
- **Daily wheel**, **41 achievements** (+2% everything each), **stats**.
- **Fold (prestige)** — reset your run for Aces and buy permanent upgrades.

## Saving

The game autosaves to your browser every 5 seconds and when you close the tab. In **Settings** you can export a save code (or download it as a file) and import it on another device.

## Tuning

All balance numbers live in [`js/data.js`](js/data.js): venues, games, businesses, staff, upgrades, incidents (choices live in [`js/incidents.js`](js/incidents.js)), charms, prestige shop, wheel, achievements.

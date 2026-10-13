# Keeper

A phone app for tracking Pakistani mutual funds. Open it to see today's profit or loss, total profit or loss and the latest returns for every fund you hold, priced from MUFAP's daily data.

- **Installable:** add it to your home screen on Android or iPhone and it opens like an app.
- **No server, no account:** the app reads [MUFAP's Performance Summary](https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1) directly from your phone.
- **Private:** your holdings are stored only in your phone's browser storage. This repo contains code only, so it can be public.

## How the numbers are worked out

| Figure | Formula |
|---|---|
| Value | units × NAV |
| Today | units × (NAV − NAV ÷ (1 + 1-day return)) |
| Total P/L | value − amount invested |

MUFAP reports money market and income fund returns as annual rates. Keeper divides the 1-day rate by 365, MUFAP's own convention. For example, Meezan Cash Fund at 11.06% gives 0.0303% for the day, which matches its NAV moving from 53.0734 to 53.0895.

Prices refresh when you open the app (at most every 30 minutes) or when you tap refresh.

## Run it on your computer

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Open the address it prints. `npm run dev -- --host` also shows a network address you can open on your phone if it's on the same Wi-Fi.

Other commands:

```bash
npm test          # parser and calculation tests
npm run build     # production build into dist/
npm run preview   # serve the production build
npm run icons     # redraw the app icons into public/
```

## Put it on your phone (free, via GitHub Pages)

1. Create a **public** repo on GitHub, for example `fund-keeper`, and push this folder to it.
2. On GitHub, open the repo's **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The **Deploy to GitHub Pages** workflow runs on every push to `main` or `master`. When it finishes, your app is at `https://<your-username>.github.io/<repo-name>/`.
4. Open that address on your phone:
   - **Android (Chrome):** menu ⋮ → **Add to Home screen** (or **Install app**).
   - **iPhone (Safari):** Share → **Add to Home Screen**.

## Using it

- **Add funds:** tap **Add your funds**, search (e.g. "meezan cash"), pick the fund, then enter your units and the total amount you've paid in.
- **Bought more:** Edit holdings → add the new units and the new amount to both numbers.
- **Dividend paid as units:** update Units from your statement and leave Invested unchanged.
- **Backup:** Backup → **Save backup file** after you change your holdings. If the phone's browser data is cleared, or you change phones, use **Restore from file**.

## Project layout

```
src/
  lib/mufap.ts       reads and parses MUFAP's Performance Summary
  lib/calc.ts        value, day change and P/L
  lib/store.ts       browser storage, backup and restore
  components/        screens: summary, fund cards, holdings editor, backup
public/              app icons
legacy/              the earlier Google Sheets / Apps Script version
```

## If prices stop loading

MUFAP currently lets other sites read its page. If it stops, the app shows an error and keeps the last saved prices. The fix would be a small scheduled GitHub Action that copies the public MUFAP data into this repo for the app to read.

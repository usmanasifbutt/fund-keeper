# How the numbers are worked out

## Where prices come from

Keeper downloads MUFAP's public [Performance Summary](https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1) straight from your phone. It lists every Pakistani mutual fund with its latest NAV (price per unit) and its returns over 1, 15, 30, 90, 180, 270 and 365 days.

Keeper fetches it when you open the app, at most every 30 minutes, or when you tap ⟳. The last copy is kept on the phone, so the app still opens offline.

## The figures

| Figure | Formula |
|---|---|
| Value | units × NAV |
| Today | units × (NAV − previous NAV), where previous NAV = NAV ÷ (1 + 1-day return) |
| Total P/L | value − amount invested |
| Total P/L % | value ÷ amount invested − 1 |

**Money market and income funds** report returns as an annual rate. Keeper turns the 1-day rate into a daily change by dividing by 365, the same convention MUFAP uses.

> Example: Meezan Cash Fund's 1-day return of 11.06% p.a. ÷ 365 = 0.0303% for the day. That matches its NAV moving from 53.0734 to 53.0895.

**Equity and asset allocation funds** report actual returns, which are used as they are.

## Categories

MUFAP has around 40 categories, including Islamic, conventional and pension versions. Keeper groups them:

| Group | Includes |
|---|---|
| Equity | Equity, index tracker, exchange-traded funds |
| Money Market | Money market |
| Income | Income, debt, sovereign, fixed-rate/return, capital protected |
| Asset Allocation | Asset allocation, balanced, fund of funds, commodities |
| Other | Anything else |

## Profit/loss over time

The chart has two kinds of points:

- **Actual (solid line):** today's figure, plus one record for each day you've opened the app. These are saved on your phone.
- **Estimated (dashed line):** for dates before the app had any records, Keeper works backwards from MUFAP's 1–365-day returns:

  ```
  NAV on that date = today's NAV ÷ (1 + return over that period)
  P/L on that date = units × NAV on that date − amount invested
  ```

  This assumes you held today's units on that date. If you set a **first invested date** for a fund, it only counts from that date. When every fund has a date, the line starts at Rs 0 on the earliest one.

The line is green above Rs 0 (profit) and red below (loss). A rising red line means a shrinking loss, not a profit.

## Limits

- Prices are as fresh as MUFAP's page. Fund managers publish NAVs at different times, usually in the evening.
- Loads, taxes, Zakat and dividend payouts aren't calculated. Keeper relies on the units and amount you enter, so check them against your statements.
- If MUFAP changes its page layout or stops other sites from reading it, prices stop loading until the app is updated.

# Keeper setup (about 10 minutes)

Everything runs in your own Google account. Nothing to install, nothing to pay.

## 1. Create the sheet and paste the code

1. Go to [sheets.new](https://sheets.new) and name the sheet **Keeper**.
2. Open **Extensions → Apps Script**. Click "Untitled project" at the top and rename it **Keeper**.
3. Replace everything in `Code.gs` with the contents of `Code.gs` from this folder.
4. Click **+ → HTML**, name it `Form` (no extension), and paste in `Form.html`.
5. Click **Project Settings** (gear icon), tick **Show "appsscript.json" manifest file in editor**. Go back to the **Editor**, open `appsscript.json`, and replace it with the file from this folder.
6. Click **Save** (disk icon).

## 2. Run setup

1. Reload the spreadsheet tab. A **Keeper** menu appears after a few seconds.
2. Click **Keeper → 1. Set up sheets**.
3. Google asks for permission the first time. Choose your account. If you see "Google hasn't verified this app", click **Advanced → Go to Keeper (unsafe)**. This warning appears for any personal script; the script is yours and only runs in your account.
4. When it finishes it says how many funds it loaded from MUFAP (about 558). If it shows an error about MUFAP instead, stop here and send me the message.

## 3. Fill in Settings

Open the **Settings** sheet:

| Setting | What to enter |
|---|---|
| EMAIL_TO | Leave blank to use your Gmail, or enter another address |
| WHATSAPP_PHONE | Your number with country code, e.g. `+923001234567` |
| CALLMEBOT_APIKEY | From step 4 |
| DROP_ALERT_PCT | `2` means flag any fund that falls 2% or more in a day |

## 4. Turn on WhatsApp (optional)

1. Open [CallMeBot's WhatsApp page](https://www.callmebot.com/blog/free-api-whatsapp-messages/) and save the bot number shown there in your contacts. The number has changed before, so take it from that page.
2. Send the bot the activation message the page shows (currently "I allow callmebot to send me messages").
3. It replies with your API key. Put it in **Settings → CALLMEBOT_APIKEY**.

Skip this and you'll get email only.

## 5. Deploy the holdings form

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Only myself**.
4. Click **Deploy** and copy the **Web app URL**.
5. Open it on your phone and bookmark it (or "Add to Home screen").

## 6. Enter your holdings

1. Open the form, search for **Alhamra Islamic Stock** and pick it, then enter your units and the total amount invested.
2. Click **+ Add fund** and do the same for **Meezan Cash Fund**.
3. Click **Save**, then **Send report now**. You should get the email (and WhatsApp message) within a minute.

The first report shows today's change as "new", because there's no previous NAV yet. From the next working day it shows the real daily change.

## 7. Turn on daily reports

Click **Keeper → 2. Turn on daily reports**. You'll get a report around 9 pm each day MUFAP publishes new NAVs for your funds, with a 9 am retry if MUFAP was late. Days with no new NAV (weekends, holidays) send nothing.

## Day to day

- **Bought more units:** open the form, add the new units to the existing number, add the amount you paid to "Invested", Save.
- **Bought a new fund:** **+ Add fund**.
- **Sold everything in a fund:** **Remove**, Save.
- **Dividend paid as units:** add the new units; leave "Invested" unchanged.

Every save is logged in the **History** sheet. Daily NAVs are kept in **NAVs**, and each report's totals in **Daily**, which also holds the chart used in the email.

## Changing the code later

After editing `Code.gs` or `Form.html`, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The form URL stays the same.

## If something goes wrong

- **Error email "could not read MUFAP":** MUFAP was down or changed its page layout. Check [MUFAP's NAV page](https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=3) in a browser.
- **No WhatsApp message:** In Apps Script, open **Executions** and look for a "CallMeBot" warning. CallMeBot is a free service and is sometimes slow; the email still arrives.
- **Stop everything:** **Keeper → Turn off daily reports**.

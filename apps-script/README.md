# Apps Script backend: deploy steps

Do this while signed in as `dfh2025@dfh.org.il`.

1. Create a new Google Sheet (any name). This is the signers list.
2. In the Sheet: **Extensions > Apps Script**.
3. Create three script files and paste in the contents of:
   - `Code.gs`
   - `pdf.gs`
   - `pdf-lib.min.gs` (name it `pdf-lib.min`; it is the pdf-lib 1.17.1 library, ~500 KB)
4. In `Code.gs`, set `CONFIG.CHARTER_URL` and `CONFIG.SITE_URL` to your GitHub Pages URLs.
5. **Spike / verify:** select `testStamp` in the function dropdown and Run. Authorize when asked.
   Check the execution log and your Drive for a signed PDF with an extra last page.
   If pdf-lib fails, the log says so and emails automatically use the fallback
   (original charter + separate signature page PDF).
6. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Copy the `/exec` URL.
7. Put that URL in `assets/config.js` as `API_URL`, commit and push.
8. Test: sign once on the site, check the Sheet row and the email.

Notes:
- Rows with `emailStatus` other than `sent` (`pending`/`failed`) can be re-sent by running `retryFailed`.
- After changing the code, use **Deploy > Manage deployments > Edit > New version** to keep the same URL.
- Map data is cached for 30 seconds.

# horizon_summit_charter_sign

Static site (GitHub Pages) + Google Apps Script backend where participants read and sign the
Federal Charter, receive the signed PDF by email, and appear on a live world map.
See `PLAN.md` for the design.

- `index.html` – charter viewer and signing form (Photon city autocomplete)
- `map.html` – live map; add `?display=1` for the big-screen view
- `assets/config.js` – set `API_URL` to the deployed Apps Script web app
- `apps-script/` – backend code and deploy steps (`apps-script/README.md`)

## Deploy

1. Deploy the backend following `apps-script/README.md`, set `API_URL` in `assets/config.js`.
2. Enable GitHub Pages (Settings > Pages > deploy from `main`, root).
3. Event day: sign once, check the Sheet and mail quota, open `map.html?display=1` on the big screen.

Local preview: `python -m http.server` in this folder.

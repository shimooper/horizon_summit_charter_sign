# Federal Charter Signing Site and Signers Map: Plan

## Goal

A small public website where event participants can:

1. Read the **Federal Charter** (`Federal Charter Eng.pdf`).
2. Sign it by entering **name, city (real place, picked via autocomplete), and email**.
3. Receive the **signed charter PDF by email**.

The site also shows a **live world map** of all signers' cities, suitable for a big screen at the event. The organizers get a **Google Sheet listing every signer with all their details**.

Constraints: free to run, no API keys or billing, signers from all over the world, no server to maintain.

## Decisions (from review)

| Topic | Decision |
|---|---|
| Language | English only |
| Sending account | Workspace account `dfh2025@dfh.org.il` (about 1,500 emails/day quota) |
| Map labels | City-only pins, with a count per city |
| Signature placement | The charter has no signature spot, so a **signature page is appended** at the end |
| Expected scale | About 100 signers per day, well within the Workspace quota |
| Hosting | `<github-username>.github.io/<repo>` |
| Duplicates | One signature per email. A repeat submission re-sends the PDF and adds no new row or pin. |
| Privacy | Not a concern for this event. The Sheet holds full details for the organizers. |

---

## Architecture

```
 Browser (GitHub Pages, static)                Google Apps Script web app (free)
 ┌──────────────────────────────┐   POST      ┌────────────────────────────────┐
 │ index.html  – sign form      │ ──────────► │ doPost: validate, de-dupe,     │
 │   · Photon city autocomplete │             │   append row to Sheet,         │
 │ map.html    – live map       │   GET       │   stamp PDF, email it          │
 │   · Leaflet + OSM tiles      │ ◄────────── │ doGet: JSON of {city, lat, lng}│
 └──────────────────────────────┘   JSON      └───────────────┬────────────────┘
        │ autocomplete queries                                │
        ▼                                                     ▼
   Photon API (OpenStreetMap data, no key)          Google Sheet (all signers + details)
```

| Concern | Choice | Why |
|---|---|---|
| Front end | Plain HTML/CSS/JS, no build step | Simple, easy to review and host |
| Hosting | GitHub Pages (from this repo) | Free, HTTPS, zero ops |
| City autocomplete | **Photon** (`photon.komoot.io`), OSM data | Free, no key, built for search-as-you-type. Nominatim's public API forbids autocomplete use, so it is not used. |
| Map | **Leaflet** + OSM tiles + `Leaflet.markercluster` | Free, no key, handles thousands of pins |
| Backend | **Google Apps Script** web app, running as `dfh2025@dfh.org.il` | Free, no server, can send mail from that address |
| Storage | Google Sheet owned by `dfh2025@dfh.org.il` | You can open it any time to see, filter and export all signers |
| Email | Apps Script `MailApp` / `GmailApp` | Free, Workspace quota |
| PDF stamping | `pdf-lib` (pure JS) | Appends a signature page with name, city and date |

---

## User flow

1. Visitor opens the site and sees the charter (embedded PDF viewer plus a download link).
2. Visitor fills in:
   - **Full name**
   - **City**: type 3 or more characters, pick a suggestion (for example "Haifa, Israel"). The chosen place's canonical name and coordinates are stored in hidden fields. Free text that was not picked from the list is rejected.
   - **Email**
   - Checkbox: "I have read and agree to the Federal Charter".
3. Submit → the backend saves the row, stamps the PDF and emails it → the page shows "Thank you, your signed charter is on its way" and a link to the map.
4. The map page (`map.html`) shows one pin per signer city, with clustering, a per-city count, a live total counter and a refresh every 30 seconds. A `?display=1` mode gives a clean full-screen view for the event screen.

---

## Signers Sheet (what you will see)

| Column | Notes |
|---|---|
| `timestamp` | Server time |
| `name` | Full name as entered |
| `email` | Used for de-duplication and delivery |
| `city` | Canonical name from Photon, for example "Haifa, Israel" |
| `country` | From Photon |
| `lat`, `lng` | From Photon (city-level) |
| `emailStatus` | `sent` / `failed` (failed rows can be retried) |

You can sort, filter and export it like any Sheet.

---

## Public map data (Apps Script `doGet`)

Returns only what the map needs, to keep the public endpoint small and fast:

```json
[{ "city": "Haifa, Israel", "lat": 32.79, "lng": 34.99, "count": 7 }]
```

- Cached for about 30 seconds (`CacheService`) so a busy event does not exhaust Apps Script quotas.
- Names and emails are not included. The map doesn't need them, and it keeps the endpoint light.

---

## Signed PDF

- The backend takes the original charter (stored with the Apps Script project) and uses `pdf-lib` to **append a signature page**: signer name, city, date, and a short "Signed electronically via <site>" line.
- The email contains the stamped PDF as an attachment plus a short thank-you text, sent from `dfh2025@dfh.org.il`.

**Technical risk (to verify first):** loading `pdf-lib` inside Apps Script. It is pure JS and is known to work when pasted in as a library file, but I'll spike this before building the rest.

**Fallback if the spike fails:** the email attaches the original charter plus a one-page "certificate of signing" generated from an HTML template via Apps Script's built-in HTML-to-PDF.

*Note: this is an online statement of support, not a legally binding qualified e-signature (no identity verification).*

---

## Abuse and spam protection (free, lightweight)

- Honeypot field and a minimum time-to-submit check.
- Server-side validation: email format, name length, coordinates sanity-checked.
- Per-email de-duplication, plus a simple global rate limit in the backend.
- Optional: **Cloudflare Turnstile** (free CAPTCHA) if bots become a problem.
- Because the PDF is generated server-side from fixed content, the endpoint cannot be used to send arbitrary attachments.

---

## Limits to be aware of

| Item | Limit | Impact |
|---|---|---|
| Apps Script email quota | about 1,500 recipients/day on Workspace | 100 signers/day is far below it |
| Apps Script execution | about 6 minutes per run; fine for light concurrent use | OK for an event |
| Photon API | Fair-use, no hard key | Requests are debounced (300 ms). If it ever blocks us, swap to Geoapify or a self-hosted Photon (one-line config change) |
| OSM tile servers | Fair-use policy | Fine for this traffic. Alternative basemap is a one-line swap |

---

## Repo layout

```
horizon_summit_charter_sign/
├── index.html              # sign form + charter viewer
├── map.html                # live map (+ ?display=1 mode)
├── assets/
│   ├── style.css
│   ├── sign.js             # form, Photon autocomplete, submit
│   ├── map.js              # Leaflet map, polling, counter
│   └── Federal Charter Eng.pdf
├── apps-script/
│   ├── Code.gs             # doPost / doGet, validation, mail
│   ├── pdf.gs              # signature page logic (pdf-lib)
│   └── README.md           # deploy steps
├── PLAN.md
└── README.md
```

---

## Build steps

1. **Spike:** run `pdf-lib` in Apps Script and append the signature page to the charter. (Go/no-go on the fallback.)
2. **Backend:** Sheet plus `doPost` (validate, store, stamp, email) and `doGet` (map JSON, cached).
3. **Sign page:** form, Photon autocomplete with a strict "must pick a suggestion" rule, submit and success states, embedded PDF.
4. **Map page:** Leaflet with clustering, counter, polling and display mode.
5. **Polish:** mobile layout, error and retry states, spam protections.
6. **Deploy:** GitHub Pages and the Apps Script web app. Do an end-to-end test with real emails and with non-Latin city names.
7. **Event-day checklist:** test signature, map on the big screen, check the Sheet and mail quota.

---

## What I need from you during the build

- Deploying the Apps Script must be done while signed in as `dfh2025@dfh.org.il` (authorizing mail and Sheet access). I'll give you exact step-by-step instructions and the code to paste, since I can't sign in to that account.
- Enabling GitHub Pages on the repo (Settings → Pages), or tell me and I'll walk you through it.

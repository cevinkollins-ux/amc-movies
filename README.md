# amc-movies

A personal AMC showtime finder. Pick **one movie**, then search every showtime across:

- **Theatres:** one or more (up to 10)
- **Dates:** one day or a range (up to 14 days)
- **Time of day:** e.g. only shows starting 5–9 pm (windows past midnight like 9 pm–2 am work too)

Results are grouped by date, then by theatre. Tap a time to go to AMC checkout.
Your theatres, movie and time window are remembered on your device.

## How it works

- `public/`: the web page (plain HTML/JS, no build step). The browser asks for showtimes
  one theatre-day at a time, 4 at a time in parallel, then filters and groups them.
- `api/`: three small server functions that call the AMC API with your key, so the key
  never reaches the browser:
  - `/api/movies`: now playing plus advance tickets
  - `/api/theatres`: all AMC theatres (cached for a day)
  - `/api/showtimes?theatre=<id>&date=YYYY-MM-DD`: one theatre, one date
- `lib/amc.js`: the only file that knows AMC's API shapes. If AMC's responses differ
  from what's assumed, fix it here.

## Settings

| Variable | Required | What it does |
|---|---|---|
| `AMC_VENDOR_KEY` | yes | Your AMC API key. Never commit it. |
| `APP_PASSWORD` | recommended | Anyone opening the site must enter this. Without it, anyone with the URL can use your key. |
| `AMC_MOCK` | no | `1` = use fake data (handy before your key is live). |

New AMC keys only go live on Thursdays, so expect "key rejected" errors until then.

## Deploy (Vercel, free, works from a phone)

1. Go to vercel.com → **Add New → Project** → import this repo. Leave all build settings as they are.
2. Under **Environment Variables**, add `AMC_VENDOR_KEY` and `APP_PASSWORD`.
3. Deploy. Open the URL on your phone, then **Share → Add to Home Screen**.

## Run locally

```sh
cp .env.example .env   # fill in AMC_VENDOR_KEY
npm run dev            # http://localhost:3000
npm run mock           # fake data, no key needed
npm test
```

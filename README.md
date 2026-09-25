# Gen-Vocher

A scheme-participation voucher registration app. A person enters their
name, mobile number, voucher number, and address; the backend checks
those details against a real customer scheme API and — if the mobile
number and voucher number both match — issues a voucher for half the
scheme's `totalAdvance`, storing the result in MongoDB.

```
gen-voucher/
├── client/                 static front end (form, styling, browser logic)
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/logo.svg
└── server/                 Node/Express backend
    ├── package.json
    ├── .env                pre-filled with the credentials you provided
    ├── .env.example         same file with placeholders, safe to commit
    └── src/
        ├── server.js          Express app; also serves client/
        ├── config.js          reads .env
        ├── db.js              MongoDB connection
        ├── models/Voucher.js  Mongoose schema
        ├── services/schemeApi.js    calls the scheme API + does the matching
        ├── controllers/voucherController.js  validation + orchestration
        └── routes/voucherRoutes.js
```

## Why a backend at all

The scheme API needs a bearer token and an `X-key` header on every
call. Those can't live in browser JavaScript — anyone could open dev
tools and read them straight out of the page. So the browser only
ever talks to *your own* server (`/api/vouchers/...`), and the server
is the only thing that holds the real credentials and calls the
outside API.

## Running it

You'll need Node.js and a MongoDB instance (local `mongod`, or a
connection string from MongoDB Atlas) reachable from wherever you run
this.

```bash
cd server
npm install
npm run dev          # or: npm start
```

Then open **http://localhost:4000** — the same Express server serves
the form and the API, so there's nothing else to run.

`server/.env` is already filled in with the scheme API URL, token,
and `X-key` you gave me, plus a default local `MONGODB_URI`. Update
`MONGODB_URI` if your MongoDB lives somewhere else.

> **Security note:** that bearer token is now in this chat transcript.
> Treat it as exposed — rotate it on the scheme-API side when you can,
> and going forward keep `.env` out of git (it's already in
> `.gitignore`) and out of anywhere else it could be copy-pasted.

## How a request flows

The landing screen offers two voucher types:

1. **Purchase voucher** submits branch, customer, invoice, purchase date, category (`Antique` or `Regular`), and VA amount to `POST /api/vouchers/purchase`. Antique uses 20% of the VA amount; Regular uses 25%.
2. **Scheme voucher** keeps the passbook lookup flow at `POST /api/vouchers/generate`.

Both flows save an issued record in MongoDB with `voucherType` set to `purchase` or `scheme`.

For scheme requests:

1. Browser submits the form to `POST /api/vouchers/generate` with
  `{ name, mobile, passbookNo, orderDate, address }`.
2. The server re-validates everything (name: letters/single spaces,
   ≤35 chars; mobile: 10 digits; voucherNo: capital letters, numbers,
   hyphens; address: required) — never trusting client-side checks
   alone.
3. The server calls the scheme API with
   `{ customerCode: "", mobileNo: <mobile>, orderNo: "" }` and the
   configured `Authorization`/`X-key` headers.
4. It searches the response's `data` array for an entry where
   `customerDetailsViewModel.mobileNo` equals the entered mobile
   **and** `voucherNo` equals the entered voucher number.
  - **Match** → the Purchase voucher button checks purchase details. Only the
    `Thanjavur` branch is eligible. Gold or Diamond jewellery uses 25% of
    `metalDetails.vaAmount`; Antique jewellery uses 20%. That amount is split
    equally between Voucher 1 and Voucher 2. The invoice number is saved and
    displayed on both voucher cards.
   - **No match** → the form shows "wait 24 hours for receiving
     voucher" and nothing is saved.
5. The "View voucher records" panel at the bottom of the page loads
   the last 50 vouchers from `GET /api/vouchers` (MongoDB), so you can
   see what's actually been stored.

## Testing without the live scheme API

If you want to sanity-check the form and validation without calling
the real API, point `SCHEME_API_URL` in `.env` at a small local mock
server that returns the same JSON shape you shared (the sample with
`voucherNo: "BMDMGTW-11333"`, mobile `6385562568`, `totalAdvance: 2000`
is a ready-made test case — it should produce a ₹1,000 voucher).

## Notes / things worth tightening before production

- **Duplicate vouchers:** right now nothing stops the same
  mobile+voucherNo from generating a second voucher. If a voucher
  should only ever be issued once per scheme order, add a check
  against existing `Voucher` records (e.g. on `schemeOwnCode`) before
  creating a new one.
- **Rate limiting:** the `/generate` endpoint calls an external API on
  every request; consider rate-limiting by IP or mobile number.
- **HTTPS:** the scheme API URL you gave is plain `http://` to a raw
  IP. If that's reachable over HTTPS in your environment, prefer that.

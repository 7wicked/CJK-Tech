# Lead gen agent

Multi-channel outreach: collect leads, write templated campaigns, send them over email, SMS or WhatsApp, and track what came back. n8n does the actual sending and can also push leads in.

Boots and runs with nothing connected. `DRY_RUN=true` makes every channel log a fake send and hand back a fake provider id, so you can click through the whole app before touching a single credential.

## Run it

```bash
cd backend
npm install
cp ../.env.example ../.env     # optional, defaults are fine
npm run seed                   # optional, drops in 6 fake leads + a campaign
npm start
```

Open http://localhost:3000. The frontend is plain HTML/CSS/JS served by the same Express process, so there is no second thing to start.

Node 18 or newer. `better-sqlite3` compiles on install, so on Windows you want the build tools that ship with the Node installer.

## Layout

```
backend/
  server.js                    Express app, static frontend, graceful shutdown
  src/config/env.js            every env var read in one place
  src/routes/                  URL to controller, nothing else
  src/controllers/             request in, response out, no business logic
  src/services/
    campaignEngine.js          audience resolution, batch sending, one-off sends
    templateEngine.js          {{placeholder}} rendering with fallbacks
    n8n.js                     outbound webhook dispatch + dry run
    channels/
      channelRegistry.js       one place that knows every channel
      emailChannel.js          each channel: key, validate(lead), send(...)
      smsChannel.js
      whatsappChannel.js
  src/middleware/errorHandler.js
  src/utils/                   logger, asyncHandler, validate, httpError
database/
  schema.js                    raw SQL DDL, seed channel rows
  db.js                        connection, migration on boot
  repositories/                one class per table, raw SQL throughout
  utils/id.js                  prefixed ids (lead_, camp_, msg_)
frontend/
  index.html                   all four views, toggled by hash
  css/styles.css
  js/                          api, dashboard, leads, campaigns, channels, csv, toast, main
```

Layering rule: controllers never touch repositories directly for anything involving a send. Sends go controller → campaignEngine → channelRegistry → n8n.

## Data model

| Table | Holds |
|---|---|
| `leads` | the person, their status, tags, and a JSON `meta` for anything a CSV brought along |
| `channels` | email / sms / whatsapp, their enabled flag and per-channel config |
| `campaigns` | name, channel, subject, body template, audience filter, daily cap |
| `campaign_leads` | who is enrolled in what, and whether they have been sent to |
| `messages` | every outbound and inbound message, its status and provider id |

Raw SQL everywhere. JSON columns are stored as text and rehydrated in `baseRepository`.

## API

| Method | Path | Does |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/dashboard` | every number the dashboard needs, one call |
| GET | `/api/leads` | `?q=&status=&source=&tag=&page=&limit=` |
| POST | `/api/leads` | create or merge one lead |
| POST | `/api/leads/import` | `{ leads: [...] }`, deduped |
| POST | `/api/leads/ingest` | **n8n inbound**: one lead |
| GET/PATCH/DELETE | `/api/leads/:id` | detail, edit, delete |
| POST | `/api/leads/:id/messages` | one-off send outside a campaign |
| GET/POST | `/api/campaigns` | list with stats, create |
| GET/PATCH/DELETE | `/api/campaigns/:id` | |
| GET | `/api/campaigns/:id/preview` | rendered samples, no writes, no sends |
| POST | `/api/campaigns/:id/audience` | enrol everyone matching the filter |
| POST | `/api/campaigns/:id/run` | **send one batch** — also the n8n Cron target |
| POST | `/api/campaigns/:id/status` | draft / running / paused / done |
| GET | `/api/channels` | channels + n8n status |
| PATCH | `/api/channels/:key` | enable, disable, save config |
| POST | `/api/channels/:key/test` | one throwaway message |
| POST | `/api/channels/webhooks/n8n/delivery` | **n8n inbound**: delivery status |

## Wiring n8n

Both directions are already built. Set `DRY_RUN=false` once the workflows exist.

**Outbound — we call n8n.** Set `N8N_WEBHOOK_URL` to your base production webhook URL. Each channel appends its own key, so you end up with `/email`, `/sms`, `/whatsapp`. Override any one of them with `N8N_WEBHOOK_EMAIL` and friends.

The payload:

```json
{
  "channel": "email",
  "to": "anita@northwindlabs.in",
  "from": "you@example.com",
  "fromName": "Your Name",
  "subject": "Quick question about Northwind Labs",
  "body": "Hi Anita, ...",
  "lead": { "id": "lead_...", "name": "Anita Rao", "company": "Northwind Labs" },
  "campaignId": "camp_..."
}
```

Your workflow: Webhook node → Switch on `channel` → Gmail / Twilio / WhatsApp node → Respond to Webhook with `{ "providerMessageId": "..." }`. We store that id so status callbacks can find the message later.

**Inbound — n8n calls us.**

- New lead from a scraper, form or enrichment step → `POST /api/leads/ingest` with `{ name, email, phone, company, title }`. Deduped on email, then phone.
- Bulk → `POST /api/leads/import` with `{ leads: [...] }`.
- Delivery, bounce or reply → `POST /api/channels/webhooks/n8n/delivery` with `{ providerMessageId, status, error }`, where status is `sent`, `delivered`, `failed` or `replied`.
- Scheduled sending → a Cron node hitting `POST /api/campaigns/:id/run`. Nothing in this app schedules itself; n8n owns the clock.

Set `N8N_INBOUND_SECRET` and have n8n send it as the `x-webhook-secret` header. Without it, anyone who can reach the server can post to those endpoints.

## Templates

`{{name}}`, `{{first_name}}`, `{{email}}`, `{{phone}}`, `{{company}}`, `{{title}}`, plus anything in the lead's `meta` (CSV columns we did not recognise land there).

Fallbacks: `{{first_name|there}}`. The preview flags any placeholder that would render blank before you send.

## Where the placeholders are

Everything runs, but these are the spots meant to be filled in:

- `services/channels/*.js` — each `send()` hands off to n8n. Swap in a direct SMTP/Twilio client if you would rather not route through n8n.
- `campaignEngine.run()` — no throttling, retries or send-window logic. Add them here if you need them.
- No auth anywhere. Add it in `server.js` before this is reachable from outside your machine.
- CORS is wide open for the same reason. Lock it to your n8n host.
- `leadsRepository.search()` — the `tag` filter is a `LIKE` against the JSON text. Fine for thousands of leads, not for millions.
- Reply handling updates the message status but does not thread conversations.

## Working on this in Claude Code

Good first prompts:

- "Add a `followUpEngine` service that queues a second touch N days after a message with no reply, following the pattern in `campaignEngine.js`."
- "Add an `unsubscribes` table and honour it in `resolveAudience`."
- "Add API key auth middleware and apply it to everything except the n8n webhooks."
- "Write the n8n workflow JSON for the outbound send, matching the payload in the README."

The file layout is the contract. New channel → copy `smsChannel.js`, register it in `channelRegistry.js`, add its key to the schema seed. New entity → repository class extending `baseRepository`, controller, routes file, mount in `routes/index.js`.

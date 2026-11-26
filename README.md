# school-bus-frontend

School Bus Route Tracker, Team 14 (Lab Group A-2), 26CSCN29H.

The React app (Vite) for School Bus Route Tracker. Authentication and the schedule use the Floci-backed Node.js API in `school-bus-ahmedservice`:

| Repo | Pages | Local access |
|---|---|---|
| `school-bus-ahmedservice` | signup, login, routes, schedule, alerts, favorites APIs | Floci API Gateway, `http://localhost:4566` |

Every API call goes through `src/api.js` and uses the current bearer session:

```
apiRequest('/api/routes')
apiRequest('/api/trips/:id/eta')
```

## Run on your laptop

```
copy .env.example .env.local
npm install
npm run dev                  (site on http://localhost:5173)
```

Run the Floci-backed backend in `school-bus-ahmedservice` and start this Vite app. The frontend runs at `http://localhost:5173`; Vite proxies `/restapis` requests to Floci.

Signup uses name, email, and password. It creates a parent profile in DynamoDB, hashes passwords with bcrypt, and signs the user in with an 8-hour session. Admin and supervisor roles are reserved for operator-provisioned accounts.

`apiRequest` accepts an optional options object:

```
apiRequest('/api/routes', {
  method: 'POST',
  body: { ... },
  headers: { 'Idempotency-Key': '...' },   // optional, merged in
})
```

A 429 is turned into "Too many requests. Try again in N seconds." The thrown
Error also carries `.status`, `.code`, `.details` and `.requestId` for callers
that want them; `.message` reads the same as before, so pages that only show
the message are unaffected.

## Rules

- Shared app entrypoints, API authentication, and API client changes affect all pages.
- Work on a branch, open a pull request, merge after checking it.

## Deploy (Lab 5)

One Vercel project for this repo. Set `VITE_API_GATEWAY_BASE` to the deployed API base path or full API URL.

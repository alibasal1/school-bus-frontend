# school-bus-frontend

School Bus Route Tracker, Team 14 (Lab Group A-2), 26CSCN29H.

The React app (Vite) for the whole team. It talks to three backend services, each in its own repo:

| Repo | Pages that call it | Owner | Local port |
|---|---|---|---|
| `school-bus-route-stop` | RoutesPage | Yehia | 3001 |
| `school-bus-schedule-arrival` | SchedulePage, LoginPage | Ahmed | 3002 |
| `school-bus-favorites-alerts` | FavoritesPage, AlertsPage | Ali | 3003 |

Every call goes through `src/api.js`:

```
apiRequest('favorites', '/api/favorites')
apiRequest('routes', '/api/routes', { method: 'POST', body: { ... } })
```

## Run on your laptop

```
copy .env.example .env.local
npm install
npm run dev                  (site on http://localhost:5173)
```

Run the backend services you need at the same time (each one with `npm run dev` in its own repo).

## Rules

- Each member edits only his own pages. `App.jsx`, `api.js` and `config.js` change only after telling the group.
- Work on a branch, open a pull request, merge after checking it.

## Deploy (Lab 5)

One Vercel project for this repo. Add the three `VITE_..._API_URL` values (the Vercel links of the three APIs) in the Vercel dashboard.

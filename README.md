# Anime Tier List

MERN + Tailwind app to build S/A/B/C tier lists of anime, with autosave and email export.
See `anime-tier-list-build-guide.md` (shared separately) for the full phase-by-phase build and deploy plan.

## Local development

```
# server
cd server && cp .env.example .env   # fill in the values
npm install
npm run dev

# client (new terminal)
cd client && cp .env.example .env   # set VITE_API_URL
npm install
npm run dev
```

Server runs on http://localhost:5000, client on http://localhost:5173.

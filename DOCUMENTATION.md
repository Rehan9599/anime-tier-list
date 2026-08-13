# 📚 Anime Tier List — Full Project Documentation

> **Purpose**: Revision & learning reference. Covers every file, component, function, model, route, service, and package across the React client and Express/Node.js server.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Environment & Configuration](#3-environment--configuration)
4. [Client — Packages & Dependencies](#4-client--packages--dependencies)
5. [Server — Packages & Dependencies](#5-server--packages--dependencies)
6. [Client — Entry Points](#6-client--entry-points)
7. [Client — React Router (Pages)](#7-client--react-router-pages)
8. [Client — Context (Global State)](#8-client--context-global-state)
9. [Client — Components](#9-client--components)
10. [Client — API Layer](#10-client--api-layer)
11. [Client — Socket.IO Client](#11-client--socketio-client)
12. [Client — Utilities](#12-client--utilities)
13. [Client — Styles](#13-client--styles)
14. [Server — Entry Point & Express Setup](#14-server--entry-point--express-setup)
15. [Server — Database Layer (MongoDB / Mongoose)](#15-server--database-layer-mongodb--mongoose)
16. [Server — Mongoose Models (Schema Definitions)](#16-server--mongoose-models-schema-definitions)
17. [Server — Middleware](#17-server--middleware)
18. [Server — Routes (API Endpoints)](#18-server--routes-api-endpoints)
19. [Server — Controllers](#19-server--controllers)
20. [Server — Services](#20-server--services)
21. [Server — Utilities](#21-server--utilities)
22. [Server — Socket.IO (Real-Time)](#22-server--socketio-real-time)
23. [Data Flow Diagrams](#23-data-flow-diagrams)
24. [Authentication Flow](#24-authentication-flow)
25. [Key Design Decisions & Patterns](#25-key-design-decisions--patterns)

---

## 1. Project Overview

**Anime Tier List** is a full-stack web application where users can:

- Browse and search anime (powered by Jikan/MAL + AniList fallback)
- Drag-and-drop anime into tier rows (S / A / B / C)
- Save tier lists to the database (auto-saved on every change)
- Email their tier list to themselves or friends
- Get content-based AI recommendations using cosine similarity on genre vectors
- Track what they've watched / want to watch
- Add friends, send/receive friend requests
- Chat in real-time with friends via WebSocket
- View a friend's read-only tier list
- Create shared community tier board sessions with friends

**Stack:**
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Vanilla CSS |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Routing (Client) | React Router v6 |
| HTTP Client | Axios |
| Real-time | Socket.IO (client + server) |
| Backend | Node.js + Express 4 |
| Database | MongoDB via Mongoose 8 |
| Authentication | JWT stored in httpOnly cookies |
| Password Hashing | bcryptjs |
| Email | Nodemailer |
| External APIs | Jikan REST API v4 (primary), AniList GraphQL (fallback) |
| Caching | node-cache (server-side, in-memory) |

---

## 2. Directory Structure

```
anime-tier-list/
├── client/                      # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx             # React app bootstrap
│       ├── App.jsx              # Route definitions
│       ├── index.css            # Global reset
│       ├── socket.js            # Shared Socket.IO instance
│       ├── api/
│       │   └── axiosClient.js   # Configured Axios + interceptor
│       ├── context/
│       │   ├── AuthContext.jsx      # Auth state (user, login, logout)
│       │   └── WatchStatusContext.jsx # Watched/Watchlist ID sets
│       ├── components/
│       │   ├── CardActionOverlay.jsx  # Hover/tap popup for watch actions
│       │   ├── Carousel.jsx           # Auto-advancing image carousel
│       │   ├── ChatThread.jsx         # In-sidebar chat view
│       │   ├── ChatWidget.jsx         # Floating chat widget on friend page
│       │   ├── FriendsPanel.jsx       # Modal friends panel (tier board)
│       │   ├── FriendsSidebar.jsx     # Slide-out sidebar (dashboard)
│       │   ├── PosterRow.jsx          # Horizontal scrolling poster row
│       │   ├── ProtectedRoute.jsx     # Auth guard wrapper
│       │   ├── SwipeDeck.jsx          # Tinder-style swipe quiz
│       │   ├── TierDemo.jsx           # Animated demo on signup page
│       │   └── WatchedPromptGate.jsx  # Once-per-session swipe prompt
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── SignupPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── TierBoardPage.jsx      # Main tier list (largest file)
│       │   ├── FriendTierListPage.jsx # Read-only friend's tier list
│       │   └── ProfilePage.jsx        # User's watched/watchlist profile
│       ├── styles/
│       │   ├── auth.css
│       │   └── tierboard.css
│       └── utils/
│           └── franchise.js       # Franchise grouping utility
│
└── server/                      # Express backend
    ├── package.json
    └── src/
        ├── server.js            # App entry point + Socket.IO setup
        ├── config/
        │   └── db.js            # MongoDB connection
        ├── middleware/
        │   ├── auth.middleware.js  # JWT protect middleware
        │   └── errorHandler.js    # Global error handler
        ├── models/
        │   ├── User.js
        │   ├── TierList.js
        │   ├── FriendRequest.js
        │   ├── Friendship.js
        │   ├── Message.js
        │   ├── WatchedStatus.js
        │   ├── Watchlist.js
        │   └── CommunitySession.js
        ├── routes/
        │   ├── auth.routes.js
        │   ├── anime.routes.js
        │   ├── tierlist.routes.js
        │   ├── friends.routes.js
        │   ├── chat.routes.js
        │   ├── community.routes.js
        │   ├── watched.routes.js
        │   └── watchlist.routes.js
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── anime.controller.js
        │   ├── tierlist.controller.js
        │   ├── friends.controller.js
        │   ├── chat.controller.js
        │   ├── community.controller.js
        │   ├── watched.controller.js
        │   └── watchlist.controller.js
        ├── services/
        │   ├── jikan.service.js     # External anime API calls + caching
        │   ├── email.service.js     # Nodemailer transporter
        │   └── recommend.service.js # Content-based recommender (cosine similarity)
        └── utils/
            ├── asyncHandler.js      # Promise-catch wrapper for controllers
            └── friendship.js        # orderPair() + areFriends() helpers
```

---

## 3. Environment & Configuration

### Server `.env` Variables

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry duration (default: `7d`) |
| `PORT` | Server port (default: `5000`) |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `NODE_ENV` | `development` or `production` |
| `EMAIL_HOST` | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (e.g. `587`) |
| `EMAIL_USER` | SMTP username / sender email |
| `EMAIL_PASS` | SMTP password / app password |

### Client `.env` Variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL for API calls (e.g. `http://localhost:5000`) |

---

## 4. Client — Packages & Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | Core React library |
| `react-dom` | ^18.3.1 | DOM rendering for React |
| `react-router-dom` | ^6.26.2 | Client-side routing |
| `axios` | ^1.7.7 | HTTP client for API calls |
| `socket.io-client` | ^4.8.3 | WebSocket client (real-time chat) |
| `@dnd-kit/core` | ^6.1.0 | Drag-and-drop foundation |
| `@dnd-kit/sortable` | ^8.0.0 | Sortable lists on top of dnd-kit |
| `@dnd-kit/utilities` | ^3.2.2 | Utility hooks for dnd-kit |
| `react-icons` | ^5.7.0 | Icon library (`MdClose`, `MdCheck`, `MdArrowBack`, etc.) |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.0 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.3.1 | React Fast Refresh for Vite |
| `tailwindcss` | ^4.0.0 | Utility CSS (present in dev but minimal use) |
| `@tailwindcss/vite` | ^4.0.0 | Tailwind Vite plugin |

---

## 5. Server — Packages & Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | Web framework / HTTP server |
| `mongoose` | ^8.6.0 | MongoDB ODM (models, queries, schemas) |
| `jsonwebtoken` | ^9.0.2 | Sign and verify JWT tokens |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `cookie-parser` | ^1.4.6 | Parse cookies from incoming requests |
| `cors` | ^2.8.5 | CORS headers |
| `dotenv` | ^16.4.5 | Load `.env` file |
| `morgan` | ^1.10.0 | HTTP request logger (dev) |
| `express-rate-limit` | ^7.4.0 | Rate limiting middleware |
| `socket.io` | ^4.8.1 | WebSocket server |
| `axios` | ^1.7.7 | External API calls (Jikan, AniList) |
| `node-cache` | ^5.1.2 | In-memory TTL cache |
| `nodemailer` | ^6.9.14 | Email sending via SMTP |

---

## 6. Client — Entry Points

### `src/main.jsx`
Bootstraps the React application. Wraps everything in `React.StrictMode`, `BrowserRouter`, and `AuthProvider`.

### `src/App.jsx`
Defines all routes via React Router v6.

| Route | Component | Protected? |
|---|---|---|
| `/signup` | `SignupPage` | No |
| `/login` | `LoginPage` | No |
| `/dashboard` | `DashboardPage` | ✅ Yes |
| `/tierlist` | `TierBoardPage` | ✅ Yes |
| `/friend/:friendId` | `FriendTierListPage` | ✅ Yes |
| `/profile` | `ProfilePage` | ✅ Yes |
| `*` (catch-all) | `DashboardPage` | No |

---

## 7. Client — React Router (Pages)

### `pages/SignupPage.jsx`
Registration page. Left side shows animated `<TierDemo />`. Right side is registration form.

### `pages/LoginPage.jsx`
Login page. Left side shows marketing copy. Right side is login form.

### `pages/DashboardPage.jsx`
Hub page after login. Shows user's ranked anime, trending anime, and highlights in a coverflow layout. Slide-out sidebar for social/chat.

### `pages/TierBoardPage.jsx` ⭐ (665 lines — largest file)
The main ranking experience. Drag-and-drop anime cards into S/A/B/C tier rows from browse pool. Auto-saves on change. Supports filter, search, and AI recommendation modes.

---

## 8. Client — Context (Global State)

### `context/AuthContext.jsx`
Provides authentication state (`user`, `login`, `signup`, `logout`). The JWT lives in an httpOnly cookie.

### `context/WatchStatusContext.jsx`
Shares `watchedIds` and `watchlistIds` Sets with all `CardActionOverlay` instances to avoid per-card network calls.

---

## 9. Client — Components

- **`ProtectedRoute.jsx`**: Route guard redirecting to `/login` if unauthenticated.
- **`CardActionOverlay.jsx`**: Hover/tap popup portal allowing quick "Watched" and "Add to Watchlist" actions.
- **`Carousel.jsx`**: Auto-advancing image carousel with dot navigation.
- **`PosterRow.jsx`**: Horizontal scrollable poster row.
- **`ChatThread.jsx`**: Full-pane chat view used inside `FriendsSidebar`.
- **`ChatWidget.jsx`**: Floating minimizable chat widget on friend page.
- **`FriendsPanel.jsx`**: Modal overlay for searching users, managing requests, and viewing friends.
- **`FriendsSidebar.jsx`**: Slide-out drawer on dashboard for social management and chat.
- **`SwipeDeck.jsx`**: Tinder-style "Have you watched this?" card swipe quiz.
- **`WatchedPromptGate.jsx`**: Wrapper triggering `SwipeDeck` once per session.
- **`TierDemo.jsx`**: Animated demo tier rows on signup page.

---

## 10. Client — API Layer & Socket

- **`api/axiosClient.js`**: Configured Axios instance (`withCredentials: true`) with automatic 401 response interceptor for session expiry handling.
- **`src/socket.js`**: Shared Socket.IO client singleton configured for real-time chat and community tier board sync.

---

## 11. Server — Architecture & Mongoose Models

- **`User.js`**: `username`, `email`, `passwordHash` (hidden by default).
- **`TierList.js`**: `userId`, `category` ('anime'), `tiers` ({ S, A, B, C }).
- **`FriendRequest.js`**: `from`, `to`. Unique index on `(from, to)`.
- **`Friendship.js`**: `userA`, `userB` (normalized lexicographically via `orderPair()`).
- **`Message.js`**: `conversationId`, `from`, `text`.
- **`WatchedStatus.js`**: `userId`, `animeId`, `watched` (boolean).
- **`Watchlist.js`**: `userId`, `animeId`, `title`, `imageUrl`, `genres`.
- **`CommunitySession.js`**: `roomCode` (6 chars), `category`, `participants`, `tiers`.

---

## 12. Server — Services

### `services/jikan.service.js`
Primary external anime data provider. Intercepts calls, caches in memory via `node-cache`, retries failed requests, and falls back to AniList GraphQL API if Jikan experiences outages.

### `services/email.service.js`
Nodemailer SMTP integration for sending formatted HTML tier list summaries to friends.

### `services/recommend.service.js`
Content-based recommendation engine. Uses one-hot genre feature vectors + score dimension, builds a weighted taste profile from S/A tier picks, and computes cosine similarity against candidate anime (k-NN).

---

## 13. Server — Controllers & API Routes

- **`auth.controller.js`**: Signup, login (sets httpOnly cookie), logout, getMe.
- **`anime.controller.js`**: Top anime, title search, trending anime, genre list, by-genre query.
- **`tierlist.controller.js`**: Get tier list, autosave tier list, email export, get recommendations, friend tier list.
- **`friends.controller.js`**: User search with status annotation, send request, list requests, respond to request, list friends.
- **`chat.controller.js`**: Fetch 1:1 message history.
- **`community.controller.js`**: Create and fetch shared tier list sessions.
- **`watched.controller.js`**: Get quiz prompt, submit watch status, list watched.
- **`watchlist.controller.js`**: Add, list, and remove from watchlist.

---

## 14. Key Architecture Patterns

1. **httpOnly Cookie Auth**: JWT stored securely in httpOnly cookies (XSS resistant).
2. **Jikan -> AniList Fallback**: Automatic failover to AniList GraphQL when Jikan is down.
3. **`orderPair()` Normalization**: Lexicographical pair sorting ensures symmetric 1:1 friendships and chat rooms.
4. **Server-Authoritative Real-Time Chat**: Messages persisted to MongoDB before broadcasting via Socket.IO.
5. **Debounced Autosave**: Tier lists save state 800ms after user stops dragging.
6. **Content-Based Cosine Similarity**: Recommends anime based on mathematical vector alignment of user's favorite genres.

---

*Documentation compiled successfully for revision and learning.*

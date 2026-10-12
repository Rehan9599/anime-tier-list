# Codebase Audit — Issue Register

**Branch:** `v2.0` · **Commit:** `48bbf38` · **Date:** 2026-09-14
**Scope:** 62 source files across `client/src` and `server/src` (~8,900 lines)

A full read of the MERN client and server as they stand today — what works, what is
broken, and what has to change before this is a portfolio piece rather than a prototype.
**44 findings**, graded on the app's own S / A / B / C scale.

| Metric | Value |
|---|---|
| Source files audited | 62 |
| Automated tests | 0 |
| Lint / CI config | None |
| Dependency CVEs | 7 (1 high, 6 moderate) |
| Production client build | Compiles clean |

### Severity scale

| Tier | Meaning | Count |
|:--:|---|--:|
| **S** | Ship-blockers — security holes and silent data loss. Fix before this goes in front of anyone. | 7 |
| **A** | Real defects — bugs a user will hit in normal use, or crashes on ordinary bad input. | 15 |
| **B** | Engineering debt — what a reviewer looks for and doesn't find. This is the tier that costs you the job. | 16 |
| **C** | Polish — worth doing once the tiers above are clear. | 6 |

**Contents:** [S — Ship-blockers](#s--ship-blockers) · [A — Real defects](#a--real-defects) · [B — Engineering debt](#b--engineering-debt) · [C — Polish](#c--polish) · [What's already good](#whats-already-good) · [Proposed SDLC track](#proposed-sdlc-track)

---

## S — Ship-blockers

Each of these is either exploitable or loses user data without telling anyone.

### SEC-01 · Raw user input compiled into a MongoDB regex

`Injection`

Friend search passes the query string straight into `$regex` with no escaping. A search
for `(a+)+$` is a catastrophic-backtracking payload that pins the Node event loop — one
request takes the whole server down for every user. Metacharacters also let anyone
enumerate accounts far past what the UI intends.

- [`server/src/controllers/friends.controller.js:15`](../server/src/controllers/friends.controller.js#L15)

### SEC-02 · Tier list save accepts any JSON at any size

`Validation`

The save endpoint checks only that `tiers` is truthy, then writes it. Nothing caps the
number of entries, the length of a title, or the shape of the object — a scripted client
can push a document toward Mongo's 16 MB ceiling, and there is no per-user storage bound
at all. Those same unchecked titles are what the email exporter renders.

- [`server/src/controllers/tierlist.controller.js:39-49`](../server/src/controllers/tierlist.controller.js#L39-L49)
- [`server/src/models/TierList.js:23-28`](../server/src/models/TierList.js#L23-L28)

### SEC-03 · Username and titles interpolated raw into outgoing email HTML

`Injection`

The mail template builds its body with template literals and no escaping, so a username
or a tier-entry title containing markup is injected into every email sent. Combined with
SEC-02 this is attacker-controlled HTML delivered to up to five addresses of the
attacker's choosing, from your verified sending domain — a phishing primitive that also
torches your sender reputation.

- [`server/src/services/email.service.js:14-31`](../server/src/services/email.service.js#L14-L31)

### SEC-04 · The catch-all route renders the dashboard with no auth guard

`Auth`

Every route in the app is wrapped in `ProtectedRoute` except the wildcard, which renders
`DashboardPage` bare. A logged-out visitor to `/` mounts the authenticated dashboard,
fires four API calls that all 401, and gets a *"Your session has expired"* alert before
being bounced — on a session they never had. The landing experience for every first-time
visitor is an error dialog.

- [`client/src/App.jsx:31`](../client/src/App.jsx#L31)
- [`client/src/api/axiosClient.js:27-31`](../client/src/api/axiosClient.js#L27-L31)

### SEC-05 · Rate limiting is inert behind a proxy

`Deploy`

`app.set('trust proxy', …)` is never called. On Render, Railway, Fly or any load
balancer, every request arrives with the proxy's IP, so the login limiter's
30-per-15-minutes budget is shared by the entire internet instead of applied per client —
brute-forcing one account also locks out everyone else. express-rate-limit v7
additionally raises a validation error on this configuration.

- [`server/src/server.js:35-44`](../server/src/server.js#L35-L44)

### SEC-06 · Socket auth depends on an undeclared package

`Build`

`server.js` imports `cookie` to parse the WebSocket handshake, but `cookie` is not in
`package.json`. It resolves today only because socket.io happens to hoist it. The day a
transitive tree changes, a clean `npm ci` produces a server that crashes on boot — and it
will happen on the deploy, not on your machine.

- [`server/src/server.js:7`](../server/src/server.js#L7)
- [`server/package.json:9-23`](../server/package.json#L9-L23)

### DAT-01 · Autosave has no failure path

`Data loss`

The debounced save fires `await axiosClient.put(...)` inside a bare `setTimeout` with no
`try/catch`. If the request fails the promise rejects unhandled, the indicator sits on
*"saving"* forever, and there is no retry and no warning. The timer is also never cleared
on unmount and never flushed on `beforeunload`, so closing the tab within 800 ms of the
last drag discards it. **The core feature of the app loses work silently.**

- [`client/src/pages/TierBoardPage.jsx:445-452`](../client/src/pages/TierBoardPage.jsx#L445-L452)

---

## A — Real defects

Reachable in normal use. Several are one malformed URL away from a 500.

### BUG-01 · Chat history returns the oldest 200 messages, never the newest

`Chat`

`.sort({ createdAt: 1 }).limit(200)` sorts ascending *then* truncates. Past message 200
in a conversation, reopening the thread shows only the beginning of the history and none
of the recent messages. Sort descending, limit, then reverse — and paginate.

- [`server/src/controllers/chat.controller.js:12`](../server/src/controllers/chat.controller.js#L12)

### BUG-02 · The README's setup instructions cannot be followed

`Onboarding`

The README opens with `cd server && cp .env.example .env`. That file does not exist —
only the client has one. Ten environment variables are required to boot the server and
none of them are documented anywhere except in your own untracked `.env`. Nobody else can
run this project, which for a portfolio piece is close to fatal.

- [`README.md:11`](../README.md#L11)
- `server/` — missing `.env.example`

### BUG-03 · Unvalidated ObjectIds turn bad URLs into 500s

`Crash`

`/api/chat/xyz`, `/api/tierlist/friend/xyz`, and a `POST /api/friends/request` with a junk
`userId` all reach Mongoose with a non-castable id. The resulting `CastError` falls
through to the error handler as a 500 with the raw message. These should be 400s, and the
error handler should never echo internal messages to the client.

- [`server/src/controllers/chat.controller.js:6`](../server/src/controllers/chat.controller.js#L6)
- [`server/src/controllers/tierlist.controller.js:19`](../server/src/controllers/tierlist.controller.js#L19)
- [`server/src/controllers/friends.controller.js:49`](../server/src/controllers/friends.controller.js#L49)
- [`server/src/middleware/errorHandler.js:4`](../server/src/middleware/errorHandler.js#L4)

### BUG-04 · Login 500s when the password field is missing

`Crash`

`login` validates nothing before calling `bcrypt.compare(password, …)`. A POST with only
an email throws inside bcrypt. The same endpoint also leaks a timing signal: a nonexistent
email returns before any hash comparison, a real one after. `express-validator` is already
installed and never imported once.

- [`server/src/controllers/auth.controller.js:33-44`](../server/src/controllers/auth.controller.js#L33-L44)

### BUG-05 · Search results race; cleared queries keep stale results on screen

`React`

The debounced search has no abort signal and no request-sequence guard, so a slow response
for `"na"` can land after a fast one for `"naruto"` and overwrite it. The effect also
early-returns when the query drops below two characters without clearing state, so
emptying the box leaves the previous results rendered.

- [`client/src/pages/TierBoardPage.jsx:314-324`](../client/src/pages/TierBoardPage.jsx#L314-L324)

### BUG-06 · Nine fetches across the app have no error branch

`React`

Dashboard's four mount requests, the tier list load, the watch-status refresh, both friend
loaders and the sidebar search all end at `.then()`. Any failure is an unhandled rejection
and a permanently blank section with no message and no retry — the user sees an empty page
and assumes the app is broken.

- [`client/src/pages/DashboardPage.jsx:39-56`](../client/src/pages/DashboardPage.jsx#L39-L56)
- [`client/src/pages/TierBoardPage.jsx:344-347`](../client/src/pages/TierBoardPage.jsx#L344-L347)
- [`client/src/components/FriendsSidebar.jsx:33-38`](../client/src/components/FriendsSidebar.jsx#L33-L38)

### BUG-07 · Profile page hangs on "Loading…" forever if either request fails

`React`

`setLoading(false)` lives inside the `.then()` of a `Promise.all` with no `.catch()` and
no `.finally()`. One failed request and the page never renders anything else.

- [`client/src/pages/ProfilePage.jsx:32-40`](../client/src/pages/ProfilePage.jsx#L32-L40)

### BUG-08 · The watched-anime quiz marks itself shown before it loads

`React`

The gate writes `sessionStorage` first and fetches second. If that fetch fails — or the
user closes the tab mid-flight — the prompt is suppressed for the rest of the session and
never retried. Set the flag on success, or better, when the user actually dismisses it.

- [`client/src/components/WatchedPromptGate.jsx:13-16`](../client/src/components/WatchedPromptGate.jsx#L13-L16)

### BUG-09 · The socket connects before login and never disconnects after logout

`Sockets`

`socket.js` calls `io()` with `autoConnect: true` at module scope, and the module is in
the static import graph of the app shell. So the login page opens an authenticated
WebSocket, the handshake is rejected, and socket.io retries on a backoff loop for as long
as the page is open. Logout never calls `disconnect()`, so the previous user's socket
stays live and in its rooms until the tab is reloaded.

- [`client/src/socket.js:6-9`](../client/src/socket.js#L6-L9)
- [`client/src/context/AuthContext.jsx:30-33`](../client/src/context/AuthContext.jsx#L30-L33)

### BUG-10 · Carousel interval captures a stale closure, so its re-entry guard never fires

`React`

The auto-advance `setInterval` is created in an effect keyed on `items.length`, but it
calls `triggerSpin` — a function redefined every render. The interval keeps calling the
first render's copy, where `isSpinning` is permanently `false`, so the guard that is
supposed to prevent overlapping spins is dead code. The 420 ms timeout inside it is never
cleaned up either.

- [`client/src/components/StackedCarousel.jsx:9-26`](../client/src/components/StackedCarousel.jsx#L9-L26)

### BUG-11 · Network side effect performed inside a state updater

`React`

`scheduleSave()` is called from within the `setTiers` updater function. React treats
updaters as pure and invokes them twice under StrictMode, and may re-invoke them during
concurrent rendering. Compute the next tiers in the updater, then save from an effect
keyed on the result.

- [`client/src/pages/TierBoardPage.jsx:362-443`](../client/src/pages/TierBoardPage.jsx#L362-L443)

### BUG-12 · Watchlist writes an uncoerced id and deletes a coerced one

`Data model`

`addToWatchlist` stores `animeId` exactly as it arrives in the body;
`removeFromWatchlist` deletes on `Number(animeId)`. Non-numeric input yields `NaN` and a
delete that silently matches nothing, returning "Removed from watchlist." either way.
Coerce and validate at one boundary, and return 404 when nothing matched.

- [`server/src/controllers/watchlist.controller.js:4-29`](../server/src/controllers/watchlist.controller.js#L4-L29)

### BUG-13 · Read endpoints write, including into another user's data

`Data model`

`getTierList` creates a document on a GET, and two concurrent first-time requests race the
unique index into a duplicate-key 500. Worse, `getFriendTierList` creates a `TierList`
owned by *the friend* when they don't have one — viewing someone's profile writes a row
under their user id. Use an idempotent upsert, or return an empty shape without persisting.

- [`server/src/controllers/tierlist.controller.js:9-34`](../server/src/controllers/tierlist.controller.js#L9-L34)

### BUG-14 · The watched prompt issues up to eight sequential upstream calls per request

`Performance`

On a cold cache, `getPrompt` walks pages one at a time until it has collected ten unseen
titles — eight serial round trips to Jikan, each with an 8-second timeout and a retry, to
build a ten-card quiz. A heavy user with many answered titles hits the ceiling every time,
and Jikan's rate limit makes it worse, not better.

- [`server/src/controllers/watched.controller.js:8-31`](../server/src/controllers/watched.controller.js#L8-L31)

### BUG-15 · Untracked timers set state after unmount

`React`

The card overlay's two `setTimeout(closeNow, 700)` calls bypass the `closeTimeoutRef` that
the rest of the component uses for cleanup, so navigating away right after tapping Watched
or Watchlist fires a state update on an unmounted component.

- [`client/src/components/CardActionOverlay.jsx:91`](../client/src/components/CardActionOverlay.jsx#L91)
- [`client/src/components/CardActionOverlay.jsx:108`](../client/src/components/CardActionOverlay.jsx#L108)

---

## B — Engineering debt

This is the tier that decides whether the project reads as senior work. Nothing here is a
bug; all of it is what a reviewer checks for first.

### ENG-01 · No tests of any kind

`Testing`

Zero unit tests, zero integration tests, zero end-to-end tests, and no test runner
installed. The recommender in `recommend.service.js` and the franchise-grouping regex
chain in `franchise.js` are both pure functions with interesting edge cases — they are the
easiest, highest-signal tests in the repo and there are none.

- repo-wide

### ENG-02 · No linter, no formatter, no CI

`Tooling`

No ESLint config, no Prettier config, no `.github/workflows`. Every dead import and unused
variable listed below would have been caught for free on the first run. A green CI badge
is one of the cheapest credibility signals a portfolio repo can carry.

- repo-wide

### ENG-03 · Seven known vulnerabilities in shipped dependencies

`Security`

Server: one high and four moderate, including a nodemailer advisory allowing arbitrary
file read and SSRF through the message `raw` option, plus quadratic-time DoS in its
address parser — in a service you expose to user-supplied recipients. Client: two moderate
react-router advisories including an open redirect. No `npm audit` gate exists to catch
the next one.

- [`server/package.json`](../server/package.json)
- [`client/package.json`](../client/package.json)

### ENG-04 · No validation layer, despite one being installed

`Validation`

`express-validator` sits in dependencies and is imported by nothing. Every controller
hand-rolls a few `if (!x) return 400` checks and each does it slightly differently. One
schema-validation middleware applied at the route level would replace all of it and close
SEC-02, BUG-03, BUG-04 and BUG-12 in a single change.

- [`server/src/controllers/`](../server/src/controllers/)

### ENG-05 · Account lifecycle is a stub

`Auth`

No password strength rule — `"a"` is accepted. No email verification, so any address can
be claimed. No password reset, no change password, no account deletion, no way to revoke a
session before its 7-day JWT expires. A reviewer opening the auth controller sees the gaps
immediately.

- [`server/src/controllers/auth.controller.js`](../server/src/controllers/auth.controller.js)
- [`server/src/models/User.js`](../server/src/models/User.js)

### ENG-06 · TierBoardPage is 753 lines doing eight jobs

`Architecture`

One component owns drag-and-drop, browse pagination, search, recommendations, filter
state, autosave, email export and watch-status. Twenty-odd `useState` calls and six
effects with interlocking dependency arrays. This is the file a reviewer opens first
because it is the biggest, and it is the weakest argument in the repo. Split it into
hooks: `useTierList`, `useAnimePool`, `useWatchStatus`.

- [`client/src/pages/TierBoardPage.jsx`](../client/src/pages/TierBoardPage.jsx)

### ENG-07 · An entire feature is built server-side with no client

`Dead code`

Shared community sessions have a model, two routes, a controller, room-code generation and
three socket handlers. Nothing in the client references `/api/community`, `roomCode` or the
`session:*` events. Either finish it — it's the most impressive thing in the backend — or
cut it. Leaving it half-wired reads as abandoned work.

- [`server/src/controllers/community.controller.js`](../server/src/controllers/community.controller.js)
- [`server/src/server.js:136-169`](../server/src/server.js#L136-L169)

### ENG-08 · Dead imports and unused state across the client

`Dead code`

`Carousel.jsx` is imported by nothing. `TierBoardPage` imports `FriendsPanel`,
`FriendsSidebar` and five icons it never renders, and declares a `profileOpen` state it
never reads. `DashboardPage` imports `PosterRow` and never uses it.

- [`client/src/components/Carousel.jsx`](../client/src/components/Carousel.jsx)
- [`client/src/pages/TierBoardPage.jsx:6-13`](../client/src/pages/TierBoardPage.jsx#L6-L13)
- [`client/src/pages/TierBoardPage.jsx:141`](../client/src/pages/TierBoardPage.jsx#L141)
- [`client/src/pages/DashboardPage.jsx:8`](../client/src/pages/DashboardPage.jsx#L8)

### ENG-09 · FriendsPanel and FriendsSidebar are near-identical

`Duplication`

Two components, ~340 lines, same three tabs, same loaders, same request handlers,
differing mainly in whether the tab state is local or controlled. One of them is
unreachable. Delete it and keep the controlled version.

- [`client/src/components/FriendsPanel.jsx`](../client/src/components/FriendsPanel.jsx)
- [`client/src/components/FriendsSidebar.jsx`](../client/src/components/FriendsSidebar.jsx)

### ENG-10 · The core interaction is keyboard-inaccessible

`Accessibility`

Only `PointerSensor` is registered with dnd-kit. `KeyboardSensor` exists in the same
package and is not used, so the entire ranking feature — the whole product — is unusable
without a mouse. The peek strips in the carousel are click-handling `div`s with no role,
no tabindex and no label.

- [`client/src/pages/TierBoardPage.jsx:490-494`](../client/src/pages/TierBoardPage.jsx#L490-L494)
- [`client/src/components/StackedCarousel.jsx:72-85`](../client/src/components/StackedCarousel.jsx#L72-L85)

### ENG-11 · Cache stampede, unbounded keys, and search that never caches

`Caching`

`NodeCache` is created with no `maxKeys`, and the genre cache keys on `genre:page` without
limit — memory grows with traffic and is never bounded. Concurrent requests on a cache
miss all call Jikan rather than sharing one in-flight promise. Search results aren't cached
at all, so every keystroke past the debounce is a live upstream call. And because the cache
is process-local, a second instance serves different data.

- [`server/src/services/jikan.service.js:6`](../server/src/services/jikan.service.js#L6)
- [`server/src/services/jikan.service.js:124-191`](../server/src/services/jikan.service.js#L124-L191)

### ENG-12 · Native alert() used for user-facing feedback

`UX`

Three `alert()` calls — session expiry, email success, email failure. Blocking, unstyled,
unbranded, and untestable. The app already has a `.tier-error` style and a `poolError`
pattern; use it.

- [`client/src/api/axiosClient.js:29`](../client/src/api/axiosClient.js#L29)
- [`client/src/pages/TierBoardPage.jsx:462`](../client/src/pages/TierBoardPage.jsx#L462)
- [`client/src/pages/TierBoardPage.jsx:464`](../client/src/pages/TierBoardPage.jsx#L464)

### ENG-13 · "Top 20 / 30 / 50" counts franchises, not anime

`Correctness`

The limit is applied after `groupByFranchise`, so "Top 20" renders 20 franchise *groups*
drawn from however many titles collapsed into them. The number on the button doesn't
describe what's on screen. Either label it honestly or apply the limit before grouping.

- [`client/src/pages/TierBoardPage.jsx:259-262`](../client/src/pages/TierBoardPage.jsx#L259-L262)

### ENG-14 · Dashboard renders a score it never fetches

`Correctness`

`renderRankedItem` guards on `a.score != null`, but the flattening step above it maps only
`id`, `title`, `imageUrl` and `tier`. The star rating on ranked cards can never appear.
Dead branch, or a dropped field — either way it has been shipping.

- [`client/src/pages/DashboardPage.jsx:42-44`](../client/src/pages/DashboardPage.jsx#L42-L44)
- [`client/src/pages/DashboardPage.jsx:74`](../client/src/pages/DashboardPage.jsx#L74)

### ENG-15 · Repo hygiene and documentation drift

`Hygiene`

A stray ` (2).gitignore` — leading space and all — is tracked at the root. Commit messages
read `workoingg`, `bug fixedd`, `new feature`; there is no branch or commit convention.
`DOCUMENTATION.md` describes TierBoardPage as 665 lines when it is 753, so the docs have
already drifted from the code they describe.

- ` (2).gitignore`
- [`DOCUMENTATION.md:265`](../DOCUMENTATION.md#L265)
- `git log`

### ENG-16 · No baseline HTTP hardening

`Hardening`

No `helmet`, no compression, no body-size limit on `express.json()`, no request id, no
structured logging, and no `/api/health` check that actually verifies the database
connection. The global error handler returns `err.message` verbatim, which leaks Mongoose
and driver internals to the client on any unhandled failure.

- [`server/src/server.js:35-55`](../server/src/server.js#L35-L55)
- [`server/src/middleware/errorHandler.js`](../server/src/middleware/errorHandler.js)

---

## C — Polish

Worth a pass once S through B are clear.

### PLH-01 · No loading skeletons and no React error boundary

`UX`

Sections pop in from empty with no intermediate state, and a render-time exception
anywhere blanks the whole app to a white screen.

- [`client/src/`](../client/src/)

### PLH-02 · The genre taxonomy is hand-synced across the stack

`Duplication`

Twelve genres are defined in the server's `GENRE_MAP` and again in the client's `GENRES`
array, with a comment on each asking the reader to keep them in sync manually. Serve it
from `/api/anime/genres` — the endpoint already exists and nothing calls it.

- [`server/src/controllers/anime.controller.js:26-43`](../server/src/controllers/anime.controller.js#L26-L43)
- [`client/src/pages/TierBoardPage.jsx:37-51`](../client/src/pages/TierBoardPage.jsx#L37-L51)

### PLH-03 · Chat messages carry no conversation id

`Sockets`

The broadcast payload omits `conversationId`, so a client in two rooms at once appends
messages from the wrong thread. Room membership happens to prevent this today; a payload
field would make it structurally impossible.

- [`server/src/server.js:118-123`](../server/src/server.js#L118-L123)

### PLH-04 · Silent dead-end when a genre runs out of results

`UX`

The browse backfill loop stops at page 8 with no message. A narrow genre filter simply
stops loading and the user is left looking at a short list with no explanation of why.

- [`client/src/pages/TierBoardPage.jsx:273`](../client/src/pages/TierBoardPage.jsx#L273)

### PLH-05 · No pagination on any list endpoint

`Data`

Friends, watched, watchlist and requests all return every row. Fine at current scale,
awkward in an architecture discussion.

- [`server/src/controllers/`](../server/src/controllers/)

### PLH-06 · Nothing is containerised or reproducible

`Ops`

No Dockerfile, no compose file, no Node version pin in either `package.json`, no deploy
configuration. "Works on my machine" is currently the only supported environment.

- repo-wide

---

## What's already good

Keep these. They are the parts that already argue for you, and a rewrite should not lose
them.

**The upstream resilience chain.** Jikan with a retry, falling back to AniList on a
different vendor, falling back to a 24-hour stale cache, and only then a friendly 503.
Score normalisation between the two sources. This is genuinely thoughtful and rare in a
project this size. — `server/src/services/jikan.service.js`

**Pair-ordering as an invariant.** `orderPair()` normalises `(A,B)` and `(B,A)` to one
key, then that same key backs the unique index, the conversation id and the socket room.
One idea, reused three times, correct in all three. — `server/src/utils/friendship.js`

**httpOnly cookie auth, applied consistently.** No token in localStorage, correct
`sameSite` and `secure` flags by environment, and the socket handshake verified the same
way the REST middleware does rather than with a second scheme.

**The recommender is real work.** Genre one-hot vectors with a down-weighted score
dimension, a tier-weighted profile vector, cosine similarity, vocabulary built dynamically
because the two upstream sources disagree on taxonomy. It is well reasoned and it is the
strongest thing to talk about in an interview. — `server/src/services/recommend.service.js`

**Comments explain why, not what.** The IPv4-first DNS note in `server.js`, the dnd-kit
activation-distance note, the honest limits documented in `franchise.js`. This is the
habit most junior codebases lack entirely.

**Consistent server structure.** routes → controllers → services → models, with
`asyncHandler` applied uniformly. The skeleton is sound; what it's missing is a validation
layer and tests, not a redesign.

---

## Proposed SDLC track

Seven phases. Each ends in a reviewable artifact, so the process itself becomes part of
what the project demonstrates.

The findings above are the input to phase 2, not a to-do list to start burning down today.
Fixing bugs in commit order produces a fixed app; running them through a process produces
evidence that you can run a process — which is the thing a hiring reviewer is actually
trying to assess.

**01 · Requirements & scope**
Write down what this product is, who it's for, and which of the half-finished features
survive. The shared community board (ENG-07) is the first decision: finish it or cut it.
Functional and non-functional requirements, and an explicit out-of-scope list.
*Artifact:* SRS, user stories with acceptance criteria, MoSCoW-prioritised backlog

**02 · Triage & plan**
Convert these 44 findings into tracked issues with labels, estimates and a milestone each.
Group them into releases: v2.1 security, v2.2 stability, v2.3 quality. This audit becomes
the traceability record.
*Artifact:* GitHub Projects board, three milestones, issue templates, branching policy

**03 · Design**
Before touching code: the validation-layer design that closes four findings at once, the
state architecture that breaks up TierBoardPage, an ER diagram of the seven models, and a
sequence diagram for the socket auth handshake. Decisions recorded as ADRs.
*Artifact:* architecture doc, ER + sequence diagrams, ADR-001…n, OpenAPI spec

**04 · Build the safety net**
Vitest and Supertest, ESLint and Prettier, a GitHub Actions workflow running lint → test →
build → `npm audit` on every push. Characterisation tests over the recommender and the
franchise grouper *before* any refactor, so the refactor is provably behaviour-preserving.
*Artifact:* green CI on every PR, coverage baseline, branch protection on `main`

**05 · Implementation, in severity order**
S tier first, one PR per issue, each with a failing test that the fix turns green. Then A,
then B. Every PR references its issue id; the git history becomes a readable record of
deliberate work instead of `bug fixedd`.
*Artifact:* ~44 traceable PRs, conventional commits, a CHANGELOG

**06 · Verification**
Playwright over the critical paths — signup, rank, autosave, reload, chat. A documented
security re-test of the S-tier findings. Lighthouse and an axe accessibility pass to close
ENG-10 with numbers rather than assertions.
*Artifact:* test plan, E2E suite in CI, before/after Lighthouse and axe reports

**07 · Release & operate**
Dockerise both services, pin Node, deploy from CI on a tagged release, add error tracking
and structured logs, and rewrite the README so a stranger can run the project in two
commands — which today they cannot.
*Artifact:* Dockerfiles, deploy pipeline, live URL, runbook, honest README

> **The one thing to fix before anything else — BUG-02.**
> Right now nobody but you can start this server: there is no `.env.example` and the ten
> required variables are undocumented. Everything else in this register assumes a reviewer
> can actually run the thing.

---

## Method & limits

Static review of branch `v2.0` at commit `48bbf38`, covering 62 source files across
`client/src` and `server/src`. Findings were read from source; the production client build
was verified to compile (`vite build`, 148 modules, clean). Dependency counts come from
`npm audit --omit=dev` on both workspaces. **No runtime or penetration testing was
performed**, so this register is a floor on what's present, not a ceiling.

A rendered version of this report is published at
<https://claude.ai/code/artifact/5acb6ce6-997a-46ab-8a18-a12bfba24389>.

# Audit Bug-Fix Checklist

This checklist tracks the audit findings being addressed manually. The IDs match
the findings in [AUDIT.md](./AUDIT.md).

## S — Ship-blockers

- [x] **BUG-01** — Return the newest chat messages instead of the oldest 200.
- [x] **BUG-02** — Add the server environment template referenced by the README.
- [x] **BUG-03** — Validate MongoDB ObjectIds before controller queries.
- [x] **BUG-04** — Validate login credentials before calling bcrypt.
- [x] **BUG-05** — Prevent stale anime search results and clear results for short queries.
- [x] **BUG-06** — Add failure handling for dashboard, tier-board, and friends-sidebar fetches.
- [x] **BUG-07** — Prevent the profile page from hanging when profile requests fail.
- [x] **BUG-08** — Mark the watched prompt as shown only after a successful load or dismissal.
- [x] **BUG-09** — Connect the socket only after login and disconnect it on logout.
- [x] **BUG-10** — Prevent overlapping carousel spins and clean up spin timers.
- [x] **BUG-11** — Move tier-list autosave out of the React state updater.
- [x] **BUG-12** — Normalize and validate watchlist IDs for add/remove operations.
- [x] **BUG-13** — Make tier-list read endpoints non-mutating.
- [x] **BUG-14** — Bound watched-prompt upstream calls into concurrent page batches.
- [x] **BUG-15** — Track card-action close timers through unmount cleanup.
- [x] **SEC-01** — Escape and validate friend-search input before using it in a MongoDB regex.
- [x] **SEC-02** — Validate tier-list structure, item fields, entry limits, duplicates, and request size before saving.
- [x] **SEC-03** — HTML-escape usernames and tier titles before inserting them into email HTML.
- [x] **SEC-04** — Ensure the catch-all route cannot render the authenticated dashboard without `ProtectedRoute`.
- [x] **SEC-05** — Configure rate limiting correctly when running behind a trusted proxy.
- [x] **SEC-06** — Declare `cookie` as a direct server dependency.
- [ ] **DAT-01** — Add a failure path and lifecycle handling to tier-list autosave.

## Notes

BUG-01 through BUG-15 and SEC-01 through SEC-06 are marked complete based on the
current source review, successful production build, JavaScript syntax checks, and
server clean-install dry run. The repository has no automated test script.

DAT-01 remains incomplete. The current autosave has failure handling and timer
cleanup, but no pending-save flush or retry lifecycle for navigation, tab close,
or a failed save request.

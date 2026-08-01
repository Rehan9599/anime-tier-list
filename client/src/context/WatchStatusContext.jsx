import { createContext, useContext } from 'react';

// Lets any CardActionOverlay instance check "is this anime already
// watched/watchlisted?" without a network call per card or per tap --
// TierBoardPage fetches both ID sets once and provides them here, so this
// context is just the read (and refresh) side.
const WatchStatusContext = createContext({
  watchedIds: new Set(),
  watchlistIds: new Set(),
  refresh: () => {},
});

export const WatchStatusProvider = WatchStatusContext.Provider;
export const useWatchStatus = () => useContext(WatchStatusContext);

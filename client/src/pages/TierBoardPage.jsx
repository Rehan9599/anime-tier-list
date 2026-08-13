import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { MdSpaceDashboard } from 'react-icons/md';
import { MdChatBubbleOutline, MdNotificationsNone, MdLogout, MdClose, MdChevronLeft, MdChevronRight, MdExpandMore } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { groupByFranchise } from '../utils/franchise';
import FriendsPanel from '../components/FriendsPanel';
import FriendsSidebar from '../components/FriendsSidebar';
import CardActionOverlay from '../components/CardActionOverlay';
import { WatchStatusProvider } from '../context/WatchStatusContext';
import '../styles/tierboard.css';

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_STYLES = {
  S: 'tier-row--s',
  A: 'tier-row--a',
  B: 'tier-row--b',
  C: 'tier-row--c',
};

// Up to this many cards fit at normal size in a tier row before shrinking
// kicks in. Beyond that, cards shrink proportionally instead of wrapping
// to a second line -- wrapping is what was growing the row's height and
// pushing every tier below it further down the page. Floored at 45% so
// cards never shrink into illegibility even with a very large tier.
const COMFORTABLE_TIER_COUNT = 10;
const MIN_CARD_SCALE = 0.45;
const cardScale = (count) => {
  if (count <= COMFORTABLE_TIER_COUNT) return 1;
  return Math.max(MIN_CARD_SCALE, COMFORTABLE_TIER_COUNT / count);
};

// Kept in sync with GENRE_MAP in server/src/controllers/anime.controller.js.
const GENRES = [
  { key: 'action', label: 'Action' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'comedy', label: 'Comedy' },
  { key: 'drama', label: 'Drama' },
  { key: 'fantasy', label: 'Fantasy' },
  { key: 'horror', label: 'Horror' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'romance', label: 'Romance' },
  { key: 'sci-fi', label: 'Sci-Fi' },
  { key: 'slice of life', label: 'Slice of Life' },
  { key: 'sports', label: 'Sports' },
  { key: 'supernatural', label: 'Supernatural' },
];
const GENRE_KEYS = new Set(GENRES.map((g) => g.key));

// A draggable anime card. `containerId` just keeps dnd-kit ids unique
// between the pool and the tier rows -- it isn't used for logic.
const Card = ({ anime, containerId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${containerId}:${anime.id}`,
    data: { anime },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="tier-card">
      <img src={anime.imageUrl} alt={anime.title} className="w-full h-24 object-cover" />
      <p>{anime.title}</p>
    </div>
  );
};

const StackedCard = ({ group, expanded, onToggle }) => (
  <div className="tier-stack">
    <div className="tier-stack-primary">
      <CardActionOverlay anime={group.primary}>
        <Card anime={group.primary} containerId="pool" />
      </CardActionOverlay>
      {group.related.length > 0 && (
        <button type="button" className="tier-stack-badge" onClick={onToggle}>
          +{group.related.length}
        </button>
      )}
    </div>
    {expanded && group.related.length > 0 && (
      <div className="tier-stack-overlay">
        <button type="button" className="tier-stack-close" onClick={onToggle} aria-label="Close">
          ×
        </button>
        {[group.primary, ...group.related].map((anime) => (
          <CardActionOverlay key={anime.id} anime={anime}>
            <Card anime={anime} containerId="pool" />
          </CardActionOverlay>
        ))}
      </div>
    )}
  </div>
);

const DropZone = ({ id, className, style, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isOver ? 'ring-2 ring-amber-300/50' : ''}`}>
      {children}
    </div>
  );
};

const TierBoardPage = () => {
  const [mode, setMode] = useState('filter'); // 'filter' | 'recommend' | 'search'
  const [query, setQuery] = useState('');
  const [tiers, setTiers] = useState({ S: [], A: [], B: [], C: [] });
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [basedOnGenres, setBasedOnGenres] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'
  const [poolError, setPoolError] = useState('');
  const saveTimeout = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Closes the filter dropdown on a tap/click anywhere outside it.
  useEffect(() => {
    if (!filterOpen) return;
    const handleOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [filterOpen]);

  // Every anime.id currently sitting in a tier -- used to hide already-placed
  // cards from the browse/search pool so they don't show up twice.
  const placedIds = useMemo(() => {
    const ids = new Set();
    TIERS.forEach((t) => tiers[t].forEach((a) => ids.add(a.animeId)));
    return ids;
  }, [tiers]);

  useEffect(() => {
    setExpandedGroupKey(null);
  }, [mode]);

  // --- Filter: Top-N size + combinable tags (genres, Watched, Watchlist) ---
  const [limit, setLimit] = useState(20);
  const [selectedTags, setSelectedTags] = useState(new Set());

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // Stable-ordered (insertion order, which Sets guarantee) list of selected
  // genre tags, separate from the special 'watched'/'watchlist' tags.
  const genreTags = useMemo(() => [...selectedTags].filter((t) => GENRE_KEYS.has(t)), [selectedTags]);
  const hasWatchedTag = selectedTags.has('watched');
  const hasWatchlistTag = selectedTags.has('watchlist');

  // Every result -- regardless of which source it came from -- passes
  // through this before being shown, so combining tags always means AND
  // (must match every selected genre), not OR.
  const matchesAllGenres = useCallback(
    (anime) => {
      if (genreTags.length === 0) return true;
      const animeGenres = (anime.genres || []).map((g) => g.toLowerCase());
      return genreTags.every((g) => animeGenres.includes(g));
    },
    [genreTags]
  );

  const filterLabel = () => {
    if (mode !== 'filter') return 'Filter';
    const parts = [];
    if (hasWatchedTag) parts.push('Watched');
    if (hasWatchlistTag) parts.push('Watchlist');
    genreTags.forEach((g) => parts.push(GENRES.find((x) => x.key === g)?.label || g));
    if (parts.length === 0) return `Top ${limit}`;
    return parts.join(' + ');
  };

  // --- Personal-list source: Watched and/or Watchlist tags -----------------
  const [personalItems, setPersonalItems] = useState([]);

  useEffect(() => {
    if (mode !== 'filter' || (!hasWatchedTag && !hasWatchlistTag)) return;
    setPoolError('');
    const requests = [];
    if (hasWatchedTag) requests.push(axiosClient.get('/api/watched'));
    if (hasWatchlistTag) requests.push(axiosClient.get('/api/watchlist'));

    Promise.all(requests)
      .then((responses) => {
        const seen = new Set();
        const merged = [];
        responses.forEach((res) => {
          res.data.items.forEach((i) => {
            if (!seen.has(i.animeId)) {
              seen.add(i.animeId);
              merged.push({ id: i.animeId, title: i.title, imageUrl: i.imageUrl, genres: i.genres || [] });
            }
          });
        });
        setPersonalItems(merged);
      })
      .catch((err) => setPoolError(err.response?.data?.message || 'Could not load your list.'));
  }, [mode, hasWatchedTag, hasWatchlistTag]);

  const visiblePersonal = useMemo(
    () => personalItems.filter((a) => !placedIds.has(a.id) && matchesAllGenres(a)),
    [personalItems, placedIds, matchesAllGenres]
  );

  // --- Browse source: Top-N or genre-anchored, paginated with backfill ----
  const primaryGenre = genreTags[0] || null;

  const [browsePages, setBrowsePages] = useState([]);
  const [browsePageCursor, setBrowsePageCursor] = useState(1);
  const [browseHasNextPage, setBrowseHasNextPage] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browseLoadingRef = useRef(false);

  // Resets pagination only when the PRIMARY genre changes (or toggles
  // on/off) -- adding a second genre tag on top of an unchanged primary
  // just narrows the client-side filter further, it doesn't need a refetch.
  useEffect(() => {
    setBrowsePages([]);
    setBrowsePageCursor(1);
    setBrowseHasNextPage(true);
  }, [primaryGenre]);

  const visibleBrowseGroups = useMemo(() => {
    const unplaced = browsePages.filter((a) => !placedIds.has(a.id) && matchesAllGenres(a));
    return groupByFranchise(unplaced).slice(0, limit);
  }, [browsePages, placedIds, matchesAllGenres, limit]);

  useEffect(() => {
    if (mode !== 'filter' || hasWatchedTag || hasWatchlistTag) return;
    if (visibleBrowseGroups.length >= limit) return;
    if (!browseHasNextPage || browseLoadingRef.current) return;
    if (browsePageCursor > 8) return;

    browseLoadingRef.current = true;
    setBrowseLoading(true);

    const url = primaryGenre
      ? `/api/anime/genre?genre=${encodeURIComponent(primaryGenre)}&page=${browsePageCursor}`
      : `/api/anime/top?page=${browsePageCursor}`;

    axiosClient
      .get(url)
      .then((res) => {
        setPoolError('');
        setBrowsePages((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const merged = [...prev];
          res.data.results.forEach((a) => {
            if (!seen.has(a.id)) merged.push(a);
          });
          return merged;
        });
        setBrowseHasNextPage(res.data.hasNextPage);
        setBrowsePageCursor((p) => p + 1);
      })
      .catch((err) => {
        setPoolError(err.response?.data?.message || 'Could not load anime right now.');
        setBrowseHasNextPage(false);
      })
      .finally(() => {
        browseLoadingRef.current = false;
        setBrowseLoading(false);
      });
  }, [mode, hasWatchedTag, hasWatchlistTag, visibleBrowseGroups.length, limit, browseHasNextPage, browsePageCursor, primaryGenre]);

  // --- Search ---------------------------------------------------------
  const [searchResults, setSearchResults] = useState([]);
  const visibleSearch = useMemo(
    () => searchResults.filter((a) => !placedIds.has(a.id)),
    [searchResults, placedIds]
  );

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) return;
    const t = setTimeout(() => {
      setPoolError('');
      axiosClient
        .get(`/api/anime/search?q=${encodeURIComponent(query)}`)
        .then((res) => setSearchResults(res.data.results))
        .catch((err) => setPoolError(err.response?.data?.message || 'Search failed. Try again.'));
    }, 300);
    return () => clearTimeout(t);
  }, [mode, query]);

  // --- Recommended ---------------------------------------------------------
  useEffect(() => {
    if (mode !== 'recommend') return;
    setRecommendLoading(true);
    setPoolError('');
    axiosClient
      .get('/api/tierlist/recommendations?category=anime')
      .then((res) => {
        setRecommendations(res.data.recommendations);
        setBasedOnGenres(res.data.basedOnGenres);
      })
      .catch((err) => {
        setPoolError(err.response?.data?.message || 'Could not get recommendations right now.');
        setRecommendations([]);
      })
      .finally(() => setRecommendLoading(false));
  }, [mode]);

  // --- Tier list load / autosave ---------------------------------------
  useEffect(() => {
    axiosClient.get('/api/tierlist?category=anime').then((res) => {
      setTiers(res.data.tierList.tiers);
    });
  }, []);

  const scheduleSave = useCallback((nextTiers) => {
    setSaveStatus('saving');
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await axiosClient.put('/api/tierlist', { category: 'anime', tiers: nextTiers });
      setSaveStatus('saved');
    }, 800);
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const anime = active.data.current.anime;
    const destination = over.id; // 'tier-S' | 'tier-A' | 'tier-B' | 'tier-C' | 'pool'

    setTiers((prev) => {
      const cleaned = Object.fromEntries(
        TIERS.map((t) => [t, prev[t].filter((a) => a.animeId !== anime.id)])
      );

      if (destination === 'pool') {
        scheduleSave(cleaned);
        return cleaned;
      }

      if (!destination.startsWith('tier-')) return prev;

      const tierKey = destination.replace('tier-', '');
      const next = {
        ...cleaned,
        [tierKey]: [
          ...cleaned[tierKey],
          { animeId: anime.id, title: anime.title, imageUrl: anime.imageUrl, genres: anime.genres || [], score: anime.score ?? null },
        ],
      };
      scheduleSave(next);
      return next;
    });
  };

  // --- Email export ---------------------------------------------------
  const [recipientsInput, setRecipientsInput] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle');

  const handleEmail = async () => {
    setEmailStatus('sending');
    try {
      const recipients = recipientsInput.trim()
        ? recipientsInput.split(',').map((e) => e.trim()).filter(Boolean)
        : undefined;
      const res = await axiosClient.post('/api/tierlist/email', { category: 'anime', recipients });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not send email.');
    } finally {
      setEmailStatus('idle');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Powers "already watched" / "on your watchlist" status shown in
  // CardActionOverlay -- fetched once as plain ID sets so every card can
  // check its own status with a Set.has() instead of a network call per tap.
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  const refreshWatchStatus = useCallback(() => {
    Promise.all([axiosClient.get('/api/watched'), axiosClient.get('/api/watchlist')]).then(
      ([watchedRes, watchlistRes]) => {
        setWatchedIds(new Set(watchedRes.data.items.map((i) => i.animeId)));
        setWatchlistIds(new Set(watchlistRes.data.items.map((i) => i.animeId)));
      }
    );
  }, []);

  useEffect(() => {
    refreshWatchStatus();
  }, [refreshWatchStatus]);

  // Without an activation distance, dnd-kit's PointerSensor starts tracking
  // a potential drag on the very first pixel of movement -- and suppresses
  // the browser's normal click event even for a tap with zero movement.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const pool = mode === 'search' ? visibleSearch : recommendations.filter((a) => !placedIds.has(a.id));

  const displayName = user?.username || user?.email?.split('@')[0] || 'Profile';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <WatchStatusProvider value={{ watchedIds, watchlistIds, refresh: refreshWatchStatus }}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="tier-page">
          <header className="tier-topbar">
            <div className="tier-brand">
              <div className="tier-brand-mark">◎</div>
              <div className="tier-brand-copy">
                <h1 className="tier-brand-title">Tier List Hub</h1>
                <p className="tier-brand-subtitle">Your rankings, your rules.</p>
              </div>
            </div>

            <div className="tier-topbar-actions">
              <button type="button" className="tier-icon-btn" onClick={() => navigate('/dashboard')} aria-label="Dashboard">
                <MdSpaceDashboard size={20} />
              </button>
              <div className="tier-profile">
                <button type="button" className="tier-icon-btn" onClick={() => navigate('/profile')} aria-label="Profile">
                  <span className="tier-avatar tier-avatar--sm">{avatarLabel || 'U'}</span>
                </button>
              </div>
              <button type="button" className="tier-icon-btn" onClick={handleLogout} aria-label="Logout">
                <MdLogout size={20} />
              </button>
            </div>
          </header>

          <div className="tier-shell">
            <main className="tier-dashboard">
              <section className="tier-panel tier-panel--left">
                <div className="tier-controls">
                  <div className="tier-filter-wrap" ref={filterRef}>
                    <button
                      type="button"
                      onClick={() => setFilterOpen((o) => !o)}
                      className={`tier-control tier-filter-btn ${mode === 'filter' ? 'is-active' : ''}`}
                    >
                      {filterLabel()}
                      <MdExpandMore size={16} />
                    </button>

                    {filterOpen && (
                      <div className="tier-filter-dropdown">
                        <div className="tier-filter-section">
                          <span className="tier-filter-heading">Show</span>
                          <div className="tier-filter-subtags">
                            {[20, 30, 50].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  setMode('filter');
                                  setLimit(n);
                                }}
                                className={`tier-control tier-control--sub ${mode === 'filter' && limit === n ? 'is-active' : ''}`}
                              >
                                Top {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="tier-filter-section">
                          <span className="tier-filter-heading">Tags</span>
                          <div className="tier-filter-subtags">
                            <button
                              type="button"
                              onClick={() => {
                                setMode('filter');
                                toggleTag('watched');
                              }}
                              className={`tier-control tier-control--sub ${hasWatchedTag ? 'is-active' : ''}`}
                            >
                              Watched
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMode('filter');
                                toggleTag('watchlist');
                              }}
                              className={`tier-control tier-control--sub ${hasWatchlistTag ? 'is-active' : ''}`}
                            >
                              Watchlist
                            </button>
                            {GENRES.map((g) => (
                              <button
                                key={g.key}
                                type="button"
                                onClick={() => {
                                  setMode('filter');
                                  toggleTag(g.key);
                                }}
                                className={`tier-control tier-control--sub ${selectedTags.has(g.key) ? 'is-active' : ''}`}
                              >
                                {g.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('recommend');
                      setFilterOpen(false);
                    }}
                    className={`tier-control ${mode === 'recommend' ? 'is-active' : ''}`}
                  >
                    Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('search');
                      setFilterOpen(false);
                    }}
                    className={`tier-control ${mode === 'search' ? 'is-active' : ''}`}
                  >
                    Search
                  </button>
                </div>

                {mode === 'search' && (
                  <input
                    className="tier-search"
                    placeholder="Search anime by name..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                )}
                {mode === 'recommend' && basedOnGenres.length > 0 && (
                  <p className="tier-muted">Based on your S/A picks: {basedOnGenres.join(', ')}</p>
                )}

                {poolError && <p className="tier-error">{poolError}</p>}

                <DropZone id="pool" className="tier-pool">
                  {mode === 'filter' &&
                    (hasWatchedTag || hasWatchlistTag) &&
                    visiblePersonal.map((anime) => (
                      <CardActionOverlay key={anime.id} anime={anime}>
                        <Card anime={anime} containerId="pool" />
                      </CardActionOverlay>
                    ))}
                  {mode === 'filter' &&
                    !hasWatchedTag &&
                    !hasWatchlistTag &&
                    visibleBrowseGroups.map((group) => (
                      <StackedCard
                        key={group.key}
                        group={group}
                        expanded={expandedGroupKey === group.key}
                        onToggle={() => setExpandedGroupKey((k) => (k === group.key ? null : group.key))}
                      />
                    ))}
                  {(mode === 'search' || mode === 'recommend') &&
                    pool.map((anime) => (
                      <CardActionOverlay key={anime.id} anime={anime}>
                        <Card anime={anime} containerId="pool" />
                      </CardActionOverlay>
                    ))}
                  {mode === 'filter' && !hasWatchedTag && !hasWatchlistTag && browseLoading && (
                    <p className="tier-loading">Loading more…</p>
                  )}
                </DropZone>
              </section>

              <section className="tier-ranking-panel">
                <div className="tier-ranking-head">
                  <div className="tier-ranking-copy">
                    <p className="tier-ranking-kicker">Tier ranking</p>
                    <h2 className="tier-ranking-title">Arrange the lineup</h2>
                    <span className="tier-muted tier-ranking-subtitle">
                      {mode === 'filter' && `Browsing: ${filterLabel()}`}
                      {mode === 'recommend' && 'Picked based on your S/A tier'}
                      {mode === 'search' && 'Search for any anime title'}
                    </span>
                  </div>

                  <div className="tier-ranking-actions">
                    <div className="tier-email-actions">
                      <input
                        type="text"
                        placeholder="Friend's email (optional)"
                        value={recipientsInput}
                        onChange={(e) => setRecipientsInput(e.target.value)}
                        className="tier-email-input"
                      />
                      <button type="button" onClick={handleEmail} disabled={emailStatus === 'sending'} className="tier-email-button">
                        {emailStatus === 'sending' ? 'Sending…' : 'Email list'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="tier-ranking-stack">
                  {TIERS.map((t) => (
                    <section key={t} className={`tier-section ${TIER_STYLES[t]}`}>
                      <div className="tier-row">
                        <div className="tier-row-label">{t}</div>
                        <DropZone
                          id={`tier-${t}`}
                          className="tier-row-drop"
                          style={{ '--card-scale': cardScale(tiers[t].length) }}
                        >
                          {tiers[t].map((anime) => (
                            <CardActionOverlay
                              key={anime.animeId}
                              anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl, genres: anime.genres || [] }}
                            >
                              <Card
                                anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl }}
                                containerId={`tier-${t}`}
                              />
                            </CardActionOverlay>
                          ))}
                        </DropZone>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            </main>
          </div>
        </div>
      </DndContext>
    </WatchStatusProvider>
  );
};

export default TierBoardPage;

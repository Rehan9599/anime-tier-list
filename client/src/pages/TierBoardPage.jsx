import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const FILTER_SEASONS = [
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];

const FILTER_FORMATS = [
  { value: 'TV', label: 'TV Show' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'MUSIC', label: 'Music' },
];

const FILTER_YEARS = Array.from(
  { length: new Date().getFullYear() - 1980 + 1 },
  (_, index) => new Date().getFullYear() - index
);
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

// A sortable anime card inside tier rows supporting intra-tier & cross-tier reordering.
const SortableCard = ({ anime, tier }) => {
  const cardId = anime.animeId || anime.id;
  const sortableId = `tier-${tier}:${cardId}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { anime: { id: cardId, ...anime }, tier },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
  const tiersLoadedRef = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tierListError, setTierListError] = useState('');
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
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const activateFilterMode = () => {
  setMode('filter');
  setFilterOpen(true);
};

  // Stable-ordered (insertion order, which Sets guarantee) list of selected
  // genre tags, separate from the special 'watched'/'watchlist' tags.
  const genreTags = useMemo(() => [...selectedTags].filter((t) => GENRE_KEYS.has(t)), [selectedTags]);
  const hasWatchedTag = selectedTags.has('watched');
  const hasWatchlistTag = selectedTags.has('watchlist');

  // Every result -- regardless of which source it came from -- passes
  // through this before being shown, so combining tags always means AND
  // (must match every selected genre), not OR.
  const matchesSelectedFilters = useCallback(
  (anime) => {
    const animeGenres = (anime.genres || []).map((genre) =>
      genre.toLowerCase()
    );

    if (
      genreTags.length > 0 &&
      !genreTags.every((genre) => animeGenres.includes(genre))
    ) {
      return false;
    }

    if (
      selectedYear &&
      Number(anime.year) !== Number(selectedYear)
    ) {
      return false;
    }

    if (
      selectedSeason &&
      anime.season !== selectedSeason
    ) {
      return false;
    }

    if (
      selectedFormat &&
      anime.format !== selectedFormat
    ) {
      return false;
    }

    return true;
  },
  [genreTags, selectedYear, selectedSeason, selectedFormat]
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
              merged.push({
                id: i.animeId,
                title: i.title,
                imageUrl: i.imageUrl,
                genres: i.genres || [],
                year: i.year ?? null,
                season: i.season || null,
                format: i.format || null,
              });
            }
          });
        });
        setPersonalItems(merged);
      })
      .catch((err) => setPoolError(err.response?.data?.message || 'Could not load your list.'));
  }, [mode, hasWatchedTag, hasWatchlistTag]);

  const visiblePersonal = useMemo(
    () => personalItems.filter((a) => !placedIds.has(a.id) && matchesSelectedFilters(a)),
    [personalItems, placedIds, matchesSelectedFilters]
  );

  // --- Browse source: Top-N or genre-anchored, paginated with backfill ----
  const primaryGenre = genreTags[0] || null;

  const [browsePages, setBrowsePages] = useState([]);
  const [browsePageCursor, setBrowsePageCursor] = useState(1);
  const [browseHasNextPage, setBrowseHasNextPage] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browseLoadingRef = useRef(false);
  const browseRequestIdRef = useRef(0);

  // Resets pagination only when the PRIMARY genre changes (or toggles
  // on/off) -- adding a second genre tag on top of an unchanged primary
  // just narrows the client-side filter further, it doesn't need a refetch.
  useEffect(() => {
    browseRequestIdRef.current += 1;
    browseLoadingRef.current = false;

    setBrowsePages([]);
    setBrowsePageCursor(1);
    setBrowseHasNextPage(true);
    setBrowseLoading(false);
  }, [
    primaryGenre,
    selectedYear,
    selectedSeason,
    selectedFormat,
  ]);

  const visibleBrowseGroups = useMemo(() => {
    const unplaced = browsePages.filter((a) => !placedIds.has(a.id) && matchesSelectedFilters(a));
    return groupByFranchise(unplaced).slice(0, limit);
  }, [browsePages, placedIds, matchesSelectedFilters, limit]);

  useEffect(() => {
    if (mode !== 'filter' || hasWatchedTag || hasWatchlistTag) {
      return undefined;
    }

    if (visibleBrowseGroups.length >= limit) {
      return undefined;
    }

    if (!browseHasNextPage || browseLoadingRef.current) {
      return undefined;
    }

    if (browsePageCursor > 8) {
      return undefined;
    }

    const requestId = browseRequestIdRef.current;
    const controller = new AbortController();

    browseLoadingRef.current = true;
    setBrowseLoading(true);

    const params = new URLSearchParams({
      page: String(browsePageCursor),
    });

    if (primaryGenre) {
      params.set('genre', primaryGenre);
    }

    if (selectedYear) {
      params.set('year', selectedYear);
    }

    if (selectedSeason) {
      params.set('season', selectedSeason);
    }

    if (selectedFormat) {
      params.set('format', selectedFormat);
    }

    const url = `/api/anime/top?${params.toString()}`;

    axiosClient
      .get(url, { signal: controller.signal })
      .then((res) => {
        if (requestId !== browseRequestIdRef.current) return;

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
        if (
          err.name === 'CanceledError' ||
          err.code === 'ERR_CANCELED' ||
          err.name === 'AbortError'
        ) {
          return;
        }

        if (requestId !== browseRequestIdRef.current) return;

        setPoolError(err.response?.data?.message || 'Could not load anime right now.');
        setBrowseHasNextPage(false);
      })
      .finally(() => {
        if (requestId === browseRequestIdRef.current) {
          browseLoadingRef.current = false;
          setBrowseLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    mode,
    hasWatchedTag,
    hasWatchlistTag,
    visibleBrowseGroups.length,
    limit,
    browseHasNextPage,
    browsePageCursor,
    primaryGenre,
    selectedYear,
    selectedSeason,
    selectedFormat,
  ]);

  // --- Search ---------------------------------------------------------
  const [searchResults, setSearchResults] = useState([]);
  const visibleSearch = useMemo(
    () => searchResults.filter((a) => !placedIds.has(a.id)),
    [searchResults, placedIds]
  );

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (mode !== 'search') {setSearchResults([]);return undefined;}
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setPoolError('');
      return undefined;
    }
    const controller = new AbortController();
    let isCurrentRequest = true;

    const timeoutId = setTimeout(async () => {
      setPoolError('');

      try {
        const res = await axiosClient.get(
          `/api/anime/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal }
        );

        if (isCurrentRequest) {
          setSearchResults(res.data.results);
        }
      } catch (err) {
        if (
          err.name === 'CanceledError' ||
          err.code === 'ERR_CANCELED'
        ) {
          return;
        }

        if (isCurrentRequest) {
          setPoolError(
            err.response?.data?.message || 'Search failed. Try again.'
          );
        }
      }
    }, 300);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
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
    let mounted = true;

    axiosClient
      .get('/api/tierlist?category=anime')
      .then((res) => {
        if (mounted) {
          tiersLoadedRef.current = true;
          setTiers(res.data.tierList.tiers);
          setTierListError('');
        }
      })
      .catch((err) => {
        if (mounted) {
          setTierListError(
            err.response?.data?.message || 'Could not load your tier list.'
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    return () => {
      clearTimeout(saveTimeout.current);
    };
  }, []);
  const scheduleSave = useCallback((nextTiers) => {
    setSaveStatus('saving');
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try{
        await axiosClient.put('/api/tierlist', { category: 'anime', tiers: nextTiers });
        setSaveStatus('saved');
      }catch(err){
        console.error("autosave failed",err);
        setSaveStatus('error');
      }
    }, 800);
  }, []);

  useEffect(() => {
    if (!tiersLoadedRef.current) return;
    scheduleSave(tiers);
  }, [tiers, scheduleSave]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeAnime = active.data.current?.anime;
    if (!activeAnime) return;

    const activeId = activeAnime.id || activeAnime.animeId;
    const overId = String(over.id);

    let destTier = null;
    let targetAnimeId = null;

    if (overId === 'pool') {
      destTier = 'pool';
    } else if (overId.startsWith('tier-')) {
      const parts = overId.split(':');
      destTier = parts[0].replace('tier-', '');
      if (parts.length > 1) {
        targetAnimeId = Number(parts[1]);
      }
    } else {
      return;
    }

    setTiers((prev) => {
      let sourceTier = null;
      for (const t of TIERS) {
        if (prev[t].some((a) => a.animeId === activeId)) {
          sourceTier = t;
          break;
        }
      }

      if (destTier === 'pool') {
        if (!sourceTier) return prev;
        const cleaned = {
          ...prev,
          [sourceTier]: prev[sourceTier].filter((a) => a.animeId !== activeId),
        };
        return cleaned;
      }

      if (!TIERS.includes(destTier)) return prev;

      const itemToInsert = {
        animeId: activeId,
        title: activeAnime.title,
        imageUrl: activeAnime.imageUrl,
        genres: activeAnime.genres || [],
        score: activeAnime.score ?? null,
        year: activeAnime.year ?? null,
        season: activeAnime.season ?? null,
        format: activeAnime.format ?? null,
      };

      if (sourceTier === destTier) {
        const items = [...prev[destTier]];
        const oldIndex = items.findIndex((a) => a.animeId === activeId);
        let newIndex = targetAnimeId !== null ? items.findIndex((a) => a.animeId === targetAnimeId) : items.length - 1;

        if (oldIndex === -1) return prev;
        if (newIndex === -1) newIndex = items.length - 1;
        if (oldIndex === newIndex) return prev;

        const nextTierItems = arrayMove(items, oldIndex, newIndex);
        const next = { ...prev, [destTier]: nextTierItems };
        return next;
      }

      const cleaned = Object.fromEntries(
        TIERS.map((t) => [t, prev[t].filter((a) => a.animeId !== activeId)])
      );

      const destItems = [...cleaned[destTier]];
      let insertIndex = destItems.length;
      if (targetAnimeId !== null) {
        const foundIndex = destItems.findIndex((a) => a.animeId === targetAnimeId);
        if (foundIndex !== -1) insertIndex = foundIndex;
      }

      destItems.splice(insertIndex, 0, itemToInsert);

      const next = {
        ...cleaned,
        [destTier]: destItems,
      };
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
  const [watchStatusError, setWatchStatusError] = useState('');
  const refreshWatchStatus = useCallback(() => {
    return Promise.all([
      axiosClient.get('/api/watched'),
      axiosClient.get('/api/watchlist'),
    ])
      .then(([watchedRes, watchlistRes]) => {
        setWatchedIds(
          new Set(watchedRes.data.items.map((item) => item.animeId))
        );
        setWatchlistIds(
          new Set(watchlistRes.data.items.map((item) => item.animeId))
        );
        setWatchStatusError('');
      })
      .catch((err) => {
        setWatchStatusError(
          err.response?.data?.message ||
            'Could not load watched and watchlist status.'
        );
      });
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
                      Filter
                      <MdExpandMore size={16} />
                    </button>

                    {filterOpen && (
                      <div className="tier-filter-dropdown">
                        <button
                          type="button"
                          className="card-action-close"
                          onClick={() => setFilterOpen(false)}
                          aria-label="Close"
                        >
                          <MdClose size={16} />
                        </button>
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

                        <div className="tier-filter-section">
                          <span className="tier-filter-heading">Year</span>
                          <div className="tier-filter-subtags">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedYear('');
                                activateFilterMode();
                              }}
                              className={`tier-control tier-control--sub ${
                                !selectedYear ? 'is-active' : ''
                              }`}
                            >
                              Any
                            </button>
                            {FILTER_YEARS.map((year) => (
                              <button
                                key={year}
                                type="button"
                                onClick={() => {
                                  setSelectedYear(String(year));
                                  activateFilterMode();
                                }}
                                className={`tier-control tier-control--sub ${
                                  selectedYear === String(year) ? 'is-active' : ''
                                }`}
                              >
                                {year}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="tier-filter-section">
                          <span className="tier-filter-heading">Season</span>
                          <div className="tier-filter-subtags">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSeason('');
                                activateFilterMode();
                              }}
                              className={`tier-control tier-control--sub ${
                                !selectedSeason ? 'is-active' : ''
                              }`}
                            >
                              Any
                            </button>
                            {FILTER_SEASONS.map((season) => (
                              <button
                                key={season.value}
                                type="button"
                                onClick={() => {
                                  setSelectedSeason(season.value);
                                  activateFilterMode();
                                }}
                                className={`tier-control tier-control--sub ${
                                  selectedSeason === season.value ? 'is-active' : ''
                                }`}
                              >
                                {season.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="tier-filter-section">
                          <span className="tier-filter-heading">Format</span>
                          <div className="tier-filter-subtags">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormat('');
                                activateFilterMode();
                              }}
                              className={`tier-control tier-control--sub ${
                                !selectedFormat ? 'is-active' : ''
                              }`}
                            >
                              Any
                            </button>
                            {FILTER_FORMATS.map((format) => (
                              <button
                                key={format.value}
                                type="button"
                                onClick={() => {
                                  setSelectedFormat(format.value);
                                  activateFilterMode();
                                }}
                                className={`tier-control tier-control--sub ${
                                  selectedFormat === format.value ? 'is-active' : ''
                                }`}
                              >
                                {format.label}
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
                  <p className="tier-muted">based on your history{basedOnGenres.join(', ')}</p>
                )}

                {poolError && <p className="tier-error">{poolError}</p>}
                {watchStatusError && (
                  <div className="tier-error" role="alert">
                    {watchStatusError}
                  </div>
                )}
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
                    {/* <span className="tier-muted tier-ranking-subtitle">
                      {mode === 'filter' && `Browsing: ${filterLabel()}`}
                      {mode === 'recommend' && 'Picked based on your S/A tier'}
                      {mode === 'search' && 'Search for any anime title'}
                    </span> */}
                  </div>
                  {tierListError && (
                    <div className="tier-error" role="alert">
                      {tierListError}
                    </div>
                  )}
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
                          <SortableContext
                            items={tiers[t].map((anime) => `tier-${t}:${anime.animeId}`)}
                            strategy={rectSortingStrategy}
                          >
                            {tiers[t].map((anime) => (
                              <CardActionOverlay
                                key={anime.animeId}
                                anime={{
                                  id: anime.animeId,
                                  title: anime.title,
                                  imageUrl: anime.imageUrl,
                                  genres: anime.genres || [],
                                  score: anime.score ?? null,
                                  year: anime.year ?? null,
                                  season: anime.season ?? null,
                                  format: anime.format ?? null,
                                }}
                              >
                                <SortableCard
                                  anime={anime}
                                  tier={t}
                                />
                              </CardActionOverlay>
                            ))}
                          </SortableContext>
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

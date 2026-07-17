// Content-based recommender: represents each anime as a genre feature
// vector (plus a score dimension), builds a weighted "taste profile"
// vector from the user's S/A tier picks, then ranks candidate anime by
// cosine similarity to that profile -- i.e. k-nearest-neighbors with k=5,
// using cosine distance instead of Euclidean (standard for sparse
// binary/one-hot feature vectors like genre membership, since it ignores
// magnitude and only cares about direction/overlap).

// S-tier picks count for more than A-tier when building the profile --
// your favorites should pull recommendations toward them harder than
// your "pretty good" picks do.
const TIER_WEIGHTS = { S: 2, A: 1 };

// A single extra dimension for score, appended after the one-hot genre
// dimensions. Weighted down so genre overlap (many dimensions) dominates
// over a single numeric feature -- this is a minor tie-breaker, not the
// main signal.
const SCORE_FEATURE_WEIGHT = 0.5;

// Every genre string seen across the user's S/A picks and the candidate
// pool becomes one dimension. Built dynamically (not a hardcoded genre
// list) since Jikan and AniList don't use identical genre taxonomies.
const buildVocabulary = (items) => {
  const set = new Set();
  items.forEach((item) => (item.genres || []).forEach((g) => set.add(g)));
  return [...set];
};

const vectorize = (anime, vocabulary) => {
  const genreSet = new Set(anime.genres || []);
  const vector = vocabulary.map((g) => (genreSet.has(g) ? 1 : 0));
  vector.push(((anime.score || 0) / 10) * SCORE_FEATURE_WEIGHT);
  return vector;
};

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Weighted average of the user's S/A tier feature vectors -- the
// "taste profile" we find nearest neighbors against.
const buildProfileVector = (tiers, vocabulary) => {
  const dims = vocabulary.length + 1;
  const sum = new Array(dims).fill(0);
  let totalWeight = 0;

  for (const tierKey of Object.keys(TIER_WEIGHTS)) {
    const weight = TIER_WEIGHTS[tierKey];
    for (const item of tiers[tierKey] || []) {
      const vec = vectorize(item, vocabulary);
      for (let i = 0; i < dims; i++) sum[i] += vec[i] * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return sum.map((x) => x / totalWeight);
};

// The genres that most strongly define the user's profile -- purely for
// showing a human-readable "based on: Action, Shounen, Adventure" line,
// not used in the math itself.
const topProfileGenres = (tiers, n = 3) => {
  const counts = new Map();
  for (const tierKey of Object.keys(TIER_WEIGHTS)) {
    const weight = TIER_WEIGHTS[tierKey];
    for (const item of tiers[tierKey] || []) {
      (item.genres || []).forEach((g) => counts.set(g, (counts.get(g) || 0) + weight));
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([genre]) => genre);
};

// candidates: pool of anime to rank (already excludes anything the user
// has placed in any tier). Returns the top `k` by cosine similarity to
// the user's S/A profile, plus the genres that profile is built from.
export const recommend = (tiers, candidates, k = 5) => {
  const vocabulary = buildVocabulary([...(tiers.S || []), ...(tiers.A || []), ...candidates]);
  const profile = buildProfileVector(tiers, vocabulary);

  if (!profile) return { recommendations: [], basedOnGenres: [] };

  const scored = candidates
    .map((anime) => ({
      ...anime,
      similarity: cosineSimilarity(vectorize(anime, vocabulary), profile),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return {
    recommendations: scored.slice(0, k),
    basedOnGenres: topProfileGenres(tiers),
  };
};

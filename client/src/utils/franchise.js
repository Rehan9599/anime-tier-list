// Groups anime that are almost certainly the same underlying franchise
// (different seasons, parts, or movies of the same series) so the browse
// pool shows one card per franchise instead of every season separately.
//
// This is a title heuristic, not a real relations graph -- Jikan's list
// endpoints don't return relation data cheaply (would need one extra API
// call per anime, which blows through Jikan's rate limit fast), and
// AniList's relations field would only cover pairs actually returned in
// the same query. A regex-based normalizer needs zero extra requests and
// catches the large majority of real cases (Season N, Part N, Final
// Season, well-known named sequels like Shippuden/Brotherhood), but it
// will miss sequels with an unrelated-sounding subtitle (e.g. "Steins;Gate
// 0", "Code Geass R2") since there's no generic pattern to detect those.

export const franchiseKey = (title) => {
  let key = title.toLowerCase();

  // Trailing year/format marker in parens, e.g. "Hunter x Hunter (2011)"
  key = key.replace(/\s*\((\d{4}|tv|ova|movie|special)\)\s*$/i, '');

  // Season/part/cour markers -- one combined pattern so a generic "season"
  // match can't consume the word before a more specific one (like
  // "final season" or "season 3 part 2") gets a chance to match.
  key = key.replace(
    /\s*[-:]?\s*((the\s+)?(\d+(st|nd|rd|th)?\s+)?(final\s+)?season(\s+\d+)?(\s+part\s+\d+)?|part\s*\d+|cour\s*\d+|s\d+)\s*$/i,
    ''
  );

  // Trailing sequel numerals (arabic or roman), standalone at the end only
  key = key.replace(/\s+(ii|iii|iv|v|vi|2|3|4|5|6|7)\s*$/i, '');

  // Movie/OVA/special/film suffix phrases
  key = key.replace(/\s*[-:]?\s+(the movie|movie|ova|special|picture drama|film)\b.*$/i, '');

  // A short, deliberately conservative list of well-known sequel monikers
  // that aren't generic patterns (proper nouns, not "Season N").
  key = key.replace(/\s+(shippuden|kai|brotherhood|next generations)\s*$/i, '');

  key = key.replace(/[^a-z0-9]+/g, ' ').trim();
  return key;
};

// items: anime already in rank/relevance order (matters -- the first
// occurrence of a key becomes the group's primary/cover card, later ones
// become "related", so the highest-ranked entry of a franchise is what
// shows up front).
export const groupByFranchise = (items) => {
  const map = new Map();
  for (const item of items) {
    const key = franchiseKey(item.title);
    if (!map.has(key)) {
      map.set(key, { key, primary: item, related: [] });
    } else {
      map.get(key).related.push(item);
    }
  }
  return [...map.values()];
};
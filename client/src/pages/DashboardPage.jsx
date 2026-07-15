import { Link } from 'react-router-dom';

// Only anime is wired up for now. Adding movies/games later is just
// flipping `active: true` here once their API routes exist -- the tier
// board and autosave code underneath don't change.
const categories = [
  { key: 'animes', label: 'Anime', active: true, to: '/tierlist' },
  { key: 'movies', label: 'Movies', active: false },
  { key: 'games', label: 'Games', active: false },
];

const DashboardPage = () => (
  <div className="max-w-2xl mx-auto mt-16 p-6">
    <h1 className="text-xl font-medium mb-6">Pick a category</h1>
    <div className="grid grid-cols-3 gap-4">
      {categories.map((c) =>
        c.active ? (
          <Link
            key={c.key}
            to={c.to}
            className="border rounded-xl p-6 text-center hover:border-black transition"
          >
            {c.label}
          </Link>
        ) : (
          <div key={c.key} className="border rounded-xl p-6 text-center text-gray-400">
            {c.label}
            <span className="block text-xs mt-1">Coming soon</span>
          </div>
        )
      )}
    </div>
  </div>
);

export default DashboardPage;

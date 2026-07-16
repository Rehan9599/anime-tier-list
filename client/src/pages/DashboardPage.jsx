import { Link } from 'react-router-dom';
import '../styles/auth.css';
import '../styles/dashboard.css';

// Only anime is wired up for now. Adding movies/games later is just
// flipping `active: true` here once their API routes exist -- the tier
// board and autosave code underneath don't change.
const categories = [
  { key: 'animes', label: 'Anime', active: true, to: '/tierlist' },
  { key: 'movies', label: 'Movies', active: false },
  { key: 'games', label: 'Games', active: false },
];

const dashboardHighlights = [
  {
    label: 'Anime live now',
    value: 'Drop straight into the tier board',
    description: 'Browse the current anime catalog, drag titles into tiers, and autosave your picks.',
  },
  {
    label: 'Movies next',
    value: 'Coming in the same visual system',
    description: 'New categories will reuse the same themed routes, cards, and save flow.',
  },
  {
    label: 'Games later',
    value: 'Ready when the API route is wired',
    description: 'The dashboard already has a slot waiting for the next category to go live.',
  },
];

const DashboardPage = () => (
  <div className="auth-page dashboard-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
    <span className="auth-orb auth-orb-one" aria-hidden="true" />
    <span className="auth-orb auth-orb-two" aria-hidden="true" />
    <span className="auth-orb auth-orb-three" aria-hidden="true" />

    <div className="dashboard-shell">
      <section className="auth-story dashboard-hero auth-reveal">
        <div className="auth-form-shell relative z-10">
          <span className="auth-kicker">Anime Tier List</span>
          <h2 className="auth-heading">
            <span className="auth-heading-accent">Choose a category</span> and start ranking
          </h2>
          <p className="auth-subheading">
            The dashboard shares the same dark glass theme as auth and the tier board, so moving between pages feels seamless.
          </p>

          <div className="auth-points">
            {dashboardHighlights.map((item, index) => (
              <article key={item.label} className={`auth-point auth-reveal auth-delay-${index + 1}`}>
                <p className="auth-point-label">{item.label}</p>
                <p className="auth-point-value">{item.value}</p>
                <p className="auth-meta-text mt-2 text-sm">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="auth-card dashboard-panel auth-reveal">
        <div className="auth-form-shell relative z-10">
          <header className="auth-form-header">
            <p className="auth-form-kicker">Dashboard</p>
            <h1 className="auth-form-title">Pick your lane</h1>
            <p className="auth-form-copy">
              Anime is ready now. The other categories are reserved for future routes and will light up when they are wired up.
            </p>
          </header>

          <div className="dashboard-grid" role="list" aria-label="Categories">
            {categories.map((c) =>
              c.active ? (
                <Link key={c.key} to={c.to} className="dashboard-tile dashboard-tile--active" role="listitem">
                  <span className="dashboard-tile-badge">Ready</span>
                  <span className="dashboard-tile-title">{c.label}</span>
                  <span className="dashboard-tile-copy">Open the tier board and start sorting anime.</span>
                  <span className="dashboard-tile-action">Enter tier board</span>
                </Link>
              ) : (
                <div key={c.key} className="dashboard-tile dashboard-tile--inactive" role="listitem" aria-disabled="true">
                  <span className="dashboard-tile-badge dashboard-tile-badge--muted">Soon</span>
                  <span className="dashboard-tile-title">{c.label}</span>
                  <span className="dashboard-tile-copy">This category is waiting for its route and data source.</span>
                  <span className="dashboard-tile-action dashboard-tile-action--muted">Coming soon</span>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  </div>
);

export default DashboardPage;

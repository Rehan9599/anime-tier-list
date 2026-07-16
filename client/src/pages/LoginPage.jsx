import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

const loginHighlights = [
  {
    label: 'Fast access',
    value: 'Jump back into your list in seconds',
    description: 'No clutter, just a focused sign in flow that gets you back to ranking quickly.',
  },
  {
    label: 'Saved progress',
    value: 'Pick up from where you left off',
    description: 'Your tiers, picks, and session data stay ready whenever you return.',
  },
  {
    label: 'Protected session',
    value: 'Secure cookie-based auth',
    description: 'Sign in once and keep your session managed on the server side.',
  },
];

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <span className="auth-orb auth-orb-one" aria-hidden="true" />
      <span className="auth-orb auth-orb-two" aria-hidden="true" />
      <span className="auth-orb auth-orb-three" aria-hidden="true" />

      <div className="auth-shell">
        <section className="auth-story auth-reveal">
          <div className="auth-form-shell relative z-10">
            <span className="auth-kicker">Anime Tier List</span>
            <h2 className="auth-heading">
              <span className="auth-heading-accent">Welcome back</span> to your rankings
            </h2>
            <p className="auth-subheading">
              Sign in to continue organizing your favorites, revisit your saved tiers, and keep the flow moving.
            </p>

            <div className="auth-points">
              {loginHighlights.map((item, index) => (
                <article key={item.label} className={`auth-point auth-reveal auth-delay-${index + 1}`}>
                  <p className="auth-point-label">{item.label}</p>
                  <p className="auth-point-value">{item.value}</p>
                  <p className="auth-meta-text mt-2 text-sm">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-card auth-reveal">
          <div className="auth-form-shell relative z-10">
            <header className="auth-form-header">
              <p className="auth-form-kicker">Log in</p>
              <h1 className="auth-form-title">Continue your session</h1>
              <p className="auth-form-copy">Enter the email you used to create your account and jump straight back in.</p>
            </header>

            {error && <div className="auth-alert" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input
                  className="auth-input"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Password</span>
                <input
                  className="auth-input"
                  placeholder="Your password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <button className="auth-button" type="submit">
                Log in
              </button>
            </form>

            <p className="auth-footer">
              No account yet? <Link to="/signup" className="auth-link">Create one</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

const signupHighlights = [
  {
    label: 'Quick setup',
    value: 'Build your profile in under a minute',
    description: 'Create an account, save your preferences, and start ranking right away.',
  },
  {
    label: 'Organized tiers',
    value: 'Keep every anime in the right place',
    description: 'Manage your favorites, re-order lists, and stay consistent across visits.',
  },
  {
    label: 'Animated focus',
    value: 'Motion that feels alive, not noisy',
    description: 'Subtle floating lights and reveal timing add energy without distracting from the form.',
  },
];

const SignupPage = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(form);
      navigate('/tierlist');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
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
              <span className="auth-heading-accent">Create your account</span> and start building
            </h2>
            <p className="auth-subheading">
              Set up your profile once, then keep every favorite anime, tier decision, and saved list in one place.
            </p>

            <div className="auth-meta">
              {signupHighlights.map((item, index) => (
                <article key={item.label} className={`auth-meta-item auth-reveal auth-delay-${index + 1}`}>
                  <div className="auth-meta-badge">0{index + 1}</div>
                  <div>
                    <p className="auth-meta-title">{item.value}</p>
                    <p className="auth-meta-text">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-card auth-reveal">
          <div className="auth-form-shell relative z-10">
            <header className="auth-form-header">
              <p className="auth-form-kicker">Sign up</p>
              <h1 className="auth-form-title">Create your profile</h1>
              <p className="auth-form-copy">Choose a username, add your email, and set a password to get started.</p>
            </header>

            {error && <div className="auth-alert" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <span className="auth-label">Username</span>
                <input
                  className="auth-input"
                  placeholder="Your username"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </label>

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
                  placeholder="Create a password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <button className="auth-button" type="submit">
                Sign up
              </button>
            </form>

            <p className="auth-footer">
              Already have an account? <Link to="/login" className="auth-link">Log in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SignupPage;

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TierDemo from '../components/TierDemo';
import '../styles/auth.css';

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
              <span className="auth-heading-accent">Rank your anime.</span> Your rules.
            </h2>
            <TierDemo />
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

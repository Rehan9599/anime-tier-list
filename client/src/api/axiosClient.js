import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

// A 401 from these endpoints means "wrong credentials" (a failed login/signup
// attempt) -- that's handled locally by the form itself. A 401 from anywhere
// else means the session died (missing/expired JWT cookie), which is what
// the global handler below is actually for.
// These endpoints intentionally handle authentication state themselves. In
// particular, /me returns 401 for an expired session and must not trigger the
// global redirect while AuthContext is determining whether a user is signed in.
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/me',
  '/api/auth/logout',
];

// Guards against every simultaneous request that happens to fail at once
// (e.g. a page that fires several API calls on mount) all showing their own
// alert and each trying to redirect. Resets naturally on the next full page
// load, since this module gets re-evaluated fresh after the redirect below.
let sessionExpiredHandled = false;

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

    if (status === 401 && !isAuthEndpoint && !sessionExpiredHandled) {
      sessionExpiredHandled = true;
      alert('Your session has expired. Please log in again.');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default axiosClient;

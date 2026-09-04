import api from './evaluation';

/**
 * Authentication API client for students and admins.
 */

/**
 * Log in a user (student or admin) with email and password.
 * @param {object} credentials - { email, password }
 * @returns {Promise<{access_token: string, token_type: string, user: object, role: string}>}
 */
export async function login(credentials) {
  const { data } = await api.post('/api/auth/login', credentials);
  return data;
}

/**
 * Get the current user's profile.
 * @param {string} token - JWT access token
 * @returns {Promise<{user: object, role: string, placement?: object}>}
 */
export async function getMe(token) {
  const { data } = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

/**
 * Set the default Authorization header for all subsequent requests.
 * @param {string} token - JWT access token
 */
export function setAuthToken(token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

/**
 * Clear the Authorization header.
 */
export function clearAuthToken() {
  delete api.defaults.headers.common['Authorization'];
}

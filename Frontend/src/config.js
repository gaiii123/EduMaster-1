/**
 * Centralised configuration for the VivaLoop frontend.
 *
 * During development the Vite dev-server proxies /api → localhost:8000,
 * so the default empty string (relative URL) works out of the box.
 * For a different backend, set the VITE_API_BASE_URL env-var.
 */
const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
};

export default config;

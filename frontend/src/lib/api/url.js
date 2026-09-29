/**
 * Endpoint resolution and validation.
 *
 * The API origin can come from four places, in priority order:
 *   1. a user override saved in localStorage (Settings page)
 *   2. `VITE_API_URL` from the build/dev environment
 *   3. a same-origin `/api` proxy (Vite dev server, Netlify, Render static)
 *   4. `http://localhost:5000` (the docker-compose published port)
 */

const ORIGIN_KEY = "njq.apiOrigin";

/** Stored marker for "talk to the origin that served this page". */
const SAME_ORIGIN = "same-origin";

/** Only http(s) origins are ever accepted — blocks `javascript:`, `data:`, etc. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

const FALLBACK_ORIGIN = "http://localhost:5000";

/**
 * Validate + normalise a user supplied API origin.
 *
 * An empty value (or `/`, or the word "same-origin") is a *valid* choice and
 * resolves to the empty string, which makes every request relative. That is the
 * right setting whenever the console is served by something that also proxies
 * `/api` — the Vite dev server, or a static host with a rewrite rule — and it
 * avoids CORS entirely.
 *
 * @param {unknown} input
 * @returns {{ ok: true, origin: string } | { ok: false, reason: string }}
 */
export function validateOrigin(input) {
  if (typeof input !== "string") return { ok: false, reason: "Endpoint must be a string." };
  const raw = input.trim();

  if (raw === "" || raw === "/" || raw.toLowerCase() === SAME_ORIGIN) {
    return { ok: true, origin: "" };
  }

  if (raw.length > 300) return { ok: false, reason: "Endpoint is too long." };

  // A bare host like "localhost:5000" is a very common paste; be forgiving.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  if (!SAFE_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "Only http:// and https:// endpoints are allowed." };
  }
  if (!url.hostname) {
    return { ok: false, reason: "Endpoint is missing a hostname." };
  }

  // Strip trailing slashes, query and hash — we only keep the origin + base path.
  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, origin: `${url.origin}${path}` };
}

/** @returns {string|null} `""` means same-origin. */
export function readStoredOrigin() {
  try {
    const stored = localStorage.getItem(ORIGIN_KEY);
    if (stored === SAME_ORIGIN) return "";
    if (!stored) return null;
    const result = validateOrigin(stored);
    return result.ok ? result.origin : null;
  } catch {
    return null;
  }
}

/** @param {string|null} origin `""` is persisted as the same-origin marker. */
export function writeStoredOrigin(origin) {
  try {
    if (origin === "" || origin === null) localStorage.setItem(ORIGIN_KEY, SAME_ORIGIN);
    else if (origin) localStorage.setItem(ORIGIN_KEY, origin);
    else localStorage.removeItem(ORIGIN_KEY);
  } catch {
    /* storage unavailable (private mode) — fall back to build-time env only */
  }
}

/** @returns {string} */
export function resolveOrigin() {
  const override = readStoredOrigin();
  if (override) return override;

  const fromEnv = import.meta.env?.VITE_API_URL;
  if (typeof fromEnv === "string") {
    const result = validateOrigin(fromEnv);
    if (result.ok) return result.origin;
  }

  return FALLBACK_ORIGIN;
}

export function getOriginKey() {
  return ORIGIN_KEY;
}

/**
 * Human friendly label for an origin, used in the connection pill.
 * @param {string} origin
 */
export function describeOrigin(origin) {
  if (origin === "" || !origin) return "same origin";
  let url;
  try {
    url = new URL(origin);
  } catch {
    return origin;
  }
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if (isLocal) return `localhost:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  return url.host;
}

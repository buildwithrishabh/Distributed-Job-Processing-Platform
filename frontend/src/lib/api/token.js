/**
 * Access token store.
 *
 * Security posture
 * ----------------
 * The backend issues the access token twice: as an httpOnly cookie *and* in the
 * JSON body. The cookie is the stronger channel, but it is dropped by browsers
 * whenever the API is served over plain HTTP with `SameSite=None; Secure` —
 * which is exactly what happens with `docker-compose` on http://localhost.
 *
 * So we support both:
 *   - httpOnly cookie  (used automatically, never readable by JS)
 *   - `Authorization: Bearer` header (our fallback for the HTTP/dev case)
 *
 * The header token lives in a module-scoped variable (invisible to any other
 * script unless it can already run code in this realm) and is mirrored into
 * `sessionStorage` so a page reload keeps the session. `sessionStorage` is
 * scoped to the tab and cleared when it closes, unlike `localStorage` which
 * persisted indefinitely and was shared across every tab.
 *
 * We also refresh proactively: the token is renewed shortly *before* it expires
 * rather than waiting for a 401, so the dropped-cookie case never surfaces a
 * broken request.
 */

const MIRROR_KEY = "njq.session";

/** @type {{ accessToken: string|null, expiresAt: number|null }} */
let memory = { accessToken: null, expiresAt: null };

/** Refresh this many ms before the token actually expires. */
const REFRESH_LEAD_MS = 90_000;

function readMirror() {
  try {
    const raw = sessionStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.accessToken !== "string") return null;
    return {
      accessToken: parsed.accessToken,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

function writeMirror(value) {
  try {
    if (value?.accessToken) {
      sessionStorage.setItem(MIRROR_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(MIRROR_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Decode the `exp` claim without verifying the signature.
 * This is only used to *schedule* a refresh, never to make an auth decision —
 * the server is the only authority on validity.
 * @param {string} token
 * @returns {number|null} epoch ms
 */
function decodeExpiry(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    if (typeof payload?.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  if (!memory.accessToken) {
    const mirrored = readMirror();
    if (mirrored) memory = mirrored;
  }
  return memory.accessToken;
}

export function getTokenExpiry() {
  return memory.expiresAt;
}

/** @param {string|null|undefined} token */
export function setAccessToken(token) {
  if (!token) {
    clearAccessToken();
    return null;
  }
  const expiresAt = decodeExpiry(token);
  memory = { accessToken: token, expiresAt };
  writeMirror(memory);
  return expiresAt;
}

export function clearAccessToken() {
  memory = { accessToken: null, expiresAt: null };
  try {
    sessionStorage.removeItem(MIRROR_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True when the token is absent, already expired, or close enough to expiry
 * that we should renew it before using it.
 * @param {number} [leadMs]
 */
export function needsRefresh(leadMs = REFRESH_LEAD_MS) {
  const token = getAccessToken();
  if (!token) return false; // nothing to refresh; caller decides based on auth mode
  if (memory.expiresAt == null) return false; // opaque token, server decides
  return Date.now() >= memory.expiresAt - leadMs;
}

/** Fraction of the token's life already consumed, 0..1. Unknown for opaque tokens. */
export function tokenFreshness() {
  if (!memory.accessToken || memory.expiresAt == null) return null;
  const total = 24 * 60 * 60 * 1000; // unknown lifetime; only used for a coarse hint
  return Math.max(0, Math.min(1, 1 - (memory.expiresAt - Date.now()) / total));
}

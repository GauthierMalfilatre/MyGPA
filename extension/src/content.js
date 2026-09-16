(function () {
  const VALIDATIONS_PATH = "/api/evaluations/validations/me";
  const PROFILE_PATH = "/api/students/profile";
  const REFRESH_INTERVAL_MS = 60 * 1000;
  const AUTH_EVENT = "mygpa:auth-token";
  const STORAGE_KEY = "myGpaLastResult";

  let latestToken = null;
  let tokenExpiresAt = null;
  let refreshTimer = null;

  function injectPageScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/inject.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  function decodeJwtExpiry(token) {
    try {
      const payloadB64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch (_) {
      return null;
    }
  }

  function isTokenExpired() {
    return tokenExpiresAt !== null && Date.now() >= tokenExpiresAt;
  }

  window.addEventListener(AUTH_EVENT, (event) => {
    const token = event.detail?.token;
    if (token && token !== latestToken) {
      latestToken = token;
      tokenExpiresAt = decodeJwtExpiry(token);
      refreshGpa();
    }
  });

  async function fetchJson(path, token) {
    const response = await fetch(`https://my.epitech.eu${path}`, {
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });
    if (response.status === 401) {
      throw new Error("SESSION_EXPIRED");
    }
    if (!response.ok) {
      throw new Error(`API error ${response.status} on ${path}`);
    }
    return response.json();
  }

  async function persistResult(overall) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: { overall, savedAt: Date.now() },
      });
    } catch (_) {
      // storage unavailable, non-fatal
    }
  }

  async function restoreLastResult() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const entry = stored?.[STORAGE_KEY];
      if (entry?.overall) {
        window.MyGpa.renderWidget(entry.overall, { stale: true });
      }
    } catch (_) {
      // storage unavailable, non-fatal
    }
  }

  async function refreshGpa() {
    if (!latestToken) return;
    if (isTokenExpired()) {
      window.MyGpa.renderSessionExpired();
      return;
    }
    try {
      const [validations, profile] = await Promise.all([
        fetchJson(VALIDATIONS_PATH, latestToken),
        fetchJson(PROFILE_PATH, latestToken),
      ]);
      const currentPeriod = window.MyGpa.computeRealGpa(validations);
      const overall = window.MyGpa.computeOverallGpa(currentPeriod, profile);
      window.MyGpa.renderWidget(overall);
      persistResult(overall);
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        window.MyGpa.renderSessionExpired();
      } else {
        window.MyGpa.renderError(err);
      }
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshGpa, REFRESH_INTERVAL_MS);
  }

  injectPageScript();
  window.MyGpa.mountWidget();
  restoreLastResult();
  startAutoRefresh();
})();

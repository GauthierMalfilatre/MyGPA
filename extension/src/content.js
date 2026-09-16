(function () {
  const VALIDATIONS_PATH = "/api/evaluations/validations/me";
  const PROFILE_PATH = "/api/students/profile";
  const REFRESH_INTERVAL_MS = 60 * 1000;
  const AUTH_EVENT = "kronk-gpa:auth-token";

  let latestToken = null;
  let refreshTimer = null;

  function injectPageScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/inject.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener(AUTH_EVENT, (event) => {
    const token = event.detail?.token;
    if (token && token !== latestToken) {
      latestToken = token;
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
    if (!response.ok) {
      throw new Error(`API error ${response.status} on ${path}`);
    }
    return response.json();
  }

  async function refreshGpa() {
    if (!latestToken) return;
    try {
      const [validations, profile] = await Promise.all([
        fetchJson(VALIDATIONS_PATH, latestToken),
        fetchJson(PROFILE_PATH, latestToken),
      ]);
      const currentPeriod = window.KronkGpa.computeRealGpa(validations);
      const overall = window.KronkGpa.computeOverallGpa(currentPeriod, profile);
      window.KronkGpa.renderWidget(overall);
    } catch (err) {
      window.KronkGpa.renderError(err);
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshGpa, REFRESH_INTERVAL_MS);
  }

  injectPageScript();
  window.KronkGpa.mountWidget();
  startAutoRefresh();
})();

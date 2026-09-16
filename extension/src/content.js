(function () {
  const API_PATH = "/api/evaluations/validations/me";
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

  async function fetchValidations(token) {
    const response = await fetch(`https://my.epitech.eu${API_PATH}`, {
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }
    return response.json();
  }

  async function refreshGpa() {
    if (!latestToken) return;
    try {
      const payload = await fetchValidations(latestToken);
      const result = window.KronkGpa.computeRealGpa(payload);
      window.KronkGpa.renderWidget(result);
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

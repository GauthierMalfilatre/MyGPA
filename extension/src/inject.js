(function () {
  const EVENT_NAME = "kronk-gpa:auth-token";

  function announceToken(token) {
    if (!token) return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { token } }));
  }

  function extractBearer(headers) {
    if (!headers) return null;
    if (headers instanceof Headers) {
      const auth = headers.get("authorization") || headers.get("Authorization");
      return auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    }
    if (Array.isArray(headers)) {
      const entry = headers.find(([key]) => key.toLowerCase() === "authorization");
      return entry && entry[1].startsWith("Bearer ") ? entry[1].slice(7) : null;
    }
    const auth = headers["authorization"] || headers["Authorization"];
    return auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  }

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const headers = init?.headers || (input instanceof Request ? input.headers : null);
      const token = extractBearer(headers);
      if (token) announceToken(token);
    } catch (_) {
      // ignore extraction failures, never block the real request
    }
    return originalFetch.apply(this, arguments);
  };

  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (name.toLowerCase() === "authorization" && value.startsWith("Bearer ")) {
        announceToken(value.slice(7));
      }
    } catch (_) {
      // ignore
    }
    return originalSetRequestHeader.apply(this, arguments);
  };
})();

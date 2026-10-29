// Many pages call fetch("/api/...") directly with only `credentials: "include"`, but the server
// authenticates with the Bearer token kept in localStorage. Attach that token to every request to
// this app's own /api that doesn't already carry an Authorization header.
export function installAuthFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem("authToken");
    if (!token) return originalFetch(input, init);

    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has("Authorization")) return originalFetch(input, init);
    headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
  };
}

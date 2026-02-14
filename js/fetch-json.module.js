export function fetchJsonWithFallback(primaryUrl, fallbackUrl) {
  return fetch(primaryUrl)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Primary fetch failed'))))
    .catch(() => fetch(fallbackUrl).then((r) => (r.ok ? r.json() : [])))
    .catch(() => []);
}

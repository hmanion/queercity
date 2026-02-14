function parseBool(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return null;
}

export function isJsonFallbackEnabled() {
  const docSetting = typeof document !== 'undefined'
    ? parseBool(document.documentElement?.dataset?.qcJsonFallback)
    : null;
  if (docSetting != null) return docSetting;

  const globalSetting = parseBool(globalThis.QC_JSON_FALLBACK);
  if (globalSetting != null) return globalSetting;

  const host = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
  return host === 'github.io' || host.endsWith('.github.io');
}

export async function fetchJsonWithFallback(primaryUrl, fallbackUrl) {
  try {
    const primary = await fetch(primaryUrl);
    if (primary.ok) return await primary.json();
    throw new Error(`Primary fetch failed (${primary.status})`);
  } catch (primaryErr) {
    if (!isJsonFallbackEnabled() || !fallbackUrl) return [];
    try {
      const fallback = await fetch(fallbackUrl);
      if (fallback.ok) return await fallback.json();
      throw new Error(`Fallback fetch failed (${fallback.status})`);
    } catch {
      return [];
    }
  }
}

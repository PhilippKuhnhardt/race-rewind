const BARCELONA_CATALUNYA_2026_TITLE = '2026 Barcelona-Catalunya';
const BARCELONA_CATALUNYA_2026_GRAND_PRIX_TITLE = '2026 Barcelona-Catalunya Grand Prix';

export function wikipediaUrlToTitle(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname !== 'en.wikipedia.org') throw new Error(`Expected en.wikipedia.org URL, got ${url}`);
  const match = parsed.pathname.match(/^\/wiki\/(.+)$/);
  if (!match) throw new Error(`Expected Wikipedia article URL, got ${url}`);
  return decodeURIComponent(match[1]).replaceAll('_', ' ');
}

export function wikipediaTitleToUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title).replaceAll('%20', '_')}`;
}

export function wikipediaTitleFallbacks(title: string): string[] {
  if (title.endsWith('Grand Prix')) return [];
  return [`${title} Grand Prix`];
}

export function normalizeRaceWikipediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let title: string;
  try {
    title = wikipediaUrlToTitle(url);
  } catch {
    return url;
  }
  if (title === BARCELONA_CATALUNYA_2026_TITLE) {
    return wikipediaTitleToUrl(BARCELONA_CATALUNYA_2026_GRAND_PRIX_TITLE);
  }
  return url;
}

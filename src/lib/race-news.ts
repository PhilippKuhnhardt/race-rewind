import { getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Phase = 'preview' | 'post-qualifying' | 'post-race';
export type RaceNewsEntry = CollectionEntry<'raceNews'>;

export async function getRaceNews(
  raceSlug: string,
  phase: Phase,
): Promise<RaceNewsEntry | null> {
  const id = `${raceSlug}/${phase}`;
  try {
    const entry = await getEntry('raceNews', id);
    return entry ?? null;
  } catch {
    return null;
  }
}
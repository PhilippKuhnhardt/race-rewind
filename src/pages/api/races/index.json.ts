import type { APIRoute } from 'astro';
import { getAllRacesBySeason } from '../../../lib/queries';
import type { RacePickerEntry } from '../../../lib/api-types';

export const prerender = true;

export const GET: APIRoute = async () => {
  const { seasons, byseason } = await getAllRacesBySeason();

  const races: RacePickerEntry[] = [];
  for (const season of seasons) {
    for (const r of byseason[season]) {
      races.push({ season, slug: r.slug, name: r.name });
    }
  }

  return new Response(JSON.stringify(races), {
    headers: { 'content-type': 'application/json' },
  });
};

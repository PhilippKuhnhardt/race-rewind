import type { APIRoute } from 'astro';
import { getAllDriverRacePairs, getDriverBySlug } from '../../../lib/queries';
import type { DriverPickerEntry } from '../../../lib/api-types';

export const prerender = true;

export const GET: APIRoute = async () => {
  const pairs = await getAllDriverRacePairs();
  const slugs = [...new Set(pairs.map((p) => p.driver_slug))];

  const drivers: DriverPickerEntry[] = await Promise.all(
    slugs.map(async (slug) => {
      const d = await getDriverBySlug(slug);
      return { slug, full_name: d?.full_name ?? slug, nationality: d?.nationality ?? null };
    }),
  );

  drivers.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return new Response(JSON.stringify(drivers), {
    headers: { 'content-type': 'application/json' },
  });
};

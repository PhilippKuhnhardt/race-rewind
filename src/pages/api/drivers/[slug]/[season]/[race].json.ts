import type { APIRoute } from 'astro';
import { getAllDriverRacePairs } from '../../../../../lib/queries';
import { buildDriverAtRacePayload } from '../../../../../lib/payloads/driver-at-race';

export const prerender = true;

export async function getStaticPaths() {
  return (await getAllDriverRacePairs()).map((p) => ({
    params: { slug: p.driver_slug, season: String(p.season), race: p.race_slug },
  }));
}

export const GET: APIRoute = async ({ params }) => {
  const payload = await buildDriverAtRacePayload(params.slug!, params.season!, params.race!);
  if (!payload) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });
};

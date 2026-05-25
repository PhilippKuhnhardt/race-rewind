import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const raceNews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/race-news' }),
  schema: z.object({
    race_slug: z.string(),
    phase: z.enum(['preview', 'post-qualifying', 'post-race', 'preseason', 'postseason']),
    source_url: z.string(),
    source_revision: z.string().optional(),
    source_title: z.string(),
    license: z.literal('CC-BY-SA-4.0'),
    generated_at: z.string(),
    model: z.string().optional(),
    authored_by: z.string().optional(),
  }),
});

export const collections = { raceNews };
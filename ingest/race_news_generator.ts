import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { wikipediaTitleFallbacks, wikipediaUrlToTitle } from './wikipedia';

export { wikipediaTitleFallbacks, wikipediaUrlToTitle } from './wikipedia';

export type RaceNewsCandidate = {
  raceNumber: number;
  slug: string;
  season: number;
  round: number;
  name: string;
  date: string;
  prevRaceInSeason: number | null;
  wikipedia: string;
};

export type WikipediaSource = {
  title: string;
  revision: string;
  oldidUrl: string;
  extract: string;
};

export type RaceNewsContext = {
  championshipStandings: string | null;
  previousRace: string | null;
  previousRaceSource: string | null;
};

type Args = {
  dbPath: string;
  contentDir: string;
  dryRun: boolean;
  overwrite: boolean;
  limit: number | null;
  slug: string | null;
};

type OpenRouterMessageContent = string | Array<{ type?: string; text?: string }>;

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: OpenRouterMessageContent;
    };
  }>;
};

type GeneratedRaceNews = {
  markdown: string;
};

const DEFAULT_DB_PATH = 'data/race-rewind.sqlite';
const DEFAULT_CONTENT_DIR = 'content/race-news';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SAFE_SECTION_NAMES = new Set([
  'background',
  'practice',
  'free practice',
  'practice report',
]);

const FORBIDDEN_HEADINGS = /^(#{1,2}\s|###\s*(qualifying|race|classification|classifications|post-race|post race|results?)\b)/im;

export function parseArgs(argv = process.argv.slice(2)): Args {
  let dbPath = DEFAULT_DB_PATH;
  let contentDir = DEFAULT_CONTENT_DIR;
  let dryRun = false;
  let overwrite = false;
  let limit: number | null = null;
  let slug: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--db' && argv[i + 1]) dbPath = argv[++i];
    else if (arg === '--content-dir' && argv[i + 1]) contentDir = argv[++i];
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--overwrite') overwrite = true;
    else if (arg === '--limit' && argv[i + 1]) limit = parsePositiveInt(argv[++i], '--limit');
    else if (arg === '--slug' && argv[i + 1]) slug = argv[++i];
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return {
    dbPath: path.resolve(dbPath),
    contentDir: path.resolve(contentDir),
    dryRun,
    overwrite,
    limit,
    slug,
  };
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

export async function findRaceNewsCandidates(
  dbPath: string,
  contentDir: string,
  options: { overwrite?: boolean; limit?: number | null; slug?: string | null } = {},
): Promise<RaceNewsCandidate[]> {
  const client = createClient({ url: `file:${dbPath}` });
  try {
    const result = await client.execute(`
      SELECT r.race_number, r.slug, r.season, r.round, r.name, r.date, r.prev_race_in_season, r.wikipedia
      FROM races r
      WHERE r.wikipedia IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM race_results rr WHERE rr.race_number = r.race_number
        )
      ORDER BY r.race_number
    `);

    const candidates = result.rows
      .map((row) => ({
        raceNumber: Number(row.race_number),
        slug: String(row.slug),
        season: Number(row.season),
        round: Number(row.round),
        name: String(row.name),
        date: String(row.date),
        prevRaceInSeason: row.prev_race_in_season === null ? null : Number(row.prev_race_in_season),
        wikipedia: String(row.wikipedia),
      }))
      .filter((candidate) => !options.slug || candidate.slug === options.slug)
      .filter((candidate) => options.overwrite || !existsSync(previewPath(contentDir, candidate.slug)));

    return options.limit ? candidates.slice(0, options.limit) : candidates;
  } finally {
    client.close();
  }
}

export async function fetchWikipediaSource(url: string): Promise<WikipediaSource> {
  const requestedTitle = wikipediaUrlToTitle(url);
  const titles = [requestedTitle, ...wikipediaTitleFallbacks(requestedTitle)];
  let missingTitle = requestedTitle;

  for (const title of titles) {
    const source = await fetchWikipediaSourceByTitle(title, extractSpoilerSafeWikipediaText, 'Wikipedia source');
    if (source) return source;
    missingTitle = title;
  }

  throw new Error(`Wikipedia page not found: ${missingTitle}`);
}

type WikipediaExtractor = (wikitext: string) => string;

async function fetchWikipediaSourceByTitle(title: string, extractor: WikipediaExtractor, label: string): Promise<WikipediaSource | null> {
  const apiUrl = new URL('https://en.wikipedia.org/w/api.php');
  apiUrl.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'revisions',
    redirects: '1',
    rvprop: 'ids|content',
    rvslots: 'main',
    titles: title,
  }).toString();

  const response = await fetch(apiUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'RaceRewindRaceNewsBot/1.0 (https://racerewind.org)',
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${label} for ${title}: ${response.status}`);

  const json = await response.json() as {
    query?: {
      pages?: Array<{
        missing?: boolean;
        title?: string;
        revisions?: Array<{
          revid?: number;
          slots?: {
            main?: {
              content?: string;
            };
          };
        }>;
      }>;
    };
  };

  const page = json.query?.pages?.[0];
  if (!page || page.missing) return null;
  const revision = page.revisions?.[0];
  const revid = revision?.revid;
  const content = revision?.slots?.main?.content;
  if (!page.title || !revid || !content) throw new Error(`Wikipedia page did not include revision content: ${title}`);

  return {
    title: page.title,
    revision: String(revid),
    oldidUrl: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title).replaceAll('%20', '_')}&oldid=${revid}`,
    extract: extractor(content),
  };
}

async function fetchPreviousRaceWikipediaSource(url: string): Promise<WikipediaSource> {
  const requestedTitle = wikipediaUrlToTitle(url);
  const titles = [requestedTitle, ...wikipediaTitleFallbacks(requestedTitle)];
  let missingTitle = requestedTitle;

  for (const title of titles) {
    const source = await fetchWikipediaSourceByTitle(title, extractPreviousRaceWikipediaText, 'previous race Wikipedia source');
    if (source) return source;
    missingTitle = title;
  }

  throw new Error(`Wikipedia page not found: ${missingTitle}`);
}

export function extractSpoilerSafeWikipediaText(wikitext: string): string {
  const weather = extractInfoboxWeather(wikitext);
  const sections = extractSections(wikitext)
    .filter((section) => SAFE_SECTION_NAMES.has(normalizeSectionName(section.title)))
    .map((section) => `## ${section.title}\n${section.body.trim()}`)
    .filter((section) => section.trim().length > 0);

  const parts = [
    weather ? `Infobox weather: ${weather}` : '',
    ...sections,
  ].filter(Boolean);

  return parts.join('\n\n').trim();
}

export function extractPreviousRaceWikipediaText(wikitext: string): string {
  return extractSections(wikitext)
    .filter((section) => {
      const title = normalizeSectionName(section.title);
      return title === 'report' || title === 'race' || title === 'post-race' || title === 'post race';
    })
    .map((section) => `## ${section.title}\n${section.body.trim()}`)
    .filter((section) => section.trim().length > 0)
    .join('\n\n')
    .trim();
}

export function extractInfoboxWeather(wikitext: string): string | null {
  const match = wikitext.match(/\|\s*weather\s*=\s*([\s\S]*?)(?=\n\|\s*[A-Za-z_ ]+\s*=|\n}}\s*)/i);
  if (!match) return null;
  return stripWikiMarkup(match[1]).replace(/\s+/g, ' ').trim() || null;
}

function extractSections(wikitext: string): Array<{ title: string; body: string }> {
  const headings = [...wikitext.matchAll(/^(==+)\s*(.*?)\s*\1\s*$/gm)];
  return headings.map((heading, index) => {
    const next = headings[index + 1];
    return {
      title: stripWikiMarkup(heading[2]).trim(),
      body: wikitext.slice((heading.index ?? 0) + heading[0].length, next?.index ?? wikitext.length),
    };
  });
}

function normalizeSectionName(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripWikiMarkup(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^/]*\/>/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .trim();
}

export function buildPrompt(candidate: RaceNewsCandidate, source: WikipediaSource): Array<{ role: 'system' | 'user'; content: string }> {
  return buildPromptWithContext(candidate, source, {
    championshipStandings: null,
    previousRace: null,
    previousRaceSource: null,
  });
}

export function buildPromptWithContext(
  candidate: RaceNewsCandidate,
  source: WikipediaSource,
  context: RaceNewsContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content: [
        'You write spoiler-free Formula 1 race preview markdown for Race Rewind.',
        'Use only the supplied Wikipedia-derived source text.',
        'Do not mention qualifying, race, classification, post-race, winner, podium, or incidents from the current race.',
        'Previous-race context is allowed when it appears in the supplied database context or previous-race source text.',
        'When championship standings context is supplied, include a ### Championship standings section that explains the shape of the fight without listing a full table.',
        'When previous race context is supplied, include a ### Previous race section with a short narrative recap.',
        'Use present tense for the state entering the race and past tense for earlier events.',
        'Use concise factual prose with ### headings only. Do not include YAML frontmatter.',
        'Return JSON only, matching the requested schema.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Race: ${candidate.name}`,
        `Season: ${candidate.season}`,
        `Round: ${candidate.round}`,
        `Race date: ${candidate.date}`,
        `Wikipedia source title: ${source.title}`,
        '',
        'Write a spoiler-free preview markdown body. Omit sections with no sourced facts.',
        'Allowed headings include: ### Championship standings, ### Previous race, ### Between-race developments, ### Championship permutations, ### Entrants, ### Penalties, ### Milestones, ### Weather, ### Tyre choices, ### Track changes, ### Sprint format, ### Car upgrades, ### Practice.',
        '',
        'Database context fixed to the moment before this race:',
        context.championshipStandings ? `Championship standings: ${context.championshipStandings}` : 'Championship standings: unavailable',
        context.previousRace ? `Previous race: ${context.previousRace}` : 'Previous race: unavailable',
        '',
        context.previousRaceSource
          ? `Previous race Wikipedia source text (safe to use because it is already completed before this race):\n${context.previousRaceSource}`
          : 'Previous race Wikipedia source text: unavailable',
        '',
        'Source text:',
        source.extract || '(No spoiler-safe source sections were available.)',
      ].join('\n'),
    },
  ];
}

export async function generateRaceNews(
  candidate: RaceNewsCandidate,
  source: WikipediaSource,
  context: RaceNewsContext,
  apiKey: string,
  model: string,
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': 'https://racerewind.org',
      'x-title': 'Race Rewind',
    },
    body: JSON.stringify({
      model,
      messages: buildPromptWithContext(candidate, source, context),
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'race_news_preview',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['markdown'],
            properties: {
              markdown: {
                type: 'string',
                description: 'Markdown body using only ### headings and no frontmatter.',
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed for ${candidate.slug}: ${response.status} ${body}`);
  }

  return parseGeneratedMarkdown(await response.json() as OpenRouterResponse);
}

export async function buildRaceNewsContext(dbPath: string, candidate: RaceNewsCandidate): Promise<RaceNewsContext> {
  const client = createClient({ url: `file:${dbPath}` });
  try {
    if (!candidate.prevRaceInSeason) {
      return {
        championshipStandings: null,
        previousRace: null,
        previousRaceSource: null,
      };
    }

    const [driverStandings, teamStandings, previousRace, previousRaceResults] = await Promise.all([
      client.execute({
        sql: `
          SELECT d.full_name AS driver, ds.points, ds.position
          FROM driver_standings ds
          JOIN drivers d ON d.id = ds.driver_id
          WHERE ds.race_number = ? AND ds.position IS NOT NULL
          ORDER BY ds.position
          LIMIT 5
        `,
        args: [candidate.prevRaceInSeason],
      }),
      client.execute({
        sql: `
          SELECT t.name AS team, ts.points, ts.position
          FROM team_standings ts
          JOIN teams t ON t.id = ts.team_id
          WHERE ts.race_number = ? AND ts.position IS NOT NULL
          ORDER BY ts.position
          LIMIT 5
        `,
        args: [candidate.prevRaceInSeason],
      }),
      client.execute({
        sql: 'SELECT name, slug, wikipedia FROM races WHERE race_number = ?',
        args: [candidate.prevRaceInSeason],
      }),
      client.execute({
        sql: `
          SELECT d.full_name AS driver, rr.position, rr.detail
          FROM race_results rr
          JOIN drivers d ON d.id = rr.driver_id
          WHERE rr.race_number = ? AND rr.position IS NOT NULL
          ORDER BY rr.position
          LIMIT 5
        `,
        args: [candidate.prevRaceInSeason],
      }),
    ]);

    const previousRaceRow = previousRace.rows[0];
    const previousRaceWikipedia = previousRaceRow?.wikipedia ? String(previousRaceRow.wikipedia) : null;
    let previousRaceSource: string | null = null;
    if (previousRaceWikipedia) {
      const previousSource = await fetchPreviousRaceWikipediaSource(previousRaceWikipedia);
      previousRaceSource = previousSource.extract
        ? `Source title: ${previousSource.title}\n${previousSource.extract}`
        : null;
    }

    return {
      championshipStandings: formatChampionshipStandings(driverStandings.rows, teamStandings.rows),
      previousRace: formatPreviousRace(previousRaceRow, previousRaceResults.rows),
      previousRaceSource,
    };
  } finally {
    client.close();
  }
}

function formatChampionshipStandings(
  driverRows: Array<Record<string, unknown>>,
  teamRows: Array<Record<string, unknown>>,
): string | null {
  if (!driverRows.length && !teamRows.length) return null;
  const drivers = driverRows.map((row) => `${row.position}. ${row.driver} (${formatPoints(row.points)})`).join(', ');
  const teams = teamRows.map((row) => `${row.position}. ${row.team} (${formatPoints(row.points)})`).join(', ');
  return [
    drivers ? `Drivers top five after the previous round: ${drivers}.` : '',
    teams ? `Constructors top five after the previous round: ${teams}.` : '',
  ].filter(Boolean).join(' ');
}

function formatPreviousRace(previousRaceRow: Record<string, unknown> | undefined, resultRows: Array<Record<string, unknown>>): string | null {
  if (!previousRaceRow || !resultRows.length) return null;
  const finishers = resultRows.map((row) => `${row.position}. ${row.driver} (${row.detail})`).join(', ');
  return `${previousRaceRow.name}: top five classified finishers were ${finishers}.`;
}

function formatPoints(points: unknown): string {
  const value = Number(points);
  return Number.isInteger(value) ? `${value} pts` : `${value} pts`;
}

export function parseGeneratedMarkdown(response: OpenRouterResponse): string {
  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content
    : content?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('OpenRouter response did not include message content');

  const parsed = JSON.parse(text) as Partial<GeneratedRaceNews>;
  if (!parsed.markdown || typeof parsed.markdown !== 'string') {
    throw new Error('OpenRouter response did not include markdown');
  }
  return validateGeneratedMarkdown(parsed.markdown);
}

export function validateGeneratedMarkdown(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) throw new Error('Generated markdown is empty');
  if (trimmed.startsWith('---')) throw new Error('Generated markdown must not include frontmatter');
  if (FORBIDDEN_HEADINGS.test(trimmed)) throw new Error('Generated markdown includes a forbidden heading');
  return `${trimmed}\n`;
}

export function renderPreviewFile(candidate: RaceNewsCandidate, source: WikipediaSource, markdown: string, model: string, generatedAt = new Date()): string {
  const date = generatedAt.toISOString().slice(0, 10);
  return [
    '---',
    `race_slug: ${candidate.slug}`,
    'phase: preview',
    `source_url: ${source.oldidUrl}`,
    `source_revision: '${source.revision}'`,
    `source_title: ${yamlString(source.title)}`,
    'license: CC-BY-SA-4.0',
    `generated_at: '${date}'`,
    `model: ${yamlString(model)}`,
    '---',
    '',
    markdown.trim(),
    '',
  ].join('\n');
}

function yamlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function previewPath(contentDir: string, slug: string): string {
  return path.join(contentDir, slug, 'preview.md');
}

async function main() {
  const args = parseArgs();
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey && !args.dryRun) throw new Error('OPENROUTER_API_KEY is required');
  if (!model && !args.dryRun) throw new Error('OPENROUTER_MODEL is required');

  const candidates = await findRaceNewsCandidates(args.dbPath, args.contentDir, {
    overwrite: args.overwrite,
    limit: args.limit,
    slug: args.slug,
  });

  if (candidates.length === 0) {
    console.log('No completed races need race-news previews.');
    return;
  }

  console.log(`Found ${candidates.length} race-news preview candidate(s).`);
  if (args.dryRun) {
    for (const candidate of candidates) console.log(`${candidate.slug} (${candidate.date})`);
    return;
  }

  for (const candidate of candidates) {
    console.log(`Generating ${candidate.slug} …`);
    const source = await fetchWikipediaSource(candidate.wikipedia);
    const context = await buildRaceNewsContext(args.dbPath, candidate);
    const markdown = await generateRaceNews(candidate, source, context, apiKey!, model!);
    const outputPath = previewPath(args.contentDir, candidate.slug);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, renderPreviewFile(candidate, source, markdown, model!));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

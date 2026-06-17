import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractInfoboxWeather,
  extractPreviousRaceWikipediaText,
  extractSpoilerSafeWikipediaText,
  findRaceNewsCandidates,
  buildPromptWithContext,
  parseArgs,
  parseGeneratedMarkdown,
  renderPreviewFile,
  validateGeneratedMarkdown,
  wikipediaUrlToTitle,
  type RaceNewsCandidate,
  type WikipediaSource,
} from '../race_news_generator';
import { skipIfNoDb } from './helpers';

const candidate: RaceNewsCandidate = {
  raceNumber: 1154,
  slug: '2026-canadian-grand-prix',
  season: 2026,
  round: 5,
  name: 'Canadian Grand Prix',
  date: '2026-05-24',
  prevRaceInSeason: 1153,
  wikipedia: 'https://en.wikipedia.org/wiki/2026_Canadian_Grand_Prix',
};

const source: WikipediaSource = {
  title: '2026 Canadian Grand Prix',
  revision: '123456',
  oldidUrl: 'https://en.wikipedia.org/w/index.php?title=2026_Canadian_Grand_Prix&oldid=123456',
  extract: '## Background\nUseful background.',
};

describe('race news generator helpers', () => {
  it('parses pnpm script argument separators', () => {
    const args = parseArgs(['--', '--dry-run', '--limit', '3', '--slug', '2026-canadian-grand-prix']);

    expect(args.dryRun).toBe(true);
    expect(args.limit).toBe(3);
    expect(args.slug).toBe('2026-canadian-grand-prix');
  });

  it('converts Wikipedia article URLs to page titles', () => {
    expect(wikipediaUrlToTitle('https://en.wikipedia.org/wiki/2024_S%C3%A3o_Paulo_Grand_Prix'))
      .toBe('2024 São Paulo Grand Prix');
  });

  it('extracts infobox weather', () => {
    expect(extractInfoboxWeather([
      '{{Infobox Grand Prix race report',
      '| weather = Rain at the start, drying later',
      '| course = Street circuit',
      '}}',
    ].join('\n'))).toBe('Rain at the start, drying later');
  });

  it('extracts safe source sections and excludes spoiler sections', () => {
    const extract = extractSpoilerSafeWikipediaText([
      '{{Infobox Grand Prix race report',
      '| weather = Clear',
      '}}',
      '== Background ==',
      'Championship context.',
      '== Qualifying ==',
      'Pole spoiler.',
      '== Practice ==',
      'FP1 incidents.',
      '== Race ==',
      'Winner spoiler.',
    ].join('\n'));

    expect(extract).toContain('Infobox weather: Clear');
    expect(extract).toContain('## Background');
    expect(extract).toContain('Championship context.');
    expect(extract).toContain('## Practice');
    expect(extract).toContain('FP1 incidents.');
    expect(extract).not.toContain('Pole spoiler');
    expect(extract).not.toContain('Winner spoiler');
  });

  it('extracts previous race report sections', () => {
    const extract = extractPreviousRaceWikipediaText([
      '== Background ==',
      'Before the race.',
      '== Qualifying ==',
      'Pole details.',
      '== Race ==',
      'The winner and key incident.',
      '== Post-race ==',
      'A penalty was applied.',
    ].join('\n'));

    expect(extract).toContain('## Race');
    expect(extract).toContain('The winner and key incident.');
    expect(extract).toContain('## Post-race');
    expect(extract).toContain('A penalty was applied.');
    expect(extract).not.toContain('Before the race');
    expect(extract).not.toContain('Pole details');
  });

  it('adds fixed standings and previous-race context to the prompt', () => {
    const prompt = buildPromptWithContext(candidate, source, {
      championshipStandings: 'Drivers top five after the previous round: 1. Andrea Kimi Antonelli (100 pts).',
      previousRace: 'Miami Grand Prix: top five classified finishers were 1. Andrea Kimi Antonelli (Finished).',
      previousRaceSource: 'Source title: 2026 Miami Grand Prix\n## Race\nAntonelli won.',
    });
    const userContent = prompt[1].content;

    expect(userContent).toContain('Database context fixed to the moment before this race');
    expect(userContent).toContain('Andrea Kimi Antonelli (100 pts)');
    expect(userContent).toContain('Miami Grand Prix: top five');
    expect(userContent).toContain('Source title: 2026 Miami Grand Prix');
  });

  it('parses OpenRouter JSON response markdown', () => {
    expect(parseGeneratedMarkdown({
      choices: [{
        message: {
          content: JSON.stringify({ markdown: '### Weather\nRain is expected.' }),
        },
      }],
    })).toBe('### Weather\nRain is expected.\n');
  });

  it('rejects frontmatter and forbidden headings', () => {
    expect(() => validateGeneratedMarkdown('---\nrace_slug: x\n---')).toThrow('frontmatter');
    expect(() => validateGeneratedMarkdown('## Race\nWinner spoiler.')).toThrow('forbidden heading');
    expect(() => validateGeneratedMarkdown('### Qualifying\nPole spoiler.')).toThrow('forbidden heading');
  });

  it('renders preview frontmatter without authored_by', () => {
    const rendered = renderPreviewFile(
      candidate,
      source,
      '### Weather\nRain is expected.',
      'test/model',
      new Date('2026-06-17T12:00:00Z'),
    );

    expect(rendered).toContain('race_slug: 2026-canadian-grand-prix');
    expect(rendered).toContain('phase: preview');
    expect(rendered).toContain("source_revision: '123456'");
    expect(rendered).toContain("generated_at: '2026-06-17'");
    expect(rendered).toContain("model: 'test/model'");
    expect(rendered).not.toContain('authored_by');
  });
});

describe('race news candidate detection', () => {
  it('skips existing preview files', async () => {
    const skip = skipIfNoDb();
    if (skip) return;

    const contentDir = mkdtempSync(path.join(tmpdir(), 'race-news-'));
    try {
      const [first] = await findRaceNewsCandidates('data/race-rewind.sqlite', contentDir, { limit: 1 });
      expect(first).toBeDefined();

      const previewDir = path.join(contentDir, first.slug);
      mkdirSync(previewDir, { recursive: true });
      writeFileSync(path.join(previewDir, 'preview.md'), '---\n---\n');

      const nextCandidates = await findRaceNewsCandidates('data/race-rewind.sqlite', contentDir, { limit: 1 });
      expect(nextCandidates.map((candidate) => candidate.slug)).not.toContain(first.slug);
    } finally {
      rmSync(contentDir, { recursive: true, force: true });
    }
  });
});

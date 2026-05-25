---
name: race-news
description: Use ONLY when creating Wikipedia-derived race preview content for the F1 History app. Covers the end-to-end workflow of sourcing, extracting, and writing race preview markdown files. Triggered by requests like "create race news for season X" or "generate previews for all 2024 races".
---

# Race News Creation

Generate Wikipedia-derived race previews for the F1 History app. Content goes into
`content/race-news/{slug}/preview.md` — one file per race, per phase. For now only
the `preview` phase is in scope.

## Data sources

Every fact in a preview must be verifiable against one of these two Wikipedia pages:

1. **Season overview:** `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`
   — championship context, regulation changes, driver market, team changes, mid-season developments.
2. **Race article:** `https://en.wikipedia.org/wiki/{year}_{Title_Case_Grand_Prix_Name}`
   (from the `wikipedia` column of the `races` table in `data/f1-history.sqlite`)
   — pre-race build-up, "Background" section, weather, practice/qualifying format notes.

Read the season overview first (once), then each race article in calendar order.
A following race's "Background" section often contains material that also applies to
the next race, so cross-reference.

## Workflow

### 1. Collect race data for the season

Query the races table to get all slugs and Wikipedia URLs:

```bash
sqlite3 data/f1-history.sqlite \
  "SELECT slug, name, wikipedia, round FROM races WHERE season = {year} ORDER BY round;"
```

The `slug` column is the directory name: `2024-bahrain-grand-prix`, etc.

### 2. Read the season overview

Fetch the season Wikipedia page (e.g. `https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship`).
From it, extract:
- Regulation and technical changes for the season
- Driver market movements (who changed teams, rookies entering)
- Team principal / management changes
- Calendar changes from the previous year
- Mid-season developments between races

### 3. For each race, read the article and write the preview

Process races in round order. For each:

1. **Fetch the race article** using the Wikipedia API summary endpoint
   (`https://en.wikipedia.org/api/rest_v1/page/summary/{title}`) or fetch the
   full page with the `oldid` approach. Always capture the `oldid` (revision permalink)
   for attribution, not the live article URL.

2. **Find the pre-race "Background" and "Practice" sections** — extract the Background
   (championship standings before the race, entrants, tyre choices) and the Practice
   section (free practice results, incidents, red flags). Skip the "Qualifying,"
   "Race," "Classification," and "Post-race" sections.

3. **Pull forward-ripple from the previous race** — if race N's article mentions
   an event that affected race N+1 (driver injury, replacement, penalty carry-over,
   team orders shift), that belongs in the preview of race N+1, not N.

4. **Write the preview.** Keep it tight — one paragraph per actual topic. See
   Content Rules below.

### 4. Attribution and source tracking

Each preview file must include accurate frontmatter:

```yaml
race_slug: {year}-{race-slug}
phase: preview
source_url: https://en.wikipedia.org/w/index.php?title={Article_Title}&oldid={revision_id}
source_revision: "{revision_id}"
source_title: {Wikipedia article title, spaces not underscores}
license: CC-BY-SA-4.0
generated_at: "{ISO date}"
model: deepseek/deepseek-v4-pro
```

- `source_url` — use the `oldid` permalink, not the bare article URL. Always capture
  the specific revision used so attribution remains accurate as Wikipedia evolves.
- `source_title` — human-readable page title (e.g. `"2024 Monaco Grand Prix"`).
- `generated_at` — today's date in `YYYY-MM-DD` format.

**Write frontmatter and body into `content/race-news/{slug}/preview.md`.**

## Content rules

### What belongs in a preview

| Category | Example | Source |
|---|---|---|
| **Championship implications** | "Verstappen can clinch the title if he outscores Norris by 3 points and Leclerc fails to win." | Season overview + race article |
| **Between-race developments** | "After his crash at Monza, Magnussen was replaced by Bearman for this race." | Race article Background |
| **Regulation / technical** | "The FIA issued a technical directive banning asymmetric braking ahead of this race." | Season overview / race article |
| **Driver changes** | "This is Colapinto's debut, replacing Sargeant for the remainder of the season." | Season overview / race article |
| **Political / team news** | "Red Bull announced Wheatley's departure to Audi. He will begin gardening leave after this race." | Season overview / race article |
| **Milestones** | "Hamilton starts his 300th Grand Prix this weekend." | Race article |
| **Weather** | "Heavy rain is forecast for Sunday with a 70% chance of thunderstorms." | Race article (only if explicitly stated) |
| **Practice sessions** | "Hamilton topped FP1 (Piastri, Russell); Leclerc led FP2 and FP3. Zhou caused a red flag in FP1 after hitting the wall at turn 1." | Race article Practice section |
| **Circuit-specific format notes** (only if unusual) | "This is the third running of the Las Vegas Grand Prix on the Strip circuit." | Race article |

### What does NOT belong

- **Generic circuit descriptions** — Everyone knows Monaco has no overtaking. Do not describe circuit characteristics unless something changed.
- **Vague paddock chatter** — "Several contracts are up for renewal" is filler. Name the specific drivers/teams.
- **Invented weather** — If Wikipedia doesn't mention a forecast, omit it entirely.
- **Race spoilers** — Never mention who won, podium finishers, crashes during the race, or any event that happened during the race weekend. The Background section is your boundary.
- **Speculation** — "Ferrari should excel here" or "Red Bull has been dominant" without sourcing is fluff. If Wikipedia states a fact (e.g., "Red Bull won 7 of the first 8 races"), cite it directly.
- **Flourishes** — No "jewel in the crown" or "iconic street circuit" filler. Just the facts.

### Tense

Present tense for the state going into the race. Past tense for events that happened at a previous race.

| Present (state into this race) | Past (events at the previous race) |
|---|---|
| "Verstappen leads by 48 points." | "At Imola, Verstappen took pole." |
| "Red Bull leads the Constructors'." | "Norris finished second." |
| "Pirelli brings the softest compounds." | "Pérez qualified 11th." |
| "No stand-in drivers are entered." | "Leclerc moved into second in the standings." |

### Tightness test

After writing, delete every sentence that doesn't convey a specific, Wikipedia-sourced fact.

Passes | Fails |
|---|---|
| "Hamilton's 300th Grand Prix start. He joins Barrichello and Alonso as the third driver to reach the milestone." | "Monaco is the most glamorous event on the calendar, attracting celebrities from around the world." |
| "Verstappen leads Norris by 62 points. If he wins and Norris finishes 3rd or lower, the title is decided." | "The championship battle is heating up as we enter the final third of the season." |
| "Heavy rain is forecast for Sunday with a 70% chance of thunderstorms." (quoted from Wikipedia) | "Early forecasts suggest warm conditions with no rain expected." (no source) |

### Previous race events → next race preview

Consequences of race N always go into the preview of race N+1:

- Driver injuries or replacements
- Post-race penalties (grid drops for the next race)
- Changes in championship standings affecting clinch scenarios
- Team orders or intra-team frictions that surfaced

## File path scheme

```
content/race-news/{year}-{slugified-name}/preview.md
```

The `{slug}` matches the `slug` column in the races DB table.

## Verification

After generating all previews for a season:

```bash
pnpm check     # Zod validation + TypeScript type-check
pnpm lint --fix
pnpm dev       # Visual check on a race with content and one without
```

The preview block renders at `/seasons/{year}/{race-slug}/` via `RaceNewsCard.astro`.
When no entry exists for a race, the section is silently omitted.

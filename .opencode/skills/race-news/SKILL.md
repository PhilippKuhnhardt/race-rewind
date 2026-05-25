---
name: race-news
description: Use ONLY when creating Wikipedia-derived race preview content for the F1 History app. Covers the end-to-end workflow of sourcing, extracting, and writing race preview markdown files. Triggered by requests like "create race news for season X" or "generate previews for all 2024 races". Also handles preseason and postseason content.
---

# Race News Creation

Generate Wikipedia-derived race previews for the F1 History app. Content goes into
`content/race-news/{slug}/{phase}.md` — one file per race, per phase. Phases include
`preview`, `preseason`, and `postseason`. For now the `preview`, `preseason`, and
`postseason` phases are in scope (not `post-qualifying` or `post-race`).

## Data sources

Every fact must be verifiable against one of these Wikipedia pages:

1. **Season overview:** `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`
   — championship context, regulation changes, driver market, team changes, mid-season developments,
   final standings. This is the primary source for preseason and postseason content.
2. **Race article:** `https://en.wikipedia.org/wiki/{year}_{Title_Case_Grand_Prix_Name}`
   (from the `wikipedia` column of the `races` table in `data/f1-history.sqlite`)
   — pre-race build-up, "Background" section, weather, practice/qualifying format notes.

Read the season overview first (once), then each race article in calendar order.
A following race's "Background" section often contains material that also applies to
the next race, so cross-reference.

## Phase overview

| Phase | Slug pattern | File path | Page rendered on |
|---|---|---|---|
| `preseason` | `{year}-preseason` | `content/race-news/{year}-preseason/preseason.md` | `/seasons/{year}/preseason/` |
| `preview` | `{year}-{race-slug}` | `content/race-news/{year}-{race-slug}/preview.md` | `/seasons/{year}/{race-slug}/` |
| `postseason` | `{year}-postseason` | `content/race-news/{year}-postseason/postseason.md` | `/seasons/{year}/postseason/` |

When no entry exists, the section is silently omitted from the page.

## Workflow — Preseason

### 1. Fetch the season overview

Fetch `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`. From it, extract:

- Season number (e.g. "75th running"), number of races, defending champions
- **Entries section**: full team/driver table, team names, engine suppliers
- **Team changes**: rebrands, ownership changes, management restructures
- **Driver changes**: any driver market movements before the season (if none, note it)
- **Calendar**: circuit list, sprint events, calendar changes from previous year
- **Regulation changes**: technical and sporting regulations, tyre rules
- **Pre-season testing**: where, when, who was fastest, notable incidents

### 2. Write the preseason file

Write to `content/race-news/{year}-preseason/preseason.md`.

**Tense:** All content is written in present tense — the season is about to begin.

**Structure:** Use `###` level-3 headings for sections. Typical structure:

```markdown
### Entrants
### Team changes
### Calendar
### Regulation changes
### Pre-season testing
```

**Content rules:** Same tightness and factuality rules as the preview phase. No speculation, no circuit descriptions, no flourishes. Every fact must come from Wikipedia.

**Do NOT include:** Driver standings (the season hasn't started), in-season changes, race results.

### 3. Frontmatter

```yaml
race_slug: {year}-preseason
phase: preseason
source_url: https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship
source_revision: "1234567890"
source_title: {year} Formula One World Championship
license: CC-BY-SA-4.0
generated_at: "{ISO date}"
model: deepseek/deepseek-v4-pro
```

## Workflow — Postseason

### 1. Fetch the season overview

Fetch `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`. From it, extract:

- **Season summary** (opening paragraphs): overall narrative, key storylines
- **In-season driver changes**: all substitutions (injury, ban, mid-season replacement)
- **Closing rounds section**: who clinched what, when, key statistics
- **Final Drivers' Championship standings** (all positions that scored points)
- **Final Constructors' Championship standings** (all positions)
- **Notable records or milestones** achieved during the season

### 2. Write the postseason file

Write to `content/race-news/{year}-postseason/postseason.md`.

**Tense:** Past tense for events that happened during the season. Present tense for describing what the final standings are.

**Structure:** Use `###` level-3 headings. Typical structure:

```markdown
### Season summary
### Final Drivers' Championship
### Final Constructors' Championship
### In-season driver changes
### Notable statistics
### Farewells
```

**Content rules:**

- The season summary should cover the narrative arc: who dominated when, how the championship shifted, key turning points.
- List the top 8 drivers and all 10 teams with their final point totals. Do not list every driver — only those who scored points are relevant.
- Driver changes should list the when, who, and why for each substitution.
- Notable statistics should be specific facts (e.g., "first driver to win for two teams in first two races"), not general observations.
- Farewells: list drivers who left teams, retired, or had notable last races.

**Do NOT include:** Race-by-race results (those are on individual race pages), speculation about the future, generic praise.

### 3. Frontmatter

```yaml
race_slug: {year}-postseason
phase: postseason
source_url: https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship
source_revision: "1234567890"
source_title: {year} Formula One World Championship
license: CC-BY-SA-4.0
generated_at: "{ISO date}"
model: deepseek/deepseek-v4-pro
```

## Workflow — Race previews

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

1. **Fetch the race article** using the webfetch tool (text format).

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

| Phase | Tense |
|---|---|
| `preseason` | Present tense — the season is about to begin. |
| `preview` | Present tense for the state going into this race. Past tense for events that happened at a previous race. |
| `postseason` | Past tense for events during the season. Present tense for describing final standings. |

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
content/race-news/{year}-preseason/preseason.md         # Preseason overview
content/race-news/{year}-{slugified-name}/preview.md    # Race previews
content/race-news/{year}-postseason/postseason.md       # Postseason summary
```

The `{slug}` in race previews matches the `slug` column in the races DB table.

## Full season workflow

When generating content for an entire season, generate in this order:

1. **Preseason** — from the season overview page
2. **Race previews** — one per race, in calendar order (1 → 24)
3. **Postseason** — from the season overview page (closing rounds + final standings)

This ensures that season-level context (regulation changes, calendar, driver market) is
captured before diving into individual races.

## Verification

After generating content for a season:

```bash
pnpm check     # Zod validation + TypeScript type-check
pnpm lint --fix
pnpm dev       # Visual check on preseason, a race with content, postseason, and a race without
```

Race preview blocks render at `/seasons/{year}/{race-slug}/` via `RaceNewsCard.astro`.
Preseason content renders at `/seasons/{year}/preseason/` via `RaceNewsCard.astro`.
Postseason content renders at `/seasons/{year}/postseason/` via `RaceNewsCard.astro`.
When no entry exists for a given race or phase, the section is silently omitted.
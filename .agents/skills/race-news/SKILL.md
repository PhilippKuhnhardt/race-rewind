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
- **Team changes**: rebrands, ownership changes, management restructures
- **Driver changes**: any driver market movements before the season
- **Calendar**: circuit list, sprint events, calendar changes from previous year
- **Regulation changes**: technical and sporting regulations, tyre rules
- **Pre-season testing**: where, when, who was fastest, notable incidents

### 2. Write the preseason file

Write to `content/race-news/{year}-preseason/preseason.md`.

**Purpose:** The preseason sets the stage. The user reads this before watching the first
race of the season. It should answer: what changed since last year, who is racing, and
what rules are different? Think of it as the briefing you'd want before pressing play.

**Tense:** All content is written in present tense — the season is about to begin.

**Structure:** Use `###` level-3 headings for sections. Typical structure:

```markdown
### Driver changes
### Team changes
### Calendar
### Regulation changes
### Pre-season testing
```

Omit any section that has no content (e.g. if no team changes occurred, drop the heading).
Similarly, if no driver changes occurred, omit the section entirely.

**Content guidance:**

- **Driver changes:** List each driver change with the team, who left, and who replaced
  them. The app already has a table showing the full driver/team grid and driver stats,
  so the preseason should not repeat the full entry list — only cover what changed.
- **Team changes:** Rebrands, ownership changes, management restructures, engine supplier
  changes. Only include if something actually changed.
- **Calendar:** Total race count, new/returning/dropped circuits, sprint event list,
  significant date or slot changes. A sentence on why is useful if Wikipedia provides a
  reason (e.g. "The Japanese Grand Prix moves to April as part of calendar regionalisation").
- **Regulation changes:** Cover technical, sporting, and tyre rules. Group related changes
  together (e.g. all penalty changes in one paragraph). Be specific — "the standard
  off-track penalty is upgraded from five to ten seconds" is useful; "several regulation
  changes were made" is not.
- **Pre-season testing:** Where, when, who was fastest, who did the most laps, notable
  incidents. Keep this brief — two to three sentences.

**Do NOT include:**
- Driver or constructor standings (the season hasn't started)
- In-season changes or race results (they haven't happened yet)
- Predictions or form assessments ("Red Bull are expected to dominate")
- Detailed car technical specs or aerodynamic descriptions

### 3. Frontmatter

```yaml
race_slug: {year}-preseason
phase: preseason
source_url: https://en.wikipedia.org/w/index.php?title={year}_Formula_One_World_Championship&oldid={revision_id}
source_revision: "{revision_id}"
source_title: {year} Formula One World Championship
license: CC-BY-SA-4.0
generated_at: "{ISO date}"
model: "{model_id}"
```

## Workflow — Postseason

### 1. Fetch the season overview

Fetch `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`. From it, extract:

- **Season summary** (opening paragraphs): overall narrative, key storylines
- **Opening / Mid-season / Closing rounds sections**: the arc of the season — who
  dominated early, when the momentum shifted, how the championships were decided
- **Final Drivers' Championship standings** (all positions that scored points)
- **Final Constructors' Championship standings** (all positions)

### 2. Write the postseason file

Write to `content/race-news/{year}-postseason/postseason.md`.

**Purpose:** The postseason is the story of the season. The user has already watched
every race and read every preview — they know who replaced whom, who scored their first
points, and who crashed at turn 3. The postseason should tell them something they can
only see by looking back: the narrative arc, the power shifts, and the final reckoning.

**Tense:** Past tense for events that happened during the season. Present tense for describing what the final standings are.

**Structure:** Use `###` level-3 headings. Structure as **thematic sections** that tell
the season's story, not as a chronological or categorical list. Always end with the final
championship standings. Example:

```markdown
### Season summary              <!-- One paragraph: the season in a nutshell -->
### {Team/narrative arc 1}      <!-- e.g. "Red Bull's fade" — a team's rise or decline -->
### {Team/narrative arc 2}      <!-- e.g. "McLaren's ascent" — the challenger story -->
### The title fights             <!-- How both championships were decided -->
### {Competitive landscape}     <!-- e.g. "Seven winners" — the breadth of competition -->
### Final Drivers' Championship
### Final Constructors' Championship
```

The exact headings vary by season. A season with a dominant team might need "Ferrari's
dominance" and "The fight for second". A chaotic season might need "Four-way battle".
Choose headings that capture what made the season distinctive.

**Content guidance:**

- **Season summary:** One paragraph that captures the season's defining characteristic.
  Was it a dominant year? A shift of power? An unexpectedly competitive field?
- **Narrative arcs:** Each section should tell a team or championship story across the
  full season. Use specific race references as supporting evidence, but do not
  race-by-race recap. "Verstappen won seven of the first ten races, then went winless
  for ten rounds" is a narrative; listing every race result is a recap.
- **Title fights:** How and when were the championships decided? What made the difference?
  Include the clinching moment and the key statistic (points gap, permutations met).
- **Competitive landscape:** Season-wide observations — how many different winners,
  which teams broke winless streaks, any records set across the full season.
- **Final standings:** List the top 8 drivers with points. List all 10 constructors
  with points. Note any historically significant facts about the final positions
  (e.g. "first title since 1998").

**Do NOT include:**

- **In-season driver changes** — every race preview already covers who replaced whom.
  The user has read "Colapinto replaces Sargeant" in the Italian GP preview, the
  Azerbaijan GP preview, the Singapore GP preview, and every race thereafter. Do not
  repeat it.
- **Individual race milestones** — "Hamilton won his 104th race at Silverstone" is
  already in the British GP preview. Only mention milestones in the postseason if they
  are season-level observations (e.g. "a record seven different drivers won races").
- **Farewells / driver departures** — the final race preview (typically Abu Dhabi)
  already covers who is leaving which team. Do not duplicate.
- **Bullet-point "notable statistics"** lists — these tend to rehash individual race
  facts. Weave genuinely season-level statistics into the narrative sections instead.
- **Race-by-race results** — those are on individual race pages.
- **Speculation** about the following season.

### 3. Frontmatter

```yaml
race_slug: {year}-postseason
phase: postseason
source_url: https://en.wikipedia.org/w/index.php?title={year}_Formula_One_World_Championship&oldid={revision_id}
source_revision: "{revision_id}"
source_title: {year} Formula One World Championship
license: CC-BY-SA-4.0
generated_at: "{ISO date}"
model: "{model_id}"
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

2. **Capture the revision ID** — fetch the Wikipedia API to get the current revision:
   ```
   https://en.wikipedia.org/w/api.php?action=query&titles={Article_Title}&prop=revisions&rvprop=ids&format=json
   ```
   Extract the `revid` field from the response. Use this for `source_revision` and the
   `oldid` parameter in `source_url`. Do this for every article fetched (including the
   season overview for preseason/postseason).

3. **Find the pre-race "Background" and "Practice" sections** — extract the Background
   (championship standings before the race, entrants, tyre choices) and the Practice
   section (free practice results, incidents, red flags). Skip the "Qualifying,"
   "Race," "Classification," and "Post-race" sections.

4. **Pull forward-ripple from the previous race** — if race N's article mentions
   an event that affected race N+1 (driver injury, replacement, penalty carry-over,
   team orders shift), that belongs in the preview of race N+1, not N.

5. **Write the preview.** Keep it tight — one paragraph per actual topic. See
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
model: "{model_id}"
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
| **Weather** | "Clear skies and 28 °C are expected for race day." | Race article — extract from the Weather field in the race details infobox. Present in forecast tense ("conditions are expected", "rain is forecast"). Always include when available. |
| **Practice sessions** | "Hamilton topped FP1 (Piastri, Russell); Leclerc led FP2 and FP3. Zhou caused a red flag in FP1 after hitting the wall at turn 1." | Race article Practice section |
| **Circuit-specific format notes** (only if unusual) | "This is the third running of the Las Vegas Grand Prix on the Strip circuit." | Race article |
| **Car upgrades** | "Eight of ten teams bring upgrades: Red Bull adjusts the floor and upper sidepod; McLaren modifies the front wing and brake ducts." | Race article Background (only when listed) |

### What does NOT belong

- **Generic circuit descriptions** — Everyone knows Monaco has no overtaking. Do not describe circuit characteristics unless something changed.
- **Vague paddock chatter** — "Several contracts are up for renewal" is filler. Name the specific drivers/teams.
- **Invented weather** — Do not invent forecasts. Use only the weather description from Wikipedia's race details infobox or text (see Weather row above).
- **Current-race spoilers** — Never mention who won the current race, its podium finishers, or any event from qualifying or the race itself. The Background and Practice sections are your boundary. Results and events from *previous* races are expected and desirable for immersion — see the tense table and "Previous race events" section below.
- **Speculation** — "Ferrari should excel here" or "Red Bull has been dominant" without sourcing is fluff. If Wikipedia states a fact (e.g., "Red Bull won 7 of the first 8 races"), cite it directly.
- **Flourishes** — No "jewel in the crown" or "iconic street circuit" filler. Just the facts.
- **Repeated driver replacement boilerplate** — When a driver change happens (e.g.
  Colapinto replaces Sargeant), mention it at the race where it occurs. Do NOT repeat
  "continues at Williams, having replaced Sargeant" at every subsequent race. Only
  mention a replacement driver again if there is new information — a decision to extend
  them, a new event affecting them, or another change at the same seat. If there is
  nothing new to say about the entry list, omit `### Entrants` entirely.

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
| "Heavy rain is forecast for Sunday with a 70% chance of thunderstorms." (from Wikipedia infobox or text) | "Early forecasts suggest warm conditions with no rain expected." (invented, not from Wikipedia) |

### Previous race → next race preview

The app is designed so the user experiences the season in order. When reading the
preview for race N+1, they have already watched race N. A short summary of the
previous race sets the vibe — it should feel like a reminder, not a full recap.
Keep it to two or three sentences: who won, any standout moments, the mood.

This goes under `### Previous race`. Example:

> At Imola, Verstappen won by 0.725 seconds over Norris, who closed a six-second
> gap in the final 15 laps. Piastri received a grid penalty for impeding Magnussen
> in Q1.

**Separately**, actual developments that happened *between* races — driver dropped,
team announcement, regulation change, contract news — go under
`### Between-race developments`. This section is omitted if nothing happened between
races beyond the normal post-race activity.

Content that belongs under `### Previous race`:

- Race winner and podium finishers
- Key incidents, retirements, and collisions
- Notable records or milestones achieved at that race
- Team orders or intra-team frictions that surfaced

Content that belongs under `### Between-race developments`:

- Driver dropped or replaced (e.g. Ricciardo replaced by Lawson)
- Team personnel changes announced between races
- Post-race penalties affecting the next grid (carry-forward penalties)
- Regulation clarifications or technical directives issued between races
- Contract announcements or team news

If a development directly results from the previous race (e.g. Magnussen's penalty
points from Monza triggering his ban), it goes under `### Between-race developments`
because it is a consequence with real impact on this race, not just a recap.

### Suggested heading structure for race previews

Use `###` level-3 headings. Omit any heading that has no content for a given race.
Within a season, keep headings consistent.

```markdown
### Championship standings       <!-- Required from Round 2 onward: points for top drivers and constructors -->
### Previous race                <!-- Short recap: who won, standout moments, the mood — not a full play-by-play -->
### Between-race developments    <!-- Only if something happened between races: driver changes, penalties, news -->
### Championship permutations    <!-- Only when a title can be clinched at this race -->
### Entrants                     <!-- Only at the race where a change happens; do not repeat at subsequent races -->
### Penalties                    <!-- Only when grid penalties carry forward -->
### Milestones                   <!-- Driver/team records achieved or reachable at this event -->
### Weather                      <!-- From Wikipedia race infobox, presented as forecast -->
### Tyre choices                 <!-- When available (modern era) -->
### Track changes                <!-- Only if the circuit was modified -->
### Sprint format                <!-- Only at sprint weekends: explain the weekend structure -->
### Car upgrades                 <!-- Only when Wikipedia's Background lists team upgrades -->
### Practice                     <!-- FP session results, incidents, red flags -->
```

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
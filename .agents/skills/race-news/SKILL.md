---
name: race-news
description: Use ONLY when creating Wikipedia-derived race preview content for the F1 History app. Covers the end-to-end workflow of sourcing, extracting, and writing race preview markdown files. Triggered by requests like "create race news for season X" or "generate previews for all 2024 races". Also handles preseason content.
---

# Race News Creation

The F1 History app exists so people can rewatch past seasons and experience them as if
they were live. No spoilers, no hindsight — just the information you would have had
going into that weekend. The goal is immersion: capture the vibe and atmosphere of a
season so thoroughly that a viewer rewatching 2000 or 2024 feels the championship
tension, the rivalries, and the stakes race by race.

Race news content is the backbone of that experience. It provides Wikipedia-sourced
previews that set the scene before each race — championship context, recent form,
who's replacing whom, what the weather looks like, what happened in practice. Content
goes into `content/race-news/{slug}/{phase}.md` — one file per race, per phase. Phases
include `preview` and `preseason`. For now these two phases are in scope (not
`post-qualifying` or `post-race`).

## Purpose and voice

The user is about to rewatch a race. They want to feel the moment — the championship
stakes, the tension between drivers, the unusual circumstances — before they press play.
This content is the briefing that makes a 20-year-old race feel alive again.

**Every fact should carry weight.** The app already shows championship standings,
driver/team grids, and race results in its own UI. The preview text should not repeat
what the user can already see in a table — instead it should provide the narrative that
tables cannot: momentum shifts, streaks, context, stakes. A standings section that
lists "Driver A leads with 56 points, Driver B is second with 54" duplicates the
table. The same fact with stakes — "Driver A's lead has shrunk from 22 points to two
after three retirements in four races" — tells you what the number means for the race
you're about to watch.

This is not a request for colour commentary, hype, or speculation. The voice remains
factual, sourced from Wikipedia, and tight. The difference is between *reporting numbers*
and *reporting what the numbers mean*. Some guidelines:

- **Championship standings:** The app shows the actual points table, so don't
  duplicate it. Focus on the story the numbers tell — is the gap growing or shrinking?
  Has the lead changed hands? Is a streak building or breaking? A single sentence of
  context ("Häkkinen leads for the first time since Austria") does more than listing
  every driver's points total.
- **Previous race:** The recap should convey the mood, not just the result. "Sainz won
  two weeks after an appendectomy" is more useful than "Sainz won." Both are facts; one
  tells you something about the race you just watched.
- **Practice:** Incidents matter more than lap times. A red flag, a crash, a mechanical
  failure that reshapes the weekend — these are what the viewer will see. Don't just
  list session-toppers; pick out the moments that had consequences.
- **Milestones and records:** Connect them to history. "Verstappen's eighth consecutive
  pole equalled Senna's record" is better than "Verstappen took pole for the eighth
  consecutive time." The record gives the fact weight.
- **Entrants and developments:** When something unusual happens — a debut, a replacement,
  a tribute — include the human context Wikipedia provides. "Leclerc wears a tribute
  helmet to Bianchi on the tenth anniversary of his fatal accident" is a fact that
  sets the tone for the weekend.

- **Direct quotes:** Wikipedia frequently includes verbatim lines from drivers,
  principals, and stewards. Use them when the speaker is named, the quote is short
  (one or two sentences at most), and it adds mood the surrounding facts cannot.
  Attribute inline: `Häkkinen called it "one of the hardest weekends of my career."` 
  Embed the quote inside the section it belongs to — `### Previous race`,
  `### Between-race developments`, etc. Never create a standalone Quotes heading.
- **Story tidbits:** The small human-interest details Wikipedia weaves into
  well-maintained articles — a tribute helmet, a driver racing through injury, a
  near-miss off-track the week before, an unusual sponsor debut — are what makes a
  20-year-old race feel alive. Preserve them. They are not flourish; they are the
  mood material the app exists for.

Both quotes and tidbits earn their place by adding something the standings tables,
session toppers, and results cannot supply. If a quote only restates a fact already
in the paragraph, cut it.

None of this requires invention. Wikipedia's race articles already contain these
connections — the job is to preserve them rather than strip them out in pursuit of
brevity. Be tight, but don't be dry.

## Data sources

Every fact must be verifiable against one of these Wikipedia pages:

1. **Season overview:** `https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship`
   — championship context, regulation changes, driver market, team changes, mid-season developments,
   final standings. This is the primary source for preseason content.
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
| **Direct quotes** | `Häkkinen said the win "felt like it was meant to be after everything that happened in Monaco."` | Race article — named speaker only; do not quote unnamed sources |
| **Story tidbits** | "Sainz races two weeks after an appendectomy." / "Coulthard survived a plane crash at Lyon the week before Spain." | Race article Background or Between-race section |

### What does NOT belong

- **Generic circuit descriptions** — Everyone knows Monaco has no overtaking. Do not describe circuit characteristics unless something changed.
- **Vague paddock chatter** — "Several contracts are up for renewal" is filler. Name the specific drivers/teams.
- **Invented weather** — Do not invent forecasts. Use only the weather description from Wikipedia's race details infobox or text (see Weather row above).
- **Current-race spoilers** — Never mention who won the current race, its podium finishers, or any event from qualifying or the race itself. The Background and Practice sections are your boundary. Results and events from *previous* races are expected and desirable for immersion — see the tense table and "Previous race events" section below.
- **Speculation** — "Ferrari should excel here" or "Red Bull has been dominant" without sourcing is fluff. If Wikipedia states a fact (e.g., "Red Bull won 7 of the first 8 races"), cite it directly.
- **Flourishes** — No "jewel in the crown" or "iconic street circuit" filler. Just the facts.
- **Invented or paraphrased quotes** — Only use quotation marks for wording Wikipedia attributes verbatim to a named person. Do not put your own words in someone's mouth, and do not quote unnamed sources ("a Ferrari engineer said…"). If Wikipedia paraphrases rather than quotes, paraphrase too — without quotation marks.
- **Repeated driver replacement boilerplate** — When a driver change happens (e.g.
  Colapinto replaces Sargeant), mention it at the race where it occurs. Do NOT repeat
  "continues at Williams, having replaced Sargeant" at every subsequent race. Only
  mention a replacement driver again if there is new information — a decision to extend
  them, a new event affecting them, or another change at the same seat. If there is
  nothing new to say about the entry list, omit `### Entrants` entirely.
- **Repeated session format boilerplate** — If the practice/qualifying format is the
  same as the previous race (e.g. three free practice sessions followed by qualifying),
  do not describe it again. Only mention session format when it differs from the norm
  for that season — for example, sprint weekends replacing FP2 with sprint qualifying,
  or a format change introduced mid-season. If nothing changed, just report results.

### Tense

| Phase | Tense |
|---|---|
| `preseason` | Present tense — the season is about to begin. |
| `preview` | Present tense for the state going into this race. Past tense for events that happened at a previous race. |

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
| `Schumacher called the win "a relief after Hockenheim" — his first finish in four races.` | "Schumacher was reportedly pleased with the result." (unattributed, adds nothing) |

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
- Inter-race testing sessions (where, when, who participated, notable results)

If a development directly results from the previous race (e.g. Magnussen's penalty
points from Monza triggering his ban), it goes under `### Between-race developments`
because it is a consequence with real impact on this race, not just a recap.

### Suggested heading structure for race previews

Use `###` level-3 headings. Omit any heading that has no content for a given race.
Within a season, keep headings consistent.

```markdown
### Championship standings       <!-- Required from Round 2 onward: narrative context, not a points table (the app already shows the table) -->
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
```

The `{slug}` in race previews matches the `slug` column in the races DB table.

## Full season workflow

When generating content for an entire season, generate in this order:

1. **Preseason** — from the season overview page
2. **Race previews** — one per race, in calendar order (1 → 24)

This ensures that season-level context (regulation changes, calendar, driver market) is
captured before diving into individual races.

## Verification

After generating content for a season:

```bash
pnpm check     # Zod validation + TypeScript type-check
pnpm lint --fix
pnpm dev       # Visual check on preseason, a race with content, and a race without
```

Race preview blocks render at `/seasons/{year}/{race-slug}/` via `RaceNewsCard.astro`.
Preseason content renders at `/seasons/{year}/preseason/` via `RaceNewsCard.astro`.
When no entry exists for a given race or phase, the section is silently omitted.
# Race Rewind — Claude Instructions

RaceRewind is a spoiler-free Formula 1 history companion that lets fans experience past seasons as if they were happening in real time. Users select a season and a race weekend, and the application reconstructs the state of the championship at that exact point in history: driver and constructor standings, race results up to that round, team and driver statistics, historical context, news, narratives, and season storylines, while hiding all future outcomes. The goal is to accompany race rewatches from external sources by preserving uncertainty and context, allowing users to follow a season race-by-race without accidentally learning future results. The application does not host race footage; it focuses on historical data, standings, context, and spoiler-controlled navigation through Formula 1 history.

Spoilers for a race should never be shown without an additional click and most information - such as stats - should be of before the race. Any information is always fixed to the race-weekend.

## Code style

- TypeScript/Astro files are linted with ESLint and type-checked with `pnpm check` on session stop. Run `pnpm lint --fix && pnpm check` manually if you want to clean up mid-session.

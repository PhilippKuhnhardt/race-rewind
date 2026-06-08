/**
 * Per-season team color configuration.
 *
 * ADDING COLORS
 * -------------
 * Find the team by its slug (URL key, e.g. "ferrari", "red_bull") and add
 * entries to its array. Each entry is a span:
 *
 *   { from: 2026, color: '#hex' }           – 2026 onward (open-ended = current)
 *   { from: 2025, to: 2025, color: '#hex' } – 2025 only
 *   { from: 2018, to: 2021, color: '#hex' } – 2018–2021 inclusive
 *
 * When multiple spans match a season, the one with the highest `from` wins
 * (most-specific recent span beats older ranges). Tie-break: narrowest range.
 *
 * ADDING A NEW TEAM
 * -----------------
 * Use the team's `slug` field from the DB (= the URL segment, e.g. "lotus_f1").
 * Slugs are found in static team query URLs and team data payloads.
 * Rebrands are separate slugs (e.g. toro_rosso → alphatauri → rb).
 *
 * COVERAGE NOTES (as of initial population)
 * ------------------------------------------
 * Full coverage from 2013 for all teams on the 2013–2014 grid.
 */

export interface TeamColorSpan {
  /** First season inclusive. Omit for open-ended past. */
  from?: number;
  /** Last season inclusive. Omit for open-ended future (current). */
  to?: number;
  /** Hex color string, e.g. '#ED1131'. */
  color: string;
}

/**
 * Hand-curated team color map. Spans listed most-recent first (convention only,
 * order does not affect resolution — the resolver always finds the highest `from`).
 */
export const TEAM_COLORS: Record<string, TeamColorSpan[]> = {
  // ── Current 2026 grid ─────────────────────────────────────────────────────
  ferrari: [
    { from: 2026, color: '#E8002D' },
    { from: 2025, to: 2025, color: '#ED1131' },
    { from: 2024, to: 2024, color: '#E8002D' },
    { from: 2023, to: 2023, color: '#F91536' },
    { from: 2022, to: 2022, color: '#ED1C24' },
    { from: 2021, to: 2021, color: '#DC0000' },
    { from: 2020, to: 2020, color: '#C00000' },
    { from: 2018, to: 2019, color: '#DC0000' },
    { from: 2013, to: 2017, color: '#C30000' },
    { from: 1996, to: 2012, color: '#D40000' }, // Schumacher/Marlboro-era Rosso
    { from: 1968, to: 1995, color: '#CC0000' }, // classic Rosso Corsa
    { to: 1967, color: '#CC0000' }, // Rosso Corsa
  ],
  mercedes: [
    { from: 2026, color: '#27F4D2' },
    { from: 2025, to: 2025, color: '#00D7B6' },
    { from: 2024, to: 2024, color: '#27F4D2' },
    { from: 2022, to: 2023, color: '#6CD3BF' },
    { from: 2018, to: 2021, color: '#00D2BE' },
    { from: 2017, to: 2017, color: '#00CFBA' },
    { from: 2010, to: 2016, color: '#2AB4A5' }, // Petronas teal accent on silver works cars
    { from: 1954, to: 1955, color: '#C0C0C0' }, // Silberpfeil
  ],
  mclaren: [
    { from: 2026, color: '#FF8000' },
    { from: 2025, to: 2025, color: '#F47600' },
    { from: 2024, to: 2024, color: '#FF8000' },
    { from: 2022, to: 2023, color: '#F58020' },
    { from: 2018, to: 2021, color: '#FF8700' },
    { from: 2017, to: 2017, color: '#FF7B08' },
    { from: 2013, to: 2016, color: '#808080' },
    { from: 2006, to: 2012, color: '#ABABAB' }, // chrome (Vodafone era)
    { from: 1997, to: 2005, color: '#C0C0C0' }, // West silver
    { from: 1974, to: 1996, color: '#CC0000' }, // Marlboro red/white
    { from: 1972, to: 1973, color: '#FFFFFF' }, // Yardley white
    { from: 1968, to: 1971, color: '#FF7200' }, // Papaya Orange
  ],
  red_bull: [
    { from: 2026, color: '#3671C6' },
    { from: 2025, to: 2025, color: '#4781D7' },
    { from: 2023, to: 2024, color: '#3671C6' },
    { from: 2022, to: 2022, color: '#1E5BC6' },
    { from: 2020, to: 2021, color: '#0600EF' },
    { from: 2019, to: 2019, color: '#1E41FF' },
    { from: 2018, to: 2018, color: '#00327D' },
    { from: 2016, to: 2017, color: '#00007D' },
    { from: 2013, to: 2015, color: '#4F1AAB' },
    { from: 2005, to: 2012, color: '#1E2A5A' }, // dark blue Red Bull era, before Infiniti purple/blue
  ],
  williams: [
    { from: 2025, color: '#1868DB' },
    { from: 2024, to: 2024, color: '#64C4FF' },
    { from: 2022, to: 2023, color: '#37BEDD' },
    { from: 2021, to: 2021, color: '#005AFF' },
    { from: 2020, to: 2020, color: '#0082FA' },
    { from: 2014, to: 2019, color: '#FFFFFF' },
    { from: 2013, to: 2013, color: '#003594' },
    { from: 2000, to: 2012, color: '#00205B' }, // BMW navy
    { from: 1998, to: 1999, color: '#CC0000' }, // Winfield red
    { from: 1994, to: 1997, color: '#003366' }, // Rothmans navy/white
    { from: 1985, to: 1993, color: '#0039A6' }, // Canon blue/yellow
    { from: 1975, to: 1984, color: '#006633' }, // Saudia white/green
  ],
  haas: [
    { from: 2026, color: '#DEE1E2' },
    { from: 2025, to: 2025, color: '#9C9FA2' },
    { from: 2022, to: 2024, color: '#B6BABD' },
    { from: 2021, to: 2021, color: '#FFFFFF' },
    { from: 2020, to: 2020, color: '#787878' },
    { from: 2019, to: 2019, color: '#F0D787' },
    { from: 2018, to: 2018, color: '#5A5A5A' },
    { from: 2016, to: 2017, color: '#6C0000' },
  ],
  // Alpine — only since 2021; Renault era uses 'renault' slug
  alpine: [
    { from: 2025, color: '#00A1E8' },
    { from: 2024, to: 2024, color: '#FF87BC' },
    { from: 2022, to: 2023, color: '#2293D1' },
    { from: 2021, to: 2021, color: '#0090FF' },
  ],
  aston_martin: [
    { from: 2024, color: '#229971' },
    // historical F1 entry (1959-1960) used BRG
    { from: 2023, to: 2023, color: '#358C75' },
    { from: 2022, to: 2022, color: '#2D826D' },
    { from: 2021, to: 2021, color: '#006F62' },
    { from: 1959, to: 1960, color: '#004225' }, // BRG
  ],
  // Racing Bulls 2024+; AlphaTauri era uses 'alphatauri' slug
  rb: [
    { from: 2026, color: '#6692FF' },
    { from: 2025, to: 2025, color: '#6C98FF' },
    { from: 2024, to: 2024, color: '#6692FF' },
  ],
  audi: [{ from: 2026, color: '#FF2D00' }],
  cadillac: [{ from: 2026, color: '#AAAAAD' }],

  // ── Predecessor / rebrand slugs ───────────────────────────────────────────
  // AlphaTauri 2020–2023 (Toro Rosso before → RB after)
  alphatauri: [
    { from: 2023, to: 2023, color: '#5E8FAA' },
    { from: 2022, to: 2022, color: '#4E7C9B' },
    { from: 2021, to: 2021, color: '#2B4562' },
    { from: 2020, to: 2020, color: '#C8C8C8' },
  ],
  // Toro Rosso 2006–2019 (AlphaTauri after)
  toro_rosso: [
    { from: 2019, to: 2019, color: '#469BFF' },
    { from: 2018, to: 2018, color: '#0032FF' },
    { from: 2016, to: 2017, color: '#0000FF' },
    { from: 2013, to: 2015, color: '#0005C1' },
    { from: 2006, to: 2012, color: '#001E62' }, // dark blue with red/gold charging bull
  ],
  // Renault: works team 1977–1985 + 2002–2011, then 2016–2020 (Alpine after)
  renault: [
    { from: 2018, to: 2020, color: '#FFF500' },
    { from: 2016, to: 2017, color: '#FFD800' },
    { from: 2010, to: 2011, color: '#1A1A1A' }, // Lotus Renault black/gold (JPS revival)
    { from: 2007, to: 2009, color: '#FF8000' }, // ING orange & blue
    { from: 2002, to: 2006, color: '#FFF500' }, // Mild Seven yellow/blue (Alonso titles '05/'06)
    { from: 1977, to: 1985, color: '#FFD700' }, // ELF yellow/black — turbo pioneers ("yellow teapot")
  ],
  // Force India 2008–2018 (Racing Point after)
  force_india: [
    { from: 2018, to: 2018, color: '#F596C8' },
    { from: 2017, to: 2017, color: '#FF80C7' },
    { from: 2008, to: 2016, color: '#FF5F0F' }, // orange/green/white tricolour livery
  ],
  // Racing Point 2019–2020 (Aston Martin after)
  racing_point: [{ from: 2019, to: 2020, color: '#F596C8' }],
  // Sauber slug covers 1993–2018 AND 2024–2025 (Alfa Romeo era uses 'alfa' slug)
  sauber: [
    { from: 2025, to: 2025, color: '#01C00E' }, // Kick Sauber
    { from: 2024, to: 2024, color: '#52E252' }, // Kick Sauber
    { from: 2018, to: 2018, color: '#9B0000' },
    { from: 2016, to: 2017, color: '#006EFF' },
    { from: 2015, to: 2015, color: '#0063FF' },
    { from: 2013, to: 2014, color: '#8899A8' },
    { from: 2010, to: 2012, color: '#4A4A4A' }, // white/dark grey with red accents after BMW exit
    { from: 2001, to: 2005, color: '#003DA5' }, // Petronas blue
    { from: 1997, to: 2000, color: '#1E2A5A' }, // Red Bull dark blue
    { from: 1993, to: 1996, color: '#1A1A1A' }, // early black Sauber cars
  ],
  // Alfa Romeo / Alfa Romeo Racing 2019–2023 (Sauber before and after)
  // The original Alfa Romeo works team raced 1950-1951 under Italian colours.
  alfa: [
    { from: 2023, to: 2023, color: '#C92D4B' },
    { from: 2022, to: 2022, color: '#B12039' },
    { from: 2021, to: 2021, color: '#900000' },
    { from: 2020, to: 2020, color: '#960000' },
    { from: 2019, to: 2019, color: '#9B0000' },
    { from: 1979, to: 1985, color: '#CC0000' }, // Marlboro-era works Alfa red/white
    { from: 1963, to: 1965, color: '#CC0000' },
    { to: 1951, color: '#CC0000' }, // Rosso Corsa (1950-1951 works team)
  ],
  // Lotus F1 2012–2015
  lotus_f1: [{ from: 2012, to: 2015, color: '#FFB800' }], // black/gold JPS-inspired livery
  // Caterham 2012–2014
  caterham: [
    { from: 2013, to: 2014, color: '#006633' },
    { from: 2012, to: 2012, color: '#004225' }, // BRG, inherited from Lotus/Team Lotus identity
  ],
  // Marussia 2012–2014 → Manor Marussia 2015–2016
  marussia: [{ from: 2012, to: 2014, color: '#6E0000' }], // deep red/black
  manor: [
    { from: 2016, to: 2016, color: '#323232' },
    { from: 2015, to: 2015, color: '#6E0000' },
  ],
  // New-team era backmarkers, 2010–2012.
  lotus_racing: [{ from: 2010, to: 2011, color: '#004225' }], // British racing green with yellow trim
  hrt: [
    { from: 2012, to: 2012, color: '#8B1A1A' }, // red/gold
    { from: 2011, to: 2011, color: '#D50000' }, // white car, red accent used as visible UI color
    { from: 2010, to: 2010, color: '#3A3A3A' }, // dark grey with red/white/orange trim
  ],
  virgin: [{ from: 2010, to: 2011, color: '#C00000' }], // black/red with white trim
  super_aguri: [{ from: 2006, to: 2008, color: '#D50000' }], // white/red Honda-backed livery
  spyker: [{ from: 2007, to: 2007, color: '#FF6A00' }], // Dutch orange
  spyker_mf1: [{ from: 2006, to: 2006, color: '#FF6A00' }], // late-2006 Spyker orange
  mf1: [{ from: 2006, to: 2006, color: '#C00000' }], // Midland red/white/silver

  // ── National racing era (pre-1968) ───────────────────────────────────────
  // Until 1967 (inclusive) cars raced in national colours. Teams that retired
  // by 1967 use open spans; teams that continued after 1967 are capped at
  // to:1967 (post-1967 liveries tracked separately if needed).
  //
  //  Rosso Corsa – Italian  #CC0000
  //  BRG         – British  #004225
  //  Silber      – German   #C0C0C0
  //  Bleu France – French   #0055A4
  //  White       – American / Japanese  #FFFFFF

  // ── Italian ──────────────────────────────────────────────────────────────
  maserati: [{ color: '#CC0000' }],
  lancia: [{ color: '#CC0000' }],
  osca: [{ color: '#CC0000' }],
  cisitalia: [{ color: '#CC0000' }],
  milano: [{ color: '#CC0000' }],
  'tec-mec': [{ color: '#CC0000' }],
  'arzani-volpini': [{ color: '#CC0000' }],
  'behra-porsche': [{ color: '#CC0000' }],
  'de_tomaso-alfa_romeo': [{ color: '#CC0000' }],
  'de_tomaso-ferrari': [{ color: '#CC0000' }],
  'de_tomaso-osca': [{ color: '#CC0000' }],
  tomaso: [
    { from: 1970, to: 1970, color: '#CC0000' },
    { to: 1967, color: '#CC0000' },
  ], // ran until 1970
  // 1963 Italian ATS and 1977-1984 German ATS share the same DB slug.
  ats: [
    { from: 1977, to: 1984, color: '#003DA5' }, // German ATS blue/white era
    { from: 1963, to: 1963, color: '#CC0000' },
  ],

  // ── British ──────────────────────────────────────────────────────────────
  brm: [
    { from: 1972, to: 1977, color: '#D50032' }, // Marlboro/Stanley BRM red
    { from: 1970, to: 1971, color: '#FFFFFF' }, // Yardley white
    { from: 1968, to: 1969, color: '#004225' },
    { to: 1967, color: '#004225' },
  ], // ran until 1977
  vanwall: [{ color: '#004225' }],
  team_lotus: [
    { from: 1991, to: 1994, color: '#00482B' }, // late green revival (Tamiya/Hitachi)
    { from: 1987, to: 1990, color: '#FFD400' }, // Camel yellow
    { from: 1972, to: 1986, color: '#C4A028' }, // John Player Special — JPS gold (black chassis)
    { from: 1968, to: 1971, color: '#C8102E' }, // Gold Leaf red/white/gold
    { to: 1967, color: '#004225' }, // BRG
  ],
  lola: [
    { from: 1997, to: 1997, color: '#D50032' }, // MasterCard red/gold
    { from: 1993, to: 1993, color: '#D40000' }, // BMS Scuderia Italia red
    { from: 1986, to: 1991, color: '#D40000' }, // Larrousse-Calmels red/white Lola entries
    { from: 1985, to: 1985, color: '#D50032' }, // Haas/Lola red/white
    { from: 1974, to: 1975, color: '#D50032' }, // Embassy Hill red/white Lola entries
    { from: 1968, to: 1968, color: '#FFFFFF' }, // Honda/Lola white
    { to: 1967, color: '#004225' },
  ], // ran until 1997
  connaught: [{ color: '#004225' }],
  hwm: [{ color: '#004225' }],
  alta: [{ color: '#004225' }],
  era: [{ color: '#004225' }],
  brp: [{ color: '#004225' }],
  emeryson: [{ color: '#004225' }],
  gilby: [{ color: '#004225' }],
  jbw: [{ color: '#004225' }],
  scirocco: [{ color: '#004225' }],
  protos: [{ color: '#004225' }],
  shannon: [{ color: '#004225' }],
  derrington: [{ color: '#004225' }],
  frazer_nash: [{ color: '#004225' }],
  butterworth: [{ color: '#004225' }],
  fry: [{ color: '#004225' }],
  ferguson: [{ color: '#004225' }],
  cooper: [{ color: '#004225' }],
  'cooper-climax': [{ color: '#004225' }],
  'cooper-maserati': [{ color: '#004225' }],
  'cooper-alfa_romeo': [{ color: '#004225' }],
  'cooper-borgward': [{ color: '#004225' }],
  'cooper-castellotti': [{ color: '#004225' }],
  'cooper-ferrari': [{ color: '#004225' }],
  'cooper-ford': [{ color: '#004225' }],
  'cooper-osca': [{ color: '#004225' }],
  'cooper-ats': [{ color: '#004225' }],
  'cooper-brm': [{ color: '#004225' }],
  brabham: [
    { from: 1988, to: 1992, color: '#3B7DD8' }, // revival-era light blue
    { from: 1978, to: 1987, color: '#FFFFFF' }, // Parmalat white/blue (Piquet titles '81/'83)
    { from: 1968, to: 1977, color: '#004225' }, // dark green → Martini era
    { to: 1967, color: '#004225' }, // BRG
  ],
  'brabham-brm': [{ color: '#004225' }],
  'brabham-climax': [{ color: '#004225' }],
  'brabham-ford': [
    { from: 1978, to: 1979, color: '#FFFFFF' }, // Parmalat white/blue
    { from: 1968, to: 1977, color: '#004225' }, // Brabham green
    { to: 1967, color: '#004225' },
  ], // ran until 1979
  'brabham-repco': [{ to: 1969, color: '#004225' }], // ran until 1969
  'brm-ford': [{ from: 1969, to: 1969, color: '#004225' }],
  'mclaren-brm': [
    { from: 1968, to: 1968, color: '#FF7200' }, // papaya orange
    { from: 1967, to: 1967, color: '#D50032' }, // red/silver 1967 cars
  ],
  'mclaren-ford': [
    { from: 1968, to: 1970, color: '#FF7200' }, // papaya orange
    { from: 1967, to: 1967, color: '#D50032' }, // red/silver 1967 cars
    { from: 1966, to: 1966, color: '#FFFFFF' }, // white/dark green debut livery
  ],
  'mclaren-seren': [{ from: 1966, to: 1966, color: '#FFFFFF' }], // white/dark green debut livery
  'mclaren-alfa_romeo': [{ color: '#004225' }],
  'lotus-climax': [{ color: '#004225' }],
  'lotus-ford': [
    { from: 1968, to: 1971, color: '#C8102E' }, // Gold Leaf red/white/gold
    { to: 1967, color: '#004225' }, // BRG
  ],
  'lotus-brm': [{ color: '#004225' }],
  'lotus-maserati': [{ color: '#004225' }],
  'lotus-borgward': [{ color: '#004225' }],
  'lotus-pw': [{ from: 1971, to: 1971, color: '#C8102E' }], // Gold Leaf turbine car

  // ── German ───────────────────────────────────────────────────────────────
  porsche: [{ color: '#C0C0C0' }],
  veritas: [{ color: '#C0C0C0' }],
  afm: [{ color: '#C0C0C0' }],
  bmw: [{ color: '#C0C0C0' }], // 1952-53 historic BMW (≠ bmw_sauber)
  klenk: [{ color: '#C0C0C0' }],
  emw: [{ color: '#C0C0C0' }],

  // ── French ───────────────────────────────────────────────────────────────
  gordini: [{ color: '#0055A4' }],
  matra: [{ color: '#0055A4' }],
  lago: [{ color: '#0055A4' }],
  simca: [{ color: '#0055A4' }],
  bugatti: [{ color: '#0055A4' }],

  // ── American (white) ─────────────────────────────────────────────────────
  // Indy 500 entries (1950-1960) and proper F1 constructors
  'eagle-climax': [{ color: '#FFFFFF' }],
  'eagle-weslake': [{ color: '#FFFFFF' }],
  scarab: [{ color: '#FFFFFF' }],
  adams: [{ color: '#FFFFFF' }],
  bromme: [{ color: '#FFFFFF' }],
  vhristensen: [{ color: '#FFFFFF' }],
  deidt: [{ color: '#FFFFFF' }],
  del_roy: [{ color: '#FFFFFF' }],
  dunn: [{ color: '#FFFFFF' }],
  elder: [{ color: '#FFFFFF' }],
  epperly: [{ color: '#FFFFFF' }],
  ewing: [{ color: '#FFFFFF' }],
  hall: [{ color: '#FFFFFF' }],
  kurtis_kraft: [{ color: '#FFFFFF' }],
  kuzma: [{ color: '#FFFFFF' }],
  langley: [{ color: '#FFFFFF' }],
  lesovsky: [{ color: '#FFFFFF' }],
  marchese: [{ color: '#FFFFFF' }],
  meskowski: [{ color: '#FFFFFF' }],
  moore: [{ color: '#FFFFFF' }],
  nichels: [{ color: '#FFFFFF' }],
  olson: [{ color: '#FFFFFF' }],
  pankratz: [{ color: '#FFFFFF' }],
  pawl: [{ color: '#FFFFFF' }],
  phillips: [{ color: '#FFFFFF' }],
  rae: [{ color: '#FFFFFF' }],
  schroeder: [{ color: '#FFFFFF' }],
  sherman: [{ color: '#FFFFFF' }],
  snowberger: [{ color: '#FFFFFF' }],
  stevens: [{ color: '#FFFFFF' }],
  sutton: [{ color: '#FFFFFF' }],
  trevis: [{ color: '#FFFFFF' }],
  turner: [{ color: '#FFFFFF' }],
  watson: [{ color: '#FFFFFF' }],
  wetteroth: [{ color: '#FFFFFF' }],

  // ── Japanese (white) ─────────────────────────────────────────────────────
  honda: [
    { from: 2007, to: 2008, color: '#3A7DC9' }, // "Earth Car" globe livery
    { from: 2006, to: 2006, color: '#FFFFFF' }, // white/red Honda (Button's Hungary '06 win)
    { from: 1968, to: 1968, color: '#FFFFFF' },
    { to: 1967, color: '#FFFFFF' }, // 1960s works Honda — national white
  ],

  // ── Modern legends (post-1967, sponsor liveries) ─────────────────────────
  // Iconic constructors that ran after the national-colour era.
  tyrrell: [{ from: 1970, to: 1998, color: '#003DA5' }], // Elf blue (Stewart titles, P34 six-wheeler)
  shadow: [{ from: 1973, to: 1980, color: '#1A1A1A' }], // UOP black
  'shadow-ford': [{ from: 1973, to: 1975, color: '#1A1A1A' }],
  'shadow-matra': [{ from: 1975, to: 1975, color: '#1A1A1A' }],
  hesketh: [{ from: 1974, to: 1978, color: '#FFFFFF' }], // white "the Bear" (Hunt's '75 Zandvoort win)
  wolf: [{ from: 1976, to: 1979, color: '#0E2C5C' }], // Walter Wolf navy & gold (Scheckter won debut)
  ligier: [{ from: 1976, to: 1996, color: '#0F4FA8' }], // Gitanes French blue
  arrows: [
    { from: 1991, to: 1996, color: '#D50032' }, // Footwork red/white years
    { from: 2000, to: 2002, color: '#FF6A00' }, // Orange Arrows
    { from: 1978, to: 1999, color: '#1A1A1A' }, // black/gold early era
  ],
  benetton: [
    { from: 1998, to: 2001, color: '#0090D0' }, // Mild Seven / Playlife blue
    { from: 1986, to: 1997, color: '#00A551' }, // United Colors green (Schumacher titles '94/'95)
  ],
  jordan: [
    { from: 1997, to: 2005, color: '#FFD400' }, // Benson & Hedges yellow
    { from: 1991, to: 1996, color: '#0E7A3B' }, // 7Up green (the 191)
  ],
  stewart: [{ from: 1997, to: 1999, color: '#FFFFFF' }], // white with tartan
  jaguar: [{ from: 2000, to: 2004, color: '#0A4D2C' }], // British Racing Green
  bar: [{ from: 1999, to: 2005, color: '#D50032' }], // Lucky Strike red/white
  toyota: [{ from: 2002, to: 2009, color: '#EB0A1E' }], // white & red
  bmw_sauber: [{ from: 2006, to: 2009, color: '#0066B1' }], // BMW blue/white/red
  brawn: [{ from: 2009, to: 2009, color: '#DCE000' }], // fluoro-yellow & white (Button's title)
  minardi: [{ from: 1985, to: 2005, color: '#1A1A1A' }], // black (later Australian-flag livery)
  prost: [{ from: 1997, to: 2001, color: '#0A3A82' }], // Gauloises blue
  footwork: [{ from: 1991, to: 1996, color: '#D50032' }], // red/white Footwork-Arrows era
  forti: [{ from: 1995, to: 1996, color: '#FFD400' }], // yellow
  pacific: [{ from: 1994, to: 1995, color: '#003DA5' }], // dark blue/silver
  simtek: [{ from: 1994, to: 1995, color: '#1A1A1A' }], // black with purple/gold accents
  larrousse: [{ from: 1987, to: 1994, color: '#D40000' }], // red/white Larrousse-Lola identity
  dallara: [{ from: 1988, to: 1992, color: '#D40000' }], // Scuderia Italia red
  fondmetal: [{ from: 1991, to: 1992, color: '#D40000' }], // Fondmetal red/yellow
  march: [
    { from: 1992, to: 1992, color: '#003DA5' },
    { from: 1987, to: 1991, color: '#6FD8E8' }, // Leyton House turquoise
    { from: 1970, to: 1982, color: '#003DA5' },
  ],
  leyton: [{ from: 1990, to: 1991, color: '#6FD8E8' }], // Leyton House turquoise
  moda: [{ from: 1992, to: 1992, color: '#1A1A1A' }], // Andrea Moda black
  lambo: [{ from: 1991, to: 1991, color: '#003DA5' }], // Modena Team blue
  life: [{ from: 1990, to: 1990, color: '#CC0000' }], // red
  ags: [{ from: 1986, to: 1991, color: '#0055A4' }], // French blue/white privateer
  coloni: [{ from: 1987, to: 1991, color: '#FFD400' }], // yellow late-era Coloni
  eurobrun: [{ from: 1988, to: 1990, color: '#D40000' }], // white/red
  onyx: [{ from: 1989, to: 1990, color: '#003DA5' }], // blue/pink
  osella: [{ from: 1980, to: 1990, color: '#0055A4' }], // blue/white Italian privateer
  rial: [{ from: 1988, to: 1989, color: '#003DA5' }], // blue
  zakspeed: [{ from: 1985, to: 1989, color: '#D50032' }], // red/white West-backed cars
  ram: [{ from: 1983, to: 1985, color: '#003DA5' }], // blue/white
  spirit: [{ from: 1983, to: 1985, color: '#003DA5' }], // blue/white Honda/Hart era
  toleman: [
    { from: 1985, to: 1985, color: '#00A551' }, // Benetton green/multicolour
    { from: 1981, to: 1984, color: '#FFFFFF' }, // white/blue Toleman
  ],
  ensign: [{ from: 1973, to: 1982, color: '#003DA5' }], // blue/white sponsor liveries
  fittipaldi: [{ from: 1975, to: 1982, color: '#FFD400' }], // Copersucar/Fittipaldi yellow
  theodore: [{ from: 1977, to: 1983, color: '#D50032' }], // red/white
  'brabham-alfa_romeo': [{ from: 1976, to: 1979, color: '#FFFFFF' }], // Martini/Parmalat white
  surtees: [{ from: 1970, to: 1978, color: '#D50032' }], // red sponsor-era Surtees
  iso_marlboro: [{ from: 1973, to: 1974, color: '#D50032' }], // Marlboro red/white
  penske: [{ from: 1974, to: 1977, color: '#003DA5' }], // blue/white/red Penske entries
  parnelli: [{ from: 1974, to: 1976, color: '#003DA5' }], // blue/red/white
  hill: [{ from: 1975, to: 1975, color: '#D50032' }], // Embassy red/white
  lyncar: [{ from: 1974, to: 1975, color: '#003DA5' }], // blue
  maki: [{ from: 1974, to: 1976, color: '#FFFFFF' }], // Japanese white
  kojima: [{ from: 1976, to: 1977, color: '#FFFFFF' }], // Japanese white/green
  tecno: [{ from: 1972, to: 1973, color: '#CC0000' }], // Italian red
  politoys: [{ from: 1972, to: 1972, color: '#003DA5' }], // Frank Williams blue
  connew: [{ from: 1972, to: 1972, color: '#FFFFFF' }], // white
  bellasi: [{ from: 1970, to: 1971, color: '#D50032' }], // Swiss red/white
  'march-ford': [{ from: 1971, to: 1971, color: '#D50032' }], // STP red March
  'march-alfa_romeo': [{ from: 1971, to: 1971, color: '#D50032' }],
  amon: [{ from: 1974, to: 1974, color: '#003DA5' }],
  token: [{ from: 1974, to: 1974, color: '#D50032' }],
  trojan: [{ from: 1974, to: 1974, color: '#D50032' }],
  boro: [{ from: 1976, to: 1977, color: '#FF6A00' }], // Dutch orange
  lec: [{ from: 1977, to: 1977, color: '#003DA5' }],
  mcguire: [{ from: 1977, to: 1977, color: '#FFFFFF' }],
  apollon: [{ from: 1977, to: 1977, color: '#FFFFFF' }],
  martini: [{ from: 1978, to: 1978, color: '#0055A4' }], // French blue
  merzario: [{ from: 1978, to: 1979, color: '#CC0000' }], // Italian red
  rebaque: [{ from: 1979, to: 1979, color: '#1A1A1A' }], // black/gold Lotus-derived car
  kauhsen: [{ from: 1979, to: 1979, color: '#FFFFFF' }],
  lds: [{ from: 1962, to: 1968, color: '#004225' }], // South African green
  'lds-climax': [{ from: 1965, to: 1967, color: '#004225' }],
  'lds-alfa_romeo': [{ from: 1965, to: 1965, color: '#004225' }],
  re: [{ from: 1965, to: 1965, color: '#004225' }], // Rhodesian green
  stebro: [{ from: 1963, to: 1963, color: '#FFFFFF' }], // Canadian white/red
  enb: [{ from: 1962, to: 1962, color: '#FFD400' }], // Belgian racing yellow
  mbm: [{ from: 1961, to: 1961, color: '#D50032' }], // Swiss red/white
  'matra-ford': [{ color: '#0055A4' }], // French blue (Stewart's '69 title)
};

/**
 * Resolve the hex color for a team in a given season.
 *
 * Returns `null` when the team has no configured color for that season
 * (gracefully degrades — callers should render nothing or a placeholder).
 */
export function teamColor(slug: string | null | undefined, season: number): string | null {
  if (!slug) return null;
  const spans = TEAM_COLORS[slug];
  if (!spans || spans.length === 0) return null;

  const matches = spans.filter(
    (s) => season >= (s.from ?? -Infinity) && season <= (s.to ?? Infinity)
  );
  if (matches.length === 0) return null;

  // Most-specific span wins: highest `from` first, then narrowest range.
  return matches.sort((a, b) => {
    const fromDiff = (b.from ?? -Infinity) - (a.from ?? -Infinity);
    if (fromDiff !== 0) return fromDiff;
    const aWidth = (a.to ?? Infinity) - (a.from ?? -Infinity);
    const bWidth = (b.to ?? Infinity) - (b.from ?? -Infinity);
    return aWidth - bWidth;
  })[0].color;
}

import { z } from 'zod';

// Object schemas allow additional API fields. Required nullable fields must
// still be present; optional fields are only those Jolpica legitimately omits.
const text = z.string().min(1);
const integer = z.number().int();
const timestamp = text.refine(value => !Number.isNaN(Date.parse(value)), 'Invalid timestamp');
const resultCode = z.enum(['R', 'Q', 'SR', 'SQ', 'FP1', 'FP2', 'FP3']);
const roundFields = { id: text, name: text, wikipedia: text.nullable() };
const roundSchema = z.discriminatedUnion('is_cancelled', [
  z.object({
    ...roundFields,
    is_cancelled: z.literal(false),
    number: integer.positive(),
    race_number: integer.positive(),
  }),
  // Cancelled events do not receive championship or race numbers.
  z.object({
    ...roundFields,
    is_cancelled: z.literal(true),
    number: integer.positive().nullish(),
    race_number: integer.positive().nullish(),
  }),
]);

export const scheduleResponseSchema = z.object({
  data: z.object({
    events: z.array(z.object({
      round: roundSchema,
      circuit: z.object({
        id: text,
        name: text,
        locality: text.nullable(),
        country_code: text.nullable(),
        country: text.nullable(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
        altitude: z.number().nullable(),
        wikipedia: text.nullable(),
      }),
      schedule: z.array(z.object({
        code: text,
        timestamp: timestamp.nullable(),
        timezone: text.nullable(),
        sessions: z.array(z.object({
          id: text,
          number: integer.nullish(),
          type: text,
          is_cancelled: z.boolean(),
          // This field is omitted by the schedule endpoint for some sessions.
          scheduled_laps: integer.nullish(),
        })),
      })),
    })),
  }),
});

export const availableResultsResponseSchema = z.object({
  data: z.object({
    available_results: z.array(z.object({ code: resultCode })),
  }),
});

const alphaResultSchema = z.object({
  driver: z.object({
    id: text,
    abbreviation: text.nullable(),
    given_name: text,
    family_name: text,
  }),
  team: z.object({ id: text, name: text }),
  position: integer.nullable(),
  // No time is emitted when a driver did not set a time.
  time: text.nullish(),
  is_classified: z.boolean().nullable(),
  status: text.nullable(),
  car_number: integer.nullable(),
  components: z.record(z.string(), z.object({
    position: integer.nullable(),
    time: text.nullish(),
  })),
});

const raceResultSchema = alphaResultSchema.extend({
  points: z.number().nullable(),
  laps: integer.nonnegative().nullable(),
});
const qualifyingResultSchema = alphaResultSchema.extend({
  // Qualifying responses omit points and laps.
  points: z.number().nullish(),
  laps: integer.nonnegative().nullish(),
});

export const alphaResultResponseSchema = z.object({
  data: z.discriminatedUnion('code', [
    z.object({ code: z.literal('R'), results: z.array(raceResultSchema) }),
    z.object({ code: z.literal('SR'), results: z.array(raceResultSchema) }),
    z.object({ code: z.literal('Q'), results: z.array(qualifyingResultSchema) }),
    z.object({ code: z.literal('SQ'), results: z.array(qualifyingResultSchema) }),
  ]),
});

const numericText = text.refine(value => Number.isFinite(Number(value)), 'Expected a numeric string');
const integerText = text.regex(/^\d+$/, 'Expected a nonnegative integer string');
const standingFields = { position: integerText, points: numericText, wins: integerText };
const constructorSchema = z.object({ name: text });

export const driverStandingsResponseSchema = z.object({
  MRData: z.object({
    StandingsTable: z.object({
      StandingsLists: z.array(z.object({
        DriverStandings: z.array(z.object({
          ...standingFields,
          Driver: z.object({ code: text.optional(), givenName: text, familyName: text }),
          Constructors: z.array(constructorSchema),
        })),
      })),
    }),
  }),
});

export const constructorStandingsResponseSchema = z.object({
  MRData: z.object({
    StandingsTable: z.object({
      StandingsLists: z.array(z.object({
        ConstructorStandings: z.array(z.object({
          ...standingFields,
          Constructor: constructorSchema,
        })),
      })),
    }),
  }),
});

export type ScheduleEvent = z.infer<typeof scheduleResponseSchema>['data']['events'][number];
export type ResultType = z.infer<typeof resultCode>;
export type AlphaResultResponse = z.infer<typeof alphaResultResponseSchema>;
export type AlphaResult = AlphaResultResponse['data']['results'][number];

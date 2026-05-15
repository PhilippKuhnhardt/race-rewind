export interface IngestState {
  seasons: Map<number, number>;       // jolpica_id → year
  circuits: Map<number, number>;      // jolpica_id → internal_id
  drivers: Map<number, number>;       // jolpica_id → internal_id
  teams: Map<number, number>;         // jolpica_id → internal_id
  raceNumberByRoundJolpicaId: Map<string, number>;  // jolpica round_id → race_number
  reInternalMap: Map<number, number>;      // jolpica round_entry_id → internal_id
  sessionInternalMap: Map<number, number>; // jolpica session_id → internal_id
}

export function emptyState(): IngestState {
  return {
    seasons: new Map(),
    circuits: new Map(),
    drivers: new Map(),
    teams: new Map(),
    raceNumberByRoundJolpicaId: new Map(),
    reInternalMap: new Map(),
    sessionInternalMap: new Map(),
  };
}

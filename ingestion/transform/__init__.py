from dataclasses import dataclass, field


@dataclass
class IngestState:
    """Typed container for all jolpica_id → internal_id maps built during ingest."""

    seasons:  dict[int, int]  # jolpica_id → year
    circuits: dict[int, int]  # jolpica_id → internal_id
    drivers:  dict[int, int]  # jolpica_id → internal_id
    teams:    dict[int, int]  # jolpica_id → internal_id

    # Populated by timeline.load()
    race_number_by_round_jolpica_id: dict[str, int] = field(default_factory=dict)

    # Populated by entries.load()
    re_internal_map:      dict[int, int] = field(default_factory=dict)
    session_internal_map: dict[int, int] = field(default_factory=dict)

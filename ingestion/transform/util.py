import csv
import pathlib


def read_csv(dump_dir: pathlib.Path, name: str) -> list[dict]:
    with open(dump_dir / name, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def as_int(row: dict, key: str) -> int | None:
    v = row.get(key)
    return int(v) if v else None


def as_float(row: dict, key: str) -> float | None:
    v = row.get(key)
    return float(v) if v else None


def as_bool(row: dict, key: str) -> int:
    return 1 if row.get(key) == "t" else 0

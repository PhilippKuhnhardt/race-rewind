"""Slug generation — deterministic and stable across ingest re-runs."""

import re
import unicodedata


def slugify(text: str) -> str:
    """Lowercase, ASCII-safe, hyphen-separated slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def driver_slug(forename: str, surname: str) -> str:
    return slugify(f"{forename} {surname}")


def race_slug(year: int | str, name: str) -> str:
    return slugify(f"{year} {name}")


def deduplicate(slug: str, existing: set[str]) -> str:
    """Append a numeric suffix until the slug is unique."""
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}-{n}" in existing:
        n += 1
    return f"{slug}-{n}"

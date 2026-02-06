#!/usr/bin/env python3
import csv
import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
INPUT_JSON = ROOT / "directory.json"
OUTPUT_CSV = ROOT / "organization_candidates_from_recurring.csv"

PLATFORM_DOMAINS = {
    "eventbrite.com",
    "eventbrite.co.uk",
    "meetup.com",
    "ra.co",
    "instagram.com",
}


def norm_domain(url: str) -> str:
    if not url:
        return ""
    host = (urlparse(url).netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def title_from_domain(domain: str) -> str:
    base = domain.split(".")[0].replace("-", " ").replace("_", " ").strip()
    return " ".join(part.capitalize() for part in base.split())


def infer_name_from_event(event_name: str) -> str:
    if not event_name:
        return ""
    if " - " in event_name:
        right = event_name.split(" - ", 1)[1].strip()
        if right:
            return right
    if ":" in event_name:
        left = event_name.split(":", 1)[0].strip()
        if left:
            return left
    return event_name.strip()


def main() -> None:
    events = json.loads(INPUT_JSON.read_text(encoding="utf-8"))

    groups = defaultdict(lambda: {
        "suggested_org_name": "",
        "website_url": "",
        "domain": "",
        "source_method": "",
        "event_names": set(),
        "venues": set(),
    })

    for event in events:
        name = (event.get("name") or "").strip()
        url = (event.get("url") or "").strip()
        venue = ((event.get("location") or {}).get("name") or "").strip()
        domain = norm_domain(url)

        if domain and domain not in PLATFORM_DOMAINS:
            key = f"domain::{domain}"
            source_method = "domain"
            suggested_name = infer_name_from_event(name) or title_from_domain(domain)
            website_url = url
        else:
            suggested_name = infer_name_from_event(name)
            key = f"name::{suggested_name.lower()}"
            source_method = "event_name"
            website_url = ""

        row = groups[key]
        row["suggested_org_name"] = row["suggested_org_name"] or suggested_name
        row["website_url"] = row["website_url"] or website_url
        row["domain"] = row["domain"] or domain
        row["source_method"] = row["source_method"] or source_method
        if name:
            row["event_names"].add(name)
        if venue:
            row["venues"].add(venue)

    records = []
    for row in groups.values():
        count = len(row["event_names"])
        confidence = "high" if row["source_method"] == "domain" and count > 1 else "medium"
        if row["source_method"] == "event_name" and count == 1:
            confidence = "low"

        records.append({
            "suggested_org_name": row["suggested_org_name"],
            "website_url": row["website_url"],
            "domain": row["domain"],
            "source_method": row["source_method"],
            "confidence": confidence,
            "recurring_event_count": count,
            "sample_events": " | ".join(sorted(row["event_names"])[:3]),
            "venues": " | ".join(sorted(row["venues"])),
            "review_note": "Check and merge duplicates before importing organizations.",
        })

    records.sort(key=lambda r: (-r["recurring_event_count"], r["suggested_org_name"].lower()))

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "suggested_org_name",
                "website_url",
                "domain",
                "source_method",
                "confidence",
                "recurring_event_count",
                "sample_events",
                "venues",
                "review_note",
            ],
        )
        writer.writeheader()
        writer.writerows(records)

    print(f"Wrote {len(records)} organization candidates to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Import partner CSV (Resident Advisor export) into MySQL.
Skips matched events and logs audit rows.

Requires:
  python3 -m pip install mysql-connector-python

Env vars:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
Optional:
  CITY_NAME (default: Manchester)
  CITY_SLUG (default: manchester)
  CITY_REGION (default: Greater Manchester)
  CITY_COUNTRY_CODE (default: GB)
  CITY_TIMEZONE (default: Europe/London)

Usage:
  python3 scripts/import_partner_csv.py /path/to/partner.csv
"""

import csv
import os
import re
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import mysql.connector

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "queercity")

CITY_NAME = os.getenv("CITY_NAME", "Manchester")
CITY_SLUG = os.getenv("CITY_SLUG", "manchester")
CITY_REGION = os.getenv("CITY_REGION", "Greater Manchester")
CITY_COUNTRY_CODE = os.getenv("CITY_COUNTRY_CODE", "GB")
CITY_TIMEZONE = os.getenv("CITY_TIMEZONE", "Europe/London")

PRICE_RE = re.compile(r"\d+(?:\.\d+)?")


def parse_datetime(date_str: str, time_str: str) -> Optional[datetime]:
    date_str = (date_str or "").strip()
    time_str = (time_str or "").strip()
    if not date_str:
        return None
    if not time_str:
        time_str = "00:00:00"
    if len(time_str) == 5:
        time_str = time_str + ":00"
    try:
        return datetime.fromisoformat(f"{date_str}T{time_str}")
    except ValueError:
        return None


def normalize_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_price(value: str) -> Optional[float]:
    if not value:
        return None
    m = PRICE_RE.findall(str(value))
    if not m:
        return None
    try:
        return float(m[0])
    except ValueError:
        return None


def split_tags(value: str):
    if not value:
        return []
    return [t.strip().lower() for t in str(value).split(";") if t.strip()]


class Importer:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.address_cache = {}
        self.place_cache = {}
        self.tag_cache = {}
        self.city_id = None
        self.run_id = None

    def ensure_city(self):
        self.cur.execute("SELECT id FROM cities WHERE slug=%s", (CITY_SLUG,))
        row = self.cur.fetchone()
        if row:
            self.city_id = row[0]
            return
        self.cur.execute(
            "INSERT INTO cities (name, region, country_code, timezone, slug) VALUES (%s,%s,%s,%s,%s)",
            (CITY_NAME, CITY_REGION, CITY_COUNTRY_CODE, CITY_TIMEZONE, CITY_SLUG),
        )
        self.city_id = self.cur.lastrowid

    def start_run(self, source: str):
        self.cur.execute("INSERT INTO import_runs (source) VALUES (%s)", (source,))
        self.run_id = self.cur.lastrowid

    def log_row(self, source_event_id: str, action: str, reason: str = None):
        self.cur.execute(
            "INSERT INTO import_rows (run_id, source_event_id, action, reason) VALUES (%s,%s,%s,%s)",
            (self.run_id, source_event_id or None, action, reason),
        )

    def upsert_address(self, street, locality, postal, country) -> Optional[int]:
        street = normalize_str(street)
        locality = normalize_str(locality)
        postal = normalize_str(postal)
        country = normalize_str(country)
        key = (street, locality, postal, country)
        if key in self.address_cache:
            return self.address_cache[key]
        self.cur.execute(
            "SELECT id FROM postal_addresses WHERE street_address=%s AND address_locality=%s AND postal_code=%s AND address_country=%s",
            (street or None, locality or None, postal or None, country or None),
        )
        row = self.cur.fetchone()
        if row:
            self.address_cache[key] = row[0]
            return row[0]
        self.cur.execute(
            "INSERT INTO postal_addresses (street_address, address_locality, postal_code, address_country) VALUES (%s,%s,%s,%s)",
            (street or None, locality or None, postal or None, country or None),
        )
        addr_id = self.cur.lastrowid
        self.address_cache[key] = addr_id
        return addr_id

    def upsert_place(self, name, street, postal) -> Optional[int]:
        name = normalize_str(name)
        addr_id = self.upsert_address(street, CITY_NAME, postal, CITY_COUNTRY_CODE)
        key = (name, addr_id)
        if key in self.place_cache:
            return self.place_cache[key]
        self.cur.execute(
            "SELECT id FROM places WHERE name=%s AND address_id <=> %s",
            (name or None, addr_id),
        )
        row = self.cur.fetchone()
        if row:
            self.place_cache[key] = row[0]
            return row[0]
        self.cur.execute(
            "INSERT INTO places (name, address_id, city_id) VALUES (%s,%s,%s)",
            (name or None, addr_id, self.city_id),
        )
        place_id = self.cur.lastrowid
        self.place_cache[key] = place_id
        return place_id

    def find_event(self, event_id: str, url: str, name: str, start_dt: Optional[datetime], place_id: Optional[int]) -> Optional[int]:
        if event_id:
            self.cur.execute("SELECT id FROM events WHERE identifier=%s", (event_id,))
            row = self.cur.fetchone()
            if row:
                return row[0]
        if url:
            self.cur.execute("SELECT id FROM events WHERE url=%s", (url,))
            row = self.cur.fetchone()
            if row:
                return row[0]
        if name and start_dt and place_id:
            self.cur.execute(
                "SELECT id FROM events WHERE name=%s AND start_datetime=%s AND place_id=%s",
                (name, start_dt, place_id),
            )
            row = self.cur.fetchone()
            if row:
                return row[0]
        return None

    def insert_event(self, row: Dict[str, str], place_id: Optional[int]) -> int:
        start_dt = parse_datetime(row.get("start_date"), row.get("start_time"))
        end_dt = parse_datetime(row.get("end_date"), row.get("end_time"))
        self.cur.execute(
            """
            INSERT INTO events (
              identifier, name, description, url, image_url, genre, keywords_text,
              event_status, attendance_mode, place_id, city_id, start_datetime, end_datetime
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                normalize_str(row.get("event_id")) or None,
                normalize_str(row.get("name")),
                row.get("description") or None,
                row.get("url") or None,
                row.get("image") or None,
                row.get("category") or None,
                row.get("tags") or None,
                None,
                None,
                place_id,
                self.city_id,
                start_dt,
                end_dt,
            ),
        )
        return self.cur.lastrowid

    def insert_offer(self, event_id: int, price_value: Optional[float]):
        if price_value is None:
            return
        self.cur.execute(
            "INSERT INTO offers (event_id, price, price_currency, url) VALUES (%s,%s,%s,%s)",
            (event_id, price_value, None, None),
        )

    def insert_tags(self, event_id: int, tags_value: str):
        for tag in split_tags(tags_value):
            if tag in self.tag_cache:
                tag_id = self.tag_cache[tag]
            else:
                self.cur.execute("SELECT id FROM tags WHERE name=%s", (tag,))
                row = self.cur.fetchone()
                if row:
                    tag_id = row[0]
                else:
                    self.cur.execute("INSERT INTO tags (name) VALUES (%s)", (tag,))
                    tag_id = self.cur.lastrowid
                self.tag_cache[tag] = tag_id
            self.cur.execute(
                "INSERT IGNORE INTO event_tags (event_id, tag_id) VALUES (%s,%s)",
                (event_id, tag_id),
            )


def main():
    import sys
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/import_partner_csv.py /path/to/partner.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=False,
    )
    importer = Importer(conn)

    inserted = 0
    skipped = 0
    errors = 0

    try:
        importer.ensure_city()
        importer.start_run(source=os.path.basename(csv_path))

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    event_id = normalize_str(row.get("event_id"))
                    url = normalize_str(row.get("url"))
                    name = normalize_str(row.get("name"))
                    start_dt = parse_datetime(row.get("start_date"), row.get("start_time"))

                    place_id = importer.upsert_place(
                        row.get("loc_name"),
                        row.get("loc_street"),
                        row.get("loc_post"),
                    )

                    existing_id = importer.find_event(event_id, url, name, start_dt, place_id)
                    if existing_id:
                        importer.log_row(event_id, "skip", "matched existing event")
                        skipped += 1
                        continue

                    new_id = importer.insert_event(row, place_id)
                    importer.insert_offer(new_id, parse_price(row.get("price")))
                    importer.insert_tags(new_id, row.get("tags") or "")
                    importer.log_row(event_id, "insert", "inserted new event")
                    inserted += 1

                except Exception as e:
                    importer.log_row(row.get("event_id"), "error", str(e)[:250])
                    errors += 1

        conn.commit()
        print(f"Import complete: inserted={inserted} skipped={skipped} errors={errors}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Import output.json + directory.json (Schema.org JSON-LD) into MySQL.

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
  python3 scripts/import_json_to_mysql.py
"""

import os
import json
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import mysql.connector

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(BASE_DIR, "output.json")
DIRECTORY_PATH = os.path.join(BASE_DIR, "directory.json")

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

ISO_DT_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}))?")
DAY_URL_RE = re.compile(r"schema\.org\/([A-Za-z]+)$")

DAY_MAP = {
    "Monday": "MO",
    "Tuesday": "TU",
    "Wednesday": "WE",
    "Thursday": "TH",
    "Friday": "FR",
    "Saturday": "SA",
    "Sunday": "SU",
}


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    m = ISO_DT_RE.match(value)
    if not m:
        return None
    date_part = m.group(1)
    time_part = m.group(2) or "00:00:00"
    try:
        return datetime.fromisoformat(f"{date_part}T{time_part}")
    except ValueError:
        return None


def normalize_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def split_keywords(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip().lower() for v in value if str(v).strip()]
    if not isinstance(value, str):
        return []
    return [v.strip().lower() for v in value.split(",") if v.strip()]


def get_offer_list(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    offers = event.get("offers")
    if offers is None:
        return []
    if isinstance(offers, list):
        return [o for o in offers if isinstance(o, dict)]
    if isinstance(offers, dict):
        return [offers]
    return []


def extract_by_day(value: Any) -> List[str]:
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    out = []
    for v in values:
        if not v:
            continue
        v = str(v)
        m = DAY_URL_RE.search(v)
        if m and m.group(1) in DAY_MAP:
            out.append(DAY_MAP[m.group(1)])
            continue
        if v in DAY_MAP:
            out.append(DAY_MAP[v])
            continue
        if v in DAY_MAP.values():
            out.append(v)
    return sorted(set(out))


class Importer:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.address_cache = {}
        self.place_cache = {}
        self.tag_cache = {}
        self.event_cache = {}
        self.city_id = None

    def ensure_city(self):
        self.cur.execute(
            "SELECT id FROM cities WHERE slug=%s", (CITY_SLUG,)
        )
        row = self.cur.fetchone()
        if row:
            self.city_id = row[0]
            return
        self.cur.execute(
            "INSERT INTO cities (name, region, country_code, timezone, slug) VALUES (%s,%s,%s,%s,%s)",
            (CITY_NAME, CITY_REGION, CITY_COUNTRY_CODE, CITY_TIMEZONE, CITY_SLUG),
        )
        self.city_id = self.cur.lastrowid

    def upsert_address(self, addr: Dict[str, Any]) -> Optional[int]:
        if not addr:
            return None
        street = normalize_string(addr.get("streetAddress"))
        locality = normalize_string(addr.get("addressLocality"))
        postal = normalize_string(addr.get("postalCode"))
        country = normalize_string(addr.get("addressCountry"))
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

    def upsert_place(self, loc: Dict[str, Any]) -> Optional[int]:
        if not loc:
            return None
        name = normalize_string(loc.get("name"))
        addr = loc.get("address") or {}
        addr_id = self.upsert_address(addr) if isinstance(addr, dict) else None
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

    def upsert_event(self, ev: Dict[str, Any], place_id: Optional[int]) -> int:
        identifier = normalize_string(ev.get("identifier")) or None
        name = normalize_string(ev.get("name"))
        description = ev.get("description")
        url = ev.get("url")
        image = ev.get("image")
        genre = ev.get("genre")
        keywords = ev.get("keywords")
        event_status = ev.get("eventStatus")
        attendance_mode = ev.get("eventAttendanceMode")
        start_dt = parse_iso_datetime(ev.get("startDate"))
        end_dt = parse_iso_datetime(ev.get("endDate"))

        if identifier and identifier in self.event_cache:
            return self.event_cache[identifier]

        self.cur.execute(
            """
            INSERT INTO events (
              identifier, name, description, url, image_url, genre, keywords_text,
              event_status, attendance_mode, place_id, city_id, start_datetime, end_datetime
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
              name=VALUES(name),
              description=VALUES(description),
              url=VALUES(url),
              image_url=VALUES(image_url),
              genre=VALUES(genre),
              keywords_text=VALUES(keywords_text),
              event_status=VALUES(event_status),
              attendance_mode=VALUES(attendance_mode),
              place_id=VALUES(place_id),
              city_id=VALUES(city_id),
              start_datetime=VALUES(start_datetime),
              end_datetime=VALUES(end_datetime)
            """,
            (
                identifier,
                name,
                description,
                url,
                image,
                genre,
                keywords,
                event_status,
                attendance_mode,
                place_id,
                self.city_id,
                start_dt,
                end_dt,
            ),
        )

        if identifier:
            self.cur.execute("SELECT id FROM events WHERE identifier=%s", (identifier,))
            event_id = self.cur.fetchone()[0]
            self.event_cache[identifier] = event_id
            return event_id

        event_id = self.cur.lastrowid
        return event_id

    def upsert_offer(self, event_id: int, offer: Dict[str, Any]):
        price = offer.get("price")
        price_currency = offer.get("priceCurrency")
        url = offer.get("url")
        self.cur.execute(
            "INSERT INTO offers (event_id, price, price_currency, url) VALUES (%s,%s,%s,%s)",
            (event_id, price, price_currency, url),
        )

    def clear_event_children(self, event_id: int):
        self.cur.execute("DELETE FROM offers WHERE event_id=%s", (event_id,))
        self.cur.execute("SELECT id FROM schedules WHERE event_id=%s", (event_id,))
        schedule_ids = [row[0] for row in self.cur.fetchall()]
        if schedule_ids:
            fmt = ",".join(["%s"] * len(schedule_ids))
            self.cur.execute(
                f"DELETE FROM schedule_by_day WHERE schedule_id IN ({fmt})",
                schedule_ids,
            )
            self.cur.execute(
                f"DELETE FROM schedules WHERE id IN ({fmt})",
                schedule_ids,
            )

    def upsert_schedule(self, event_id: int, sched: Dict[str, Any]):
        repeat_frequency = sched.get("repeatFrequency")
        if not repeat_frequency:
            return
        schedule_timezone = sched.get("scheduleTimezone")
        start_time = sched.get("startTime")
        end_time = sched.get("endTime")
        start_date = sched.get("startDate")
        end_date = sched.get("endDate")
        repeat_count = sched.get("repeatCount")

        self.cur.execute(
            """
            INSERT INTO schedules (
              event_id, repeat_frequency, schedule_timezone, start_time, end_time, start_date, end_date, repeat_count
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (event_id, repeat_frequency, schedule_timezone, start_time, end_time, start_date, end_date, repeat_count),
        )
        schedule_id = self.cur.lastrowid

        for day in extract_by_day(sched.get("byDay")):
            self.cur.execute(
                "INSERT IGNORE INTO schedule_by_day (schedule_id, day_of_week) VALUES (%s,%s)",
                (schedule_id, day),
            )

    def upsert_tags(self, event_id: int, keywords: Any):
        for tag in split_keywords(keywords):
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


def load_json(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=False,
    )
    importer = Importer(conn)

    try:
        importer.ensure_city()

        output_events = load_json(OUTPUT_PATH)
        directory_events = load_json(DIRECTORY_PATH)

        for ev in output_events:
            place_id = importer.upsert_place(ev.get("location") or {})
            event_id = importer.upsert_event(ev, place_id)
            importer.clear_event_children(event_id)
            for offer in get_offer_list(ev):
                importer.upsert_offer(event_id, offer)
            importer.upsert_tags(event_id, ev.get("keywords"))

        for ev in directory_events:
            place_id = importer.upsert_place(ev.get("location") or {})
            event_id = importer.upsert_event(ev, place_id)
            importer.clear_event_children(event_id)
            for offer in get_offer_list(ev):
                importer.upsert_offer(event_id, offer)
            importer.upsert_tags(event_id, ev.get("keywords"))
            schedule = ev.get("eventSchedule") or {}
            if isinstance(schedule, dict):
                importer.upsert_schedule(event_id, schedule)

        conn.commit()
        print("Import complete")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()

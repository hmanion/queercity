-- Queer City schema (MySQL 8.0)
-- Supports Events (Schema.org Event + Schedule), Places/Venues, Organizations, and multi-city expansion.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  region VARCHAR(128) NULL,
  country_code CHAR(2) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS postal_addresses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  street_address VARCHAR(255) NULL,
  address_locality VARCHAR(128) NULL,
  postal_code VARCHAR(32) NULL,
  address_country VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  url VARCHAR(1024) NULL,
  logo_url VARCHAR(1024) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  address_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  slug VARCHAR(128) NULL,
  CONSTRAINT fk_org_address FOREIGN KEY (address_id) REFERENCES postal_addresses(id),
  CONSTRAINT fk_org_city FOREIGN KEY (city_id) REFERENCES cities(id),
  INDEX idx_org_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS places (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NULL,
  address_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  organization_id BIGINT UNSIGNED NULL,
  slug VARCHAR(128) NULL,
  CONSTRAINT fk_places_address FOREIGN KEY (address_id) REFERENCES postal_addresses(id),
  CONSTRAINT fk_places_city FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT fk_places_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  INDEX idx_places_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  identifier VARCHAR(128) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  url VARCHAR(1024) NULL,
  image_url VARCHAR(1024) NULL,
  genre VARCHAR(128) NULL,
  keywords_text TEXT NULL,
  event_status VARCHAR(255) NULL,
  attendance_mode VARCHAR(255) NULL,
  place_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  start_datetime DATETIME NULL,
  end_datetime DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_place FOREIGN KEY (place_id) REFERENCES places(id),
  CONSTRAINT fk_events_city FOREIGN KEY (city_id) REFERENCES cities(id),
  UNIQUE KEY uq_events_identifier (identifier),
  INDEX idx_events_start_datetime (start_datetime),
  INDEX idx_events_end_datetime (end_datetime),
  INDEX idx_events_city (city_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_tags (
  event_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, tag_id),
  CONSTRAINT fk_event_tags_event FOREIGN KEY (event_id) REFERENCES events(id),
  CONSTRAINT fk_event_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_organizations (
  event_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(64) NULL,
  PRIMARY KEY (event_id, organization_id),
  CONSTRAINT fk_event_org_event FOREIGN KEY (event_id) REFERENCES events(id),
  CONSTRAINT fk_event_org_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NULL,
  price_currency CHAR(3) NULL,
  url VARCHAR(1024) NULL,
  CONSTRAINT fk_offers_event FOREIGN KEY (event_id) REFERENCES events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  repeat_frequency VARCHAR(16) NOT NULL,
  schedule_timezone VARCHAR(64) NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  repeat_count INT NULL,
  CONSTRAINT fk_schedules_event FOREIGN KEY (event_id) REFERENCES events(id),
  INDEX idx_schedules_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_by_day (
  schedule_id BIGINT UNSIGNED NOT NULL,
  day_of_week ENUM('MO','TU','WE','TH','FR','SA','SU') NOT NULL,
  PRIMARY KEY (schedule_id, day_of_week),
  CONSTRAINT fk_schedule_by_day FOREIGN KEY (schedule_id) REFERENCES schedules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_by_month_week (
  schedule_id BIGINT UNSIGNED NOT NULL,
  week_of_month TINYINT NOT NULL,
  PRIMARY KEY (schedule_id, week_of_month),
  CONSTRAINT fk_schedule_by_month_week FOREIGN KEY (schedule_id) REFERENCES schedules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_by_month_day (
  schedule_id BIGINT UNSIGNED NOT NULL,
  month_day TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (schedule_id, month_day),
  CONSTRAINT fk_schedule_by_month_day FOREIGN KEY (schedule_id) REFERENCES schedules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_runs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  source VARCHAR(64) NOT NULL,
  run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_rows (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT UNSIGNED NOT NULL,
  source_event_id VARCHAR(64) NULL,
  action ENUM('insert','skip','error') NOT NULL,
  reason VARCHAR(255) NULL,
  CONSTRAINT fk_import_runs FOREIGN KEY (run_id) REFERENCES import_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

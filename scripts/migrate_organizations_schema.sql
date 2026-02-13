-- Migration: normalize organizations + shared audience labels
-- Target: existing Queer City MySQL database

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS audience_labels (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name ENUM('lesbian','gay','bi','trans','men','flinta','all') NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO audience_labels (name) VALUES
('lesbian'),
('gay'),
('bi'),
('trans'),
('men'),
('flinta'),
('all');

-- organizations: keep only required fields + shared audience label reference
ALTER TABLE organizations
  DROP FOREIGN KEY fk_org_address,
  DROP FOREIGN KEY fk_org_city;

ALTER TABLE organizations
  DROP COLUMN description,
  DROP COLUMN email,
  DROP COLUMN phone,
  DROP COLUMN address_id,
  DROP COLUMN city_id,
  DROP COLUMN slug,
  ADD COLUMN category ENUM('Charity','Sports','Social','Arts','Club','Life','Sexy') NULL AFTER name,
  ADD COLUMN audience_label_id BIGINT UNSIGNED NULL AFTER logo_url,
  ADD CONSTRAINT fk_org_audience_label FOREIGN KEY (audience_label_id) REFERENCES audience_labels(id);

UPDATE organizations SET category = 'Social' WHERE category IS NULL;
ALTER TABLE organizations
  MODIFY COLUMN category ENUM('Charity','Sports','Social','Arts','Club','Life','Sexy') NOT NULL;

-- places no longer stores single organization; use many-to-many
ALTER TABLE places
  DROP FOREIGN KEY fk_places_org,
  DROP COLUMN organization_id;

CREATE TABLE IF NOT EXISTS organization_places (
  organization_id BIGINT UNSIGNED NOT NULL,
  place_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (organization_id, place_id),
  CONSTRAINT fk_org_places_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_org_places_place FOREIGN KEY (place_id) REFERENCES places(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- events can also reference shared audience labels
ALTER TABLE events
  ADD COLUMN audience_label_id BIGINT UNSIGNED NULL AFTER attendance_mode,
  ADD CONSTRAINT fk_events_audience_label FOREIGN KEY (audience_label_id) REFERENCES audience_labels(id);

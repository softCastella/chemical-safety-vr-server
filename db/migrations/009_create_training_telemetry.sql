CREATE TABLE training_telemetry_participants (
  participant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_project VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  first_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (participant_id),
  KEY idx_training_telemetry_participants_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

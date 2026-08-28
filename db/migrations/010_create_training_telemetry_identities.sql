CREATE TABLE training_telemetry_identities (
  identity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  participant_id BIGINT UNSIGNED NOT NULL,
  source_project VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  identity_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  identity_value VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (identity_id),
  UNIQUE KEY uq_training_telemetry_identity (source_project, identity_type, identity_value),
  KEY idx_training_telemetry_identities_participant (participant_id),
  CONSTRAINT fk_training_telemetry_identity_participant
    FOREIGN KEY (participant_id) REFERENCES training_telemetry_participants (participant_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

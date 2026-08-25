CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  participant_code VARCHAR(32) NOT NULL,
  status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
  controller_guide_version_completed INT UNSIGNED NULL,
  play_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_participant_code (participant_code),
  KEY idx_users_status_created_at (status, created_at),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

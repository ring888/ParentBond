CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  family_id VARCHAR(64) NOT NULL,
  role VARCHAR(24) NOT NULL,
  name VARCHAR(80) NOT NULL,
  birth_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_family_id (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  subject VARCHAR(24) NOT NULL,
  title VARCHAR(180) NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 20,
  priority INT NOT NULL DEFAULT 2,
  order_index INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tasks_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id CHAR(36) PRIMARY KEY,
  child_user_id VARCHAR(64) NOT NULL,
  initiator_user_id VARCHAR(64) NOT NULL,
  type VARCHAR(24) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason VARCHAR(240) NOT NULL,
  evidence TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  appeal_reason VARCHAR(360) NULL,
  appeal_evidence TEXT NULL,
  resolution_note VARCHAR(360) NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ledger_child_created (child_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS growth_records (
  id CHAR(36) PRIMARY KEY,
  family_id VARCHAR(64) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  week VARCHAR(12) NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_growth_family_created (family_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS focus_records (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  mode VARCHAR(12) NOT NULL,
  task_id CHAR(36) NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_focus_records_user_date (user_id, date),
  INDEX idx_focus_records_user_completed (user_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_records (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  game_type VARCHAR(24) NOT NULL,
  date DATE NOT NULL,
  difficulty VARCHAR(24) NOT NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  score INT NULL,
  accuracy INT NULL,
  reaction_ms INT NULL,
  miss_count INT NOT NULL DEFAULT 0,
  detail_json TEXT NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_game_records_user_date (user_id, date),
  INDEX idx_game_records_user_game (user_id, game_type, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  family_name VARCHAR(120) NOT NULL,
  role VARCHAR(16) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  child_name VARCHAR(80) NULL,
  child_grade VARCHAR(24) NULL,
  child_avatar VARCHAR(32) NULL,
  invite_code CHAR(6) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_users_family (family_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_expires (expires_at),
  INDEX idx_auth_sessions_seen (user_id, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS focus_companion_sessions (
  id CHAR(36) PRIMARY KEY,
  family_name VARCHAR(120) NOT NULL,
  child_user_id VARCHAR(64) NOT NULL,
  parent_user_id VARCHAR(64) NULL,
  mode VARCHAR(12) NOT NULL,
  task_id CHAR(36) NULL,
  task_title VARCHAR(180) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  seconds_left INT NOT NULL DEFAULT 0,
  total_seconds INT NOT NULL DEFAULT 0,
  ends_at DATETIME NULL,
  child_running BOOLEAN NOT NULL DEFAULT FALSE,
  parent_joined BOOLEAN NOT NULL DEFAULT FALSE,
  last_child_seen_at DATETIME NULL,
  last_parent_seen_at DATETIME NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_focus_companion_family_status (family_name, status, updated_at),
  INDEX idx_focus_companion_child (child_user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  child_name VARCHAR(80) NOT NULL,
  child_grade VARCHAR(24) NOT NULL,
  child_avatar VARCHAR(32) NOT NULL,
  avatar_label VARCHAR(40) NOT NULL DEFAULT '小狐狸',
  pin_mode VARCHAR(16) NOT NULL DEFAULT 'pin',
  unlock_age INT NOT NULL DEFAULT 18,
  weekly_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/zoom.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      role TEXT DEFAULT 'contributor',
      must_change_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    );

    CREATE TABLE IF NOT EXISTS editions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      edition_number TEXT,
      subtitle TEXT,
      cover_color TEXT DEFAULT '#1e40af',
      status TEXT DEFAULT 'draft',
      published_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      layout TEXT DEFAULT 'single',
      block_type TEXT DEFAULT 'article',
      bg_color TEXT DEFAULT '#ffffff',
      text_color TEXT DEFAULT '#1f2937',
      accent_color TEXT DEFAULT '#1e40af',
      header_color TEXT DEFAULT '#1e3a8a',
      position INTEGER DEFAULT 0,
      author_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default settings
  const settingsInsert = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  settingsInsert.run('school_name', 'Burgaugymnasium');
  settingsInsert.run('newspaper_name', 'Zoom.');
  settingsInsert.run('newspaper_tagline', 'Die Schülerzeitung des Burgaugymnasiums');
  settingsInsert.run('primary_color', '#1e40af');
  settingsInsert.run('secondary_color', '#3b82f6');

  // Seed superadmin user "Pebbles"
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('Pebbles');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('1234', 10);
    db.prepare(`
      INSERT INTO users (username, password, display_name, role, must_change_password)
      VALUES (?, ?, ?, ?, ?)
    `).run('Pebbles', hash, 'Pebbles (Admin)', 'superadmin', 1);
    console.log('✅ Superadmin "Pebbles" created (muss Passwort beim ersten Login ändern)');
  }

  db.close();
  console.log('✅ Datenbank initialisiert');
}

module.exports = { getDb, initDatabase };

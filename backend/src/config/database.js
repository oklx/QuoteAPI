import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async initialize() {
    const dbDir = dirname(config.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    await this.initDefaultAdmin();
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        description TEXT,
        api_calls INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        page_views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER,
        quote_id INTEGER,
        referer TEXT,
        ip_address TEXT,
        user_agent TEXT,
        accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        description TEXT,
        code TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        call_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_repos_user ON repositories(user_id);
      CREATE INDEX IF NOT EXISTS idx_quotes_repo ON quotes(repository_id);
      CREATE INDEX IF NOT EXISTS idx_logs_repo ON access_logs(repository_id);
      CREATE INDEX IF NOT EXISTS idx_logs_ip ON access_logs(ip_address);
      CREATE INDEX IF NOT EXISTS idx_logs_time ON access_logs(accessed_at);
      CREATE INDEX IF NOT EXISTS idx_endpoints_user ON endpoints(user_id);
      CREATE INDEX IF NOT EXISTS idx_endpoints_name ON endpoints(name);

      CREATE TABLE IF NOT EXISTS home_showcase (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL CHECK(source_type IN ('repository', 'endpoint')),
        source_id INTEGER,
        source_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_value TEXT UNIQUE NOT NULL,
        name TEXT,
        is_active INTEGER DEFAULT 1,
        last_used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(key_value);

      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 添加 visibility 字段到现有表（如果不存在）
    this.addColumnIfNotExists('repositories', 'visibility', "TEXT DEFAULT 'public'");
    this.addColumnIfNotExists('endpoints', 'visibility', "TEXT DEFAULT 'public'");
    // 添加 metadata 字段用于存储端口 API 文档配置
    this.addColumnIfNotExists('endpoints', 'metadata', "TEXT DEFAULT '{}'");
  }

  addColumnIfNotExists(tableName, columnName, columnDef) {
    const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columnExists = tableInfo.some(col => col.name === columnName);
    if (!columnExists) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Added column ${columnName} to ${tableName}`);
    }
  }

  async initDefaultAdmin() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
    const result = stmt.get('admin');

    if (result.count === 0) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash('admin', 10);
      const insert = this.db.prepare(
        'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)'
      );
      insert.run('admin', hashedPassword);
      console.log('Default admin user created');
    }
  }

  getDb() {
    return this.db;
  }

  async createBackupFile(targetPath) {
    if (!this.db) {
      throw new Error('Database is not initialized');
    }

    await this.db.backup(targetPath);
  }

  validateDatabaseFile(filePath) {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
      const integrity = db.prepare('PRAGMA integrity_check').get();
      if (!integrity || integrity.integrity_check !== 'ok') {
        throw new Error('数据库完整性检查失败');
      }

      const tables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `).all().map((row) => row.name);

      const quoteApiTables = ['users', 'repositories', 'quotes', 'access_logs', 'endpoints', 'api_keys', 'system_config'];
      const matchedTables = quoteApiTables.filter((table) => tables.includes(table));

      if (!tables.includes('users')) {
        throw new Error('备份文件不是有效的 QuoteAPI 数据库：缺少 users 表');
      }

      if (matchedTables.length < 2) {
        throw new Error('备份文件不是有效的 QuoteAPI 数据库：未识别到足够的 QuoteAPI 数据表');
      }
    } finally {
      db.close();
    }
  }

  async replaceDatabaseFromFile(importPath) {
    this.validateDatabaseFile(importPath);

    const dbPath = config.dbPath;
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const rollbackPath = `${dbPath}.rollback-${Date.now()}`;

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    try {
      if (existsSync(dbPath)) {
        renameSync(dbPath, rollbackPath);
      }

      copyFileSync(importPath, dbPath);
      this.removeSqliteSidecarFiles(dbPath);

      await this.initialize();

      if (existsSync(rollbackPath)) {
        unlinkSync(rollbackPath);
      }
    } catch (error) {
      this.close();

      if (existsSync(dbPath)) {
        unlinkSync(dbPath);
      }
      if (existsSync(rollbackPath)) {
        renameSync(rollbackPath, dbPath);
      }

      await this.initialize();
      throw error;
    }
  }

  removeSqliteSidecarFiles(dbPath) {
    [`${dbPath}-wal`, `${dbPath}-shm`].forEach((path) => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new DatabaseManager();

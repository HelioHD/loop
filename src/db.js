// Persistência local em SQLite (node:sqlite, nativo do Node 22).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const db = new DatabaseSync(new URL('../data/loop.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

db.exec(`
  CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    modes TEXT NOT NULL,
    saved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    result TEXT,
    log TEXT
  );
`);

const parse = (row) =>
  row && {
    ...row,
    saved: !!row.saved,
    modes: JSON.parse(row.modes),
    result: row.result ? JSON.parse(row.result) : null,
    log: row.log ? JSON.parse(row.log) : [],
  };

export const searches = {
  create(term, modes) {
    const r = db
      .prepare('INSERT INTO searches (term, modes, created_at) VALUES (?, ?, ?)')
      .run(term, JSON.stringify(modes), new Date().toISOString());
    return Number(r.lastInsertRowid);
  },
  finish(id, status, result, log) {
    db.prepare('UPDATE searches SET status = ?, result = ?, log = ?, finished_at = ? WHERE id = ?').run(
      status, JSON.stringify(result), JSON.stringify(log), new Date().toISOString(), id
    );
  },
  get(id) {
    return parse(db.prepare('SELECT * FROM searches WHERE id = ?').get(id));
  },
  list() {
    return db
      .prepare(`SELECT id, term, modes, saved, created_at, finished_at, status,
                json_array_length(result, '$.stores') AS n_stores,
                json_array_length(result, '$.products') AS n_products,
                json_array_length(result, '$.promos') AS n_promos,
                COALESCE(json_extract(result, '$.promos[0].image'), json_extract(result, '$.products[0].image')) AS cover
                FROM searches ORDER BY id DESC LIMIT 200`)
      .all()
      .map((r) => ({ ...r, saved: !!r.saved, modes: JSON.parse(r.modes) }));
  },
  setSaved(id, saved) {
    db.prepare('UPDATE searches SET saved = ? WHERE id = ?').run(saved ? 1 : 0, id);
  },
  remove(id) {
    db.prepare('DELETE FROM searches WHERE id = ?').run(id);
  },
};

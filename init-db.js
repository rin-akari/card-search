const Database = require('better-sqlite3');
const db = new Database('cards.db');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    official_id TEXT,
    jp_name TEXT,
    cn_name TEXT,
    cn_effect TEXT,
    cost TEXT,
    color TEXT,
    card_type TEXT,
    rarity TEXT,
    image_url TEXT,
    official_image_url TEXT
  )
`);

// 插入示例数据
const insert = db.prepare(`
  INSERT INTO cards (official_id, jp_name, cn_name, cn_effect, cost, color, card_type, rarity, image_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const sampleCards = [
  ['CARD-001', '炎の剣士', '炎之剑士', '这张卡攻击时，攻击力上升500。', '3', '红', '生物', '稀有', 'https://picsum.photos/id/1/300/400'],
  ['CARD-002', '水の盾', '水之盾', '对方攻击时发动，使一次攻击无效。', '2', '蓝', '法术', '普通', 'https://picsum.photos/id/2/300/400'],
  ['CARD-003', '地竜', '地龙', '当这张卡被破坏时，抽一张牌。', '5', '绿', '生物', '超稀有', 'https://picsum.photos/id/3/300/400'],
  ['CARD-004', '風の精霊', '风之精灵', '登场时，抽一张牌。', '2', '绿', '生物', '稀有', 'https://picsum.photos/id/4/300/400'],
  ['CARD-005', '光の護封剣', '光之护封剑', '对方生物3回合不能攻击。', '3', '白', '法术', '超稀有', 'https://picsum.photos/id/5/300/400'],
];

for (const card of sampleCards) {
  insert.run(card);
}

// 创建全文搜索表（使用虚拟表）
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    cn_name, cn_effect, jp_name, content=cards
  )
`);

// 同步数据到搜索表
db.exec(`
  INSERT INTO cards_fts(rowid, cn_name, cn_effect, jp_name)
  SELECT rowid, cn_name, cn_effect, jp_name FROM cards
`);

console.log('✅ 数据库初始化完成！已插入', sampleCards.length, '张示例卡牌');
db.close();
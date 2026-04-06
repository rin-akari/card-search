const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// CORS 支持（允许 Mod 跨域请求）
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.static('public'));

let cards = [];

function loadCards() {
    try {
        const data = fs.readFileSync('cards.json', 'utf8');
        cards = JSON.parse(data);
        console.log(`✅ 加载了 ${cards.length} 张卡牌`);
    } catch (err) {
        console.log('❌ 没有找到 cards.json，请先运行 node import.js');
        cards = [];
    }
}

// 转换函数：把你的卡牌格式转成 Scryfall 格式
function convertToScryfallFormat(card) {
    // 处理图片 URL
    let imageUrl = card.image_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}${imageUrl}`;
    }
    
    // 颜色映射（根据你的游戏调整）
    const colorMap = {
        '赤': ['R'],
        '青': ['U'],
        '黄': ['W'],
        '白': ['W'],
        '黒': ['B'],
        '红': ['R'],
        '黑': ['B'],
        '绿': ['G'],
        '全': ['W', 'U', 'B', 'R', 'G']
    };
    
    let colors = colorMap[card.color] || [card.color];
    
    return {
        object: "card",
        id: card.official_id,
        oracle_id: card.official_id,
        name: card.cn_name,
        printed_name: card.jp_name,
        lang: "zhs",
        released_at: "2024-01-01",
        layout: "normal",
        mana_cost: card.cost || "",
        cmc: 0,
        type_line: card.card_type || card.subtype || "",
        oracle_text: card.cn_effect || "",
        colors: colors,
        color_identity: colors,
        keywords: card.tags ? card.tags.split('/') : [],
        set: card.series || "",
        set_name: card.series || "",
        collector_number: card.official_id ? card.official_id.split('-')[1] : "",
        rarity: card.rarity ? card.rarity.toLowerCase() : "common",
        artist: card.artist || "",
        image_uris: {
            png: imageUrl,
            large: imageUrl,
            normal: imageUrl,
            small: imageUrl,
            art_crop: imageUrl
        },
        image_status: "highres_scan"
    };
}

// ========== 原有接口 ==========
app.get('/api/search', (req, res) => {
    const { q = '', rarity, color, type, series, subtype } = req.query;
    
    let results = [...cards];
    
    if (q.trim()) {
        const keyword = q.toLowerCase();
        results = results.filter(card => 
            card.cn_name.toLowerCase().includes(keyword) ||
            card.jp_name.toLowerCase().includes(keyword) ||
            (card.cn_effect && card.cn_effect.toLowerCase().includes(keyword)) ||
            (card.official_id && card.official_id.toLowerCase().includes(keyword))
        );
    }
    
    if (rarity && rarity !== 'all') {
        results = results.filter(card => card.rarity === rarity);
    }
    if (color && color !== 'all') {
        results = results.filter(card => card.color === color);
    }
    if (type && type !== 'all') {
        results = results.filter(card => card.card_type === type);
    }
    if (series && series !== 'all') {
        results = results.filter(card => card.series === series);
    }
    if (subtype && subtype !== 'all') {
        results = results.filter(card => card.subtype === subtype);
    }
    
    res.json({ cards: results });
});

app.get('/api/card/:id', (req, res) => {
    const card = cards.find(c => c.id == req.params.id);
    if (!card) {
        return res.status(404).json({ error: '卡牌不存在' });
    }
    res.json(card);
});

app.get('/api/filters', (req, res) => {
    const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))];
    const colors = [...new Set(cards.map(c => c.color).filter(Boolean))];
    const types = [...new Set(cards.map(c => c.card_type).filter(Boolean))];
    const series = [...new Set(cards.map(c => c.series).filter(Boolean))];
    const subtypes = [...new Set(cards.map(c => c.subtype).filter(Boolean))];
    res.json({ rarities, colors, types, series, subtypes });
});

// ========== Scryfall 兼容接口 ==========
app.get('/cards/named', (req, res) => {
    const { exact, fuzzy } = req.query;
    
    let code = exact || fuzzy;
    if (!code) {
        return res.status(400).json({ object: "error", details: "Missing 'exact' or 'fuzzy' parameter" });
    }
    
    let card = cards.find(c => c.official_id === code);
    if (!card && fuzzy) {
        card = cards.find(c => c.cn_name.includes(code) || c.jp_name.includes(code));
    }
    
    if (!card) {
        return res.status(404).json({ object: "error", details: "Card not found" });
    }
    
    res.json(convertToScryfallFormat(card));
});

app.get('/cards/:id', (req, res) => {
    const { id } = req.params;
    
    let card = cards.find(c => c.official_id === id);
    if (!card) {
        card = cards.find(c => c.id == id);
    }
    
    if (!card) {
        return res.status(404).json({ object: "error", details: "Card not found" });
    }
    
    res.json(convertToScryfallFormat(card));
});

app.get('/cards/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ object: "error", details: "Missing 'q' parameter" });
    }
    
    let results = [...cards];
    
    if (q.startsWith('!')) {
        const exactCode = q.substring(1);
        results = results.filter(c => c.official_id === exactCode);
    } else {
        const keyword = q.toLowerCase();
        results = results.filter(c => 
            c.cn_name.toLowerCase().includes(keyword) ||
            c.jp_name.toLowerCase().includes(keyword) ||
            (c.cn_effect && c.cn_effect.toLowerCase().includes(keyword)) ||
            (c.official_id && c.official_id.toLowerCase().includes(keyword))
        );
    }
    
    res.json({
        object: "list",
        total_cards: results.length,
        has_more: false,
        data: results.slice(0, 175).map(card => convertToScryfallFormat(card))
    });
});

// 健康检查接口（Railway 需要）
app.get('/health', (req, res) => {
    res.json({ status: 'ok', cards: cards.length });
});

// 启动服务器
loadCards();
app.listen(port, '0.0.0.0', () => {
    console.log(`🃏 卡查服务已启动！`);
    console.log(`📍 端口: ${port}`);
    console.log(`📊 卡牌数量: ${cards.length}`);
});
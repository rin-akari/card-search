const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 允许跨域
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.static('public'));

// 图片静态服务
app.use('/images', express.static(path.join(__dirname, 'public/images')));

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

// ========== 网页接口 ==========

// 搜索接口
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
    
    // 返回全部结果（不限制数量）
    res.json({ cards: results });
});

// 卡牌详情接口
app.get('/api/card/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const card = cards.find(c => c.id === id);
    if (!card) {
        return res.status(404).json({ error: '卡牌不存在' });
    }
    res.json(card);
});

// 筛选选项接口
app.get('/api/filters', (req, res) => {
    const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))];
    const colors = [...new Set(cards.map(c => c.color).filter(Boolean))];
    const types = [...new Set(cards.map(c => c.card_type).filter(Boolean))];
    const series = [...new Set(cards.map(c => c.series).filter(Boolean))];
    const subtypes = [...new Set(cards.map(c => c.subtype).filter(Boolean))];
    res.json({ rarities, colors, types, series, subtypes });
});

// ========== 卡组导入接口 ==========

// 批量查询卡牌（POST 方式）
app.post('/api/deck/import', (req, res) => {
    const { codes } = req.body;
    
    if (!codes || !Array.isArray(codes)) {
        return res.status(400).json({ error: '请提供 codes 数组' });
    }
    
    const results = [];
    const notFound = [];
    
    for (const code of codes) {
        const trimmed = code.trim();
        if (!trimmed) continue;
        
        const card = cards.find(c => c.official_id === trimmed);
        if (card) {
            results.push({
                code: card.official_id,
                name: card.cn_name,
                effect: card.cn_effect || '',
                color: card.color || '',
                type: card.card_type || '',
                rarity: card.rarity || '',
                series: card.series || '',
                subtype: card.subtype || '',
                image_url: card.image_url
            });
        } else {
            notFound.push(trimmed);
        }
    }
    
    res.json({
        success: true,
        total: results.length,
        notFound: notFound,
        cards: results
    });
});

// 单张卡牌查询（GET 方式，按编号）
app.get('/api/code/:code', (req, res) => {
    const { code } = req.params;
    const card = cards.find(c => c.official_id === code);
    
    if (!card) {
        return res.status(404).json({ error: '卡牌不存在', code: code });
    }
    
    res.json({
        code: card.official_id,
        name: card.cn_name,
        effect: card.cn_effect || '',
        color: card.color || '',
        type: card.card_type || '',
        rarity: card.rarity || '',
        series: card.series || '',
        subtype: card.subtype || '',
        image_url: card.image_url
    });
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', cards: cards.length });
});

// Scryfall 兼容接口（按编号查卡）
app.get('/cards/:id', (req, res) => {
    const { id } = req.params;
    const card = cards.find(c => c.official_id === id);
    
    if (!card) {
        return res.status(404).json({ object: "error", details: "Card not found" });
    }
    
    res.json({
        object: "card",
        id: card.official_id,
        name: card.cn_name,
        oracle_text: card.cn_effect || '',
        image_uris: {
            png: card.image_url,
            large: card.image_url,
            normal: card.image_url
        }
    });
});

// 启动服务器
loadCards();
app.listen(port, '0.0.0.0', () => {
    console.log(`🃏 卡查服务已启动！`);
    console.log(`📍 端口: ${port}`);
    console.log(`📊 卡牌数量: ${cards.length}`);
    console.log(`🔧 API: /api/search, /api/deck/import, /api/code/:code`);
});
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 允许跨域（桌游模拟器需要）
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

// ========== 专为 Mod 设计的 API ==========

// 1. 批量查询卡牌（POST 方式，支持一次查多张）
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
                image_url: `https://${req.get('host')}/images/${card.official_id}.png`
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

// 2. 单张卡牌查询（GET 方式）
app.get('/api/card/:code', (req, res) => {
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
        image_url: `https://${req.get('host')}/images/${card.official_id}.png`
    });
});

// 3. 搜索卡牌
app.get('/api/search', (req, res) => {
    const { q, limit = 50 } = req.query;
    
    if (!q) {
        return res.json({ cards: [] });
    }
    
    const keyword = q.toLowerCase();
    const results = cards.filter(card => 
        card.cn_name.toLowerCase().includes(keyword) ||
        card.official_id.toLowerCase().includes(keyword) ||
        (card.cn_effect && card.cn_effect.toLowerCase().includes(keyword))
    ).slice(0, limit);
    
    res.json({
        total: results.length,
        cards: results.map(card => ({
            code: card.official_id,
            name: card.cn_name,
            color: card.color,
            type: card.card_type,
            rarity: card.rarity
        }))
    });
});

// 4. 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', cards: cards.length });
});

// 5. 原有网页接口
app.get('/api/filters', (req, res) => {
    const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))];
    const colors = [...new Set(cards.map(c => c.color).filter(Boolean))];
    const types = [...new Set(cards.map(c => c.card_type).filter(Boolean))];
    const series = [...new Set(cards.map(c => c.series).filter(Boolean))];
    const subtypes = [...new Set(cards.map(c => c.subtype).filter(Boolean))];
    res.json({ rarities, colors, types, series, subtypes });
});

loadCards();
app.listen(port, '0.0.0.0', () => {
    console.log(`🃏 卡查服务已启动！`);
    console.log(`📍 端口: ${port}`);
    console.log(`📊 卡牌数量: ${cards.length}`);
    console.log(`🔧 API: /api/card/编号`);
    console.log(`📦 批量导入: POST /api/deck/import`);
});
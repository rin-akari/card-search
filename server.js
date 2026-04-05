const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

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

// 搜索接口
app.get('/api/search', (req, res) => {
    const { q = '', rarity, color, type, series, subtype } = req.query;
    
    let results = [...cards];
    
    // 关键词搜索（卡名、效果、编号）
    if (q.trim()) {
        const keyword = q.toLowerCase();
        results = results.filter(card => 
            card.cn_name.toLowerCase().includes(keyword) ||
            card.jp_name.toLowerCase().includes(keyword) ||
            (card.cn_effect && card.cn_effect.toLowerCase().includes(keyword)) ||
            (card.official_id && card.official_id.toLowerCase().includes(keyword))
        );
    }
    
    // 稀有度筛选
    if (rarity && rarity !== 'all') {
        results = results.filter(card => card.rarity === rarity);
    }
    
    // 颜色筛选
    if (color && color !== 'all') {
        results = results.filter(card => card.color === color);
    }
    
    // 类型筛选
    if (type && type !== 'all') {
        results = results.filter(card => card.card_type === type);
    }
    
    // 系列筛选
    if (series && series !== 'all') {
        results = results.filter(card => card.series === series);
    }
    
    // 子类别筛选
    if (subtype && subtype !== 'all') {
        results = results.filter(card => card.subtype === subtype);
    }
    
    // 返回全部结果（不限制数量）
    res.json({ cards: results });
});

// 卡牌详情接口
app.get('/api/card/:id', (req, res) => {
    const card = cards.find(c => c.id == req.params.id);
    if (!card) {
        return res.status(404).json({ error: '卡牌不存在' });
    }
    res.json(card);
});

// 筛选选项接口（获取所有可用的筛选值）
app.get('/api/filters', (req, res) => {
    const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))];
    const colors = [...new Set(cards.map(c => c.color).filter(Boolean))];
    const types = [...new Set(cards.map(c => c.card_type).filter(Boolean))];
    const series = [...new Set(cards.map(c => c.series).filter(Boolean))];
    const subtypes = [...new Set(cards.map(c => c.subtype).filter(Boolean))];
    res.json({ rarities, colors, types, series, subtypes });
});

// 启动服务器
loadCards();
app.listen(port, '0.0.0.0', () => {
    console.log(`🃏 卡查服务已启动！`);
    console.log(`📍 访问: http://localhost:${port}`);
    console.log(`📊 卡牌数量: ${cards.length}`);
    console.log(`🔍 支持按卡名、效果、编号搜索`);
    console.log(`📂 支持按稀有度、颜色、类型、系列、子类别筛选`);
});
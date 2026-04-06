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

// ========== Scryfall 兼容 API ==========

// 根据编号精确查询卡牌（兼容 Scryfall 的 /cards/named 接口）
app.get('/cards/named', (req, res) => {
    const { exact, fuzzy } = req.query;
    
    let code = exact || fuzzy;
    if (!code) {
        return res.status(400).json({ object: "error", details: "Missing 'exact' or 'fuzzy' parameter" });
    }
    
    // 查找卡牌（按 official_id 或卡名）
    let card = cards.find(c => c.official_id === code);
    if (!card && fuzzy) {
        // 模糊匹配（按卡名）
        card = cards.find(c => c.cn_name.includes(code) || c.jp_name.includes(code));
    }
    
    if (!card) {
        return res.status(404).json({ object: "error", details: "Card not found" });
    }
    
    // 转换为 Scryfall 格式
    const scryfallCard = convertToScryfallFormat(card);
    res.json(scryfallCard);
});

// 根据 ID 查询卡牌
app.get('/cards/:id', (req, res) => {
    const { id } = req.params;
    
    let card = cards.find(c => c.official_id === id);
    if (!card) {
        card = cards.find(c => c.id == id);
    }
    
    if (!card) {
        return res.status(404).json({ object: "error", details: "Card not found" });
    }
    
    const scryfallCard = convertToScryfallFormat(card);
    res.json(scryfallCard);
});

// 搜索卡牌（兼容 Scryfall 的 /cards/search 接口）
app.get('/cards/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ object: "error", details: "Missing 'q' parameter" });
    }
    
    let results = [...cards];
    
    // 解析搜索语法（简化版，支持 ! 前缀表示精确编号）
    let searchTerm = q;
    let exactCode = null;
    
    if (q.startsWith('!')) {
        // 精确编号搜索
        exactCode = q.substring(1);
        results = results.filter(c => c.official_id === exactCode);
    } else {
        // 模糊搜索（卡名、效果、编号）
        const keyword = q.toLowerCase();
        results = results.filter(c => 
            c.cn_name.toLowerCase().includes(keyword) ||
            c.jp_name.toLowerCase().includes(keyword) ||
            (c.cn_effect && c.cn_effect.toLowerCase().includes(keyword)) ||
            (c.official_id && c.official_id.toLowerCase().includes(keyword))
        );
    }
    
    // 限制返回数量（Scryfall 默认最多 175 张）
    const limitedResults = results.slice(0, 175);
    
    res.json({
        object: "list",
        total_cards: results.length,
        has_more: results.length > 175,
        data: limitedResults.map(card => convertToScryfallFormat(card))
    });
});

// 转换函数：把你的卡牌格式转成 Scryfall 格式
function convertToScryfallFormat(card) {
    // 处理图片 URL
    let imageUrl = card.image_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
        // 相对路径转绝对路径
        const baseUrl = process.env.RAILWAY_STATIC_URL || `http://localhost:${port}`;
        imageUrl = `https://${baseUrl}${imageUrl}`;
    }
    
    // 处理多面卡（如果有的话）
    const imageUris = {
        png: imageUrl,
        large: imageUrl,
        normal: imageUrl,
        small: imageUrl,
        art_crop: imageUrl
    };
    
    // 处理颜色
    let colors = [];
    if (card.color) {
        // 颜色映射：赤→R, 青→U, 黄→W? 根据你的游戏调整
        const colorMap = {
            '赤': ['R'],
            '青': ['U'],
            '黄': ['W'],
            '白': ['W'],
            '黒': ['B'],
            '红': ['R'],
            '黑': ['B'],
            '绿': ['G'],
            '全': ['W','U','B','R','G']
        };
        colors = colorMap[card.color] || [card.color];
    }
    
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
        image_uris: imageUris,
        image_status: "highres_scan",
        prints_search_uri: `/cards/search?q=!${card.official_id}`,
        rulings_uri: `/cards/${card.official_id}/rulings`,
        scryfall_uri: `/cards/${card.official_id}`,
        related_uris: {
            gatherer: "",
            tcgplayer_infinite_articles: "",
            tcgplayer_infinite_decks: "",
            edhrec: ""
        },
        purchase_uris: {
            tcgplayer: "",
            cardmarket: "",
            cardhoarder: ""
        }
    };
}
// 启动服务器
loadCards();
app.listen(port, '0.0.0.0', () => {
    console.log(`🃏 卡查服务已启动！`);
    console.log(`📍 访问: http://localhost:${port}`);
    console.log(`📊 卡牌数量: ${cards.length}`);
    console.log(`🔍 支持按卡名、效果、编号搜索`);
    console.log(`📂 支持按稀有度、颜色、类型、系列、子类别筛选`);
});
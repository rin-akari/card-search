const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ========== 配置区域 ==========
const seriesNameMap = {
    'A': 'A',
    'B': 'B',
    'C': 'C',
    'D': 'D',
    'E': 'E',
    'F': 'F',
    'G': 'G',
    'H': 'H',
    'I': 'I',
    'J': 'J',
    'K': 'K',
    'L': 'L',
    'M': 'M',
    'N': 'N',
    'ex': 'ex',
    'prm': 'prm'
};

const subtypeNameMap = {
    'A': 'Artist',
    'M': 'Magic',
    'D': '设置',
    'S': 'Song'
};
// ==================================================

// 提取系列和子类别的函数
function extractSeriesAndSubtype(code) {
    if (!code) return { series: '', subtype: '' };
    
    // prm系列：格式 prmX-数字 或 prm-数字
    if (code.startsWith('prm')) {
        // 格式 prmX-数字（X是子类别字母）
        const match1 = code.match(/^prm([A-Z])-/);
        if (match1) {
            const subTypeLetter = match1[1];
            return {
                series: seriesNameMap['prm'] || 'prm',
                subtype: subtypeNameMap[subTypeLetter] || subTypeLetter
            };
        }
        // 格式 prm-数字（没有子类别字母）
        const match2 = code.match(/^prm-/);
        if (match2) {
            return {
                series: seriesNameMap['prm'] || 'prm',
                subtype: ''
            };
        }
    }
    
    // ex系列：格式 exX-数字
    if (code.startsWith('ex')) {
        const match = code.match(/^ex([A-Z])-/);
        if (match) {
            const subTypeLetter = match[1];
            return {
                series: seriesNameMap['ex'] || 'ex',
                subtype: subtypeNameMap[subTypeLetter] || subTypeLetter
            };
        }
    }
    
    // 普通系列：格式 XY-数字（X=系列，Y=子类别）
    const match = code.match(/^([A-Z])([A-Z])-/);
    if (match) {
        const seriesLetter = match[1];
        const subTypeLetter = match[2];
        return {
            series: seriesNameMap[seriesLetter] || seriesLetter,
            subtype: subtypeNameMap[subTypeLetter] || subTypeLetter
        };
    }
    
    return { series: '', subtype: '' };
}

// 读取 Excel 文件
const workbook = XLSX.readFile('Cardlist.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📖 读取到 ${data.length} 行数据`);
console.log(`📋 列名:`, Object.keys(data[0]));

const cards = [];
let id = 1;

for (const row of data) {
    const artist = row['Artist'] || '';
    const cn_name = row['卡名'] || '';
    const color = row['颜色'] || '';
    const cardType = row['类别'] || '';
    const effect = row['效果'] || '';
    const tags = row['标签'] || '';
    let rarity = row['罕贵'] || '';
    const artist_name = row['画师（若有）'] || '';
    
    // 清洗稀有度
    rarity = rarity.replace(/Ｒ/g, 'R').trim();
    
    if (!cn_name) continue;
    
    // 提取系列和子类别
    const { series, subtype } = extractSeriesAndSubtype(artist);
    
    // 清理效果文本
    let cleanEffect = effect ? effect.replace(/"/g, '') : '';
    
    // 查找图片（按 Artist 列匹配）
    let foundImage = '';
    const extensions = ['.jpg', '.png', '.webp', '.jpeg', '.JPG', '.PNG'];
    
    if (artist) {
        let imageName = artist.replace(/[\\/:*?"<>|]/g, '');
        for (const ext of extensions) {
            const imgPath = path.join(__dirname, 'public', 'images', `${imageName}${ext}`);
            if (fs.existsSync(imgPath)) {
                foundImage = `/images/${imageName}${ext}`;
                break;
            }
        }
    }
    
    if (!foundImage) {
        console.log(`⚠️ 未找到图片: ${artist} - ${cn_name}`);
        foundImage = `https://picsum.photos/id/${id % 80 + 10}/300/400`;
    }
    
    cards.push({
        id: id++,
        official_id: artist,
        jp_name: cn_name,
        cn_name: cn_name,
        cn_effect: cleanEffect,
        cost: '',
        color: color,
        card_type: cardType,
        rarity: rarity || '普通',
        image_url: foundImage,
        tags: tags,
        artist: artist_name,
        series: series,
        subtype: subtype
    });
}

// 保存为 JSON
fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`\n✅ 导入完成！共导入 ${cards.length} 张卡牌`);

// 统计
const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))];
const colors = [...new Set(cards.map(c => c.color).filter(Boolean))];
const types = [...new Set(cards.map(c => c.card_type).filter(Boolean))];
const series = [...new Set(cards.map(c => c.series).filter(Boolean))];
const subtypes = [...new Set(cards.map(c => c.subtype).filter(Boolean))];

console.log(`\n📊 统计:`);
console.log(`  稀有度: ${rarities.join(', ')}`);
console.log(`  颜色: ${colors.join(', ')}`);
console.log(`  类型: ${types.join(', ')}`);
console.log(`  系列: ${series.join(', ')}`);
console.log(`  子类别: ${subtypes.join(', ')}`);
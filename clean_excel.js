const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 定义颜色列表（完整）
const colorList = [
    '赤', '青', '黄', '白', '黒', '红', '黑', '全',
    '赤青', '青黒', '黒白', '黄白', '赤黄', '黒赤', 
    '青白', '白赤', '青黄', '黄黒'
];

// 定义类别列表
const typeList = ['魔法', '设置', 'Artist'];

// 即时和装备是魔法的子分类，归为魔法
const magicSubTypes = ['即时', '装备'];

// 读取原始 Excel
const workbook = XLSX.readFile('Cardlist.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📖 读取到 ${data.length} 行数据`);
console.log(`📋 原始列名:`, Object.keys(data[0]));

// 存储清洗后的数据
const cleanedData = [];

for (const row of data) {
    // 读取原始数据
    let originalColor = (row['颜色'] || '').trim();
    let originalType = (row['类别'] || '').trim();
    const artist = row['Artist'] || '';
    const cn_name = row['卡名'] || '';
    const effect = row['效果'] || '';
    const tags = row['标签'] || '';
    const rarity = row['罕贵'] || '';
    const artist_name = row['画师（若有）'] || '';
    
    // 初始化新的颜色和类别
    let newColor = '';
    let newType = originalType;
    
    // 处理原始颜色列的值
    if (originalColor) {
        // 情况1：直接在颜色列表中
        if (colorList.includes(originalColor)) {
            newColor = originalColor;
        }
        // 情况2：是魔法子类型（即时、装备）-> 归为魔法，加到类别
        else if (magicSubTypes.includes(originalColor)) {
            newType = newType ? `${newType}/${originalColor}` : `魔法/${originalColor}`;
            // 如果类别里没有"魔法"，加上
            if (!newType.includes('魔法')) {
                newType = `魔法/${newType}`;
            }
        }
        // 情况3：在类别列表中
        else if (typeList.includes(originalColor)) {
            newType = newType ? `${newType}/${originalColor}` : originalColor;
        }
        // 情况4：其他（可能是遗漏的类别）
        else if (originalColor) {
            console.log(`⚠️ 未识别: "${originalColor}" (卡牌: ${cn_name})，已添加到类别`);
            newType = newType ? `${newType}/${originalColor}` : originalColor;
        }
    }
    
    // 同时检查原始类别列是否有颜色值（放错的情况）
    if (originalType && colorList.includes(originalType)) {
        newColor = newColor || originalType;
        // 从类别中移除（如果只单独存在）
        if (newType === originalType) {
            newType = '';
        } else {
            newType = newType.replace(originalType, '').replace(/\/\//g, '/').replace(/^\/|\/$/g, '');
        }
        console.log(`📦 移动: "${originalType}" 从类别移到颜色 (卡牌: ${cn_name})`);
    }
    
    // 清理类别中的多余斜杠
    if (newType) {
        newType = newType.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    }
    
    // 构建清洗后的行
    const cleanedRow = {
        'Artist': artist,
        '卡名': cn_name,
        '颜色': newColor,
        '类别': newType,
        '效果': effect,
        '标签': tags,
        '罕贵': rarity,
        '画师（若有）': artist_name
    };
    
    cleanedData.push(cleanedRow);
}

// 创建新工作表
const newSheet = XLSX.utils.json_to_sheet(cleanedData);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Cardlist');

// 保存新文件
XLSX.writeFile(newWorkbook, 'Cardlist_cleaned.xlsx');
console.log(`\n✅ 清洗完成！`);
console.log(`📁 新文件: Cardlist_cleaned.xlsx`);
console.log(`📊 共处理 ${cleanedData.length} 行`);

// 统计清洗后的颜色和类别
const colors = [...new Set(cleanedData.map(r => r['颜色']).filter(Boolean))];
const types = [...new Set(cleanedData.map(r => r['类别']).filter(Boolean))];

console.log(`\n📊 清洗后统计:`);
console.log(`  颜色: ${colors.join(', ')}`);
console.log(`  类别: ${types.join(', ')}`);
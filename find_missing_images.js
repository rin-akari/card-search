const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 读取 Excel 文件
const workbook = XLSX.readFile('Cardlist.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📖 读取到 ${data.length} 行数据`);

// 存储缺失图片的卡牌
const missingImages = [];

// 图片文件夹路径
const imagesDir = path.join(__dirname, 'public', 'images');
const extensions = ['.jpg', '.png', '.webp', '.jpeg', '.JPG', '.PNG'];

// 遍历每一行
for (const row of data) {
    const artist = row['Artist'] || '';
    const cn_name = row['卡名'] || '';
    const rarity = row['罕贵'] || '';
    
    if (!cn_name) continue;
    
    // 查找图片
    let found = false;
    
    if (artist) {
        let imageName = artist.replace(/[\\/:*?"<>|]/g, '');
        for (const ext of extensions) {
            const imgPath = path.join(imagesDir, `${imageName}${ext}`);
            if (fs.existsSync(imgPath)) {
                found = true;
                break;
            }
        }
    }
    
    // 如果没找到，记录到缺失列表
    if (!found) {
        missingImages.push({
            'Artist': artist,
            '卡名': cn_name,
            '稀有度': rarity,
            '期望文件名': `${artist}.png`,  // 根据你的实际格式修改
            '备注': '请将图片放入 public/images/ 文件夹'
        });
    }
}

// 导出缺失列表为 CSV
const headers = ['Artist', '卡名', '稀有度', '期望文件名', '备注'];
const csvLines = [headers.join(',')];

for (const card of missingImages) {
    // 处理可能包含逗号或换行的内容
    const safeName = `"${card['卡名'].replace(/"/g, '""')}"`;
    const safeArtist = `"${card['Artist'].replace(/"/g, '""')}"`;
    csvLines.push(`${safeArtist},${safeName},${card['稀有度']},${card['期望文件名']},${card['备注']}`);
}

const csvContent = csvLines.join('\n');
fs.writeFileSync('missing_images.csv', csvContent, 'utf8');

console.log(`\n📊 统计:`);
console.log(`  总卡牌数: ${data.length}`);
console.log(`  缺失图片: ${missingImages.length}`);
console.log(`  已有图片: ${data.length - missingImages.length}`);
console.log(`\n✅ 缺失列表已导出到: missing_images.csv`);
console.log(`📁 用 Excel 打开这个文件，按 "期望文件名" 列去补齐图片`);

// 同时输出前10条缺失记录到控制台
if (missingImages.length > 0) {
    console.log(`\n📋 缺失图片示例（前10条）:`);
    missingImages.slice(0, 10).forEach(card => {
        console.log(`  - ${card['Artist']}: ${card['卡名']} (需要: ${card['期望文件名']})`);
    });
}
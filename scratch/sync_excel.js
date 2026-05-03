const XLSX = require('xlsx');
const fs = require('fs');

const vocabFile = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/js/vocabulary_data.js';
const excelFile = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/game_theo_chu_de.xlsx';
const outputExcel = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/game_theo_chu_de.xlsx';

try {
    const hsk1Vocab = require(vocabFile);

    const topicData = {};
    hsk1Vocab.forEach(item => {
        if (!topicData[item.topic]) {
            topicData[item.topic] = [];
        }
        topicData[item.topic].push(item.word);
    });

    const validTopics = Object.keys(topicData).filter(t => topicData[t].length >= 9);
    console.log("Valid topics count:", validTopics.length);

    const workbook = XLSX.readFile(excelFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const oldData = XLSX.utils.sheet_to_json(sheet);
    const template = oldData[0] || {};

    const newData = [];
    
    const sortedTopics = validTopics.sort((a, b) => {
        const numA = parseInt(a.split('.')[0]);
        const numB = parseInt(b.split('.')[0]);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    sortedTopics.forEach(topic => {
        // Use newline character for separation
        const words = topicData[topic].join('\n');
        const newRow = {
            'Chủ đề': topic,
            'Những từ vựng sử dụng ': words,
            'Tên Trò chơi (Trên Web)': template['Tên Trò chơi (Trên Web)'] || 'HSK 1 - TRUY ĐUỔI KẺ TRỘM',
            'Công cụ Tạo Game': template['Công cụ Tạo Game'] || 'HTML5, CSS3, JavaScript',
            'TV Phụ trách': template['TV Phụ trách'] || 'Nhóm Phát triển HSK1',
            'Loại GAME': template['Loại GAME'] || 'Board Game Trí Tuệ',
            'LINK SẢN PHẨM (BẮT BUỘC)': template['LINK SẢN PHẨM (BẮT BUỘC)'] || 'index.html',
            'Mục tiêu Sư phạm': template['Mục tiêu Sư phạm'] || '',
            'Gợi ý Ứng dụng': template['Gợi ý Ứng dụng'] || '',
            'Gợi ý Hoạt động ': template['Gợi ý Hoạt động '] || ''
        };
        newData.push(newRow);
    });

    const newSheet = XLSX.utils.json_to_sheet(newData);
    
    // In Excel, to make newlines visible, we should ideally set "wrap text" to true.
    // However, basic xlsx writing doesn't always preserve cell styles unless using a pro version or specific options.
    // But \n will be in the data.
    
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");
    XLSX.writeFile(newWorkbook, outputExcel);

    console.log(`Successfully updated ${outputExcel} with newline separation.`);

} catch (e) {
    console.error("Error:", e);
}

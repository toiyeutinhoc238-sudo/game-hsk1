const fs = require('fs');
const XLSX = require('xlsx');

// 1. Read vocabulary data
const vocabData = require('c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/js/vocabulary_data.js');

// 2. Group words by topic
const topicsMap = {};
vocabData.forEach(item => {
    if (!topicsMap[item.topic]) {
        topicsMap[item.topic] = [];
    }
    topicsMap[item.topic].push(item.word);
});

const sortedTopics = Object.keys(topicsMap).sort((a, b) => {
    const numA = parseInt(a.split('.')[0]);
    const numB = parseInt(b.split('.')[0]);
    return numA - numB;
});

// 3. Prepare data for Excel
const headers = [
    'Chủ đề',
    'Những từ vựng sử dụng ',
    'Tên Trò chơi (Trên Web)',
    'Công cụ Tạo Game',
    'TV Phụ trách',
    'Loại GAME',
    'LINK SẢN PHẨM (BẮT BUỘC)',
    'Mục tiêu Sư phạm',
    'Gợi ý Ứng dụng',
    'Gợi ý Hoạt động '
];

const excelRows = [headers];
const merges = [];

sortedTopics.forEach(topic => {
    const words = topicsMap[topic];
    const startRow = excelRows.length;
    const rowCount = words.length;

    words.forEach((word, idx) => {
        excelRows.push([
            topic,
            word,
            'HSK 1 - TRUY ĐUỔI KẺ TRỘM',
            'HTML5, CSS3, JavaScript',
            'Nhóm Phát triển HSK1',
            'Board Game Trí Tuệ',
            'index.html',
            'Ghi nhớ mặt chữ, ý nghĩa và cách phát âm từ vựng HSK 1 theo chủ đề thông qua trò chơi tương tác.',
            'Sử dụng trong các buổi khởi động (Warm-up) hoặc ôn tập sau bài học (Review).',
            'Chia lớp thành 2 đội (Trộm & Cảnh sát). Mỗi lượt đi yêu cầu trả lời đúng từ vựng để được di chuyển.'
        ]);
    });

    if (rowCount > 1) {
        // Merge columns except the vocabulary column (index 1)
        const colsToMerge = [0, 2, 3, 4, 5, 6, 7, 8, 9];
        colsToMerge.forEach(col => {
            merges.push({
                s: { r: startRow, c: col },
                e: { r: startRow + rowCount - 1, c: col }
            });
        });
    }
});

// 4. Write to Excel
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(excelRows);

// Apply merges
ws['!merges'] = merges;

// Set column widths
ws['!cols'] = [
    { wch: 30 }, // Chủ đề
    { wch: 15 }, // Từ vựng (independent now, so can be smaller)
    { wch: 25 }, // Tên game
    { wch: 20 }, // Công cụ
    { wch: 20 }, // TV phụ trách
    { wch: 20 }, // Loại game
    { wch: 15 }, // Link
    { wch: 40 }, // Mục tiêu
    { wch: 30 }, // Gợi ý ứng dụng
    { wch: 40 }  // Gợi ý hoạt động
];

XLSX.utils.book_append_sheet(wb, ws, 'HSK 1');
XLSX.writeFile(wb, 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/game_theo_chu_de.xlsx');

console.log(`Successfully filled ${sortedTopics.length} topics with individual word rows into game_theo_chu_de.xlsx`);

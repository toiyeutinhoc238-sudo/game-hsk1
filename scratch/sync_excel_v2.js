const fs = require('fs');
const xlsx = require('xlsx');

// Read vocabulary data
const code = fs.readFileSync('../js/vocabulary_data.js', 'utf8');
const match = code.match(/const hsk1Vocab = (\[[\s\S]+?\]);/);
if(!match) {
    console.error('Could not find hsk1Vocab data');
    process.exit(1);
}
const vocab = eval(match[1]);

// Group words by topic
const topicMap = {};
vocab.forEach(item => {
    if(!topicMap[item.topic]) {
        topicMap[item.topic] = [];
    }
    topicMap[item.topic].push(item.word);
});

// Create data rows
const dataRows = [];
dataRows.push(['Chủ đề', 'Từ vựng', 'Gợi ý tổ chức', 'Gợi ý hoạt động']);

// Sort topics nicely
const sortedTopics = Object.keys(topicMap).sort((a, b) => {
    const numA = parseInt(a.split('.')[0]);
    const numB = parseInt(b.split('.')[0]);
    if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
    }
    return a.localeCompare(b);
});

sortedTopics.forEach(topic => {
    const words = topicMap[topic];
    const wordsString = words.map((w, index) => `${index + 1}. ${w}`).join('\r\n');
    dataRows.push([
        topic,
        wordsString,
        'Sử dụng trong các buổi khởi động (Warm-up) hoặc ôn tập sau bài học (Review).',
        'Chia lớp thành 2 đội (Trộm & Cảnh sát). Mỗi lượt đi yêu cầu trả lời đúng từ vựng để được di chuyển.'
    ]);
});

// Create Excel workbook
const ws = xlsx.utils.aoa_to_sheet(dataRows);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Chủ đề');

// Write to file
xlsx.writeFile(wb, '../chu_de.xlsx');
console.log('Successfully updated chu_de.xlsx');

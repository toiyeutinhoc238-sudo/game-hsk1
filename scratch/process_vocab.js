const fs = require('fs');
const XLSX = require('xlsx');

// This script now reads DIRECTLY from the Excel file to avoid parsing errors
const excelPath = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/ngan_hang_tu_vung.xlsx';
const outputPath = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/js/vocabulary_data.js';

try {
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header row
    const rows = data.slice(1);
    
    const vocab = rows.map(row => {
        // Excel column mapping (0-indexed):
        // 0: STT, 1: Bài, 2: Tên Bài, 3: Từ vựng, 4: Từ loại, 5: Phiên âm, 6: Nghĩa, 7: Chủ đề
        const word = String(row[3] || "").trim();
        if (!word) return null;

        let topic = String(row[7] || "").trim();
        // Clean up topic name (remove trailing colons etc)
        topic = topic.replace(/:$/, '').trim();

        return {
            word: word,
            type: String(row[4] || "").trim(),
            pinyin: String(row[5] || "").trim(),
            meaning: String(row[6] || "").replace(/\r?\n/g, ' ').trim(),
            topic: topic
        };
    }).filter(item => item !== null);

    const output = `const hsk1Vocab = ${JSON.stringify(vocab, null, 2)};\n\nif (typeof module !== 'undefined') module.exports = hsk1Vocab;`;
    fs.writeFileSync(outputPath, output);
    
    console.log(`Successfully processed ${vocab.length} items directly from Excel.`);
} catch (error) {
    console.error("Error processing Excel:", error);
}

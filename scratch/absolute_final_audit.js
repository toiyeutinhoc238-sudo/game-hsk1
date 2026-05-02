const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/ngan_hang_tu_vung.xlsx');
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
const excelRows = data.slice(1).filter(r => r[3]);

const vocabData = require('c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/js/vocabulary_data.js');

const report = {
    totalExcel: excelRows.length,
    totalGame: vocabData.length,
    missingInGame: [],
    mismatchedMeanings: [],
    mismatchedTopics: [],
    pinyinChecks: []
};

excelRows.forEach((row, i) => {
    const stt = row[0];
    const word = String(row[3]).trim();
    const gameItem = vocabData.find(v => v.word === word);

    if (!gameItem) {
        report.missingInGame.push({ stt, word });
    } else {
        const excelMeaning = String(row[6]).replace(/\r?\n/g, ' ').trim();
        const excelTopic = String(row[7]).trim().replace(/:$/, '');

        if (gameItem.meaning !== excelMeaning) {
            report.mismatchedMeanings.push({ stt, word, excel: excelMeaning, game: gameItem.meaning });
        }
        if (gameItem.topic !== excelTopic) {
            report.mismatchedTopics.push({ stt, word, excel: excelTopic, game: gameItem.topic });
        }
        
        // Basic Pinyin tone check
        if (gameItem.pinyin && !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(gameItem.pinyin)) {
            // Some words might genuinely not have tones (like 'ba'), but it's worth flagging
            if (gameItem.pinyin !== "ba" && gameItem.pinyin !== "de" && gameItem.pinyin !== "ma" && gameItem.pinyin !== "ne") {
                 report.pinyinChecks.push({ stt, word, pinyin: gameItem.pinyin });
            }
        }
    }
});

console.log(JSON.stringify(report, null, 2));

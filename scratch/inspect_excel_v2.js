const XLSX = require('xlsx');
const file = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/game_theo_chu_de.xlsx';

try {
    const workbook = XLSX.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.slice(1, 5).forEach((row, i) => {
        console.log(`Row ${i+1}:`, row[0], "| Words:", row[1]);
    });
} catch (e) {
    console.error("Error reading file:", e.message);
}

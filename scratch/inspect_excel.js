const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/game_theo_chu_de.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {header: 1});
    
    console.log('Sheet Name:', sheetName);
    console.log('Headers:', data[0]);
    console.log('Sample Row:', data[1]);
} catch (error) {
    console.error('Error reading Excel:', error.message);
}

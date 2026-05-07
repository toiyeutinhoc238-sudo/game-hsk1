const xlsx = require('xlsx');

const workbook = xlsx.readFile('../chu_de.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for(let i=1; i<data.length; i++) {
    console.log(`Topic: ${data[i][0]} | Org: ${data[i][2]} | Act: ${data[i][3]}`);
}

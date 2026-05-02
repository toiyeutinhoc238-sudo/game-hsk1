const fs = require('fs');

// Read the current process_vocab.js
const scriptPath = 'c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/scratch/process_vocab.js';
let content = fs.readFileSync(scriptPath, 'utf8');

// The issue is the rawData string has newlines inside records.
// I will fetch the rawData block, clean it, and put it back.
const match = content.match(/let rawData = `([\s\S]*?)`;/);
if (match) {
    let rawData = match[1];
    
    // Split into lines
    let lines = rawData.split('\n');
    let cleanedLines = [];
    let currentLine = "";
    
    lines.forEach(line => {
        if (line.trim() === "") return;
        
        // If the line starts with a number (STT), it's a new record
        if (/^\d+\t/.test(line.trim()) || /^\t/.test(line)) {
            if (currentLine) cleanedLines.push(currentLine);
            currentLine = line.trim();
        } else {
            // It's a continuation of the previous line
            currentLine += " " + line.trim();
        }
    });
    if (currentLine) cleanedLines.push(currentLine);
    
    // Now replace the block
    const newRawData = "\n" + cleanedLines.join('\n') + "\n";
    content = content.replace(/let rawData = `[\s\S]*?`;/, "let rawData = `" + newRawData + "`;");
    
    fs.writeFileSync(scriptPath, content);
    console.log('Cleaned up newlines in process_vocab.js rawData.');
}

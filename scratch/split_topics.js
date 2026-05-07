
const fs = require('fs');
const path = require('path');

// Mocking the environment to read the JS file
const vocabFilePath = path.join('c:', 'Users', 'BRAVO 15', 'Downloads', 'game tieng trung hsk 1', 'js', 'vocabulary_data.js');
let fileContent = fs.readFileSync(vocabFilePath, 'utf8');

// Extract the array content
const startMarker = 'const hsk1Vocab = [';
const endMarker = '];';
const startIndex = fileContent.indexOf(startMarker) + startMarker.length - 1;
const endIndex = fileContent.lastIndexOf(endMarker) + 1;
const arrayJson = fileContent.substring(startIndex, endIndex);

// We need to handle the fact that it might not be pure JSON if there are comments or other JS stuff
// But based on the view_file, it looks like a clean array of objects.
// However, it's safer to use eval or a proper parser if it's JS.
// Since I'm running in node, I can just require it if I wrap it correctly or just parse it if it's clean.

// Let's try to parse it as JSON first, but it has trailing commas maybe?
// Actually, it's a JS file. I can just require it if I use a temporary file.

const tempFilePath = path.join(__dirname, 'temp_vocab.js');
fs.writeFileSync(tempFilePath, fileContent + "\nmodule.exports = hsk1Vocab;");
const hsk1Vocab = require(tempFilePath);

const topics = {};
hsk1Vocab.forEach(item => {
    if (!topics[item.topic]) {
        topics[item.topic] = [];
    }
    topics[item.topic].push(item);
});

const newVocab = [];

Object.keys(topics).forEach(topicName => {
    const words = topics[topicName];
    if (words.length > 25) {
        const mid = Math.ceil(words.length / 2);
        const part1 = words.slice(0, mid);
        const part2 = words.slice(mid);
        
        part1.forEach(item => {
            newVocab.push({
                ...item,
                topic: `${topicName} (Phần 1)`
            });
        });
        
        part2.forEach(item => {
            newVocab.push({
                ...item,
                topic: `${topicName} (Phần 2)`
            });
        });
        
        console.log(`Split topic "${topicName}": ${words.length} words -> ${part1.length} and ${part2.length}`);
    } else {
        words.forEach(item => newVocab.push(item));
    }
});

// Generate new file content
const newFileContent = `const hsk1Vocab = ${JSON.stringify(newVocab, null, 2)};\n\nif (typeof module !== 'undefined') module.exports = hsk1Vocab;`;
fs.writeFileSync(vocabFilePath, newFileContent);

fs.unlinkSync(tempFilePath);
console.log("Done updating vocabulary_data.js");

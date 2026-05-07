const fs = require('fs');

const words = `八
百
半
本
第
多少
二
个
号
几
斤
九
口
块
两
零
六
七
千
三
十
四
岁
五
些
一
一半
一下
一点儿
一些
有
有的
有点儿
有些
只`.split('\n').map(w => w.trim()).filter(w => w);

const p1 = words.slice(0, 12);
const p2 = words.slice(12, 24);
const p3 = words.slice(24);

const wordToTopic = {};
p1.forEach(w => wordToTopic[w] = '14. Số lượng & Đo lường (Phần 1)');
p2.forEach(w => wordToTopic[w] = '14. Số lượng & Đo lường (Phần 2)');
p3.forEach(w => wordToTopic[w] = '14. Số lượng & Đo lường (Phần 3)');

let code = fs.readFileSync('../js/vocabulary_data.js', 'utf8');

const match = code.match(/const hsk1Vocab = (\[[\s\S]+?\]);/);
if(match) {
    let vocab = eval(match[1]);
    
    vocab.forEach(item => {
        if (item.topic.startsWith('14. Số lượng & Đo lường')) {
            if (wordToTopic[item.word]) {
                item.topic = wordToTopic[item.word];
            } else {
                console.log('Unmapped word in 14:', item.word);
            }
        }
    });

    fs.writeFileSync('../js/vocabulary_data.js', `const hsk1Vocab = ${JSON.stringify(vocab, null, 2)};\n`);
    console.log('Update complete for topic 14.');
}

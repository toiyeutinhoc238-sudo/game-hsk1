const fs = require('fs');

const wordsStr = `八
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
只`.split('\n').map(w => w.trim());

const pinyinMeaningStr = `bā	tám
bǎi	Một trăm
bàn	Một nửa
běn	vở; tập; cuốn; quyển (dùng cho sách vở sổ sách)
dì	(tiền tố) đứng trước số thứ tự
duōshao	Bao nhiêu
èr	hai
gè	cái
hào	lượng từ: dùng cho ngày (ngày tháng)；danh từ: số
jǐ	bao nhiêu; một vài
jīn	cân
jiǔ	Chín
kǒu	người; thành viên
kuài	lượng từ dùng cho tiền giấy
liǎng	hai
líng	số không
liù	sáu
qī	bảy
qiān	nghìn
sān	ba
shí	mười
sì	Bốn
suì	tuổi
wǔ	năm
xiē	một số
yī	một
yíbàn	một nửa
yíxià	một lần
yìdiǎnr	một chút
yìxiē	Một số
yǒu	có
yǒude	một số
yǒudiǎnr	có chút hơi...
yǒuxiē	một số
zhī 	lượng từ dùng cho con vật`.split('\n');

const updateData = {};
for(let i = 0; i < wordsStr.length; i++) {
    const parts = pinyinMeaningStr[i].split('\t');
    updateData[wordsStr[i]] = {
        pinyin: parts[0].trim(),
        meaning: parts[1].trim()
    };
}

let code = fs.readFileSync('../js/vocabulary_data.js', 'utf8');

const match = code.match(/const hsk1Vocab = (\[[\s\S]+?\]);/);
if(match) {
    let vocab = eval(match[1]);
    let updatedCount = 0;
    
    vocab.forEach(item => {
        if (updateData[item.word] && item.topic.startsWith('14. Số lượng & Đo lường')) {
            const newData = updateData[item.word];
            if (item.pinyin !== newData.pinyin || item.meaning !== newData.meaning) {
                console.log(`Updating ${item.word}:`);
                console.log(`  Pinyin: ${item.pinyin} -> ${newData.pinyin}`);
                console.log(`  Meaning: ${item.meaning} -> ${newData.meaning}`);
                
                item.pinyin = newData.pinyin;
                item.meaning = newData.meaning;
                updatedCount++;
            }
        }
    });

    if (updatedCount > 0) {
        fs.writeFileSync('../js/vocabulary_data.js', `const hsk1Vocab = ${JSON.stringify(vocab, null, 2)};\n`);
        console.log(`Updated ${updatedCount} words.`);
    } else {
        console.log('All words match perfectly. No updates needed.');
    }
}

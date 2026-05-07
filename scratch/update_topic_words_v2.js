const fs = require('fs');

const data = {
  "1. Con người & Các mối quan hệ": {
    "Phần 1": ["爸爸", "大家", "弟弟", "对不起", "儿子", "哥哥", "孩子", "家人", "接", "姐姐", "妈妈", "妹妹", "们", "名字", "男", "男朋友", "你", "你们"],
    "Phần 2": ["您", "女", "女儿", "女朋友", "女士", "朋友", "人", "谁", "他", "他们", "它", "它们", "她们", "同学", "我", "我们", "先生", "小朋友", "她"]
  },
  "10. Thời gian": {
    "Phần 1": ["白天", "点", "分", "分钟", "今年", "今天", "明年", "明天", "年", "去年", "日", "上午", "时候", "时间", "晚"],
    "Phần 2": ["晚上", "下午", "现在", "小时", "星期", "星期日", "星期天", "月", "早", "早上", "中午", "昨天", "今年", "今天", "明年", "明天"]
  },
  "14. Số lượng & Đo lường": {
    "Phần 1": ["八", "百", "半", "本", "第", "多少", "二", "个", "号", "几", "斤", "九"],
    "Phần 2": ["块", "两", "零", "六", "七", "千", "三", "十", "四", "岁", "五"]
  },
  "15. Công cụ ngữ pháp & Cấu trúc": {
    "Phần 1": ["吧", "不客气", "不要", "不", "的", "都", "还", "和", "很", "家", "可以", "了", "吗", "没", "没关系", "没事", "没有", "哪", "哪里", "那里", "那儿"],
    "Phần 2": ["呢", "能", "你好", "请", "什么", "是", "太", "喂", "谢谢", "要", "也", "再", "再见", "在", "怎么", "怎么样", "这", "这些", "正在"]
  }
};

let code = fs.readFileSync('../js/vocabulary_data.js', 'utf8');

const match = code.match(/const hsk1Vocab = (\[[\s\S]+?\]);/);
if(match) {
    let vocab = eval(match[1]);
    
    let wordToTopic = {};
    for(const mainTopic in data) {
        for(const phan in data[mainTopic]) {
            data[mainTopic][phan].forEach(word => {
                wordToTopic[word] = `${mainTopic} (${phan})`;
            });
        }
    }
    
    vocab.forEach(item => {
        const matchingMainTopic = Object.keys(data).find(t => item.topic.startsWith(t));
        if (matchingMainTopic) {
            if (wordToTopic[item.word]) {
                item.topic = wordToTopic[item.word];
            } else {
                // Move leftover words to Phần 3
                item.topic = `${matchingMainTopic} (Phần 3)`;
                console.log(`Moved leftover word ${item.word} to ${item.topic}`);
            }
        }
    });

    fs.writeFileSync('../js/vocabulary_data.js', `const hsk1Vocab = ${JSON.stringify(vocab, null, 2)};\n`);
    console.log('Update complete with leftovers moved to Phần 3.');
}

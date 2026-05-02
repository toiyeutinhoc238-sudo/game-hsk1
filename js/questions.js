/**
 * Dynamic Question Generator for HSK 1
 * Uses data from vocabulary_data.js
 */

function generateQuestionsForTopic(topicName) {
    const topicVocab = hsk1Vocab.filter(item => item.topic === topicName);
    if (topicVocab.length === 0) return [];

    const questions = topicVocab.map(item => {
        const qType = Math.random() > 0.5 ? 'CN_TO_VN' : 'VN_TO_CN';
        let questionText, options, correctIdx;

        if (qType === 'CN_TO_VN') {
            // Question: Chinese -> Options: Vietnamese meanings
            const others = hsk1Vocab.filter(v => v.meaning !== item.meaning);
            const distractors = [];
            while (distractors.length < 3) {
                const random = others[Math.floor(Math.random() * others.length)];
                if (!distractors.includes(random.meaning)) {
                    distractors.push(random.meaning);
                }
            }

            const rawOptions = [item.meaning, ...distractors];
            // Shuffle options
            for (let i = rawOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
            }
            
            questionText = `Nghĩa của từ "${item.word}" (${item.pinyin}) là gì?`;
            options = rawOptions;
            correctIdx = options.indexOf(item.meaning);
        } else {
            // Question: Vietnamese -> Options: Chinese words
            const others = hsk1Vocab.filter(v => v.word !== item.word);
            const distractors = [];
            while (distractors.length < 3) {
                const random = others[Math.floor(Math.random() * others.length)];
                if (!distractors.includes(random.word)) {
                    distractors.push(random.word);
                }
            }

            const rawOptions = [item.word, ...distractors];
            // Shuffle options
            for (let i = rawOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
            }

            questionText = `Từ nào sau đây có nghĩa là "${item.meaning}"?`;
            options = rawOptions;
            correctIdx = options.indexOf(item.word);
        }

        return {
            q: questionText,
            a: options,
            correct: correctIdx,
            vocab: `${item.word} (${item.pinyin}) - ${item.meaning}`,
            word: item.word,
            pinyin: item.pinyin,
            meaning: item.meaning
        };
    });

    return questions;
}

const hsk1Questions = {};

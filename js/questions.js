/**
 * Dynamic Question Generator for HSK 1
 * Uses data from vocabulary_data.js
 */

function generateQuestionsForTopic(topicName) {
    const topicVocab = hsk1Vocab.filter(item => item.topic === topicName);
    if (topicVocab.length === 0) return [];

    // Count occurrences of each meaning across ALL vocab to detect synonyms
    const meaningCounts = {};
    hsk1Vocab.forEach(v => {
        const m = v.meaning.toLowerCase().trim();
        meaningCounts[m] = (meaningCounts[m] || 0) + 1;
    });

    const questions = topicVocab.map(item => {
        const mKey = item.meaning.toLowerCase().trim();
        const isDuplicateMeaning = meaningCounts[mKey] > 1;
        
        // LOGIC: 
        // 1. If meaning is shared by multiple words (e.g. "Ở đâu"), ALWAYS ask CN_TO_VN (Word -> Meaning).
        // 2. If meaning is unique, pick 50/50 between CN_TO_VN and VN_TO_CN.
        const qType = isDuplicateMeaning ? 'CN_TO_VN' : (Math.random() > 0.5 ? 'CN_TO_VN' : 'VN_TO_CN');
        
        let questionText, options, correctIdx;

        if (qType === 'CN_TO_VN') {
            // Question: Chinese -> Options: Vietnamese meanings
            // Get 3 distractors with DIFFERENT meanings
            const others = hsk1Vocab.filter(v => v.meaning.toLowerCase().trim() !== mKey);
            const distractors = [];
            const usedMeanings = new Set([mKey]);

            while (distractors.length < 3 && others.length > 0) {
                const random = others[Math.floor(Math.random() * others.length)];
                const rMeaning = random.meaning.toLowerCase().trim();
                if (!usedMeanings.has(rMeaning)) {
                    distractors.push(random.meaning);
                    usedMeanings.add(rMeaning);
                }
            }

            const rawOptions = [item.meaning, ...distractors];
            // Shuffle
            for (let i = rawOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
            }
            
            questionText = `Nghĩa của từ "${item.word}" là gì?`;
            options = rawOptions;
            correctIdx = options.indexOf(item.meaning);
        } else {
            // Question: Vietnamese -> Options: Chinese words
            // Get 3 distractors with DIFFERENT words
            const others = hsk1Vocab.filter(v => v.word !== item.word);
            const distractors = [];
            const usedWords = new Set([item.word]);

            while (distractors.length < 3 && others.length > 0) {
                const random = others[Math.floor(Math.random() * others.length)];
                if (!usedWords.has(random.word)) {
                    distractors.push(random.word);
                    usedWords.add(random.word);
                }
            }

            const rawOptions = [item.word, ...distractors];
            // Shuffle
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

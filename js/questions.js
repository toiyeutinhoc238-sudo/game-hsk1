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
        // Pick 50/50 between CN_TO_VN (Chinese -> Vietnamese) and VN_TO_CN (Vietnamese -> Chinese).
        const qType = Math.random() > 0.5 ? 'CN_TO_VN' : 'VN_TO_CN';
        
        let questionText, options, correctIdx;

        if (qType === 'CN_TO_VN') {
            // Question: Chinese -> Options: Vietnamese meanings
            // Get 3 distractors with DIFFERENT meanings
            const others = hsk1Vocab.filter(v => v.meaning.toLowerCase().trim() !== mKey);
            const distractors = [];
            const usedMeanings = new Set([mKey]);

            const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
            for (const random of shuffledOthers) {
                const rMeaning = random.meaning.toLowerCase().trim();
                if (!usedMeanings.has(rMeaning)) {
                    distractors.push(random.meaning.toLowerCase());
                    usedMeanings.add(rMeaning);
                    if (distractors.length >= 3) break;
                }
            }

            const rawOptions = [item.meaning.toLowerCase(), ...distractors];
            // Shuffle
            for (let i = rawOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
            }
            
            questionText = `Nghĩa của từ "${item.word}" là gì?`;
            options = rawOptions;
            correctIdx = options.indexOf(item.meaning.toLowerCase());
        } else {
            // Question: Vietnamese -> Options: Chinese words
            // Get 3 distractors with DIFFERENT words and DIFFERENT meanings
            const others = hsk1Vocab.filter(v => v.word !== item.word && v.meaning.toLowerCase().trim() !== mKey);
            const distractors = [];
            const usedWords = new Set([item.word]);

            const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
            for (const random of shuffledOthers) {
                if (!usedWords.has(random.word)) {
                    distractors.push(random.word);
                    usedWords.add(random.word);
                    if (distractors.length >= 3) break;
                }
            }

            const rawOptions = [item.word, ...distractors];
            // Shuffle
            for (let i = rawOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
            }

            questionText = `Từ nào sau đây có nghĩa là "${item.meaning.toLowerCase()}"?`;
            options = rawOptions;
            correctIdx = options.indexOf(item.word);
        }

        return {
            q: questionText,
            a: options,
            correct: correctIdx,
            vocab: `${item.word} (${item.pinyin}) - ${item.meaning.toLowerCase()}`,
            word: item.word,
            pinyin: item.pinyin,
            meaning: item.meaning.toLowerCase()
        };
    });

    // Shuffle the final questions pool
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    
    return questions;
}

const hsk1Questions = {};

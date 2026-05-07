
const vocab = require('../js/vocabulary_data.js');
const counts = {};
vocab.forEach(item => {
    counts[item.topic] = (counts[item.topic] || 0) + 1;
});
console.log(JSON.stringify(counts, null, 2));

/**
 * HSK 1 - TRUY ĐUỔI KẺ TRỘM
 * Real-time Two-way State Synchronization Engine & Game Core
 * Tương thích đa cửa sổ & LMS iFrame (Moodle, Canvas, SCORM, Popup Window)
 * Kiến trúc chuẩn hoá đồng bộ tuyệt đối theo tiêu chuẩn HSK 4
 */

/* ==========================================================================
   GLOBAL SYNCHRONIZATION VARIABLES & STORAGE ADAPTER
   (Initialized at top to eliminate TDZ ReferenceErrors)
   ========================================================================== */
let isMuted = false;
let isChildWindow = false;
let isWaitingForChild = false;
let childGameWindow = null;
let gameSyncChannel = null;
let latestSyncedState = null;
let lastChildMessageTime = 0;
let isApplyingSync = false;
let lastSoundToggleTime = 0;
let childCheckInterval = null;

// Storage fallback safe for sandboxed iFrames
const storage = window.safeStorage || {
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ==========================================================================
   AUDIO SYNCHRONIZATION ENGINE
   Đồng bộ 2 chiều bật/tắt âm & tiếp nối mượt mà vị trí đoạn nhạc (currentTime)
   ========================================================================== */
function updateSoundToggleUI() {
    const musicIcon = document.getElementById('musicIcon');
    if (musicIcon) {
        musicIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    const soundBtns = [
        document.getElementById('musicToggle'),
        document.getElementById('sound-toggle'),
        document.querySelector('[data-role="sound-toggle"]')
    ].filter(Boolean);

    soundBtns.forEach(btn => {
        btn.classList.toggle('muted', isMuted);
        const titleStr = isMuted ? "Bật nhạc nền" : "Tắt nhạc nền";
        btn.title = titleStr;
        btn.setAttribute('aria-label', titleStr);
    });
}

function applyMuteState(muted) {
    isMuted = Boolean(muted);
    updateSoundToggleUI();

    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
        bgMusic.muted = isMuted;
        if (isMuted) {
            try { bgMusic.pause(); } catch (err) {}
        } else {
            if (!(!isChildWindow && window.isWaitingForChild)) {
                startBgMusic();
            }
        }
    }

    try {
        if (window.safeStorage) window.safeStorage.setItem('hsk1_audio_mute', isMuted ? 'true' : 'false');
        localStorage.setItem('hsk1_audio_mute', isMuted ? 'true' : 'false');
    } catch (e) {}
}

function toggleMusic(e) {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    if (now - lastSoundToggleTime < 200) return; // Debounce rapid clicks
    lastSoundToggleTime = now;

    applyMuteState(!isMuted);
    broadcastAudioSync();
}
window.toggleMusic = toggleMusic;
window.toggleSound = toggleMusic;

function broadcastAudioSync(customTime = null) {
    const bgMusic = document.getElementById('bgMusic');
    const curTime = isFinite(customTime) && customTime !== null
        ? Number(customTime.toFixed(2))
        : ((bgMusic && !isNaN(bgMusic.currentTime)) ? Number(bgMusic.currentTime.toFixed(2)) : 0);

    const msg = {
        type: 'HSK1_AUDIO_SYNC',
        isMuted: isMuted,
        audioCurrentTime: curTime,
        timestamp: Date.now()
    };

    try {
        if (window.safeStorage) window.safeStorage.setItem('hsk1_audio_mute', isMuted ? 'true' : 'false');
        localStorage.setItem('hsk1_audio_mute', isMuted ? 'true' : 'false');
        const syncPayload = JSON.stringify(msg);
        if (window.safeStorage) window.safeStorage.setItem('hsk1_audio_sync', syncPayload);
        localStorage.setItem('hsk1_audio_sync', syncPayload);
    } catch (e) {}

    if (gameSyncChannel) {
        try { gameSyncChannel.postMessage(msg); } catch (e) {}
    }
    if (isChildWindow && window.opener && !window.opener.closed) {
        try { window.opener.postMessage(msg, '*'); } catch (e) {}
    } else if (childGameWindow && !childGameWindow.closed) {
        try { childGameWindow.postMessage(msg, '*'); } catch (e) {}
    }
}
window.broadcastAudioSync = broadcastAudioSync;

function startBgMusic() {
    const bgMusic = document.getElementById('bgMusic');
    if (!bgMusic) return;
    if (bgMusic.paused && !isMuted) {
        if (window.LMSAdapter && typeof window.LMSAdapter.safePlayAudio === 'function') {
            window.LMSAdapter.safePlayAudio(bgMusic, 'bg');
        } else {
            bgMusic.play().catch(e => {
                console.log("[Audio] Autoplay blocked, waiting for next user interaction");
            });
        }
    }
}
window.startBgMusic = startBgMusic;

// Global interaction listener to "unlock" audio on first click/tap/keypress
['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, startBgMusic, { once: true });
});

/* ==========================================================================
   SAFE TOPIC & STATE SNAPSHOT RESOLUTION
   (Bảo đảm tuyệt đối không alert() hoặc crash khi mở popup trên LMS)
   ========================================================================== */
function decodeStateFromUrlParam(paramStr) {
    if (!paramStr) return null;
    try {
        const decodedParam = decodeURIComponent(paramStr);
        try {
            if (typeof TextDecoder !== 'undefined') {
                const binary = atob(decodedParam);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const json = new TextDecoder().decode(bytes);
                return JSON.parse(json);
            } else {
                return JSON.parse(decodeURIComponent(escape(atob(decodedParam))));
            }
        } catch (e1) {}
        return JSON.parse(decodedParam);
    } catch (e) {
        try {
            const doubleDecoded = decodeURIComponent(decodeURIComponent(paramStr));
            return JSON.parse(doubleDecoded);
        } catch (e2) {
            return null;
        }
    }
}

function getInitialStateForChild() {
    // 1. Try URL search query parameter (?state=...)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const stateParam = urlParams.get('state');
        if (stateParam) {
            const state = decodeStateFromUrlParam(stateParam);
            if (state) return state;
        }
    } catch (e) {}

    // 2. Try URL hash fragment (#state=...)
    try {
        if (window.location.hash) {
            const rawHash = window.location.hash.substring(1);
            if (rawHash.startsWith('state=')) {
                const state = decodeStateFromUrlParam(rawHash.substring(6));
                if (state) return state;
            }
        }
    } catch (e) {}

    return null;
}

function determineInitialTopic() {
    const params = new URLSearchParams(window.location.search);
    let t = params.get('topic');
    if (t) return t;

    // Try hash #state=
    try {
        if (window.location.hash && window.location.hash.startsWith('#state=')) {
            const decoded = decodeStateFromUrlParam(window.location.hash.substring(7));
            if (decoded && (decoded.topicParam || decoded.topicName)) {
                return decoded.topicParam || decoded.topicName;
            }
        }
    } catch (e) {}

    // Try storage
    try {
        const raw = storage.getItem('hsk1_synced_state') || storage.getItem('hsk1_game_sync_state');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.topicParam || parsed.topicName)) {
                return parsed.topicParam || parsed.topicName;
            }
        }
    } catch (e) {}

    // Fallback: first topic from vocabulary_data.js
    if (typeof hsk1Vocab !== 'undefined' && Array.isArray(hsk1Vocab) && hsk1Vocab.length > 0) {
        return hsk1Vocab[0].topic;
    }
    return "1. Chào hỏi & Làm quen";
}

function resolveTopicName(topicParam) {
    if (typeof hsk1Vocab === 'undefined' || !Array.isArray(hsk1Vocab)) {
        return "1. Chào hỏi & Làm quen";
    }

    const topicsList = [...new Set(hsk1Vocab.map(item => item.topic))].filter(topic => {
        const count = hsk1Vocab.filter(i => i.topic === topic).length;
        return count >= 9;
    }).sort((a, b) => {
        const numA = parseInt(a.split('.')[0]);
        const numB = parseInt(b.split('.')[0]);
        if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
        }
        return a.localeCompare(b);
    });

    if (!topicParam) {
        return topicsList[0] || "1. Chào hỏi & Làm quen";
    }

    if (topicParam.startsWith('chude')) {
        let found = topicsList.find((t, idx) => {
            const tNumMatch = t.match(/^(\d+)/);
            const tNum = tNumMatch ? tNumMatch[1] : (idx + 1);
            let tId = `chude${tNum}`;
            if (t.includes('(Phần 1)')) tId += '_phan1';
            else if (t.includes('(Phần 2)')) tId += '_phan2';
            else if (t.includes('(Phần 3)')) tId += '_phan3';
            return tId === topicParam;
        });
        if (!found) {
            const index = parseInt(topicParam.replace('chude', '')) - 1;
            found = topicsList[index];
        }
        return found || topicsList[0] || "1. Chào hỏi & Làm quen";
    }

    const decoded = decodeURIComponent(topicParam);
    const match = topicsList.find(t => t === decoded || t.includes(decoded));
    return match || decoded || topicsList[0] || "1. Chào hỏi & Làm quen";
}

/* ==========================================================================
   GAME LOGIC & BOARD IMPLEMENTATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const rawTopicParam = determineInitialTopic();
    const topicName = resolveTopicName(rawTopicParam);
    const topicParam = rawTopicParam;

    let questions = [];
    if (typeof generateQuestionsForTopic === 'function') {
        questions = generateQuestionsForTopic(topicName);
    }
    if (!questions || questions.length === 0) {
        // Safe fallback to first available topic questions
        if (typeof hsk1Vocab !== 'undefined' && hsk1Vocab.length > 0) {
            const firstTopic = hsk1Vocab[0].topic;
            questions = generateQuestionsForTopic(firstTopic);
        }
    }
    if (!questions || questions.length === 0) {
        questions = [
            { q: "Từ '好' có nghĩa là gì?", a: ["tốt, đẹp", "xấu", "lớn", "nhỏ"], correct: 0, word: "好", pinyin: "hǎo", meaning: "tốt, đẹp" }
        ];
    }

    // ==========================================
    // GAME CONSTANTS & STATE
    // (Preserve exact original rules & mechanics)
    // ==========================================
    const GRID_COLS = 7;
    const GRID_ROWS = 5;
    const TOTAL_TILES = GRID_COLS * GRID_ROWS; // 35 tiles (0 to 34)

    let thiefPos = 0;
    let policePos = 34;

    let currentTurn = 'thief';
    let diceValue = 0;
    let stepsRemaining = 0;
    let isMoving = false;
    let canRoll = true;
    let gameOver = false;
    const MAX_TURNS = 10;
    let thiefTurnCount = 1;
    let policeTurnCount = 0;

    let currentQuestionIdx = 0;
    let recentQuestions = [];
    let timer = null;

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const boardContainer = document.getElementById('boardContainer');
    const boardWrapper = document.getElementById('boardWrapper');
    const boardGrid = document.getElementById('boardGrid');
    const thiefChar = document.getElementById('thiefChar');
    const policeChar = document.getElementById('policeChar');
    const rollBtn = document.getElementById('rollBtn');
    const diceContainer = document.getElementById('diceContainer');
    const diceFace = document.getElementById('diceFace');
    const turnBadge = document.getElementById('turnBadge');
    const questionOverlay = document.getElementById('questionOverlay');
    const qText = document.getElementById('qText');
    const qOptions = document.getElementById('qOptions');
    const qTimerBar = document.getElementById('qTimerBar');
    const resultModal = document.getElementById('resultModal');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const thiefProgress = document.getElementById('thiefProgress');
    const policeProgress = document.getElementById('policeProgress');
    const thiefTileNum = document.getElementById('thiefTileNum');
    const policeTileNum = document.getElementById('policeTileNum');
    const gameStatusBox = document.getElementById('gameStatusBox');
    const movingInfoBox = document.getElementById('movingInfoBox');
    const movingStepsText = document.getElementById('movingStepsText');
    const thiefStatCard = document.getElementById('thiefStatCard');
    const policeStatCard = document.getElementById('policeStatCard');

    // ==========================================
    // INITIALIZE BOARD
    // ==========================================
    function initBoard() {
        if (!boardGrid) return;
        boardGrid.querySelectorAll('.tile').forEach(t => t.remove());

        for (let i = 0; i < TOTAL_TILES; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}`;

            if (i === 0) tile.classList.add('tile-start');
            if (i === 34) tile.classList.add('tile-target');

            const q = questions[i % questions.length];
            const word = q.word || (q.vocab ? q.vocab.split(' ')[0] : '字');
            const pinyin = q.pinyin || '';
            const meaning = q.meaning || '';

            tile.dataset.index = i;
            tile.dataset.word = word;
            tile.dataset.pinyin = pinyin;
            tile.dataset.meaning = meaning;

            tile.onclick = () => handleTileClick(i);

            const coord = getCoord(i);
            tile.style.gridRow = coord.r + 1;
            tile.style.gridColumn = coord.c + 1;

            let charClass = 'tile-char';
            if (word.length >= 3) {
                charClass += ' char-long';
            } else if (word.length === 2) {
                charClass += ' char-medium';
            }

            tile.innerHTML = `
                <div class="${charClass}">${word}</div>
                <div class="tile-index">${i}</div>
            `;
            boardGrid.appendChild(tile);
        }
        updatePositions();
    }

    function getCoord(index) {
        return {
            r: Math.floor(index / GRID_COLS),
            c: index % GRID_COLS
        };
    }

    function getIndex(r, c) {
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return -1;
        return r * GRID_COLS + c;
    }

    function updatePositions() {
        const tCoord = getCoord(thiefPos);
        const pCoord = getCoord(policePos);

        if (thiefChar) {
            thiefChar.style.gridRow = tCoord.r + 1;
            thiefChar.style.gridColumn = tCoord.c + 1;
        }
        if (policeChar) {
            policeChar.style.gridRow = pCoord.r + 1;
            policeChar.style.gridColumn = pCoord.c + 1;
        }

        if (thiefProgress) thiefProgress.style.width = `${(thiefPos / 34) * 100}%`;
        if (policeProgress) policeProgress.style.width = `${((34 - policePos) / 34) * 100}%`;

        if (thiefTileNum) thiefTileNum.textContent = `Ô ${thiefPos}`;
        if (policeTileNum) policeTileNum.textContent = `Ô ${policePos}`;
    }

    function updateStatusBox(msg) {
        if (gameStatusBox) {
            gameStatusBox.textContent = msg;
        }
    }

    function playStepSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
    }

    // ==========================================
    // AUTO-FIT ENGINE
    // ==========================================
    function fitGameToContainer() {
        if (!boardContainer || !boardWrapper || !boardGrid) return;

        const containerW = boardContainer.clientWidth;
        const containerH = boardContainer.clientHeight;
        const boardW = boardGrid.offsetWidth || 560;
        const boardH = boardGrid.offsetHeight || 420;

        if (containerW > 50 && containerH > 50 && boardW > 50 && boardH > 50) {
            const padX = 16;
            const padY = 16;
            const scaleX = (containerW - padX) / boardW;
            const scaleY = (containerH - padY) / boardH;

            let fitScale = Math.min(scaleX, scaleY);
            fitScale = Math.min(1.35, Math.max(0.3, fitScale));
            fitScale = Math.round(fitScale * 100) / 100;

            boardWrapper.style.transform = `scale(${fitScale})`;
        }
    }
    window.fitGameToContainer = fitGameToContainer;

    if (window.ResizeObserver && boardContainer) {
        const ro = new ResizeObserver(() => fitGameToContainer());
        ro.observe(boardContainer);
        const layoutEl = document.querySelector('.game-layout');
        if (layoutEl) ro.observe(layoutEl);
    }
    window.addEventListener('resize', () => {
        fitGameToContainer();
        updatePositions();
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            fitGameToContainer();
            updatePositions();
        }, 150);
    });

    setTimeout(fitGameToContainer, 50);
    setTimeout(fitGameToContainer, 200);
    setTimeout(fitGameToContainer, 600);

    // Keyboard shortcuts (Space to roll dice)
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key === ' ' && canRoll && !isMoving && !gameOver && stepsRemaining === 0) {
            e.preventDefault();
            rollDice();
        }
    });

    // ==========================================
    // VOCABULARY DETAIL MODAL
    // ==========================================
    window.showVocabModal = function (index) {
        if (stepsRemaining > 0) return;
        const tile = document.getElementById(`tile-${index}`);
        if (!tile) return;

        const vocabModal = document.getElementById('vocabModal');
        const vocabTileBadge = document.getElementById('vocabTileBadge');
        const vocabCharLarge = document.getElementById('vocabCharLarge');
        const vocabPinyinLarge = document.getElementById('vocabPinyinLarge');
        const vocabMeaningLarge = document.getElementById('vocabMeaningLarge');

        if (vocabTileBadge) vocabTileBadge.textContent = `Ô số ${index} / 34`;
        if (vocabCharLarge) vocabCharLarge.textContent = tile.dataset.word;
        if (vocabPinyinLarge) vocabPinyinLarge.textContent = tile.dataset.pinyin;
        if (vocabMeaningLarge) vocabMeaningLarge.textContent = tile.dataset.meaning;

        if (vocabModal) vocabModal.style.display = 'flex';
    };

    window.closeVocabModal = function (e) {
        if (e && e.target && e.target.id !== 'vocabModal' && !e.target.classList.contains('vocab-close-btn')) {
            return;
        }
        const vocabModal = document.getElementById('vocabModal');
        if (vocabModal) vocabModal.style.display = 'none';
    };

    // ==========================================
    // DICE LOGIC
    // ==========================================
    const dotPositions = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    function renderDice(val) {
        if (!diceFace) return;
        diceFace.innerHTML = '';
        const positions = dotPositions[val] || [];
        for (let i = 0; i < 9; i++) {
            const dot = document.createElement('div');
            if (positions.includes(i)) {
                dot.className = 'dot';
            }
            diceFace.appendChild(dot);
        }
    }
    renderDice(1);

    function rollDice() {
        if (!canRoll || isMoving || gameOver || stepsRemaining > 0) return;
        canRoll = false;

        if (diceFace) diceFace.classList.add('rolling');
        if (rollBtn) {
            rollBtn.disabled = true;
            rollBtn.classList.remove('ready-pulse');
        }

        updateStatusBox(`${currentTurn === 'thief' ? 'TRỘM' : 'CẢNH SÁT'} đang đổ xúc xắc...`);
        broadcastGameState();

        const diceSfx = document.getElementById('diceSfx');
        if (diceSfx) {
            diceSfx.currentTime = 0;
            diceSfx.play().catch(e => console.log("Sound blocked"));
        }

        let rollInterval = setInterval(() => {
            const tempVal = Math.floor(Math.random() * 4) + 1;
            renderDice(tempVal);
        }, 90);

        setTimeout(() => {
            clearInterval(rollInterval);
            diceValue = Math.floor(Math.random() * 4) + 1;
            renderDice(diceValue);
            if (diceFace) diceFace.classList.remove('rolling');

            updateStatusBox(`Đổ được ${diceValue} điểm! Trả lời đúng để được di chuyển.`);
            showQuestion();
        }, 1600);
    }
    if (rollBtn) rollBtn.onclick = rollDice;

    // ==========================================
    // QUESTION LOGIC
    // ==========================================
    function showQuestion() {
        let maxAttempts = 50;
        let limit = Math.min(4, Math.floor(questions.length / 2) || 1);
        do {
            currentQuestionIdx = Math.floor(Math.random() * questions.length);
            maxAttempts--;
        } while (recentQuestions.includes(currentQuestionIdx) && maxAttempts > 0);

        recentQuestions.push(currentQuestionIdx);
        if (recentQuestions.length > limit) {
            recentQuestions.shift();
        }

        const q = questions[currentQuestionIdx];
        if (qText) qText.textContent = q.q;
        if (qOptions) {
            qOptions.innerHTML = '';
            q.a.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt.toLowerCase();
                btn.onclick = () => handleAnswer(idx, q.correct);
                qOptions.appendChild(btn);
            });
        }
        const tileNameSpan = document.getElementById('tileName');
        if (tileNameSpan) {
            tileNameSpan.textContent = `Xác nhận di chuyển (${currentTurn === 'thief' ? 'Kẻ Trộm' : 'Cảnh Sát'})`;
        }

        if (questionOverlay) questionOverlay.style.display = 'flex';
        startTimer();
        broadcastGameState();
    }

    function showSyncedQuestion(qData) {
        if (!qData) return;
        if (qText) qText.textContent = qData.q;
        if (qOptions) {
            qOptions.innerHTML = '';
            qData.a.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt.toLowerCase();
                btn.onclick = () => handleAnswer(idx, qData.correct);
                qOptions.appendChild(btn);
            });
        }
        const tileNameSpan = document.getElementById('tileName');
        if (tileNameSpan) {
            tileNameSpan.textContent = `Xác nhận di chuyển (${currentTurn === 'thief' ? 'Kẻ Trộm' : 'Cảnh Sát'})`;
        }

        if (questionOverlay && questionOverlay.style.display !== 'flex') {
            questionOverlay.style.display = 'flex';
            startTimer();
        }
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        let timeLeft = 100;
        if (qTimerBar) qTimerBar.style.width = '100%';

        timer = setInterval(() => {
            timeLeft -= 1;
            if (qTimerBar) qTimerBar.style.width = `${timeLeft}%`;

            if (timeLeft <= 0) {
                clearInterval(timer);
                const currentQ = questions[currentQuestionIdx];
                handleAnswer(-1, currentQ.correct);
            }
        }, 100);
    }

    function handleAnswer(selected, correct) {
        if (timer) clearInterval(timer);
        if (qOptions) {
            const btns = qOptions.querySelectorAll('.option-btn');
            btns.forEach((btn, idx) => {
                btn.disabled = true;
                if (idx === correct) btn.classList.add('correct');
                if (idx === selected && selected !== correct) btn.classList.add('incorrect');
            });
        }

        const isCorrect = (selected === correct);

        setTimeout(() => {
            if (questionOverlay) questionOverlay.style.display = 'none';

            if (isCorrect) {
                stepsRemaining = diceValue;
                if (movingInfoBox) {
                    movingInfoBox.style.display = 'flex';
                    if (movingStepsText) movingStepsText.textContent = `Còn ${stepsRemaining} bước đi`;
                }
                updateStatusBox(`Chính xác! Nhấp vào các ô phát sáng trên bàn cờ để di chuyển (còn ${stepsRemaining} bước).`);
                highlightPossibleMoves();
                broadcastGameState();
            } else {
                stepsRemaining = 0;
                if (movingInfoBox) movingInfoBox.style.display = 'none';
                updateStatusBox(`Trả lời sai! Mất lượt di chuyển.`);

                if (currentTurn === 'police' && policeTurnCount >= MAX_TURNS) {
                    endGame('TRỘM THẮNG (HẾT LƯỢT)!', 'Cảnh sát trả lời sai ở lượt cuối và không bắt được trộm!', 'win');
                } else {
                    switchTurn();
                }
            }
        }, 1200);
    }

    // ==========================================
    // MANUAL TILE MOVEMENT
    // ==========================================
    function highlightPossibleMoves() {
        const currentPos = currentTurn === 'thief' ? thiefPos : policePos;
        const coord = getCoord(currentPos);

        document.querySelectorAll('.tile').forEach(t => t.classList.remove('reachable'));

        if (stepsRemaining > 0) {
            const neighbors = [
                getIndex(coord.r - 1, coord.c),
                getIndex(coord.r + 1, coord.c),
                getIndex(coord.r, coord.c - 1),
                getIndex(coord.r, coord.c + 1)
            ];

            neighbors.forEach(idx => {
                if (idx !== -1) {
                    const el = document.getElementById(`tile-${idx}`);
                    if (el) el.classList.add('reachable');
                }
            });
        }
    }

    function handleTileClick(index) {
        if (stepsRemaining > 0) {
            const tile = document.getElementById(`tile-${index}`);
            if (!tile || !tile.classList.contains('reachable')) return;

            if (currentTurn === 'thief') {
                thiefPos = index;
            } else {
                policePos = index;
            }

            stepsRemaining--;
            updatePositions();
            playStepSound();

            if (policePos === thiefPos) {
                clearHighlightsAndEndMove();
                endGame('CẢNH SÁT ĐÃ BẮT ĐƯỢC TRỘM!', 'Cảnh sát đã đuổi kịp và bắt được kẻ trộm!', 'lose');
                return;
            } else if (currentTurn === 'thief' && thiefPos === 34) {
                clearHighlightsAndEndMove();
                endGame('TRỘM ĐÃ TRỐN THOÁT!', 'Kẻ trộm đã về đích an toàn và tẩu thoát!', 'win');
                return;
            }

            if (stepsRemaining > 0) {
                if (movingStepsText) movingStepsText.textContent = `Còn ${stepsRemaining} bước đi`;
                updateStatusBox(`Còn ${stepsRemaining} bước! Hãy chọn ô tiếp theo trên bàn cờ.`);
                highlightPossibleMoves();
                broadcastGameState();
            } else {
                clearHighlightsAndEndMove();
                checkWinCondition();
                if (!gameOver) switchTurn();
            }
        } else {
            showVocabModal(index);
        }
    }

    function clearHighlightsAndEndMove() {
        document.querySelectorAll('.tile').forEach(t => t.classList.remove('reachable'));
        if (movingInfoBox) movingInfoBox.style.display = 'none';
    }

    window.finishMoveEarly = function () {
        if (stepsRemaining > 0) {
            stepsRemaining = 0;
            clearHighlightsAndEndMove();
            checkWinCondition();
            if (!gameOver) switchTurn();
        }
    };

    // ==========================================
    // SWITCH TURN & UI UPDATES
    // ==========================================
    function switchTurn() {
        if (currentTurn === 'thief') {
            currentTurn = 'police';
            policeTurnCount++;
        } else {
            currentTurn = 'thief';
            thiefTurnCount++;
        }

        updateTurnUI();

        canRoll = true;
        stepsRemaining = 0;
        if (rollBtn) {
            rollBtn.disabled = false;
            rollBtn.classList.add('ready-pulse');
        }

        updateStatusBox(`Đến lượt của ${currentTurn === 'thief' ? 'KẺ TRỘM' : 'CẢNH SÁT'}! Bấm "ĐỔ XÚC XẮC".`);
        broadcastGameState();
    }

    function updateTurnUI() {
        const displayCount = currentTurn === 'thief' ? thiefTurnCount : policeTurnCount;
        if (turnBadge) {
            turnBadge.textContent = `Lượt của ${currentTurn === 'thief' ? 'TRỘM' : 'CẢNH SÁT'} (${displayCount}/${MAX_TURNS})`;
            turnBadge.className = `turn-badge ${currentTurn}-turn`;
        }

        if (thiefStatCard && policeStatCard) {
            thiefStatCard.classList.toggle('active-turn', currentTurn === 'thief');
            policeStatCard.classList.toggle('active-turn', currentTurn === 'police');
        }
    }

    function checkWinCondition() {
        if (policePos === thiefPos) {
            endGame('CẢNH SÁT ĐÃ BẮT ĐƯỢC TRỘM!', 'Cảnh sát đã đuổi kịp và bắt được kẻ trộm!', 'lose');
        } else if (thiefPos === 34) {
            endGame('TRỘM ĐÃ TRỐN THOÁT!', 'Kẻ trộm đã về đích an toàn và tẩu thoát!', 'win');
        } else if (policeTurnCount >= MAX_TURNS && currentTurn === 'police' && stepsRemaining === 0) {
            endGame('TRỘM THẮNG (HẾT LƯỢT)!', 'Cảnh sát không bắt được trộm sau 10 lượt!', 'win');
        }
    }

    // ==========================================
    // END GAME & RESET MATCH
    // ==========================================
    function endGame(title, msg, type) {
        gameOver = true;
        canRoll = false;
        stepsRemaining = 0;
        clearHighlightsAndEndMove();
        if (rollBtn) {
            rollBtn.disabled = true;
            rollBtn.classList.remove('ready-pulse');
        }

        if (resultTitle) resultTitle.textContent = title;
        if (resultMessage) resultMessage.textContent = msg;

        if (type === 'win') {
            const winSfx = document.getElementById('winSfx');
            if (winSfx) winSfx.play().catch(() => {});
        } else if (type === 'lose') {
            const loseSfx = document.getElementById('loseSfx');
            if (loseSfx) loseSfx.play().catch(() => {});
        }

        const reviewBody = document.getElementById('reviewBody');
        if (reviewBody) {
            reviewBody.innerHTML = '';
            questions.forEach((q) => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

                const word = q.word || (q.vocab ? q.vocab.split(' ')[0] : '');
                const pinyin = q.pinyin || '';
                const meaning = q.meaning || '';

                row.innerHTML = `
                    <td style="padding: 10px; text-align: left; font-weight: bold; color: var(--accent); font-family: var(--font-chinese); font-size: 1.25rem;">${word}</td>
                    <td style="padding: 10px; text-align: left; opacity: 0.85;">${pinyin}</td>
                    <td style="padding: 10px; text-align: left; font-size: 0.85rem; opacity: 0.9;">${meaning}</td>
                `;
                reviewBody.appendChild(row);
            });
        }

        if (resultModal && !(!isChildWindow && window.isWaitingForChild)) {
            resultModal.style.display = 'flex';
        }
        broadcastGameState();

        if (window.LMSAdapter) {
            const isWin = (type === 'win');
            const winnerName = isWin ? 'Kẻ Trộm' : 'Cảnh Sát';
            const score = isWin ? 100 : 75;
            window.LMSAdapter.reportComplete(
                { name: winnerName, score: score },
                { thiefPos, policePos, thiefTurnCount, policeTurnCount },
                score
            );
        }
    }

    window.resetGameMatch = function () {
        thiefPos = 0;
        policePos = 34;
        currentTurn = 'thief';
        thiefTurnCount = 1;
        policeTurnCount = 0;
        gameOver = false;
        isMoving = false;
        stepsRemaining = 0;
        canRoll = true;

        clearHighlightsAndEndMove();
        if (resultModal) resultModal.style.display = 'none';

        updatePositions();
        updateTurnUI();
        renderDice(1);

        if (rollBtn) {
            rollBtn.disabled = false;
            rollBtn.classList.add('ready-pulse');
        }

        updateStatusBox('Ván mới đã bắt đầu! Bấm "ĐỔ XÚC XẮC" để chơi.');
        broadcastGameState();
    };

    window.openInstructions = function () {
        const modal = document.getElementById('instructionModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeInstructions = function () {
        const modal = document.getElementById('instructionModal');
        if (modal) modal.style.display = 'none';
    };

    /* ==========================================================================
       REAL-TIME TWO-WAY STATE SYNCHRONIZATION ENGINE
       Chuẩn hoá dựa trên nền tảng ổn định của HSK 4
       ========================================================================== */

    /**
     * Export complete current game state snapshot
     */
    function exportGameState() {
        const bgMusic = document.getElementById('bgMusic');
        const curAudioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? Number(bgMusic.currentTime.toFixed(2)) : 0;
        const isQuestionActive = Boolean(questionOverlay && questionOverlay.style.display === 'flex');

        let questionSnapshot = null;
        if (isQuestionActive && questions[currentQuestionIdx]) {
            const q = questions[currentQuestionIdx];
            questionSnapshot = {
                idx: currentQuestionIdx,
                q: q.q,
                a: q.a,
                correct: q.correct,
                word: q.word || q.vocab,
                pinyin: q.pinyin,
                meaning: q.meaning
            };
        }

        return {
            topicParam: topicParam,
            topicName: topicName,
            thiefPos: thiefPos,
            policePos: policePos,
            currentTurn: currentTurn,
            diceValue: diceValue,
            stepsRemaining: stepsRemaining,
            canRoll: canRoll,
            isMoving: isMoving,
            gameOver: gameOver,
            thiefTurnCount: thiefTurnCount,
            policeTurnCount: policeTurnCount,
            statusMessage: gameStatusBox ? gameStatusBox.textContent : '',
            isQuestionActive: isQuestionActive,
            currentQuestion: questionSnapshot,
            gameOverTitle: resultTitle ? resultTitle.textContent : '',
            gameOverMsg: resultMessage ? resultMessage.textContent : '',
            isMuted: isMuted,
            audioCurrentTime: curAudioTime,
            timestamp: Date.now()
        };
    }

    /**
     * Restore game state from state snapshot
     */
    function importGameState(state, shouldBroadcast = false) {
        if (!state) return;
        isApplyingSync = true;
        try {
            // 1. Audio Mute & Seek Synchronization
            if (typeof state.isMuted === 'boolean') {
                isMuted = state.isMuted;
                updateSoundToggleUI();
                const bgMusic = document.getElementById('bgMusic');
                if (bgMusic) {
                    bgMusic.muted = isMuted;
                    if (isMuted) {
                        try { bgMusic.pause(); } catch (e) {}
                    }
                }
            }

            const bgMusic = document.getElementById('bgMusic');
            if (isFinite(state.audioCurrentTime) && bgMusic) {
                try {
                    if (bgMusic.duration && state.audioCurrentTime >= bgMusic.duration) {
                        bgMusic.currentTime = state.audioCurrentTime % bgMusic.duration;
                    } else {
                        bgMusic.currentTime = state.audioCurrentTime;
                    }
                } catch (e) {}
            }

            if (!isMuted && !state.gameOver) {
                if (!(!isChildWindow && window.isWaitingForChild)) {
                    startBgMusic();
                }
            }

            // 2. Positions, Turns, Dice & Rules
            if (typeof state.thiefPos === 'number') thiefPos = state.thiefPos;
            if (typeof state.policePos === 'number') policePos = state.policePos;
            if (state.currentTurn) currentTurn = state.currentTurn;
            if (typeof state.thiefTurnCount === 'number') thiefTurnCount = state.thiefTurnCount;
            if (typeof state.policeTurnCount === 'number') policeTurnCount = state.policeTurnCount;
            if (typeof state.diceValue === 'number') diceValue = state.diceValue;
            if (typeof state.stepsRemaining === 'number') stepsRemaining = state.stepsRemaining;
            if (typeof state.canRoll === 'boolean') canRoll = state.canRoll;
            if (typeof state.isMoving === 'boolean') isMoving = state.isMoving;
            if (typeof state.gameOver === 'boolean') gameOver = state.gameOver;

            updatePositions();
            updateTurnUI();
            renderDice(diceValue || 1);

            if (state.statusMessage) {
                updateStatusBox(state.statusMessage);
            }

            // 3. Movement info & reachability
            if (stepsRemaining > 0) {
                if (movingInfoBox) {
                    movingInfoBox.style.display = 'flex';
                    if (movingStepsText) movingStepsText.textContent = `Còn ${stepsRemaining} bước đi`;
                }
                if (rollBtn) {
                    rollBtn.disabled = true;
                    rollBtn.classList.remove('ready-pulse');
                }
                highlightPossibleMoves();
            } else {
                clearHighlightsAndEndMove();
                if (rollBtn) {
                    rollBtn.disabled = !canRoll || gameOver;
                    if (canRoll && !gameOver) {
                        rollBtn.classList.add('ready-pulse');
                    } else {
                        rollBtn.classList.remove('ready-pulse');
                    }
                }
            }

            // 4. Question overlay
            if (state.isQuestionActive && !gameOver) {
                if (!(!isChildWindow && window.isWaitingForChild)) {
                    if (state.currentQuestion) {
                        showSyncedQuestion(state.currentQuestion);
                    }
                }
            } else {
                if (questionOverlay) questionOverlay.style.display = 'none';
                if (timer) clearInterval(timer);
            }

            // 5. Game Over Modal
            if (gameOver) {
                if (resultTitle) resultTitle.textContent = state.gameOverTitle || 'KẾT THÚC TRÒ CHƠI';
                if (resultMessage) resultMessage.textContent = state.gameOverMsg || '';
                if (resultModal && !(!isChildWindow && window.isWaitingForChild)) {
                    resultModal.style.display = 'flex';
                }
            } else {
                if (resultModal) resultModal.style.display = 'none';
            }

            const isGameStarted = (thiefPos !== 0 || policePos !== 34 || thiefTurnCount > 1 || policeTurnCount > 0 || stepsRemaining > 0 || !canRoll || gameOver);
            if (isGameStarted) {
                const instructionModal = document.getElementById('instructionModal');
                if (instructionModal) instructionModal.style.display = 'none';
            }

            updateSyncOverlayInfo(state);
        } finally {
            isApplyingSync = false;
        }

        if (shouldBroadcast) broadcastGameState();
    }

    /**
     * Broadcast current game state across all active channels
     */
    function broadcastGameState(extraProps = null, isClosing = false) {
        const state = exportGameState();
        if (extraProps) {
            Object.assign(state, extraProps);
        }
        if (isClosing) {
            state.isPopoutClosing = true;
        }
        window.__HSK1_LATEST_STATE__ = state;
        latestSyncedState = state;

        const stateStr = JSON.stringify(state);
        try {
            storage.setItem('hsk1_synced_state', stateStr);
            storage.setItem('hsk1_game_sync_state', stateStr);
            if (isClosing) {
                storage.setItem('hsk1_popout_closed', Date.now().toString());
            }
        } catch (e) {}

        const msgType = isClosing ? 'HSK1_POPOUT_CLOSED' : 'HSK1_STATE_SYNC';
        const msg = { type: msgType, state: state };

        if (gameSyncChannel) {
            try { gameSyncChannel.postMessage(msg); } catch (e) {}
        }
        if (isChildWindow && window.opener && window.opener !== window && !window.opener.closed) {
            try { window.opener.postMessage(msg, '*'); } catch (e) {}
        }
        if (childGameWindow && !childGameWindow.closed) {
            try { childGameWindow.postMessage(msg, '*'); } catch (e) {}
        }
        updateSyncOverlayInfo(state);
    }

    /**
     * Check and Apply Latest State in Parent Window (invoked on focus, tab switch, & 600ms poll)
     */
    function checkAndApplyLatestState() {
        if (isChildWindow) return;
        if (!window.isWaitingForChild && !childGameWindow) return;

        let stateToApply = null;
        try {
            const raw = storage.getItem('hsk1_synced_state') || storage.getItem('hsk1_game_sync_state');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (!latestSyncedState || (parsed.timestamp && parsed.timestamp >= (latestSyncedState.timestamp || 0)))) {
                    stateToApply = parsed;
                }
            }
        } catch (e) {}

        if (!stateToApply) stateToApply = latestSyncedState || window.__HSK1_LATEST_STATE__;

        if (stateToApply) {
            latestSyncedState = stateToApply;
            window.__HSK1_LATEST_STATE__ = stateToApply;
            importGameState(stateToApply, false);
            updateSyncOverlayInfo(stateToApply);
        }

        let isClosed = false;
        try {
            if (childGameWindow) isClosed = childGameWindow.closed;
        } catch (e) {
            isClosed = false;
        }

        let popoutClosedFlag = false;
        try {
            const popoutClosedTime = storage.getItem('hsk1_popout_closed');
            if (popoutClosedTime && Date.now() - Number(popoutClosedTime) < 15000) {
                popoutClosedFlag = true;
            }
        } catch (e) {}

        // Tự động khôi phục nếu child đã đóng, hoặc flag đóng được ghi nhận, hoặc mất heartbeat quá 2.5s (chuẩn HSK 4)
        const noHeartbeat = (Date.now() - lastChildMessageTime > 2500);
        if (isClosed || popoutClosedFlag || noHeartbeat) {
            resumeInThisWindow(false);
            return;
        }

        if (window.isWaitingForChild) {
            const syncModal = document.getElementById('sync-active-modal');
            if (syncModal) {
                syncModal.classList.add('show');
                syncModal.style.display = 'flex';
            }
        }
    }

    /**
     * Update real-time sync overlay information on parent LMS modal
     */
    function updateSyncOverlayInfo(state) {
        if (!state) return;
        const topicEl = document.getElementById('syncOverlayTopic') || document.querySelector('[data-id="sync-overlay-topic"]');
        const turnEl = document.getElementById('syncOverlayTurn') || document.querySelector('[data-id="sync-overlay-turn"]');
        const posEl = document.getElementById('syncOverlayPos') || document.querySelector('[data-id="sync-overlay-pos"]');

        if (topicEl) topicEl.textContent = state.topicName || topicName || "HSK 1";
        if (turnEl) {
            const turnName = state.currentTurn === 'thief' ? 'Kẻ Trộm' : 'Cảnh Sát';
            const turnCount = state.currentTurn === 'thief' ? (state.thiefTurnCount || 1) : (state.policeTurnCount || 0);
            turnEl.textContent = `${turnName} (${turnCount}/10)`;
        }
        if (posEl) {
            const tPos = typeof state.thiefPos === 'number' ? state.thiefPos : 0;
            const pPos = typeof state.policePos === 'number' ? state.policePos : 34;
            posEl.textContent = `Trộm: Ô ${tPos} | Sát: Ô ${pPos}`;
        }
    }

    /**
     * Handle incoming sync messages across BroadcastChannel and postMessage
     */
    function handleIncomingSyncMessage(data) {
        if (!data) return;
        const type = data.type || data.action;
        const state = data.state;

        // Fast-path: Audio mute synchronization between windows
        if (type === 'HSK1_AUDIO_SYNC') {
            if (typeof data.isMuted === 'boolean') {
                isMuted = data.isMuted;
                updateSoundToggleUI();
                const bgMusic = document.getElementById('bgMusic');
                if (bgMusic) {
                    bgMusic.muted = isMuted;
                    if (isMuted) {
                        try { bgMusic.pause(); } catch (e) {}
                    } else if (!isMuted && !isChildWindow && (childGameWindow && !childGameWindow.closed)) {
                        // Keep parent paused while child is active
                        try { bgMusic.pause(); } catch (e) {}
                    } else {
                        if (isFinite(data.audioCurrentTime)) {
                            try {
                                if (bgMusic.duration && data.audioCurrentTime >= bgMusic.duration) {
                                    bgMusic.currentTime = data.audioCurrentTime % bgMusic.duration;
                                } else {
                                    bgMusic.currentTime = data.audioCurrentTime;
                                }
                            } catch (e) {}
                        }
                        startBgMusic();
                    }
                }
            }
            return;
        }

        // Heartbeat from active child window
        if (type === 'HSK1_HEARTBEAT') {
            lastChildMessageTime = Date.now();
            return;
        }

        // Child is closing or closed
        if (type === 'HSK1_POPOUT_CLOSED' || type === 'HSK1_CHILD_CLOSING' || (state && state.isPopoutClosing)) {
            if (!isChildWindow) {
                if (state) {
                    latestSyncedState = state;
                    window.__HSK1_LATEST_STATE__ = state;
                }
                resumeInThisWindow(false);
            }
            return;
        }

        lastChildMessageTime = Date.now();

        if (!isChildWindow) {
            // Child is ready
            if (type === 'HSK1_CHILD_READY') {
                window.isWaitingForChild = true;
                isWaitingForChild = true;
                lastChildMessageTime = Date.now();

                const bgMusic = document.getElementById('bgMusic');
                if (bgMusic && !bgMusic.paused) {
                    try { bgMusic.pause(); } catch (err) {}
                }

                const syncModal = document.getElementById('sync-active-modal');
                if (syncModal) {
                    syncModal.classList.add('show');
                    syncModal.style.display = 'flex';
                    updateSyncOverlayInfo(exportGameState());
                }

                const currentSnap = exportGameState();
                if (childGameWindow && !childGameWindow.closed) {
                    try { childGameWindow.postMessage({ type: 'HSK1_STATE_SYNC', state: currentSnap }, '*'); } catch (e) {}
                }
                if (gameSyncChannel) {
                    try { gameSyncChannel.postMessage({ type: 'HSK1_STATE_SYNC', state: currentSnap }); } catch (e) {}
                }
                return;
            }

            if (!window.isWaitingForChild && !childGameWindow) {
                return;
            }

            if (state) {
                latestSyncedState = state;
                window.__HSK1_LATEST_STATE__ = state;

                // CRITICAL: Apply incoming state to parent LMS window background in real time!
                importGameState(state, false);

                // Report completion to LMS SCORM in parent window
                if (window.LMSAdapter && window.LMSAdapter.isSCORM && state.gameOver) {
                    const isWin = (state.gameOverTitle && state.gameOverTitle.includes('TRỘM'));
                    const winnerName = isWin ? 'Kẻ Trộm' : 'Cảnh Sát';
                    const score = isWin ? 100 : 75;
                    window.LMSAdapter.reportComplete(
                        { name: winnerName, score: score },
                        { thiefPos: state.thiefPos, policePos: state.policePos },
                        score
                    );
                }

                const syncModal = document.getElementById('sync-active-modal');
                if (syncModal && !state.isPopoutClosing && window.isWaitingForChild) {
                    syncModal.classList.add('show');
                    syncModal.style.display = 'flex';
                    updateSyncOverlayInfo(state);
                }
            }
        } else {
            // Child window
            if ((type === 'HSK1_STATE_SYNC' || type === 'HSK1_SYNC_INIT') && state) {
                importGameState(state, false);
            } else if (type === 'HSK1_PARENT_RESUMED') {
                if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                    window.LMSAdapter.showToast("👉 Đang tiếp tục chơi trên màn hình LMS.");
                }
            }
        }
    }

    /**
     * Open Game in Dedicated Standalone Window with State Handover (Matches HSK 4 Architecture)
     */
    function openGameInNewWindow(e) {
        if (e && e.preventDefault) e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const isPop = params.get('popout') === '1' || params.get('mode') === 'popup';
        if (isPop || isChildWindow) {
            closePopoutAndReturnToLMS();
            return;
        }

        // 1. Snapshot current game state
        let snapshot = null;
        try {
            snapshot = exportGameState();
        } catch (err) {
            console.warn("[Popout] exportGameState fallback:", err);
            snapshot = { topicParam: topicParam, timestamp: Date.now() };
        }
        snapshot.syncSessionId = 'sync_' + Date.now();
        snapshot.isLmsWaiting = true;
        window.__HSK1_LATEST_STATE__ = snapshot;
        latestSyncedState = snapshot;

        // 2. Pause parent audio
        const bgMusic = document.getElementById('bgMusic');
        const curAudioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? Number(bgMusic.currentTime.toFixed(2)) : 0;
        if (bgMusic && !bgMusic.paused) {
            try { bgMusic.pause(); } catch (err) {}
        }

        const stateStr = JSON.stringify(snapshot);
        try {
            storage.setItem('hsk1_synced_state', stateStr);
            storage.setItem('hsk1_game_sync_state', stateStr);
            storage.setItem('hsk1_active_session', snapshot.syncSessionId);
        } catch (err) {}

        if (gameSyncChannel) {
            try {
                gameSyncChannel.postMessage({ type: 'HSK1_SYNC_INIT', state: snapshot });
            } catch (err) {}
        }

        // 3. Clean URL parameters + Hash state handover (100% bypasses LMS iframe storage barriers)
        const targetUrl = new URL(window.location.href);
        targetUrl.searchParams.delete('state');
        targetUrl.hash = '';
        targetUrl.searchParams.set('popout', '1');
        targetUrl.searchParams.set('session', snapshot.syncSessionId);
        if (topicParam) targetUrl.searchParams.set('topic', topicParam);
        targetUrl.searchParams.set('muted', isMuted ? '1' : '0');
        targetUrl.searchParams.set('audioTime', curAudioTime);

        try {
            const b64 = btoa(unescape(encodeURIComponent(stateStr)));
            targetUrl.hash = 'state=' + encodeURIComponent(b64);
        } catch (err) {}

        const scrWidth = (window.screen && window.screen.availWidth) || window.innerWidth || 1280;
        const scrHeight = (window.screen && window.screen.availHeight) || window.innerHeight || 800;
        const w = Math.min(1240, scrWidth - 40);
        const h = Math.min(880, scrHeight - 60);
        const left = Math.max(0, Math.floor((scrWidth - w) / 2));
        const top = Math.max(0, Math.floor((scrHeight - h) / 2));
        const windowFeatures = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;

        // 4. Multi-tier Opening Strategy (Guarantees success across LMS iFrames & Browser popup blockers)
        let child = null;

        // Strategy 1: Standalone Popup Window (Matches HSK 4 preferred UX)
        try {
            child = window.open(targetUrl.toString(), 'HSK1_Standalone_Game', windowFeatures);
        } catch (err) {
            console.warn("[Popout] window.open with features failed/blocked:", err);
        }

        // Strategy 2: Named Window without features
        if (!child || child.closed || typeof child.closed === 'undefined') {
            try {
                child = window.open(targetUrl.toString(), 'HSK1_Standalone_Game');
            } catch (err) {
                console.warn("[Popout] window.open named tab failed:", err);
            }
        }

        // Strategy 3: Standard New Tab (_blank)
        if (!child || child.closed || typeof child.closed === 'undefined') {
            try {
                child = window.open(targetUrl.toString(), '_blank');
            } catch (err) {
                console.warn("[Popout] window.open _blank failed:", err);
            }
        }

        // Strategy 4: Anchor Click Fallback (Bypasses strict iframe sandboxes in modern browsers)
        if (!child || child.closed || typeof child.closed === 'undefined') {
            try {
                const a = document.createElement('a');
                a.href = targetUrl.toString();
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                child = true;
            } catch (err) {
                console.warn("[Popout] Anchor click fallback failed:", err);
            }
        }

        if (child) {
            if (child !== true) {
                childGameWindow = child;
                try { child.focus(); } catch (err) {}
            } else {
                childGameWindow = null;
            }
            window.isWaitingForChild = true;
            isWaitingForChild = true;

            // 5. Show Parent LMS Sync Overlay Modal
            const syncModal = document.getElementById('sync-active-modal');
            if (syncModal) {
                syncModal.classList.add('show');
                syncModal.style.display = 'flex';
                updateSyncOverlayInfo(snapshot);
            }

            if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                window.LMSAdapter.showToast("🚀 Đang chơi tại cửa sổ mới! Màn hình LMS tạm dừng và chờ đồng bộ.");
            }

            // 6. Safe poller with Heartbeat Guard (matches HSK 4)
            if (childCheckInterval) {
                clearInterval(childCheckInterval);
                childCheckInterval = null;
            }

            lastChildMessageTime = Date.now();

            setTimeout(() => {
                if (!window.isWaitingForChild) return;
                childCheckInterval = setInterval(() => {
                    if (!window.isWaitingForChild) {
                        if (childCheckInterval) {
                            clearInterval(childCheckInterval);
                            childCheckInterval = null;
                        }
                        return;
                    }

                    let isClosed = false;
                    try {
                        isClosed = !childGameWindow || childGameWindow.closed;
                    } catch (err) {
                        isClosed = false;
                    }

                    let popoutClosedFlag = false;
                    try {
                        const popoutClosedTime = storage.getItem('hsk1_popout_closed');
                        if (popoutClosedTime && Date.now() - Number(popoutClosedTime) < 15000) {
                            popoutClosedFlag = true;
                        }
                    } catch (e) {}

                    // Tự động khôi phục nếu child đã đóng, hoặc flag đóng ghi nhận, hoặc mất heartbeat quá 2.5s
                    const noHeartbeat = (Date.now() - lastChildMessageTime > 2500);
                    if (isClosed || popoutClosedFlag || noHeartbeat) {
                        if (childCheckInterval) {
                            clearInterval(childCheckInterval);
                            childCheckInterval = null;
                        }
                        childGameWindow = null;
                        resumeInThisWindow(false);
                    }
                }, 600);
            }, 1200);
        } else {
            if (!isMuted && bgMusic) {
                bgMusic.play().catch(() => {});
            }
            if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                window.LMSAdapter.showToast("⚠️ Vui lòng cho phép popup trên trình duyệt của bạn!");
            }
        }
    }

    /**
     * Handle Child Window Closure & Synchronize Back to LMS Parent
     */
    function closePopoutAndReturnToLMS() {
        let finalSnapshot = null;
        try {
            finalSnapshot = exportGameState();
        } catch (e) {
            finalSnapshot = { topicParam: topicParam, timestamp: Date.now() };
        }
        finalSnapshot.timestamp = Date.now();
        finalSnapshot.isPopoutClosing = true;

        const bgMusic = document.getElementById('bgMusic');
        const curAudioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? Number(bgMusic.currentTime.toFixed(2)) : 0;
        broadcastAudioSync(curAudioTime);

        if (bgMusic) {
            try { bgMusic.pause(); } catch (e) {}
        }

        // 1. Direct call to opener if accessible (matches HSK 4)
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.latestSyncedState = finalSnapshot;
                window.opener.__HSK1_LATEST_STATE__ = finalSnapshot;
                if (typeof window.opener.resumeInThisWindow === 'function') {
                    window.opener.resumeInThisWindow(false);
                } else if (typeof window.opener.resumeInLmsWindow === 'function') {
                    window.opener.resumeInLmsWindow(false);
                }
            } catch (e) {
                console.warn("[Popout] Direct opener resume note:", e);
            }
            try {
                window.opener.postMessage({ type: 'HSK1_POPOUT_CLOSED', state: finalSnapshot, timestamp: Date.now() }, '*');
            } catch (e) {}
        }

        // 2. BroadcastChannel
        if (gameSyncChannel) {
            try {
                gameSyncChannel.postMessage({ type: 'HSK1_POPOUT_CLOSED', state: finalSnapshot });
            } catch (e) {}
        }

        // 3. Storage fallback
        try {
            const str = JSON.stringify(finalSnapshot);
            storage.setItem('hsk1_synced_state', str);
            storage.setItem('hsk1_game_sync_state', str);
            storage.setItem('hsk1_popout_closed', Date.now().toString());
        } catch (e) {}

        // 4. Try to focus opener
        if (window.opener && !window.opener.closed) {
            try { window.opener.focus(); } catch (e) {}
        }

        // 5. Close window
        setTimeout(() => {
            try { window.close(); } catch (e) {}
        }, 100);
    }

    /**
     * Resume playing directly in the Parent LMS window (Matches HSK 4 Architecture)
     */
    function resumeInThisWindow(forceCloseChild = false) {
        if (window.LMSAdapter && typeof window.LMSAdapter.playSynthesizedSound === 'function') {
            window.LMSAdapter.playSynthesizedSound('tap');
        }

        window.isWaitingForChild = false;
        isWaitingForChild = false;

        if (childCheckInterval) {
            clearInterval(childCheckInterval);
            childCheckInterval = null;
        }

        if (childGameWindow) {
            try {
                if (!childGameWindow.closed) {
                    if (forceCloseChild) {
                        childGameWindow.postMessage({ type: 'HSK1_PARENT_RESUMED' }, '*');
                        childGameWindow.close();
                    }
                }
            } catch (e) {}
            childGameWindow = null;
        }

        if (gameSyncChannel) {
            try { gameSyncChannel.postMessage({ type: 'HSK1_PARENT_RESUMED' }); } catch (e) {}
        }

        // Hide the sync modal reliably
        const syncModal = document.getElementById('sync-active-modal');
        if (syncModal) {
            syncModal.classList.remove('show', 'active');
            syncModal.style.setProperty('display', 'none', 'important');
        }

        try {
            storage.removeItem('hsk1_popout_closed');
        } catch (e) {}

        let stateToApply = latestSyncedState || window.__HSK1_LATEST_STATE__;
        try {
            const saved = storage.getItem('hsk1_synced_state') || storage.getItem('hsk1_game_sync_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && (!stateToApply || (parsed.timestamp && parsed.timestamp >= (stateToApply.timestamp || 0)))) {
                    stateToApply = parsed;
                }
            }
        } catch (e) {}

        if (stateToApply) {
            latestSyncedState = stateToApply;
            window.__HSK1_LATEST_STATE__ = stateToApply;
            importGameState(stateToApply, false);

            const bgMusic = document.getElementById('bgMusic');
            if (bgMusic) {
                if (isFinite(stateToApply.audioCurrentTime)) {
                    try { bgMusic.currentTime = stateToApply.audioCurrentTime; } catch (e) {}
                }
                if (!isMuted && !stateToApply.gameOver) {
                    startBgMusic();
                }
            }

            if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                if (stateToApply.gameOver) {
                    window.LMSAdapter.showToast("🏆 Đã đồng bộ kết quả từ cửa sổ mới!");
                } else {
                    const turnName = stateToApply.currentTurn === 'thief' ? 'Kẻ Trộm' : 'Cảnh Sát';
                    window.LMSAdapter.showToast(`🎮 Đã đồng bộ tiến trình! Tiếp tục lượt của ${turnName}`);
                }
            }
        } else {
            const bgMusic = document.getElementById('bgMusic');
            if (!isMuted && bgMusic && bgMusic.paused) {
                startBgMusic();
            }
        }
    }

    /**
     * Focus the active Child Window from Parent
     */
    function focusChildWindow() {
        if (window.LMSAdapter && typeof window.LMSAdapter.playSynthesizedSound === 'function') {
            window.LMSAdapter.playSynthesizedSound('tap');
        }
        let isAlive = false;
        if (childGameWindow) {
            try { isAlive = !childGameWindow.closed; } catch (e) { isAlive = false; }
        }
        if (isAlive && (Date.now() - lastChildMessageTime < 3000)) {
            try { childGameWindow.focus(); return; } catch (e) {}
        }
        openGameInNewWindow();
    }

    /**
     * Initialize Real-time Synchronization Engine
     */
    function initSyncEngine() {
        const params = new URLSearchParams(window.location.search);
        isChildWindow = Boolean(
            params.get('popout') === '1' ||
            params.get('mode') === 'popup' ||
            (window.opener && window.opener !== window)
        );
        window.isChildWindow = isChildWindow;

        // 1. Setup UI for child popup window
        const popoutBtn = document.getElementById('openNewWindowBtn') || document.querySelector('[data-role="popout-btn"]');
        if (isChildWindow) {
            document.body.classList.add('is-child-window');
            if (popoutBtn) {
                popoutBtn.title = "Quay về màn hình LMS (Đóng cửa sổ này)";
                popoutBtn.setAttribute('aria-label', "Quay về màn hình LMS");
                popoutBtn.onclick = function (e) {
                    if (e && e.preventDefault) e.preventDefault();
                    closePopoutAndReturnToLMS();
                };
                const iconSpan = popoutBtn.querySelector('.icon') || popoutBtn;
                iconSpan.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                        <polyline points="9 14 4 9 9 4"></polyline>
                        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                    </svg>
                `;
                const textSpan = popoutBtn.querySelector('.btn-text-sm');
                if (textSpan) textSpan.textContent = "Về LMS";
            }

            const handleUnload = () => {
                closePopoutAndReturnToLMS();
            };
            window.addEventListener('beforeunload', handleUnload);
            window.addEventListener('pagehide', handleUnload);
        } else {
            if (popoutBtn) {
                popoutBtn.title = "Mở ở cửa sổ mới (Đồng bộ tiến trình)";
                popoutBtn.setAttribute('aria-label', "Mở ở cửa sổ mới");
                popoutBtn.onclick = function (e) {
                    if (e && e.preventDefault) e.preventDefault();
                    openGameInNewWindow(e);
                };
            }
        }

        // 2. Setup BroadcastChannel (Same-origin instant bus)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                gameSyncChannel = new BroadcastChannel('hsk1_game_sync_bus');
                gameSyncChannel.onmessage = (event) => {
                    if (!event || !event.data) return;
                    handleIncomingSyncMessage(event.data);
                };
            } catch (e) {
                console.warn("[Sync] BroadcastChannel error:", e);
            }
        }
        window.gameSyncChannel = gameSyncChannel;

        // 3. Setup postMessage Listener (Cross-window & LMS iFrame bridge)
        window.addEventListener('message', (event) => {
            if (!event || !event.data) return;
            handleIncomingSyncMessage(event.data);
        });

        // 4. Setup Storage event listener for cross-tab sync fallback
        window.addEventListener('storage', (event) => {
            if (event.key === 'hsk1_audio_mute' && event.newValue) {
                const muted = event.newValue === 'true';
                if (isMuted !== muted) applyMuteState(muted);
                return;
            }
            if (event.key === 'hsk1_audio_sync' && event.newValue) {
                try {
                    const parsed = JSON.parse(event.newValue);
                    handleIncomingSyncMessage(parsed);
                } catch (e) {}
                return;
            }
            if ((event.key === 'hsk1_synced_state' || event.key === 'hsk1_game_sync_state') && event.newValue) {
                if (isChildWindow || window.isWaitingForChild || childGameWindow) {
                    try {
                        const parsed = JSON.parse(event.newValue);
                        if (parsed) {
                            handleIncomingSyncMessage({
                                type: parsed.isPopoutClosing ? 'HSK1_POPOUT_CLOSED' : 'HSK1_STATE_SYNC',
                                state: parsed
                            });
                        }
                    } catch (e) {}
                }
            }
            if (event.key === 'hsk1_popout_closed') {
                if (!isChildWindow && (window.isWaitingForChild || childGameWindow)) {
                    resumeInThisWindow(false);
                }
            }
        });

        // 5. Restore state snapshot & setup periodic heartbeat
        // Restore mute state initially
        let initialMute = false;
        try {
            const savedMute = storage.getItem('hsk1_audio_mute');
            if (savedMute !== null) initialMute = savedMute === 'true';
        } catch (e) {}
        if (params.get('muted') !== null) {
            initialMute = params.get('muted') === '1';
        }
        applyMuteState(initialMute);

        // Restore audio current time from URL query if available
        const urlAudioTime = parseFloat(params.get('audioTime'));
        if (isFinite(urlAudioTime) && urlAudioTime > 0) {
            const bgMusic = document.getElementById('bgMusic');
            if (bgMusic) {
                try { bgMusic.currentTime = urlAudioTime; } catch (e) {}
            }
        }

        if (isChildWindow) {
            let initialSyncedState = null;
            try {
                const raw = storage.getItem('hsk1_synced_state') || storage.getItem('hsk1_game_sync_state');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (!parsed.timestamp || Date.now() - parsed.timestamp < 7200000)) {
                        initialSyncedState = parsed;
                    }
                }
            } catch (err) {}

            if (!initialSyncedState && window.opener) {
                try {
                    if (window.opener.__HSK1_LATEST_STATE__) {
                        initialSyncedState = window.opener.__HSK1_LATEST_STATE__;
                    }
                } catch (e) {}
            }

            if (!initialSyncedState) {
                initialSyncedState = getInitialStateForChild();
            }

            if (initialSyncedState) {
                importGameState(initialSyncedState, false);
            }

            if (!isMuted) {
                startBgMusic();
            }

            // Notify parent LMS window that child is ready
            if (window.opener && !window.opener.closed) {
                try { window.opener.postMessage({ type: 'HSK1_CHILD_READY' }, '*'); } catch (e) {}
            }
            if (gameSyncChannel) {
                try { gameSyncChannel.postMessage({ type: 'HSK1_CHILD_READY' }); } catch (e) {}
            }

            // Child heartbeat: continuously send heartbeat every 1 second (identical to HSK 4)
            setInterval(() => {
                if (isChildWindow) {
                    const hb = { type: 'HSK1_HEARTBEAT', timestamp: Date.now() };
                    if (gameSyncChannel) {
                        try { gameSyncChannel.postMessage(hb); } catch (e) {}
                    }
                    if (window.opener && !window.opener.closed) {
                        try { window.opener.postMessage(hb, '*'); } catch (e) {}
                    }
                }
            }, 1000);

            // Child periodic state broadcast: every 2s while in popout
            setInterval(() => {
                if (isChildWindow) {
                    broadcastGameState();
                }
            }, 2000);
        } else {
            // Parent LMS window: active auto-sync listeners on focus & visibility
            window.addEventListener('focus', () => {
                if (window.isWaitingForChild || childGameWindow) {
                    let isClosed = false;
                    try {
                        if (childGameWindow) isClosed = childGameWindow.closed;
                    } catch (e) { isClosed = false; }
                    const noHeartbeat = (Date.now() - lastChildMessageTime > 2000);
                    if (isClosed || noHeartbeat) {
                        resumeInThisWindow(false);
                    } else {
                        checkAndApplyLatestState();
                    }
                }
            });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && (window.isWaitingForChild || childGameWindow)) {
                    let isClosed = false;
                    try {
                        if (childGameWindow) isClosed = childGameWindow.closed;
                    } catch (e) { isClosed = false; }
                    const noHeartbeat = (Date.now() - lastChildMessageTime > 2000);
                    if (isClosed || noHeartbeat) {
                        resumeInThisWindow(false);
                    } else {
                        checkAndApplyLatestState();
                    }
                }
            });

            // Background poller: keep state fresh every 600ms while child window is active
            setInterval(() => {
                if (!isChildWindow && (childGameWindow || window.isWaitingForChild)) {
                    checkAndApplyLatestState();
                }
            }, 600);

            // Restore recent match in LMS window if game was in progress
            try {
                const raw = storage.getItem('hsk1_synced_state');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (Date.now() - parsed.timestamp < 86400000)) {
                        const hasStarted = (parsed.thiefPos !== 0 || parsed.policePos !== 34 || parsed.thiefTurnCount > 1 || parsed.policeTurnCount > 0 || parsed.stepsRemaining > 0 || !parsed.canRoll);
                        if (hasStarted && !parsed.gameOver) {
                            importGameState(parsed, false);
                            const instructionModal = document.getElementById('instructionModal');
                            if (instructionModal) instructionModal.style.display = 'none';
                        }
                    }
                }
            } catch (e) {}
        }
    }

    // Expose all sync API methods globally to window
    window.exportGameState = exportGameState;
    window.importGameState = importGameState;
    window.broadcastGameState = broadcastGameState;
    window.saveGameState = broadcastGameState;
    window.openGameInNewWindow = openGameInNewWindow;
    window.openInNewWindow = openGameInNewWindow;
    window.openStandaloneWindow = openGameInNewWindow;
    window.focusChildWindow = focusChildWindow;
    window.resumeInThisWindow = resumeInThisWindow;
    window.resumeInLmsWindow = resumeInThisWindow;
    window.closePopoutAndReturnToLMS = closePopoutAndReturnToLMS;
    window.closeStandaloneChildWindow = closePopoutAndReturnToLMS;
    window.checkAndApplyLatestState = checkAndApplyLatestState;

    // Initialization
    initBoard();
    updateTurnUI();
    fitGameToContainer();
    initSyncEngine();
});

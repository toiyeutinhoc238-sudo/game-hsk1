document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    let topicName = "";

    if (topicParam) {
        if (topicParam.startsWith('chude')) {
            const index = parseInt(topicParam.replace('chude', '')) - 1;
            // Reconstruct the same sorted and filtered topics list as in index.html
            const topicsList = [...new Set(hsk1Vocab.map(item => item.topic))].filter(topic => {
                const count = hsk1Vocab.filter(i => i.topic === topic).length;
                return count >= 9;
            }).sort((a, b) => {
                const numA = parseInt(a.split('.')[0]);
                const numB = parseInt(b.split('.')[0]);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });
            topicName = topicsList[index];
        } else {
            topicName = decodeURIComponent(topicParam);
        }
    }

    const lessonId = parseInt(params.get('lesson'));

    let questions = [];
    if (topicName) {
        questions = generateQuestionsForTopic(topicName);
    } else if (lessonId) {
        // Fallback for old lesson-based links if any
        // Since we replaced questions.js, we might need a way to still handle lessons
        // But for now, let's assume we use topics.
        alert('Vui lòng chọn chủ đề từ trang chủ.');
        window.location.href = 'index.html';
        return;
    } else {
        alert('Không tìm thấy dữ liệu!');
        window.location.href = 'index.html';
        return;
    }

    if (!questions || questions.length === 0) {
        alert('Không có câu hỏi cho chủ đề này!');
        window.location.href = 'index.html';
        return;
    }

    // Game Constants
    const GRID_COLS = 7;
    const GRID_ROWS = 5;
    const TOTAL_TILES = GRID_COLS * GRID_ROWS;

    // Game State
    let thiefPos = 0;
    let policePos = 34;
    let prevPos = 0; // For moving back on wrong answer

    let currentTurn = 'thief';
    let diceValue = 0;
    let stepsRemaining = 0;
    let isMoving = false;
    let canRoll = true;
    let gameOver = false;
    let questionResults = new Map(); // Track performance: index -> {correct: bool}

    // DOM Elements
    const boardGrid = document.getElementById('boardGrid');
    const thiefChar = document.getElementById('thiefChar');
    const policeChar = document.getElementById('policeChar');
    const rollBtn = document.getElementById('rollBtn');
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

    // Initialize Board
    function initBoard() {
        // Clear only tiles, keep or recreate characters
        boardGrid.querySelectorAll('.tile').forEach(t => t.remove());

        for (let i = 0; i < TOTAL_TILES; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}`;
            tile.onclick = () => handleTileClick(i);

            const q = questions[i % questions.length];
            const word = q.word || q.vocab.split(' ')[0];
            const pinyin = q.pinyin || q.vocab.split(' ')[1] || '';

            const coord = getCoord(i);
            tile.style.gridRow = coord.r + 1;
            tile.style.gridColumn = coord.c + 1;

            tile.innerHTML = `
                <div class="tile-char">${word}</div>
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

        // Grid-area is 1-indexed
        thiefChar.style.gridRow = tCoord.r + 1;
        thiefChar.style.gridColumn = tCoord.c + 1;

        policeChar.style.gridRow = pCoord.r + 1;
        policeChar.style.gridColumn = pCoord.c + 1;

        thiefProgress.style.width = `${(thiefPos / 34) * 100}%`;
        policeProgress.style.width = `${(Math.abs(policePos - thiefPos) / 34) * 100}%`;
    }

    const diceFace = document.getElementById('diceFace');
    const dotPositions = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    function renderDice(val) {
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

    function rollDice() {
        if (!canRoll || isMoving || gameOver) return;
        canRoll = false;

        diceFace.classList.add('rolling');
        rollBtn.disabled = true;

        // Play dice sound
        const diceSfx = document.getElementById('diceSfx');
        if (diceSfx) {
            diceSfx.currentTime = 0;
            diceSfx.play().catch(e => console.log("Sound blocked"));
        }

        let rollInterval = setInterval(() => {
            const tempVal = Math.floor(Math.random() * 4) + 1;
            renderDice(tempVal);
        }, 100);

        setTimeout(() => {
            clearInterval(rollInterval);
            diceValue = Math.floor(Math.random() * 4) + 1;
            renderDice(diceValue);
            diceFace.classList.remove('rolling');

            // Show question AFTER 2.5 seconds of rolling
            showQuestion();
        }, 2500);
    }

    // Initial dice state
    renderDice(1);

    let currentQuestionIdx = 0; // Temporary to track which question was asked
    let recentQuestions = [];

    function showQuestion() {
        // Pick a question (could be random from the lesson)
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
        const qIdx = currentQuestionIdx;

        qText.textContent = q.q;
        qOptions.innerHTML = '';
        document.getElementById('tileName').textContent = "Xác nhận di chuyển";

        q.a.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => handleAnswer(idx, q.correct);
            qOptions.appendChild(btn);
        });

        questionOverlay.style.display = 'flex';
        startTimer();
    }

    function handleAnswer(selected, correct) {
        clearInterval(timer);
        const btns = qOptions.querySelectorAll('.option-btn');
        btns.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === correct) btn.classList.add('correct');
            else if (idx === selected) btn.classList.add('wrong');
        });

        setTimeout(() => {
            questionOverlay.style.display = 'none';

            // Record result for the review table
            const currentQ = questions[currentQuestionIdx];
            questionResults.set(currentQuestionIdx, {
                vocab: currentQ.vocab,
                isCorrect: selected === correct
            });

            if (selected === correct) {
                // Correct: allow movement for BOTH Thief and Police
                stepsRemaining = diceValue;
                highlightPossibleMoves();
            } else {
                // Wrong: no movement, switch turn
                stepsRemaining = 0;
                switchTurn();
            }
        }, 1500);
    }

    function highlightPossibleMoves() {
        const currentPos = currentTurn === 'thief' ? thiefPos : policePos;
        const coord = getCoord(currentPos);

        // Remove all highlights
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
                    document.getElementById(`tile-${idx}`).classList.add('reachable');
                }
            });
        }
    }

    function handleTileClick(index) {
        if (stepsRemaining === 0 || isMoving) return;

        const tile = document.getElementById(`tile-${index}`);
        if (!tile.classList.contains('reachable')) return;

        // Move the character whose turn it is
        if (currentTurn === 'thief') {
            thiefPos = index;
        } else {
            policePos = index;
        }

        stepsRemaining--;
        updatePositions();

        // Check for immediate win
        if (policePos === thiefPos || (currentTurn === 'thief' && thiefPos === 34)) {
            document.querySelectorAll('.tile').forEach(t => t.classList.remove('reachable'));
            checkWinCondition();
            return;
        }

        if (stepsRemaining > 0) {
            highlightPossibleMoves();
        } else {
            document.querySelectorAll('.tile').forEach(t => t.classList.remove('reachable'));
            checkWinCondition();
            if (!gameOver) switchTurn();
        }
    }

    let timer;
    function startTimer() {
        let time = 15;
        qTimerBar.style.width = '100%';
        clearInterval(timer);
        timer = setInterval(() => {
            time -= 0.1;
            qTimerBar.style.width = `${(time / 15) * 100}%`;
            if (time <= 0) {
                clearInterval(timer);
                handleAnswer(-1, -1);
            }
        }, 100);
    }

    function switchTurn() {
        currentTurn = currentTurn === 'thief' ? 'police' : 'thief';
        turnBadge.textContent = `Lượt của ${currentTurn === 'thief' ? 'TRỘM' : 'CẢNH SÁT'}`;
        turnBadge.className = `turn-badge ${currentTurn}-turn`;
        canRoll = true;
        rollBtn.disabled = false;

        // Update stats turn look
        document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-turn'));
        if (currentTurn === 'thief') document.querySelectorAll('.stat-card')[0].classList.add('active-turn');
        else document.querySelectorAll('.stat-card')[1].classList.add('active-turn');
    }

    function checkWinCondition() {
        if (policePos === thiefPos) {
            endGame('CẢNH SÁT ĐÃ BẮT ĐƯỢC TRỘM!', 'Rất tiếc, bạn đã bị bắt!', 'lose');
        } else if (thiefPos === 34) {
            endGame('TRỘM ĐÃ TRỐN THOÁT!', 'Chúc mừng bạn đã về đích an toàn!', 'win');
        }
    }

    function endGame(title, msg, type) {
        gameOver = true;
        resultTitle.textContent = title;
        resultMessage.textContent = msg;

        // Play Win/Lose Sound
        if (type === 'win') {
            const winSfx = document.getElementById('winSfx');
            if (winSfx) winSfx.play();
        } else if (type === 'lose') {
            const loseSfx = document.getElementById('loseSfx');
            if (loseSfx) loseSfx.play();
        }

        // Populate Review Table
        const reviewBody = document.getElementById('reviewBody');
        reviewBody.innerHTML = '';

        // Show all questions in the lesson
        questions.forEach((q, idx) => {
            const result = questionResults.get(idx);
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

            const word = q.word || q.vocab.split(' ')[0];
            const pinyin = q.pinyin || q.vocab.split(' ')[1] || '';
            const meaning = q.meaning || (q.vocab.split(' - ')[1] || '');

            row.innerHTML = `
                <td style="padding: 10px; text-align: left;">${word}</td>
                <td style="padding: 10px; text-align: left; opacity: 0.7;">${pinyin}</td>
                <td style="padding: 10px; text-align: left; font-size: 0.8rem; opacity: 0.7;">${meaning}</td>
            `;
            reviewBody.appendChild(row);
        });

        resultModal.style.display = 'flex';
    }

    rollBtn.onclick = rollDice;
    initBoard();
    window.onresize = updatePositions;

    // Music Logic
    const bgMusic = document.getElementById('bgMusic');
    const musicIcon = document.getElementById('musicIcon');
    let isMusicPlaying = false;

    window.toggleMusic = function () {
        if (!bgMusic) return;
        if (isMusicPlaying) {
            bgMusic.pause();
            musicIcon.textContent = '🔇';
        } else {
            bgMusic.play().catch(e => console.log("Music blocked by browser"));
            musicIcon.textContent = '🔊';
        }
        isMusicPlaying = !isMusicPlaying;
    };
});

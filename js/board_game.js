document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    let topicName = "";

    if (topicParam) {
        if (topicParam.startsWith('chude')) {
            // Reconstruct the same sorted and filtered topics list as in index.html
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

            // Find the topic that matches the ID format
            topicName = topicsList.find((t, idx) => {
                const tNumMatch = t.match(/^(\d+)/);
                const tNum = tNumMatch ? tNumMatch[1] : (idx + 1);
                let tId = `chude${tNum}`;
                if (t.includes('(Phần 1)')) tId += '_phan1';
                else if (t.includes('(Phần 2)')) tId += '_phan2';
                else if (t.includes('(Phần 3)')) tId += '_phan3';
                return tId === topicParam;
            });

            // Fallback for old index-based links if not found
            if (!topicName) {
                const index = parseInt(topicParam.replace('chude', '')) - 1;
                topicName = topicsList[index];
            }
        } else {
            topicName = decodeURIComponent(topicParam);
        }
    }

    let questions = [];
    if (topicName) {
        questions = generateQuestionsForTopic(topicName);
    } else {
        alert('Vui lòng chọn chủ đề từ trang chủ!');
        window.location.href = 'index.html';
        return;
    }

    if (!questions || questions.length === 0) {
        alert('Không có câu hỏi cho chủ đề này!');
        window.location.href = 'index.html';
        return;
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

    let zoomLevel = 1.0;
    let currentZoomedWord = "";
    let questionResults = new Map(); // Track performance: index -> {vocab, isCorrect}

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
    const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
    const thiefStatCard = document.getElementById('thiefStatCard');
    const policeStatCard = document.getElementById('policeStatCard');

    // ==========================================
    // INITIALIZE BOARD
    // ==========================================
    function initBoard() {
        // Clear only tiles, preserve characters
        boardGrid.querySelectorAll('.tile').forEach(t => t.remove());

        for (let i = 0; i < TOTAL_TILES; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}`;

            if (i === 0) tile.classList.add('tile-start');
            if (i === 34) tile.classList.add('tile-target');

            const q = questions[i % questions.length];
            const word = q.word || q.vocab.split(' ')[0];
            const pinyin = q.pinyin || '';
            const meaning = q.meaning || '';

            // Store info for tile inspection
            tile.dataset.index = i;
            tile.dataset.word = word;
            tile.dataset.pinyin = pinyin;
            tile.dataset.meaning = meaning;

            // Handle user tile clicking (Manual movement when stepsRemaining > 0, otherwise view word)
            tile.onclick = () => handleTileClick(i);

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

        // Update progress bars & labels
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

    // ==========================================
    // AUDIO & SOUND FX
    // ==========================================
    const bgMusic = document.getElementById('bgMusic');
    const musicIcon = document.getElementById('musicIcon');
    let isMusicPlaying = false;

    window.toggleMusic = function () {
        if (!bgMusic) return;
        if (isMusicPlaying) {
            bgMusic.pause();
            if (musicIcon) musicIcon.textContent = '🔇';
        } else {
            bgMusic.play().catch(e => console.log("Music blocked by browser policy"));
            if (musicIcon) musicIcon.textContent = '🔊';
        }
        isMusicPlaying = !isMusicPlaying;
    };

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
        } catch (e) {
            // Audio context not allowed or blocked
        }
    }

    // ==========================================
    // ZOOM & FULLSCREEN SYSTEM (Chế độ phóng to)
    // ==========================================
    window.changeZoom = function (delta) {
        zoomLevel = Math.round((zoomLevel + delta) * 10) / 10;
        zoomLevel = Math.min(1.8, Math.max(0.6, zoomLevel));
        applyZoom();
    };

    window.resetZoom = function () {
        zoomLevel = 1.0;
        applyZoom();
    };

    function applyZoom() {
        if (boardWrapper) {
            boardWrapper.style.transform = `scale(${zoomLevel})`;
        }
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
        }
    }

    // Mouse wheel zoom with Ctrl key
    if (boardContainer) {
        boardContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                window.changeZoom(delta);
            }
        }, { passive: false });
    }

    // ==========================================
    // TOAST NOTIFICATION
    // ==========================================
    let toastTimeout = null;
    window.showToast = function (message) {
        const toast = document.getElementById('gameToast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    };

    // ==========================================
    // SMART FULLSCREEN & IFRAME HANDLING
    // ==========================================
    const isInIframe = (function () {
        try { return window.self !== window.top; } catch (e) { return true; }
    })();

    // Show 'Tab mới' button if embedded inside an iframe (like LMS or portal)
    const popoutBtn = document.getElementById('iframePopoutBtn');
    if (popoutBtn && isInIframe) {
        popoutBtn.style.display = 'inline-flex';
    }

    window.openInNewTab = function () {
        window.open(window.location.href, '_blank');
    };

    let isAppFullscreen = false;
    let hasEnteredNativeFs = false;

    window.toggleSmartFullscreen = function () {
        if (navigator.vibrate) {
            try { navigator.vibrate(30); } catch (e) {}
        }

        if (isAppFullscreen) {
            exitFullscreenMode();
            return;
        }

        // Try native browser fullscreen
        const docEl = document.documentElement;
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;

        // Check if browser/iframe policy explicitly forbids fullscreen
        const isFsDisallowed = (document.fullscreenEnabled === false);

        if (isInIframe && isFsDisallowed) {
            window.showToast("🚀 Mở toàn màn hình trong tab mới...");
            window.open(window.location.href, '_blank');
            return;
        }

        if (req) {
            try {
                const p = req.call(docEl);
                if (p && typeof p.then === 'function') {
                    p.then(() => {
                        hasEnteredNativeFs = true;
                        enterFullscreenMode();
                    }).catch(err => {
                        console.warn("Native fullscreen rejected:", err);
                        if (isInIframe) {
                            // If inside an LMS iframe that blocked fullscreen, open standalone in new tab
                            window.showToast("🚀 Mở toàn màn hình trong tab mới...");
                            window.open(window.location.href, '_blank');
                        } else {
                            // On standalone phone/tablet (e.g. iOS), activate CSS App Fullscreen
                            enterFullscreenMode();
                        }
                    });
                    return;
                } else {
                    hasEnteredNativeFs = true;
                    enterFullscreenMode();
                    return;
                }
            } catch (err) {
                console.warn("Native fullscreen exception:", err);
                if (isInIframe) {
                    window.showToast("🚀 Mở toàn màn hình trong tab mới...");
                    window.open(window.location.href, '_blank');
                    return;
                }
            }
        }

        if (isInIframe) {
            window.showToast("🚀 Mở toàn màn hình trong tab mới...");
            window.open(window.location.href, '_blank');
        } else {
            enterFullscreenMode();
        }
    };

    function enterFullscreenMode(notify = true) {
        isAppFullscreen = true;
        document.body.classList.add('app-fullscreen-mode');

        setTimeout(() => {
            autoFitBoard();
        }, 150);

        updateFullscreenUI(true);
        if (notify) {
            window.showToast("⛶ Đã bật chế độ Toàn Màn Hình");
        }
    }

    function exitFullscreenMode(notify = true) {
        isAppFullscreen = false;
        hasEnteredNativeFs = false;
        document.body.classList.remove('app-fullscreen-mode');

        // Exit native fullscreen if active
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) {
                try {
                    const p = exit.call(document);
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch (e) {}
            }
        }

        window.resetZoom();
        updateFullscreenUI(false);
        if (notify) {
            window.showToast("🗗 Đã trở về màn hình chuẩn");
        }
    }

    function updateFullscreenUI(active) {
        const fsBtn = document.getElementById('fullscreenToggleBtn');
        const fsIcon = document.getElementById('fullscreenIcon');
        const fsText = document.getElementById('fullscreenText');

        if (fsBtn) fsBtn.classList.toggle('active', active);
        if (fsIcon) fsIcon.textContent = active ? '🗗' : '⛶';
        if (fsText) fsText.textContent = active ? 'Thu nhỏ' : 'Toàn màn hình';
        if (fsBtn) fsBtn.title = active ? 'Thu nhỏ lại (Phím F)' : 'Mở to toàn màn hình (Phím F)';
    }

    function autoFitBoard() {
        if (!boardContainer || !boardGrid) return;

        const containerW = boardContainer.clientWidth - 20;
        const containerH = boardContainer.clientHeight - 20;
        const boardW = boardGrid.offsetWidth || 500;
        const boardH = boardGrid.offsetHeight || 500;

        if (boardW > 0 && boardH > 0 && containerW > 0 && containerH > 0) {
            const scaleX = containerW / boardW;
            const scaleY = containerH / boardH;
            let optimalScale = Math.min(scaleX, scaleY);
            // Cap between 0.75 and 1.55
            optimalScale = Math.min(1.55, Math.max(0.75, optimalScale));
            zoomLevel = Math.round(optimalScale * 20) / 20;
            applyZoom();
        }
    }

    // Native fullscreen change listener (Esc key or tablet gesture exit)
    const onFsChange = () => {
        const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (isNativeFs) {
            hasEnteredNativeFs = true;
            if (!isAppFullscreen) {
                enterFullscreenMode(false);
            }
        } else if (hasEnteredNativeFs && isAppFullscreen) {
            hasEnteredNativeFs = false;
            exitFullscreenMode(false);
        }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    // Keyboard shortcuts for zoom & fullscreen
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        if (e.key === '+' || e.key === '=') {
            window.changeZoom(0.1);
        } else if (e.key === '-' || e.key === '_') {
            window.changeZoom(-0.1);
        } else if (e.key === '0') {
            window.resetZoom();
        } else if (e.key === 'f' || e.key === 'F') {
            window.toggleSmartFullscreen();
        } else if (e.key === ' ' && canRoll && !isMoving && !gameOver && stepsRemaining === 0) {
            e.preventDefault();
            rollDice();
        }
    });

    // ==========================================
    // VOCABULARY DETAIL MODAL (Phóng to ô từ vựng)
    // ==========================================
    window.showVocabModal = function (index) {
        if (stepsRemaining > 0) return; // Do not open while user is moving pieces
        const tile = document.getElementById(`tile-${index}`);
        if (!tile) return;

        currentZoomedWord = tile.dataset.word || "";
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

    // Initial dice face
    renderDice(1);

    function rollDice() {
        if (!canRoll || isMoving || gameOver || stepsRemaining > 0) return;
        canRoll = false;

        diceFace.classList.add('rolling');
        rollBtn.disabled = true;
        rollBtn.classList.remove('ready-pulse');

        updateStatusBox(`${currentTurn === 'thief' ? 'TRỘM' : 'CẢNH SÁT'} đang đổ xúc xắc...`);

        // Play dice sound
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
            diceFace.classList.remove('rolling');

            updateStatusBox(`Đổ được ${diceValue} điểm! Trả lời đúng để được di chuyển.`);
            showQuestion();
        }, 1600);
    }

    // ==========================================
    // QUESTION LOGIC
    // ==========================================
    let currentQuestionIdx = 0;
    let recentQuestions = [];
    let timer = null;

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

        qText.textContent = q.q;
        qOptions.innerHTML = '';
        const tileNameSpan = document.getElementById('tileName');
        if (tileNameSpan) {
            tileNameSpan.textContent = `Xác nhận di chuyển (${currentTurn === 'thief' ? 'Kẻ Trộm' : 'Cảnh Sát'})`;
        }

        q.a.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt.toLowerCase();
            btn.onclick = () => handleAnswer(idx, q.correct);
            qOptions.appendChild(btn);
        });

        questionOverlay.style.display = 'flex';
        startTimer();
    }

    function startTimer() {
        let time = 15;
        qTimerBar.style.width = '100%';
        clearInterval(timer);
        timer = setInterval(() => {
            time -= 0.1;
            qTimerBar.style.width = `${(time / 15) * 100}%`;
            if (time <= 0) {
                clearInterval(timer);
                const currentQ = questions[currentQuestionIdx];
                handleAnswer(-1, currentQ.correct);
            }
        }, 100);
    }

    function handleAnswer(selected, correct) {
        clearInterval(timer);
        const btns = qOptions.querySelectorAll('.option-btn');
        btns.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === correct) btn.classList.add('correct');
            else if (idx === selected) btn.classList.add('wrong');
        });

        const isCorrect = (selected === correct);

        // Record result for review table
        const currentQ = questions[currentQuestionIdx];
        questionResults.set(currentQuestionIdx, {
            vocab: currentQ.vocab,
            isCorrect: isCorrect
        });

        setTimeout(() => {
            questionOverlay.style.display = 'none';

            if (isCorrect) {
                // Correct answer: User manually selects reachable tiles to move!
                stepsRemaining = diceValue;
                if (movingInfoBox) {
                    movingInfoBox.style.display = 'flex';
                    movingStepsText.textContent = `Còn ${stepsRemaining} bước đi`;
                }
                updateStatusBox(`Chính xác! Nhấp vào các ô phát sáng trên bàn cờ để di chuyển (còn ${stepsRemaining} bước).`);
                highlightPossibleMoves();
            } else {
                // Wrong answer: Lost turn!
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
    // MANUAL TILE MOVEMENT (Original gameplay)
    // ==========================================
    function highlightPossibleMoves() {
        const currentPos = currentTurn === 'thief' ? thiefPos : policePos;
        const coord = getCoord(currentPos);

        // Remove all reachable highlights
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
            // User is in the movement phase!
            const tile = document.getElementById(`tile-${index}`);
            if (!tile || !tile.classList.contains('reachable')) return;

            // Move the active character
            if (currentTurn === 'thief') {
                thiefPos = index;
            } else {
                policePos = index;
            }

            stepsRemaining--;
            updatePositions();
            playStepSound();

            // Check immediate win conditions
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
            } else {
                // Finished all steps -> Switch turn smoothly and enable dice for next turn!
                clearHighlightsAndEndMove();
                checkWinCondition();
                if (!gameOver) switchTurn();
            }
        } else {
            // Outside movement phase: Clicking a tile opens the Vocabulary Zoom Card
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

        // 100% GUARANTEE that the roll button is ready and enabled for turn 2 and onwards!
        canRoll = true;
        stepsRemaining = 0;
        rollBtn.disabled = false;
        rollBtn.classList.add('ready-pulse');

        updateStatusBox(`Đến lượt của ${currentTurn === 'thief' ? 'KẺ TRỘM' : 'CẢNH SÁT'}! Bấm "ĐỔ XÚC XẮC".`);
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
        rollBtn.disabled = true;
        rollBtn.classList.remove('ready-pulse');

        resultTitle.textContent = title;
        resultMessage.textContent = msg;

        // Play Win / Lose Sound
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

        questions.forEach((q, idx) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

            const word = q.word || q.vocab.split(' ')[0];
            const pinyin = q.pinyin || '';
            const meaning = q.meaning || '';

            row.innerHTML = `
                <td style="padding: 10px; text-align: left; font-weight: bold; color: var(--accent); font-family: var(--font-chinese); font-size: 1.25rem;">${word}</td>
                <td style="padding: 10px; text-align: left; opacity: 0.85;">${pinyin}</td>
                <td style="padding: 10px; text-align: left; font-size: 0.85rem; opacity: 0.9;">${meaning}</td>
            `;
            reviewBody.appendChild(row);
        });

        resultModal.style.display = 'flex';
    }

    window.resetGameMatch = function () {
        // Reset positions & state cleanly so round 2 can be rolled immediately
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

        rollBtn.disabled = false;
        rollBtn.classList.add('ready-pulse');

        updateStatusBox('Ván mới đã bắt đầu! Bấm "ĐỔ XÚC XẮC" để chơi.');
    };

    window.openInstructions = function () {
        const modal = document.getElementById('instructionModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeInstructions = function () {
        const modal = document.getElementById('instructionModal');
        if (modal) modal.style.display = 'none';
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================
    rollBtn.onclick = rollDice;
    initBoard();
    updateTurnUI();
    applyZoom();

    window.onresize = () => {
        updatePositions();
    };
});

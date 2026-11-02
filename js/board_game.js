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

    window.toggleMusic = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!bgMusic) return;
        if (isMusicPlaying) {
            bgMusic.pause();
            isMusicPlaying = false;
            if (musicIcon) musicIcon.textContent = '🔇';
        } else {
            isMusicPlaying = true;
            if (musicIcon) musicIcon.textContent = '🔊';
            const playPromise = bgMusic.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log("[Audio] Music play blocked by browser policy:", err);
                });
            }
        }
        if (typeof broadcastGameState === 'function') {
            broadcastGameState();
        }
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
    // AUTO-FIT ENGINE (Tự động bao phủ 100%, không cần cuộn)
    // ==========================================
    function fitGameToContainer() {
        if (!boardContainer || !boardWrapper || !boardGrid) return;

        const containerW = boardContainer.clientWidth;
        const containerH = boardContainer.clientHeight;
        const boardW = boardGrid.offsetWidth || 560;
        const boardH = boardGrid.offsetHeight || 420;

        if (containerW > 50 && containerH > 50 && boardW > 50 && boardH > 50) {
            // Safety margin so board never touches borders or triggers any overflow
            const padX = 16;
            const padY = 16;
            const scaleX = (containerW - padX) / boardW;
            const scaleY = (containerH - padY) / boardH;

            // Math.min guarantees the board NEVER exceeds container height and NEVER exceeds width
            let fitScale = Math.min(scaleX, scaleY);

            // Clamp scale between 0.30 and 1.35
            fitScale = Math.min(1.35, Math.max(0.3, fitScale));
            fitScale = Math.round(fitScale * 100) / 100;

            boardWrapper.style.transform = `scale(${fitScale})`;
        }
    }

    window.fitGameToContainer = fitGameToContainer;

    // Observe size changes of the container (LMS iframe resize, screen rotation, window resize)
    if (window.ResizeObserver && boardContainer) {
        const ro = new ResizeObserver(() => {
            fitGameToContainer();
        });
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

    // Run multiple times on startup to guarantee fit after fonts/layout settle
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
    // MULTI-WINDOW / LMS REAL-TIME STATE SYNC
    // (Based on proven Game Tiếng Trung HSK 4 Architecture)
    // ==========================================
    const myWindowId = 'win_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const storageKey = `hsk1_game_session_${topicParam || 'default'}`;
    let lastStateTimestamp = 0;
    let latestSyncedState = null;
    let isApplyingSync = false;
    let childPopup = null;
    let broadcastChannel = null;
    let isChildWindow = false;

    /**
     * Export complete current game state snapshot (including exact audio position & play status)
     */
    function exportGameState() {
        const isQuestionActive = (questionOverlay && questionOverlay.style.display === 'flex');
        const audioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? bgMusic.currentTime : 0;

        return {
            senderId: myWindowId,
            topic: topicParam,
            topicName: topicName,
            thiefPos: thiefPos,
            policePos: policePos,
            currentTurn: currentTurn,
            thiefTurnCount: thiefTurnCount,
            policeTurnCount: policeTurnCount,
            diceValue: diceValue,
            stepsRemaining: stepsRemaining,
            canRoll: canRoll,
            gameOver: gameOver,
            gameOverTitle: gameOver && resultTitle ? resultTitle.textContent : '',
            gameOverMsg: gameOver && resultMessage ? resultMessage.textContent : '',
            statusMessage: gameStatusBox ? gameStatusBox.textContent : '',
            questionActive: isQuestionActive,
            currentQuestionIdx: currentQuestionIdx,
            questionResults: Array.from(questionResults.entries()),
            isMusicPlaying: isMusicPlaying,
            audioCurrentTime: audioTime,
            timestamp: Date.now()
        };
    }

    /**
     * Broadcast game state across all active channels (BroadcastChannel, postMessage, safeStorage)
     */
    function broadcastGameState(extraProps = null, isClosing = false) {
        if (isApplyingSync && !isClosing) return;
        lastStateTimestamp = Date.now();

        const state = exportGameState();
        if (extraProps) {
            Object.assign(state, extraProps);
        }
        if (isClosing) {
            state.isPopoutClosing = true;
        }
        state.timestamp = lastStateTimestamp;
        latestSyncedState = state;
        window.__HSK1_LATEST_STATE__ = state;

        const stateStr = JSON.stringify(state);
        const storage = window.safeStorage || localStorage;
        try {
            storage.setItem(storageKey, stateStr);
            storage.setItem('hsk1_synced_state', stateStr);
            storage.setItem('hsk1_game_sync_state', stateStr);
            if (isClosing) {
                try { storage.setItem('hsk1_popout_closed', Date.now().toString()); } catch (e) {}
            }
        } catch (e) {
            console.warn("[Sync] Storage write note:", e);
        }

        const msgType = isClosing ? 'HSK1_POPOUT_CLOSED' : 'HSK1_SYNC_STATE';
        const msg = { type: msgType, state: state };

        if (broadcastChannel) {
            try { broadcastChannel.postMessage(msg); } catch (e) {}
        }

        if (window.opener && window.opener !== window && !window.opener.closed) {
            try { window.opener.postMessage(msg, '*'); } catch (e) {}
        }

        if (childPopup && !childPopup.closed) {
            try { childPopup.postMessage(msg, '*'); } catch (e) {}
        }

        updateSyncOverlayInfo(state);
    }

    // Alias saveGameState to broadcastGameState for complete consistency across original calls
    function saveGameState() {
        broadcastGameState();
    }

    /**
     * Apply incoming synced game state & synchronize audio seamlessly
     */
    function applySyncedState(newState, source) {
        if (!newState) return;
        if (newState.senderId === myWindowId) return; // Ignore own echoes
        if (newState.topic && topicParam && newState.topic !== topicParam) return;

        if (newState.timestamp && newState.timestamp < lastStateTimestamp && source !== 'initial_restore' && source !== 'resume_parent') {
            return; // Discard outdated packets
        }
        lastStateTimestamp = newState.timestamp || Date.now();
        latestSyncedState = newState;
        window.__HSK1_LATEST_STATE__ = newState;
        isApplyingSync = true;

        try {
            thiefPos = typeof newState.thiefPos === 'number' ? newState.thiefPos : thiefPos;
            policePos = typeof newState.policePos === 'number' ? newState.policePos : policePos;
            currentTurn = newState.currentTurn || currentTurn;
            thiefTurnCount = typeof newState.thiefTurnCount === 'number' ? newState.thiefTurnCount : thiefTurnCount;
            policeTurnCount = typeof newState.policeTurnCount === 'number' ? newState.policeTurnCount : policeTurnCount;
            diceValue = typeof newState.diceValue === 'number' ? newState.diceValue : diceValue;
            stepsRemaining = typeof newState.stepsRemaining === 'number' ? newState.stepsRemaining : stepsRemaining;
            canRoll = typeof newState.canRoll === 'boolean' ? newState.canRoll : canRoll;
            gameOver = typeof newState.gameOver === 'boolean' ? newState.gameOver : gameOver;
            isMoving = (stepsRemaining > 0);

            if (Array.isArray(newState.questionResults)) {
                questionResults = new Map(newState.questionResults);
            }

            // Sync visual positions & turn badges
            updatePositions();
            updateTurnUI();
            renderDice(diceValue || 1);

            if (newState.statusMessage) {
                updateStatusBox(newState.statusMessage);
            }

            // Sync movement mode
            if (stepsRemaining > 0) {
                if (movingInfoBox) {
                    movingInfoBox.style.display = 'flex';
                    if (movingStepsText) movingStepsText.textContent = `Còn ${stepsRemaining} bước đi`;
                }
                rollBtn.disabled = true;
                rollBtn.classList.remove('ready-pulse');
                highlightPossibleMoves();
            } else {
                clearHighlightsAndEndMove();
                rollBtn.disabled = !canRoll || gameOver;
                if (canRoll && !gameOver) {
                    rollBtn.classList.add('ready-pulse');
                } else {
                    rollBtn.classList.remove('ready-pulse');
                }
            }

            // Sync question overlay
            if (newState.questionActive && !gameOver) {
                showSyncedQuestion(newState.currentQuestionIdx);
            } else {
                if (questionOverlay) questionOverlay.style.display = 'none';
                if (timer) clearInterval(timer);
            }

            // Sync game over modal
            if (gameOver) {
                if (resultTitle) resultTitle.textContent = newState.gameOverTitle || 'KẾT THÚC TRÒ CHƠI';
                if (resultMessage) resultMessage.textContent = newState.gameOverMsg || '';
                if (resultModal) resultModal.style.display = 'flex';
            } else {
                if (resultModal) resultModal.style.display = 'none';
            }

            // ==========================================
            // AUDIO SYNCHRONIZATION ENGINE
            // (Đồng bộ tắt/bật âm và tiếp nối đúng vị trí đoạn nhạc)
            // ==========================================
            const isParentWaiting = !isChildWindow && Boolean(childPopup && !childPopup.closed);
            if (typeof newState.isMusicPlaying === 'boolean') {
                isMusicPlaying = newState.isMusicPlaying;
                if (musicIcon) musicIcon.textContent = isMusicPlaying ? '🔊' : '🔇';

                if (bgMusic) {
                    const targetTime = typeof newState.audioCurrentTime === 'number' ? newState.audioCurrentTime : 0;
                    if (!isParentWaiting) {
                        try {
                            if (isFinite(targetTime) && targetTime >= 0 && Math.abs(bgMusic.currentTime - targetTime) > 1.2) {
                                bgMusic.currentTime = targetTime;
                            }
                        } catch (e) {}

                        if (isMusicPlaying) {
                            const playPromise = bgMusic.play();
                            if (playPromise !== undefined) {
                                playPromise.catch(err => {
                                    console.log("[Audio] Autoplay restriction; unlocking on first interaction:", err);
                                    const unlockAudio = () => {
                                        if (isMusicPlaying && bgMusic) {
                                            if (isFinite(targetTime) && targetTime > 0 && Math.abs(bgMusic.currentTime - targetTime) > 1.2) {
                                                try { bgMusic.currentTime = targetTime; } catch (e) {}
                                            }
                                            bgMusic.play().catch(() => {});
                                        }
                                        document.removeEventListener('pointerdown', unlockAudio);
                                        document.removeEventListener('keydown', unlockAudio);
                                        document.removeEventListener('click', unlockAudio);
                                    };
                                    document.addEventListener('pointerdown', unlockAudio, { once: true });
                                    document.addEventListener('keydown', unlockAudio, { once: true });
                                    document.addEventListener('click', unlockAudio, { once: true });
                                });
                            }
                        } else {
                            bgMusic.pause();
                        }
                    } else {
                        // Parent LMS window is waiting for child popup: keep parent music paused
                        bgMusic.pause();
                    }
                }
            }

            // Close instruction modal if game has already started
            const isGameStarted = (thiefPos !== 0 || policePos !== 34 || thiefTurnCount > 1 || policeTurnCount > 0 || stepsRemaining > 0 || !canRoll || gameOver);
            if (isGameStarted) {
                const instructionModal = document.getElementById('instructionModal');
                if (instructionModal) instructionModal.style.display = 'none';
            }

            updateSyncOverlayInfo(newState);
        } finally {
            isApplyingSync = false;
        }
    }

    function showSyncedQuestion(qIdx) {
        if (typeof qIdx !== 'number' || !questions[qIdx]) return;
        currentQuestionIdx = qIdx;
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

        if (questionOverlay && questionOverlay.style.display !== 'flex') {
            questionOverlay.style.display = 'flex';
            startTimer();
        }
    }

    /**
     * Open Game in Dedicated Standalone Window with State Handover (Matches HSK 4 Architecture)
     */
    function openInNewWindow(e) {
        if (e && e.preventDefault) e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const isPop = params.get('popout') === '1' || params.get('mode') === 'popup';
        if (isPop || isChildWindow) {
            closePopoutAndReturnToLMS();
            return;
        }

        // 1. Capture audio state AND PAUSE background music in LMS parent window (matches HSK 4)
        const audioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? bgMusic.currentTime : 0;
        const wasMusicPlaying = isMusicPlaying;
        if (bgMusic && !bgMusic.paused) {
            try { bgMusic.pause(); } catch (err) {}
        }

        // 2. Snapshot current game state
        let snapshot = null;
        try {
            snapshot = exportGameState();
        } catch (err) {
            console.warn("[Popout] exportGameState fallback:", err);
            snapshot = { topic: topicParam, timestamp: Date.now() };
        }
        snapshot.audioCurrentTime = audioTime;
        snapshot.isMusicPlaying = wasMusicPlaying;
        snapshot.syncSessionId = 'sync_' + Date.now();
        snapshot.isLmsWaiting = true;
        window.__HSK1_LATEST_STATE__ = snapshot;
        latestSyncedState = snapshot;

        const stateStr = JSON.stringify(snapshot);
        const storage = window.safeStorage || localStorage;
        try {
            storage.setItem(storageKey, stateStr);
            storage.setItem('hsk1_synced_state', stateStr);
            storage.setItem('hsk1_game_sync_state', stateStr);
            storage.setItem('hsk1_active_session', snapshot.syncSessionId);
        } catch (err) {}

        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage({ type: 'HSK1_SYNC_INIT', state: snapshot });
            } catch (err) {}
        }

        // 3. Clean URL parameters (Short & Safe, identical to HSK 4)
        const targetUrl = new URL(window.location.href);
        targetUrl.searchParams.delete('state');
        targetUrl.hash = '';
        targetUrl.searchParams.set('popout', '1');
        targetUrl.searchParams.set('session', snapshot.syncSessionId);
        if (topicParam) {
            targetUrl.searchParams.set('topic', topicParam);
        }

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
                childPopup = child;
                try { child.focus(); } catch (err) {}
            }

            // 5. Show Parent LMS Sync Overlay (Matches HSK 4)
            const syncModal = document.getElementById('sync-active-modal');
            if (syncModal) {
                syncModal.classList.add('show');
                updateSyncOverlayInfo(snapshot);
            }

            if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                window.LMSAdapter.showToast("🚀 Đang chơi tại cửa sổ mới! Màn hình LMS tạm dừng và chờ đồng bộ.");
            }

            // 6. Poller to detect child window closure
            if (window.childCheckInterval) {
                clearInterval(window.childCheckInterval);
                window.childCheckInterval = null;
            }

            setTimeout(() => {
                if (!childPopup || childPopup === true) return;
                window.childCheckInterval = setInterval(() => {
                    let isClosed = false;
                    try {
                        isClosed = !childPopup || childPopup.closed;
                    } catch (err) {
                        isClosed = false;
                    }
                    if (isClosed) {
                        clearInterval(window.childCheckInterval);
                        window.childCheckInterval = null;
                        childPopup = null;
                        resumeInThisWindow(false);
                    }
                }, 600);
            }, 1500);
        } else {
            // Popup blocked: restore parent audio if it was playing
            if (wasMusicPlaying && bgMusic) {
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
        const audioTime = (bgMusic && !isNaN(bgMusic.currentTime)) ? bgMusic.currentTime : 0;
        broadcastGameState({
            isPopoutClosing: true,
            audioCurrentTime: audioTime,
            isMusicPlaying: isMusicPlaying
        }, true);

        if (bgMusic) {
            try { bgMusic.pause(); } catch (e) {}
        }

        if (window.opener && !window.opener.closed) {
            try { window.opener.focus(); } catch (e) {}
        }
        window.close();
    }

    /**
     * Resume playing directly in the Parent LMS window (Matches HSK 4 Architecture)
     */
    function resumeInThisWindow(forceCloseChild = false) {
        if (window.childCheckInterval) {
            clearInterval(window.childCheckInterval);
            window.childCheckInterval = null;
        }

        if (forceCloseChild && childPopup) {
            try {
                if (!childPopup.closed) {
                    childPopup.close();
                }
            } catch (e) {}
            childPopup = null;
        }

        const syncModal = document.getElementById('sync-active-modal');
        if (syncModal) syncModal.classList.remove('show');

        let stateToApply = latestSyncedState;
        const storage = window.safeStorage || localStorage;
        if (!stateToApply) {
            try {
                const saved = storage.getItem(storageKey) || storage.getItem('hsk1_synced_state');
                if (saved) stateToApply = JSON.parse(saved);
            } catch (e) {}
        }

        if (stateToApply) {
            applySyncedState(stateToApply, 'resume_parent');

            // Explicitly resume background music continuing from child window's exact timestamp
            if (typeof stateToApply.isMusicPlaying === 'boolean') {
                isMusicPlaying = stateToApply.isMusicPlaying;
                if (musicIcon) musicIcon.textContent = isMusicPlaying ? '🔊' : '🔇';

                if (bgMusic) {
                    const targetTime = typeof stateToApply.audioCurrentTime === 'number' ? stateToApply.audioCurrentTime : 0;
                    try {
                        if (isFinite(targetTime) && targetTime >= 0) {
                            bgMusic.currentTime = targetTime;
                        }
                    } catch (e) {}

                    if (isMusicPlaying) {
                        bgMusic.play().catch(e => console.log("[Audio] Resume playback error:", e));
                    } else {
                        bgMusic.pause();
                    }
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
        }
    }

    /**
     * Focus the active Child Window from Parent
     */
    function focusChildWindow() {
        let isAlive = false;
        if (childPopup) {
            try { isAlive = !childPopup.closed; } catch (e) { isAlive = false; }
        }
        if (isAlive) {
            try { childPopup.focus(); return; } catch (e) {}
        }
        openInNewWindow();
    }

    /**
     * Update real-time sync overlay information on parent LMS modal
     */
    function updateSyncOverlayInfo(state) {
        if (!state) return;
        const topicEl = document.getElementById('syncOverlayTopic');
        const turnEl = document.getElementById('syncOverlayTurn');
        const posEl = document.getElementById('syncOverlayPos');

        if (topicEl) topicEl.textContent = topicName || state.topicName || state.topic || "HSK 1";
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

        if (!isChildWindow) {
            // Parent LMS window
            if (state) {
                latestSyncedState = state;
                window.__HSK1_LATEST_STATE__ = state;
                updateSyncOverlayInfo(state);

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
            }

            if (type === 'HSK1_POPOUT_CLOSED' || type === 'HSK1_CHILD_CLOSING' || (state && state.isPopoutClosing)) {
                resumeInThisWindow(false);
            } else if (type === 'HSK1_CHILD_READY') {
                broadcastGameState();
            }
        } else {
            // Child window
            if ((type === 'HSK1_SYNC_STATE' || type === 'HSK1_STATE_SYNC') && state) {
                applySyncedState(state, 'sync_message');
            } else if (type === 'HSK1_PARENT_RESUMED') {
                if (window.LMSAdapter && typeof window.LMSAdapter.showToast === 'function') {
                    window.LMSAdapter.showToast("👉 Đang tiếp tục chơi trên màn hình LMS.");
                }
            }
        }
    }

    /**
     * Initialize Real-time Synchronization Engine (Based on HSK 4 Architecture)
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
        const popoutBtn = document.getElementById('openNewWindowBtn');
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
                    openInNewWindow(e);
                };
            }
        }

        // 2. Setup BroadcastChannel (Same-origin instant bus)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                broadcastChannel = new BroadcastChannel(`hsk1_sync_${topicParam || 'default'}`);
                broadcastChannel.onmessage = (event) => {
                    if (!event || !event.data) return;
                    const data = event.data;
                    if (data.state) {
                        handleIncomingSyncMessage(data);
                    } else if (data.senderId) {
                        handleIncomingSyncMessage({ type: 'HSK1_SYNC_STATE', state: data });
                    }
                };
            } catch (e) {
                console.warn("[Sync] BroadcastChannel error:", e);
            }
        }
        window.broadcastChannel = broadcastChannel;

        // 3. Setup postMessage Listener (Cross-window & LMS iFrame bridge)
        window.addEventListener('message', (event) => {
            if (!event || !event.data) return;
            const data = event.data;
            if (data.type && data.type.startsWith('HSK1_')) {
                handleIncomingSyncMessage(data);
            }
        });

        // 4. Setup Storage event listener for cross-tab sync fallback
        window.addEventListener('storage', (event) => {
            if ((event.key === storageKey || event.key === 'hsk1_synced_state' || event.key === 'hsk1_game_sync_state') && event.newValue) {
                try {
                    const parsed = JSON.parse(event.newValue);
                    if (parsed) {
                        handleIncomingSyncMessage({
                            type: parsed.isPopoutClosing ? 'HSK1_POPOUT_CLOSED' : 'HSK1_SYNC_STATE',
                            state: parsed
                        });
                    }
                } catch (e) {}
            }
        });

        // 5. Restore state snapshot
        const storage = window.safeStorage || localStorage;
        if (isChildWindow) {
            let initialSyncedState = null;
            try {
                const raw = storage.getItem(storageKey) || storage.getItem('hsk1_synced_state');
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

            if (initialSyncedState) {
                applySyncedState(initialSyncedState, 'initial_restore');
            }

            // Notify parent LMS window that child is ready
            if (window.opener && !window.opener.closed) {
                try {
                    window.opener.postMessage({ type: 'HSK1_CHILD_READY' }, '*');
                } catch (e) {}
            }
        } else {
            // Restore session on parent LMS window if recently active
            try {
                const raw = storage.getItem(storageKey) || storage.getItem('hsk1_synced_state');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (Date.now() - parsed.timestamp < 86400000)) {
                        const hasStarted = (parsed.thiefPos !== 0 || parsed.policePos !== 34 || parsed.thiefTurnCount > 1 || parsed.policeTurnCount > 0 || parsed.stepsRemaining > 0 || !parsed.canRoll);
                        if (hasStarted && !parsed.gameOver) {
                            applySyncedState(parsed, 'initial_restore');
                            const instructionModal = document.getElementById('instructionModal');
                            if (instructionModal) instructionModal.style.display = 'none';
                        }
                    }
                }
            } catch (e) {}
        }
    }

    // Expose all sync API methods to window for global access
    window.exportGameState = exportGameState;
    window.applySyncedState = applySyncedState;
    window.saveGameState = saveGameState;
    window.broadcastGameState = broadcastGameState;
    window.openInNewWindow = openInNewWindow;
    window.openGameInNewWindow = openInNewWindow;
    window.openStandaloneWindow = openInNewWindow;
    window.focusChildWindow = focusChildWindow;
    window.resumeInThisWindow = resumeInThisWindow;
    window.resumeInLmsWindow = resumeInThisWindow;
    window.closePopoutAndReturnToLMS = closePopoutAndReturnToLMS;
    window.closeStandaloneChildWindow = closePopoutAndReturnToLMS;

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
        saveGameState();

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
        saveGameState();
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
                saveGameState();
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
                saveGameState();
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
        saveGameState();
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
        saveGameState();

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
        saveGameState();
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
    fitGameToContainer();
    initSyncEngine();
});

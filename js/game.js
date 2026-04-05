document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const lessonId = parseInt(params.get('lesson')) || 1;
    const questions = hsk1Questions[lessonId];

    if (!questions) {
        alert('Lesson not found!');
        window.location.href = 'index.html';
        return;
    }

    // Game State
    let currentIdx = 0;
    let playerCorrect = 0;
    let botCorrect = 0;
    let isGameOver = false;
    let canAnswer = false;
    let botTimer;
    let questionTimer;
    let timeLeft = 15;
    let playerChoice = null;
    let botChoice = null;
    let isEvaluating = false;

    // DOM Elements
    const questionText = document.getElementById('questionText');
    const optionsGrid = document.getElementById('optionsGrid');
    const playerProgress = document.getElementById('playerProgress');
    const botProgress = document.getElementById('botProgress');
    const questionNum = document.getElementById('questionNum');
    const resultModal = document.getElementById('resultModal');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const reviewList = document.getElementById('reviewList');
    const lessonNumReview = document.getElementById('lessonNumReview');
    const timerBar = document.getElementById('timerBar');
    const startCountdown = document.getElementById('startCountdown');
    const countdownText = document.getElementById('countdownText');
    const statusMsg = document.getElementById('statusMsg');

    // Initialize Review Section
    lessonNumReview.textContent = lessonId;
    questions.forEach(q => {
        const item = document.createElement('div');
        item.className = 'review-item';
        item.textContent = q.vocab;
        reviewList.appendChild(item);
    });

    function updateProgress() {
        const total = 10;
        playerProgress.style.width = `${(playerCorrect / total) * 100}%`;
        botProgress.style.width = `${(botCorrect / total) * 100}%`;
    }

    function startInitialCountdown() {
        let count = 3;
        startCountdown.style.display = 'flex';
        countdownText.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownText.textContent = count;
            } else if (count === 0) {
                countdownText.textContent = 'BẮT ĐẦU!';
            } else {
                clearInterval(interval);
                startCountdown.style.display = 'none';
                loadQuestion();
            }
        }, 1000);
    }

    function startQuestionTimer() {
        clearInterval(questionTimer);
        timeLeft = 15;
        timerBar.style.width = '100%';
        
        questionTimer = setInterval(() => {
            if (isEvaluating) return;
            timeLeft -= 0.1;
            const percentage = (timeLeft / 15) * 100;
            timerBar.style.width = `${percentage}%`;

            if (timeLeft <= 0) {
                clearInterval(questionTimer);
                evaluateTurn();
            }
        }, 100);
    }

    function loadQuestion() {
        if (currentIdx >= questions.length || playerCorrect >= 10 || botCorrect >= 10) {
            endGame();
            return;
        }

        canAnswer = true;
        isEvaluating = false;
        playerChoice = null;
        botChoice = null;
        statusMsg.textContent = 'Đợi người chơi chọn...';
        
        const q = questions[currentIdx];
        questionNum.textContent = `Câu ${currentIdx + 1}/10`;
        questionText.textContent = q.q;
        optionsGrid.innerHTML = '';

        q.a.forEach((option, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => handleChoice(idx, false);
            optionsGrid.appendChild(btn);
        });

        startQuestionTimer();
        startBotBrain();
    }

    function handleChoice(idx, isBot) {
        if (!canAnswer || isGameOver || isEvaluating) return;

        const buttons = optionsGrid.querySelectorAll('.option-btn');
        
        if (isBot) {
            if (botChoice !== null) return;
            botChoice = idx;
            const marker = document.createElement('span');
            marker.className = 'marker marker-bot';
            marker.textContent = '🤖';
            buttons[idx].appendChild(marker);
            buttons[idx].classList.add('bot-selected');
        } else {
            if (playerChoice !== null) return;
            playerChoice = idx;
            const marker = document.createElement('span');
            marker.className = 'marker marker-player';
            marker.textContent = '👤';
            buttons[idx].appendChild(marker);
            buttons[idx].classList.add('player-selected');
            statusMsg.textContent = 'Bạn đã chọn, đang đợi Robot...';
        }

        if (playerChoice !== null && botChoice !== null) {
            evaluateTurn();
        }
    }

    function evaluateTurn() {
        if (isEvaluating) return;
        isEvaluating = true;
        canAnswer = false;
        clearInterval(questionTimer);
        clearTimeout(botTimer);

        statusMsg.textContent = 'Đang kiểm tra đáp án... (3s)';
        
        const q = questions[currentIdx];
        const buttons = optionsGrid.querySelectorAll('.option-btn');

        // Scoring
        if (playerChoice === q.correct) playerCorrect++;
        if (botChoice === q.correct) botCorrect++;

        // Reveal correct/wrong
        buttons.forEach((btn, idx) => {
            if (idx === q.correct) {
                btn.classList.add('correct');
            } else if (idx === playerChoice || idx === botChoice) {
                btn.classList.add('wrong');
            }
        });

        updateProgress();
        setTimeout(nextQuestion, 3000);
    }

    function startBotBrain() {
        // Bot responds between 2 and 12 seconds randomly
        const delay = Math.random() * 10000 + 2000;
        
        botTimer = setTimeout(() => {
            if (isGameOver || isEvaluating) return;
            const randomIdx = Math.floor(Math.random() * 4);
            handleChoice(randomIdx, true);
        }, delay);
    }

    function nextQuestion() {
        if (isGameOver) return;
        currentIdx++;
        loadQuestion();
    }

    function endGame() {
        isGameOver = true;
        clearInterval(questionTimer);
        clearTimeout(botTimer);
        resultModal.style.display = 'flex';

        if (playerCorrect >= 10 || playerCorrect > botCorrect) {
            resultTitle.textContent = 'CHÚC MỪNG CHIẾN THẮNG!';
            resultTitle.style.color = 'var(--success)';
            resultMessage.textContent = `Bạn đã đánh bại Robot với tỉ số ${playerCorrect} - ${botCorrect}!`;
        } else if (botCorrect >= 10 || botCorrect > playerCorrect) {
            resultTitle.textContent = 'ROBOT CHIẾN THẮNG';
            resultTitle.style.color = 'var(--error)';
            resultMessage.textContent = `Rất tiếc! Robot đã về đích trước. Tỉ số: ${playerCorrect} - ${botCorrect}`;
        } else {
            resultTitle.textContent = 'BẤT PHÂN THẮNG BẠI';
            resultMessage.textContent = 'Trận đấu kết thúc với kết quả Hòa!';
        }
    }

    startInitialCountdown();
});

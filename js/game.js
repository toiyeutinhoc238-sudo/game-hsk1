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
    let isGameOver = false;
    let canAnswer = false;
    let questionTimer;
    let timeLeft = 15;
    let playerChoice = null;
    let isEvaluating = false;

    // DOM Elements
    const questionText = document.getElementById('questionText');
    const optionsGrid = document.getElementById('optionsGrid');
    const playerProgress = document.getElementById('playerProgress');
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
        const total = questions.length;
        playerProgress.style.width = `${(playerCorrect / total) * 100}%`;
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
        if (currentIdx >= questions.length) {
            endGame();
            return;
        }

        canAnswer = true;
        isEvaluating = false;
        playerChoice = null;
        statusMsg.textContent = 'Hãy chọn đáp án đúng!';
        
        const q = questions[currentIdx];
        questionNum.textContent = `Câu ${currentIdx + 1}/${questions.length}`;
        questionText.textContent = q.q;
        optionsGrid.innerHTML = '';

        q.a.forEach((option, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => handleChoice(idx);
            optionsGrid.appendChild(btn);
        });

        startQuestionTimer();
    }

    function handleChoice(idx) {
        if (!canAnswer || isGameOver || isEvaluating) return;

        const buttons = optionsGrid.querySelectorAll('.option-btn');
        
        if (playerChoice !== null) return;
        playerChoice = idx;
        const marker = document.createElement('span');
        marker.className = 'marker marker-player';
        marker.textContent = '👤';
        buttons[idx].appendChild(marker);
        buttons[idx].classList.add('player-selected');
        
        evaluateTurn();
    }

    function evaluateTurn() {
        if (isEvaluating) return;
        isEvaluating = true;
        canAnswer = false;
        clearInterval(questionTimer);

        statusMsg.textContent = 'Đang kiểm tra đáp án...';
        
        const q = questions[currentIdx];
        const buttons = optionsGrid.querySelectorAll('.option-btn');

        // Scoring
        if (playerChoice === q.correct) {
            playerCorrect++;
            statusMsg.textContent = 'CHÍNH XÁC!';
            statusMsg.style.color = 'var(--success)';
        } else {
            statusMsg.textContent = 'CHƯA ĐÚNG RỒI!';
            statusMsg.style.color = 'var(--error)';
        }

        // Reveal correct/wrong
        buttons.forEach((btn, idx) => {
            if (idx === q.correct) {
                btn.classList.add('correct');
            } else if (idx === playerChoice) {
                btn.classList.add('wrong');
            }
        });

        updateProgress();
        setTimeout(() => {
            statusMsg.style.color = 'var(--accent)';
            nextQuestion();
        }, 1500);
    }


    function nextQuestion() {
        if (isGameOver) return;
        currentIdx++;
        loadQuestion();
    }

    function endGame() {
        isGameOver = true;
        clearInterval(questionTimer);
        resultModal.style.display = 'flex';

        resultTitle.textContent = 'BÀI HỌC KẾT THÚC';
        resultMessage.textContent = `Bạn đã hoàn thành với số câu đúng: ${playerCorrect}/${questions.length}. Hãy tiếp tục cố gắng nhé!`;
    }

    startInitialCountdown();
});

/**
 * LMS Adapter for HSK 1 - Truy Đuổi Kẻ Trộm
 * Tương thích 100% với mọi hệ thống LMS:
 * - Moodle, Canvas LMS, Blackboard, Schoology, Google Classroom, Brightspace (D2L), TalentLMS
 * - SCORM 1.2 & SCORM 2004 (CMI API: Lesson Status, Score, Session Time, Commit, Terminate)
 * - Cross-Origin iFrame & Sandbox Resilience (Safe Storage fallback, Safe pushState)
 * - Auto-Resize postMessage (setHeight, resize, HSK1_RESIZE)
 * - Smart Fullscreen & Popout (Open in New Tab fallback when iframe blocks fullscreen)
 * - Web Audio API Synthesizer Fallback (Works 100% offline, intranet & firewalled schools)
 * - Toast Notification System
 */

(function (window) {
    'use strict';

    // 1. In-memory fallback if localStorage is blocked by sandboxed iframe
    const memoryStorage = {};

    const safeStorage = {
        getItem(key, defaultVal = null) {
            try {
                if (window.localStorage) {
                    const val = window.localStorage.getItem(key);
                    return val !== null ? val : defaultVal;
                }
            } catch (e) {
                // Blocked by LMS cross-origin iframe sandbox or 3rd-party cookie policy
            }
            try {
                if (window.sessionStorage) {
                    const val = window.sessionStorage.getItem(key);
                    return val !== null ? val : defaultVal;
                }
            } catch (e) {}
            return key in memoryStorage ? memoryStorage[key] : defaultVal;
        },
        setItem(key, value) {
            try {
                if (window.localStorage) {
                    window.localStorage.setItem(key, value);
                    return;
                }
            } catch (e) {
                // Fallback to in-memory store
            }
            try {
                if (window.sessionStorage) {
                    window.sessionStorage.setItem(key, value);
                    return;
                }
            } catch (e) {}
            memoryStorage[key] = String(value);
        },
        removeItem(key) {
            try {
                if (window.localStorage) {
                    window.localStorage.removeItem(key);
                }
            } catch (e) {}
            try {
                if (window.sessionStorage) {
                    window.sessionStorage.removeItem(key);
                }
            } catch (e) {}
            delete memoryStorage[key];
        }
    };

    window.safeStorage = safeStorage;

    // 2. LMS Adapter Core
    const LMSAdapter = {
        isSCORM: false,
        scormVersion: null, // '1.2' or '2004'
        apiHandle: null,
        isInitialized: false,
        startTime: new Date(),
        isInIframe: false,
        audioCtx: null,

        /**
         * Safely discover SCORM API (API for 1.2, API_1484_11 for 2004)
         */
        findAPI(win) {
            let findAttempts = 0;
            const maxAttempts = 10;
            let current = win;

            while (current && findAttempts < maxAttempts) {
                try {
                    if (current.API) {
                        this.scormVersion = '1.2';
                        return current.API;
                    }
                    if (current.API_1484_11) {
                        this.scormVersion = '2004';
                        return current.API_1484_11;
                    }
                } catch (e) {
                    // Cross-origin boundary reached
                    break;
                }

                try {
                    if (current.parent && current.parent !== current) {
                        current = current.parent;
                    } else if (current.opener) {
                        current = current.opener;
                    } else {
                        break;
                    }
                } catch (e) {
                    break;
                }
                findAttempts++;
            }
            return null;
        },

        /**
         * Initialize LMS connection (SCORM, iFrame detection, postMessage, Auto-resize)
         */
        init() {
            if (this.isInitialized) return;

            // Detect if inside an iframe
            try {
                this.isInIframe = (window.self !== window.top);
            } catch (e) {
                this.isInIframe = true;
            }

            if (this.isInIframe && document.body) {
                document.body.classList.add('embedded-lms');
            }

            // 1. Detect SCORM
            try {
                this.apiHandle = this.findAPI(window);
                if (this.apiHandle) {
                    this.isSCORM = true;
                    if (this.scormVersion === '1.2') {
                        const initRes = this.apiHandle.LMSInitialize("");
                        if (initRes === "true" || initRes === true) {
                            this.apiHandle.LMSSetValue("cmi.core.lesson_status", "incomplete");
                            this.apiHandle.LMSCommit("");
                            console.log("[LMSAdapter] SCORM 1.2 Initialized successfully");
                        }
                    } else if (this.scormVersion === '2004') {
                        const initRes = this.apiHandle.Initialize("");
                        if (initRes === "true" || initRes === true) {
                            this.apiHandle.SetValue("cmi.completion_status", "incomplete");
                            this.apiHandle.SetValue("cmi.success_status", "unknown");
                            this.apiHandle.Commit("");
                            console.log("[LMSAdapter] SCORM 2004 Initialized successfully");
                        }
                    }
                }
            } catch (e) {
                console.warn("[LMSAdapter] SCORM initialization note:", e);
            }

            // 2. Setup PostMessage Communication & Auto-resize
            this.setupPostMessage();

            // 3. Setup Unload Handlers for SCORM session termination
            window.addEventListener('beforeunload', () => this.terminate());
            window.addEventListener('unload', () => this.terminate());

            this.isInitialized = true;
            this.sendPostMessage('HSK1_LMS_READY', {
                title: 'HSK 1 - Truy Đuổi Kẻ Trộm',
                scorm: this.isSCORM,
                version: this.scormVersion,
                inIframe: this.isInIframe
            });
        },

        /**
         * Auto-report height & width to parent LMS iframe to eliminate scrollbars
         */
        setupPostMessage() {
            const reportSize = () => {
                try {
                    const height = Math.max(
                        document.body.scrollHeight || 0,
                        document.documentElement.scrollHeight || 0,
                        document.body.offsetHeight || 0,
                        document.documentElement.offsetHeight || 0
                    );
                    this.sendPostMessage('setHeight', { height });
                    this.sendPostMessage('resize', { height, width: window.innerWidth });
                    this.sendPostMessage('HSK1_RESIZE', { height });
                } catch (e) {}
            };

            window.addEventListener('resize', reportSize);
            window.addEventListener('load', reportSize);

            // Report height when DOM changes
            if (window.MutationObserver && document.body) {
                const observer = new MutationObserver(reportSize);
                observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            }

            // Listen for control commands from parent LMS
            window.addEventListener('message', (event) => {
                if (!event || !event.data) return;
                const data = event.data;
                const action = data.action || data.type;

                if (action === 'PAUSE' || action === 'HSK1_PAUSE') {
                    // Optional LMS pause handler
                } else if (action === 'RESTART' || action === 'HSK1_RESTART') {
                    window.location.reload();
                } else if (action === 'MUTE' || action === 'HSK1_MUTE') {
                    if (typeof window.toggleMusic === 'function' && window.isMusicPlaying) {
                        window.toggleMusic();
                    }
                } else if (action === 'UNMUTE' || action === 'HSK1_UNMUTE') {
                    if (typeof window.toggleMusic === 'function' && !window.isMusicPlaying) {
                        window.toggleMusic();
                    }
                } else if (action === 'HSK1_LMS_PROGRESS' && data.payload && this.isSCORM) {
                    // Forward progress reported from child popup window to SCORM
                    this.reportProgress(data.payload.detail, data.payload.isCorrect, data.payload.points);
                } else if (action === 'HSK1_LMS_COMPLETE' && data.payload && this.isSCORM) {
                    // Forward completion reported from child popup window to SCORM
                    this.reportComplete(data.payload.winner, data.payload.details, data.payload.score);
                }
            });
        },

        /**
         * Broadcast events to parent LMS window & opener if popup
         */
        sendPostMessage(action, payload = {}) {
            const message = {
                source: 'HSK1_BOARD_GAME',
                action: action,
                payload: payload,
                timestamp: Date.now()
            };
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(message, '*');
                }
            } catch (e) {}

            try {
                if (window.opener && window.opener !== window && !window.opener.closed) {
                    window.opener.postMessage(message, '*');
                }
            } catch (e) {}
        },

        /**
         * Format SCORM session time string (HH:MM:SS)
         */
        formatScormTime(startDate) {
            const diff = Math.max(0, Math.floor((new Date() - startDate) / 1000));
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            const pad = (n) => (n < 10 ? '0' + n : n);
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        },

        /**
         * Report Progress to LMS
         */
        reportProgress(detail, isCorrect, points = 10) {
            this.sendPostMessage('HSK1_LMS_PROGRESS', {
                detail: detail,
                isCorrect: isCorrect,
                points: points
            });
        },

        /**
         * Report Game Completion & Winner to SCORM & LMS
         */
        reportComplete(winner, details = {}, score = 100) {
            const sessionTime = this.formatScormTime(this.startTime);
            const scorePercent = Math.min(100, Math.max(0, Math.round(score)));
            const passed = scorePercent >= 60;

            // 1. SCORM reporting
            if (this.isSCORM && this.apiHandle) {
                try {
                    if (this.scormVersion === '1.2') {
                        this.apiHandle.LMSSetValue("cmi.core.score.raw", String(scorePercent));
                        this.apiHandle.LMSSetValue("cmi.core.score.min", "0");
                        this.apiHandle.LMSSetValue("cmi.core.score.max", "100");
                        this.apiHandle.LMSSetValue("cmi.core.session_time", sessionTime);
                        this.apiHandle.LMSSetValue("cmi.core.lesson_status", passed ? "passed" : "completed");
                        this.apiHandle.LMSCommit("");
                    } else if (this.scormVersion === '2004') {
                        this.apiHandle.SetValue("cmi.score.raw", String(scorePercent));
                        this.apiHandle.SetValue("cmi.score.scaled", String((scorePercent / 100).toFixed(2)));
                        this.apiHandle.SetValue("cmi.score.min", "0");
                        this.apiHandle.SetValue("cmi.score.max", "100");
                        this.apiHandle.SetValue("cmi.session_time", 'PT' + Math.floor((new Date() - this.startTime) / 1000) + 'S');
                        this.apiHandle.SetValue("cmi.completion_status", "completed");
                        this.apiHandle.SetValue("cmi.success_status", passed ? "passed" : "completed");
                        this.apiHandle.Commit("");
                    }
                    console.log(`[LMSAdapter] SCORM score committed: ${scorePercent}%`);
                } catch (e) {
                    console.warn("[LMSAdapter] SCORM score report note:", e);
                }
            }

            // 2. PostMessage event
            this.sendPostMessage('HSK1_LMS_COMPLETE', {
                winner: winner ? winner.name : 'Unknown',
                score: scorePercent,
                passed: passed,
                duration: sessionTime,
                details: details
            });
        },

        /**
         * Terminate SCORM session cleanly
         */
        terminate() {
            if (this.isSCORM && this.apiHandle) {
                try {
                    if (this.scormVersion === '1.2') {
                        this.apiHandle.LMSCommit("");
                        this.apiHandle.LMSFinish("");
                    } else if (this.scormVersion === '2004') {
                        this.apiHandle.Commit("");
                        this.apiHandle.Terminate("");
                    }
                    this.apiHandle = null;
                } catch (e) {}
            }
        },

        /**
         * Show toast notification on game interface
         */
        showToast(msg, duration = 2500) {
            let toast = document.getElementById('lms-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'lms-toast';
                toast.className = 'lms-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        },

        /**
         * Smart Fullscreen toggle with LMS iframe fallback
         */
        toggleFullscreen(targetElem = document.documentElement) {
            const isFsDisallowed = (document.fullscreenEnabled === false);

            if (this.isInIframe && isFsDisallowed) {
                this.openNewTab();
                return;
            }

            try {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    const req = targetElem.requestFullscreen || targetElem.webkitRequestFullscreen || targetElem.mozRequestFullScreen || targetElem.msRequestFullscreen;
                    if (req) {
                        const p = req.call(targetElem);
                        if (p && typeof p.then === 'function') {
                            p.then(() => {
                                this.showToast("⛶ Đã bật chế độ Toàn Màn Hình");
                            }).catch(() => {
                                if (this.isInIframe) {
                                    this.openNewTab();
                                } else {
                                    document.body.classList.toggle('app-fullscreen-mode');
                                    const isExpanded = document.body.classList.contains('app-fullscreen-mode');
                                    this.showToast(isExpanded ? "⛶ Đã mở rộng giao diện" : "🗗 Đã trở về chế độ chuẩn");
                                }
                            });
                            return;
                        }
                    }
                } else {
                    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
                    if (exit) {
                        exit.call(document);
                        document.body.classList.remove('app-fullscreen-mode');
                        this.showToast("🗗 Đã trở về chế độ chuẩn");
                    }
                }
            } catch (e) {
                if (this.isInIframe) {
                    this.openNewTab();
                } else {
                    document.body.classList.toggle('app-fullscreen-mode');
                    const isExpanded = document.body.classList.contains('app-fullscreen-mode');
                    this.showToast(isExpanded ? "⛶ Đã mở rộng giao diện" : "🗗 Đã trở về chế độ chuẩn");
                }
            }
        },

        /**
         * Safely open game in standalone new window (with bidirectional state sync)
         */
        openNewTab() {
            if (typeof window.openInNewWindow === 'function') {
                window.openInNewWindow();
                return;
            }
            if (typeof window.openGameInNewWindow === 'function') {
                window.openGameInNewWindow();
                return;
            }
            try {
                const targetUrl = new URL(window.location.href);
                targetUrl.searchParams.delete('state');
                targetUrl.hash = '';
                targetUrl.searchParams.set('popout', '1');

                let win = null;
                try {
                    win = window.open(targetUrl.toString(), 'HSK1_Standalone_Game', 'width=1240,height=880,resizable=yes');
                } catch (e) {}

                if (!win || win.closed || typeof win.closed === 'undefined') {
                    try { win = window.open(targetUrl.toString(), 'HSK1_Standalone_Game'); } catch (e) {}
                }

                if (!win || win.closed || typeof win.closed === 'undefined') {
                    try { win = window.open(targetUrl.toString(), '_blank'); } catch (e) {}
                }

                if (!win || win.closed || typeof win.closed === 'undefined') {
                    const a = document.createElement('a');
                    a.href = targetUrl.toString();
                    a.target = '_blank';
                    a.rel = 'noopener';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    win = true;
                }

                if (win) {
                    this.showToast("🚀 Đang mở trò chơi ở cửa sổ mới...");
                    return;
                }
            } catch (e) {
                console.warn("Popup blocked:", e);
            }
            this.showToast("⚠️ Trình duyệt đã chặn cửa sổ mới. Vui lòng cho phép popup.");
        },

        /**
         * Safe Audio Playback Wrapper (handles NotAllowedError and autoplay policies)
         */
        safePlayAudio(audio, synthFallbackType = null) {
            if (!audio) return;
            try {
                const p = audio.play();
                if (p && typeof p.catch === 'function') {
                    p.catch((err) => {
                        if (synthFallbackType) {
                            this.playSynthesizedSound(synthFallbackType);
                        }
                    });
                }
            } catch (e) {
                if (synthFallbackType) {
                    this.playSynthesizedSound(synthFallbackType);
                }
            }
        },

        /**
         * Web Audio API Synthesizer Fallback (Works 100% offline, intranet & firewalled schools)
         */
        getAudioContext() {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.audioCtx = new AudioCtx();
                }
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            return this.audioCtx;
        },

        playTone(freq, type = 'sine', duration = 0.2, gainVal = 0.2) {
            try {
                const ctx = this.getAudioContext();
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(gainVal, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (e) {}
        },

        playSynthesizedSound(type) {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            switch (type) {
                case 'correct':
                case 'ding':
                    [523.25, 659.25, 783.99].forEach((f, i) => {
                        setTimeout(() => this.playTone(f, 'triangle', 0.22, 0.2), i * 65);
                    });
                    break;
                case 'wrong':
                case 'buzz':
                    this.playTone(150, 'sawtooth', 0.3, 0.25);
                    setTimeout(() => this.playTone(110, 'sawtooth', 0.28, 0.25), 80);
                    break;
                case 'dice':
                case 'tick':
                    this.playTone(720, 'triangle', 0.04, 0.12);
                    break;
                case 'victory':
                case 'win':
                    [523, 659, 784, 1046].forEach((f, i) => {
                        setTimeout(() => this.playTone(f, 'sine', 0.3, 0.2), i * 80);
                    });
                    break;
                case 'lose':
                    [400, 350, 300, 240].forEach((f, i) => {
                        setTimeout(() => this.playTone(f, 'sawtooth', 0.25, 0.2), i * 90);
                    });
                    break;
            }
        }
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LMSAdapter.init());
    } else {
        LMSAdapter.init();
    }

    window.LMSAdapter = LMSAdapter;
    window.LMSBridge = LMSAdapter;

})(window);


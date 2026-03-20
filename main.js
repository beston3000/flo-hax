(function injectFlocabMasterBot() {
    if (document.getElementById('flocab-auto-ui')) return;

    // --- 1. DETECT CURRENT PAGE & ACTIVITY ---
    const currentUrl = window.location.href;
    const isVocab = currentUrl.includes('/vocab-game');
    const isRnR = currentUrl.includes('/read-and-respond');
    const isQuiz = currentUrl.includes('/quiz');
    
    const unitMatch = currentUrl.match(/\/unit\/([^\/]+)\//);
    const unitName = unitMatch ? unitMatch[1] : '';
    const assignMatch = currentUrl.match(/assignment=(\d+)/);
    const assignId = assignMatch ? assignMatch[1] : '';

    let activityName = isVocab ? "Vocab Game" : (isRnR ? "Read & Respond" : (isQuiz ? "Quiz" : "Unknown"));

    // --- 2. BUILD THE UI ---
    const ui = document.createElement('div');
    ui.id = 'flocab-auto-ui';
    ui.style.cssText = 'position:fixed; top:20px; right:20px; width:320px; background:#1e1e1e; color:#d4d4d4; border:1px solid #333; border-radius:8px; z-index:999999; font-family:monospace; font-size:12px; box-shadow:0 10px 25px rgba(0,0,0,0.8); display:flex; flex-direction:column; overflow:hidden;';

    const header = document.createElement('div');
    header.innerHTML = `⚙️ Flocab Master Bot v6.0<br><span style="font-size:10px; color:#aaa;">Mode: ${activityName}</span>`;
    header.style.cssText = 'background:#2d2d2d; padding:10px; cursor:move; font-weight:bold; text-align:center; user-select:none; border-bottom:1px solid #444; color:#fff;';
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding:10px; display:flex; gap:10px; border-bottom:1px solid #333;';
    const startBtn = document.createElement('button'); startBtn.innerText = '▶ START'; startBtn.style.cssText = 'background:#0e632c; color:#fff; border:none; padding:6px; cursor:pointer; border-radius:4px; flex:1; font-weight:bold;';
    const stopBtn = document.createElement('button'); stopBtn.innerText = '⏹ STOP'; stopBtn.style.cssText = 'background:#8a1717; color:#fff; border:none; padding:6px; cursor:pointer; border-radius:4px; flex:1; font-weight:bold;';
    controls.append(startBtn, stopBtn);
    ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = 'height:180px; overflow-y:auto; padding:10px; background:#000; word-wrap:break-word;';
    ui.appendChild(logArea);
    document.body.appendChild(ui);

    // Make UI Draggable
    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; initialX = ui.offsetLeft; initialY = ui.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (!isDragging) return; ui.style.left = `${initialX + e.clientX - startX}px`; ui.style.top = `${initialY + e.clientY - startY}px`; ui.style.right = 'auto'; });
    document.addEventListener('mouseup', () => isDragging = false);

    function log(msg, type = 'info') {
        const colors = { info: '#aaa', success: '#4af', warn: '#fd0', error: '#f55', nav: '#d853ff' };
        logArea.innerHTML += `<div style="margin-bottom:4px; color:${colors[type]}">${msg}</div>`;
        logArea.scrollTop = logArea.scrollHeight; 
    }

    // --- 3. DATA INTERCEPTOR (Fetch + XHR Hooks) ---
    let correctIds = new Set();
    let vocabDictionary = [];

    function processNetworkData(url, data) {
        // Read & Respond / Quiz Answer Parsing
        if (url.includes('/api/read-and-respond-questions/') || url.includes('/api/quiz_attempts/')) {
            const list = data.quiz ? data.quiz.questions : data;
            list.forEach(item => {
                const question = item.question || item;
                if (question.option_set) {
                    question.option_set.forEach(opt => {
                        if (opt.is_correct) correctIds.add(opt.id.toString());
                    });
                }
            });
            if (correctIds.size > 0) log(`Locked onto ${correctIds.size} precise answer IDs!`, 'success');
        }
        
        // Vocab Game Parsing
        if (url.includes('/api/definition/')) {
            vocabDictionary = data.map(item => ({
                word: item.term_display.toUpperCase(),
                def: item.text,
                ex: item.example ? item.example.replace(/_/g, '').replace(/\s+/g, ' ').trim() : ''
            }));
            if (vocabDictionary.length > 0) log(`Loaded ${vocabDictionary.length} vocab words directly from network!`, 'success');
        }
    }

    // Hook Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            if (url.includes('/api/')) {
                const clone = response.clone();
                clone.json().then(data => processNetworkData(url, data)).catch(e => {});
            }
        } catch(e) {}
        return response;
    };

    // Hook XHR
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            try {
                if (typeof url !== 'string') return;
                const data = JSON.parse(this.responseText);
                processNetworkData(url, data);
            } catch(e) {}
        });
        origOpen.apply(this, arguments);
    };

    log('Network Hook active. Ready for activity.', 'warn');

    // --- 4. NAVIGATION LOGIC ---
    function navigateToNextActivity() {
        if (!unitName || !assignId) {
            log('Could not determine next URL. Stopping.', 'error');
            return;
        }
        if (isVocab) {
            log('Navigating to Read & Respond...', 'nav');
            window.location.href = `/unit/${unitName}/read-and-respond/?assignment=${assignId}`;
        } else if (isRnR) {
            log('Navigating to Quiz...', 'nav');
            window.location.href = `/unit/${unitName}/quiz/?assignment=${assignId}`;
        } else if (isQuiz) {
            log('🎉 All activities completed!', 'success');
            isRunning = false;
        }
    }

    // --- 5. BOT LOOP ---
    let isRunning = false;
    let loopTimer = null;
    let musicMuted = false;

    function runLoop() {
        if (!isRunning) return;

        const allButtons = Array.from(document.querySelectorAll('button'));

        // --- PRE-GAME PHASE: Handle Start Screen & Music ---
        const startGameBtn = allButtons.find(b => b.innerText.trim().toUpperCase() === 'START GAME' || b.innerText.trim().toUpperCase() === 'START');
        if (startGameBtn) {
            if (!musicMuted) {
                // Find anything resembling a music or volume toggle
                const musicBtn = allButtons.find(b => 
                    b.innerText.toLowerCase().includes('music') || 
                    b.className.toLowerCase().includes('music') || 
                    b.className.toLowerCase().includes('volume')
                );
                
                if (musicBtn) {
                    log('Muting music...', 'info');
                    musicBtn.click();
                }
                musicMuted = true;
            }
            
            log('Starting game automatically...', 'success');
            startGameBtn.click();
            loopTimer = setTimeout(runLoop, 2000); // Wait for animations to finish
            return;
        }

        // --- PHASE 1: CHECK FOR SUBMIT/FINISH ---
        const finishBtn = allButtons.find(b => ['SUBMIT', 'SUBMIT ASSIGNMENT', 'FINISH'].includes(b.innerText.trim().toUpperCase()));
        if (finishBtn) {
            log('Activity Complete! Clicking Submit...', 'success');
            finishBtn.click();
            setTimeout(navigateToNextActivity, 2000); // Wait 2 seconds then go to next page
            return; 
        }

        // --- PHASE 2: SOLVE READ & RESPOND / QUIZ ---
        if (isRnR || isQuiz) {
            const radios = document.querySelectorAll('input[type="radio"]');
            let clickedOption = false;
            
            radios.forEach(radio => {
                if (correctIds.has(radio.value)) {
                    if (!radio.checked) {
                        log(`Selecting precise correct option...`, 'success');
                        radio.click();
                    }
                    clickedOption = true;
                }
            });

            const actionBtn = document.querySelector('.rnr-button-next') || allButtons.find(b => ['NEXT', 'NEXT QUESTION', 'CONFIRM ANSWER'].includes(b.innerText.trim().toUpperCase()));
            
            if (actionBtn) {
                const text = actionBtn.innerText.trim().toUpperCase();
                if (text === 'CONFIRM ANSWER' && clickedOption) {
                    setTimeout(() => { if(isRunning) actionBtn.click(); }, 400);
                } else if (text !== 'CONFIRM ANSWER') {
                    actionBtn.click();
                }
            }
        } 
        
        // --- PHASE 3: SOLVE VOCAB GAME ---
        else if (isVocab) {
            const pageText = document.body.innerText.replace(/\s+/g, ' ');
            let targetWord = null;

            for (let v of vocabDictionary) {
                if (pageText.includes(v.def) || (v.ex && pageText.includes(v.ex))) {
                    targetWord = v.word;
                    break;
                }
            }

            if (targetWord) {
                const clickable = Array.from(document.querySelectorAll('button, div')).find(el => 
                    el.innerText.trim().toUpperCase() === targetWord && (el.tagName === 'BUTTON' || window.getComputedStyle(el).cursor === 'pointer')
                );
                if (clickable) {
                    log(`Matched word "${targetWord}". Clicking...`, 'success');
                    clickable.click();
                }
            }

            // Click Continue if present
            const continueBtn = allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
            if (continueBtn) continueBtn.click();
        }

        loopTimer = setTimeout(runLoop, 1500);
    }

    // --- BUTTON LISTENERS ---
    startBtn.addEventListener('click', () => {
        if (isRunning) return;
        isRunning = true;
        log('--- BOT STARTED ---', 'success');
        runLoop();
    });

    stopBtn.addEventListener('click', () => {
        isRunning = false;
        clearTimeout(loopTimer);
        log('--- BOT STOPPED ---', 'error');
    });

})();

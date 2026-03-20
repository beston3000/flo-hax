(function injectFlocabMasterBotV7() {
    if (document.getElementById('flocab-auto-ui')) {
        console.warn("UI already exists!");
        return;
    }

    // --- 1. DETECT CURRENT PAGE ---
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
    ui.style.cssText = 'position:fixed; top:20px; right:20px; width:340px; background:#1e1e1e; color:#d4d4d4; border:1px solid #333; border-radius:8px; z-index:999999; font-family:monospace; font-size:12px; box-shadow:0 10px 25px rgba(0,0,0,0.8); display:flex; flex-direction:column; overflow:hidden;';

    const header = document.createElement('div');
    header.innerHTML = `⚙️ Flocab Master Bot v7.0<br><span style="font-size:10px; color:#aaa;">Mode: ${activityName} | High-Debug Mode</span>`;
    header.style.cssText = 'background:#2d2d2d; padding:10px; cursor:move; font-weight:bold; text-align:center; user-select:none; border-bottom:1px solid #444; color:#fff;';
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding:10px; display:flex; gap:10px; border-bottom:1px solid #333;';
    const startBtn = document.createElement('button'); startBtn.innerText = '▶ START'; startBtn.style.cssText = 'background:#0e632c; color:#fff; border:none; padding:6px; cursor:pointer; border-radius:4px; flex:1; font-weight:bold;';
    const stopBtn = document.createElement('button'); stopBtn.innerText = '⏹ STOP'; stopBtn.style.cssText = 'background:#8a1717; color:#fff; border:none; padding:6px; cursor:pointer; border-radius:4px; flex:1; font-weight:bold;';
    controls.append(startBtn, stopBtn);
    ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = 'height:220px; overflow-y:auto; padding:10px; background:#000; word-wrap:break-word; font-size:11px;';
    ui.appendChild(logArea);
    document.body.appendChild(ui);

    // Make UI Draggable
    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; initialX = ui.offsetLeft; initialY = ui.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (!isDragging) return; ui.style.left = `${initialX + e.clientX - startX}px`; ui.style.top = `${initialY + e.clientY - startY}px`; ui.style.right = 'auto'; });
    document.addEventListener('mouseup', () => isDragging = false);

    function log(msg, type = 'info') {
        const colors = { info: '#aaa', success: '#4af', warn: '#fd0', error: '#f55', debug: '#888' };
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        logArea.innerHTML += `<div style="margin-bottom:4px;"><span style="color:#555">[${time}]</span> <span style="color:${colors[type]}">${msg}</span></div>`;
        logArea.scrollTop = logArea.scrollHeight; 
        console.log(`[FlocabBot] ${msg}`);
    }

    // --- 3. AGGRESSIVE DATA INTERCEPTOR ---
    let correctIds = new Set();
    let vocabDictionary = [];

    function processNetworkData(url, data) {
        log(`Parsing data from: ...${url.slice(-30)}`, 'debug');
        
        try {
            // Read & Respond / Quiz Answers
            if (url.includes('read-and-respond-questions') || url.includes('quiz_attempts')) {
                const list = data.quiz ? data.quiz.questions : data;
                let added = 0;
                list.forEach(item => {
                    const question = item.question || item;
                    if (question.option_set) {
                        question.option_set.forEach(opt => {
                            if (opt.is_correct) {
                                correctIds.add(opt.id.toString());
                                added++;
                            }
                        });
                    }
                });
                if (added > 0) log(`Locked onto ${added} answer IDs!`, 'success');
            }
            
            // Vocab Game Parsing
            if (url.includes('definition')) {
                // Determine if it's an array or wrapped in an object
                const items = Array.isArray(data) ? data : (data.results || []);
                let addedWords = [];
                
                items.forEach(item => {
                    if (item.term_display) {
                        vocabDictionary.push({
                            word: item.term_display.toUpperCase(),
                            def: item.text,
                            ex: item.example ? item.example.replace(/_/g, '').replace(/\s+/g, ' ').trim() : ''
                        });
                        addedWords.push(item.term_display.toUpperCase());
                    }
                });
                
                if (vocabDictionary.length > 0) {
                    log(`Loaded ${vocabDictionary.length} vocab words!`, 'success');
                    log(`Words: ${addedWords.join(', ')}`, 'debug');
                } else {
                    log(`Intercepted definition URL but found no words in JSON structure.`, 'error');
                    console.log("Dumped JSON:", data);
                }
            }
        } catch (err) {
            log(`Error parsing JSON: ${err.message}`, 'error');
        }
    }

    // Hook Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        if (url.includes('/api/')) {
            log(`Fetch spotted: ...${url.slice(-35)}`, 'debug');
        }

        const response = await originalFetch.apply(this, args);
        try {
            if (url.includes('read-and-respond') || url.includes('quiz_attempts') || url.includes('definition')) {
                const clone = response.clone();
                clone.json().then(data => processNetworkData(url, data)).catch(e => {});
            }
        } catch(e) {}
        return response;
    };

    // Hook XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            try {
                if (typeof url !== 'string') return;
                if (url.includes('read-and-respond') || url.includes('quiz_attempts') || url.includes('definition')) {
                    const data = JSON.parse(this.responseText);
                    processNetworkData(url, data);
                }
            } catch(e) {}
        });
        origOpen.apply(this, arguments);
    };

    log('Network Hooks active. Ready to intercept.', 'warn');

    // --- 4. BOT LOOP ---
    let isRunning = false;
    let loopTimer = null;

    function runLoop() {
        if (!isRunning) return;

        // Collect all text/buttons on the screen
        const allButtons = Array.from(document.querySelectorAll('button'));
        const allElements = Array.from(document.querySelectorAll('button, div, span'));

        // --- PHASE 1: PRE-GAME (START & MUSIC) ---
        const startNoMusicBtn = allButtons.find(b => b.innerText.trim().toUpperCase().includes('WITHOUT MUSIC'));
        if (startNoMusicBtn) {
            log('Clicking "Continue without music"...', 'success');
            startNoMusicBtn.click();
            loopTimer = setTimeout(runLoop, 2000); // Give it time to load the first question
            return;
        }

        const standardStartBtn = allButtons.find(b => b.innerText.trim().toUpperCase() === 'START GAME');
        if (standardStartBtn && !document.body.innerText.toUpperCase().includes('WITHOUT MUSIC')) {
             log('Clicking standard Start button...', 'success');
             standardStartBtn.click();
             loopTimer = setTimeout(runLoop, 2000);
             return;
        }

        // --- PHASE 2: CHECK FOR SUBMIT/FINISH ---
        const finishBtn = allButtons.find(b => ['SUBMIT', 'SUBMIT ASSIGNMENT', 'FINISH'].includes(b.innerText.trim().toUpperCase()));
        if (finishBtn) {
            log('Activity Complete! Submitting...', 'success');
            finishBtn.click();
            
            // Try to auto-navigate based on URL
            setTimeout(() => {
                if (!unitName || !assignId) return log('Could not auto-navigate.', 'warn');
                if (isVocab) window.location.href = `/unit/${unitName}/read-and-respond/?assignment=${assignId}`;
                else if (isRnR) window.location.href = `/unit/${unitName}/quiz/?assignment=${assignId}`;
                else if (isQuiz) { log('🎉 All assignments finished!', 'success'); isRunning = false; }
            }, 2500);
            return; 
        }

        // --- PHASE 3: READ & RESPOND / QUIZ ---
        if (isRnR || isQuiz) {
            const radios = document.querySelectorAll('input[type="radio"]');
            let clickedOption = false;
            
            radios.forEach(radio => {
                if (correctIds.has(radio.value)) {
                    if (!radio.checked) {
                        log(`Clicking radio option: ${radio.value}`, 'success');
                        radio.click();
                    }
                    clickedOption = true;
                }
            });

            const actionBtn = document.querySelector('.rnr-button-next') || allButtons.find(b => ['NEXT', 'NEXT QUESTION', 'CONFIRM ANSWER'].includes(b.innerText.trim().toUpperCase()));
            
            if (actionBtn) {
                const text = actionBtn.innerText.trim().toUpperCase();
                if (text === 'CONFIRM ANSWER' && clickedOption) {
                    setTimeout(() => { if(isRunning) actionBtn.click(); }, 300);
                } else if (text !== 'CONFIRM ANSWER') {
                    actionBtn.click();
                }
            }
        } 
        
        // --- PHASE 4: VOCAB GAME (VOCAB CIRCLES) ---
        else if (isVocab) {
            const pageText = document.body.innerText.replace(/\s+/g, ' ');
            let targetWord = null;

            // Search the dictionary to see which definition/example is on screen
            for (let v of vocabDictionary) {
                if (pageText.includes(v.def) || (v.ex && pageText.includes(v.ex))) {
                    targetWord = v.word;
                    break;
                }
            }

            if (targetWord) {
                // Find the Vocab Circle. We look for an element with EXACTLY the target word text, 
                // avoiding huge container divs. 
                const vocabCircle = allElements.find(el => {
                    const txt = el.innerText.trim().toUpperCase();
                    // Must match exactly, and element shouldn't contain massive amounts of text
                    return txt === targetWord && txt.length === targetWord.length;
                });

                if (vocabCircle) {
                    log(`Found Vocab Circle for "${targetWord}". Clicking...`, 'success');
                    vocabCircle.click();
                    
                    // Click continue immediately if it pops up
                    setTimeout(() => {
                        const continueBtn = Array.from(document.querySelectorAll('button')).find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                        if (continueBtn) continueBtn.click();
                    }, 500);
                }
            } else {
                // Fallback: If it couldn't find a matching word, just try to hit Next/Continue anyway
                const continueBtn = allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                if (continueBtn) continueBtn.click();
            }
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

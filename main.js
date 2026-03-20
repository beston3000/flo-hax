(async function injectSimpleMasterBotV11() {
    if (document.getElementById('flocab-auto-ui')) {
        console.warn("Flocab Bot is already running!");
        return;
    }

    // --- 1. UI SETUP ---
    const ui = document.createElement('div');
    ui.id = 'flocab-auto-ui';
    ui.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 360px; 
        background: rgba(17, 17, 27, 0.95); color: #cdd6f4; 
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; 
        z-index: 999999; font-family: 'Segoe UI', system-ui, sans-serif; 
        font-size: 13px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); 
        display: flex; flex-direction: column; overflow: hidden;
    `;

    const header = document.createElement('div');
    header.innerHTML = `
        <div style="font-size: 16px; margin-bottom: 2px;">🤖 <b>Flocab Master v11.0</b></div>
        <div id="flocab-status" style="font-size: 11px; color: #a6adc8;">Status: Initializing (Simple Mode)...</div>
    `;
    header.style.cssText = `
        background: rgba(255, 255, 255, 0.05); padding: 12px; cursor: move; 
        font-weight: bold; text-align: center; user-select: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 12px; display: flex; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
    
    const startBtn = document.createElement('button'); 
    startBtn.innerText = '▶ START BOT'; 
    startBtn.style.cssText = `
        background: #a6e3a1; color: #11111b; border: none; padding: 10px; 
        cursor: pointer; border-radius: 8px; flex: 1; font-weight: 800;
    `;
    
    const stopBtn = document.createElement('button'); 
    stopBtn.innerText = '⏹ PAUSE'; 
    stopBtn.style.cssText = `
        background: #f38ba8; color: #11111b; border: none; padding: 10px; 
        cursor: pointer; border-radius: 8px; flex: 0.5; font-weight: 800;
    `;
    
    controls.append(startBtn, stopBtn);
    ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = `
        height: 200px; overflow-y: auto; padding: 12px; background: transparent; 
        word-wrap: break-word; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px;
    `;
    ui.appendChild(logArea);
    document.body.appendChild(ui);

    // Make UI Draggable
    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; initialX = ui.offsetLeft; initialY = ui.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (!isDragging) return; ui.style.left = `${initialX + e.clientX - startX}px`; ui.style.top = `${initialY + e.clientY - startY}px`; ui.style.right = 'auto'; });
    document.addEventListener('mouseup', () => isDragging = false);

    function log(msg, type = 'info') {
        const colors = { info: '#bac2de', success: '#a6e3a1', warn: '#f9e2af', error: '#f38ba8', nav: '#cba6f7' };
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        logArea.innerHTML += `<div style="margin-bottom: 6px;"><span style="color:#585b70">[${time}]</span> <span style="color:${colors[type]}">${msg}</span></div>`;
        logArea.scrollTop = logArea.scrollHeight; 
    }

    function setStatus(text, color) {
        document.getElementById('flocab-status').innerHTML = `<span style="color:${color}">●</span> ${text}`;
    }

    // --- 2. NETWORK INTERCEPTOR (Safe & Clean) ---
    let correctIds = new Set();
    let vocabDictionary = [];

    function processNetworkData(url, data) {
        try {
            // Read & Respond / Quiz Answer IDs
            if (url.includes('read-and-respond-questions') || url.includes('quiz_attempts')) {
                const list = data.quiz ? data.quiz.questions : data;
                let added = 0;
                list.forEach(item => {
                    const question = item.question || item;
                    if (question.option_set) {
                        question.option_set.forEach(opt => {
                            if (opt.is_correct) { correctIds.add(opt.id.toString()); added++; }
                        });
                    }
                });
                if (added > 0) log(`[Database] Mapped ${added} precise answer IDs.`, 'success');
            }
            
            // Vocab Game Words & Definitions
            if (url.includes('definition')) {
                const items = Array.isArray(data) ? data : (data.results || []);
                let tempDict = [];
                items.forEach(item => {
                    if (item.term_display) {
                        tempDict.push({
                            word: item.term_display.toUpperCase(),
                            // Clean up text format for easier matching later
                            def: item.text.replace(/\s+/g, ' ').trim(),
                            ex: item.example ? item.example.replace(/_/g, '').replace(/\s+/g, ' ').trim() : ''
                        });
                    }
                });
                if (tempDict.length > 0) {
                    vocabDictionary = tempDict;
                    log(`[Database] Synced ${vocabDictionary.length} vocab words.`, 'success');
                }
            }
        } catch (err) { log(`Network parse error: ${err.message}`, 'error'); }
    }

    // Fetch Interceptor
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const response = await originalFetch.apply(this, args);
        try {
            if (url.includes('/api/')) {
                const clone = response.clone();
                clone.json().then(data => processNetworkData(url, data)).catch(e => {});
            }
        } catch(e) {}
        return response;
    };

    // Recover Missed Network Calls
    async function recoverPastNetworkCalls() {
        const resources = performance.getEntriesByType('resource');
        const missedUrls = resources.map(r => r.name).filter(n => n.includes('/api/definition') || n.includes('read-and-respond-questions') || n.includes('quiz_attempts'));
        const uniqueUrls = [...new Set(missedUrls)];
        
        for (let url of uniqueUrls) {
            try {
                const res = await originalFetch(url);
                const data = await res.json();
                processNetworkData(url, data);
            } catch (err) {}
        }
    }
    await recoverPastNetworkCalls();

    // --- 3. DOM NAVIGATION & BOT LOOP ---
    let isRunning = false;
    let loopTimer = null;

    function detectActivity() {
        const url = window.location.href;
        if (url.includes('/vocab-game')) return "Vocab Game";
        if (url.includes('/read-and-respond')) return "Read & Respond";
        if (url.includes('/quiz')) return "Quiz";
        return "Idle";
    }

    function clickSidebarLink(targetTextArray) {
        const elements = Array.from(document.querySelectorAll('a, button, span, div'));
        const link = elements.find(el => el.innerText && targetTextArray.includes(el.innerText.trim().toUpperCase()) && (el.tagName === 'A' || el.tagName === 'BUTTON' || window.getComputedStyle(el).cursor === 'pointer'));
        if (link) { link.click(); return true; }
        return false;
    }

    function runLoop() {
        if (!isRunning) return;

        const activity = detectActivity();
        setStatus(`Running: ${activity}`, '#a6e3a1');
        
        const allButtons = Array.from(document.querySelectorAll('button'));

        // --- PHASE 1: PRE-GAME & FINISH LOGIC ---
        const noMusicBtn = allButtons.find(b => b.innerText.toUpperCase().includes('WITHOUT MUSIC'));
        if (noMusicBtn) {
            log('Muting music...', 'success');
            noMusicBtn.click();
            loopTimer = setTimeout(runLoop, 2000);
            return;
        }

        const startBtn = allButtons.find(b => b.innerText.toUpperCase() === 'START GAME' || b.innerText.toUpperCase() === 'START');
        if (startBtn && !document.body.innerText.toUpperCase().includes('WITHOUT MUSIC')) {
             log('Clicking Start...', 'success');
             startBtn.click();
             loopTimer = setTimeout(runLoop, 2000);
             return;
        }

        const finishBtn = allButtons.find(b => ['SUBMIT', 'SUBMIT ASSIGNMENT', 'FINISH'].includes(b.innerText.trim().toUpperCase()));
        if (finishBtn) {
            log('Activity Complete! Submitting...', 'nav');
            finishBtn.click();
            setTimeout(() => {
                if (!isRunning) return;
                log('Navigating via Sidebar...', 'nav');
                if (activity === "Vocab Game") clickSidebarLink(['READ & RESPOND', 'READ AND RESPOND']);
                else if (activity === "Read & Respond") clickSidebarLink(['QUIZ']);
                else if (activity === "Quiz") { log('🎉 Unit Complete!', 'success'); isRunning = false; setStatus('Finished', '#cba6f7'); }
            }, 3000);
            return; 
        }

        // --- PHASE 2: QUIZ / READ AND RESPOND ---
        if (activity === "Read & Respond" || activity === "Quiz") {
            const radios = document.querySelectorAll('input[type="radio"]');
            let clickedOption = false;
            
            radios.forEach(radio => {
                if (correctIds.has(radio.value)) {
                    if (!radio.checked) radio.click();
                    clickedOption = true;
                }
            });

            const actionBtn = document.querySelector('.rnr-button-next') || allButtons.find(b => ['NEXT', 'NEXT QUESTION', 'CONFIRM ANSWER'].includes(b.innerText.trim().toUpperCase()));
            if (actionBtn) {
                if (actionBtn.innerText.trim().toUpperCase() === 'CONFIRM ANSWER' && clickedOption) {
                    setTimeout(() => { if(isRunning) actionBtn.click(); }, 300);
                } else if (actionBtn.innerText.trim().toUpperCase() !== 'CONFIRM ANSWER') {
                    actionBtn.click();
                }
            }
        } 
        
        // --- PHASE 3: VOCAB GAME (Pure Text Matching) ---
        else if (activity === "Vocab Game") {
            // Clean the screen text to make matching reliable
            const screenText = document.body.innerText.replace(/\s+/g, ' ');
            let targetWord = null;

            // Step A: Read HTML and match definition
            for (let vocab of vocabDictionary) {
                if (screenText.includes(vocab.def) || (vocab.ex && screenText.includes(vocab.ex))) {
                    targetWord = vocab.word;
                    break;
                }
            }

            // Step B: Search buttons for the target word
            if (targetWord) {
                const correctButton = allButtons.find(b => b.innerText.trim().toUpperCase() === targetWord);
                
                if (correctButton) {
                    log(`Found target word: ${targetWord}`, 'success');
                    correctButton.click();
                }
            } 
            
            // Step C: Click Continue/Next if on a transition screen
            const continueBtn = allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
            if (continueBtn) {
                continueBtn.click();
            }
        }

        loopTimer = setTimeout(runLoop, 1500);
    }

    // --- 4. BUTTON LISTENERS ---
    startBtn.addEventListener('click', () => {
        if (isRunning) return;
        isRunning = true;
        setStatus('Running', '#a6e3a1');
        log('--- BOT ENGAGED ---', 'success');
        runLoop();
    });

    stopBtn.addEventListener('click', () => {
        isRunning = false;
        clearTimeout(loopTimer);
        setStatus('Paused', '#f9e2af');
        log('--- BOT PAUSED ---', 'warn');
    });

    setStatus('Ready', '#89b4fa');
    log('V11 Initialized. Using Pure Text Matcher.', 'info');

})();

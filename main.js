(async function injectPersistentMasterBot() {
    if (document.getElementById('flocab-auto-ui')) {
        console.warn("Flocab Bot is already running!");
        return;
    }

    // --- 1. MODERN UI SETUP ---
    const ui = document.createElement('div');
    ui.id = 'flocab-auto-ui';
    ui.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 350px; 
        background: linear-gradient(145deg, #1e1e2e, #181825); 
        color: #cdd6f4; border: 1px solid #313244; border-radius: 12px; 
        z-index: 999999; font-family: 'Segoe UI', system-ui, sans-serif; 
        font-size: 13px; box-shadow: 0 12px 36px rgba(0,0,0,0.6); 
        display: flex; flex-direction: column; overflow: hidden;
        backdrop-filter: blur(10px);
    `;

    const header = document.createElement('div');
    header.innerHTML = `
        <div style="font-size: 15px; margin-bottom: 2px;">🎓 <b>Flocab Master Bot v8.0</b></div>
        <div id="flocab-status" style="font-size: 11px; color: #a6adc8; font-weight: normal;">Status: Injecting...</div>
    `;
    header.style.cssText = `
        background: #11111b; padding: 12px; cursor: move; 
        font-weight: bold; text-align: center; user-select: none;
        border-bottom: 1px solid #313244;
    `;
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 12px; display: flex; gap: 10px; border-bottom: 1px solid #313244;';
    
    const startBtn = document.createElement('button'); 
    startBtn.innerText = '▶ START BOT'; 
    startBtn.style.cssText = `
        background: #a6e3a1; color: #11111b; border: none; padding: 8px; 
        cursor: pointer; border-radius: 6px; flex: 1; font-weight: bold;
        transition: opacity 0.2s;
    `;
    startBtn.onmouseover = () => startBtn.style.opacity = '0.8';
    startBtn.onmouseout = () => startBtn.style.opacity = '1';
    
    const stopBtn = document.createElement('button'); 
    stopBtn.innerText = '⏹ PAUSE'; 
    stopBtn.style.cssText = `
        background: #f38ba8; color: #11111b; border: none; padding: 8px; 
        cursor: pointer; border-radius: 6px; flex: 1; font-weight: bold;
        transition: opacity 0.2s;
    `;
    stopBtn.onmouseover = () => stopBtn.style.opacity = '0.8';
    stopBtn.onmouseout = () => stopBtn.style.opacity = '1';
    
    controls.append(startBtn, stopBtn);
    ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = `
        height: 200px; overflow-y: auto; padding: 12px; background: #11111b; 
        word-wrap: break-word; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    `;
    ui.appendChild(logArea);
    document.body.appendChild(ui);

    // Make UI Draggable
    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; initialX = ui.offsetLeft; initialY = ui.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (!isDragging) return; ui.style.left = `${initialX + e.clientX - startX}px`; ui.style.top = `${initialY + e.clientY - startY}px`; ui.style.right = 'auto'; });
    document.addEventListener('mouseup', () => isDragging = false);

    function log(msg, type = 'info') {
        const colors = { info: '#bac2de', success: '#a6e3a1', warn: '#f9e2af', error: '#f38ba8', nav: '#cba6f7', debug: '#6c7086' };
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        logArea.innerHTML += `<div style="margin-bottom: 6px;"><span style="color:#585b70">[${time}]</span> <span style="color:${colors[type]}">${msg}</span></div>`;
        logArea.scrollTop = logArea.scrollHeight; 
    }

    function setStatus(text, color) {
        document.getElementById('flocab-status').innerHTML = `<span style="color:${color}">●</span> ${text}`;
    }

    // --- 2. DATA MANAGEMENT & NETWORK RECOVERY ---
    let correctIds = new Set();
    let vocabDictionary = [];

    function processNetworkData(url, data) {
        try {
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
                if (added > 0) log(`[Database] Mapped ${added} exact answer IDs.`, 'success');
            }
            
            if (url.includes('definition')) {
                const items = Array.isArray(data) ? data : (data.results || []);
                let tempDict = [];
                items.forEach(item => {
                    if (item.term_display) {
                        tempDict.push({
                            word: item.term_display.toUpperCase(),
                            def: item.text,
                            ex: item.example ? item.example.replace(/_/g, '').replace(/\s+/g, ' ').trim() : ''
                        });
                    }
                });
                if (tempDict.length > 0) {
                    vocabDictionary = tempDict;
                    log(`[Database] Synced ${vocabDictionary.length} vocab words.`, 'success');
                }
            }
        } catch (err) { log(`Parsing error: ${err.message}`, 'error'); }
    }

    // 2A. Real-time Network Interceptor
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

    // 2B. Retrospective Recovery (Finds requests made BEFORE bot injected)
    async function recoverPastNetworkCalls() {
        log('Scanning browser history for missed Flocab APIs...', 'debug');
        const resources = performance.getEntriesByType('resource');
        const missedUrls = resources.map(r => r.name).filter(n => n.includes('/api/definition') || n.includes('read-and-respond-questions') || n.includes('quiz_attempts'));
        
        // Remove duplicates
        const uniqueUrls = [...new Set(missedUrls)];
        
        for (let url of uniqueUrls) {
            log(`Recovering missed data: ${url.split('/api/')[1].split('?')[0]}`, 'warn');
            try {
                const res = await originalFetch(url);
                const data = await res.json();
                processNetworkData(url, data);
            } catch (err) {}
        }
    }
    
    // Execute recovery immediately
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

    // Clicks the sidebar to navigate without reloading the page
    function clickSidebarLink(targetTextArray) {
        const elements = Array.from(document.querySelectorAll('a, button, span, div'));
        const link = elements.find(el => {
            if (!el.innerText) return false;
            const text = el.innerText.trim().toUpperCase();
            return targetTextArray.includes(text) && (el.tagName === 'A' || el.tagName === 'BUTTON' || window.getComputedStyle(el).cursor === 'pointer');
        });
        
        if (link) {
            link.click();
            return true;
        }
        return false;
    }

    function runLoop() {
        if (!isRunning) return;

        const activity = detectActivity();
        setStatus(`Running: ${activity}`, '#a6e3a1');
        
        const allButtons = Array.from(document.querySelectorAll('button'));
        const allElements = Array.from(document.querySelectorAll('button, div, span'));
        const upperText = document.body.innerText.toUpperCase();

        // --- PHASE 1: PRE-GAME & MUSIC ---
        const noMusicBtn = allButtons.find(b => b.innerText.toUpperCase().includes('WITHOUT MUSIC'));
        if (noMusicBtn) {
            log('Muting music...', 'success');
            noMusicBtn.click();
            loopTimer = setTimeout(runLoop, 2000);
            return;
        }

        const startBtn = allButtons.find(b => b.innerText.toUpperCase() === 'START GAME' || b.innerText.toUpperCase() === 'START');
        if (startBtn && !upperText.includes('WITHOUT MUSIC')) {
             log('Clicking Start...', 'success');
             startBtn.click();
             loopTimer = setTimeout(runLoop, 2000);
             return;
        }

        // --- PHASE 2: AUTO-NAVIGATION ON FINISH ---
        const finishBtn = allButtons.find(b => ['SUBMIT', 'SUBMIT ASSIGNMENT', 'FINISH'].includes(b.innerText.trim().toUpperCase()));
        if (finishBtn) {
            log('Activity Complete! Submitting...', 'nav');
            finishBtn.click();
            
            setTimeout(() => {
                if (!isRunning) return;
                log('Navigating to next section via Sidebar...', 'nav');
                
                if (activity === "Vocab Game") {
                    clickSidebarLink(['READ & RESPOND', 'READ AND RESPOND']);
                } else if (activity === "Read & Respond") {
                    clickSidebarLink(['QUIZ']);
                } else if (activity === "Quiz") {
                    log('🎉 Unit Complete! Bot pausing.', 'success');
                    isRunning = false;
                    setStatus('Finished', '#cba6f7');
                }
            }, 3000); // Wait 3s for Flocabulary to save the score
            return; 
        }

        // --- PHASE 3: READ & RESPOND / QUIZ ---
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
                const text = actionBtn.innerText.trim().toUpperCase();
                if (text === 'CONFIRM ANSWER' && clickedOption) {
                    setTimeout(() => { if(isRunning) actionBtn.click(); }, 300);
                } else if (text !== 'CONFIRM ANSWER') {
                    actionBtn.click();
                }
            }
        } 
        
        // --- PHASE 4: VOCAB GAME ---
        else if (activity === "Vocab Game") {
            const pageText = document.body.innerText.replace(/\s+/g, ' ');
            let targetWord = null;

            for (let v of vocabDictionary) {
                if (pageText.includes(v.def) || (v.ex && pageText.includes(v.ex))) {
                    targetWord = v.word; break;
                }
            }

            if (targetWord) {
                // Find vocab circle (strictly matching text length to avoid clicking big container divs)
                const vocabCircle = allElements.find(el => {
                    const txt = el.innerText.trim().toUpperCase();
                    return txt === targetWord && txt.length === targetWord.length;
                });

                if (vocabCircle) {
                    vocabCircle.click();
                    setTimeout(() => {
                        const next = Array.from(document.querySelectorAll('button')).find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                        if (next) next.click();
                    }, 400);
                }
            } else {
                // Hit Next if stuck on a transition screen
                const next = allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                if (next) next.click();
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
    log('UI Injected. Ready to dominate.', 'info');

})();

(async function injectSuperDebugBotV11_11() {
    if (document.getElementById('flocab-auto-ui')) {
        document.getElementById('flocab-auto-ui').remove(); 
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
        <div style="font-size: 16px; margin-bottom: 2px;">🤖 <b>Flocab Master v11.11</b></div>
        <div id="flocab-status" style="font-size: 11px; color: #a6adc8;">Status: Ghostwriter Upgrade...</div>
    `;
    header.style.cssText = `background: rgba(255, 255, 255, 0.05); padding: 12px; cursor: move; font-weight: bold; text-align: center; user-select: none; border-bottom: 1px solid rgba(255, 255, 255, 0.05);`;
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 12px; display: flex; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
    
    const startBtn = document.createElement('button'); startBtn.innerText = '▶ START BOT'; 
    startBtn.style.cssText = `background: #a6e3a1; color: #11111b; border: none; padding: 10px; cursor: pointer; border-radius: 8px; flex: 1; font-weight: 800;`;
    const stopBtn = document.createElement('button'); stopBtn.innerText = '⏹ PAUSE'; 
    stopBtn.style.cssText = `background: #f38ba8; color: #11111b; border: none; padding: 10px; cursor: pointer; border-radius: 8px; flex: 0.5; font-weight: 800;`;
    
    controls.append(startBtn, stopBtn); ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = `height: 200px; overflow-y: auto; padding: 12px; background: transparent; word-wrap: break-word; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px;`;
    ui.appendChild(logArea); document.body.appendChild(ui);

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
    function setStatus(text, color) { document.getElementById('flocab-status').innerHTML = `<span style="color:${color}">●</span> ${text}`; }
    function sanitizeStr(str) { return (str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }

    // --- 2. NETWORK INTERCEPTOR ---
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
                        question.option_set.forEach(opt => { if (opt.is_correct) { correctIds.add(opt.id.toString()); added++; } });
                    }
                });
                if (added > 0) log(`[Database] Mapped ${added} answer IDs.`, 'success');
            }
            if (url.includes('definition')) {
                const items = Array.isArray(data) ? data : (data.results || []);
                let tempDict = [];
                items.forEach(item => {
                    if (item.term_display) {
                        tempDict.push({
                            word: item.term_display.toUpperCase(),
                            def: item.text,
                            rawEx: item.example || ''
                        });
                    }
                });
                if (tempDict.length > 0) {
                    vocabDictionary = tempDict;
                    log(`[Database] Synced ${vocabDictionary.length} vocab words.`, 'success');
                }
            }
        } catch (err) { console.error(`Network parse error:`, err); }
    }

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

    async function recoverPastNetworkCalls() {
        const resources = performance.getEntriesByType('resource');
        const missedUrls = resources.map(r => r.name).filter(n => n.includes('/api/definition') || n.includes('read-and-respond-questions') || n.includes('quiz_attempts'));
        const uniqueUrls = [...new Set(missedUrls)];
        for (let url of uniqueUrls) {
            try { const res = await originalFetch(url); const data = await res.json(); processNetworkData(url, data); } catch (err) {}
        }
    }
    await recoverPastNetworkCalls();

    // --- 3. BOT ENGINE ---
    let isRunning = false;
    let loopTimer = null;

    function runLoop() {
        if (!isRunning) return;

        const url = window.location.href;
        const activity = url.includes('/vocab-game') ? "Vocab Game" : 
                         url.includes('/read-and-respond') ? "Read & Respond" : 
                         url.includes('/quiz') ? "Quiz" : 
                         url.includes('/video') ? "Video" : 
                         url.includes('/vocab-cards') ? "Vocab Cards" : "Idle";
        
        setStatus(`Running: ${activity}`, '#a6e3a1');
        const allButtons = Array.from(document.querySelectorAll('button'));

        // --- PRE-GAME / FINISH logic ---
        const noMusicBtn = allButtons.find(b => b.innerText.toUpperCase().includes('WITHOUT MUSIC') && b.offsetParent !== null);
        if (noMusicBtn) { noMusicBtn.click(); loopTimer = setTimeout(runLoop, 2000); return; }

        const startBtn = allButtons.find(b => (b.innerText.toUpperCase() === 'START GAME' || b.innerText.toUpperCase() === 'START') && b.offsetParent !== null);
        if (startBtn && !document.body.innerText.toUpperCase().includes('WITHOUT MUSIC')) { startBtn.click(); loopTimer = setTimeout(runLoop, 2000); return; }

        const finishBtn = allButtons.find(b => ['SUBMIT', 'SUBMIT ASSIGNMENT', 'FINISH'].includes(b.innerText.trim().toUpperCase()) && b.offsetParent !== null);
        if (finishBtn) {
            log('Activity Complete! Clicking Submit...', 'success');
            finishBtn.click();
            setTimeout(() => {
                if (!isRunning) return;
                const elements = Array.from(document.querySelectorAll('a, button, span, div'));
                let nextTarget = activity === "Vocab Game" ? ['READ & RESPOND', 'READ AND RESPOND'] : activity === "Read & Respond" ? ['QUIZ'] : null;
                if(nextTarget) {
                    const link = elements.find(el => el.innerText && nextTarget.includes(el.innerText.trim().toUpperCase()) && window.getComputedStyle(el).cursor === 'pointer');
                    if (link) link.click();
                } else if (activity === "Quiz" || activity === "Vocab Cards") { log('🎉 Unit Complete!', 'success'); isRunning = false; setStatus('Finished', '#cba6f7'); }
            }, 3000);
            return; 
        }

        // --- NEW: VOCAB CARDS GHOSTWRITER ---
        if (activity === "Vocab Cards") {
            const nextIncompleteCard = document.querySelector('.vocab__assignment--nextIncompleteCard');
            const modalTitle = document.getElementById('bcl-modal-title');
            
            // State A: We are on the main menu, open the next card
            if (!modalTitle && nextIncompleteCard) {
                log('[Vocab Cards] Opening next incomplete card...', 'nav');
                nextIncompleteCard.click();
                loopTimer = setTimeout(runLoop, 1500);
                return;
            }

            // State B/C/D: We are inside a Card Modal
            if (modalTitle) {
                const currentWord = modalTitle.innerText.trim();
                
                // State B: Click "Write with this word"
                const writeBtn = document.querySelector('[aria-label="Write with this word"]');
                if (writeBtn) {
                    log(`[Vocab Cards] Activating editor for: ${currentWord}`, 'nav');
                    writeBtn.click();
                    loopTimer = setTimeout(runLoop, 1000);
                    return;
                }

                // State C: Editor is open, time to write
                const textArea = document.getElementById('vocab-example-textarea');
                if (textArea) {
                    const saveBtn = allButtons.find(b => b.innerText.trim().toUpperCase() === 'SAVE');
                    
                    if (!textArea.value || textArea.value.trim() === '') {
                        // Find the word in our intercepted dictionary
                        let currentWordObj = vocabDictionary.find(v => v.word.toLowerCase() === currentWord.toLowerCase());
                        
                        // Default sentence if we can't find it
                        let sentenceToType = `I learned about ${currentWord.toLowerCase()} today in class.`;
                        
                        if (currentWordObj && currentWordObj.rawEx) {
                            // Inject the official Flocabulary sentence!
                            sentenceToType = currentWordObj.rawEx.replace(/_/g, currentWordObj.word.toLowerCase());
                        }
                        
                        log(`[Ghostwriter] Injecting: "${sentenceToType.substring(0, 25)}..."`, 'success');
                        
                        // React Injection Bypass
                        let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                        nativeInputValueSetter.call(textArea, sentenceToType);
                        textArea.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        loopTimer = setTimeout(runLoop, 1000); 
                        return;
                    } 
                    // Text is in the box, hit Save
                    else if (saveBtn && !saveBtn.disabled) {
                        log(`[Vocab Cards] Saving card...`, 'success');
                        saveBtn.click();
                        loopTimer = setTimeout(runLoop, 1500);
                        return;
                    }
                }

                // State D: Card is saved, move to the next one
                const nextArrowBtn = document.querySelector('[aria-label="Go to Next Card"]');
                const closeBtn = document.querySelector('[aria-label="Close modal"]');
                
                if (nextArrowBtn && !nextArrowBtn.disabled) {
                    log(`[Vocab Cards] Moving to next card...`, 'nav');
                    nextArrowBtn.click();
                } else if (closeBtn) {
                    log(`[Vocab Cards] All cards complete! Closing modal...`, 'nav');
                    closeBtn.click();
                }
            }
        }

        // --- VIDEO SKIPPER ---
        else if (activity === "Video") {
            const videoEl = document.querySelector('video');
            if (videoEl && videoEl.readyState > 0 && !videoEl.ended) {
                if (videoEl.currentTime < videoEl.duration - 1) {
                    log(`Fast-forwarding video...`, 'nav');
                    videoEl.muted = true;
                    videoEl.play().catch(() => {});
                    videoEl.currentTime = videoEl.duration - 0.5;
                }
            } else if (videoEl && videoEl.ended) {
                const nextButton = document.querySelector('[data-testid="next-question-button"]') || allButtons.find(b => (b.getAttribute('aria-label') || '').toUpperCase().includes('NEXT')) || allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                if (nextButton && !nextButton.disabled && window.getComputedStyle(nextButton).pointerEvents !== 'none') {
                    nextButton.click();
                }
            }
        }

        // --- R&R / QUIZ ---
        else if (activity === "Read & Respond" || activity === "Quiz") {
            const radios = document.querySelectorAll('input[type="radio"]');
            let clickedOption = false;
            radios.forEach(radio => {
                if (correctIds.has(radio.value)) {
                    if (!radio.checked) {
                        const label = document.querySelector(`label[for="${radio.id}"]`);
                        if (label) label.click(); else radio.click(); 
                    }
                    clickedOption = true;
                }
            });

            const actionBtn = document.querySelector('.rnr-button-next') || allButtons.find(b => ['NEXT', 'NEXT QUESTION', 'CONFIRM ANSWER'].includes(b.innerText.trim().toUpperCase()));
            if (actionBtn && !actionBtn.disabled && !actionBtn.classList.contains('disabled')) {
                if (actionBtn.innerText.trim().toUpperCase() === 'CONFIRM ANSWER' && clickedOption) { setTimeout(() => { if(isRunning) actionBtn.click(); }, 300); } 
                else if (actionBtn.innerText.trim().toUpperCase() !== 'CONFIRM ANSWER') { actionBtn.click(); }
            }
        } 
        
        // --- VOCAB GAME ---
        else if (activity === "Vocab Game") {
            const nextButton = document.querySelector('[data-testid="next-question-button"]') || allButtons.find(b => (b.getAttribute('aria-label') || '').toUpperCase().includes('NEXT')) || allButtons.find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
            if (nextButton && !nextButton.disabled && window.getComputedStyle(nextButton).pointerEvents !== 'none') {
                nextButton.click(); loopTimer = setTimeout(runLoop, 1500); return;
            }

            const qc = document.querySelector('[data-testid="question-content"]') || document.querySelector('.vocabGame__questionContainer') || document.body;
            let cleanScreenText = (qc.textContent || qc.innerText).replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').toLowerCase().trim();
            let targetWord = null;

            if (cleanScreenText.length > 5) {
                for (let vocab of vocabDictionary) {
                    let cleanDef = vocab.def.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').toLowerCase().trim();
                    if (cleanScreenText.includes(cleanDef) || cleanDef.includes(cleanScreenText)) { targetWord = vocab.word; break; }
                    if (vocab.rawEx) {
                        let exChunks = vocab.rawEx.split('_');
                        for (let chunk of exChunks) {
                            let cleanChunk = chunk.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').toLowerCase().trim();
                            if (cleanChunk.length > 8 && (cleanScreenText.includes(cleanChunk) || cleanChunk.includes(cleanScreenText))) {
                                targetWord = vocab.word; break;
                            }
                        }
                        if (targetWord) break;
                    }
                }
            }

            if (targetWord) {
                const optionElements = Array.from(document.querySelectorAll('button.option, button, [data-testid="question-option-draggable"] button'));
                const safeTarget = sanitizeStr(targetWord);
                for (let b of optionElements) {
                    const txt = sanitizeStr(b.textContent || b.innerText || "");
                    const aria = sanitizeStr(b.getAttribute('aria-label') || "");
                    if ((txt === safeTarget || aria.includes(safeTarget)) && !b.classList.contains('chosen')) {
                        b.click(); break;
                    }
                }
            }
        }

        loopTimer = setTimeout(runLoop, 1500);
    }

    // --- 4. LISTENERS ---
    startBtn.addEventListener('click', () => {
        if (isRunning) return; isRunning = true; setStatus('Running', '#a6e3a1');
        log('Bot Started. Ghostwriter module is active.', 'success'); runLoop();
    });
    stopBtn.addEventListener('click', () => {
        isRunning = false; clearTimeout(loopTimer); setStatus('Paused', '#f9e2af'); log('Bot Paused.', 'warn');
    });
})();

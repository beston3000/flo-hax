(async function injectReactHackerBot() {
    if (document.getElementById('flocab-auto-ui')) {
        console.warn("Flocab Bot is already running!");
        return;
    }

    // --- 1. PREMIUM GLASSMORPHISM UI ---
    const ui = document.createElement('div');
    ui.id = 'flocab-auto-ui';
    ui.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 360px; 
        background: rgba(17, 17, 27, 0.85); color: #cdd6f4; 
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; 
        z-index: 999999; font-family: 'Segoe UI', system-ui, sans-serif; 
        font-size: 13px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); 
        display: flex; flex-direction: column; overflow: hidden;
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    `;

    const header = document.createElement('div');
    header.innerHTML = `
        <div style="font-size: 16px; margin-bottom: 2px;">🤖 <b>Flocab React-Hacker v9.0</b></div>
        <div id="flocab-status" style="font-size: 11px; color: #a6adc8; font-weight: normal;">Status: Initializing...</div>
    `;
    header.style.cssText = `
        background: rgba(255, 255, 255, 0.03); padding: 14px; cursor: move; 
        font-weight: bold; text-align: center; user-select: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    ui.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 12px; display: flex; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
    
    const startBtn = document.createElement('button'); 
    startBtn.innerText = '▶ START AUTO-PILOT'; 
    startBtn.style.cssText = `
        background: linear-gradient(135deg, #a6e3a1, #94e2d5); color: #11111b; 
        border: none; padding: 10px; cursor: pointer; border-radius: 8px; 
        flex: 1; font-weight: 800; font-size: 12px; transition: transform 0.1s, opacity 0.2s;
    `;
    startBtn.onmouseover = () => startBtn.style.opacity = '0.85';
    startBtn.onmouseout = () => startBtn.style.opacity = '1';
    startBtn.onmousedown = () => startBtn.style.transform = 'scale(0.96)';
    startBtn.onmouseup = () => startBtn.style.transform = 'scale(1)';
    
    const stopBtn = document.createElement('button'); 
    stopBtn.innerText = '⏹ PAUSE'; 
    stopBtn.style.cssText = `
        background: rgba(243, 139, 168, 0.15); color: #f38ba8; 
        border: 1px solid rgba(243, 139, 168, 0.4); padding: 10px; 
        cursor: pointer; border-radius: 8px; flex: 0.5; font-weight: 800; 
        font-size: 12px; transition: opacity 0.2s;
    `;
    stopBtn.onmouseover = () => stopBtn.style.background = 'rgba(243, 139, 168, 0.25)';
    stopBtn.onmouseout = () => stopBtn.style.background = 'rgba(243, 139, 168, 0.15)';
    
    controls.append(startBtn, stopBtn);
    ui.appendChild(controls);

    const logArea = document.createElement('div');
    logArea.style.cssText = `
        height: 220px; overflow-y: auto; padding: 12px; background: transparent; 
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
        const colors = { info: '#bac2de', success: '#a6e3a1', warn: '#f9e2af', error: '#f38ba8', nav: '#cba6f7', debug: '#6c7086' };
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        logArea.innerHTML += `<div style="margin-bottom: 6px;"><span style="color:#585b70">[${time}]</span> <span style="color:${colors[type]}">${msg}</span></div>`;
        logArea.scrollTop = logArea.scrollHeight; 
    }

    function setStatus(text, color) {
        document.getElementById('flocab-status').innerHTML = `<span style="color:${color}">●</span> ${text}`;
    }

    // --- 2. REACT VIRTUAL-DOM HACKER ENGINE ---
    // Recursively searches the React Component tree for the hidden "is_correct" flag in memory
    function extractReactAnswer(domSelector) {
        const targetNode = document.querySelector(domSelector);
        if (!targetNode) return null;
        
        const fiberKey = Object.keys(targetNode).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return null;
        
        let fiber = targetNode[fiberKey];
        for (let i = 0; i < 25; i++) {
            if (!fiber) break;
            if (fiber.memoizedProps) {
                // Deep scan memory object for correct answer
                const search = (obj, depth) => {
                    if (depth > 6 || !obj || typeof obj !== 'object') return null;
                    if (Array.isArray(obj)) {
                        for (let item of obj) {
                            if (item && typeof item === 'object') {
                                if (item.is_correct === true || item.isCorrect === true || item.correct === true) {
                                    return item.text || item.term_display || item.word || item.term || item.label || item.id;
                                }
                                const r = search(item, depth + 1);
                                if (r) return r;
                            }
                        }
                    } else {
                        for (let k in obj) {
                            if (['children', 'parent', 'owner', 'stateNode', 'dispatch'].includes(k) || k.startsWith('__')) continue;
                            // Sometimes the answer is stored directly as a prop
                            if (k === 'correctAnswer' || k === 'correct_answer') return obj[k];
                            const r = search(obj[k], depth + 1);
                            if (r) return r;
                        }
                    }
                    return null;
                };
                
                const ans = search(fiber.memoizedProps, 0);
                if (ans) return ans.toString().toUpperCase();
            }
            fiber = fiber.return; // Traverse up the tree
        }
        return null;
    }

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

        // --- PHASE 1: PRE-GAME & MUSIC ---
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
            }, 3000);
            return; 
        }

        // --- PHASE 3: SOLVE ANY QUESTION ---
        // This unifies Quiz, R&R, and Vocab using the exact same React memory hacker
        if (activity !== "Idle") {
            // Target elements that usually house the current React state
            const targetWordOrId = extractReactAnswer('[data-testid="question-option-draggable"]') || extractReactAnswer('.optionWrapper') || extractReactAnswer('.rnr-button-next');
            
            if (targetWordOrId) {
                log(`[React Hacker] Extracted correct answer: ${targetWordOrId}`, 'debug');

                // Try to find the button that has this text or value
                const clickableOptions = Array.from(document.querySelectorAll('button, input[type="radio"], .optionWrapper'));
                let correctElement = clickableOptions.find(el => {
                    const txt = el.innerText ? el.innerText.trim().toUpperCase() : '';
                    const val = el.value ? el.value.toUpperCase() : '';
                    return txt === targetWordOrId || val === targetWordOrId;
                });

                if (correctElement) {
                    log(`Found matching option! Clicking...`, 'success');
                    correctElement.click();

                    // Instantly hunt for the confirm/next button
                    setTimeout(() => {
                        const actionBtn = document.querySelector('.rnr-button-next') || Array.from(document.querySelectorAll('button')).find(b => ['NEXT', 'CONTINUE', 'CONFIRM ANSWER'].includes(b.innerText.trim().toUpperCase()));
                        if (actionBtn) {
                            actionBtn.click();
                            log(`Moving to next question.`, 'info');
                        }
                    }, 350);
                }
            } else {
                // If it can't find a question, check if it's stuck on a transition screen
                const actionBtn = Array.from(document.querySelectorAll('button')).find(b => ['NEXT', 'CONTINUE'].includes(b.innerText.trim().toUpperCase()));
                if (actionBtn) actionBtn.click();
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
    log('React Hook Installed. Ready to Hack.', 'info');

})();

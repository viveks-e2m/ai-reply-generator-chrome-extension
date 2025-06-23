// At the very top of the file, add a loader for utils/history.js if not already loaded
(function loadHistoryUtils() {
    if (!window.saveHistoryItem || !window.getHistoryItems) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('utils/history.js');
        script.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(script);
    }
})();

// Content script for AI Email Reply Generator
class EmailReplyGenerator {
    constructor() {
        this.isInitialized = false;
        this.currentEmailClient = this.detectEmailClient();
        this.observer = null;
        this.debouncedInject = null;
        this.lastInjected = 0;
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEmailClient());
        } else {
            this.setupEmailClient();
        }
        this.observePageChanges();
        this.isInitialized = true;
    }

    detectEmailClient() {
        const url = window.location.href;
        if (url.includes('mail.google.com')) return 'gmail';    
        if (url.includes('outlook.live.com') || url.includes('outlook.office.com')) return 'outlook';
        return 'unknown';
    }

    setupEmailClient() {
        // Disconnect any previous observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        switch (this.currentEmailClient) {
            case 'gmail':
                this.setupGmail();
                break;
            case 'outlook':
                this.setupOutlook();
                break;
            default:
            // Do nothing
        }
    }

    setupGmail() {
        this.injectGmailButton();
        // Debounced injection to avoid excessive DOM scans
        this.debouncedInject = this.debounce(() => this.injectGmailButton(), 500);
        this.observer = new MutationObserver(() => {
            this.debouncedInject();
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupOutlook() {
        this.injectOutlookButton();
        this.debouncedInject = this.debounce(() => this.injectOutlookButton(), 500);
        this.observer = new MutationObserver(() => {
            this.debouncedInject();
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    injectGmailButton() {
        // Find all visible Reply spans in the thread action bar
        const replySpans = Array.from(document.querySelectorAll('.amn .ams.bkH'));
        replySpans.forEach(span => {
            // Only inject if not already present
            if (span.parentNode && span.parentNode.querySelector('.ai-reply-span')) return;
            const aiSpan = this.createAISpan();
            // Insert before the Reply span
            span.parentNode.insertBefore(aiSpan, span);
        });
    }

    injectOutlookButton() {
        const replyButtons = document.querySelectorAll('[aria-label*="Reply"], .ms-Button--primary');
        replyButtons.forEach(button => {
            if (button.parentNode && button.parentNode.querySelector('.ai-reply-btn')) return;
            const aiButton = this.createAIButton();
            button.parentNode.insertBefore(aiButton, button.nextSibling);
        });
    }

    createAISpan() {
        const span = document.createElement('span');
        span.className = 'ams bkAI ai-reply-span'; // ams for Gmail action, bkAI custom for AI
        span.setAttribute('role', 'link');
        span.setAttribute('tabindex', '0');
        span.innerHTML = 'AI Reply';
        span.title = 'Generate AI-powered reply';
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showRecommendationModal(span);
        });
        // Keyboard accessibility
        span.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showRecommendationModal(span);
            }
        });
        return span;
    }

    createAIButton() {
        const button = document.createElement('button');
        button.className = 'ai-reply-btn';
        button.innerHTML = 'AI Reply';
        button.title = 'Generate AI-powered reply';
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showRecommendationModal(button);
        });
        return button;
    }

    showRecommendationModal(targetButton, prefill = '', prefillTone = '') {
        this.removeRecommendationModal();
        // Modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'ai-recommend-modal-overlay';
        // Modal box
        const modal = document.createElement('div');
        modal.className = 'ai-recommend-modal';
        // Tone selection
        const toneBar = document.createElement('div');
        toneBar.className = 'ai-recommend-tonebar';
        const tones = [
            { key: 'casual', label: '😊 Casual' },
            { key: 'formal', label: '👔 Formal' },
            { key: 'empowering', label: '💪 Empowering' },
            { key: 'not-interested', label: '🚫 Not Interested' }
        ];
        let selectedTone = prefillTone || 'casual';
        let customInstruction = '';
        let prefillMode = !!prefill;
        let currentPrefill = prefill;
        tones.forEach(tone => {
            const btn = document.createElement('button');
            btn.className = 'ai-recommend-tonebtn';
            btn.textContent = tone.label;
            btn.dataset.tone = tone.key;
            if (tone.key === selectedTone) btn.classList.add('selected');
            btn.onclick = async () => {
                selectedTone = tone.key;
                modal.querySelectorAll('.ai-recommend-tonebtn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (prefillMode) {
                    // Fetch the version for the selected tone and update the prefill
                    const emailData = this.extractEmailContent();
                    const completions = await this.fetchAIRecommendations(emailData, selectedTone, 1, customInstruction);
                    if (completions && completions[0]) {
                        currentPrefill = completions[0];
                    } else {
                        currentPrefill = 'Failed to load version for this tone.';
                    }
                    this.loadRecommendations(modal, selectedTone, emailData, customInstruction, currentPrefill, true, submitBtn, instructionInput);
                } else {
                    this.loadRecommendations(modal, selectedTone, emailData, customInstruction);
                }
            };
            toneBar.appendChild(btn);
        });
        modal.appendChild(toneBar);
        // Recommendations area
        const recArea = document.createElement('div');
        recArea.className = 'ai-recommend-list';
        modal.appendChild(recArea);
        // Custom instruction input (moved below recommendations)
        const instructionLabel = document.createElement('label');
        instructionLabel.textContent = 'Custom instruction or feedback (optional):';
        instructionLabel.className = 'ai-recommend-label';
        instructionLabel.htmlFor = 'ai-custom-instruction';
        const instructionInput = document.createElement('textarea');
        instructionInput.id = 'ai-custom-instruction';
        instructionInput.placeholder = 'Add extra instructions for the AI or give feedback...';
        instructionInput.className = 'ai-recommend-textarea';
        instructionInput.value = customInstruction;
        instructionInput.addEventListener('input', (e) => {
            customInstruction = e.target.value;
        });
        // Submit button for custom instruction
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit Instruction';
        submitBtn.className = 'ai-recommend-submit-btn';
        // Add label, textarea, and button after recommendations
        modal.appendChild(instructionLabel);
        modal.appendChild(instructionInput);
        modal.appendChild(submitBtn);
        // Show History button (move here, after submitBtn)
        const historyBtn = document.createElement('button');
        historyBtn.className = 'ai-recommend-history-btn';
        historyBtn.textContent = 'Show History';
        historyBtn.type = 'button';
        historyBtn.title = 'Show your previous AI replies';
        historyBtn.onclick = async (e) => {
            e.preventDefault();
            const history = await this.getHistoryItems();
            this.showHistoryModal(history);
        };
        modal.appendChild(historyBtn);
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ai-recommend-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.removeRecommendationModal();
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        // Load recommendations
        const emailData = this.extractEmailContent();
        this.loadRecommendations(modal, selectedTone, emailData, customInstruction, prefill, prefillMode, submitBtn, instructionInput);
        // Remove on overlay click
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) this.removeRecommendationModal();
        });
        // Remove on Escape
        document.addEventListener('keydown', this._recommendModalEscapeHandler = (evt) => {
            if (evt.key === 'Escape') this.removeRecommendationModal();
        });
    }

    removeRecommendationModal() {
        const overlay = document.querySelector('.ai-recommend-modal-overlay');
        if (overlay) overlay.remove();
        if (this._recommendModalEscapeHandler) document.removeEventListener('keydown', this._recommendModalEscapeHandler);
        this._recommendModalEscapeHandler = null;
    }

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['selectedTone'], (result) => {
                resolve({ selectedTone: result.selectedTone || 'casual' });
            });
        });
    }

    extractEmailContent() {
        const data = {
            subject: '',
            content: '',
            sender: '',
            thread: []
        };
        switch (this.currentEmailClient) {
            case 'gmail':
                return this.extractGmailContent(data);
            case 'outlook':
                return this.extractOutlookContent(data);
            default:
                return data;
        }
    }

    extractGmailContent(data) {
        const subjectElement = document.querySelector('[data-thread-perm-id] h2, .hP');
        if (subjectElement) data.subject = subjectElement.textContent.trim();
        const senderElement = document.querySelector('.gD, .zF');
        if (senderElement) data.sender = senderElement.textContent.trim();
        const contentElement = document.querySelector('.a3s, .adn');
        if (contentElement) data.content = contentElement.textContent.trim();

        // Structured thread history: sender + content for each previous message
        data.thread = [];
        const messageBlocks = document.querySelectorAll('.adn, .a3s');
        messageBlocks.forEach((block, idx) => {
            // Skip the first block (main content)
            if (idx === 0) return;
            const senderElem = block.querySelector('.gD, .zF');
            const contentElem = block.querySelector('.im');
            if (contentElem) {
                data.thread.push({
                    sender: senderElem ? senderElem.textContent.trim() : '',
                    content: contentElem.textContent.trim()
                });
            }
        });

        return data;
    }

    extractOutlookContent(data) {
        const subjectElement = document.querySelector('[role="main"] h1, .ms-font-xxl');
        if (subjectElement) data.subject = subjectElement.textContent.trim();
        const senderElement = document.querySelector('.ms-font-m, [role="main"] .ms-font-m');
        if (senderElement) data.sender = senderElement.textContent.trim();
        const contentElement = document.querySelector('[role="main"] .ms-font-m, .ms-rtestate-field');
        if (contentElement) data.content = contentElement.textContent.trim();
        return data;
    }

    insertReplyIntoEmail(reply) {
        switch (this.currentEmailClient) {
            case 'gmail':
                this.replaceGmailReply(reply);
                break;
            case 'outlook':
                this.replaceOutlookReply(reply);
                break;
        }
    }

    // New: Replace the entire content in Gmail compose box
    replaceGmailReply(reply) {
        let textArea = document.querySelector('[role="textbox"], .Am.Al.editable');
        if (textArea) {
            textArea.focus();
            // Remove all content
            if (textArea.innerHTML !== undefined) {
                textArea.innerHTML = '';
            } else {
                textArea.textContent = '';
            }
            // Insert new reply (convert newlines to <br> for Gmail formatting)
            const htmlReply = reply.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, htmlReply);
            return;
        }
        // If not present, click the closest visible Reply button in the thread
        const replyButton = document.querySelector('.amn .ams.bkH');
        if (replyButton) {
            replyButton.click();
            // Wait for the reply box to appear, then insert
            const tryInsert = (attempts = 0) => {
                const box = document.querySelector('[role="textbox"], .Am.Al.editable');
                if (box) {
                    box.focus();
                    if (box.innerHTML !== undefined) {
                        box.innerHTML = '';
                    } else {
                        box.textContent = '';
                    }
                    const htmlReply = reply.replace(/\n/g, '<br>');
                    document.execCommand('insertHTML', false, htmlReply);
                } else if (attempts < 10) {
                    setTimeout(() => tryInsert(attempts + 1), 100);
                }
            };
            tryInsert();
        }
    }

    // New: Replace the entire content in Outlook compose box
    replaceOutlookReply(reply) {
        const textArea = document.querySelector('[role="textbox"], .ms-rtestate-field');
        if (textArea) {
            textArea.focus();
            textArea.textContent = '';
            textArea.textContent = reply;
            const event = new Event('input', { bubbles: true });
            textArea.dispatchEvent(event);
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `ai-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    observePageChanges() {
        let currentUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                this.currentEmailClient = this.detectEmailClient();
                this.setupEmailClient();
            }
        }, 2000); // Less aggressive: every 2 seconds
    }

    debounce(fn, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    async loadRecommendations(modal, selectedTone, emailData, customInstruction = '', prefill = '', isPrefillMode = false, submitBtn = null, instructionInput = null) {
        const recArea = modal.querySelector('.ai-recommend-list');
        recArea.innerHTML = '';
        const items = [];
        if (prefill) {
            // Prefilled item is a non-editable div
            const prefillItem = document.createElement('div');
            prefillItem.className = 'ai-recommend-item';
            prefillItem.textContent = prefill;
            prefillItem.title = 'This is your current draft reply.';
            prefillItem.tabIndex = 0;
            prefillItem.style.cursor = 'pointer';
            prefillItem.onclick = () => {
                this.insertReplyIntoEmail(prefillItem.textContent);
                this.removeRecommendationModal();
            };
            prefillItem.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.insertReplyIntoEmail(prefillItem.textContent);
                    this.removeRecommendationModal();
                }
            };
            recArea.appendChild(prefillItem);
            items.push(prefillItem);
            // Allow custom instruction to update the prefilled response
            if (submitBtn && instructionInput) {
                submitBtn.onclick = async () => {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Updating...';
                    try {
                        const completions = await this.fetchAIRecommendations(
                            { ...emailData, content: emailData.content }, // pass original email as prompt
                            selectedTone,
                            1,
                            instructionInput.value,
                            prefillItem.textContent // pass draft
                        );
                        if (completions && completions[0]) {
                            prefillItem.textContent = completions[0];
                        }
                    } catch {
                        prefillItem.textContent = 'Failed to update with custom instruction.';
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Instruction';
                };
            }
            return;
        }
        const numVersions = 2; // or any number you want to show
        for (let i = 0; i < numVersions; ++i) {
            const item = document.createElement('div');
            item.className = 'ai-recommend-item loading';
            item.textContent = 'Loading...';
            recArea.appendChild(item);
            items.push(item);
        }
        // Add logic for custom instruction in normal mode
        if (!isPrefillMode && submitBtn && instructionInput) {
            submitBtn.onclick = async () => {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
                try {
                    // Regenerate recommendations with the new custom instruction
                    await this.loadRecommendations(
                        modal,
                        selectedTone,
                        emailData,
                        instructionInput.value, // pass the updated custom instruction
                        '', // no prefill
                        false,
                        submitBtn,
                        instructionInput
                    );
                } catch {
                    // Optionally show an error
                }
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Instruction';
            };
        }
        try {
            // Call the AI API for multiple completions in a single call
            const completions = await this.fetchAIRecommendations(emailData, selectedTone, numVersions, customInstruction);
            completions.forEach((reply, idx) => {
                if (items[idx]) {
                    items[idx].className = 'ai-recommend-item';
                    items[idx].textContent = reply;
                    items[idx].title = 'Click to use this reply';
                    items[idx].tabIndex = 0;
                    items[idx].onclick = () => {
                        this.insertReplyIntoEmail(reply);
                        this.removeRecommendationModal();
                    };
                    items[idx].onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.insertReplyIntoEmail(reply);
                            this.removeRecommendationModal();
                        }
                    };
                    // Save to history if customInstruction is present
                    if (customInstruction && reply) {
                        this.saveHistoryItem({
                            date: new Date().toISOString(),
                            prompt: emailData.content,
                            customInstruction,
                            reply,
                            tone: selectedTone,
                            subject: emailData.subject || '',
                            sender: emailData.sender || ''
                        });
                    }
                }
            });
        } catch (err) {
            recArea.innerHTML = `<div class=\"ai-recommend-item error\">Failed to load recommendations. Please try again.</div>`;
        }
    }

    async fetchAIRecommendations(emailData, tone, n, customInstruction = '', draft = '', onEach) {
        let prompt = emailData.content;
        console.log('emailData', emailData);
        
        if (emailData.thread && emailData.thread.length > 0) {
            prompt += '\n\nThread History:\n' + emailData.thread.join('\n---\n');
        }
        const body = {
            prompt: prompt,
            tone: tone,
            n: n,
            customInstruction: customInstruction,
        };
        if (draft) {
            body.draft = draft;
        }
        try {
            const response = await fetch('http://localhost:3001/generate-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('API error');
            const data = await response.json(); 
            if (Array.isArray(data.replies)) {
                if (onEach) data.replies.forEach((reply, idx) => onEach(idx, reply));
                return data.replies;
            } else {
                if (onEach) onEach(0, 'Failed to load.');
                return ['Failed to load.'];
            }
        } catch {
            if (onEach) onEach(0, 'Failed to load.');
            return ['Failed to load.'];
        }
    }

    showHistoryModal(historyItems) {
        // Store the current modal content before removing it
        const previousModal = document.querySelector('.ai-recommend-modal');
        const previousOverlay = document.querySelector('.ai-recommend-modal-overlay');
        if (previousModal) {
            previousModal.style.display = 'none';
        }
        
        // Modal overlay (reuse existing if present)
        const overlay = previousOverlay || document.createElement('div');
        overlay.className = 'ai-recommend-modal-overlay';
        
        // Modal box
        const modal = document.createElement('div');
        modal.className = 'ai-recommend-modal';
        modal.style.maxWidth = '600px';
        
        // Header container for title and back button
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.marginBottom = '16px';
        headerContainer.style.position = 'relative';
        
        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'ai-recommend-back-btn';
        backBtn.innerHTML = '&larr;'; // Left arrow
        backBtn.style.position = 'absolute';
        backBtn.style.left = '0';
        backBtn.style.background = 'none';
        backBtn.style.border = 'none';
        backBtn.style.fontSize = '20px';
        backBtn.style.color = '#4b5563';
        backBtn.style.cursor = 'pointer';
        backBtn.style.padding = '5px 10px';
        backBtn.title = 'Back to recommendations';
        backBtn.onclick = () => {
            modal.remove();
            if (previousModal) {
                previousModal.style.display = 'block';
            }
        };
        headerContainer.appendChild(backBtn);
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'AI Reply History';
        title.style.textAlign = 'center';
        title.style.color = '#2d3748';
        title.style.width = '100%';
        headerContainer.appendChild(title);
        
        modal.appendChild(headerContainer);

        // History list container
        const listContainer = document.createElement('div');
        listContainer.style.maxHeight = '400px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.padding = '0 10px';
        modal.appendChild(listContainer);

        if (!historyItems || historyItems.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No history found. Custom instructions with responses will appear here.';
            empty.style.textAlign = 'center';
            empty.style.color = '#888';
            empty.style.padding = '20px';
            listContainer.appendChild(empty);
        } else {
            historyItems.slice().reverse().forEach(item => {
                const entry = document.createElement('div');
                entry.className = 'ai-recommend-item';
                entry.style.marginBottom = '15px';
                entry.style.cursor = 'default';
                
                const header = document.createElement('div');
                header.style.borderBottom = '1px solid #e5e7eb';
                header.style.paddingBottom = '8px';
                header.style.marginBottom = '8px';
                header.innerHTML = `
                    <div style="color:#4b5563;font-size:12px;">
                        <b>Date:</b> ${new Date(item.date).toLocaleString()}
                    </div>
                    <div style="color:#7c3aed;font-size:13px;">
                        <b>Tone:</b> ${item.tone}
                    </div>
                `;
                
                const content = document.createElement('div');
                content.innerHTML = `
                    <div style="margin-bottom:8px;">
                        <b style="color:#4b5563;">Custom Instruction:</b>
                        <div style="color:#666;font-size:13px;margin-top:4px;">${item.customInstruction || '(none)'}</div>
                    </div>
                    <div>
                        <b style="color:#4b5563;">Generated Reply:</b>
                        <div style="color:#222;font-size:13px;margin-top:4px;white-space:pre-wrap;">${item.reply}</div>
                    </div>
                `;

                entry.appendChild(header);
                entry.appendChild(content);
                listContainer.appendChild(entry);
            });
        }

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ai-recommend-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            this.removeRecommendationModal();
            if (previousModal) {
                previousModal.remove();
            }
        };
        modal.appendChild(closeBtn);

        if (!previousOverlay) {
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        } else {
            overlay.appendChild(modal);
        }

        // Remove on overlay click
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                this.removeRecommendationModal();
                if (previousModal) {
                    previousModal.remove();
                }
            }
        });

        // Remove on Escape
        document.addEventListener('keydown', this._recommendModalEscapeHandler = (evt) => {
            if (evt.key === 'Escape') {
                this.removeRecommendationModal();
                if (previousModal) {
                    previousModal.remove();
                }
            }
        });
    }

    // Add new methods for history management
    async saveHistoryItem(item) {
        try {
            console.log('Saving history item:', item);
            const result = await chrome.storage.local.get(['ai_reply_history']);
            console.log('Current history:', result.ai_reply_history);
            const history = result.ai_reply_history || [];
            history.push(item);
            await chrome.storage.local.set({ ai_reply_history: history });
            console.log('History saved successfully. New length:', history.length);
            // Verify the save
            const verification = await chrome.storage.local.get(['ai_reply_history']);
            console.log('Verification - saved history:', verification.ai_reply_history);
        } catch (e) {
            console.error('Error saving history:', e);
            // Show notification to user
            this.showNotification('Failed to save to history', 'error');
        }
    }

    async getHistoryItems() {
        try {
            console.log('Fetching history items...');
            const result = await chrome.storage.local.get(['ai_reply_history']);
            console.log('Fetched history items:', result.ai_reply_history);
            return result.ai_reply_history || [];
        } catch (e) {
            console.error('Error getting history:', e);
            this.showNotification('Failed to load history', 'error');
            return [];
        }
    }

    // Add a method to clear history (useful for testing)
    async clearHistory() {
        try {
            await chrome.storage.local.remove(['ai_reply_history']);
            console.log('History cleared successfully');
        } catch (e) {
            console.error('Error clearing history:', e);
        }
    }
}

// Initialize the email reply generator
const emailReplyGenerator = new EmailReplyGenerator();

// Utility: Find the Gmail Send button in the compose window
function findGmailSendButton() {
    // Gmail uses several classes, but 'T-I-atl' and 'aoO' are unique to the Send button
    return document.querySelector('.btC .T-I.T-I-atl[role="button"][data-tooltip*="Send"]');
}

// Step 2: Inject the AI Update button next to Send
function injectAIUpdateButton() {
    const sendBtn = findGmailSendButton();
    if (!sendBtn) return;

    // Avoid injecting multiple times
    if (sendBtn.parentNode.querySelector('.ai-update-btn')) return;

    // Only inject for reply/forward, not new compose
    // Check if the compose box is inside a thread (has .adn or .a3s ancestor)
    let isReplyOrForward = false;
    let composeBox = sendBtn.closest('.nH'); // Gmail's compose container
    if (composeBox) {
        // Look for thread context above compose
        if (composeBox.querySelector('.adn, .a3s')) {
            isReplyOrForward = true;
        }
    }
    if (!isReplyOrForward) return;

    // Create the button
    const aiBtn = document.createElement('button');
    aiBtn.className = 'ai-update-btn';
    aiBtn.textContent = 'AI Update';
    aiBtn.style.marginLeft = '8px';
    aiBtn.style.background = '#4b5563';
    aiBtn.style.color = '#fff';
    aiBtn.style.border = 'none';
    aiBtn.style.borderRadius = '6px';
    aiBtn.style.padding = '6px 14px';
    aiBtn.style.fontSize = '13px';
    aiBtn.style.cursor = 'pointer';
    aiBtn.style.transition = 'background 0.18s';

    aiBtn.addEventListener('mouseenter', () => aiBtn.style.background = '#1a202c');
    aiBtn.addEventListener('mouseleave', () => aiBtn.style.background = '#4b5563');

    // Insert after More send options button if present, else after Send button
    let moreSendBtn = sendBtn.parentNode.querySelector('.T-I.hG.T-I-atl');
    if (moreSendBtn) {
        moreSendBtn.parentNode.insertBefore(aiBtn, moreSendBtn.nextSibling);
    } else {
        sendBtn.parentNode.insertBefore(aiBtn, sendBtn.nextSibling);
    }

    // Add click handler to open the modal with prefilled response and tone
    aiBtn.onclick = () => {
        let prefill = '';
        let prefillTone = 'casual';
        const box = document.querySelector('[role="textbox"], .Am.Al.editable');
        if (box) {
            prefill = box.innerText || box.textContent || '';
            // Optionally, try to detect the tone from a data attribute or context if available
        }
        emailReplyGenerator.showRecommendationModal(aiBtn, prefill, prefillTone);
    };
}

// Observe DOM changes to inject the AI Update button when the compose window appears
const observer = new MutationObserver(() => {
    injectAIUpdateButton();
});
observer.observe(document.body, { childList: true, subtree: true }); 
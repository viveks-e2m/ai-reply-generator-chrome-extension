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
        span.textContent = 'AI Reply';
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
        button.innerHTML = '🤖 AI Reply';
        button.title = 'Generate AI-powered reply';
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showRecommendationModal(button);
        });
        return button;
    }

    showRecommendationModal(targetButton) {
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
        let selectedTone = 'casual';
        tones.forEach(tone => {
            const btn = document.createElement('button');
            btn.className = 'ai-recommend-tonebtn';
            btn.textContent = tone.label;
            btn.dataset.tone = tone.key;
            if (tone.key === selectedTone) btn.classList.add('selected');
            btn.onclick = () => {
                selectedTone = tone.key;
                modal.querySelectorAll('.ai-recommend-tonebtn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.loadRecommendations(modal, selectedTone, emailData);
            };
            toneBar.appendChild(btn);
        });
        modal.appendChild(toneBar);
        // Recommendations area
        const recArea = document.createElement('div');
        recArea.className = 'ai-recommend-list';
        recArea.innerHTML = `
            <div class="ai-recommend-item loading"></div>
            <div class="ai-recommend-item loading"></div>
            <div class="ai-recommend-item loading"></div>
        `;
        modal.appendChild(recArea);
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
        this.loadRecommendations(modal, selectedTone, emailData);
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

    async handleAIButtonClick(selectedTone) {
        try {
            const settings = await this.getSettings();
            const emailData = this.extractEmailContent();
            if (!emailData.subject || !emailData.content) {
                this.showNotification('Could not extract email content', 'error');
                return;
            }
            // Use selectedTone from popover if provided, else fallback to settings.selectedTone
            const tone = selectedTone || settings.selectedTone || 'casual';
            const reply = await this.generateAIReply(emailData, { selectedTone: tone });
            if (reply) {
                this.insertReplyIntoEmail(reply);
                this.showNotification('AI reply generated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error generating AI reply:', error);
            this.showNotification('Error generating reply: ' + error.message, 'error');
        }
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
        const threadElements = document.querySelectorAll('.a3s, .adn');
        threadElements.forEach((element, index) => {
            if (index > 0) data.thread.push(element.textContent.trim());
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

    async generateAIReply(emailData, settings) {
        // Call your backend proxy instead of OpenAI directly
        const response = await fetch('http://localhost:3001/generate-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: emailData.content,
                subject: emailData.subject,
                tone: settings.selectedTone
            })
        });
        const data = await response.json();
        // Assume the backend returns { reply: '...' }
        return data.reply;
    }

    buildPrompt(emailData, tone) {
        const toneInstructions = {
            casual: 'Write a friendly, casual reply as if talking to a friend.',
            formal: 'Write a professional, formal reply suitable for business communication.',
            empowering: 'Write an encouraging and motivational reply that empowers the recipient.',
            'not-interested': 'Write a polite but firm reply declining the offer or request.'
        };
        return `\nEmail Context:\nSubject: ${emailData.subject}\nFrom: ${emailData.sender}\nContent: ${emailData.content}\n\nThread History: ${emailData.thread.join('\n\n')}\n\nInstructions: ${toneInstructions[tone] || toneInstructions.casual}\n\nPlease generate ONLY the body of a contextual email reply (do NOT include a subject line):\n1. Address the main points in the email\n2. Maintain the specified tone\n3. Be concise but complete\n4. Sound natural and human-like\n5. Include appropriate greetings and closings\n\nReply body:`;
    }

    insertReplyIntoEmail(reply) {
        switch (this.currentEmailClient) {
            case 'gmail':
                this.insertGmailReply(reply);
                break;
            case 'outlook':
                this.insertOutlookReply(reply);
                break;
        }
    }

    insertGmailReply(reply) {
        // Try to find the reply box
        let textArea = document.querySelector('[role="textbox"], .Am.Al.editable');
        if (textArea) {
            textArea.focus();
            textArea.textContent = reply;
            const event = new Event('input', { bubbles: true });
            textArea.dispatchEvent(event);
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
                    box.textContent = reply;
                    const event = new Event('input', { bubbles: true });
                    box.dispatchEvent(event);
                } else if (attempts < 10) {
                    setTimeout(() => tryInsert(attempts + 1), 100);
                }
            };
            tryInsert();
        }
    }

    insertOutlookReply(reply) {
        const textArea = document.querySelector('[role="textbox"], .ms-rtestate-field');
        if (textArea) {
            textArea.focus();
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

    async loadRecommendations(modal, selectedTone, emailData) {
        const recArea = modal.querySelector('.ai-recommend-list');
        // Show loading state
        recArea.innerHTML = '';
        const items = [];
        for (let i = 0; i < 2; ++i) {
            const item = document.createElement('div');
            item.className = 'ai-recommend-item loading';
            item.textContent = 'Loading...';
            recArea.appendChild(item);
            items.push(item);
        }
        try {
            // Call the AI API for 2 completions in parallel
            const completions = await this.fetchAIRecommendations(emailData, selectedTone, 2, (idx, reply) => {
                // Show each reply as it arrives
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
            });
            // If any are still loading (e.g. error), fill them in
            completions.forEach((reply, idx) => {
                if (reply && items[idx].classList.contains('loading')) {
                    items[idx].className = 'ai-recommend-item';
                    items[idx].textContent = reply;
                }
            });
        } catch (err) {
            recArea.innerHTML = `<div class="ai-recommend-item error">Failed to load recommendations. Please try again.</div>`;
        }
    }

    async fetchAIRecommendations(emailData, tone, n, onEach) {
        // Use the same prompt, but ask for n completions
        const prompt = this.buildPrompt(emailData, tone);
        const completions = new Array(n);
        // Use OpenAI API with n=3 completions (best_of is not supported, so call 3 times in parallel)
        await Promise.all(Array.from({ length: n }, (_, i) =>
            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a helpful email assistant that generates contextual email replies.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 500,
                    temperature: 0.9
                })
            })
            .then(async response => {
                if (!response.ok) throw new Error('API error');
                const data = await response.json();
                completions[i] = data.choices[0].message.content.trim();
                if (onEach) onEach(i, completions[i]);
            })
            .catch(() => {
                completions[i] = null;
                if (onEach) onEach(i, 'Failed to load.');
            })
        ));
        return completions;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'generateReply') {
        // Handle manual generation from popup
        const generator = new EmailReplyGenerator();
        generator.handleAIButtonClick();
        sendResponse({ success: true });
    }
});

// Initialize the email reply generator
const emailReplyGenerator = new EmailReplyGenerator(); 
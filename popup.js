document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const toneButtons = document.querySelectorAll('.tone-btn');
    const generateReplyBtn = document.getElementById('generateReply');
    const statusSection = document.getElementById('statusSection');
    const status = document.getElementById('status');

    let selectedTone = 'casual';

    // Initialize popup
    initializePopup();

    // Event listeners
    toneButtons.forEach(btn => {
        btn.addEventListener('click', () => selectTone(btn));
    });

    generateReplyBtn.addEventListener('click', generateReply);

    function initializePopup() {
        // Load saved settings
        chrome.storage.sync.get(['selectedTone'], function(result) {
            if (result.selectedTone) {
                selectedTone = result.selectedTone;
                updateToneSelection();
            }
        });
    }

    function selectTone(clickedBtn) {
        // Remove previous selection
        toneButtons.forEach(btn => btn.classList.remove('selected'));
        
        // Add selection to clicked button
        clickedBtn.classList.add('selected');
        
        // Update selected tone
        selectedTone = clickedBtn.dataset.tone;
        
        // Save to storage
        chrome.storage.sync.set({ selectedTone: selectedTone });
        
        showStatus('Tone updated successfully!', 'success');
    }

    function updateToneSelection() {
        toneButtons.forEach(btn => {
            if (btn.dataset.tone === selectedTone) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    function generateReply() {
        // Show loading state
        generateReplyBtn.innerHTML = '<span class="loading"></span> Generating...';
        generateReplyBtn.disabled = true;

        // Send message to content script to extract email and generate reply
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'generateReply',
                tone: selectedTone
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response && response.success) {
                    showStatus('Reply generated successfully! Check your email client.', 'success');
                } else {
                    showStatus('Failed to generate reply. Please try again.', 'error');
                }
                
                // Reset button state
                generateReplyBtn.innerHTML = '<span class="btn-icon">🤖</span> Generate Reply';
                generateReplyBtn.disabled = false;
            });
        });
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status-message ${type}`;
        statusSection.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusSection.style.display = 'none';
        }, 3000);
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStatus') {
            showStatus(request.message, request.type);
        }
    });
}); 
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const statusSection = document.getElementById('statusSection');
    const status = document.getElementById('status');

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStatus') {
            showStatus(request.message, request.type);
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status-message ${type}`;
        statusSection.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusSection.style.display = 'none';
        }, 3000);
    }
}); 
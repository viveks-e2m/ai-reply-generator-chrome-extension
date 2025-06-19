// Background service worker for AI Email Reply Generator

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        // Set default settings on first install
        chrome.storage.sync.set({
            selectedTone: 'casual',
            apiKey: ''
        }, function() {
            console.log('Default settings initialized');
        });
        
        // Open welcome page or show instructions
        chrome.tabs.create({
            url: 'https://github.com/your-repo/ai-email-reply-generator#readme'
        });
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
    // This will only trigger if no popup is defined in manifest
    // Since we have a popup, this won't be called
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
        case 'getSettings':
            chrome.storage.sync.get(['apiKey', 'selectedTone'], function(result) {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'saveSettings':
            chrome.storage.sync.set(request.settings, function() {
                sendResponse({ success: true });
            });
            return true;
            
        case 'generateReply':
            // Forward the request to the content script
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
                        sendResponse(response);
                    });
                } else {
                    sendResponse({ success: false, error: 'No active tab found' });
                }
            });
            return true;
            
        case 'checkEmailClient':
            // Check if current tab is a supported email client
            const url = sender.tab ? sender.tab.url : '';
            const isEmailClient = url.includes('mail.google.com') || 
                                url.includes('outlook.live.com') || 
                                url.includes('outlook.office.com');
            sendResponse({ isEmailClient: isEmailClient });
            return true;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
    }
});

// Handle tab updates to inject content scripts when needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        const isEmailClient = tab.url.includes('mail.google.com') || 
                            tab.url.includes('outlook.live.com') || 
                            tab.url.includes('outlook.office.com');
        
        if (isEmailClient) {
            // Ensure content script is injected
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(err => {
                // Content script might already be injected, ignore error
                console.log('Content script injection:', err.message);
            });
        }
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync') {
        // Notify content scripts of settings changes
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.url && (tab.url.includes('mail.google.com') || 
                               tab.url.includes('outlook.live.com') || 
                               tab.url.includes('outlook.office.com'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'settingsChanged',
                        changes: changes
                    }).catch(err => {
                        // Tab might not have content script, ignore error
                    });
                }
            });
        });
    }
});

// Handle context menu (optional feature)
chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: 'generateAIReply',
        title: 'Generate AI Reply',
        contexts: ['page'],
        documentUrlPatterns: [
            'https://mail.google.com/*',
            'https://outlook.live.com/*',
            'https://outlook.office.com/*'
        ]
    });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'generateAIReply') {
        chrome.tabs.sendMessage(tab.id, {
            action: 'generateReply'
        });
    }
});

// Error handling
chrome.runtime.onSuspend.addListener(function() {
    console.log('Extension is being suspended');
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(function() {
    console.log('Extension started');
}); 
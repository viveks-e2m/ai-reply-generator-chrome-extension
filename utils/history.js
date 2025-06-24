// Utility for saving and retrieving AI reply history
const HISTORY_KEY = 'ai_reply_history';

function saveHistoryItem(item) {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        let arr = [];
        if (raw) arr = JSON.parse(raw);
        arr.push(item);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {
        // Fallback: do nothing
    }
}

function getHistoryItems() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// Expose globally for content.js
window.saveHistoryItem = saveHistoryItem;
window.getHistoryItems = getHistoryItems; 
// Simple LRU cache for concatenated audio
export class AudioCache {
    constructor(maxSize = 10) {
        this.maxSize = maxSize;
        this.cache = new Map(); // conversationId -> { url, timestamp }
    }

    set(conversationId, url) {
        // Update timestamp if exists
        if (this.cache.has(conversationId)) {
            const entry = this.cache.get(conversationId);
            entry.timestamp = Date.now();
            return;
        }

        // Add new entry
        this.cache.set(conversationId, {
            url,
            timestamp: Date.now()
        });

        // Enforce size limit
        if (this.cache.size > this.maxSize) {
            // Find and remove oldest entry
            let oldestKey = null;
            let oldestTime = Infinity;
            
            for (const [key, entry] of this.cache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                const entry = this.cache.get(oldestKey);
                URL.revokeObjectURL(entry.url);
                this.cache.delete(oldestKey);
            }
        }
    }

    get(conversationId) {
        const entry = this.cache.get(conversationId);
        if (entry) {
            entry.timestamp = Date.now(); // Update access time
            return entry.url;
        }
        return null;
    }

    clear() {
        for (const entry of this.cache.values()) {
            URL.revokeObjectURL(entry.url);
        }
        this.cache.clear();
    }
}
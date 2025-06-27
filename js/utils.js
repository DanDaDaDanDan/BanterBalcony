// Utility functions for input sanitization, validation, and error handling

export class InputSanitizer {
    static sanitizeText(input) {
        if (typeof input !== 'string') return '';
        
        // Remove any script tags and dangerous HTML
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }
    
    static sanitizeForHTML(input) {
        if (typeof input !== 'string') return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            "/": '&#x2F;',
        };
        
        return input.replace(/[&<>"'/]/g, char => map[char]);
    }
    
    static validateAPIKey(key, provider) {
        if (!key || typeof key !== 'string') return false;
        
        // Basic validation patterns for different providers (relaxed)
        const patterns = {
            openai: /^sk-[a-zA-Z0-9_-]{20,}$/,
            google: /^[a-zA-Z0-9_-]{20,}$/,
            elevenlabs: /^[a-f0-9]{20,}$/,
            xai: /^xai-[a-zA-Z0-9_-]{10,}$/,
            deepseek: /^sk-[a-zA-Z0-9_-]{10,}$/,
            fal: /^[a-zA-Z0-9:_-]{10,}$/
        };
        
        // If no specific pattern, just check it's not empty and reasonable length
        if (!patterns[provider]) {
            return key.length > 10 && key.length < 200;
        }
        
        return patterns[provider].test(key);
    }
    
    static validateJSON(jsonString) {
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }
    
    static sanitizeJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed);
        } catch {
            return null;
        }
    }
}

export class ErrorHandler {
    static handlers = new Map();
    
    static register(context, handler) {
        this.handlers.set(context, handler);
    }
    
    static handle(error, context = 'general') {
        console.error(`Error in ${context}:`, error);
        
        const handler = this.handlers.get(context) || this.handlers.get('general');
        if (handler) {
            handler(error);
        }
        
        // Return user-friendly error message
        if (error.message?.includes('Failed to fetch')) {
            return 'Network error. Please check your internet connection.';
        } else if (error.message?.includes('401') || error.message?.includes('403')) {
            return 'Authentication error. Please check your API key.';
        } else if (error.message?.includes('429')) {
            return 'Rate limit exceeded. Please try again later.';
        } else if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
            return 'Server error. The service may be temporarily unavailable.';
        }
        
        return error.message || 'An unexpected error occurred.';
    }
}

// Global error handler setup
export function setupGlobalErrorHandler(app) {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        const message = ErrorHandler.handle(event.error, 'global');
        if (app && app.errorMessage) {
            app.errorMessage = message;
            setTimeout(() => {
                app.errorMessage = '';
            }, 5000);
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        const message = ErrorHandler.handle(event.reason, 'promise');
        if (app && app.errorMessage) {
            app.errorMessage = message;
            setTimeout(() => {
                app.errorMessage = '';
            }, 5000);
        }
        event.preventDefault();
    });
}

// Safe JSON parsing
export function safeJSONParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('JSON parse error:', error);
        return defaultValue;
    }
}

// Safe localStorage operations
export class SafeStorage {
    static setItem(key, value) {
        try {
            const sanitizedKey = InputSanitizer.sanitizeText(key);
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(sanitizedKey, stringValue);
            return true;
        } catch (error) {
            console.error('localStorage setItem error:', error);
            return false;
        }
    }
    
    static getItem(key, defaultValue = null) {
        try {
            const sanitizedKey = InputSanitizer.sanitizeText(key);
            const value = localStorage.getItem(sanitizedKey);
            return value !== null ? value : defaultValue;
        } catch (error) {
            console.error('localStorage getItem error:', error);
            return defaultValue;
        }
    }
    
    static removeItem(key) {
        try {
            const sanitizedKey = InputSanitizer.sanitizeText(key);
            localStorage.removeItem(sanitizedKey);
            return true;
        } catch (error) {
            console.error('localStorage removeItem error:', error);
            return false;
        }
    }
}

// Network request wrapper with error handling
export async function safeRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            signal: options.signal || AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout. Please try again.');
        }
        throw error;
    }
}


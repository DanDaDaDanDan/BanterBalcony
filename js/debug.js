// Debug functionality
export class DebugManager {
    constructor(app) {
        this.app = app;
    }

    logDebug(type, provider, model, data) {
        if (!this.app.debugEnabled) return;
        
        const processedData = { ...data };
        
        // Convert duration from milliseconds to seconds
        if (processedData.duration !== undefined) {
            processedData.duration = (processedData.duration / 1000).toFixed(1);
        }
        
        const entry = {
            timestamp: this.formatTimestamp(new Date()),
            type: type, // 'request', 'response', 'error'
            provider: provider,
            model: model,
            ...processedData
        };
        
        this.app.debugLog.unshift(entry); // Add to beginning for newest first
        
        // Keep only last 100 entries to prevent memory issues
        if (this.app.debugLog.length > 100) {
            this.app.debugLog = this.app.debugLog.slice(0, 100);
        }
    }
    
    // Format timestamp in human-readable format with local timezone
    formatTimestamp(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'short'
        });
    }
    
    // Format JSON for debug display with syntax highlighting and pretty/raw modes
    formatDebugJSON(obj) {
        // Handle null/undefined values
        if (obj === null || obj === undefined) {
            return '';
        }
        
        try {
            // Create a safe copy that handles circular references and limits depth
            const safeObj = this.createSafeDebugObject(obj, 0, 10); // Max depth of 10
            
            if (!this.app.debugPrettyMode) {
                // Raw mode - compact JSON string, single line
                return JSON.stringify(safeObj);
            }
            
            // Pretty mode with syntax highlighting
            let jsonStr = JSON.stringify(safeObj, null, 2);
            
            // In pretty mode, replace escaped newlines with actual newlines for better readability
            // But keep escaped quotes as-is to maintain valid JSON structure
            jsonStr = jsonStr.replace(/\\n/g, '\n');
            
            // Replace literal \t with actual tabs for better formatting
            jsonStr = jsonStr.replace(/\\t/g, '\t');
            
            // Apply syntax highlighting
            return this.syntaxHighlightJSON(jsonStr);
        } catch (error) {
            // If all else fails, return a safe error message
            return `<span class="json-error">Error formatting JSON: ${error.message}</span>`;
        }
    }

    // Create a safe copy of an object that handles circular references and limits depth
    createSafeDebugObject(obj, currentDepth = 0, maxDepth = 10, seen = new WeakSet()) {
        // Prevent infinite recursion
        if (currentDepth >= maxDepth) {
            return '[Max depth reached]';
        }
        
        // Handle primitive types
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // Handle circular references
        if (seen.has(obj)) {
            return '[Circular Reference]';
        }
        
        // Mark this object as seen
        seen.add(obj);
        
        try {
            if (Array.isArray(obj)) {
                return obj.map(item => this.createSafeDebugObject(item, currentDepth + 1, maxDepth, seen));
            } else {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    // Skip functions and undefined values
                    if (typeof value === 'function' || value === undefined) {
                        continue;
                    }
                    result[key] = this.createSafeDebugObject(value, currentDepth + 1, maxDepth, seen);
                }
                return result;
            }
        } catch (error) {
            return `[Error processing object: ${error.message}]`;
        } finally {
            // Remove from seen set when done (for this branch)
            seen.delete(obj);
        }
    }
    
    // Syntax highlighting for JSON
    syntaxHighlightJSON(json) {
        // Escape HTML characters first
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Apply syntax highlighting with HTML spans
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }
} 
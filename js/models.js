// AI Models and API Provider implementations
import { safeRequest, ErrorHandler, safeJSONParse } from '../utils.js';

export class AIModels {
    constructor(app) {
        this.app = app;
    }

    // Generic API call handler
    async makeAPICall(provider, url, headers, body, responseParser) {
        const startTime = Date.now();
        const model = this.app[`${provider}Model`];
        
        // Log the request using new format
        this.app.logDebug('request', {
            url: url,
            method: 'POST',
            headers: headers,
            body: body,
            model: model,
            provider: provider
        });
        
        try {
            const response = await safeRequest(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            
            const duration = Date.now() - startTime;
            
            if (!response.ok) {
                const errorText = await response.text();
                this.app.logDebug('response', {
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    duration: duration,
                    success: false,
                    model: model,
                    provider: provider,
                    error: { message: `HTTP ${response.status}: ${errorText}`, raw_response: errorText }
                });
                throw new Error(`API error: ${response.status}`);
            }
            
            const responseText = await response.text();
            const data = safeJSONParse(responseText);
            if (!data) {
                throw new Error('Invalid JSON response from API');
            }
            const parsedResponse = responseParser(data);
            
            // Log the response using new format
            this.app.logDebug('response', {
                url: url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                duration: duration,
                success: true,
                model: model,
                provider: provider,
                data: data,
                parsedResponse: parsedResponse
            });
            
            return parsedResponse;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.app.logDebug('error', {
                error: error.message,
                duration: duration,
                model: model,
                provider: provider
            });
            throw error;
        }
    }

    async callOpenAIAPI(systemPrompt, userPrompt) {
        // Build messages array
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];
        
        const body = {
            model: this.app.openaiModel,
            messages: messages,
            response_format: { type: "json_object" }
        };
        
        // Only add temperature for non-reasoning models
        if (this.app.supportsTemperature) {
            body.temperature = this.app.temperature;
        }
        
        return this.makeAPICall(
            'openai',
            'https://api.openai.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.openaiKey}`
            },
            body,
            (data) => JSON.parse(data.choices[0].message.content)
        );
    }
    
    async callGoogleAPI(systemPrompt, userPrompt) {
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt + '\n\nUser request: ' + userPrompt }]
                }
            ],
            generationConfig: {
                temperature: this.app.effectiveTemperature,
                responseMimeType: "application/json"
            }
        };
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.app.googleModel}:generateContent?key=${this.app.googleKey}`;
        
        return this.makeAPICall(
            'google',
            url,
            {
                'Content-Type': 'application/json',
            },
            body,
            (data) => JSON.parse(data.candidates[0].content.parts[0].text)
        );
    }
    
    async callXAIAPI(systemPrompt, userPrompt) {
        const body = {
            model: this.app.xaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: this.app.effectiveTemperature,
            response_format: { type: "json_object" }
        };
        
        return this.makeAPICall(
            'xai',
            'https://api.x.ai/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.xaiKey}`
            },
            body,
            (data) => JSON.parse(data.choices[0].message.content)
        );
    }
    
    async callDeepSeekAPI(systemPrompt, userPrompt) {
        const body = {
            model: this.app.deepseekModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: this.app.effectiveTemperature,
            response_format: { type: "json_object" }
        };
        
        return this.makeAPICall(
            'deepseek',
            'https://api.deepseek.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.deepseekKey}`
            },
            body,
            (data) => JSON.parse(data.choices[0].message.content)
        );
    }
} 
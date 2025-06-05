// AI Models and API Provider implementations
export class AIModels {
    constructor(app) {
        this.app = app;
    }

    // Generic API call handler
    async makeAPICall(provider, url, headers, body, responseParser) {
        const startTime = Date.now();
        const model = this.app[`${provider}Model`];
        
        // Log the request
        this.app.logDebug('request', provider, model, {
            request: body,
            url: url
        });
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            
            const duration = Date.now() - startTime;
            
            if (!response.ok) {
                const errorText = await response.text();
                this.app.logDebug('error', provider, model, {
                    error: `HTTP ${response.status}: ${errorText}`,
                    duration: duration
                });
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const parsedResponse = responseParser(data);
            
            // Log the response
            this.app.logDebug('response', provider, model, {
                response: data,
                parsedResponse: parsedResponse,
                duration: duration
            });
            
            return parsedResponse;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.app.logDebug('error', provider, model, {
                error: error.message,
                duration: duration
            });
            throw error;
        }
    }

    async callOpenAIAPI(systemPrompt) {
        // Build messages array
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...this.app.conversationHistory
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
    
    async callAnthropicAPI(systemPrompt) {
        const body = {
            model: this.app.anthropicModel,
            system: systemPrompt,
            messages: this.app.conversationHistory.map(msg => ({
                role: msg.role === 'system' ? 'assistant' : msg.role,
                content: msg.content
            })),
            temperature: this.app.effectiveTemperature
        };
        
        return this.makeAPICall(
            'anthropic',
            'https://api.anthropic.com/v1/messages',
            {
                'Content-Type': 'application/json',
                'x-api-key': this.app.anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body,
            (data) => JSON.parse(data.content[0].text)
        );
    }
    
    async callGoogleAPI(systemPrompt) {
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{
                        text: systemPrompt + `

Conversation history:
` + this.app.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
                    }]
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
    
    async callXAIAPI(systemPrompt) {
        const body = {
            model: this.app.xaiModel,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...this.app.conversationHistory
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
    
    async callDeepSeekAPI(systemPrompt) {
        const body = {
            model: this.app.deepseekModel,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...this.app.conversationHistory
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
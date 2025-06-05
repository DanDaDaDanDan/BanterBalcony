// Chat and messaging functionality
export class ChatManager {
    constructor(app) {
        this.app = app;
    }

    // Message handling
    getMessageClass(message) {
        if (message.type === 'system') return 'message-center';
        if (message.sender === 'You') return 'message-right';
        return 'message-left';
    }
    
    async sendMessage() {
        if (!this.app.currentInput.trim() || !this.app.apiKey || this.app.processing) return;
        
        const userMessage = this.app.currentInput.trim();
        this.app.currentInput = '';
        
        // Add user message
        this.app.messages.push({
            sender: 'You',
            content: userMessage,
            type: 'user'
        });
        
        // Add to conversation history
        this.app.conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        
        // Process with AI
        await this.processWithAI(userMessage);
    }
    
    async processWithAI(userInput) {
        if (!this.app.currentScenario) {
            this.app.messages.push({
                sender: 'System',
                content: 'Please start a new scenario first.',
                type: 'system'
            });
            return;
        }
        
        this.app.processing = true;
        
        try {
            let response;
            // Handle both string and array formats for systemPrompt
            const systemPrompt = Array.isArray(this.app.currentScenario.systemPrompt) 
                ? this.app.currentScenario.systemPrompt.join('\n')
                : this.app.currentScenario.systemPrompt;
            
            // Replace <CURRENT SCENARIO DATA> placeholder with actual scenario data
            let processedSystemPrompt = systemPrompt;
            if (this.app.scenarioData && systemPrompt.includes('<CURRENT SCENARIO DATA>')) {
                const scenarioJSON = JSON.stringify(this.app.scenarioData, null, 2);
                processedSystemPrompt = systemPrompt.replace('<CURRENT SCENARIO DATA>', scenarioJSON);
            }
            
            // Always append the consistent JSON structure that the code expects
			const jsonStructure = `

## RESPONSE FORMAT

Respond with a JSON object containing:
* dialog: array of {speaker: string, text: string} - ONLY actual spoken words (what characters say). Do NOT include actions, body language, or narrative descriptions.
* observableChanges:
    - string describing only SIGNIFICANT actions or changes that are noteworthy (new objects appearing, important movements, suspicious behavior)
	- avoid minor details like tone of voice, small gestures, or obvious reactions
	- this field can be blank if nothing particularly noteworthy happens
* internalNotes: string with hidden thoughts, motivations, background events (AI reference only - never revealed to player)
* peopleUpdates: array of {name: string, observable: string} where 'observable' contains ONLY visible/audible changes

IMPORTANT: Respond ONLY with valid JSON in the exact format shown below. Do not include any text before or after the JSON.

EXAMPLE JSON FORMAT:
{
    "dialog": 
	[
        {
			"speaker": "Character Name", 
			"text": "What they say"
		}
    ],
    "observableChanges": "Description of significant actions or changes",
    "internalNotes": "AI reference notes",
    "peopleUpdates": 
	[
        {
			"name": "Character Name", 
			"observable": "Visible changes"
		}
    ]
}`;
            
            // Build complete system prompt with scenario context
            let fullSystemPrompt = processedSystemPrompt + '\n\n' + jsonStructure;
            
            // Append scenario context if available
            if (this.app.scenarioContext) {
                fullSystemPrompt += this.app.scenarioContext;
            }
            
            // Debug log to see which provider is being used
            console.log('Processing with provider:', this.app.selectedProvider);
            console.log('API key length:', this.app.apiKey ? this.app.apiKey.length : 0);
            
            switch(this.app.selectedProvider) {
                case 'anthropic':
                    response = await this.app.aiModels.callAnthropicAPI(fullSystemPrompt);
                    break;
                case 'google':
                    response = await this.app.aiModels.callGoogleAPI(fullSystemPrompt);
                    break;
                case 'xai':
                    response = await this.app.aiModels.callXAIAPI(fullSystemPrompt);
                    break;
                case 'deepseek':
                    response = await this.app.aiModels.callDeepSeekAPI(fullSystemPrompt);
                    break;
                default:
                    response = await this.app.aiModels.callOpenAIAPI(fullSystemPrompt);
            }
            
            const aiResponse = response;
            
            // Add dialog messages
            if (aiResponse.dialog) {
                aiResponse.dialog.forEach(msg => {
                    this.app.messages.push({
                        sender: msg.speaker,
                        content: msg.text,
                        type: 'npc'
                    });
                });
            }
            
            // Add observableChanges as system message
            if (aiResponse.observableChanges) {
                this.app.messages.push({
                    sender: 'System',
                    content: aiResponse.observableChanges,
                    type: 'system'
                });
            }
            
            // Update people
            if (aiResponse.peopleUpdates) {
                aiResponse.peopleUpdates.forEach(update => {
                    const person = this.app.people.find(p => p.name === update.name);
                    if (person) {
                        person.observable = update.observable;
                    }
                });
            }
            
            // Add to conversation history verbatim - pass the full AI response as-is
            this.app.conversationHistory.push({
                role: 'assistant',
                content: JSON.stringify(aiResponse)
            });
            
        } catch (error) {
            console.error('AI processing error:', error);
            
            // Provide more specific error message based on error type
            let errorMessage = 'Error processing response. ';
            if (error.message.includes('API error') || error.message.includes('401') || error.message.includes('403')) {
                errorMessage += 'Please check your API key and try again.';
            } else if (error.message.includes('JSON') || error.message.includes('parse')) {
                errorMessage += 'The AI returned invalid JSON format. This may be a provider compatibility issue.';
            } else {
                errorMessage += `Details: ${error.message}`;
            }
            
            this.app.messages.push({
                sender: 'System',
                content: errorMessage,
                type: 'system'
            });
        } finally {
            this.app.processing = false;
            
            // Refocus the chat input after AI response
            this.app.$nextTick(() => {
                const chatInput = document.querySelector('.chat-input textarea');
                if (chatInput) {
                    chatInput.focus();
                }
            });
        }
    }

    // Handle keyboard input in chat textarea
    handleInputKeydown(event) {
        // Auto-resize textarea
        this.autoResizeTextarea(event.target);
        
        if (event.key === 'Enter') {
            if (event.shiftKey) {
                // Shift+Enter: Allow new line (default behavior)
                return;
            } else {
                // Enter: Send message
                event.preventDefault();
                this.sendMessage();
            }
        }
    }
    
    // Auto-resize textarea based on content
    autoResizeTextarea(textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        
        // Set height to scrollHeight with minimum of 1 row and maximum of 5 rows
        const lineHeight = 24; // Approximate line height in pixels
        const minHeight = lineHeight * 1; // 1 row minimum
        const maxHeight = lineHeight * 5; // 5 rows maximum
        
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        
        textarea.style.height = newHeight + 'px';
        
        // Enable scrolling if content exceeds max height
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
} 
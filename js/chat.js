// Chat and messaging functionality
export class ChatManager {
    constructor(app) {
        this.app = app;
    }

    // Message handling
    getMessageClass(message) {
        if (message.type === 'system') return 'message-center';
        if (message.sender === 'User') return 'message-center user-input';
        if (message.type === 'npc-left') return 'message-left';
        if (message.type === 'npc-right') return 'message-right';
        return 'message-left';
    }
    
    async sendMessage() {
        if (!this.app.currentInput.trim() || !this.app.apiKey || this.app.processing) return;
        
        const userMessage = this.app.currentInput.trim();
        this.app.currentInput = '';
        
        // Add user message
        this.app.messages.push({
            sender: 'User',
            content: userMessage,
            type: 'user'
        });
        
        // Process with AI
        await this.processWithAI(userMessage);
    }
    
    // Build contextual coaching guidance based on current configuration
    buildCoachingGuidance() {
        let guidance = this.app.naturalPromptingGuide;
        
        // If no ElevenLabs key is configured, remove the audio tags section
        if (!this.app.elevenlabsKey) {
            // Remove the audio tags section from the guidance
            guidance = guidance.replace(/## Audio Tags \(when using voice synthesis\)[\s\S]*?(?=## Response Format|$)/m, '');
        }
        
        return guidance;
    }
    
    async processWithAI(userInput) {
        if (!this.app.currentPersona) {
            this.app.messages.push({
                sender: 'System',
                content: 'Please select a persona first.',
                type: 'system'
            });
            return;
        }
        
        this.app.processing = true;
        
        try {
            // Get system prompt from the current persona
            const personaPrompt = Array.isArray(this.app.currentPersona.systemPrompt) 
                ? this.app.currentPersona.systemPrompt.join('\n')
                : this.app.currentPersona.systemPrompt;
            
            // Build contextual coaching guidance
            const coachingGuidance = this.buildCoachingGuidance();
            
            const systemContent = `${personaPrompt}\n\n${coachingGuidance}`;
            const userContent = userInput;

            // Log for debugging
            console.log('Processing with provider:', this.app.selectedProvider);
            
            let response;
            switch(this.app.selectedProvider) {
                case 'anthropic':
                    response = await this.app.aiModels.callAnthropicAPI(systemContent, userContent);
                    break;
                case 'google':
                    response = await this.app.aiModels.callGoogleAPI(systemContent, userContent);
                    break;
                case 'xai':
                    response = await this.app.aiModels.callXAIAPI(systemContent, userContent);
                    break;
                case 'deepseek':
                    response = await this.app.aiModels.callDeepSeekAPI(systemContent, userContent);
                    break;
                default:
                    response = await this.app.aiModels.callOpenAIAPI(systemContent, userContent);
            }
            
            const aiResponse = response;
            
            // Handle new two-speaker dialogue format
            if (aiResponse.dialogue && Array.isArray(aiResponse.dialogue)) {
                // Add messages first
                aiResponse.dialogue.forEach((msg, index) => {
                    this.app.messages.push({
                        sender: msg.speaker,
                        content: msg.text,
                        type: index % 2 === 0 ? 'npc-left' : 'npc-right', // Alternate left/right
                        audioUrl: null // Will be set when audio is ready
                    });
                });

                // Generate audio for the dialogue using AudioManager
                const audioUrls = await this.app.audioManager.generateDialogueAudio(aiResponse.dialogue);
                
                // Attach audio URLs to messages
                audioUrls.forEach((audioUrl, index) => {
                    if (audioUrl) {
                        const messageIndex = this.app.messages.length - aiResponse.dialogue.length + index;
                        if (this.app.messages[messageIndex]) {
                            this.app.messages[messageIndex].audioUrl = audioUrl;
                        }
                    }
                });

            } else {
                console.warn('AI response did not contain a valid "dialogue" array:', aiResponse);
                this.app.messages.push({
                    sender: 'System',
                    content: 'The AI response was not in the expected format. Please check the persona template.',
                    type: 'system'
                });
            }
            
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
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
        // Use appropriate guide based on TTS provider
        if (this.app.ttsProvider === 'gemini') {
            return this.app.geminiTTSTextGuide;
        }

        // Otherwise, use ElevenLabs guidance
        return this.app.elevenlabsPromptingGuide;
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
            // Always generate text first using the selected AI provider
            const personaPrompt = Array.isArray(this.app.currentPersona.systemPrompt) 
                ? this.app.currentPersona.systemPrompt.join('\n')
                : this.app.currentPersona.systemPrompt;
            
            // Build contextual coaching guidance
            const coachingGuidance = this.buildCoachingGuidance();
            
            const systemContent = `${personaPrompt}\n\n${coachingGuidance}`;
            const userContent = userInput;

            // Log for debugging
            console.log('Processing with text provider:', this.app.selectedProvider);
            console.log('Using TTS provider:', this.app.ttsProvider);
            
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
            
            if (aiResponse.dialogue && Array.isArray(aiResponse.dialogue)) {
                // Generate unique conversation ID
                const conversationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

                // Add messages first
                aiResponse.dialogue.forEach((msg, index) => {
                    this.app.messages.push({
                        sender: msg.speaker,
                        content: msg.text,
                        type: index % 2 === 0 ? 'npc-left' : 'npc-right', // Alternate left/right
                        audioUrl: null, // Will be set when audio is ready
                        conversationId: conversationId,
                        isConversationStart: index === 0 // Mark first message of conversation
                    });
                });

                // Generate audio based on TTS provider
                if (this.app.ttsProvider === 'gemini') {
                    // Use Gemini TTS with the full dialogue context
                    await this.app.audioManager.generateGeminiAudioForDialogue(aiResponse.dialogue);
                } else {
                    // Use ElevenLabs TTS - generate both individual and concatenated audio
                    const { individualAudioUrls, conversationAudioUrl } = await this.app.audioManager.generateDialogueAudioWithIndividual(aiResponse.dialogue);
                    
                    // Attach individual audio URLs to messages
                    if (individualAudioUrls && individualAudioUrls.length > 0) {
                        individualAudioUrls.forEach((audioUrl, index) => {
                            if (audioUrl) {
                                const messageIndex = this.app.messages.length - aiResponse.dialogue.length + index;
                                if (this.app.messages[messageIndex]) {
                                    this.app.messages[messageIndex].audioUrl = audioUrl;
                                }
                            }
                        });
                    }
                    
                    // Store conversation audio on the first message for unified playback
                    if (conversationAudioUrl) {
                        const firstMessageIndex = this.app.messages.length - aiResponse.dialogue.length;
                        if (this.app.messages[firstMessageIndex]) {
                            this.app.messages[firstMessageIndex].conversationAudioUrl = conversationAudioUrl;
                        }
                    }
                }

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
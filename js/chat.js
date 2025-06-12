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
        let guidance = this.app.elevenlabsPromptingGuide;
        if (!this.app.elevenlabsKey) {
            // Remove the audio tags section from the guidance if the key isn't present
            guidance = guidance.replace(/## Audio Tags \(when using voice synthesis\)[\s\S]*?(?=## Response Format|$)/m, '');
        }
        
        return guidance;
    }

    // Generate Gemini audio for dialogue (new approach based on ChatGPT link)
    async generateGeminiAudioForDialogue(dialogue) {
        if (!dialogue || dialogue.length === 0) return;
        
        // Combine dialogue into a single context-aware prompt for Gemini TTS
        // Include speaker information and the full conversation flow
        let fullContext = "Generate natural speech for the following dialogue:\n\n";
        dialogue.forEach((msg, index) => {
            fullContext += `${msg.speaker}: ${msg.text}\n`;
        });
        
        // Create a single audio for the entire dialogue
        const prompt = fullContext;
        
        const requestBody = {
            model: this.app.geminiTTSModel,
            contents: [{
                parts: [{ text: prompt }]
            }],
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_ONLY_HIGH"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_ONLY_HIGH"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_ONLY_HIGH"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_ONLY_HIGH"
                }
            ],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { 
                            voiceName: this.app.geminiVoice || 'Kore'
                        }
                    }
                }
            }
        };
        
        const startTime = Date.now();
        if (this.app.debugEnabled) {
            this.app.logDebug('request','gemini-tts',this.app.geminiTTSModel,{request:requestBody});
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.app.geminiTTSModel}:generateContent?key=${this.app.googleKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini TTS API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (this.app.debugEnabled){
            this.app.logDebug('response','gemini-tts',this.app.geminiTTSModel,{response:data,duration:Date.now()-startTime});
        }
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates in Gemini TTS response');
        }
        
        const candidate = data.candidates[0];
        
        // Extract audio data from response
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const base64Audio = part.inlineData.data;
                    const audioData = this.convertPCMToWAV(base64Audio);
                    
                    // Attach audio to the first message for unified playback
                    const firstMessageIndex = this.app.messages.length - dialogue.length;
                    if (this.app.messages[firstMessageIndex]) {
                        this.app.messages[firstMessageIndex].audioData = audioData;
                        this.app.messages[firstMessageIndex].audioMimeType = 'audio/wav';
                        this.app.messages[firstMessageIndex].isGeminiAudio = true;
                    }
                    
                    return;
                }
            }
        }

        throw new Error('No audio data found in Gemini TTS response');
    }

    // Convert base64 PCM data to base64 WAV data
    convertPCMToWAV(base64PCM) {
        // Decode base64 to binary
        const binaryString = atob(base64PCM);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            pcmBytes[i] = binaryString.charCodeAt(i);
        }
        
        // PCM parameters from Google's documentation
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        
        // Create WAV header
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        
        const wavHeader = new ArrayBuffer(44);
        const dv = new DataView(wavHeader);
        
        // RIFF chunk descriptor
        dv.setUint32(0, 0x52494646, false);             // "RIFF"
        dv.setUint32(4, 36 + pcmBytes.length, true);    // Chunk size
        dv.setUint32(8, 0x57415645, false);             // "WAVE"
        
        // fmt subchunk
        dv.setUint32(12, 0x666d7420, false);            // "fmt "
        dv.setUint32(16, 16, true);                     // Subchunk1Size (16 for PCM)
        dv.setUint16(20, 1, true);                      // AudioFormat (1 = PCM)
        dv.setUint16(22, numChannels, true);            // NumChannels
        dv.setUint32(24, sampleRate, true);             // SampleRate
        dv.setUint32(28, byteRate, true);               // ByteRate
        dv.setUint16(32, blockAlign, true);             // BlockAlign
        dv.setUint16(34, bitsPerSample, true);          // BitsPerSample
        
        // data subchunk
        dv.setUint32(36, 0x64617461, false);            // "data"
        dv.setUint32(40, pcmBytes.length, true);        // Subchunk2Size
        
        // Combine header and PCM data
        const wavBytes = new Uint8Array(44 + pcmBytes.length);
        wavBytes.set(new Uint8Array(wavHeader), 0);
        wavBytes.set(pcmBytes, 44);
        
        // Convert back to base64
        let binary = '';
        for (let i = 0; i < wavBytes.length; i++) {
            binary += String.fromCharCode(wavBytes[i]);
        }
        return btoa(binary);
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
                // Add messages first
                aiResponse.dialogue.forEach((msg, index) => {
                    this.app.messages.push({
                        sender: msg.speaker,
                        content: msg.text,
                        type: index % 2 === 0 ? 'npc-left' : 'npc-right', // Alternate left/right
                        audioUrl: null // Will be set when audio is ready
                    });
                });

                // Generate audio based on TTS provider
                if (this.app.ttsProvider === 'gemini') {
                    // Use Gemini TTS with the full dialogue context
                    await this.generateGeminiAudioForDialogue(aiResponse.dialogue);
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
                            this.app.messages[firstMessageIndex].isConversationStart = true;
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
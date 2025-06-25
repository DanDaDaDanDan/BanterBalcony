// Voice testing functionality for testing all voice models
export class VoiceTestManager {
    constructor(app) {
        this.app = app;
        this.debugSessions = new Map(); // sessionId -> session data
        this.activeSession = null;
        this.concurrencyLimits = {
            'elevenlabs': 3,
            'gemini': 5,
            'fal.ai': 3, // for all fal.ai models
            'default': 2
        };
        this.retryDelays = {
            initial: 1000,
            multiplier: 2,
            maxDelay: 30000,
            maxRetries: 3
        };
    }

    // Create a new debug session
    async createDebugSession(userInput, selectedModels = null) {
        const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const session = {
            id: sessionId,
            userInput: userInput,
            startTime: Date.now(),
            models: [],
            status: 'initializing',
            errors: []
        };
        
        this.debugSessions.set(sessionId, session);
        this.activeSession = sessionId;
        
        // Get all available TTS models
        const allModels = this.getAllVoiceModels();
        
        // Filter to only selected models if provided
        const models = selectedModels ? 
            allModels.filter(model => selectedModels.includes(model.modelId)) :
            allModels;
        
        // Initialize model entries
        models.forEach(model => {
            session.models.push({
                provider: model.provider,
                modelId: model.modelId,
                modelName: model.modelName,
                displayName: model.displayName,
                modelString: model.modelString,
                status: 'pending',
                progress: 0,
                textGeneration: null,
                audioGeneration: null,
                error: null,
                retryCount: 0,
                audioUrl: null,
                prompt: null,
                response: null,
                showDetails: false,  // Initialize showDetails for expandable UI
                timings: {
                    textStart: null,
                    textEnd: null,
                    audioStart: null,
                    audioEnd: null
                }
            });
        });
        
        session.status = 'ready';
        this.updateDebugUI();
        
        // Start processing
        await this.processDebugSession(session);
        
        return sessionId;
    }

    // Get all available voice models
    getAllVoiceModels() {
        const models = [];
        
        // All ElevenLabs models
        const elevenlabsModels = [
            'eleven_v3',
            'eleven_multilingual_v2',
            'eleven_turbo_v2_5',
            'eleven_turbo_v2',
            'eleven_flash_v2_5',
            'eleven_flash_v2',
            'eleven_monolingual_v1'
        ];
        
        // Add all ElevenLabs models
        elevenlabsModels.forEach(model => {
            models.push({
                provider: 'elevenlabs',
                modelId: `elevenlabs_${model}`,
                modelName: `ElevenLabs - ${model.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                displayName: 'ElevenLabs',
                modelString: model,
                selected: false // Default to unselected for many models
            });
        });
        
        // Add Gemini TTS models (not voices)
        models.push({
            provider: 'gemini',
            modelId: 'gemini_flash',
            modelName: 'Gemini 2.5 Flash TTS',
            displayName: 'Gemini',
            modelString: 'gemini-2.5-flash-preview-tts',
            selected: false
        });
        
        models.push({
            provider: 'gemini',
            modelId: 'gemini_pro',
            modelName: 'Gemini 2.5 Pro TTS',
            displayName: 'Gemini',
            modelString: 'gemini-2.5-pro-preview-tts',
            selected: false
        });
        
        // Add fal.ai models
        const falModels = [
            { provider: 'orpheus-tts', name: 'Orpheus TTS', model: 'orpheus-tts' },
            { provider: 'playai-tts-v3', name: 'PlayAI V3', model: 'playai-tts-v3' },
            { provider: 'playai-tts-dialog', name: 'PlayAI Dialog', model: 'playai-tts-dialog' },
            { provider: 'dia-tts', name: 'DIA TTS', model: 'dia-tts' },
            { provider: 'dia-tts-clone', name: 'DIA TTS Clone', model: 'dia-tts-clone' },
            { provider: 'f5-tts', name: 'F5-TTS', model: 'f5-tts' },
            { provider: 'kokoro-tts', name: 'Kokoro TTS', model: 'kokoro-tts' },
            { provider: 'chatterbox-tts', name: 'Chatterbox TTS', model: 'chatterbox-tts' }
        ];
        
        falModels.forEach(tts => {
            models.push({
                provider: tts.provider,
                modelId: tts.provider,
                modelName: tts.name,
                displayName: tts.name,
                modelString: tts.model,
                selected: false
            });
        });
        
        // Select first of each provider by default
        models[0].selected = true; // First ElevenLabs
        models[elevenlabsModels.length].selected = true; // First Gemini
        models[elevenlabsModels.length + 2].selected = true; // First fal.ai
        
        return models;
    }

    // Process debug session with parallel execution and rate limiting
    async processDebugSession(session) {
        session.status = 'processing';
        this.updateDebugUI();
        
        // Group models by provider for rate limiting
        const modelsByProvider = {};
        session.models.forEach(model => {
            const providerKey = model.provider.startsWith('orpheus') || 
                               model.provider.startsWith('playai') || 
                               model.provider.startsWith('dia') || 
                               model.provider.startsWith('f5') || 
                               model.provider.startsWith('kokoro') ? 'fal.ai' : model.provider;
            
            if (!modelsByProvider[providerKey]) {
                modelsByProvider[providerKey] = [];
            }
            modelsByProvider[providerKey].push(model);
        });
        
        // Process each provider group with concurrency limits
        const providerPromises = Object.entries(modelsByProvider).map(([provider, models]) => {
            return this.processProviderModels(session, provider, models);
        });
        
        // Wait for all providers to complete
        await Promise.all(providerPromises);
        
        // Set completion status and end time
        session.status = 'completed';
        session.endTime = Date.now();
        
        // Check if any models failed
        const failedCount = session.models.filter(m => m.status === 'failed').length;
        if (failedCount === session.models.length) {
            session.status = 'all_failed';
        } else if (failedCount > 0) {
            session.status = 'partial_success';
        }
        
        this.updateDebugUI();
    }

    // Process models for a specific provider with concurrency control
    async processProviderModels(session, provider, models) {
        const concurrencyLimit = this.concurrencyLimits[provider] || this.concurrencyLimits.default;
        const queue = [...models];
        const processing = [];
        
        while (queue.length > 0 || processing.length > 0) {
            // Start new tasks up to concurrency limit
            while (processing.length < concurrencyLimit && queue.length > 0) {
                const model = queue.shift();
                const task = this.processModel(session, model).then(() => {
                    // Remove from processing when done
                    const index = processing.indexOf(task);
                    if (index > -1) processing.splice(index, 1);
                });
                processing.push(task);
            }
            
            // Wait for at least one task to complete
            if (processing.length > 0) {
                await Promise.race(processing);
            }
        }
    }

    // Process individual model with retry logic
    async processModel(session, model) {
        try {
            // Step 1: Generate text
            model.status = 'generating_text';
            model.timings.textStart = Date.now();
            model.progress = 0;
            this.updateDebugUI();
            
            const textResult = await this.generateTextWithRetry(session, model);
            if (!textResult.success) {
                throw new Error(textResult.error);
            }
            
            model.textGeneration = textResult.data;
            model.prompt = textResult.prompt;
            model.response = textResult.response;
            model.timings.textEnd = Date.now();
            model.progress = 50;
            model.status = 'text_completed';
            this.updateDebugUI();
            
            // Step 2: Generate audio
            model.status = 'generating_audio';
            model.timings.audioStart = Date.now();
            this.updateDebugUI();
            
            const audioResult = await this.generateAudioWithRetry(session, model);
            if (!audioResult.success) {
                throw new Error(audioResult.error);
            }
            
            model.audioGeneration = audioResult.data;
            model.audioUrl = audioResult.audioUrl;
            model.timings.audioEnd = Date.now();
            model.progress = 100;
            
            // Check if we actually got audio - if not, mark as failed
            if (!model.audioUrl) {
                throw new Error('No audio URL generated');
            }
            
            model.status = 'completed';
            
        } catch (error) {
            model.status = 'failed';
            model.error = error.message;
            model.progress = 0;
            session.errors.push({
                model: model.modelName,
                error: error.message,
                timestamp: Date.now()
            });
        }
        
        // Final update
        this.updateDebugUI();
    }

    // Generate text with retry logic
    async generateTextWithRetry(session, model) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= this.retryDelays.maxRetries; attempt++) {
            try {
                // Add delay for retries
                if (attempt > 0) {
                    const delay = Math.min(
                        this.retryDelays.initial * Math.pow(this.retryDelays.multiplier, attempt - 1),
                        this.retryDelays.maxDelay
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                model.retryCount = attempt;
                // Update progress based on attempt
                model.progress = Math.min(25, attempt * 10);
                this.updateDebugUI();
                
                const result = await this.generateText(session, model);
                return { success: true, data: result.dialogue, prompt: result.prompt, response: result.response };
                
            } catch (error) {
                lastError = error;
                console.warn(`Text generation attempt ${attempt + 1} failed for ${model.modelName}:`, error);
                
                // Check if we should retry
                if (this.isRetryableError(error) && attempt < this.retryDelays.maxRetries) {
                    continue;
                }
                break;
            }
        }
        
        return { success: false, error: lastError?.message || 'Unknown error' };
    }

    // Generate audio with retry logic
    async generateAudioWithRetry(session, model) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= this.retryDelays.maxRetries; attempt++) {
            try {
                // Add delay for retries
                if (attempt > 0) {
                    const delay = Math.min(
                        this.retryDelays.initial * Math.pow(this.retryDelays.multiplier, attempt - 1),
                        this.retryDelays.maxDelay
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                model.retryCount = attempt;
                // Update progress based on attempt (50-75% range)
                model.progress = 50 + Math.min(25, attempt * 10);
                this.updateDebugUI();
                
                const result = await this.generateAudio(session, model);
                return { success: true, data: result, audioUrl: result.audioUrl };
                
            } catch (error) {
                lastError = error;
                console.warn(`Audio generation attempt ${attempt + 1} failed for ${model.modelName}:`, error);
                
                // Check if we should retry
                if (this.isRetryableError(error) && attempt < this.retryDelays.maxRetries) {
                    continue;
                }
                break;
            }
        }
        
        return { success: false, error: lastError?.message || 'Unknown error' };
    }

    // Check if error is retryable
    isRetryableError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('rate limit') ||
               message.includes('429') ||
               message.includes('timeout') ||
               message.includes('network') ||
               message.includes('503') ||
               message.includes('502');
    }

    // Generate text for a model
    async generateText(session, model) {
        // Use the same logic as chat.js but with the specific persona
        const personaPrompt = Array.isArray(this.app.currentPersona.systemPrompt) 
            ? this.app.currentPersona.systemPrompt.join('\n')
            : this.app.currentPersona.systemPrompt;
        
        // Get TTS-specific prompting guide
        const ttsGuides = {
            'elevenlabs': this.app.elevenlabsPromptingGuide,
            'gemini': this.app.geminiTTSTextGuide,
            'orpheus-tts': this.app.orpheusTTSGuide,
            'playai-tts-v3': this.app.playaiTTSGuide,
            'playai-tts-dialog': this.app.playaiTTSGuide,
            'dia-tts': this.app.diaTTSGuide,
            'dia-tts-clone': this.app.diaTTSGuide,
            'f5-tts': this.app.f5TTSGuide,
            'kokoro-tts': this.app.kokoroTTSGuide,
            'chatterbox-tts': this.app.chatterboxTTSGuide
        };
        
        const coachingGuidance = ttsGuides[model.provider] || 'Format your response as natural dialogue.';
        const ttsContext = `You are generating dialogue that will be converted to speech using ${model.displayName}. Follow the guidelines below for optimal audio output.\n\n`;
        
        const systemContent = `${personaPrompt}\n\n${ttsContext}${coachingGuidance}`;
        const userContent = session.userInput;
        
        // Store the prompt for inspection
        const prompt = {
            system: systemContent,
            user: userContent
        };
        
        // Call the appropriate AI API
        let response;
        switch(this.app.selectedProvider) {
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
        
        return { dialogue: response.dialogue, prompt: prompt, response: response };
    }

    // Generate audio for a model
    async generateAudio(session, model) {
        // Store the current TTS provider settings
        const originalProvider = this.app.ttsProvider;
        const originalElevenlabsModel = this.app.elevenlabsModel;
        const originalGoogleModel = this.app.googleModel;
        
        try {
            // Temporarily set the TTS provider and model for this test
            this.app.ttsProvider = model.provider;
            
            // Set specific model/voice based on provider
            if (model.provider === 'elevenlabs') {
                this.app.elevenlabsModel = model.modelString;
            } else if (model.provider === 'gemini') {
                // For Gemini, set the Google model based on TTS model
                if (model.modelString.includes('flash')) {
                    this.app.googleModel = 'gemini-2.5-flash-latest';
                } else {
                    this.app.googleModel = 'gemini-2.5-pro-latest';
                }
                // The voice will be determined by the persona's gemini_voices
            }
            
            // Generate audio using the audio manager
            const result = await this.app.audioManager.generateDialogueAudioWithIndividual(model.textGeneration);
            
            // Check if generation was successful
            if (!result) {
                throw new Error('Audio generation returned null result');
            }
            
            // Extract audio URL from different possible formats
            let audioUrl = null;
            if (result.conversationAudioUrl) {
                audioUrl = result.conversationAudioUrl;
            } else if (result.audioUrl) {
                audioUrl = result.audioUrl;
            } else if (result.individualAudioUrls && result.individualAudioUrls.length > 0) {
                // Use first individual audio URL if no conversation URL
                audioUrl = result.individualAudioUrls[0];
            }
            
            if (!audioUrl) {
                throw new Error('No audio URL generated from TTS provider');
            }
            
            return { success: true, data: result, audioUrl: audioUrl };
        } catch (error) {
            console.error('Audio generation error:', error);
            return { success: false, error: error.message };
        } finally {
            // Restore original settings
            this.app.ttsProvider = originalProvider;
            this.app.elevenlabsModel = originalElevenlabsModel;
            this.app.googleModel = originalGoogleModel;
        }
    }

    // Update debug UI
    updateDebugUI() {
        // Get current session
        const session = this.getCurrentSession();
        if (session) {
            console.log('Debug UI Update:', {
                sessionId: session.id,
                status: session.status,
                completedModels: session.models.filter(m => m.status === 'completed').length,
                failedModels: session.models.filter(m => m.status === 'failed').length,
                processingModels: session.models.filter(m => m.status === 'generating_text' || m.status === 'generating_audio').length
            });
        }
        
        // This will trigger Alpine.js reactivity
        if (this.app.updateDebugView) {
            // Use setTimeout to ensure the update happens in the next tick
            // This helps Alpine.js detect the changes
            setTimeout(() => {
                this.app.updateDebugView();
            }, 0);
        }
    }

    // Get current session data
    getCurrentSession() {
        return this.activeSession ? this.debugSessions.get(this.activeSession) : null;
    }

    // Play audio for a specific model
    playModelAudio(sessionId, modelId) {
        const session = this.debugSessions.get(sessionId);
        if (!session) return;
        
        const model = session.models.find(m => m.modelId === modelId);
        if (!model || !model.audioUrl) return;
        
        this.app.audioManager.playAudio(model.audioUrl, `debug-${modelId}`);
    }

    // Export session data
    exportSession(sessionId) {
        const session = this.debugSessions.get(sessionId);
        if (!session) return null;
        
        return {
            id: session.id,
            userInput: session.userInput,
            timestamp: session.startTime,
            duration: session.endTime ? session.endTime - session.startTime : null,
            models: session.models.map(model => ({
                provider: model.provider,
                modelName: model.modelName,
                status: model.status,
                error: model.error,
                timings: model.timings,
                prompt: model.prompt,
                response: model.response,
                audioUrl: model.audioUrl
            }))
        };
    }
} 
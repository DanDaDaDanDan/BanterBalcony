// TTS Provider System - Base classes and provider implementations

// Base TTS Provider class that all providers extend
export class BaseTTSProvider {
    constructor(app) {
        this.app = app;
        this.providerName = 'base';
        this.requiresApiKey = true;
        this.supportsMultipleSpeakers = true;
        this.supportsDialogueMode = false;
        this.supportedModels = [];
    }

    // Get API key for this provider
    getApiKey() {
        throw new Error('getApiKey must be implemented by provider');
    }

    // Check if provider is configured
    isConfigured() {
        if (!this.requiresApiKey) return true;
        return !!this.getApiKey();
    }

    // Get current model for this provider
    getCurrentModel() {
        throw new Error('getCurrentModel must be implemented by provider');
    }

    // Filter/process text before sending to TTS (e.g. remove tags)
    filterText(text) {
        return text;
    }

    // Generate audio for a single text
    async generateSingleAudio(text, voiceId) {
        throw new Error('generateSingleAudio must be implemented by provider');
    }

    // Generate audio for dialogue (array of speaker/text pairs)
    async generateDialogueAudio(dialogue) {
        if (!this.supportsDialogueMode) {
            // Fallback to generating individual audio for each message
            return this.generateIndividualAudios(dialogue);
        }
        throw new Error('generateDialogueAudio must be implemented by provider');
    }

    // Generate individual audio URLs for dialogue messages
    async generateIndividualAudios(dialogue) {
        const audioBlobs = [];
        const individualAudioUrls = [];
        const maxConcurrent = 5;

        // Process in chunks
        for (let i = 0; i < dialogue.length; i += maxConcurrent) {
            const chunk = dialogue.slice(i, i + maxConcurrent);
            const chunkPromises = chunk.map(async (msg, chunkIndex) => {
                const actualIndex = i + chunkIndex;
                const voiceId = this.getVoiceForSpeaker(msg.speaker);
                
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return { index: actualIndex, audioBlob: null, audioUrl: null };
                }
                
                try {
                    const audioBlob = await this.generateSingleAudioBlob(msg.text, voiceId);
                    const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
                    return { index: actualIndex, audioBlob, audioUrl };
                } catch (error) {
                    console.error(`Error generating audio for message ${actualIndex}:`, error);
                    return { index: actualIndex, audioBlob: null, audioUrl: null };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            
            chunkResults.forEach(result => {
                audioBlobs[result.index] = result.audioBlob;
                individualAudioUrls[result.index] = result.audioUrl;
            });

            if (i + maxConcurrent < dialogue.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Concatenate for conversation audio
        const validBlobs = audioBlobs.filter(blob => blob !== null);
        let conversationAudioUrl = null;
        
        if (validBlobs.length > 0 && this.app.audioManager) {
            const concatenatedBlob = await this.app.audioManager.concatenateAudioBlobs(validBlobs);
            conversationAudioUrl = URL.createObjectURL(concatenatedBlob);
        }

        return { individualAudioUrls, conversationAudioUrl };
    }

    // Generate audio blob (for concatenation)
    async generateSingleAudioBlob(text, voiceId) {
        throw new Error('generateSingleAudioBlob must be implemented by provider');
    }

    // Get voice ID/config for a speaker
    getVoiceForSpeaker(speaker) {
        // First check if template has voice profiles
        if (this.app.currentPersona?.voice_profiles?.[speaker]) {
            const profileId = this.app.currentPersona.voice_profiles[speaker];
            if (this.app.voiceProfileManager) {
                const profile = this.app.voiceProfileManager.getProfile(profileId);
                if (profile) {
                    const config = profile.getProviderConfig(this.providerName);
                    if (config) {
                        // Extract the appropriate value based on provider type
                        if (this.providerName === 'elevenlabs' && config.voiceId) {
                            return config.voiceId;
                        } else if (this.providerName === 'gemini' && config.voiceName) {
                            return config.voiceName;
                        } else if (config.voice) {
                            return config.voice;
                        }
                        return config;
                    }
                }
            }
        }
        
        // Then try voice profile manager template mappings
        if (this.app.voiceProfileManager) {
            const templateName = this.app.currentPersona?.name || 'default';
            const voiceInfo = this.app.voiceProfileManager.getVoiceConfig(templateName, speaker, this.providerName);
            if (voiceInfo && voiceInfo.config) {
                // Extract the appropriate value based on provider type
                if (this.providerName === 'elevenlabs' && voiceInfo.config.voiceId) {
                    return voiceInfo.config.voiceId;
                } else if (this.providerName === 'gemini' && voiceInfo.config.voiceName) {
                    return voiceInfo.config.voiceName;
                } else if (voiceInfo.config.voice) {
                    return voiceInfo.config.voice;
                }
                return voiceInfo.config;
            }
        }
        
        // Fallback to legacy persona voices
        if (!this.app.currentPersona) return null;
        
        // For Gemini, check gemini_voices first
        if (this.providerName === 'gemini' && this.app.currentPersona.gemini_voices?.[speaker]) {
            return this.app.currentPersona.gemini_voices[speaker];
        }
        
        return this.app.currentPersona.voices?.[speaker];
    }

    // Log debug info
    logDebug(type, data) {
        if (this.app.debugEnabled) {
            this.app.logDebug(type, this.providerName, this.getCurrentModel(), data);
        }
    }
}

// ElevenLabs Provider
export class ElevenLabsProvider extends BaseTTSProvider {
    constructor(app) {
        super(app);
        this.providerName = 'elevenlabs';
        this.supportsDialogueMode = true;
        this.supportedModels = [
            'eleven_v3',
            'eleven_multilingual_v2',
            'eleven_turbo_v2_5',
            'eleven_turbo_v2',
            'eleven_flash_v2_5',
            'eleven_flash_v2',
            'eleven_monolingual_v1'
        ];
    }

    getApiKey() {
        return this.app.elevenlabsKey;
    }

    getCurrentModel() {
        return this.app.elevenlabsModel;
    }

    filterText(text) {
        // Only filter tags for ElevenLabs models that are NOT eleven_v3
        if (this.app.elevenlabsModel !== 'eleven_v3') {
            return text.replace(/\[([^\]]+)\]/g, '');
        }
        return text;
    }

    async generateSingleAudioBlob(text, voiceId) {
        if (!this.isConfigured() || !voiceId) {
            return null;
        }
        
        try {
            const processedText = this.filterText(text);
            
            const requestData = {
                text: processedText,
                model_id: this.getCurrentModel(),
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            };
            
            const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
            const headers = {
                'Content-Type': 'application/json',
                'xi-api-key': this.getApiKey()
            };
            
            this.logDebug('request', {
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': headers['Content-Type'],
                    'xi-api-key': '[REDACTED]'
                },
                body: requestData,
                voiceId: voiceId,
                model: this.getCurrentModel(),
                provider: this.providerName
            });
            
            const requestStartTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });
            const requestDuration = Date.now() - requestStartTime;
            
            if (!response.ok) {
                const error = await response.text();
                this.logDebug('response', {
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    duration: requestDuration,
                    success: false,
                    voiceId: voiceId,
                    model: this.getCurrentModel(),
                    provider: this.providerName,
                    error: { message: `ElevenLabs API error: ${response.status} - ${error}`, raw_response: error }
                });
                throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
            }
            
            const audioBlob = await response.blob();
            
            this.logDebug('response', {
                url: url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                duration: requestDuration,
                success: true,
                voiceId: voiceId,
                audioSize: audioBlob.size,
                audioType: audioBlob.type,
                model: this.getCurrentModel(),
                provider: this.providerName
            });
            
            return audioBlob;
        } catch (error) {
            console.error(`Audio generation error for voice ${voiceId}:`, error);
            this.logDebug('error', { 
                voiceId: voiceId, 
                error: error.message,
                model: this.getCurrentModel(),
                provider: this.providerName 
            });
            return null;
        }
    }

    async generateDialogueAudio(dialogue) {
        if (!this.isConfigured() || !dialogue || !Array.isArray(dialogue)) {
            return { individualAudioUrls: [], conversationAudioUrl: null };
        }

        // Check if using dialogue API mode
        if (this.app.elevenlabsApiMode === 'dialogue') {
            // Use dialogue API
            const conversationAudioUrl = await this.generateDialogueWithAPI(dialogue);
            const individualAudioUrls = new Array(dialogue.length).fill(null);
            return { individualAudioUrls, conversationAudioUrl };
        } else {
            // Use individual TTS
            return this.generateIndividualAudios(dialogue);
        }
    }

    async generateDialogueWithAPI(dialogue) {
        try {
            const inputs = dialogue.map(msg => {
                const voiceId = this.getVoiceForSpeaker(msg.speaker);
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return null;
                }
                
                const processedText = this.filterText(msg.text);
                
                return {
                    text: processedText,
                    voice_id: voiceId
                };
            }).filter(input => input !== null);

            if (inputs.length === 0) {
                console.warn('No valid inputs for dialogue API');
                return null;
            }

            const requestData = {
                inputs: inputs,
                model_id: this.getCurrentModel(),
                settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            };

            const url = 'https://api.elevenlabs.io/v1/text-to-dialogue';
            const headers = {
                'Content-Type': 'application/json',
                'xi-api-key': this.getApiKey()
            };

            this.logDebug('request', {
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': headers['Content-Type'],
                    'xi-api-key': '[REDACTED]'
                },
                body: requestData,
                inputCount: inputs.length,
                type: 'dialogue_api',
                model: this.getCurrentModel(),
                provider: this.providerName
            });

            const requestStartTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });
            const requestDuration = Date.now() - requestStartTime;

            if (!response.ok) {
                const error = await response.text();
                this.logDebug('response', {
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    duration: requestDuration,
                    success: false,
                    inputCount: inputs.length,
                    type: 'dialogue_api',
                    model: this.getCurrentModel(),
                    provider: this.providerName,
                    error: { message: `ElevenLabs Dialogue API error: ${response.status} - ${error}`, raw_response: error }
                });
                throw new Error(`ElevenLabs Dialogue API error: ${response.status} - ${error}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            this.logDebug('response', {
                url: url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                duration: requestDuration,
                success: true,
                inputCount: inputs.length,
                audioSize: audioBlob.size,
                audioType: audioBlob.type,
                type: 'dialogue_api',
                model: this.getCurrentModel(),
                provider: this.providerName
            });

            return audioUrl;
        } catch (error) {
            console.error('Dialogue API generation error:', error);
            this.logDebug('error', { 
                error: error.message,
                type: 'dialogue_api',
                model: this.getCurrentModel(),
                provider: this.providerName 
            });
            return null;
        }
    }
}

// Gemini Provider
export class GeminiProvider extends BaseTTSProvider {
    constructor(app) {
        super(app);
        this.providerName = 'gemini';
        this.supportsDialogueMode = true;
        this.supportedModels = [
            'gemini-2.5-flash-preview-tts',
            'gemini-2.5-pro-preview-tts'
        ];
    }

    getApiKey() {
        return this.app.googleKey;
    }

    getCurrentModel() {
        // Use flash or pro TTS model based on the selected Google model
        if (this.app.googleModel.includes('flash')) {
            return 'gemini-2.5-flash-preview-tts';
        } else {
            return 'gemini-2.5-pro-preview-tts';
        }
    }

    getVoiceForSpeaker(speaker) {
        if (!this.app.currentPersona) return null;
        const geminiVoices = this.app.currentPersona.gemini_voices || {};
        return geminiVoices[speaker] || this.app.geminiVoice || 'Kore';
    }

    async generateDialogueAudio(dialogue) {
        if (!dialogue || dialogue.length === 0) return { individualAudioUrls: [], conversationAudioUrl: null };
        
        try {
            // Build multi-speaker context
            const geminiVoices = this.app.currentPersona?.gemini_voices || {};
            const speakerNames = [...new Set(dialogue.map(msg => msg.speaker))];
            
            let fullContext = "You are generating speech for a multi-character dialogue. ";
            
            if (Object.keys(geminiVoices).length > 0) {
                fullContext += "Voice assignments:\n";
                speakerNames.forEach(speaker => {
                    const voiceName = geminiVoices[speaker] || 'Kore';
                    fullContext += `- ${speaker}: Use ${voiceName} voice characteristics\n`;
                });
                fullContext += "\n";
            }
            
            fullContext += "Generate natural speech for the following dialogue with distinct voices for each speaker:\n\n";
            
            dialogue.forEach((msg, index) => {
                fullContext += `${msg.speaker}: ${msg.text}\n`;
            });
            
            const primarySpeaker = dialogue[0]?.speaker;
            const primaryVoice = geminiVoices[primarySpeaker] || this.app.geminiVoice || 'Kore';
            
            const speakerVoiceConfigs = speakerNames.map(speaker => ({
                speaker: speaker,
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: geminiVoices[speaker] || 'Kore'
                    }
                }
            }));

            const requestBody = {
                model: this.getCurrentModel(),
                contents: [{
                    parts: [{ text: fullContext }]
                }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: speakerNames.length > 1 ? {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: speakerVoiceConfigs
                        }
                    } : {
                        voiceConfig: {
                            prebuiltVoiceConfig: { 
                                voiceName: primaryVoice
                            }
                        }
                    }
                }
            };
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.getCurrentModel()}:generateContent?key=${this.getApiKey()}`;
            const headers = {
                'Content-Type': 'application/json'
            };
            
            this.logDebug('request', {
                url: url.replace(/key=[^&]+/, 'key=[REDACTED]'),
                method: 'POST',
                headers: headers,
                body: requestBody,
                speakerCount: speakerNames.length,
                dialogueLength: dialogue.length,
                type: 'multi_speaker_dialogue',
                model: this.getCurrentModel(),
                provider: this.providerName
            });
            
            const requestStartTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            const requestDuration = Date.now() - requestStartTime;

            if (!response.ok) {
                const errorText = await response.text();
                this.logDebug('response', {
                    url: url.replace(/key=[^&]+/, 'key=[REDACTED]'),
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    duration: requestDuration,
                    success: false,
                    speakerCount: speakerNames.length,
                    dialogueLength: dialogue.length,
                    type: 'multi_speaker_dialogue',
                    model: this.getCurrentModel(),
                    provider: this.providerName,
                    error: { message: `Gemini TTS API error: ${response.status} - ${errorText}`, raw_response: errorText }
                });
                throw new Error(`Gemini TTS API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            this.logDebug('response', {
                url: url.replace(/key=[^&]+/, 'key=[REDACTED]'),
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                duration: requestDuration,
                success: true,
                speakerCount: speakerNames.length,
                dialogueLength: dialogue.length,
                candidatesCount: data.candidates?.length || 0,
                type: 'multi_speaker_dialogue',
                model: this.getCurrentModel(),
                provider: this.providerName,
                data: data
            });
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('No candidates in Gemini TTS response');
            }
            
            const candidate = data.candidates[0];
            
            // Extract audio data
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const base64Audio = part.inlineData.data;
                        const audioData = this.convertPCMToWAV(base64Audio);
                        
                        // Store on first message
                        const firstMessageIndex = this.app.messages.length - dialogue.length;
                        if (this.app.messages[firstMessageIndex]) {
                            this.app.messages[firstMessageIndex].audioData = audioData;
                            this.app.messages[firstMessageIndex].audioMimeType = 'audio/wav';
                            this.app.messages[firstMessageIndex].isGeminiAudio = true;
                        }
                        
                        return { individualAudioUrls: [], conversationAudioUrl: null };
                    }
                }
            }

            throw new Error('No audio data found in Gemini TTS response');
        } catch (error) {
            console.error('Gemini TTS error:', error);
            this.logDebug('error', { 
                error: error.message,
                type: 'multi_speaker_dialogue',
                model: this.getCurrentModel(),
                provider: this.providerName 
            });
            return { individualAudioUrls: [], conversationAudioUrl: null };
        }
    }

    convertPCMToWAV(base64PCM) {
        // Convert base64 PCM to base64 WAV
        const binaryString = atob(base64PCM);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            pcmBytes[i] = binaryString.charCodeAt(i);
        }

        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const dataLength = pcmBytes.length;

        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        // WAV header
        const setString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        setString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        setString(8, 'WAVE');
        setString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
        view.setUint16(32, numChannels * bitsPerSample / 8, true);
        view.setUint16(34, bitsPerSample, true);
        setString(36, 'data');
        view.setUint32(40, dataLength, true);

        const wavBytes = new Uint8Array(44 + dataLength);
        wavBytes.set(new Uint8Array(wavHeader), 0);
        wavBytes.set(pcmBytes, 44);

        let binary = '';
        for (let i = 0; i < wavBytes.length; i++) {
            binary += String.fromCharCode(wavBytes[i]);
        }
        return btoa(binary);
    }
}

// Fal.ai Provider
export class FalProvider extends BaseTTSProvider {
    constructor(app) {
        super(app);
        this.providerName = 'fal';
        this.supportsMultipleSpeakers = false; // Most fal models are single speaker
        this.supportedModels = [
            'playai-tts-v3',
            'playai-tts-dialog',
            'orpheus-tts',
            'dia-tts',
            'dia-tts-clone',
            'f5-tts',
            'kokoro-tts',
            'chatterbox-tts'
        ];
        
        // Model configurations
        this.modelConfigs = {
            'playai-tts-v3': {
                endpoint: 'fal-ai/playai/tts/v3',
                supportsVoiceClone: true,
                supportsEmotions: true
            },
            'playai-tts-dialog': {
                endpoint: 'fal-ai/playai/tts/dialog',
                supportsDialogue: true,
                supportsEmotions: true
            },
            'orpheus-tts': {
                endpoint: 'fal-ai/orpheus-tts',
                supportsEmotions: true
            },
            'dia-tts': {
                endpoint: 'fal-ai/dia-tts',
                supportsEmotions: true,
                supportsNonverbals: true
            },
            'dia-tts-clone': {
                endpoint: 'fal-ai/dia-tts/voice-clone',
                supportsVoiceClone: true,
                requiresReferenceText: true
            },
            'f5-tts': {
                endpoint: 'fal-ai/f5-tts',
                supportsVoiceClone: true,
                requiresReferenceAudio: true
            },
            'kokoro-tts': {
                endpoint: 'fal-ai/kokoro/american-english',
                variants: {
                    'british': 'fal-ai/kokoro/british-english'
                }
            },
            'chatterbox-tts': {
                endpoint: 'fal-ai/chatterbox/text-to-speech'
            },
            'chatterboxhd-tts': {
                endpoint: 'resemble-ai/chatterboxhd/text-to-speech'
            }
        };
    }

    getApiKey() {
        return this.app.falKey;
    }

    getCurrentModel() {
        return this.modelName || this.app.falModel;
    }

    getModelConfig() {
        return this.modelConfigs[this.getCurrentModel()] || {};
    }

    async generateSingleAudioBlob(text, voiceConfig) {
        if (!this.isConfigured()) {
            return null;
        }
        
        try {
            const modelConfig = this.getModelConfig();
            const endpoint = modelConfig.endpoint;
            
            if (!endpoint) {
                throw new Error(`No endpoint configured for model: ${this.getCurrentModel()}`);
            }

            // Build request based on model requirements
            const requestData = this.buildRequestData(text, voiceConfig, modelConfig);
            
            // Initial request logging is now handled in generateWithDirectAPI
            
            // Use direct HTTP API only
            return await this.generateWithDirectAPI(endpoint, requestData);
            
        } catch (error) {
            console.error(`Fal.ai audio generation error:`, error);
            this.logDebug('error', { 
                error: error.message,
                stack: error.stack,
                model: this.getCurrentModel(),
                provider: this.providerName 
            });
            return null;
        }
    }

    async generateWithDirectAPI(endpoint, requestData) {
        const url = `https://fal.run/${endpoint}`;
        const headers = {
            'Authorization': `Key ${this.getApiKey()}`,
            'Content-Type': 'application/json'
        };
        
        // Log detailed request information
        this.logDebug('request', {
            url: url,
            method: 'POST',
            headers: {
                'Authorization': 'Key [REDACTED]',
                'Content-Type': headers['Content-Type']
            },
            body: requestData,
            endpoint: endpoint,
            model: this.getCurrentModel(),
            provider: this.providerName
        });
        
        // Submit request using direct HTTP API
        const requestStartTime = Date.now();
        const submitResponse = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData)
        });

        // Get response text for better error debugging
        const responseText = await submitResponse.text();
        const requestDuration = Date.now() - requestStartTime;
        
        // Log detailed response information
        const responseInfo = {
            url: url,
            status: submitResponse.status,
            statusText: submitResponse.statusText,
            headers: Object.fromEntries(submitResponse.headers.entries()),
            duration: requestDuration,
            responseSize: responseText.length,
            endpoint: endpoint,
            model: this.getCurrentModel(),
            provider: this.providerName
        };

        if (!submitResponse.ok) {
            let errorDetails;
            try {
                errorDetails = JSON.parse(responseText);
            } catch (e) {
                errorDetails = { raw_response: responseText };
            }
            
            this.logDebug('response', {
                ...responseInfo,
                success: false,
                error: errorDetails
            });
            
            let errorMessage = `Failed to submit request: ${submitResponse.status} ${submitResponse.statusText}`;
            if (errorDetails.detail) {
                errorMessage += ` - ${JSON.stringify(errorDetails.detail)}`;
            } else if (errorDetails.raw_response) {
                errorMessage += ` - ${errorDetails.raw_response}`;
            }
            throw new Error(errorMessage);
        }

        let submitResult;
        try {
            submitResult = JSON.parse(responseText);
        } catch (e) {
            this.logDebug('response', {
                ...responseInfo,
                success: false,
                error: { message: 'Invalid JSON response', raw_response: responseText }
            });
            throw new Error(`Invalid JSON response: ${responseText}`);
        }
        
        this.logDebug('response', {
            ...responseInfo,
            success: true,
            data: submitResult
        });

        // If result is already available (sync response)
        if (submitResult.audio_url?.url || submitResult.audio?.url) {
            const audioUrl = submitResult.audio_url?.url || submitResult.audio?.url;
            
            // Log audio fetch request
            this.logDebug('request', {
                url: audioUrl,
                method: 'GET',
                headers: {},
                type: 'audio_download',
                model: this.getCurrentModel(),
                provider: this.providerName
            });
            
            const audioStartTime = Date.now();
            const response = await fetch(audioUrl);
            const audioDuration = Date.now() - audioStartTime;
            
            if (!response.ok) {
                this.logDebug('response', {
                    url: audioUrl,
                    status: response.status,
                    statusText: response.statusText,
                    duration: audioDuration,
                    success: false,
                    type: 'audio_download',
                    model: this.getCurrentModel(),
                    provider: this.providerName,
                    error: { message: `Failed to fetch audio: ${response.status} ${response.statusText}` }
                });
                throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
            }
            
            const audioBlob = await response.blob();
            
            this.logDebug('response', {
                url: audioUrl,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                duration: audioDuration,
                success: true,
                type: 'audio_download',
                audioSize: audioBlob.size,
                audioType: audioBlob.type,
                model: this.getCurrentModel(),
                provider: this.providerName
            });
            
            return audioBlob;
        }

        // Handle async response with request ID
        const requestId = submitResult.request_id;
        if (!requestId) {
            const error = { message: 'No request ID returned from fal.ai', response: submitResult };
            this.logDebug('response', {
                ...responseInfo,
                success: false,
                error: error
            });
            throw new Error('No request ID returned from fal.ai');
        }

        // Poll for result
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        const pollInterval = 5000; // 5 seconds
        const statusUrl = `https://fal.run/${endpoint}/requests/${requestId}/status`;
        const resultUrl = `https://fal.run/${endpoint}/requests/${requestId}`;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            // Log status check request
            this.logDebug('request', {
                url: statusUrl,
                method: 'GET',
                headers: { 'Authorization': 'Key [REDACTED]' },
                type: 'status_check',
                attempt: attempts,
                requestId: requestId,
                model: this.getCurrentModel(),
                provider: this.providerName
            });

            const statusStartTime = Date.now();
            const statusResponse = await fetch(statusUrl, {
                headers: {
                    'Authorization': `Key ${this.getApiKey()}`
                }
            });
            const statusDuration = Date.now() - statusStartTime;

            if (!statusResponse.ok) {
                this.logDebug('response', {
                    url: statusUrl,
                    status: statusResponse.status,
                    statusText: statusResponse.statusText,
                    duration: statusDuration,
                    success: false,
                    type: 'status_check',
                    attempt: attempts,
                    requestId: requestId,
                    model: this.getCurrentModel(),
                    provider: this.providerName,
                    error: { message: `Failed to check status: ${statusResponse.status}` }
                });
                throw new Error(`Failed to check status: ${statusResponse.status}`);
            }

            const statusResult = await statusResponse.json();
            
            this.logDebug('response', {
                url: statusUrl,
                status: statusResponse.status,
                statusText: statusResponse.statusText,
                duration: statusDuration,
                success: true,
                type: 'status_check',
                attempt: attempts,
                requestId: requestId,
                data: statusResult,
                model: this.getCurrentModel(),
                provider: this.providerName
            });

            if (statusResult.status === 'COMPLETED') {
                // Log result fetch request
                this.logDebug('request', {
                    url: resultUrl,
                    method: 'GET',
                    headers: { 'Authorization': 'Key [REDACTED]' },
                    type: 'result_fetch',
                    requestId: requestId,
                    model: this.getCurrentModel(),
                    provider: this.providerName
                });

                const resultStartTime = Date.now();
                const resultResponse = await fetch(resultUrl, {
                    headers: {
                        'Authorization': `Key ${this.getApiKey()}`
                    }
                });
                const resultDuration = Date.now() - resultStartTime;

                if (!resultResponse.ok) {
                    this.logDebug('response', {
                        url: resultUrl,
                        status: resultResponse.status,
                        statusText: resultResponse.statusText,
                        duration: resultDuration,
                        success: false,
                        type: 'result_fetch',
                        requestId: requestId,
                        model: this.getCurrentModel(),
                        provider: this.providerName,
                        error: { message: `Failed to fetch result: ${resultResponse.status}` }
                    });
                    throw new Error(`Failed to fetch result: ${resultResponse.status}`);
                }

                const finalResult = await resultResponse.json();
                
                this.logDebug('response', {
                    url: resultUrl,
                    status: resultResponse.status,
                    statusText: resultResponse.statusText,
                    duration: resultDuration,
                    success: true,
                    type: 'result_fetch',
                    requestId: requestId,
                    data: finalResult,
                    model: this.getCurrentModel(),
                    provider: this.providerName
                });

                const audioUrl = finalResult.audio_url?.url || finalResult.audio?.url;

                if (!audioUrl) {
                    const error = { message: 'No audio URL in final result', result: finalResult };
                    this.logDebug('response', {
                        url: resultUrl,
                        success: false,
                        type: 'result_error',
                        requestId: requestId,
                        error: error,
                        model: this.getCurrentModel(),
                        provider: this.providerName
                    });
                    throw new Error('No audio URL in final result');
                }

                // Log audio fetch request for async result
                this.logDebug('request', {
                    url: audioUrl,
                    method: 'GET',
                    headers: {},
                    type: 'audio_download',
                    requestId: requestId,
                    model: this.getCurrentModel(),
                    provider: this.providerName
                });

                const audioStartTime = Date.now();
                const response = await fetch(audioUrl);
                const audioDuration = Date.now() - audioStartTime;

                if (!response.ok) {
                    this.logDebug('response', {
                        url: audioUrl,
                        status: response.status,
                        statusText: response.statusText,
                        duration: audioDuration,
                        success: false,
                        type: 'audio_download',
                        requestId: requestId,
                        model: this.getCurrentModel(),
                        provider: this.providerName,
                        error: { message: `Failed to fetch audio: ${response.status}` }
                    });
                    throw new Error(`Failed to fetch audio: ${response.status}`);
                }

                const audioBlob = await response.blob();
                
                this.logDebug('response', {
                    url: audioUrl,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    duration: audioDuration,
                    success: true,
                    type: 'audio_download',
                    requestId: requestId,
                    audioSize: audioBlob.size,
                    audioType: audioBlob.type,
                    model: this.getCurrentModel(),
                    provider: this.providerName
                });

                return audioBlob;
                
            } else if (statusResult.status === 'FAILED') {
                const error = { message: 'Request failed on fal.ai server', statusResult: statusResult };
                this.logDebug('response', {
                    url: statusUrl,
                    success: false,
                    type: 'request_failed',
                    attempt: attempts,
                    requestId: requestId,
                    error: error,
                    model: this.getCurrentModel(),
                    provider: this.providerName
                });
                throw new Error('Request failed on fal.ai server');
            }
            // Continue polling for IN_PROGRESS or other statuses
        }

        const error = { message: 'Request timed out waiting for completion', maxAttempts: maxAttempts, requestId: requestId };
        this.logDebug('response', {
            success: false,
            type: 'timeout',
            requestId: requestId,
            error: error,
            model: this.getCurrentModel(),
            provider: this.providerName
        });
        throw new Error('Request timed out waiting for completion');
    }

    buildRequestData(text, voiceConfig, modelConfig) {
        const model = this.getCurrentModel();
        
        // Base request - the direct API expects input to be the top-level object
        let request = {
            text: text
        };
        
        // Model-specific configurations
        switch (model) {
            case 'f5-tts':
                request.gen_text = text;
                request.model_type = 'F5-TTS';
                request.remove_silence = true;
                if (voiceConfig?.referenceAudio) {
                    request.ref_audio_url = voiceConfig.referenceAudio;
                    request.ref_text = voiceConfig.referenceText || '';
                }
                break;
                
            case 'dia-tts-clone':
                if (voiceConfig?.referenceAudio) {
                    request.reference_audio_url = voiceConfig.referenceAudio;
                    request.reference_text = voiceConfig.referenceText || text;
                }
                break;
                
            case 'playai-tts-v3':
            case 'playai-tts-dialog':
                if (voiceConfig?.voice) {
                    request.voice = voiceConfig.voice;
                }
                if (voiceConfig?.emotion) {
                    request.emotion = voiceConfig.emotion;
                }
                break;
                
            default:
                // Standard text field for most models
                break;
        }
        
        return request;
    }

    // Override to handle special dialogue models
    async generateDialogueAudio(dialogue) {
        const model = this.getCurrentModel();
        
        // Check if model supports native dialogue
        if (model === 'playai-tts-dialog') {
            return this.generateDialogueWithPlayAI(dialogue);
        }
        
        // Fall back to individual generation
        return this.generateIndividualAudios(dialogue);
    }

    async generateDialogueWithPlayAI(dialogue) {
        try {
            // Format dialogue for PlayAI Dialog API
            const dialogueText = dialogue.map(msg => `${msg.speaker}: ${msg.text}`).join('\n');
            const requestData = {
                text: dialogueText,
                voice: this.app.falVoice || 'default'
            };
            
            // Use direct API for PlayAI
            const audioBlob = await this.generateWithDirectAPI('fal-ai/playai/tts/dialog', requestData);
            if (audioBlob) {
                const conversationUrl = URL.createObjectURL(audioBlob);
                return { 
                    individualAudioUrls: new Array(dialogue.length).fill(null), 
                    conversationAudioUrl: conversationUrl 
                };
            }
            
            throw new Error('No audio generated from PlayAI');
        } catch (error) {
            console.error('PlayAI Dialog error:', error);
            return this.generateIndividualAudios(dialogue);
        }
    }
}

// Individual Fal.ai model providers
export class OrpheusTTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'orpheus-tts';
        this.modelName = 'orpheus-tts';
    }
}

export class PlayAITTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'playai-tts-v3';
        this.modelName = 'playai-tts-v3';
    }
}

export class PlayAIDialogProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'playai-tts-dialog';
        this.modelName = 'playai-tts-dialog';
        this.supportsDialogueMode = true;
    }
}

export class DiaTTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'dia-tts';
        this.modelName = 'dia-tts';
    }
}

export class DiaTTSCloneProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'dia-tts-clone';
        this.modelName = 'dia-tts-clone';
    }
}

export class F5TTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'f5-tts';
        this.modelName = 'f5-tts';
    }
}

export class KokoroTTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'kokoro-tts';
        this.modelName = 'kokoro-tts';
    }
}

export class ChatterboxTTSProvider extends FalProvider {
    constructor(app) {
        super(app);
        this.providerName = 'chatterbox-tts';
        this.modelName = 'chatterbox-tts';
    }
}

// TTS Provider Registry
export class TTSProviderRegistry {
    constructor() {
        this.providers = new Map();
    }

    registerProvider(name, providerClass) {
        this.providers.set(name, providerClass);
    }

    getProvider(name, app) {
        const ProviderClass = this.providers.get(name);
        if (!ProviderClass) {
            throw new Error(`Unknown TTS provider: ${name}`);
        }
        return new ProviderClass(app);
    }

    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
}

// Create and export the registry
export const ttsProviderRegistry = new TTSProviderRegistry();

// Register all providers
ttsProviderRegistry.registerProvider('elevenlabs', ElevenLabsProvider);
ttsProviderRegistry.registerProvider('gemini', GeminiProvider);
ttsProviderRegistry.registerProvider('orpheus-tts', OrpheusTTSProvider);
ttsProviderRegistry.registerProvider('playai-tts-v3', PlayAITTSProvider);
ttsProviderRegistry.registerProvider('playai-tts-dialog', PlayAIDialogProvider);
ttsProviderRegistry.registerProvider('dia-tts', DiaTTSProvider);
ttsProviderRegistry.registerProvider('dia-tts-clone', DiaTTSCloneProvider);
ttsProviderRegistry.registerProvider('f5-tts', F5TTSProvider);
ttsProviderRegistry.registerProvider('kokoro-tts', KokoroTTSProvider);
ttsProviderRegistry.registerProvider('chatterbox-tts', ChatterboxTTSProvider);

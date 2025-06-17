// Audio management functionality for ElevenLabs voice synthesis
export class AudioManager {
    constructor(app) {
        this.app = app;
        this.currentAudio = null;
        this.currentlyPlayingMessageIndex = null;
    }

    // Generate audio for a single message using ElevenLabs API
    async generateSingleAudio(text, voiceId) {
        if (!this.app.elevenlabsKey || !voiceId) {
            return null;
        }
        
        try {
            const requestData = {
                text: text,
                model_id: this.app.elevenlabsModel,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            };
            
            if (this.app.debugEnabled) {
                this.app.logDebug('request', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    request: requestData 
                });
            }
            
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.app.elevenlabsKey
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
            }
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            if (this.app.debugEnabled) {
                this.app.logDebug('response', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    response: { 
                        status: response.status,
                        size: audioBlob.size,
                        type: audioBlob.type 
                    } 
                });
            }
            
            return audioUrl;
        } catch (error) {
            console.error(`Audio generation error for voice ${voiceId}:`, error);
            if (this.app.debugEnabled) {
                this.app.logDebug('error', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    error: error.message 
                });
            }
            return null;
        }
    }

    // Generate audio for multiple dialogue messages 
    async generateDialogueAudio(dialogue) {
        if (!this.app.elevenlabsKey || !dialogue || !Array.isArray(dialogue)) {
            return null;
        }

        // Check if using dialogue API mode
        if (this.app.elevenlabsApiMode === 'dialogue') {
            return await this.generateDialogueWithDialogueAPI(dialogue);
        } else {
            // Use traditional text-to-speech API and concatenate
            return await this.generateDialogueWithTTSAPI(dialogue);
        }
    }

    // Generate dialogue using ElevenLabs Dialogue API (single call)
    async generateDialogueWithDialogueAPI(dialogue) {
        if (!this.app.elevenlabsKey || !dialogue || !Array.isArray(dialogue)) {
            return null;
        }

        try {
            // Build inputs array for dialogue API
            const inputs = dialogue.map(msg => {
                const voiceId = this.app.currentPersona.voices[msg.speaker];
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return null;
                }
                
                return {
                    text: msg.text,
                    voice_id: voiceId
                };
            }).filter(input => input !== null);

            if (inputs.length === 0) {
                console.warn('No valid inputs for dialogue API');
                return null;
            }

            const requestData = {
                inputs: inputs,
                model_id: this.app.elevenlabsModel,
                settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            };

            if (this.app.debugEnabled) {
                this.app.logDebug('request', 'elevenlabs-dialogue', this.app.elevenlabsModel, { 
                    request: requestData 
                });
            }

            const response = await fetch('https://api.elevenlabs.io/v1/text-to-dialogue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.app.elevenlabsKey
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`ElevenLabs Dialogue API error: ${response.status} - ${error}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            if (this.app.debugEnabled) {
                this.app.logDebug('response', 'elevenlabs-dialogue', this.app.elevenlabsModel, { 
                    response: { 
                        status: response.status,
                        size: audioBlob.size,
                        type: audioBlob.type,
                        inputCount: inputs.length
                    } 
                });
            }

            return audioUrl;
        } catch (error) {
            console.error('Dialogue API generation error:', error);
            if (this.app.debugEnabled) {
                this.app.logDebug('error', 'elevenlabs-dialogue', this.app.elevenlabsModel, { 
                    error: error.message 
                });
            }
            return null;
        }
    }

    // Generate dialogue using traditional TTS API and concatenate (original method)
    async generateDialogueWithTTSAPI(dialogue) {
        if (!this.app.elevenlabsKey || !dialogue || !Array.isArray(dialogue)) {
            return null;
        }

        const audioBlobs = [];
        const maxConcurrent = 5;

        // Process dialogue in chunks of max 5 concurrent requests
        for (let i = 0; i < dialogue.length; i += maxConcurrent) {
            const chunk = dialogue.slice(i, i + maxConcurrent);
            const chunkPromises = chunk.map(async (msg, chunkIndex) => {
                const actualIndex = i + chunkIndex;
                const voiceId = this.app.currentPersona.voices[msg.speaker];
                
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return { index: actualIndex, audioBlob: null };
                }
                
                const audioBlob = await this.generateSingleAudioBlob(msg.text, voiceId);
                return { index: actualIndex, audioBlob };
            });

            // Wait for this chunk to complete before starting the next
            const chunkResults = await Promise.all(chunkPromises);
            
            // Store results in the correct positions
            chunkResults.forEach(result => {
                audioBlobs[result.index] = result.audioBlob;
            });

            // Optional: Add a small delay between chunks to be extra gentle on the API
            if (i + maxConcurrent < dialogue.length) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
        }

        // Filter out null blobs and concatenate
        const validBlobs = audioBlobs.filter(blob => blob !== null);
        if (validBlobs.length === 0) {
            return null;
        }

        // Concatenate audio blobs
        const concatenatedBlob = await this.concatenateAudioBlobs(validBlobs);
        return URL.createObjectURL(concatenatedBlob);
    }

    // Generate both individual audio URLs and concatenated conversation audio
    async generateDialogueAudioWithIndividual(dialogue) {
        if (!this.app.elevenlabsKey || !dialogue || !Array.isArray(dialogue)) {
            return { individualAudioUrls: [], conversationAudioUrl: null };
        }

        // Check API mode to determine approach
        if (this.app.elevenlabsApiMode === 'dialogue') {
            // Dialogue API mode: Generate single conversation audio, no individual audio
            const conversationAudioUrl = await this.generateDialogueWithDialogueAPI(dialogue);
            // Return empty individual URLs since dialogue API generates single audio
            const individualAudioUrls = new Array(dialogue.length).fill(null);
            return { individualAudioUrls, conversationAudioUrl };
        } else {
            // TTS API mode: Generate individual audio for each message
            return await this.generateDialogueAudioWithIndividualTTS(dialogue);
        }
    }

    // Generate individual audio URLs using TTS API (original method)
    async generateDialogueAudioWithIndividualTTS(dialogue) {
        const audioBlobs = [];
        const individualAudioUrls = [];
        const maxConcurrent = 5;

        // Process dialogue in chunks of max 5 concurrent requests
        for (let i = 0; i < dialogue.length; i += maxConcurrent) {
            const chunk = dialogue.slice(i, i + maxConcurrent);
            const chunkPromises = chunk.map(async (msg, chunkIndex) => {
                const actualIndex = i + chunkIndex;
                const voiceId = this.app.currentPersona.voices[msg.speaker];
                
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return { index: actualIndex, audioBlob: null, audioUrl: null };
                }
                
                const audioBlob = await this.generateSingleAudioBlob(msg.text, voiceId);
                const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
                return { index: actualIndex, audioBlob, audioUrl };
            });

            // Wait for this chunk to complete before starting the next
            const chunkResults = await Promise.all(chunkPromises);
            
            // Store results in the correct positions
            chunkResults.forEach(result => {
                audioBlobs[result.index] = result.audioBlob;
                individualAudioUrls[result.index] = result.audioUrl;
            });

            // Optional: Add a small delay between chunks to be extra gentle on the API
            if (i + maxConcurrent < dialogue.length) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
        }

        // Filter out null blobs and concatenate for conversation audio
        const validBlobs = audioBlobs.filter(blob => blob !== null);
        let conversationAudioUrl = null;
        
        if (validBlobs.length > 0) {
            const concatenatedBlob = await this.concatenateAudioBlobs(validBlobs);
            conversationAudioUrl = URL.createObjectURL(concatenatedBlob);
        }

        return { individualAudioUrls, conversationAudioUrl };
    }

    // Generate audio blob for a single message using ElevenLabs API
    async generateSingleAudioBlob(text, voiceId) {
        if (!this.app.elevenlabsKey || !voiceId) {
            return null;
        }
        
        try {
            const requestData = {
                text: text,
                model_id: this.app.elevenlabsModel,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            };
            
            if (this.app.debugEnabled) {
                this.app.logDebug('request', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    request: requestData 
                });
            }
            
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.app.elevenlabsKey
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
            }
            
            const audioBlob = await response.blob();
            
            if (this.app.debugEnabled) {
                this.app.logDebug('response', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    response: { 
                        status: response.status,
                        size: audioBlob.size,
                        type: audioBlob.type 
                    } 
                });
            }
            
            return audioBlob;
        } catch (error) {
            console.error(`Audio generation error for voice ${voiceId}:`, error);
            if (this.app.debugEnabled) {
                this.app.logDebug('error', 'elevenlabs', this.app.elevenlabsModel, { 
                    voice_id: voiceId,
                    error: error.message 
                });
            }
            return null;
        }
    }

    // Concatenate multiple audio blobs into a single audio file
    async concatenateAudioBlobs(audioBlobs) {
        if (!audioBlobs || audioBlobs.length === 0) {
            return null;
        }

        if (audioBlobs.length === 1) {
            return audioBlobs[0];
        }

        try {
            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffers = [];

            // Decode all audio blobs to AudioBuffers
            for (const blob of audioBlobs) {
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBuffers.push(audioBuffer);
            }

            // Calculate total length and sample rate
            const sampleRate = audioBuffers[0].sampleRate;
            const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
            const numberOfChannels = audioBuffers[0].numberOfChannels;

            // Create a new buffer for the concatenated audio
            const concatenatedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

            // Copy all audio data into the new buffer
            let offset = 0;
            for (const buffer of audioBuffers) {
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const sourceData = buffer.getChannelData(channel);
                    concatenatedBuffer.getChannelData(channel).set(sourceData, offset);
                }
                offset += buffer.length;
            }

            // Convert the AudioBuffer back to a blob
            const concatenatedBlob = await this.audioBufferToBlob(concatenatedBuffer);
            
            // Close the audio context to free up resources
            await audioContext.close();
            
            return concatenatedBlob;
        } catch (error) {
            console.error('Error concatenating audio blobs:', error);
            // Fallback: return the first blob if concatenation fails
            return audioBlobs[0];
        }
    }

    // Convert AudioBuffer to Blob
    async audioBufferToBlob(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        
        // Create WAV header
        const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);
        
        // Convert audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    // Play audio from URL with playback control
    playAudio(audioUrl, messageIndex) {
        if (!audioUrl) {
            console.warn('No audio URL provided');
            return;
        }

        // If this message is currently playing, stop it
        if (this.currentlyPlayingMessageIndex === messageIndex && this.currentAudio) {
            this.stopAudio();
            return;
        }

        // Stop any existing audio
        this.stopAudio();
        
        try {
            this.currentAudio = new Audio(audioUrl);
            this.currentlyPlayingMessageIndex = messageIndex;
            
            // Update UI state
            this.app.currentlyPlayingMessageIndex = messageIndex;
            
            // Set up event listeners
            this.currentAudio.addEventListener('ended', () => {
                this.stopAudio();
            });
            
            this.currentAudio.addEventListener('error', (error) => {
                console.error('Error playing audio:', error);
                this.stopAudio();
            });
            
            this.currentAudio.play().catch(error => {
                console.error('Error playing audio:', error);
                this.stopAudio();
            });
        } catch (error) {
            console.error('Error creating audio element:', error);
            this.stopAudio();
        }
    }

    // Play audio from either URL (ElevenLabs) or base64 data (Gemini native)
    playMessageAudio(message, messageIndex) {
        // If this message is currently playing, stop it
        if (this.currentlyPlayingMessageIndex === messageIndex && this.currentAudio) {
            this.stopAudio();
            return;
        }

        // Stop any existing audio
        this.stopAudio();

        try {
            let audioSrc;

            if (message.audioUrl) {
                // ElevenLabs audio URL
                audioSrc = message.audioUrl;
            } else if (message.audioData && message.audioMimeType) {
                // Gemini native audio data (base64)
                const audioBlob = this.base64ToBlob(message.audioData, message.audioMimeType);
                audioSrc = URL.createObjectURL(audioBlob);
            } else {
                console.warn('No audio data available for message');
                return;
            }

            this.currentAudio = new Audio(audioSrc);
            this.currentlyPlayingMessageIndex = messageIndex;
            
            // Update UI state
            this.app.currentlyPlayingMessageIndex = messageIndex;
            
            // Set up event listeners
            this.currentAudio.addEventListener('ended', () => {
                this.stopAudio();
                // Clean up object URL if we created one for Gemini audio
                if (message.audioData && audioSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(audioSrc);
                }
            });
            
            this.currentAudio.addEventListener('error', (error) => {
                console.error('Error playing audio:', error);
                this.stopAudio();
                // Clean up object URL if we created one for Gemini audio
                if (message.audioData && audioSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(audioSrc);
                }
            });
            
            this.currentAudio.play().catch(error => {
                console.error('Error playing audio:', error);
                this.stopAudio();
                // Clean up object URL if we created one for Gemini audio
                if (message.audioData && audioSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(audioSrc);
                }
            });
        } catch (error) {
            console.error('Error creating audio element:', error);
            this.stopAudio();
        }
    }

    // Convert base64 string to Blob
    base64ToBlob(base64Data, mimeType) {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    // Stop current audio playback
    stopAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        
        this.currentlyPlayingMessageIndex = null;
        this.app.currentlyPlayingMessageIndex = null;
    }

    // Check if a specific message is currently playing
    isPlaying(messageIndex) {
        return this.currentlyPlayingMessageIndex === messageIndex;
    }

    // Play conversation audio (for concatenated ElevenLabs or Gemini audio)
    playConversationAudio(conversationAudioUrl) {
        if (!conversationAudioUrl) {
            console.warn('No conversation audio URL provided');
            return;
        }

        // If conversation is currently playing, stop it
        if (this.currentlyPlayingMessageIndex === 'conversation' && this.currentAudio) {
            this.stopAudio();
            return;
        }

        // Stop any existing audio
        this.stopAudio();
        
        try {
            this.currentAudio = new Audio(conversationAudioUrl);
            this.currentlyPlayingMessageIndex = 'conversation';
            
            // Update UI state
            this.app.currentlyPlayingMessageIndex = 'conversation';
            
            // Set up event listeners
            this.currentAudio.addEventListener('ended', () => {
                this.stopAudio();
            });
            
            this.currentAudio.addEventListener('error', (error) => {
                console.error('Error playing conversation audio:', error);
                this.stopAudio();
            });
            
            this.currentAudio.play().catch(error => {
                console.error('Error playing conversation audio:', error);
                this.stopAudio();
            });
        } catch (error) {
            console.error('Error creating conversation audio element:', error);
            this.stopAudio();
        }
    }

    // Check if conversation is currently playing
    isConversationPlaying() {
        return this.currentlyPlayingMessageIndex === 'conversation';
    }

    // Play Gemini conversation audio (single audio file containing full dialogue)
    playGeminiConversationAudio(conversationId = null) {
        let message;
        if (conversationId) {
            message = this.app.messages.find(m => m.audioData && m.conversationId === conversationId);
        } else {
            // Fallback: find the most recent conversation with audio
            message = this.app.messages.slice().reverse().find(m => m.audioData);
        }
        
        if (message && message.audioData && message.audioMimeType) {
            const audioBlob = this.base64ToBlob(message.audioData, message.audioMimeType);
            const audioUrl = URL.createObjectURL(audioBlob);
            this.playConversationAudio(audioUrl);
        }
    }

    // Generate Gemini audio for dialogue with multi-speaker support
    async generateGeminiAudioForDialogue(dialogue) {
        if (!dialogue || dialogue.length === 0) return;
        
        // Get speaker voices from current persona's gemini_voices mapping
        const geminiVoices = this.app.currentPersona.gemini_voices || {};
        const speakerNames = [...new Set(dialogue.map(msg => msg.speaker))];
        
        // Build multi-speaker prompt with voice instructions
        let fullContext = "You are generating speech for a multi-character dialogue. ";
        
        // Add speaker voice descriptions if available
        if (Object.keys(geminiVoices).length > 0) {
            fullContext += "Voice assignments:\n";
            speakerNames.forEach(speaker => {
                const voiceName = geminiVoices[speaker] || 'Kore';
                fullContext += `- ${speaker}: Use ${voiceName} voice characteristics\n`;
            });
            fullContext += "\n";
        }
        
        fullContext += "Generate natural speech for the following dialogue with distinct voices for each speaker:\n\n";
        
        // Format dialogue with clear speaker transitions
        dialogue.forEach((msg, index) => {
            fullContext += `${msg.speaker}: ${msg.text}\n`;
        });
        
        // Determine primary voice (first speaker or fallback)
        const primarySpeaker = dialogue[0]?.speaker;
        const primaryVoice = geminiVoices[primarySpeaker] || this.app.geminiVoice || 'Kore';
        
        // Build speaker voice configs for multi-speaker config
        const speakerVoiceConfigs = speakerNames.map(speaker => ({
            speaker: speaker,
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName: geminiVoices[speaker] || 'Kore'
                }
            }
        }));

        // Log voice selection for debugging
        if (this.app.debugEnabled) {
            console.log('Gemini multi-speaker setup:', {
                dialogue: dialogue.map(msg => ({ speaker: msg.speaker, text: msg.text.substring(0, 50) + '...' })),
                speakerNames,
                geminiVoices,
                speakerVoiceConfigs,
                multiSpeakerEnabled: speakerNames.length > 1,
                currentPersona: this.app.currentPersona?.name
            });
        }
        
        const requestBody = {
            model: this.app.geminiTTSModel,
            contents: [{
                parts: [{ text: fullContext }]
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
                speechConfig: speakerNames.length > 1 ? {
                    // Multi-speaker configuration using correct API structure
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: speakerVoiceConfigs
                    }
                } : {
                    // Single speaker configuration
                    voiceConfig: {
                        prebuiltVoiceConfig: { 
                            voiceName: primaryVoice
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
} 
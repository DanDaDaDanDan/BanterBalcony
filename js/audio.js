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

    // Generate audio for multiple dialogue messages and concatenate into single audio
    async generateDialogueAudio(dialogue) {
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
} 
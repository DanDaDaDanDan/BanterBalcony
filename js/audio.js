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

    // Generate audio for multiple dialogue messages (max 5 concurrent API calls)
    async generateDialogueAudio(dialogue) {
        if (!this.app.elevenlabsKey || !dialogue || !Array.isArray(dialogue)) {
            return [];
        }

        const audioResults = new Array(dialogue.length).fill(null);
        const maxConcurrent = 5;

        // Process dialogue in chunks of max 5 concurrent requests
        for (let i = 0; i < dialogue.length; i += maxConcurrent) {
            const chunk = dialogue.slice(i, i + maxConcurrent);
            const chunkPromises = chunk.map(async (msg, chunkIndex) => {
                const actualIndex = i + chunkIndex;
                const voiceId = this.app.currentPersona.voices[msg.speaker];
                
                if (!voiceId) {
                    console.warn(`No voice configured for speaker: ${msg.speaker}`);
                    return { index: actualIndex, audioUrl: null };
                }
                
                const audioUrl = await this.generateSingleAudio(msg.text, voiceId);
                return { index: actualIndex, audioUrl };
            });

            // Wait for this chunk to complete before starting the next
            const chunkResults = await Promise.all(chunkPromises);
            
            // Store results in the correct positions
            chunkResults.forEach(result => {
                audioResults[result.index] = result.audioUrl;
            });

            // Optional: Add a small delay between chunks to be extra gentle on the API
            if (i + maxConcurrent < dialogue.length) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
        }

        return audioResults;
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
} 
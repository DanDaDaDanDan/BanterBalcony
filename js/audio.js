// Audio management functionality with unified TTS provider system
import { ttsProviderRegistry } from './tts-providers.js';
import { AudioResourceTracker, ErrorHandler } from '../utils.js';

export class AudioManager {
    constructor(app) {
        this.app = app;
        this.currentAudio = null;
        this.currentlyPlayingMessageIndex = null;
        this.ttsProvider = null;
        this.audioUrls = new Set(); // Track created URLs for cleanup
    }

    // Get current TTS provider instance
    getTTSProvider() {
        const providerName = this.app.ttsProvider || 'elevenlabs';
        if (!this.ttsProvider || this.ttsProvider.providerName !== providerName) {
            this.ttsProvider = ttsProviderRegistry.getProvider(providerName, this.app);
        }
        return this.ttsProvider;
    }

    // Generate audio for dialogue using current TTS provider
    async generateDialogueAudioWithIndividual(dialogue) {
        const provider = this.getTTSProvider();
        
        if (!provider.isConfigured()) {
            console.warn(`TTS provider ${provider.providerName} is not configured`);
            return { individualAudioUrls: [], conversationAudioUrl: null };
        }

        return await provider.generateDialogueAudio(dialogue);
    }

    // Legacy method names for compatibility
    async generateDialogueAudio(dialogue) {
        const result = await this.generateDialogueAudioWithIndividual(dialogue);
        return result.conversationAudioUrl;
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
        } finally {
            // Always close audio context if it was created
            if (audioContext && audioContext.state !== 'closed') {
                try {
                    await audioContext.close();
                } catch (e) {
                    console.error('Error closing audio context:', e);
                }
            }
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
            const message = ErrorHandler.handle(error, 'audio-creation');
            console.error('Error creating audio element:', message);
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
                this.audioUrls.add(audioSrc); // Track for cleanup
            } else {
                console.warn('No audio data available for message');
                return;
            }

            this.currentAudio = new Audio(audioSrc);
            AudioResourceTracker.track(this.currentAudio, audioSrc);
            this.currentlyPlayingMessageIndex = messageIndex;
            
            // Update UI state
            this.app.currentlyPlayingMessageIndex = messageIndex;
            
            // Set up event listeners
            this.currentAudio.addEventListener('ended', () => {
                this.stopAudio();
            });
            
            this.currentAudio.addEventListener('error', (error) => {
                const message = ErrorHandler.handle(error, 'audio-playback');
                console.error('Error playing audio:', message);
                this.stopAudio();
            });
            
            this.currentAudio.play().catch(error => {
                const message = ErrorHandler.handle(error, 'audio-play');
                console.error('Error playing audio:', message);
                this.stopAudio();
            });
        } catch (error) {
            const message = ErrorHandler.handle(error, 'audio-creation');
            console.error('Error creating audio element:', message);
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
            AudioResourceTracker.cleanup(this.currentAudio);
            this.currentAudio = null;
        }
        
        // Clean up any blob URLs we created
        for (const url of this.audioUrls) {
            URL.revokeObjectURL(url);
        }
        this.audioUrls.clear();
        
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
            AudioResourceTracker.track(this.currentAudio, conversationAudioUrl);
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
} 
// Audio management functionality with unified TTS provider system
import { ttsProviderRegistry } from './tts-providers.js';
import { ErrorHandler } from './utils.js';
import { AudioCache } from './audio-cache.js';

export class AudioManager {
    constructor(app) {
        this.app = app;
        this.currentAudio = null;
        this.currentlyPlayingMessageIndex = null;
        this.ttsProvider = null;
        this.audioCache = new AudioCache(10); // Keep last 10 conversations
        
        // Clean up cache on page unload
        window.addEventListener('beforeunload', () => {
            this.audioCache.clear();
        });
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

        let audioContext;
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

        this.stopAudio();
        
        this.currentAudio = new Audio(audioUrl);
        this.currentlyPlayingMessageIndex = messageIndex;
        this.app.currentlyPlayingMessageIndex = messageIndex;
        
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
    }

    // Play audio from either URL (ElevenLabs) or base64 data (Gemini native)
    playMessageAudio(message, messageIndex) {
        // If this message is currently playing, stop it
        if (this.currentlyPlayingMessageIndex === messageIndex && this.currentAudio) {
            this.stopAudio();
            return;
        }

        let audioSrc;
        if (message.audioUrl) {
            audioSrc = message.audioUrl;
        } else if (message.audioData && message.audioMimeType) {
            const audioBlob = this.base64ToBlob(message.audioData, message.audioMimeType);
            audioSrc = URL.createObjectURL(audioBlob);
        } else {
            console.warn('No audio data available for message');
            return;
        }

        this.playAudio(audioSrc, messageIndex);
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
            this.currentAudio = null;
        }
        
        this.currentlyPlayingMessageIndex = null;
        this.app.currentlyPlayingMessageIndex = null;
    }

    // Check if a specific message is currently playing
    isPlaying(messageIndex) {
        return this.currentlyPlayingMessageIndex === messageIndex;
    }

    // Play conversation audio
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

        this.playAudio(conversationAudioUrl, 'conversation');
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

    // Play conversation audio for any provider - concatenates individual message audio
    async playAnyConversationAudio(conversationId) {
        if (!conversationId) {
            console.warn('No conversation ID provided for audio playbook');
            return;
        }

        // If conversation is currently playing, stop it
        if (this.currentlyPlayingMessageIndex === 'conversation' && this.currentAudio) {
            this.stopAudio();
            return;
        }

        // Check cache first
        let audioUrl = this.audioCache.get(conversationId);
        
        if (!audioUrl) {
            // Create concatenated audio
            audioUrl = await this.createConcatenatedAudio(conversationId);
            if (audioUrl) {
                this.audioCache.set(conversationId, audioUrl);
            }
        }

        if (audioUrl) {
            this.playConversationAudio(audioUrl);
        }
    }

    // Create concatenated audio for a conversation
    async createConcatenatedAudio(conversationId) {
        // Get all messages for this conversation
        const conversationMessages = this.app.messages
            .filter(m => m.conversationId === conversationId)
            .sort((a, b) => a.timestamp - b.timestamp);

        const messagesWithAudio = conversationMessages.filter(m => 
            m.audioUrl || (m.audioData && m.audioMimeType)
        );

        if (messagesWithAudio.length === 0) {
            console.warn('No audio available for conversation:', conversationId);
            return null;
        }

        try {
            return await this.concatenateMessageAudio(messagesWithAudio);
        } catch (error) {
            console.error('Error concatenating conversation audio:', error);
            return null;
        }
    }

    // Get or create concatenated audio for a conversation (for backward compatibility)
    async getOrCreateConcatenatedAudio(conversationId) {
        let audioUrl = this.audioCache.get(conversationId);
        
        if (!audioUrl) {
            audioUrl = await this.createConcatenatedAudio(conversationId);
            if (audioUrl) {
                this.audioCache.set(conversationId, audioUrl);
            }
        }

        return audioUrl;
    }

    // Concatenate audio from multiple messages into a single audio file
    async concatenateMessageAudio(messages) {
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Web Audio API not supported');
            return null;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffers = [];

        // Load all audio files
        for (const message of messages) {
            try {
                let audioBuffer;
                
                if (message.audioUrl) {
                    // Fetch from URL
                    const response = await fetch(message.audioUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                } else if (message.audioData && message.audioMimeType) {
                    // Decode from base64
                    const audioBlob = this.base64ToBlob(message.audioData, message.audioMimeType);
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                }

                if (audioBuffer) {
                    audioBuffers.push(audioBuffer);
                }
            } catch (error) {
                console.warn('Failed to load audio for message:', message, error);
                // Continue with other messages
            }
        }

        if (audioBuffers.length === 0) {
            console.warn('No audio buffers loaded');
            return null;
        }

        // Calculate total length
        const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
        const numberOfChannels = Math.max(...audioBuffers.map(buffer => buffer.numberOfChannels));
        const sampleRate = audioBuffers[0].sampleRate;

        // Create concatenated buffer
        const concatenatedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

        // Copy all audio data
        let offset = 0;
        for (const buffer of audioBuffers) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const channelData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
                concatenatedBuffer.getChannelData(channel).set(channelData, offset);
            }
            offset += buffer.length;
        }

        // Convert to WAV blob
        const wavBlob = this.audioBufferToWav(concatenatedBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        // Clean up AudioContext
        audioContext.close();
        
        return audioUrl;
    }

    // Convert AudioBuffer to WAV blob
    audioBufferToWav(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bytesPerSample = 2; // 16-bit
        const blockAlign = numberOfChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;

        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Convert audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
} 
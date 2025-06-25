// Voice Profiles Management System
// Handles voice profiles with characteristics and mappings to specific TTS providers

export class VoiceProfile {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'New Voice';
        this.description = data.description || '';
        
        // Voice characteristics
        this.characteristics = {
            gender: data.characteristics?.gender || 'neutral', // male, female, neutral, other
            age: data.characteristics?.age || 'adult', // child, teen, young-adult, adult, senior
            emotion: data.characteristics?.emotion || 'neutral', // neutral, cheerful, serious, dramatic, etc.
            tone: data.characteristics?.tone || 'conversational', // conversational, professional, casual, formal
            energy: data.characteristics?.energy || 'medium', // low, medium, high
            pitch: data.characteristics?.pitch || 'medium', // low, medium, high
            speed: data.characteristics?.speed || 'medium', // slow, medium, fast
            accent: data.characteristics?.accent || 'neutral', // neutral, british, american, etc.
            ...data.characteristics
        };
        
        // Provider mappings - maps provider name to voice configuration
        this.providerMappings = data.providerMappings || {};
        
        // Additional metadata
        this.tags = data.tags || [];
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
    }
    
    generateId() {
        return 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Get voice configuration for a specific provider
    getProviderConfig(providerName) {
        return this.providerMappings[providerName] || null;
    }
    
    // Set voice configuration for a specific provider
    setProviderConfig(providerName, config) {
        this.providerMappings[providerName] = config;
        this.updatedAt = Date.now();
    }
    
    // Check if this profile has a mapping for a provider
    hasProvider(providerName) {
        return !!this.providerMappings[providerName];
    }
    
    // Export to JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            characteristics: this.characteristics,
            providerMappings: this.providerMappings,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export class VoiceProfileManager {
    constructor(app) {
        this.app = app;
        this.profiles = new Map();
        this.templateMappings = new Map(); // Maps template:speaker to voice profile ID
        this.loadProfiles();
    }
    
    // Load profiles from localStorage
    loadProfiles() {
        try {
            const savedProfiles = localStorage.getItem('voice_profiles');
            if (savedProfiles) {
                const profilesData = JSON.parse(savedProfiles);
                profilesData.forEach(data => {
                    const profile = new VoiceProfile(data);
                    this.profiles.set(profile.id, profile);
                });
            }
            
            const savedMappings = localStorage.getItem('voice_template_mappings');
            if (savedMappings) {
                const mappingsData = JSON.parse(savedMappings);
                Object.entries(mappingsData).forEach(([key, profileId]) => {
                    this.templateMappings.set(key, profileId);
                });
            }
        } catch (error) {
            console.error('Error loading voice profiles:', error);
        }
        
        // Ensure default profiles exist
        this.ensureDefaultProfiles();
    }
    
    // Save profiles to localStorage
    saveProfiles() {
        try {
            const profilesArray = Array.from(this.profiles.values()).map(p => p.toJSON());
            localStorage.setItem('voice_profiles', JSON.stringify(profilesArray));
            
            const mappingsObj = {};
            this.templateMappings.forEach((profileId, key) => {
                mappingsObj[key] = profileId;
            });
            localStorage.setItem('voice_template_mappings', JSON.stringify(mappingsObj));
        } catch (error) {
            console.error('Error saving voice profiles:', error);
        }
    }
    
    // Ensure default profiles exist
    ensureDefaultProfiles() {
        const defaultProfiles = [
            // Young voices
            {
                id: 'young_male_casual',
                name: 'Young Male Casual',
                description: 'Energetic, casual young male voice',
                characteristics: {
                    gender: 'male',
                    age: 'young-adult',
                    emotion: 'cheerful',
                    tone: 'casual',
                    energy: 'high'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'yoZ06aMxZJJ28mfd3POQ' }, // Sam - young American
                    'gemini': { voiceName: 'Puck' },
                    'orpheus-tts': { voice: 'Orpheus' },
                    'playai-tts-v3': { voice: 'Dexter (English (US)/American)' },
                    'playai-tts-dialog': { voice: 'Dexter (English (US)/American)' },
                    'dia-tts': { voice: 'cheerful_male' },
                    'dia-tts-clone': { voice: 'young_male', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/reference_audio.wav', referenceText: 'Hello there, this is a sample of my voice for cloning purposes.' },
                    'f5-tts': { voice: 'male_1', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/reference_audio.wav', referenceText: 'Hello there, this is a sample of my voice for cloning purposes.' },
                    'kokoro-tts': { voice: 'af_connor' },
                    'chatterbox-tts': { voice: 'male_young' }
                }
            },
            {
                id: 'young_female_bright',
                name: 'Young Female Bright',
                description: 'Bright, cheerful young female voice',
                characteristics: {
                    gender: 'female',
                    age: 'young-adult',
                    emotion: 'cheerful',
                    tone: 'friendly',
                    energy: 'high'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'EXAVITQu4vr4xnSDxMaL' }, // Sarah
                    'gemini': { voiceName: 'Zephyr' },
                    'orpheus-tts': { voice: 'Aoede' },
                    'playai-tts-v3': { voice: 'Jennifer (English (US)/American)' },
                    'playai-tts-dialog': { voice: 'Jennifer (English (US)/American)' },
                    'dia-tts': { voice: 'cheerful_female' },
                    'dia-tts-clone': { voice: 'young_female', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/female_reference.wav', referenceText: 'Hi everyone, this is how I naturally speak when I talk.' },
                    'f5-tts': { voice: 'female_1', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/female_reference.wav', referenceText: 'Hi everyone, this is how I naturally speak when I talk.' },
                    'kokoro-tts': { voice: 'af_sarah' },
                    'chatterbox-tts': { voice: 'female_young' }
                }
            },
            // Mature voices
            {
                id: 'mature_male_authoritative',
                name: 'Mature Male Authoritative',
                description: 'Deep, authoritative mature male voice',
                characteristics: {
                    gender: 'male',
                    age: 'adult',
                    emotion: 'serious',
                    tone: 'professional',
                    energy: 'medium'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'pNInz6obpgDQGcFmaJgB' }, // Adam - deep American
                    'gemini': { voiceName: 'Charon' },
                    'orpheus-tts': { voice: 'Zeus' },
                    'playai-tts-v3': { voice: 'Sterling (English (GB)/British)' },
                    'playai-tts-dialog': { voice: 'Sterling (English (GB)/British)' },
                    'dia-tts': { voice: 'authoritative_male' },
                    'dia-tts-clone': { voice: 'mature_male', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/mature_male_ref.wav', referenceText: 'Good evening, this represents my authoritative speaking style.' },
                    'f5-tts': { voice: 'male_2', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/mature_male_ref.wav', referenceText: 'Good evening, this represents my authoritative speaking style.' },
                    'kokoro-tts': { voice: 'am_michael' },
                    'chatterbox-tts': { voice: 'male_mature' }
                }
            },
            {
                id: 'mature_female_professional',
                name: 'Mature Female Professional',
                description: 'Professional, confident mature female voice',
                characteristics: {
                    gender: 'female',
                    age: 'adult',
                    emotion: 'neutral',
                    tone: 'professional',
                    energy: 'medium'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'XrExE9yKIg1WjnnlVkGX' }, // Matilda - American
                    'gemini': { voiceName: 'Kore' },
                    'orpheus-tts': { voice: 'Hera' },
                    'playai-tts-v3': { voice: 'Charlotte (Advertising) (English (CA)/Canadian)' },
                    'playai-tts-dialog': { voice: 'Charlotte (Advertising) (English (CA)/Canadian)' },
                    'dia-tts': { voice: 'professional_female' },
                    'dia-tts-clone': { voice: 'mature_female', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/professional_female.wav', referenceText: 'Welcome, this demonstrates my professional speaking voice.' },
                    'f5-tts': { voice: 'female_2', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/professional_female.wav', referenceText: 'Welcome, this demonstrates my professional speaking voice.' },
                    'kokoro-tts': { voice: 'af_nicole' },
                    'chatterbox-tts': { voice: 'female_mature' }
                }
            },
            // Elder voices
            {
                id: 'elder_male_wise',
                name: 'Elder Male Wise',
                description: 'Wise, experienced elderly male voice',
                characteristics: {
                    gender: 'male',
                    age: 'senior',
                    emotion: 'neutral',
                    tone: 'conversational',
                    energy: 'low'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'JBFqnCBsd6RMkjVDRZzb' }, // George - British
                    'gemini': { voiceName: 'Kore' },
                    'orpheus-tts': { voice: 'Gandalf' },
                    'playai-tts-v3': { voice: 'Cecil (English (GB)/British)' },
                    'playai-tts-dialog': { voice: 'Cecil (English (GB)/British)' },
                    'dia-tts': { voice: 'wise_elder' },
                    'dia-tts-clone': { voice: 'elder_male', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/wise_elder.wav', referenceText: 'My dear friends, this is how wisdom sounds when spoken aloud.' },
                    'f5-tts': { voice: 'male_3', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/wise_elder.wav', referenceText: 'My dear friends, this is how wisdom sounds when spoken aloud.' },
                    'kokoro-tts': { voice: 'bf_william' },
                    'chatterbox-tts': { voice: 'male_elder' }
                }
            },
            {
                id: 'elder_female_warm',
                name: 'Elder Female Warm',
                description: 'Warm, motherly elderly female voice',
                characteristics: {
                    gender: 'female',
                    age: 'senior',
                    emotion: 'friendly',
                    tone: 'conversational',
                    energy: 'low'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'LcfcDJNUP1GQjkzn1xUU' }, // Emily - calm American
                    'gemini': { voiceName: 'Aoede' },
                    'orpheus-tts': { voice: 'Grandmother' },
                    'playai-tts-v3': { voice: 'Charlotte (Meditation) (English (CA)/Canadian)' },
                    'playai-tts-dialog': { voice: 'Charlotte (Meditation) (English (CA)/Canadian)' },
                    'dia-tts': { voice: 'warm_female' },
                    'dia-tts-clone': { voice: 'elder_female', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/warm_grandmother.wav', referenceText: 'Hello sweetheart, this is my gentle and caring voice.' },
                    'f5-tts': { voice: 'female_3', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/warm_grandmother.wav', referenceText: 'Hello sweetheart, this is my gentle and caring voice.' },
                    'kokoro-tts': { voice: 'bf_emma' },
                    'chatterbox-tts': { voice: 'female_elder' }
                }
            },
            // Character voices
            {
                id: 'character_male_eccentric',
                name: 'Character Male Eccentric',
                description: 'Eccentric, unique male character voice',
                characteristics: {
                    gender: 'male',
                    age: 'adult',
                    emotion: 'dramatic',
                    tone: 'casual',
                    energy: 'high'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'flq6f7yk4E4fJM5XTYuZ' }, // Michael - British
                    'gemini': { voiceName: 'Fenrir' },
                    'orpheus-tts': { voice: 'Loki' },
                    'playai-tts-v3': { voice: 'Cillian (English (IE)/Irish)' },
                    'playai-tts-dialog': { voice: 'Cillian (English (IE)/Irish)' },
                    'dia-tts': { voice: 'eccentric_male' },
                    'dia-tts-clone': { voice: 'character_male', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/eccentric_character.wav', referenceText: 'Ah yes, quite fascinating indeed, this is my distinctive speaking manner.' },
                    'f5-tts': { voice: 'male_4', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/eccentric_character.wav', referenceText: 'Ah yes, quite fascinating indeed, this is my distinctive speaking manner.' },
                    'kokoro-tts': { voice: 'bf_james' },
                    'chatterbox-tts': { voice: 'male_character' }
                }
            },
            {
                id: 'character_female_mystical',
                name: 'Character Female Mystical',
                description: 'Mystical, ethereal female character voice',
                characteristics: {
                    gender: 'female',
                    age: 'adult',
                    emotion: 'neutral',
                    tone: 'formal',
                    energy: 'medium'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'piTKgcLEGmPE4e6mEKli' }, // Dorothy - British
                    'gemini': { voiceName: 'Zephyr' },
                    'orpheus-tts': { voice: 'Luna' },
                    'playai-tts-v3': { voice: 'Madison (English (IE)/Irish)' },
                    'playai-tts-dialog': { voice: 'Madison (English (IE)/Irish)' },
                    'dia-tts': { voice: 'mystical_female' },
                    'dia-tts-clone': { voice: 'ethereal_female', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/mystical_voice.wav', referenceText: 'Whispers from beyond, this is how the ethereal realm speaks.' },
                    'f5-tts': { voice: 'female_4', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/mystical_voice.wav', referenceText: 'Whispers from beyond, this is how the ethereal realm speaks.' },
                    'kokoro-tts': { voice: 'bf_isabella' },
                    'chatterbox-tts': { voice: 'female_character' }
                }
            },
            // Non-binary/neutral voices
            {
                id: 'neutral_calm',
                name: 'Neutral Calm',
                description: 'Calm, gender-neutral voice',
                characteristics: {
                    gender: 'neutral',
                    age: 'adult',
                    emotion: 'neutral',
                    tone: 'professional',
                    energy: 'low'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 'ErXwobaYiN019PkySvjV' }, // Antoni - calm American
                    'gemini': { voiceName: 'Zephyr' },
                    'orpheus-tts': { voice: 'Sage' },
                    'playai-tts-v3': { voice: 'Ava (English (AU)/Australian)' },
                    'playai-tts-dialog': { voice: 'Ava (English (AU)/Australian)' },
                    'dia-tts': { voice: 'calm_neutral' },
                    'dia-tts-clone': { voice: 'neutral_calm', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/calm_neutral.wav', referenceText: 'This is a balanced, peaceful way of speaking clearly.' },
                    'f5-tts': { voice: 'neutral_1', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/calm_neutral.wav', referenceText: 'This is a balanced, peaceful way of speaking clearly.' },
                    'kokoro-tts': { voice: 'af_sky' },
                    'chatterbox-tts': { voice: 'neutral_calm' }
                }
            },
            {
                id: 'neutral_energetic',
                name: 'Neutral Energetic',
                description: 'Energetic, gender-neutral voice',
                characteristics: {
                    gender: 'neutral',
                    age: 'young-adult',
                    emotion: 'cheerful',
                    tone: 'casual',
                    energy: 'high'
                },
                providerMappings: {
                    'elevenlabs': { voiceId: 't0jbNlBVZ17f02VDIeMI' }, // Adam (alternate) - American
                    'gemini': { voiceName: 'Puck' },
                    'orpheus-tts': { voice: 'Sprite' },
                    'playai-tts-v3': { voice: 'Tilly (English (AU)/Australian)' },
                    'playai-tts-dialog': { voice: 'Tilly (English (AU)/Australian)' },
                    'dia-tts': { voice: 'energetic_neutral' },
                    'dia-tts-clone': { voice: 'neutral_energetic', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/energetic_neutral.wav', referenceText: 'Hey there! This is my upbeat and enthusiastic speaking style!' },
                    'f5-tts': { voice: 'neutral_2', referenceAudio: 'https://storage.googleapis.com/falserverless/example_inputs/energetic_neutral.wav', referenceText: 'Hey there! This is my upbeat and enthusiastic speaking style!' },
                    'kokoro-tts': { voice: 'af_riley' },
                    'chatterbox-tts': { voice: 'neutral_energetic' }
                }
            }
        ];
        
        defaultProfiles.forEach(data => {
            if (!this.profiles.has(data.id)) {
                const profile = new VoiceProfile(data);
                this.profiles.set(profile.id, profile);
            }
        });
        
        if (defaultProfiles.some(p => !this.profiles.has(p.id))) {
            this.saveProfiles();
        }
    }
    
    // CRUD operations
    createProfile(data) {
        const profile = new VoiceProfile(data);
        this.profiles.set(profile.id, profile);
        this.saveProfiles();
        return profile;
    }
    
    getProfile(id) {
        return this.profiles.get(id);
    }
    
    updateProfile(id, updates) {
        const profile = this.profiles.get(id);
        if (profile) {
            Object.assign(profile, updates);
            profile.updatedAt = Date.now();
            this.saveProfiles();
            return profile;
        }
        return null;
    }
    
    deleteProfile(id) {
        const deleted = this.profiles.delete(id);
        if (deleted) {
            // Remove any template mappings using this profile
            const keysToDelete = [];
            this.templateMappings.forEach((profileId, key) => {
                if (profileId === id) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.templateMappings.delete(key));
            
            this.saveProfiles();
        }
        return deleted;
    }
    
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }
    
    // Template mapping operations
    setTemplateMapping(templateName, speaker, profileId) {
        const key = `${templateName}:${speaker}`;
        this.templateMappings.set(key, profileId);
        this.saveProfiles();
    }
    
    getTemplateMapping(templateName, speaker) {
        const key = `${templateName}:${speaker}`;
        return this.templateMappings.get(key);
    }
    
    removeTemplateMapping(templateName, speaker) {
        const key = `${templateName}:${speaker}`;
        const deleted = this.templateMappings.delete(key);
        if (deleted) {
            this.saveProfiles();
        }
        return deleted;
    }
    
    getTemplateMappings(templateName) {
        const mappings = {};
        this.templateMappings.forEach((profileId, key) => {
            if (key.startsWith(templateName + ':')) {
                const speaker = key.substring(templateName.length + 1);
                mappings[speaker] = profileId;
            }
        });
        return mappings;
    }
    
    // Get voice configuration for TTS generation
    getVoiceConfig(templateName, speaker, provider) {
        // First check template-specific mapping
        const profileId = this.getTemplateMapping(templateName, speaker);
        if (profileId) {
            const profile = this.getProfile(profileId);
            if (profile) {
                const config = profile.getProviderConfig(provider);
                if (config) {
                    return { profile, config };
                }
            }
        }
        
        // Fallback to default based on characteristics if needed
        // This could be enhanced with better matching logic
        const profiles = this.getAllProfiles();
        for (const profile of profiles) {
            if (profile.hasProvider(provider)) {
                return { profile, config: profile.getProviderConfig(provider) };
            }
        }
        
        return null;
    }
    
    // Find profiles matching certain characteristics
    findProfilesByCharacteristics(characteristics) {
        return this.getAllProfiles().filter(profile => {
            return Object.entries(characteristics).every(([key, value]) => {
                return profile.characteristics[key] === value;
            });
        });
    }
    
    // Import/Export functionality
    exportProfiles() {
        return {
            profiles: this.getAllProfiles().map(p => p.toJSON()),
            mappings: Object.fromEntries(this.templateMappings)
        };
    }
    
    importProfiles(data) {
        try {
            if (data.profiles) {
                data.profiles.forEach(profileData => {
                    const profile = new VoiceProfile(profileData);
                    this.profiles.set(profile.id, profile);
                });
            }
            
            if (data.mappings) {
                Object.entries(data.mappings).forEach(([key, profileId]) => {
                    this.templateMappings.set(key, profileId);
                });
            }
            
            this.saveProfiles();
            return true;
        } catch (error) {
            console.error('Error importing profiles:', error);
            return false;
        }
    }
} 
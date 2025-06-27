// Voice Profiles Management System
// Handles voice profiles with characteristics and mappings to specific TTS providers
import { safeRequest, safeJSONParse, ErrorHandler } from './utils.js';

// Voice Profile - Read-only data structure loaded from voice-profiles.json
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

// Voice Profile Manager - Loads read-only voice profiles from JSON
export class VoiceProfileManager {
    constructor(app) {
        this.app = app;
        this.profiles = new Map(); // Read-only profiles loaded from voice-profiles.json
        this.loadProfiles();
    }
    
    // Load voice profiles from JSON
    loadProfiles() {
        
        // Load voice profiles from JSON file
        this.ensureDefaultProfiles()
            .then(result => {
                this.app.voiceProfileCount = this.profiles.size;
                this.app.voiceProfiles = Array.from(this.profiles.values());
            })
            .catch(error => {
                console.error('[VoiceProfileManager] Failed to load voice profiles:', error);
            })
            .finally(() => {
                this.app.voiceProfilesLoading = false;
            });
    }
    
    
    // Load default profiles from JSON file
    async loadDefaultProfiles() {
        try {
            const response = await safeRequest('./data/voice-profiles.json');
            const responseText = await response.text();
            const defaultProfiles = safeJSONParse(responseText);
            
            if (!defaultProfiles || !Array.isArray(defaultProfiles)) {
                throw new Error('Invalid voice profiles data');
            }
            
            defaultProfiles.forEach(data => {
                if (!this.profiles.has(data.id)) {
                    const profile = new VoiceProfile(data);
                    this.profiles.set(profile.id, profile);
                }
            });
            
            return true;
        } catch (error) {
            console.error('[VoiceProfileManager] Error loading default profiles:', error);
            const message = ErrorHandler.handle(error, 'voice-profiles-load');
            return false;
        }
    }
    
    // Ensure default profiles exist (now async)
    async ensureDefaultProfiles() {
        return await this.loadDefaultProfiles();
    }
    
    // Read-only profile access
    getProfile(id) {
        return this.profiles.get(id);
    }
    
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }
    
    
    // Get voice configuration for TTS generation
    getVoiceConfig(templateName, speaker, provider) {
        // Get default voice configuration based on characteristics
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
    
    // Export functionality (read-only profiles)
    exportProfiles() {
        return {
            profiles: this.getAllProfiles().map(p => p.toJSON())
        };
    }
} 
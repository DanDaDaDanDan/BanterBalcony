// Settings management functionality
import { SafeStorage, InputSanitizer } from '../utils.js';

export class SettingsManager {
    constructor(app) {
        this.app = app;
    }

    saveSettings() {
        // Validate API keys before saving
        if (this.app.openaiKey && !InputSanitizer.validateAPIKey(this.app.openaiKey, 'openai')) {
            console.warn('Invalid OpenAI API key format');
        }
        if (this.app.googleKey && !InputSanitizer.validateAPIKey(this.app.googleKey, 'google')) {
            console.warn('Invalid Google API key format');
        }
        if (this.app.elevenlabsKey && !InputSanitizer.validateAPIKey(this.app.elevenlabsKey, 'elevenlabs')) {
            console.warn('Invalid ElevenLabs API key format');
        }
        if (this.app.xaiKey && !InputSanitizer.validateAPIKey(this.app.xaiKey, 'xai')) {
            console.warn('Invalid xAI API key format');
        }
        if (this.app.deepseekKey && !InputSanitizer.validateAPIKey(this.app.deepseekKey, 'deepseek')) {
            console.warn('Invalid DeepSeek API key format');
        }
        if (this.app.falKey && !InputSanitizer.validateAPIKey(this.app.falKey, 'fal')) {
            console.warn('Invalid fal.ai API key format');
        }
        
        // Use SafeStorage for all localStorage operations
        SafeStorage.setItem('selected_provider', this.app.selectedProvider);
        SafeStorage.setItem('openai_api_key', this.app.openaiKey);
        SafeStorage.setItem('openai_model', this.app.openaiModel);
        SafeStorage.setItem('google_api_key', this.app.googleKey);
        SafeStorage.setItem('google_model', this.app.googleModel);
        SafeStorage.setItem('xai_api_key', this.app.xaiKey);
        SafeStorage.setItem('xai_model', this.app.xaiModel);
        SafeStorage.setItem('deepseek_api_key', this.app.deepseekKey);
        SafeStorage.setItem('deepseek_model', this.app.deepseekModel);
        SafeStorage.setItem('elevenlabs_api_key', this.app.elevenlabsKey);
        SafeStorage.setItem('elevenlabs_model', this.app.elevenlabsModel);
        SafeStorage.setItem('elevenlabs_api_mode', this.app.elevenlabsApiMode);
        SafeStorage.setItem('fal_api_key', this.app.falKey);
        SafeStorage.setItem('fal_model', this.app.falModel);
        SafeStorage.setItem('tts_provider', this.app.ttsProvider);
        SafeStorage.setItem('temperature', this.app.temperature.toString());
        SafeStorage.setItem('debug_enabled', this.app.debugEnabled.toString());
        SafeStorage.setItem('debug_pretty_mode', this.app.debugPrettyMode.toString());
    }
} 
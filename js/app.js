// Import all modules
import { AIModels } from './models.js';
import { ChatManager } from './chat.js';
import { PersonaManager } from './personas.js';
import { DebugManager } from './debug.js';
import { SettingsManager } from './settings.js';
import { AudioManager } from './audio.js';

window.banterBalconyApp = function() {
    const app = {
        // View state
                    currentView: 'chat',
        processing: false,
        showPersonaPrompt: false,
        
        // Provider settings
        selectedProvider: localStorage.getItem('selected_provider') || 'openai',
        
        // OpenAI settings
        openaiKey: localStorage.getItem('openai_api_key') || '',
        openaiModel: localStorage.getItem('openai_model') || 'gpt-4.1-nano',
        
        // Anthropic settings
        anthropicKey: localStorage.getItem('anthropic_api_key') || '',
        anthropicModel: localStorage.getItem('anthropic_model') || 'claude-sonnet-4-20250514',
        
        // Google settings
        googleKey: localStorage.getItem('google_api_key') || '',
        googleModel: localStorage.getItem('google_model') || 'gemini-2.5-flash-preview-05-20',
        geminiVoice: localStorage.getItem('gemini_voice') || 'Kore',
        
        // xAI settings
        xaiKey: localStorage.getItem('xai_api_key') || '',
        xaiModel: localStorage.getItem('xai_model') || 'grok-3',
        
        // DeepSeek settings
        deepseekKey: localStorage.getItem('deepseek_api_key') || '',
        deepseekModel: localStorage.getItem('deepseek_model') || 'deepseek-chat',
        
        // ElevenLabs settings
        elevenlabsKey: localStorage.getItem('elevenlabs_api_key') || '',
        elevenlabsModel: localStorage.getItem('elevenlabs_model') || 'eleven_multilingual_v2',
        
        // TTS Provider settings (independent of text generation)
        ttsProvider: localStorage.getItem('tts_provider') || 'elevenlabs', // 'elevenlabs' or 'gemini'
        
        // Temperature settings
        temperature: parseFloat(localStorage.getItem('temperature') || '0.8'),
        
        // Debug settings
        debugEnabled: localStorage.getItem('debug_enabled') === 'true' || localStorage.getItem('debug_enabled') === null,
        debugLog: [],
        debugPrettyMode: localStorage.getItem('debug_pretty_mode') !== 'false', // Default to true
        
        // Models that don't support temperature (reasoning models)
        reasoningModels: [
            'o1', 'o1-pro', 'o3', 'o3-mini', 'o4-mini',  // OpenAI reasoning models
            'gemini-2.0-flash-thinking-exp-1219', 'gemini-2.0-flash-thinking-exp-01-21', // Google thinking models
            'deepseek-reasoner' // DeepSeek reasoning model
        ],
        
        // Check if current model supports temperature
        get supportsTemperature() {
            const model = this.selectedModel;
            // Check if it's a reasoning model
            return !this.reasoningModels.some(rm => model.includes(rm));
        },
        
        // Get effective temperature (1.0 for reasoning models)
        get effectiveTemperature() {
            return this.supportsTemperature ? this.temperature : 1.0;
        },
        
        // Get current API key based on provider
        get apiKey() {
            switch(this.selectedProvider) {
                case 'openai': return this.openaiKey;
                case 'anthropic': return this.anthropicKey;
                case 'google': return this.googleKey;
                case 'xai': return this.xaiKey;
                case 'deepseek': return this.deepseekKey;
                default: return '';
            }
        },
        
        // Get current model based on provider
        get selectedModel() {
            switch(this.selectedProvider) {
                case 'openai': return this.openaiModel;
                case 'anthropic': return this.anthropicModel;
                case 'google': return this.googleModel;
                case 'xai': return this.xaiModel;
                case 'deepseek': return this.deepseekModel;
                default: return '';
            }
        },
        
        // Method to play audio
        playAudio(audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play();
        },
        
        // Chat state
        messages: [],
        currentInput: '',
        currentlyPlayingMessageIndex: null,
        
        // Banter state
        currentPersona: null,
        
        // Available templates (loaded from manifest only)
        availableTemplates: [],
        
        // Prompting guides
        elevenlabsPromptingGuide: '',
        geminiTTSTextGuide: '',
        
        async init() {
            // Initialize managers with the Alpine.js reactive proxy (this)
            this.aiModels = new AIModels(this);
            this.chatManager = new ChatManager(this);
            this.personaManager = new PersonaManager(this);
            this.debugManager = new DebugManager(this);
            this.settingsManager = new SettingsManager(this);
            this.audioManager = new AudioManager(this);
            
            // Bind methods to this Alpine instance
            // Chat methods
            this.getMessageClass = (message) => this.chatManager.getMessageClass(message);
            this.sendMessage = () => this.chatManager.sendMessage();
            this.handleInputKeydown = (event) => this.chatManager.handleInputKeydown(event);
            
            // Persona methods
            this.startNewPersona = () => this.personaManager.startNewPersona();
            this.startPersona = () => this.personaManager.startPersona();
            this.selectAndStart = (persona) => this.personaManager.selectAndStart(persona);
            this.quickStart = (persona) => this.personaManager.quickStart(persona);
            
            // Audio methods
            this.playAudio = (audioUrl, messageIndex) => this.audioManager.playAudio(audioUrl, messageIndex);
            this.playMessageAudio = (message, messageIndex) => this.audioManager.playMessageAudio(message, messageIndex);
            this.playConversationAudio = (conversationAudioUrl) => this.audioManager.playConversationAudio(conversationAudioUrl);
            this.playGeminiConversationAudio = (conversationId) => this.audioManager.playGeminiConversationAudio(conversationId);
            this.stopAudio = () => this.audioManager.stopAudio();
            this.isAudioPlaying = (messageIndex) => this.audioManager.isPlaying(messageIndex);
            this.isConversationPlaying = () => this.audioManager.isConversationPlaying();
            
            // Save conversation method
            this.saveConversation = (conversationId) => this.saveConversationToFile(conversationId);
            
            // Helper method to check if a message is the last in its conversation
            this.isLastMessageInConversation = (messageIndex) => {
                const message = this.messages[messageIndex];
                if (!message || !message.conversationId) return false;
                
                // Check if this is the last message with this conversationId
                for (let i = messageIndex + 1; i < this.messages.length; i++) {
                    if (this.messages[i].conversationId === message.conversationId) {
                        return false; // Found another message in the same conversation
                    }
                }
                return true;
            };
            
            // Helper method to check if a conversation has audio
            this.conversationHasAudio = (messageIndex) => {
                const message = this.messages[messageIndex];
                if (!message || !message.conversationId) return false;
                
                // Find the first message of this conversation to check for audio
                const firstMessage = this.messages.find(m => 
                    m.conversationId === message.conversationId && m.isConversationStart
                );
                
                if (!firstMessage) return false;
                
                const hasElevenLabsAudio = firstMessage.conversationAudioUrl;
                const hasGeminiAudio = firstMessage.audioData;
                
                return (this.ttsProvider === 'elevenlabs' && hasElevenLabsAudio) || 
                       (this.ttsProvider === 'gemini' && hasGeminiAudio);
            };
            
            // Helper method to get the first message of a conversation
            this.getConversationFirstMessage = (messageIndex) => {
                const message = this.messages[messageIndex];
                if (!message || !message.conversationId) return null;
                
                return this.messages.find(m => 
                    m.conversationId === message.conversationId && m.isConversationStart
                );
            };
            
            // Debug methods
            this.logDebug = (type, provider, model, data) => this.debugManager.logDebug(type, provider, model, data);
            this.formatDebugJSON = (obj) => this.debugManager.formatDebugJSON(obj);
            
            // Settings methods
            this.saveSettings = () => this.settingsManager.saveSettings();
            
            // Load templates from manifest
            await this.loadTemplatesFromManifest();
            
            // Load prompting guide
            await this.loadPromptingGuide();
            
            // Auto-scroll chat
            this.$watch('messages', () => {
                this.$nextTick(() => {
                    if (this.$refs.chatMessages) {
                        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
                    }
                });
            });
            
            // Also scroll when processing state changes
            this.$watch('processing', () => {
                this.$nextTick(() => {
                    if (this.$refs.chatMessages) {
                        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
                    }
                });
            });
            
            // Reset persona prompt when switching views
            this.$watch('currentView', (newView, oldView) => {
                if (oldView === 'personas' && newView !== 'personas') {
                    this.showPersonaPrompt = false;
                }
            });
            
            // Utility methods
            this.copyToClipboard = async (text) => {
                try {
                    await navigator.clipboard.writeText(text);
                    // Show brief success feedback
                    const originalText = event.target.textContent;
                    event.target.textContent = '✓';
                    event.target.style.color = 'var(--secondary-color)';
                    setTimeout(() => {
                        event.target.textContent = originalText;
                        event.target.style.color = '';
                    }, 1000);
                } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        console.log('Text copied to clipboard using fallback method');
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                    }
                    document.body.removeChild(textArea);
                }
            };
        },
        
        async loadPromptingGuide() {
            try {
                // Load ElevenLabs prompting guide
                const elevenlabsResponse = await fetch('./prompting/elevenlabs_prompting_guide.md');
                if (elevenlabsResponse.ok) {
                    this.elevenlabsPromptingGuide = await elevenlabsResponse.text();
                    console.log('Successfully loaded ElevenLabs prompting guide.');
                } else {
                    console.error('Failed to load ElevenLabs prompting guide.');
                }

                // Load Gemini TTS text generation guide
                const geminiTTSResponse = await fetch('./prompting/gemini_tts_text_guide.md');
                if (geminiTTSResponse.ok) {
                    this.geminiTTSTextGuide = await geminiTTSResponse.text();
                    console.log('Successfully loaded Gemini TTS text guide.');
                } else {
                    console.error('Failed to load Gemini TTS text guide.');
                }
            } catch (error) {
                console.error('Error loading prompting guides:', error);
            }
        },
        
        // Simplified template loading from manifest only (now supporting markdown)
        loadTemplatesFromManifest: async function() {
            try {
                console.log('Loading templates from manifest...');
                
                // Load the manifest file
                const manifestResponse = await fetch('./templates/manifest.json');
                if (!manifestResponse.ok) {
                    console.log('No template manifest found');
                    this.availableTemplates = [];
                    return;
                }
                
                const manifest = await manifestResponse.json();
                console.log('Loaded manifest:', manifest);
                const templates = [];
                
                // Load each template file
                for (const templateFile of manifest.templates) {
                    try {
                        console.log(`Loading template file: ${templateFile}`);
                        const templateResponse = await fetch(`./templates/${templateFile}`);
                        if (templateResponse.ok) {
                            const templateContent = await templateResponse.text();
                            console.log(`Template content length: ${templateContent.length}`);
                            
                            // Parse markdown template
                            const template = this.parseMarkdownTemplate(templateContent);
                            templates.push(template);
                            console.log(`Successfully loaded template: ${template.name}`);
                        } else {
                            console.warn(`Failed to load template: ${templateFile} (${templateResponse.status})`);
                        }
                    } catch (error) {
                        console.error(`Error loading template ${templateFile}:`, error);
                    }
                }
                
                this.availableTemplates = templates;
                console.log(`Successfully loaded ${templates.length} templates from manifest`);
                
            } catch (error) {
                console.error('Error loading templates from manifest:', error);
                this.availableTemplates = [];
            }
        },
        
        // Parse markdown template with YAML frontmatter
        parseMarkdownTemplate: function(content) {
            try {
                // Normalize line endings
                const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
                // Split content into frontmatter and body
                const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
                const match = normalizedContent.match(frontmatterRegex);
                
                if (!match) {
                    console.error('Invalid template format: missing YAML frontmatter');
                    console.log('Content preview:', normalizedContent.substring(0, 200));
                    throw new Error('Invalid template format: missing YAML frontmatter');
                }
                
                const [, frontmatterYaml, markdownBody] = match;
                
                // Parse YAML frontmatter (simple parser for name and summary)
                const frontmatter = this.parseSimpleYaml(frontmatterYaml);
                console.log('Parsed frontmatter:', frontmatter);
                console.log('Gemini voices found:', frontmatter.gemini_voices);
                
                // Parse markdown sections
                const sections = this.parseMarkdownSections(markdownBody);
                console.log('Parsed sections:', Object.keys(sections));
                
                // Build template object
                const template = {
                    name: frontmatter.name,
                    summary: frontmatter.summary,
                    systemPrompt: sections['System Prompt'] || '',
                    voices: frontmatter.voices || {},
                    gemini_voices: frontmatter.gemini_voices || {}
                };
                
                console.log('Built template:', template.name);
                return template;
            } catch (error) {
                console.error('Error parsing markdown template:', error);
                throw error;
            }
        },
        
        // Simple YAML parser for name and summary (basic key-value pairs)
        parseSimpleYaml: function(yamlText) {
            const result = {};
            let currentKey = null;
            let isInsideObject = false;

            const lines = yamlText.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const colonIndex = trimmed.indexOf(':');
                    if (colonIndex > 0) {
                        const key = trimmed.substring(0, colonIndex).trim();
                        let value = trimmed.substring(colonIndex + 1).trim();
                        
                        // Handle nested object for voices and gemini_voices
                        if (key === 'voices' || key === 'gemini_voices') {
                            result[key] = {};
                            currentKey = key;
                            isInsideObject = true;
                        } else if (isInsideObject) {
                            // Remove quotes if present
                            if ((value.startsWith('"') && value.endsWith('"')) || 
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.slice(1, -1);
                            }
                            const nestedKey = key.replace(/['"]/g, '');
                            result[currentKey][nestedKey] = value;
                        } else {
                            // Remove quotes if present
                            if ((value.startsWith('"') && value.endsWith('"')) || 
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.slice(1, -1);
                            }
                            result[key] = value;
                            isInsideObject = false;
                            currentKey = null;
                        }
                    }
                }
            }
            
            return result;
        },
        
        // Parse markdown sections by headers
        parseMarkdownSections: function(markdownText) {
            const sections = {};
            
            // Find all level 1 headers (# Header)
            const headerRegex = /^# (.+)$/gm;
            const matches = [...markdownText.matchAll(headerRegex)];
            
            if (matches.length === 0) {
                console.warn('No markdown sections found');
                return sections;
            }
            
            for (let i = 0; i < matches.length; i++) {
                const currentMatch = matches[i];
                const nextMatch = matches[i + 1];
                
                const sectionName = currentMatch[1].trim();
                const startIndex = currentMatch.index + currentMatch[0].length;
                const endIndex = nextMatch ? nextMatch.index : markdownText.length;
                
                const sectionContent = markdownText
                    .substring(startIndex, endIndex)
                    .trim();
                
                sections[sectionName] = sectionContent;
            }
            
            return sections;
        },
        

        
        get effectiveAudioProvider() {
            return this.ttsProvider;
        },

        // Get the appropriate TTS model based on the selected Google model
        get geminiTTSModel() {
            // Map regular models to their TTS equivalents
            if (this.googleModel.includes('flash')) {
                return 'gemini-2.5-flash-preview-tts';
            } else if (this.googleModel.includes('pro')) {
                return 'gemini-2.5-pro-preview-tts';
            } else {
                // Default to flash for unknown models
                return 'gemini-2.5-flash-preview-tts';
            }
        },

        // Load a template by name from already-loaded templates
        async loadTemplate(templateName) {
            const template = this.availableTemplates.find(t => t.name === templateName);
            if (!template) {
                throw new Error(`Template not found: ${templateName}`);
                    }
            return template;
        },
        
        // Save conversation audio to MP3 file
        async saveConversationToFile(conversationId) {
            if (!conversationId) {
                console.warn('No conversation ID provided for saving');
                return;
            }
            
            // Find the first message in this conversation (contains the audio data)
            const firstMessage = this.messages.find(msg => 
                msg.conversationId === conversationId && msg.isConversationStart
            );
            
            if (!firstMessage) {
                console.warn('No conversation start message found for conversation ID:', conversationId);
                return;
            }
            
            const personaName = this.currentPersona?.name || 'Unknown Persona';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            
            try {
                let audioBlob;
                let filename;
                
                if (this.ttsProvider === 'elevenlabs' && firstMessage.conversationAudioUrl) {
                    // ElevenLabs: Download the conversation audio URL
                    const response = await fetch(firstMessage.conversationAudioUrl);
                    if (!response.ok) {
                        throw new Error('Failed to fetch ElevenLabs audio');
                    }
                    audioBlob = await response.blob();
                    filename = `conversation_${personaName}_${timestamp}.mp3`;
                    
                } else if (this.ttsProvider === 'gemini' && firstMessage.audioData) {
                    // Gemini: Convert base64 WAV data to blob
                    const audioData = firstMessage.audioData;
                    const mimeType = firstMessage.audioMimeType || 'audio/wav';
                    
                    // Decode base64 to binary
                    const binaryString = atob(audioData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    audioBlob = new Blob([bytes], { type: mimeType });
                    filename = `conversation_${personaName}_${timestamp}.wav`;
                    
                } else {
                    // No audio available
                    console.warn('No audio data available for this conversation');
                    alert('No audio data available for this conversation. Make sure audio generation is enabled.');
                    return;
                }
                
                // Create and download the audio file
                const url = URL.createObjectURL(audioBlob);
                
                // Create download link and click it
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Clean up the URL
                URL.revokeObjectURL(url);
                
                console.log(`Conversation audio saved as: ${filename}`);
                
            } catch (error) {
                console.error('Error saving conversation audio:', error);
                alert('Failed to save conversation audio. Please try again.');
            }
        }
    };
    
    return app;
};

// Dynamically load Alpine.js after banterBalconyApp is defined
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js';
script.defer = true;
document.head.appendChild(script); 
// Import all modules
import { AIModels } from './models.js';
import { ChatManager } from './chat.js';
import { PersonaManager } from './personas.js';
import { VoiceTestManager } from './voice-test.js';
import { SettingsManager } from './settings.js';
import { AudioManager } from './audio.js';
import { VoiceProfileManager } from './voice-profiles.js';

window.banterBalconyApp = function() {
    const app = {
        // View state
                    currentView: 'chat',
        processing: false,
        showPersonaPrompt: false,
        
        // Debug state
        debugInput: '',
        debugSession: null,
        debugUpdateCounter: 0,
        availableVoiceModels: [],
        selectedVoiceModels: new Set(),
        
        // Voice profile state
        selectedVoiceProfile: null,
        editingVoiceProfile: false,
        
        // Provider settings
        selectedProvider: localStorage.getItem('selected_provider') || 'openai',
        
        // OpenAI settings
        openaiKey: localStorage.getItem('openai_api_key') || '',
        openaiModel: localStorage.getItem('openai_model') || 'gpt-4.1-nano',
        
        // Google settings
        googleKey: localStorage.getItem('google_api_key') || '',
        googleModel: localStorage.getItem('google_model') || 'gemini-2.5-flash',
        geminiVoice: localStorage.getItem('gemini_voice') || 'Kore',
        
        // xAI settings
        xaiKey: localStorage.getItem('xai_api_key') || '',
        xaiModel: localStorage.getItem('xai_model') || 'grok-3',
        
        // DeepSeek settings
        deepseekKey: localStorage.getItem('deepseek_api_key') || '',
        deepseekModel: localStorage.getItem('deepseek_model') || 'deepseek-chat',
        
        // ElevenLabs settings
        elevenlabsKey: localStorage.getItem('elevenlabs_api_key') || '',
        elevenlabsModel: localStorage.getItem('elevenlabs_model') || 'eleven_v3',
        elevenlabsApiMode: localStorage.getItem('elevenlabs_api_mode') || 'dialogue', // 'text-to-speech' or 'dialogue'
        
        // Fal.ai settings
        falKey: localStorage.getItem('fal_api_key') || '',
        falModel: localStorage.getItem('fal_model') || 'orpheus-tts',
        falVoice: localStorage.getItem('fal_voice') || 'default',
        
        // TTS Provider settings (independent of text generation)
        ttsProvider: localStorage.getItem('tts_provider') || 'elevenlabs', // 'elevenlabs', 'gemini', or 'fal'
        
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
        orpheusTTSGuide: '',
        playaiTTSGuide: '',
        diaTTSGuide: '',
        f5TTSGuide: '',
        kokoroTTSGuide: '',
        chatterboxTTSGuide: '',
        cartesiaTTSGuide: '',
        playhtTTSGuide: '',
        rapidTTSGuide: '',
        
        async init() {
            // Initialize managers with the Alpine.js reactive proxy (this)
            this.aiModels = new AIModels(this);
            this.chatManager = new ChatManager(this);
            this.personaManager = new PersonaManager(this);
            this.voiceTestManager = new VoiceTestManager(this);
            this.settingsManager = new SettingsManager(this);
            this.audioManager = new AudioManager(this);
            this.voiceProfileManager = new VoiceProfileManager(this);
            
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
            
            // Debug methods - Logs
            this.logDebug = (type, providerOrData, model, data) => {
                if (!this.debugEnabled) return;
                
                let finalData, provider, finalModel;
                
                // Check if this is the new format (type, data) or old format (type, provider, model, data)
                if (typeof providerOrData === 'object' && model === undefined && data === undefined) {
                    // New format: (type, data)
                    finalData = { ...providerOrData };
                    provider = finalData.provider || 'unknown';
                    finalModel = finalData.model || 'unknown';
                } else {
                    // Old format: (type, provider, model, data)
                    provider = providerOrData;
                    finalModel = model;
                    finalData = { ...data };
                }
                
                // Convert duration from milliseconds to seconds if it exists
                if (finalData.duration !== undefined) {
                    finalData.duration = (finalData.duration / 1000).toFixed(1);
                }
                
                const entry = {
                    timestamp: this.formatTimestamp(new Date()),
                    type: type, // 'request', 'response', 'error'
                    provider: provider,
                    model: finalModel,
                    ...finalData
                };
                
                this.debugLog.unshift(entry); // Add to beginning for newest first
                
                // Keep only last 100 entries to prevent memory issues
                if (this.debugLog.length > 100) {
                    this.debugLog = this.debugLog.slice(0, 100);
                }
            };
            
            this.formatDebugJSON = (obj) => {
                // Handle null/undefined values
                if (obj === null || obj === undefined) {
                    return '';
                }
                
                try {
                    // Create a safe copy that handles circular references and limits depth
                    const safeObj = this.createSafeDebugObject(obj, 0, 10); // Max depth of 10
                    
                    if (!this.debugPrettyMode) {
                        // Raw mode - compact JSON string, single line
                        return JSON.stringify(safeObj);
                    }
            
                    // Pretty mode with syntax highlighting
                    let jsonStr = JSON.stringify(safeObj, null, 2);
                    
                    // In pretty mode, replace escaped newlines with actual newlines for better readability
                    // But keep escaped quotes as-is to maintain valid JSON structure
                    jsonStr = jsonStr.replace(/\\n/g, '\n');
                    
                    // Replace literal \t with actual tabs for better formatting
                    jsonStr = jsonStr.replace(/\\t/g, '\t');
                    
                    // Apply syntax highlighting
                    return this.syntaxHighlightJSON(jsonStr);
                } catch (error) {
                    // If all else fails, return a safe error message
                    return `<span class="json-error">Error formatting JSON: ${error.message}</span>`;
                }
            };
            
            // Helper methods for debug logging
            this.formatTimestamp = (date) => {
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZoneName: 'short'
                });
            };
            
            this.createSafeDebugObject = (obj, currentDepth = 0, maxDepth = 10, seen = new WeakSet()) => {
                // Prevent infinite recursion
                if (currentDepth >= maxDepth) {
                    return '[Max depth reached]';
                }
            
                // Handle primitive types
                if (obj === null || typeof obj !== 'object') {
                    return obj;
                }
                
                // Handle circular references
                if (seen.has(obj)) {
                    return '[Circular Reference]';
                }
                
                // Mark this object as seen
                seen.add(obj);
                
                try {
                    if (Array.isArray(obj)) {
                        return obj.map(item => this.createSafeDebugObject(item, currentDepth + 1, maxDepth, seen));
                    } else {
                        const result = {};
                        for (const [key, value] of Object.entries(obj)) {
                            // Skip functions and undefined values
                            if (typeof value === 'function' || value === undefined) {
                                continue;
                            }
                            
                            // Replace base64 audio data with placeholder
                            if (typeof value === 'string' && this.isBase64AudioData(value)) {
                                result[key] = `[Base64 Audio Data: ${Math.round(value.length / 1024)}KB]`;
                                continue;
                            }
                            
                            result[key] = this.createSafeDebugObject(value, currentDepth + 1, maxDepth, seen);
                        }
                        return result;
                    }
                } catch (error) {
                    return `[Error processing object: ${error.message}]`;
                } finally {
                    // Remove from seen set when done (for this branch)
                    seen.delete(obj);
                }
            };
            
            this.syntaxHighlightJSON = (json) => {
                // Escape HTML characters first
                json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // Apply syntax highlighting with HTML spans
                return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                    let cls = 'json-number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'json-key';
                        } else {
                            cls = 'json-string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'json-boolean';
                    } else if (/null/.test(match)) {
                        cls = 'json-null';
                    }
                    return '<span class="' + cls + '">' + match + '</span>';
                });
            };
            
            this.isBase64AudioData = (str) => {
                // Check if it's a long base64 string (likely audio if > 10KB when decoded)
                if (str.length < 1000) return false;
                
                // Check if it looks like base64 (only contains base64 characters)
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (!base64Regex.test(str)) return false;
                
                // Additional heuristics: very long strings are likely audio/binary data
                return str.length > 10000; // Roughly 7.5KB of decoded data
            };
            
            // Debug methods - Voice Testing
            this.startDebugSession = async () => {
                if (!this.debugInput.trim()) return;
                
                // Check if we have a persona selected
                if (!this.currentPersona) {
                    alert('Please select a persona first from the Personas tab');
                    return;
                }
                
                // Get selected models from checkboxes
                const selectedModels = Array.from(this.selectedVoiceModels);
                if (selectedModels.length === 0) {
                    alert('Please select at least one voice model to test');
                    return;
                }
                
                // Update the reactive debugSession to trigger UI updates
                this.debugSession = this.voiceTestManager.getCurrentSession();
                
                // Create and start the debug session with selected models
                await this.voiceTestManager.createDebugSession(this.debugInput.trim(), selectedModels);
                
                // Keep updating the UI as the session progresses
                this.updateDebugView();
            };
            
            this.updateDebugView = () => {
                // Update the reactive debugSession with deep cloning to force Alpine detection
                const currentSession = this.voiceTestManager.getCurrentSession();
                if (currentSession) {
                    // Deep clone to ensure Alpine.js detects all nested changes
                    this.debugSession = JSON.parse(JSON.stringify(currentSession));
                } else {
                    this.debugSession = null;
                }
                // Force Alpine to detect changes by incrementing counter
                this.debugUpdateCounter++;
            };
            
            this.handleDebugInputKeydown = (event) => {
                // Auto-resize textarea
                this.chatManager.autoResizeTextarea(event.target);
                
                if (event.key === 'Enter') {
                    if (event.shiftKey) {
                        // Shift+Enter: Allow new line (default behavior)
                        return;
                    } else {
                        // Enter: Start debug session
                        event.preventDefault();
                        this.startDebugSession();
                    }
                }
            };
            
            this.playDebugAudio = (modelId) => {
                const session = this.voiceTestManager.getCurrentSession();
                if (!session) return;
                
                this.voiceTestManager.playModelAudio(session.id, modelId);
            };
            
            this.isDebugAudioPlaying = (modelId) => {
                return this.audioManager.isPlaying(`debug-${modelId}`);
            };
            
            this.formatModelStatus = (status) => {
                const statusMap = {
                    'pending': 'Pending',
                    'generating_text': 'Generating Text',
                    'text_completed': 'Text Generated',
                    'generating_audio': 'Generating Audio',
                    'completed': 'Completed',
                    'failed': 'Failed'
                };
                return statusMap[status] || status;
            };
            
            this.formatTiming = (start, end) => {
                if (!start || !end) return 'N/A';
                const duration = (end - start) / 1000;
                return `${duration.toFixed(1)}s`;
            };
            
            this.formatDebugDuration = (session) => {
                if (!session) return '0s';
                const start = session.startTime;
                const end = session.endTime || Date.now();
                return this.formatTiming(start, end);
            };
            
            this.calculateOverallProgress = (session) => {
                if (!session || !session.models || session.models.length === 0) return 0;
                const totalProgress = session.models.reduce((sum, model) => sum + (model.progress || 0), 0);
                return Math.round(totalProgress / session.models.length);
            };
            
            this.exportDebugSession = () => {
                const session = this.voiceTestManager.getCurrentSession();
                if (!session) return;
                
                const exportData = this.voiceTestManager.exportSession(session.id);
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `debug-session-${session.id}.json`;
                link.click();
                
                URL.revokeObjectURL(link.href);
            };
            
            // Load available voice models when entering debug view
            this.loadAvailableVoiceModels = () => {
                this.availableVoiceModels = this.voiceTestManager.getAllVoiceModels();
                // Select all by default
                this.selectedVoiceModels = new Set(this.availableVoiceModels.map(m => m.modelId));
            };
            
            // Toggle voice model selection
            this.toggleVoiceModel = (modelId) => {
                if (this.selectedVoiceModels.has(modelId)) {
                    this.selectedVoiceModels.delete(modelId);
                } else {
                    this.selectedVoiceModels.add(modelId);
                }
            };
            
            // Select/deselect all voice models
            this.toggleAllVoiceModels = () => {
                if (this.selectedVoiceModels.size === this.availableVoiceModels.length) {
                    // All selected, so deselect all
                    this.selectedVoiceModels.clear();
                } else {
                    // Some or none selected, so select all
                    this.selectedVoiceModels = new Set(this.availableVoiceModels.map(m => m.modelId));
                }
            };
            
            // Get model selection count
            this.getSelectedModelCount = () => {
                return this.selectedVoiceModels.size;
            };
            
            // Watch for view changes to load models when entering debug view
            this.$watch('currentView', (newView) => {
                if (newView === 'debug' && this.availableVoiceModels.length === 0) {
                    this.loadAvailableVoiceModels();
                }
            });
            
            // Set up interval to update debug view during processing
            setInterval(() => {
                if (this.debugSession) {
                    const isActive = this.debugSession.status === 'processing' || 
                                   this.debugSession.status === 'initializing' || 
                                   this.debugSession.status === 'ready';
                    
                    const isRecentlyCompleted = (this.debugSession.status === 'completed' ||
                                               this.debugSession.status === 'partial_success' ||
                                               this.debugSession.status === 'all_failed') &&
                                               this.debugSession.endTime &&
                                               (Date.now() - this.debugSession.endTime) < 5000; // Stop after 5 seconds
                    
                    if (isActive || isRecentlyCompleted) {
                        this.updateDebugView();
                    }
                }
            }, 500);
            
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
                // Define all prompting guides to load
                const guidesToLoad = [
                    { file: 'elevenlabs.md', property: 'elevenlabsPromptingGuide', name: 'ElevenLabs' },
                    { file: 'gemini.md', property: 'geminiTTSTextGuide', name: 'Gemini TTS' },
                    { file: 'orpheus.md', property: 'orpheusTTSGuide', name: 'Orpheus TTS' },
                    { file: 'playai.md', property: 'playaiTTSGuide', name: 'PlayAI TTS' },
                    { file: 'dia.md', property: 'diaTTSGuide', name: 'Dia TTS' },
                    { file: 'f5.md', property: 'f5TTSGuide', name: 'F5-TTS' },
                    { file: 'kokoro.md', property: 'kokoroTTSGuide', name: 'Kokoro TTS' },
                    { file: 'chatterbox.md', property: 'chatterboxTTSGuide', name: 'Chatterbox TTS' },
                    { file: 'cartesia.md', property: 'cartesiaTTSGuide', name: 'Cartesia TTS' },
                    { file: 'playht.md', property: 'playhtTTSGuide', name: 'PlayHT TTS' },
                    { file: 'rapidtts.md', property: 'rapidTTSGuide', name: 'RapidTTS' }
                ];

                // Load all guides
                for (const guide of guidesToLoad) {
                    try {
                        const response = await fetch(`./prompting/${guide.file}`);
                        if (response.ok) {
                            this[guide.property] = await response.text();
                            console.log(`Successfully loaded ${guide.name} prompting guide.`);
                        } else {
                            console.warn(`${guide.name} prompting guide not found (${response.status}).`);
                            // Set a basic fallback
                            this[guide.property] = `Format your response as a natural dialogue between characters. 
                                                   Each line should be in the format "Speaker: Dialogue text".
                                                   Keep responses conversational and engaging.`;
                        }
                    } catch (error) {
                        console.error(`Error loading ${guide.name} prompting guide:`, error);
                        // Set a basic fallback
                        this[guide.property] = `Format your response as a natural dialogue between characters. 
                                               Each line should be in the format "Speaker: Dialogue text".
                                               Keep responses conversational and engaging.`;
                    }
                }
            } catch (error) {
                console.error('Error in loadPromptingGuide:', error);
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
                    voice_profiles: frontmatter.voice_profiles || {},
                    // Keep legacy voice mappings for backward compatibility
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
                        
                        // Handle nested object for voices, gemini_voices, and voice_profiles
                        if (key === 'voices' || key === 'gemini_voices' || key === 'voice_profiles') {
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
            // Simple rule: if "flash" is in the name, use flash TTS model, otherwise use pro TTS model
            if (this.googleModel.includes('flash')) {
                return 'gemini-2.5-flash-preview-tts';
            } else {
                return 'gemini-2.5-pro-preview-tts';
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
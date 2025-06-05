// Scenario management functionality - simplified for manifest-only templates
export class ScenarioManager {
    constructor(app) {
        this.app = app;
    }

    async startNewScenario() {
        if (!this.app.currentScenario) {
            this.app.messages.push({
                sender: 'System',
                content: 'Please select a scenario template first. Click "Start Scenario" to choose one.',
                type: 'system'
            });
            return;
        }
        
        // Generate scenario details
        await this.generateScenarioDetails();
    }
    
    async generateScenarioDetails() {
        if (!this.app.apiKey) {
            this.app.messages.push({
                sender: 'System',
                content: `Please set your ${this.app.selectedProvider.toUpperCase()} API key in settings first.`,
                type: 'system'
            });
            return;
        }
        
        // Reset all simulation state
        this.app.messages = [];
        this.app.conversationHistory = [];
        this.app.people = [];
        
        this.app.processing = true;
        
        try {
            // Randomly select from dimensions
            const selections = {};
            this.app.currentScenario.dimensions.forEach(dim => {
                const options = dim.options.split(',').map(o => o.trim());
                const selectedValue = options[Math.floor(Math.random() * options.length)];
                selections[dim.name] = selectedValue;
            });
            
            // Use template-specific generation prompt
            const templatePrompt = Array.isArray(this.app.currentScenario.generationPrompt)
                ? this.app.currentScenario.generationPrompt.join('\n')
                : this.app.currentScenario.generationPrompt;
            
            // Replace <SCENARIO PARAMETERS> placeholder with actual selections
            const parametersText = `SCENARIO PARAMETERS: ${JSON.stringify(selections)}`;
            const prompt = templatePrompt.replace('<SCENARIO PARAMETERS>', parametersText);
            
            let scenario;
            switch(this.app.selectedProvider) {
                case 'anthropic':
                    scenario = await this.app.aiModels.callAnthropicAPI(prompt);
                    break;
                case 'google':
                    scenario = await this.app.aiModels.callGoogleAPI(prompt);
                    break;
                case 'xai':
                    scenario = await this.app.aiModels.callXAIAPI(prompt);
                    break;
                case 'deepseek':
                    scenario = await this.app.aiModels.callDeepSeekAPI(prompt);
                    break;
                default:
                    scenario = await this.app.aiModels.callOpenAIAPI(prompt);
            }
            
            // Set up people with colors (from scenario.occupants if present, otherwise empty)
            const colors = ['#34C759', '#FF9500', '#FF3B30', '#AF52DE'];
            const occupants = scenario.scenario?.occupants || [];
            this.app.people = occupants.map((person, index) => ({
                name: person.name || 'Unknown',
                role: person.role || 'civilian',
                observable: person.appearance || 'No description available',
                color: colors[index % colors.length]
            }));
            
            // Add initial system message with what player can observe
            this.app.messages.push({
                sender: 'System',
                content: scenario.initialDescription || 'No initial description provided',
                type: 'system'
            });
            
            // Store scenario data for system prompt injection  
            this.app.scenarioData = scenario.scenario || {};
            
            // Initialize empty conversation history
            this.app.conversationHistory = [];
            
        } catch (error) {
            console.error('Scenario generation error:', error);
            this.app.messages.push({
                sender: 'System',
                content: 'Error generating scenario. Please check your API key and try again.',
                type: 'system'
            });
        } finally {
            this.app.processing = false;
        }
    }

    // Scenario selection and starting
    selectScenario(scenario) {
        this.app.currentScenario = scenario;
    }
    
    selectAndStart(scenario) {
        this.selectScenario(scenario);
        this.app.showScenarioPrompt = false;
        this.app.currentView = 'simulator';
        this.startNewScenario();
    }
    
    quickStart(scenario) {
        this.selectScenario(scenario);
        this.startNewScenario();
    }
    
    startScenario() {
        // Switch to scenarios view and show prompt
        this.app.currentView = 'scenarios';
        this.app.showScenarioPrompt = true;
    }
} 
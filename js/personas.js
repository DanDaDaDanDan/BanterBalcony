// Persona management functionality for banter generation
export class PersonaManager {
    constructor(app) {
        this.app = app;
    }

    // Persona selection and starting
    _selectPersona(persona) {
        this.app.currentPersona = persona;
    }
    
    selectAndStart(persona) {
        this._selectPersona(persona);
        this.app.currentView = 'chat';
        this.startNewPersona();
    }
    
    quickStart(persona) {
        this._selectPersona(persona);
        this.startNewPersona();
    }
    
    startNewPersona() {
        if (!this.app.currentPersona) {
            this.app.messages.push({
                sender: 'System',
                content: 'Please select a persona first. Click "Select Persona" to choose one.',
                type: 'system'
            });
            return;
        }
        
        // Clear messages for fresh start
        this.app.messages = [];
        
        // Add welcome message
        this.app.messages.push({
            sender: 'System',
            content: `${this.app.currentPersona.name} selected. Type your question or statement to generate banter!`,
            type: 'system'
        });
    }
} 
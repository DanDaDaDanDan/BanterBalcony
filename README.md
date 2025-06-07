## Banter Balcony - AI-Powered Banter Generator

An AI-powered banter generator that creates witty dialogue between two personas based on user input. Built as a static website using JavaScript ES6 modules and Alpine.js.

### Features

- **Multi-Provider AI Support**: Works with OpenAI, Google Gemini, xAI Grok, DeepSeek, and Anthropic Claude
- **Voice Synthesis**: Optional ElevenLabs integration for high-quality audio generation
- **Custom Personas**: Create and manage your own character templates
- **Real-time Chat Interface**: Interactive dialogue generation with typing indicators
- **Privacy-Focused**: All processing happens locally or directly with your chosen AI provider
- **Debug Mode**: Detailed logging for troubleshooting and understanding API interactions
- **Temperature Control**: Adjust creativity vs consistency of AI responses
- **Responsive Design**: Works on desktop and mobile devices

### Setup

**Important: This app uses ES6 modules and must be served from a web server. It will NOT work when opening `index.html` directly in a browser due to CORS restrictions.**


### Step 1: Install Python (if not already installed)

**Windows:**
1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Download the latest Python 3.x version
3. Run the installer and **check "Add Python to PATH"**
4. Restart your command prompt/terminal

**Mac:**
```bash
# Install using Homebrew (recommended) or download from python.org/downloads
brew install python
```


### Step 2: Start the Local Server
```bash
# Navigate to the project directory
cd path/to/Banter-Balcony

# Start the server (Python 3)
python -m http.server 8000

# If that doesn't work, try:
python3 -m http.server 8000
```


### Step 3: Open in Browser
Open your browser and go to: `http://localhost:8000`


### Step 4: Configure the App
1. Go to Settings and select your preferred AI provider
2. Enter your API key for the selected provider
3. Choose your preferred model
4. Select a persona from the dropdown in the Chat tab


### Getting API Keys

#### AI Text Generation
- **OpenAI**: [platform.openai.com](https://platform.openai.com) - Go to API Keys section
- **Google**: [makersuite.google.com](https://makersuite.google.com) - Create API key in Google AI Studio
- **xAI**: [console.x.ai](https://console.x.ai) - Get API key from xAI Console
- **DeepSeek**: [platform.deepseek.com](https://platform.deepseek.com) - Create API key in platform
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) - Get API key (Note: Limited browser support due to CORS)

#### Voice Synthesis (Optional)
- **ElevenLabs**: [elevenlabs.io](https://elevenlabs.io) - Sign up and get API key from Profile Settings → API Keys
  - Used for high-quality voice synthesis of generated dialogue
  - Supports multiple voices and emotional expressions
  - Free tier available with monthly character limit


### Usage

1. Type your question or statement in the chat input to generate witty banter between two personas
2. Each interaction generates a fresh dialogue based on your input
3. Click the play button (🔊) next to messages to hear voice synthesis (requires ElevenLabs API key)
4. Use the Personas tab to create custom persona templates or select from built-in options
5. Adjust temperature settings in Settings for more creative or conservative responses


### Supported AI Providers

* **OpenAI**
	- GPT-4o, O1, O3 Mini, O3, O4 Mini
	- GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano (default)
	- GPT-4.5 Preview
* **Google Gemini**
	- Gemini 2.5 Flash Preview (default), Gemini 2.5 Pro Preview
	- Gemini 2.0 Flash, Gemini 2.0 Flash-Lite
* **xAI Grok**
	- Grok 3 (default), Grok 3 Mini
	- Grok 3 Fast, Grok 3 Mini Fast
* **DeepSeek**
	- DeepSeek Chat (default), DeepSeek Reasoner
	- DeepSeek Coder
* **Anthropic Claude**
	- Claude Sonnet 4 (default), Claude Haiku 3.5, Claude Opus 3.5
	- Limited browser support due to CORS restrictions

### Privacy

- Only API calls to your selected AI provider leave your device
- No analytics or tracking
- Your API keys are stored locally and never shared
- Debug logs contain API data but stay on your device
- Templates are loaded from local files, not external servers

### Project Structure

```
├── index.html                      # Main HTML structure
├── styles.css                      # All styling with dark grey theme
├── js/                             # JavaScript modules
│   ├── app.js                      # Main application entry point
│   ├── models.js                   # AI provider implementations and API handling
│   ├── chat.js                     # Chat interface and message processing
│   ├── personas.js                 # Persona selection and banter generation
│   ├── debug.js                    # Debug logging and JSON formatting
│   └── settings.js                 # Settings persistence
├── templates/                      # Template files
│   ├── film-critics.md 			# Film Critics persona template
│   ├── angel-vs-devil.md 		# Angel vs Devil persona template
│   ├── natural_prompting_guide.md # AI coaching guidance for natural dialogue
│   ├── elevenlabs_prompting_guide.md # ElevenLabs technical documentation
│   └── manifest.json               # List of templates to load
└── README.md                       # This file
```

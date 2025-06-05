## Situator - Scenario Simulator

An interactive scenario simulator that uses AI to create and manage dynamic role-playing situations. Built as a static website using JavaScript ES6 modules and Alpine.js.

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
cd path/to/situator

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
4. Select a scenario template from the dropdown in the Simulator tab


### Getting API Keys

- **OpenAI**: [platform.openai.com](https://platform.openai.com)
- **Google**: [makersuite.google.com](https://makersuite.google.com)
- **xAI**: [x.ai](https://x.ai)
- **DeepSeek**: [platform.deepseek.com](https://platform.deepseek.com)


### Usage

Type messages or actions in the chat input:
	- **Regular text** = Your character is speaking (e.g., "License and registration please")
	- **[Text in brackets]** = Your character is performing an action (e.g., [approaches the driver's window])


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
	- Not supported due to CORS blocking direct calls from browser and this project is serverless

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
│   ├── scenarios.js                # Scenario selection and starting (simplified)
│   ├── debug.js                    # Debug logging and JSON formatting
│   └── settings.js                 # Settings persistence
├── templates/                      # Template files
│   ├── traffic-stop.md 			# Traffic stop template
│   ├── hostage-negotiation.md 		# Hostage negotiation template
│   └── manifest.json               # List of templates to load
└── README.md                       # This file
```

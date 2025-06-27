# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Banter Balcony is a serverless, client-side web application that generates AI-powered dialogues between personas with voice synthesis. It runs entirely in the browser without any backend services.

Live deployment: https://dandadadandan.github.io/BanterBalcony/

## Development Commands

This is a pure frontend application with no build process. Common tasks:

- **Run locally**: Access the application at http://localhost:8080 (web server is already running)
- **Deploy**: Push to GitHub - automatically deployed via GitHub Pages
- **Lint/Format**: No linting or formatting tools configured
- **Test**: Manual testing through the UI - use Debug View for voice model testing

## Architecture

### Module Structure
The application uses ES6 modules with the following architecture:

- **app.js**: Main Alpine.js component and application state management
- **models.js**: AI provider abstraction (OpenAI, Google Gemini, xAI, DeepSeek)
- **tts-providers.js**: TTS provider implementations (ElevenLabs, Google, fal.ai)
- **chat.js**: Conversation management and message handling
- **personas.js**: Template loading and persona management
- **voice-profiles.js**: Voice mapping across different TTS providers (loads from voice-profiles.json)
- **voice-profiles.json**: Externalized voice profile data with provider mappings
- **audio.js**: Audio playback queue management
- **settings.js**: LocalStorage persistence layer
- **voice-test.js**: Debug and batch testing functionality

### Key Design Patterns

1. **Provider Pattern**: Both AI models and TTS providers use a common interface pattern for easy extensibility
2. **State Management**: Alpine.js reactive data with LocalStorage persistence
3. **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages
4. **Privacy-First**: All API keys stored locally, no analytics or external tracking

### Adding New Features

When adding AI providers:
1. Add provider configuration to `models.js`
2. Implement the provider-specific API call in the switch statement
3. Update the UI model selection in `index.html`

When adding TTS providers:
1. Add provider class to `tts-providers.js` 
2. Register in `TTSProviderFactory`
3. Add UI controls in `index.html`

### Important Notes

- **No package.json**: This is intentionally dependency-free
- **No build step**: Edit files directly and reload browser
- **API Keys**: All keys are stored in browser LocalStorage
- **Debug Logs**: Enable Debug View to see all API requests/responses
- **Voice Profiles**: Use the voice profile system to maintain consistent voices across providers

### Development Guidelines

- **No Automatic Fallbacks**: Always ask the user before implementing fallback solutions. If something fails (e.g., loading external resources), show clear error messages explaining what went wrong rather than silently falling back to hardcoded values.
- **Error Transparency**: When errors occur, provide clear information about what failed and how to fix it, rather than hiding the issue with automatic workarounds.
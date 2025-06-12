# Google Gemini Native Audio API Guide

## Overview

Google's Gemini API supports native text-to-speech (TTS) generation through its multimodal models. This allows you to generate both text responses and audio synthesis in a single API call, eliminating the need for separate TTS services.

## API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}
```

## Supported Models

- `gemini-2.5-flash-preview-tts` - Experimental TTS-specific model
- `gemini-2.5-pro-preview-tts` - Pro version of TTS model
- `gemini-1.5-flash-latest` - Stable multimodal model with audio capabilities

## Request Structure

### Basic Request

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Your prompt text here"
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Kore"
        }
      }
    }
  }
}
```

### Available Voices

- `Kore` - Default voice
- `Zephyr` - Alternative voice option
- `Puck` - Alternative voice option  
- `Charon` - Alternative voice option
- `Fenrir` - Alternative voice option
- `Aoede` - Alternative voice option

## Lowering Content Filtering

By default, Gemini has restrictive safety settings that may block benign content. To reduce false positives, add `safetySettings` to your request:

```json
{
  "contents": [...],
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_HATE_SPEECH", 
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_ONLY_HIGH"
    }
  ],
  "generationConfig": {...}
}
```

### Safety Threshold Options

- `BLOCK_NONE` - No blocking (use with caution)
- `BLOCK_ONLY_HIGH` - Block only high-probability harmful content
- `BLOCK_MEDIUM_AND_ABOVE` - Block medium and high probability content (default)
- `BLOCK_LOW_AND_ABOVE` - Block low, medium, and high probability content

## Complete Request Example

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Explain quantum computing in simple terms"
        }
      ]
    }
  ],
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_HATE_SPEECH",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_ONLY_HIGH"
    },
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_ONLY_HIGH"
    }
  ],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Kore"
        }
      }
    }
  }
}
```

## Response Structure

### Successful Response

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "audio/pcm;rate=24000",
              "data": "base64-encoded-pcm-audio-data"
            }
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": [...]
    }
  ],
  "usageMetadata": {...}
}
```

### Audio Data Format

The audio data is returned as:
- **Format**: Raw PCM (Pulse Code Modulation)
- **Sample Rate**: 24,000 Hz
- **Channels**: 1 (mono)
- **Bit Depth**: 16-bit
- **Encoding**: Base64

## Converting PCM to WAV

The returned PCM data needs to be converted to a playable format like WAV:

```javascript
function convertPCMToWAV(base64PCM) {
    // Decode base64 to binary
    const binaryString = atob(base64PCM);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
    }
    
    // PCM parameters
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    // Create WAV header
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    
    const wavHeader = new ArrayBuffer(44);
    const dv = new DataView(wavHeader);
    
    // RIFF chunk descriptor
    dv.setUint32(0, 0x52494646, false);             // "RIFF"
    dv.setUint32(4, 36 + pcmBytes.length, true);    // Chunk size
    dv.setUint32(8, 0x57415645, false);             // "WAVE"
    
    // fmt subchunk
    dv.setUint32(12, 0x666d7420, false);            // "fmt "
    dv.setUint32(16, 16, true);                     // Subchunk1Size (16 for PCM)
    dv.setUint16(20, 1, true);                      // AudioFormat (1 = PCM)
    dv.setUint16(22, numChannels, true);            // NumChannels
    dv.setUint32(24, sampleRate, true);             // SampleRate
    dv.setUint32(28, byteRate, true);               // ByteRate
    dv.setUint16(32, blockAlign, true);             // BlockAlign
    dv.setUint16(34, bitsPerSample, true);          // BitsPerSample
    
    // data subchunk
    dv.setUint32(36, 0x64617461, false);            // "data"
    dv.setUint32(40, pcmBytes.length, true);        // Subchunk2Size
    
    // Combine header and PCM data
    const wavBytes = new Uint8Array(44 + pcmBytes.length);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(pcmBytes, 44);
    
    // Convert back to base64
    let binary = '';
    for (let i = 0; i < wavBytes.length; i++) {
        binary += String.fromCharCode(wavBytes[i]);
    }
    return btoa(binary);
}
```

## Playing Audio in Browser

```javascript
// Convert base64 WAV to blob and play
function playAudioFromBase64(base64WAV) {
    const binaryString = atob(base64WAV);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);
    
    const audio = new Audio(audioUrl);
    audio.play();
    
    // Clean up URL when audio finishes
    audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
    });
}
```

## Error Handling

### Common Error Responses

1. **500 Internal Server Error**: The TTS models are in preview and may be unstable
2. **403 Forbidden**: API key issues or quota exceeded
3. **400 Bad Request**: Malformed request or unsupported parameters

### Content Blocking

If content is blocked, check:
- `promptFeedback.blockReason` in the response
- `candidate.finishReason` (should be "STOP" for success)
- `candidate.safetyRatings` for detailed safety assessments

### Retry Strategy

```javascript
async function generateAudioWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await callGeminiTTS(prompt);
            return response;
        } catch (error) {
            if (error.status === 500 && attempt < maxRetries - 1) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => 
                    setTimeout(resolve, 1000 * Math.pow(2, attempt))
                );
                continue;
            }
            throw error;
        }
    }
}
```

## Best Practices

1. **Model Selection**: Use `gemini-1.5-flash-latest` for more stability over preview TTS models
2. **Prompt Design**: Keep prompts clear and direct for better TTS results
3. **Error Handling**: Implement retry logic for 500 errors due to preview model instability
4. **Safety Settings**: Adjust safety thresholds based on your use case
5. **Audio Conversion**: Always convert PCM to WAV for broader browser compatibility
6. **Resource Cleanup**: Clean up audio URLs after playback to prevent memory leaks

## Rate Limits

- Check Google AI Studio for current rate limits
- TTS generation typically has lower rate limits than text-only requests
- Consider implementing queuing for high-volume applications

## Cost Considerations

- Audio generation typically costs more than text-only responses
- Monitor usage through Google Cloud Console
- Consider caching generated audio for repeated content

## Troubleshooting

### No Audio Data in Response
- Check if `responseModalities: ["AUDIO"]` is set
- Verify the model supports audio generation
- Check safety ratings for content blocks

### Poor Audio Quality
- Ensure proper PCM to WAV conversion
- Check sample rate matches (24kHz)
- Verify audio player supports the format

### Frequent 500 Errors
- TTS models are in preview and may be unstable
- Implement retry logic with exponential backoff
- Consider fallback to text-only responses 
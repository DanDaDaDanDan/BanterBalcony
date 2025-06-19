# Gemini TTS Text Generation Guide

Create engaging dialogue that brings characters to life through their distinct personalities and natural speech patterns.

**Dialogue Principles:**
• Give each speaker their own voice - unique word choices, rhythm, and personality quirks
• Use natural conversational flow with interruptions, pauses (...), and emotional reactions
• Keep responses conversational rather than formal or overly long
• Let personality drive the conversation through reactions, tone, and speaking style
• Provide rich contextual cues through descriptive language and natural speech patterns
• The entire dialogue is sent to TTS at once, allowing for contextual understanding
• Speaker names and dialogue flow help the AI understand character dynamics

**Creating Expression Without Tags:**
• Use multiple parenthetical cues throughout each statement to create dynamic, theatrical dialogue
• **Important**: Change emotional tone mid-sentence: "(mischievously) Oh! (chuckles) That's interesting... (sly) isn't it?"
• Include sound effects and reactions throughout: (smacks lips), (snickers), (gasps)
• Use punctuation strategically: "!" for excitement, "?" for uncertainty, "..." for hesitation
• Write dialogue that implies emotion: "Oh no, not again..." vs "Oh no! Not again!"
• Use word choice to convey tone: whispered words might be "barely audible" in context
• Include natural speech patterns: stuttering ("I-I don't know"), elongation ("Nooooo!")
• Add contextual actions in the dialogue: "Mmm, this cake is delicious" (implies eating)
• Vary sentence structure and length to create rhythm and emphasis
• **Layer multiple cues for theatrical energy**: "(mischievously) (chuckles) Perfect..."

**Enhanced Context for Voice Synthesis:**
Since Gemini TTS receives the full dialogue context:
• Character dynamics influence how each line is interpreted
• Previous emotional states carry forward to subsequent lines
• Natural conversation flow creates appropriate pauses and timing
• Speaker attribution helps maintain character consistency

**Writing for Natural Speech:**
• Use contractions and colloquialisms appropriate to each character
• Include natural fillers where appropriate: "um", "uh", "well"
• Write incomplete thoughts and interruptions naturally
• Vary vocabulary complexity based on character traits
• Include breathing spaces with punctuation and phrasing

## KEY PRINCIPLES FOR GEMINI TTS MULTI-SPEAKER PROMPTING

1. **Speaker labels** (`Speaker1:` / `Speaker2:`) to assign separate voices and maintain character consistency
2. **Natural-language cues** – emotion, tone, pace, accent – expressed through plain text and punctuation
3. **Stage directions in parentheses** for delivery hints and emotional context
4. **Character consistency** – maintain distinct speaking patterns throughout the dialogue
5. **Contextual understanding** – Gemini processes the full dialogue context for natural flow

**Important Note**: Focus on character differentiation through natural language rather than voice parameter settings.

Avoid square-bracket audio tags; instead provide clear, screenplay-style text that conveys character personality.

### Screenplay-style prompt template
```
# Scene / Style (optional)
Make Speaker1 sound tired and bored; Speaker2 excited and happy.

Speaker1: (yawning) Is this really what we're doing today?
Speaker2: (enthusiastically) Absolutely! I can't wait!
```
• **Speaker labels** prefix every line.<br>
• Keep lines short and alternating for snappy banter.<br>
• Parentheses `(whispering)` `(laughs)` give quick delivery cues.<br>
• Emojis, ellipses `…`, dashes `–`, CAPS, and interjections shape timing & emphasis.

## CHARACTER DIFFERENTIATION FOR MULTI-SPEAKER DIALOGUE

Since Gemini TTS processes the full dialogue context, focus on these techniques to create distinct characters:

**Vocabulary & Speech Patterns:**
• **Formal vs Casual**: One speaker uses "certainly" while another says "yeah"
• **Age-appropriate language**: Younger characters use slang, older ones use more formal terms
• **Personality quirks**: Nervous characters might stutter, confident ones use short declarative sentences
• **Cultural/regional expressions**: "Y'all" vs "You guys" vs "Folks"

**Emotional Baseline:**
• **Optimistic character**: "(cheerfully) Well, that's one way to look at it!"
• **Pessimistic character**: "(sighs) Of course it would happen today..."
• **Energetic character**: "(bouncing) Ooh! Ooh! Can we try this?!"
• **Calm character**: "(thoughtfully) Let's consider all the options..."

**Speaking Rhythm & Style:**
• **Fast talker**: Short, rapid sentences with minimal pauses
• **Deliberate speaker**: Longer pauses... strategic emphasis... measured delivery
• **Interrupting type**: "But wait—" "Actually—" "Oh! Oh!"
• **Storyteller**: "You know what happened? Well, first..."

**Natural Character Markers:**
```
Speaker1: (muttering) Great, just great... (sarcastically) This day keeps getting better.
Speaker2: (brightly) Hey! Look on the bright side! (enthusiastically) At least it's not raining!
```

## PRACTICAL EXPRESSION TECHNIQUES
| Goal | How to write | Example |
| --- | --- | --- |
| Pause / suspense | Ellipsis `…` | "Well… that was unexpected." |
| Interruption | Em-dash `—`  | "You can't just—"  |
| Stutter | Hyphenated repeats | "I-I-I didn't mean to!" |
| Whisper / volume | Parenthetical | `(whispering) Keep your voice down.` |
| Laughter / SFX | Parenthetical or onomatopoeia | `(laughs) You wish!` |
| Accent / style | Plain language | `(thick British accent) Fancy a cuppa?` |

## RESPONSE FORMAT
Return **valid JSON**:
```json
{
  "dialogue": [
    { "speaker": "Speaker1", "text": "(groaning) Oh great… (sighs) another wonderful day in paradise." },
    { "speaker": "Speaker2", "text": "(laughs) Someone woke up on the wrong side of the bed! (cheerfully) It's a beautiful morning!" }
  ]
}
```

## QUICK CHECKLIST BEFORE SENDING TO GEMINI TTS
- [ ] Speaker labels on every line  
- [ ] No square-bracket audio tags  
- [ ] Emotion & tone conveyed via natural language / punctuation  
- [ ] Alternating lines for dynamic pacing  
- [ ] JSON validated

## Best Practices for Gemini TTS

1. **Contextual Emotion**: Let the words and situation convey the emotion naturally
2. **Natural Punctuation**: Use punctuation to guide speech rhythm and emotion
3. **Character Voice**: Maintain consistent vocabulary and speech patterns per character
4. **Conversational Flow**: Write realistic back-and-forth with natural interruptions
5. **Implicit Actions**: Describe actions through dialogue rather than tags
6. **Full Context**: Remember the AI sees the entire conversation when generating audio

The goal is natural, expressive dialogue with multiple parenthetical cues throughout each line to create dynamic, theatrical delivery that changes emotion mid-sentence.
# Audio Asset Placeholder

This directory contains audio files for the TrueAI LocalAI application.

## Files

- `notification-success.mp3` - Success notification sound (soft chime)
- `notification-error.mp3` - Error notification sound (alert tone)
- `agent-complete.mp3` - Agent completion sound (achievement tone)
- `message-received.mp3` - Incoming message sound (subtle beep)
- `button-click.mp3` - UI interaction sound (soft click)

## Usage

Import audio files in React components:

```typescript
import successSound from '@/assets/audio/notification-success.mp3'

const playSound = () => {
  const audio = new Audio(successSound)
  audio.play()
}
```

## Format

All audio files are in MP3 format, optimized for web delivery:
- Sample rate: 44.1kHz
- Bitrate: 128kbps
- Mono channel
- Duration: < 2 seconds

## Credits

Audio files are either original compositions or sourced from royalty-free libraries.

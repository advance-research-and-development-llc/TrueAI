# Video Asset Placeholder

This directory contains video files for the TrueAI LocalAI application.

## Files

- `demo-agent-execution.mp4` - Demo video showing agent execution flow
- `demo-chat-interface.mp4` - Demo video of chat interface
- `demo-model-download.mp4` - Demo video of model downloading
- `tutorial-harness-install.mp4` - Tutorial on installing custom harnesses
- `background-ambient.mp4` - Ambient background video for hero sections

## Usage

Import video files in React components:

```typescript
import demoVideo from '@/assets/video/demo-agent-execution.mp4'

<video src={demoVideo} controls />
```

## Format

All video files are in MP4 format (H.264 codec):
- Resolution: 1920x1080 or 1280x720
- Frame rate: 30fps
- Bitrate: Optimized for web (2-5 Mbps)
- Duration: Varies (30s - 2min)

## Purpose

These videos serve as:
- Onboarding materials for new users
- Feature demonstrations
- Tutorial content
- Marketing materials
- Background ambiance

## Credits

Videos are either original screen recordings or sourced from royalty-free libraries.

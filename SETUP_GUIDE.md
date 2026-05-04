# LocalAI Setup Guide

## Complete Setup Instructions

### 1. Prerequisites Installation

```bash
# Install Node.js 18+ from https://nodejs.org/

# Install Expo CLI globally
npm install -g expo-cli

# Install Android Studio (for building APKs)
# Download from https://developer.android.com/studio

# Install Ollama (for local model inference)
# Download from https://ollama.ai
```

### 2. Project Installation

```bash
# Clone or download the project
cd local-ai-app

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your Supabase credentials
nano .env  # or open in your editor
```

### 3. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from Settings > API
3. Add them to `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

### 4. Ollama Setup (for model inference)

#### Option A: Local Machine
```bash
# Install Ollama from https://ollama.ai
# Run Ollama
ollama serve

# Pull a model (in another terminal)
ollama pull mistral  # or another model
ollama pull neural-chat
```

#### Option B: Android Emulator
If using Android emulator, Ollama must be accessible at `http://10.0.2.2:11434`

#### Option C: Local Network
Run Ollama on another machine and configure the IP in Settings:
- Example: `http://192.168.1.100:11434`

### 5. Running the App

#### Web Development
```bash
npm run dev
# Opens at http://localhost:8081
```

#### Android Physical Device
```bash
# Connect Android device via USB
# Enable developer mode
npm run dev
# Scan QR code with Expo Go app
```

#### Android Emulator
```bash
# Start Android emulator first
# Then run:
npm run dev
```

### 6. First Run Checklist

- [ ] Sign in or use anonymous mode
- [ ] Go to Settings > Test Ollama Connection
- [ ] Confirm "Connected" status
- [ ] Go to Models > Ollama tab
- [ ] Pull a small model (e.g., `mistral` ~4GB or `neural-chat` ~3GB)
- [ ] Go to Chat and select the downloaded model
- [ ] Send a test message and verify streaming response

## Configuration

### Ollama URLs by Platform

**Development Local Machine**
```
http://localhost:11434
```

**Android Emulator**
```
http://10.0.2.2:11434
```

**Physical Device on Local Network**
```
http://192.168.1.YOUR_COMPUTER_IP:11434
```

To find your computer's IP:
```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig | findstr "IPv4"
```

### Recommended Models by Size

| Model | Size | Speed | Quality | Quantization |
|-------|------|-------|---------|--------------|
| Neural Chat | ~3GB | Fast | Good | Q4 |
| Mistral | ~4GB | Fast | Good | Q4 |
| Llama 2 | 7B-40B | Medium | Very Good | Q4-Q8 |
| Code Llama | 7B-34B | Medium | Excellent | Q4-Q8 |

## Troubleshooting

### Ollama Connection Failed
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check firewall settings
- For Android: Ensure using correct IP (10.0.2.2 for emulator, actual IP for physical device)
- Try testing in Settings tab first

### Models Won't Download
- Check internet connection
- Verify disk space
- Try smaller models first
- Check HuggingFace/Ollama service status

### App Crashes on Startup
- Clear app cache: Settings > Apps > LocalAI > Storage > Clear Cache
- Reinstall: `npm run dev` again
- Check TypeScript compilation: `npm run typecheck`

### Messages Not Streaming
- Verify model is selected in Chat tab
- Check Ollama connection status
- Try a shorter prompt first
- Look at browser console for errors: Press F12

### Supabase Sync Not Working
- Verify EXPO_PUBLIC_SUPABASE_URL is correct
- Check ANON_KEY has proper permissions
- Ensure RLS policies are enabled
- Test in browser: curl `SUPABASE_URL/rest/v1/conversations` with headers

## Development Workflow

### Adding a New Tool to an Agent

1. Edit the agent configuration in the Agents screen
2. Implement tool handler in `lib/harness.ts` or custom harness
3. Add to `tools_enabled` array
4. Test with an agent run

### Creating a Custom Harness

1. Create manifest file:
```typescript
// my-harness.ts
export const MY_HARNESS: HarnessManifest = {
  name: 'My Tools',
  version: '1.0.0',
  harness_type: 'my-tools',
  tools: [
    {
      name: 'my_tool',
      description: 'Does something',
      parameters: { input: { type: 'string' } },
      handler: async (params) => {
        return JSON.stringify({ result: 'output' });
      }
    }
  ]
};
```

2. Export from harness index
3. User installs via Extensions tab

### Testing Agents

1. Go to Agents tab > Create Agent
2. Add name, description, system prompt
3. Select tools to enable
4. Go to Chat and select the agent
5. Send messages - agent will use tools automatically

## Performance Tips

- Keep models under 7GB for smooth inference
- Use Q4 quantization for balance of size/quality
- Close other apps to free RAM
- Use WiFi instead of mobile data
- Avoid long context windows (>4000 tokens)

## Android Build for Production

```bash
# Generate APK for distribution
expo export --platform android

# Or use EAS Build (recommended)
npm install -g eas-cli
eas login
eas build --platform android
```

## Next Steps

1. Read the main [README.md](./README.md) for architecture details
2. Explore the example harnesses in `lib/harness.ts`
3. Configure your preferred Ollama models
4. Create custom agents for your use cases
5. Develop and share custom harnesses

## Support Resources

- Expo Docs: https://docs.expo.dev
- Ollama Guide: https://github.com/ollama/ollama
- Supabase Docs: https://supabase.com/docs
- React Native Docs: https://reactnative.dev

---

Happy building! If you encounter issues, check the troubleshooting section above.

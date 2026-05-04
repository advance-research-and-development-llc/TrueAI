# LocalAI Quick Start (5 minutes)

## The Ultra-Fast Setup

### 1. Get Ollama Running (2 min)
```bash
# Download from https://ollama.ai and run it
ollama serve

# In another terminal, pull a model
ollama pull mistral
```

### 2. Install App (2 min)
```bash
cd local-ai-app
npm install
cp .env.example .env

# Edit .env with any Supabase project (or leave defaults for local-only)
# EXPO_PUBLIC_SUPABASE_URL=your_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### 3. Run (1 min)
```bash
npm run dev
# Scan QR code with Expo Go app on phone
# Or press 'w' for web browser
```

## First Test

1. **Settings Tab** → Test Ollama Connection → Should show "Connected"
2. **Models Tab** → Ollama tab → See "mistral" listed
3. **Chat Tab** → Type message → Hit send → See response stream
4. **Done!** 🎉

## What You Just Set Up

- ✅ Real-time AI chat with local models
- ✅ Automatic message streaming
- ✅ Agent system (future use)
- ✅ Extensible tool system
- ✅ Cloud sync (optional, requires Supabase)

## Next Steps

1. Download more models from Models tab (try `neural-chat` or `llama2`)
2. Go to Agents > Create Agent with custom prompt
3. Check Extensions for available tools
4. Read full docs: [README.md](./README.md)

## Common Issues

| Problem | Solution |
|---------|----------|
| Connection refused | Make sure `ollama serve` is running |
| Nothing appears | Refresh: Android - pull down, Web - F5 |
| Typing slow | Model needs more RAM, try smaller one |
| Won't download model | Check disk space + internet connection |

## Useful Ollama Commands

```bash
# List models
ollama list

# Pull another model
ollama pull neural-chat

# Remove a model
ollama rm mistral

# See model details
ollama show mistral
```

## For Android Phone Users

1. Download Expo Go from Play Store
2. Run `npm run dev` on your computer
3. Scan QR code with Expo Go
4. Enjoy full app on your phone!

## Full Documentation

- Setup details: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Architecture: [README.md](./README.md)  
- Implementation: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

**You now have a fully functional local AI app!**

# TrueAI LocalAI - Asset Directory

This directory contains all assets for the TrueAI LocalAI application, organized by type.

## Directory Structure

```
assets/
├── images/          # SVG illustrations, icons, and graphics
├── audio/           # Sound effects and notification sounds
├── video/           # Demo videos and tutorials
└── documents/       # Example data, JSON files, and documentation
```

## Assets by Feature

### Chat Interface
- `images/empty-state-chat.svg` - Empty state illustration for chat view
- `images/logo-full.svg` - Full application logo with text
- `images/hero-background.svg` - Hero section background with animated elements
- `images/background-pattern.svg` - Subtle background pattern for cards

### Autonomous Agents
- `images/empty-state-agents.svg` - Empty state for agent list
- `images/agent-executing.svg` - Animated agent execution indicator
- `documents/example-workflows.md` - Example agent workflow templates

### Model Management
- `images/empty-state-models.svg` - Empty state for model configuration
- `images/model-loading.svg` - Model loading animation
- `documents/example-gguf-models.json` - Sample GGUF model metadata
- `documents/model-providers.json` - Model provider comparison data
- `documents/quantization-reference.json` - Quantization format reference

### Fine-Tuning
- `images/empty-state-finetuning.svg` - Fine-tuning empty state illustration
- `documents/example-finetuning-datasets.json` - Sample training datasets

### Quantization
- `images/empty-state-quantization.svg` - Quantization process illustration
- `documents/quantization-reference.json` - Technical reference for quantization

### Harness/Extensions
- `images/empty-state-harness.svg` - Harness management empty state
- `documents/example-harness-manifests.json` - Example harness configurations

### Knowledge Base & RAG
- `images/empty-state-knowledge.svg` - Knowledge base empty state
- `documents/example-dataset.csv` - Sample CSV data for analysis

### Workflows
- `images/empty-state-workflow.svg` - Workflow builder empty state
- `documents/example-workflows.md` - Pre-built workflow templates

### UI Elements
- `images/icon-success.svg` - Success indicator icon
- `images/icon-error.svg` - Error indicator icon
- `images/icon-warning.svg` - Warning indicator icon
- `images/icon-info.svg` - Information indicator icon

### Documentation
- `documents/getting-started.md` - User onboarding guide
- `documents/example-workflows.md` - Workflow examples and templates

## Usage in Code

### Importing Images

```typescript
import emptyStateChat from '@/assets/images/empty-state-chat.svg'
import logoFull from '@/assets/images/logo-full.svg'

<img src={emptyStateChat} alt="No conversations yet" />
```

### Importing Documents

```typescript
import exampleModels from '@/assets/documents/example-gguf-models.json'
import exampleHarnesses from '@/assets/documents/example-harness-manifests.json'

const models = exampleModels.models
const harnesses = exampleHarnesses
```

### Importing Audio (when available)

```typescript
import successSound from '@/assets/audio/notification-success.mp3'

const audio = new Audio(successSound)
audio.play()
```

## Design Guidelines

All visual assets follow the design system:

**Colors**:
- Primary: `oklch(0.45 0.15 260)` - Deep Electric Blue
- Accent: `oklch(0.75 0.14 200)` - Neon Cyan
- Background: `oklch(0.18 0.01 260)` - Charcoal

**Typography**:
- Headings: Space Grotesk (Bold/Semibold)
- Body: IBM Plex Sans (Regular)
- Code: JetBrains Mono (Regular)

**Style**:
- Tech-forward aesthetic
- Animated elements where appropriate
- Consistent stroke widths (2px for primary, 1.5px for secondary)
- Opacity variations for depth (0.6-0.8 for main elements)
- Gradients for visual interest

## Asset Credits

- Illustrations: Original designs by TrueAI team
- Icons: Phosphor Icons library (via @phosphor-icons/react)
- Fonts: Google Fonts (Space Grotesk, IBM Plex Sans, JetBrains Mono)

## Maintenance

When adding new assets:
1. Follow the established naming convention: `[category]-[description].svg`
2. Use the design system colors and typography
3. Optimize SVGs for web (remove unnecessary metadata)
4. Update this README with the new asset
5. Ensure assets are responsive and scale well

## Performance Considerations

- All SVG files are optimized and under 5KB each
- JSON files are structured for efficient parsing
- No external dependencies or CDN links
- Assets load on-demand (lazy loading where possible)

---

Last Updated: 2024-01-15

# 🤖 Discord AI Selfbot

Advanced Discord selfbot with AI-powered responses, automatic channel monitoring, and intelligent conversation capabilities.

> ⚠️ **WARNING**
> This is a **selfbot** and violates Discord's Terms of Service.
> Use at your own risk. Account bans are possible.

---

## ✨ Features

### 🤖 AI-Powered Responses
- **Multiple AI Providers**
  - **Grok (xAI) — Recommended**
  - OpenAI GPT (GPT-4 / GPT-3.5)
  - Google Gemini
  - Custom OpenAI-compatible APIs
- **Smart Context**: Remembers recent conversation history
- **Quality Filtering**: Filters out generic or low-quality responses
- **Persona System**: Adapts responses based on channel topics (crypto, gaming, tech, etc.)
- **Multi-language Support**: English & Indonesian

### 🔍 Channel Management
- Auto channel fetch (servers & channels)
- Manual channel add by ID
- Organized server/channel listing
- Custom channel names

### ⚡ Advanced Features
- Auto GM (Good Morning) messages
- Smart reply styles (mention, reply, auto)
- Discord slow-mode awareness
- Message queue anti-spam system
- Daily per-channel limits

### 🔧 Configuration
- Interactive setup wizard
- JSON-based configuration
- Multi-account support
- Automatic API key rotation

---

## 🚀 Quick Start

### Prerequisites
- Node.js **16+**
- Discord **user account** (not bot)
- AI API key (**Grok recommended**)

### Installation

```bash
git clone https://github.com/mejri02/discord-ai-bot.git
cd discord-ai-bot
npm install
node setup.js
node main.js
```

---

## 📖 Detailed Setup Guide

### Step 1: Get Discord Token
1. Open Discord in browser
2. Press `F12`
3. Network tab
4. Send any message
5. Find `/api/v9/channels/*/messages`
6. Copy `authorization` header

---

### Step 2: Get AI API Key

#### ✅ Grok API (Recommended)
- Console: https://console.x.ai/
- Docs: https://docs.x.ai/
- Endpoint: https://api.x.ai/v1/chat/completions
- Model: `grok-beta`

**Why Grok?**
- More natural Discord-style replies
- Lower refusal rate
- Faster for chat workloads

#### OpenAI
- Platform: https://platform.openai.com/
- Docs: https://platform.openai.com/docs
- Models: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`

#### Google Gemini
- Console: https://aistudio.google.com/
- Docs: https://ai.google.dev/
- Models: `gemini-pro`, `gemini-1.5-pro`

---

## ⚙️ Configuration Files

### config.json
```json
{
  "ai": {
    "maxResponsesPerDay": 50,
    "responseChance": 0.8,
    "typingDelay": 2000,
    "historySize": 5,
    "autoSendEnabled": true,
    "personaEnabled": true
  },
  "gm": {
    "enabled": true,
    "time": "09:00",
    "timezone": "Africa/Tunis"
  }
}
```

### accounts.json
```json
[
  {
    "name": "Main Account",
    "token": "YOUR_DISCORD_TOKEN",
    "channels": [
      {
        "id": "CHANNEL_ID",
        "name": "Server / Channel Name",
        "useAI": true
      }
    ]
  }
]
```

### api_keys.json
```json
{
  "models": [
    {
      "name": "Grok API",
      "provider": "xai",
      "apiKey": "YOUR_XAI_API_KEY",
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "modelName": "grok-beta",
      "enabled": true
    }
  ]
}
```

---

## 🎮 Usage

```bash
node main.js
```

### Runtime Commands
- `status` – Show status
- `channels` – List channels
- `stats` – Response stats
- `exit` – Shutdown bot

---

## 🧠 Channel Personas

| Persona | Description |
|------|------------|
| crypto | Trading & market slang |
| gamer | Gaming discussions |
| tech | Programming & dev talk |
| music | Artists & concerts |
| movie | Movies & series |
| normal | Casual chat |

---

## 🎭 Reply Styles
- mention
- discord_reply
- smart
- random

---

## 🛡️ Security & Safety

### Built-in Protections
- Human typing delays
- Rate limiting
- Randomized response timing
- Daily quotas
- Slow-mode compliance

---

## 🐛 Troubleshooting

### Common Issues
**Invalid Token**
- Token expired → fetch a new one

**API Rate Limits**
- Add more API keys
- Enable rotation

**Bot Not Replying**
- `useAI` must be true
- Check daily limits

---

## 📁 Project Structure

```
discord-ai-bot/
├── main.js
├── setup.js
├── websocket_fallback.js
├── package.json
├── config.json
├── accounts.json
├── api_keys.json
├── README.md
└── node_modules/
```

---

## 🤝 Contributing
Pull requests welcome.

---

## 📄 License
Educational use only.

---

## ⚠️ Disclaimer
This software violates Discord's Terms of Service.
The author is not responsible for bans or misuse.

---

## 👤 Author
**mejri02**
GitHub: https://github.com/mejri02

---

## 🙏 Acknowledgments
- Discord.js community
- xAI (Grok)
- OpenAI
- Google AI

---

**Made with ❤️ by mejri02 — Use responsibly**


# ðŸ¤– Discord AI Selfbot

Advanced Discord selfbot with AI-powered responses, automatic channel monitoring, and intelligent conversation capabilities.

> âš ï¸ **WARNING**
> This is a **selfbot** and violates Discord's Terms of Service.
> Use at your own risk. Account bans are possible.

---

## âœ¨ Features

### ðŸ¤– AI-Powered Responses
- **Multiple AI Providers**
  - **Grok (xAI) â€” Recommended**
  - OpenAI GPT (GPT-4 / GPT-3.5)
  - Google Gemini
  - Custom OpenAI-compatible APIs
- **Smart Context**: Remembers recent conversation history
- **Quality Filtering**: Filters out generic or low-quality responses
- **Persona System**: Adapts responses based on channel topics (crypto, gaming, tech, etc.)
- **Multi-language Support**: English & Indonesian

### ðŸ” Channel Management
- Auto channel fetch (servers & channels)
- Manual channel add by ID
- Organized server/channel listing
- Custom channel names

### âš¡ Advanced Features
- Auto GM (Good Morning) messages
- Smart reply styles (mention, reply, auto)
- Discord slow-mode awareness
- Message queue anti-spam system
- Daily per-channel limits

### ðŸ”§ Configuration
- Interactive setup wizard
- JSON-based configuration
- Multi-account support
- Automatic API key rotation

---

## ðŸš€ Quick Start

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

## ðŸ“– Detailed Setup Guide

### Step 1: Get Discord Token
1. Open Discord in browser
2. Press `F12`
3. Network tab
4. Send any message
5. Find `/api/v9/channels/*/messages`
6. Copy `authorization` header

---

### Step 2: Get AI API Key

#### âœ… Grok API (Recommended)
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

## âš™ï¸ Configuration Files

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

## ðŸŽ® Usage

```bash
node main.js
```

### Runtime Commands
- `status` â€“ Show status
- `channels` â€“ List channels
- `stats` â€“ Response stats
- `exit` â€“ Shutdown bot

---

## ðŸ§  Channel Personas

| Persona | Description |
|------|------------|
| crypto | Trading & market slang |
| gamer | Gaming discussions |
| tech | Programming & dev talk |
| music | Artists & concerts |
| movie | Movies & series |
| normal | Casual chat |

---

## ðŸŽ­ Reply Styles
- mention
- discord_reply
- smart
- random

---

## ðŸ›¡ï¸ Security & Safety

### Built-in Protections
- Human typing delays
- Rate limiting
- Randomized response timing
- Daily quotas
- Slow-mode compliance

---

## ðŸ› Troubleshooting

### Common Issues
**Invalid Token**
- Token expired â†’ fetch a new one

**API Rate Limits**
- Add more API keys
- Enable rotation

**Bot Not Replying**
- `useAI` must be true
- Check daily limits

---

## ðŸ“ Project Structure

```
discord-ai-bot/
â”œâ”€â”€ main.js
â”œâ”€â”€ setup.js
â”œâ”€â”€ websocket_fallback.js
â”œâ”€â”€ package.json
â”œâ”€â”€ config.json
â”œâ”€â”€ accounts.json
â”œâ”€â”€ api_keys.json
â”œâ”€â”€ README.md
â””â”€â”€ node_modules/
```

---

## ðŸ¤ Contributing
Pull requests welcome.

---

## ðŸ“„ License
Educational use only.

---

## âš ï¸ Disclaimer
This software violates Discord's Terms of Service.
The author is not responsible for bans or misuse.

---

## ðŸ‘¤ Author
**mejri02**
GitHub: https://github.com/mejri02

---

## ðŸ™ Acknowledgments
- Discord.js community
- xAI (Grok)
- OpenAI
- Google AI

---

**Made with â¤ï¸ by mejri02 â€” Use responsibly**

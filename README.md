# Discord AI Bot

A sophisticated Discord selfbot that uses AI to respond naturally in conversations, mimicking human behavior with context awareness, persona adaptation, and intelligent response patterns.

**⚠️ IMPORTANT DISCLAIMER**: Using selfbots violates Discord's Terms of Service. This project is for educational purposes only. Use at your own risk. Your account may be banned.

## Features

- 🤖 **AI-Powered Responses**: Integrates with multiple AI providers (Grok, OpenAI, Google Gemini)
- 🎭 **Dynamic Personas**: Adapts conversation style based on channel context (crypto, gaming, tech, music, movies)
- 💬 **Natural Behavior**:
  - Random response delays and typing indicators
  - Smart reply detection (mentions, replies, general messages)
  - Quality filtering to avoid repetitive or generic responses
  - Context-aware responses using message history
  - Human-like disfluencies (um, well, like) and self-corrections
  - Configurable typo injection for realism
  - Variable typing speed simulation
- 🔄 **Advanced Features**:
  - API key rotation for rate limit handling
  - Message queuing system
  - Slow mode detection and respect
  - User context memory and profiles
  - Auto-send messages periodically
  - Daily "GM" (good morning) scheduler
  - SQLite conversation database
  - Topic detection
  - Emoji reaction support
- 🛡️ **Safety Features**:
  - Response quality filters
  - Cooldown management (global, per-channel, per-user)
  - Daily response limits
  - Banned words/phrase detection
  - Max replies per user limit

## Requirements

- Node.js (v16 or higher)
- npm or yarn
- Discord user account token
- AI API key (Grok, OpenAI, or Google Gemini)

## Installation

```bash
# Clone the repository
git clone https://github.com/mejri02/discord-ai-bot.git
cd discord-ai-bot

# Install dependencies
npm install
```

### Required Dependencies

```bash
npm install discord.js-selfbot-v13 axios node-cron
```

## Setup

### Method 1: Automated Setup (Recommended)

Run the interactive setup wizard:

```bash
node setup.js
```

**Setup Menu Options:**

| Option | Description |
|--------|-------------|
| 1 | Complete Auto Setup (Recommended) |
| 2 | Quick Setup (Config + Discord + AI) |
| 3 | Fetch Channels Automatically |
| 4 | Add Channel Manually |
| 5 | Configure Multiple Accounts |
| 6 | Configure Channel Personas |
| 7 | View Current Configuration |
| 8 | Start Bot |
| 9 | Exit |

**Complete Auto Setup Steps:**

1. **Select Option 1**: Complete Auto Setup
   - Creates all necessary configuration files with enhanced defaults
   - Guides you through Discord token setup
   - Configures AI API settings
   - Automatically fetches and adds channels

2. **Discord Token Setup**:
   - Open Discord in your browser (Chrome/Firefox)
   - Press `F12` to open Developer Tools
   - Go to the **Network** tab
   - Send any message in Discord
   - Find a request to `messages` in the network log
   - Look for the `authorization` header in Request Headers
   - Copy the token (starts with something like `MTI...`)
   - Paste it when prompted

3. **AI Provider Setup**:
   Choose your preferred AI provider:
   - **Option 1**: Grok API (xAI) — Get key from https://console.x.ai/
   - **Option 2**: OpenAI — Get key from https://platform.openai.com/
   - **Option 3**: Google Gemini — Get key from https://aistudio.google.com/
   - **Option 4**: Custom API endpoint

   After selecting a provider, you'll be prompted to add additional API keys for rotation (up to 5 extra keys).

4. **Channel Selection**:
   - The bot will validate your token and fetch all your servers
   - Select a server by number
   - Choose channels to monitor (individual numbers or "all")
   - Assign custom names to channels if desired
   - Optionally configure per-channel personas
   - Continue adding channels from other servers or finish setup

### Method 2: Manual Setup

#### Step 1: Create Configuration Files

Create `config.json`:

```json
{
  "ai": {
    "maxResponsesPerDay": 50,
    "cooldownMinutes": 0.5,
    "channelCooldownMinutes": 1,
    "userCooldownMinutes": 0.5,
    "minMessageLength": 3,
    "skipRate": 0.20,
    "responseChance": 0.60,
    "maxRepliesPerUser": 3,
    "typingDelay": 2000,
    "historySize": 5,
    "autoSendEnabled": true,
    "autoSendChance": 0.50,
    "autoSendInterval": 900000,
    "respondToGeneral": 0.40,
    "respondToMention": 0.90,
    "respondToOtherMention": 0.05,
    "minReplyWords": 2,
    "maxReplyWords": 15,
    "replyStyle": "smart",
    "respectSlowMode": true,
    "promptLanguage": "en",
    "useMessageFile": false,
    "apiKeyRotation": true,
    "maxSlowMode": 300,
    "qualityFilter": true,
    "personaEnabled": true,
    "queueEnabled": true,
    "addTypos": true,
    "typoChance": 0.15,
    "varyTypingSpeed": true,
    "typingVariation": 0.3,
    "addReactions": true,
    "reactionChance": 0.3,
    "maxReactionsPerUser": 5,
    "databaseEnabled": true,
    "bannedWordsEnabled": true,
    "disfluenciesEnabled": true,
    "selfCorrectionEnabled": true,
    "topicDetection": true,
    "userProfiles": true
  },
  "gm": {
    "enabled": true,
    "time": "09:00",
    "timezone": "Africa/Tunis",
    "message": "gm"
  },
  "api": {
    "retryCount": 3,
    "timeout": 5000,
    "maxTokens": 35,
    "temperature": 0.7,
    "top_p": 0.9
  }
}
```

#### Step 2: Create Accounts Configuration

Create `accounts.json`:

```json
[
  {
    "name": "Main Bot",
    "token": "YOUR_DISCORD_TOKEN_HERE",
    "channels": [
      {
        "id": "CHANNEL_ID_HERE",
        "name": "Server Name / Channel Name",
        "persona": "normal",
        "useAI": true
      }
    ]
  }
]
```

**How to get Channel ID:**
1. Enable Developer Mode in Discord: Settings → Advanced → Developer Mode
2. Right-click on any channel → Copy ID

#### Step 3: Create API Keys Configuration

Create `api_keys.json`:

**For Grok (xAI):**
```json
{
  "models": [
    {
      "name": "Grok API",
      "provider": "xai",
      "apiKey": "YOUR_GROK_API_KEY",
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "modelName": "grok-beta",
      "enabled": true
    }
  ]
}
```

**For OpenAI:**
```json
{
  "models": [
    {
      "name": "OpenAI GPT-3.5",
      "provider": "openai",
      "apiKey": "YOUR_OPENAI_API_KEY",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "modelName": "gpt-3.5-turbo",
      "enabled": true
    }
  ]
}
```

**For Google Gemini:**
```json
{
  "models": [
    {
      "name": "Google Gemini",
      "provider": "google",
      "apiKey": "YOUR_GOOGLE_API_KEY",
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      "modelName": "gemini-pro",
      "enabled": true
    }
  ]
}
```

**Multiple APIs (Recommended for rotation):**
```json
{
  "models": [
    {
      "name": "Grok API",
      "provider": "xai",
      "apiKey": "YOUR_GROK_KEY",
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "modelName": "grok-beta",
      "enabled": true
    },
    {
      "name": "OpenAI GPT-3.5",
      "provider": "openai",
      "apiKey": "YOUR_OPENAI_KEY",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "modelName": "gpt-3.5-turbo",
      "enabled": true
    }
  ]
}
```

## Running the Bot

### Start the Bot

```bash
node main.js
```

Then select:
- **Option 1**: Start bot — Runs the bot with current configuration
- **Option 2**: Fetch channels — Interactive channel selection and management

### Commands While Running

- Type `fetch` — Get instructions to fetch new channels (requires restart)
- Type `exit` — Shutdown the bot gracefully
- Press `Ctrl+C` — Force stop the bot

## Configuration Guide

### AI Behavior Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxResponsesPerDay` | 50 | Maximum AI responses per channel daily |
| `cooldownMinutes` | 0.5 | Global cooldown between responses (minutes) |
| `channelCooldownMinutes` | 1 | Per-channel cooldown (minutes) |
| `userCooldownMinutes` | 0.5 | Per-user cooldown (minutes) |
| `maxRepliesPerUser` | 3 | Max consecutive replies to one user |
| `responseChance` | 0.60 | Probability of responding (0–1) |
| `skipRate` | 0.20 | Chance to skip responding for realism |
| `typingDelay` | 2000 | Delay before sending (milliseconds) |
| `historySize` | 5 | Number of messages to remember |

### Response Triggers

| Setting | Default | Description |
|---------|---------|-------------|
| `respondToMention` | 0.90 | Respond when directly mentioned |
| `respondToGeneral` | 0.40 | Respond to general messages |
| `respondToOtherMention` | 0.05 | Respond when others are mentioned |

### Reply Style Options

| Style | Behavior |
|-------|----------|
| `smart` | Intelligently chooses between mention and reply based on message age |
| `mention` | Always mentions the user |
| `discord_reply` | Always uses Discord's reply feature |
| `random` | Randomly chooses reply style |

### Persona System

The bot adapts its language based on channel names or per-channel configuration:

- **Crypto Channels** (`crypto`, `trading`, `bitcoin`, `eth`): Uses crypto slang (moon, HODL, diamond hands)
- **Gaming Channels** (`game`, `play`, `rank`): Gaming terminology (gg, op, nerf, buff)
- **Tech Channels** (`tech`, `code`, `program`): Technical jargon (npm, debugging, bugs)
- **Music Channels** (`music`, `song`, `band`): Music-related terms (vibes, playlist, beat)
- **Movie Channels** (`movie`, `film`, `netflix`): Film terminology (plot twist, spoilers, CGI)

Personas can be assigned per channel during setup (Option 6) or manually in `accounts.json` via the `persona` field. Disable personas globally by setting `personaEnabled: false` in `config.json`.

### Human-like Behavior Features

#### Typos
```json
{
  "addTypos": true,
  "typoChance": 0.15
}
```
Randomly injects realistic typos into responses to mimic human typing.

#### Variable Typing Speed
```json
{
  "varyTypingSpeed": true,
  "typingVariation": 0.3
}
```
Varies the typing indicator duration to simulate natural typing speed fluctuations.

#### Disfluencies & Self-Corrections
```json
{
  "disfluenciesEnabled": true,
  "selfCorrectionEnabled": true
}
```
Adds filler words (um, well, like) and occasional self-corrections (wait no, i mean) for natural-sounding messages.

#### Reactions
```json
{
  "addReactions": true,
  "reactionChance": 0.3,
  "maxReactionsPerUser": 5
}
```
Randomly reacts to messages with emoji, capped per user to avoid spam.

### Database & Memory

```json
{
  "databaseEnabled": true,
  "userProfiles": true,
  "topicDetection": true
}
```

When enabled, conversation history is stored in per-account SQLite databases (`conversations_<account>.db`). User profiles track preferences and past interactions. Topic detection adjusts response style based on what's being discussed.

### Auto-Send Feature

Periodically sends messages to keep channels active:

```json
{
  "autoSendEnabled": true,
  "autoSendChance": 0.50,
  "autoSendInterval": 900000
}
```

- `autoSendEnabled`: Enable/disable auto-sending
- `autoSendChance`: Probability of auto-send (0–1)
- `autoSendInterval`: Time between attempts (milliseconds)

### GM (Good Morning) Scheduler

Automatically sends morning greetings:

```json
{
  "gm": {
    "enabled": true,
    "time": "09:00",
    "timezone": "Africa/Tunis",
    "message": "gm"
  }
}
```

Random variations will be used if message is `"gm"`: gm, gm frens, good morning, gm all, morning, etc.

## Advanced Features

### API Key Rotation

Enable automatic rotation to handle rate limits:

```json
{
  "ai": {
    "apiKeyRotation": true
  }
}
```

When a key hits a rate limit (429 error), it is automatically cycled out for 24 hours. Add multiple keys in `api_keys.json` or via the setup wizard (supports up to 5 extra keys per provider).

### Quality Filtering

Filters out low-quality responses:

```json
{
  "ai": {
    "qualityFilter": true
  }
}
```

Blocks repetitive greetings, generic one-word responses, duplicate messages, and overly repetitive content.

### Banned Words

```json
{
  "bannedWordsEnabled": true
}
```

Prevents the bot from sending messages containing configured forbidden phrases.

### Message Queue System

Prevents spam and maintains natural flow:

```json
{
  "ai": {
    "queueEnabled": true
  }
}
```

### Slow Mode Respect

Automatically detects and respects channel slow mode:

```json
{
  "ai": {
    "respectSlowMode": true,
    "maxSlowMode": 300
  }
}
```

### Multi-Account Support

Use Option 5 in the setup menu to configure up to 3 Discord accounts, each with their own channel list.

```json
[
  {
    "name": "Bot 1",
    "token": "TOKEN_1",
    "channels": []
  },
  {
    "name": "Bot 2",
    "token": "TOKEN_2",
    "channels": []
  }
]
```

## Troubleshooting

### Bot doesn't respond

1. Check if AI is enabled for the channel (`useAI: true` in `accounts.json`)
2. Verify API keys are valid in `api_keys.json`
3. Check response chance settings aren't too low
4. Ensure bot has read/send permissions in the channel

### "All API keys rate limited" error

- Wait 24 hours for rate limits to reset
- Add more API keys to `api_keys.json` or via setup Option 1
- Reduce `maxResponsesPerDay` in `config.json`

### Invalid Discord token

1. Token may have expired — get a new one using the F12 method
2. Ensure no extra spaces in the token
3. Token must start with the account type prefix

### Installation errors

```bash
# Try clearing cache and reinstalling
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Project Structure

```
discord-ai-bot/
├── main.js                        # Main bot logic
├── setup.js                       # Interactive setup wizard
├── config.json                    # Bot behavior configuration
├── accounts.json                  # Discord accounts and channels
├── api_keys.json                  # AI API credentials
├── package.json                   # Node.js dependencies
├── conversations_<account>.db     # SQLite conversation database (auto-created)
└── README.md                      # This file
```

## Safety & Best Practices

1. **Never share your Discord token** — It provides full access to your account
2. **Never share your API keys** — They can incur charges on your account
3. **Use a test/alt account** — Don't risk your main Discord account
4. **Monitor bot behavior** — Ensure it's not spamming or breaking server rules
5. **Respect rate limits** — Don't set response rates too high
6. **Stay within ToS** — Remember selfbots violate Discord ToS

## Legal Disclaimer

This project is provided for **educational purposes only**. The authors and contributors:

- Do not encourage violation of Discord's Terms of Service
- Are not responsible for any account bans or restrictions
- Are not liable for any misuse of this software
- Recommend using official Discord bots through the Bot API instead

**Use at your own risk.**

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License — see the LICENSE file for details.

## Credits

Created by [mejri02](https://github.com/mejri02)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Read through the troubleshooting section

---

**Remember**: Using selfbots violates Discord's Terms of Service. This is an educational project. Use responsibly and at your own risk.

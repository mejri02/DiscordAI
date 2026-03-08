# Discord AI Bot

A sophisticated Discord selfbot that uses AI to respond naturally in conversations, mimicking human behavior with context awareness, persona adaptation, anti-detection systems, and intelligent response patterns.

**⚠️ IMPORTANT DISCLAIMER**: Using selfbots violates Discord's Terms of Service. This project is for educational purposes only. Use at your own risk. Your account may be banned.

## Features

- 🤖 **AI-Powered Responses**: Integrates with multiple AI providers (Grok, OpenAI, Google Gemini)
- 🎭 **Dynamic Personas**: Adapts conversation style based on channel context (crypto, gaming, tech, music, movies, anime, food, sports)
- 💬 **Natural Human Behavior**:
  - Read delay before typing — simulates actually reading the message first
  - Random response delays and realistic typing indicators
  - Smart reply detection (mentions, replies, general messages)
  - Context-aware responses using message history
  - Human-like disfluencies (um, well, like) and self-corrections
  - Configurable typo injection for realism
  - Variable typing speed simulation
  - Natural conversation fade instead of hard reply cut-offs
- 🛡️ **Anti-Detection System**:
  - Sleep schedule — goes offline during configurable night hours
  - Random AFK breaks (30–90 minutes) during the day
  - Delayed emoji reactions (15–120 seconds after the message)
  - Hourly response budget to avoid activity spikes
  - Burst protection — skips replies when a channel is moving too fast
  - Per-channel cooldowns with randomized jitter
  - "Are you a bot?" interceptor with natural human denials
  - Hardened AI prompt that resists bot self-disclosure
- 🔄 **Advanced Features**:
  - API key rotation for rate limit handling
  - Message queuing system with burst protection
  - User context memory and profiles
  - Auto-send messages by reacting to real past messages (not invented topics)
  - SQLite conversation database
  - Topic and sentiment detection
  - Delayed emoji reaction support
  - Heartbeat logging every 5 minutes
- 📊 **Smart Response Logic**:
  - Near-certain replies to direct mentions (95%)
  - Progressive reply fade instead of hard user limits
  - Per-user cooldown starts only after a reply is sent
  - Channel cooldown with ±30% jitter variance

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
npm install discord.js-selfbot-v13 axios node-cron sqlite3 sentiment
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
   - **Option 1**: ⭐ Groq (Recommended) — Free, very fast. Get key from https://console.groq.com/keys
   - **Option 2**: Grok API (xAI) — Get key from https://console.x.ai/
   - **Option 3**: OpenAI — Get key from https://platform.openai.com/
   - **Option 4**: Google Gemini — Get key from https://aistudio.google.com/
   - **Option 5**: Custom API endpoint

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
    "maxResponsesPerDay": 3000,
    "channelCooldownMinutes": 2,
    "userCooldownMinutes": 2,
    "minMessageLength": 3,
    "skipRate": 0.2,
    "responseChance": 0.35,
    "respondToGeneral": 0.25,
    "maxRepliesPerUser": 4,
    "typingDelay": 3500,
    "varyTypingSpeed": true,
    "typingVariation": 0.4,
    "historySize": 8,
    "minReplyWords": 2,
    "maxReplyWords": 20,
    "replyStyle": "smart",
    "autoSendEnabled": true,
    "autoSendChance": 0.15,
    "autoSendInterval": 1800000,
    "quietThreshold": 300,
    "addReactions": true,
    "reactionChance": 0.15,
    "maxReactionsPerUser": 3,
    "addTypos": true,
    "personaEnabled": true,
    "queueEnabled": true,
    "apiKeyRotation": true,
    "databaseEnabled": true,
    "userProfiles": true,
    "sleepScheduleEnabled": true,
    "sleepStart": 1,
    "sleepEnd": 8,
    "sleepTimezoneOffset": 1,
    "randomAfkEnabled": true
  },
  "api": {
    "retryCount": 3,
    "timeout": 8000,
    "maxTokens": 40,
    "temperature": 0.85,
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

> ⭐ **Recommended: Groq** — Free tier, extremely fast inference, no credit card required. Get your key at https://console.groq.com/keys

**For Groq (Recommended):**
```json
{
  "models": [
    {
      "name": "Groq Llama",
      "provider": "openai",
      "apiKey": "YOUR_GROQ_API_KEY",
      "endpoint": "https://api.groq.com/openai/v1/chat/completions",
      "modelName": "llama-3.1-8b-instant",
      "enabled": true
    }
  ]
}
```

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
      "name": "Groq Llama",
      "provider": "openai",
      "apiKey": "YOUR_GROQ_KEY",
      "endpoint": "https://api.groq.com/openai/v1/chat/completions",
      "modelName": "llama-3.1-8b-instant",
      "enabled": true
    },
    {
      "name": "Groq Llama Key 2",
      "provider": "openai",
      "apiKey": "YOUR_SECOND_GROQ_KEY",
      "endpoint": "https://api.groq.com/openai/v1/chat/completions",
      "modelName": "llama-3.1-8b-instant",
      "enabled": true
    },
    {
      "name": "Google Gemini",
      "provider": "google",
      "apiKey": "YOUR_GOOGLE_KEY",
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      "modelName": "gemini-pro",
      "enabled": true
    }
  ]
}
```
> 💡 Tip: You can create multiple free Groq accounts to get more API keys for rotation.

## Running the Bot

```bash
node main.js
```

Then select:
- **Option 1**: Start bot — Runs the bot with current configuration
- **Option 2**: Fetch channels — Interactive channel selection and management

## Configuration Guide

### AI Behavior Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxResponsesPerDay` | 3000 | Maximum AI responses per account daily |
| `channelCooldownMinutes` | 2 | Per-channel cooldown with ±30% jitter |
| `userCooldownMinutes` | 2 | Per-user cooldown — starts only after a reply is sent |
| `minMessageLength` | 3 | Ignore messages shorter than this |
| `skipRate` | 0.2 | Extra random chance to skip a reply for realism |
| `responseChance` | 0.35 | Base probability of responding to general messages |
| `respondToGeneral` | 0.25 | Chance to reply to messages not directed at the bot |
| `maxRepliesPerUser` | 4 | Replies before fade starts (not a hard cut-off) |
| `typingDelay` | 3500 | Base typing delay in milliseconds |
| `historySize` | 8 | Number of past messages used for context |

### Anti-Detection Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sleepScheduleEnabled` | true | Enable offline sleep window |
| `sleepStart` | 1 | Hour to go offline (24h, local time) |
| `sleepEnd` | 8 | Hour to come back online (24h, local time) |
| `sleepTimezoneOffset` | 1 | UTC offset for your timezone (Tunisia = UTC+1) |
| `randomAfkEnabled` | true | Enable random 30–90 min AFK breaks during the day |
| `reactionChance` | 0.15 | Chance to react — reactions are delayed 15–120 seconds |
| `maxReactionsPerUser` | 3 | Max reactions per user to avoid looking spammy |

### Response Triggers

| Setting | Default | Description |
|---------|---------|-------------|
| `respondToGeneral` | 0.25 | Chance to reply to general chat messages |
| Direct mentions | 95% | Always near-certain — hardcoded, ignoring a mention looks suspicious |

### Reply Style Options

| Style | Behavior |
|-------|----------|
| `smart` | Intelligently chooses between mention and reply based on context |
| `mention` | Always mentions the user |
| `discord_reply` | Always uses Discord's reply feature |

### Persona System

The bot adapts its language based on channel names or per-channel configuration:

- **Crypto** (`crypto`, `trading`, `finance`): Crypto slang and trading talk
- **Gaming** (`game`, `gaming`, `play`): Gaming terminology
- **Tech** (`tech`, `code`, `dev`): Technical jargon, kept casual
- **Music** (`music`, `songs`, `beats`): Music-related terms and vibes
- **Movie** (`movie`, `film`, `tv`): Film and series references
- **Food** (`food`, `cooking`, `recipes`): Food and eating talk
- **Anime** (`anime`, `manga`): Anime references and shows
- **Sports** (`sports`, `ball`): Sports scores and player talk
- **Casual** (`general`, `chat`, `lounge`): Normal chill conversation

Personas can be assigned per channel in `accounts.json` via the `persona` field. Disable globally with `personaEnabled: false`.

### Human-like Behavior Features

#### Read Delay
Before the typing indicator fires, the bot waits 1.5–8 seconds scaled to message length — simulating actually reading the message first.

#### Typos
```json
{ "addTypos": true }
```
Randomly injects realistic typos (common word substitutions and letter swaps).

#### Variable Typing Speed
```json
{ "varyTypingSpeed": true, "typingVariation": 0.4 }
```
Varies typing indicator duration to simulate natural speed fluctuations.

#### Disfluencies & Self-Corrections
Always active — adds filler words (um, well, like) and occasional self-corrections (wait no, i mean).

#### Delayed Reactions
```json
{ "addReactions": true, "reactionChance": 0.15, "maxReactionsPerUser": 3 }
```
Reacts to messages after a 15–120 second delay, not instantly. Capped per user to avoid spam.

#### Sleep Schedule
```json
{
  "sleepScheduleEnabled": true,
  "sleepStart": 1,
  "sleepEnd": 8,
  "sleepTimezoneOffset": 1
}
```
The bot goes completely silent during the configured night window. Channel messages are still logged — only replies are blocked.

#### Random AFK Breaks
```json
{ "randomAfkEnabled": true }
```
~4% chance per message event to trigger a random 30–90 minute silence. Resets automatically.

#### "Are You a Bot?" Intercept
Automatically detected and handled with casual human denials (`lol no`, `bruh no`, `nah im real`, etc.) without involving the AI.

#### Hourly Budget Enforcement
With 3000 responses/day and ~16 active hours, the bot enforces a per-hour rate limit. If it exceeds 1.5× the hourly average it pauses automatically to avoid suspicious activity spikes.

#### Burst Protection
If 3+ messages queue up in a channel simultaneously, overflow is dropped. Real people don't reply to every message in a fast conversation.

#### Conversation Fade
Instead of replying exactly N times then going completely silent, the bot progressively reduces its reply chance after `maxRepliesPerUser` — 50% → 25% → 12.5% — so conversations end naturally.

### Database & Memory

```json
{ "databaseEnabled": true, "userProfiles": true }
```

Conversation history is stored in per-account SQLite databases (`conversations_<account>.db`). User profiles track preferences and past interactions for more contextual replies.

### Auto-Send Feature

```json
{
  "autoSendEnabled": true,
  "autoSendChance": 0.15,
  "autoSendInterval": 1800000,
  "quietThreshold": 300
}
```

Checks every 30 minutes if a channel has been quiet. When triggered, the bot reacts to something that was actually said recently — not an invented topic — so it looks like catching up after being away.

- `autoSendChance`: Probability of sending (15% by default — conservative)
- `autoSendInterval`: Time between checks in milliseconds (1800000 = 30 min)
- `quietThreshold`: Seconds of silence before auto-send can trigger (300 = 5 min)

### API Key Rotation

```json
{ "apiKeyRotation": true }
```

When a key hits a rate limit (429 error), it is automatically cycled out. Add multiple keys in `api_keys.json` for more coverage. All keys reset daily.

### Message Queue System

```json
{ "queueEnabled": true }
```

Prevents spam and maintains natural flow. Maximum 2 pending replies per channel — overflow is dropped when chat is moving fast.

## Troubleshooting

### Bot is running but shows no messages

Check if you're inside the sleep window. By default the bot sleeps 1am–8am local time. Channel messages are always logged — if you see nothing at all, check that the channel IDs in `accounts.json` match your actual channels.

### Bot doesn't respond to messages it can see

1. Check `useAI: true` is set for that channel in `accounts.json`
2. Verify API keys are valid in `api_keys.json`
3. Check `responseChance` and `respondToGeneral` aren't set too low
4. Confirm the account has read/send permissions in the channel
5. The bot may be in an AFK break — wait a few minutes

### "All API keys rate limited" error

- Wait for rate limits to reset (usually 1 hour)
- Add more API keys to `api_keys.json`
- Lower `maxResponsesPerDay` in `config.json`

### Invalid Discord token

1. Token may have expired — get a new one using the F12 method
2. Ensure no extra spaces in the token
3. Token must be the full string starting with the account prefix

### Installation errors

```bash
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

1. **Never share your Discord token** — it provides full access to your account
2. **Never share your API keys** — they can incur charges
3. **Use an alt account** — don't risk your main Discord account
4. **Keep `responseChance` and `respondToGeneral` low** — less activity = less suspicion
5. **Enable the sleep schedule** — accounts that never go offline are suspicious
6. **Don't run in too many channels at once** — focus on 2–3 per account
7. **Monitor the logs** — watch for rate limit warnings or blocked messages

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

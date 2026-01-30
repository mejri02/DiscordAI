# 🤖 Discord AI Selfbot

Advanced Discord **selfbot** with AI-powered responses, automatic channel monitoring, and flexible provider support.

> ⚠️ **Important Warning**
> This project uses a **Discord selfbot**, which **violates Discord’s Terms of Service**.
> Use this **only on test / throwaway accounts**.
> The author and contributors are **not responsible** for bans or account termination.

---

## ✨ Features

- 🤖 AI-powered auto replies in selected channels
- 🔌 Supports multiple AI providers (Groq, OpenAI, Gemini, OpenAI-compatible)
- 🧠 Per-channel AI toggle
- ⚙️ Interactive setup wizard (`setup.js`)
- 🛠️ Manual configuration supported

---

## 📦 Requirements

- Node.js v18+
- Discord account
- AI API key

---

## 🚀 Installation

```bash
git clone https://github.com/mejri02/DiscordAI.git
cd DiscordAI
npm install
```

---

## ⚡ Automatic Setup

```bash
node setup.js
```

---

## 🛠️ Manual Setup

Edit `config.json` (fully editable).

```json
{
  "users": [
    {
      "name": "Saddem",
      "token": "YOUR_DISCORD_TOKEN",
      "aiProvider": "groq",
      "apiKey": "YOUR_API_KEY",
      "model": "llama3-70b-8192",
      "systemPrompt": "You are helpful.",
      "channels": [
        { "id": "1338212212845707390", "name": "x1", "useAI": true }
      ]
    }
  ]
}
```

---

## ▶️ Run

```bash
node main.js
```

---

## 🔐 Security

Never commit tokens. Use `.gitignore`.

---

## 📜 Disclaimer

Educational use only.

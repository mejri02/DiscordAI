const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const Sentiment = require('sentiment');

const DiscordClient = require('discord.js-selfbot-v13').Client;
console.log('✅ Using discord.js-selfbot-v13');

const sentiment = new Sentiment();

const logger = {
    info: (msg) => console.log(`${new Date().toISOString()} [info]: ${msg}`),
    error: (msg) => console.log(`${new Date().toISOString()} [error]: ${msg}`)
};

let activeClients = [];
let aiConfig = {};
let botConfig = {};
let dailyResponseCount = {};
let lastChannelResponse = {};
let messageHistory = {};
let usedApiKeys = new Set();
let lastGeneratedText = null;
const cooldownTime = 86400;
let messageQueue = {};
let channelPersonas = {};
let userContextMemory = {};
let userTypingPatterns = {};
let userMessageCount = {};
let sentResponses = new Set();
let skippedChannels = new Set();
let dbConnections = {};
let userProfiles = {};
let pendingReplies = {};
let channelCache = new Map();
let rateLimiters = {};
let channelLastMessageTime = {};

let HUMAN_PROMPT = "";

const bannedWords = ['hi', 'fire', 'hello', 'lit', 'blaze'];

const topics = {
    gaming: ['game', 'play', 'console', 'pc', 'xbox', 'playstation', 'controller', 'gamer'],
    music: ['song', 'album', 'artist', 'band', 'concert', 'beats', 'tune'],
    movies: ['film', 'movie', 'cinema', 'actor', 'director', 'scene', 'plot'],
    tech: ['code', 'tech', 'software', 'hardware', 'gadget', 'app', 'update'],
    food: ['food', 'eat', 'cook', 'recipe', 'snack', 'meal', 'yummy'],
    anime: ['anime', 'manga', 'episode', 'series', 'character', 'aot', 'naruto', 'one piece']
};

const moods = {
    excited: { emoji: ['!', 'awesome', 'great'], multiplier: 1.2 },
    chill: { emoji: ['😌', 'cool', 'nice'], multiplier: 1.0 },
    sarcastic: { emoji: ['🙄', 'oh really', 'sure'], multiplier: 0.9 },
    joking: { emoji: ['😂', 'lol', 'funny'], multiplier: 1.1 },
    lazy: { emoji: ['😴', 'whatever', 'maybe'], multiplier: 0.8 },
    paranoid: { emoji: ['👀', 'you sure', 'hmm'], multiplier: 0.95 }
};

class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.timeWindow);
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        return false;
    }
}

function initDatabase(accountName) {
    const dbName = `conversations_${accountName.replace(/\s+/g, '_')}.db`;
    try {
        const db = new sqlite3.Database(dbName);
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
                author TEXT,
                content TEXT,
                bot_response TEXT,
                timestamp INTEGER,
                topic TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                profile_data TEXT,
                last_seen INTEGER
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS channel_cache (
                channel_id TEXT PRIMARY KEY,
                server_name TEXT,
                channel_name TEXT,
                last_updated INTEGER
            )`);
        });
        logger.info(`📊 Database initialized: ${dbName}`);
        return db;
    } catch (error) {
        logger.error(`Database error: ${error.message}`);
        return null;
    }
}

function addToMemory(accountId, messageId, author, content, botResponse = null, topic = 'general') {
    if (!dbConnections[accountId]) return;
    
    try {
        const db = dbConnections[accountId];
        db.run(
            `INSERT OR IGNORE INTO memory (message_id, author, content, bot_response, timestamp, topic)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [messageId || 'none', author, content, botResponse, Date.now(), topic]
        );
        
        db.run(`DELETE FROM memory WHERE timestamp < ?`, [Date.now() - 86400000]);
    } catch (error) {
        logger.error(`Memory add error: ${error.message}`);
    }
}

function getMemoryContext(accountId, limit = 10) {
    if (!dbConnections[accountId]) return '';
    
    return new Promise((resolve) => {
        try {
            dbConnections[accountId].all(
                `SELECT author, content FROM memory ORDER BY timestamp DESC LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err || !rows) resolve('');
                    resolve(rows.map(r => `${r.author}: ${r.content}`).join('\n'));
                }
            );
        } catch {
            resolve('');
        }
    });
}

function hasResponded(accountId, messageId) {
    if (!dbConnections[accountId]) return false;
    
    return new Promise((resolve) => {
        dbConnections[accountId].get(
            `SELECT bot_response FROM memory WHERE message_id = ?`,
            [messageId],
            (err, row) => {
                if (err || !row) resolve(false);
                resolve(!!(row && row.bot_response));
            }
        );
    });
}

function loadUserProfiles(accountId) {
    if (!dbConnections[accountId]) return {};
    
    return new Promise((resolve) => {
        dbConnections[accountId].all(
            `SELECT user_id, profile_data FROM user_profiles`,
            [],
            (err, rows) => {
                if (err || !rows) resolve({});
                const profiles = {};
                rows.forEach(row => {
                    try {
                        profiles[row.user_id] = JSON.parse(row.profile_data);
                    } catch {}
                });
                userProfiles[accountId] = profiles;
                resolve(profiles);
            }
        );
    });
}

function saveUserProfile(accountId, userId, profile) {
    if (!dbConnections[accountId]) return;
    
    userProfiles[accountId] = userProfiles[accountId] || {};
    userProfiles[accountId][userId] = { ...(userProfiles[accountId][userId] || {}), ...profile };
    
    dbConnections[accountId].run(
        `INSERT OR REPLACE INTO user_profiles (user_id, profile_data, last_seen)
         VALUES (?, ?, ?)`,
        [userId, JSON.stringify(userProfiles[accountId][userId]), Date.now()]
    );
}

function getUserProfile(accountId, userId) {
    return (userProfiles[accountId] && userProfiles[accountId][userId]) || {};
}

function extractUserPreferences(text) {
    const prefs = {};
    const gameMatch = text.match(/my favorite game is (\w+)/i);
    if (gameMatch) prefs.favorite_game = gameMatch[1];
    
    const foodMatch = text.match(/my favorite food is (\w+)/i);
    if (foodMatch) prefs.favorite_food = foodMatch[1];
    
    const animeMatch = text.match(/my favorite anime is (\w+)/i);
    if (animeMatch) prefs.favorite_anime = animeMatch[1];
    
    return prefs;
}

function detectTopic(text) {
    text = text.toLowerCase();
    for (const [topic, keywords] of Object.entries(topics)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return topic;
        }
    }
    return 'general';
}

function analyzeSentiment(text) {
    const result = sentiment.analyze(text);
    if (result.score > 1) return 'positive';
    if (result.score < -1) return 'negative';
    return 'neutral';
}

function getBotMood(sentiment) {
    const moodMap = {
        'positive': ['excited', 'chill', 'joking'],
        'negative': ['sarcastic', 'paranoid', 'lazy'],
        'neutral': ['chill', 'joking', 'lazy']
    };
    const available = moodMap[sentiment] || ['chill'];
    return available[Math.floor(Math.random() * available.length)];
}

function sanitizeMessage(message) {
    let sanitized = message.replace(/[\*\_\~\`\#\'\"\;\:\-\_]+/g, '');
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[link]');
    sanitized = sanitized.toLowerCase();
    
    for (const word of bannedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        sanitized = sanitized.replace(regex, '***');
    }
    return sanitized !== message.toLowerCase() ? sanitized : message;
}

function getResponseType() {
    const rand = Math.random();
    if (rand < 0.2) return { type: 'single_word', maxTokens: 10, instruction: 'one word only' };
    if (rand < 0.467) return { type: 'long', maxTokens: 100, instruction: '2-4 sentences' };
    return { type: 'short', maxTokens: 30, instruction: 'one sentence' };
}

function addDisfluencies(text) {
    if (Math.random() > 0.15) return text;
    
    const disfluencies = {
        hesitation: ['well', 'um', 'uh', 'like'],
        backtrack: ['wait', 'i mean', 'actually', 'hold on'],
        filler: ['you know', 'sort of', 'kind of', 'basically']
    };
    
    const words = text.split(' ');
    if (words.length < 3) return text;
    
    const type = Object.keys(disfluencies)[Math.floor(Math.random() * 3)];
    const disfluency = disfluencies[type][Math.floor(Math.random() * disfluencies[type].length)];
    
    if (type === 'hesitation' && Math.random() > 0.5) {
        return `${disfluency} ${text}`;
    } else if (type === 'backtrack' && words.length > 4) {
        const insertPos = Math.floor(Math.random() * (words.length - 2)) + 1;
        words.splice(insertPos, 0, `${disfluency},`);
        return words.join(' ');
    }
    
    return text;
}

function addSelfCorrection(text) {
    if (Math.random() > 0.1) return text;
    
    const corrections = [
        'wait no', 'my bad', 'actually', 'hold on',
        'i meant', 'scratch that', 'never mind'
    ];
    
    if (Math.random() > 0.5) {
        const correction = corrections[Math.floor(Math.random() * corrections.length)];
        return `${correction}, ${text}`;
    }
    
    return text;
}

function addTypo(text) {
    if (!botConfig.addTypos || Math.random() > botConfig.typoChance) return text;
    
    const typoTypes = [
        () => text.replace(/([aeiou])(?=[^aeiou]*$)/i, '$1' + (Math.random() > 0.5 ? 'e' : 'o')),
        () => text.replace(/(ing|ed|es|s)$/i, (match) => match.slice(0, -1)),
        () => text.replace(/(the|and|you|for|with)/gi, (match) => {
            const typos = {
                'the': 'teh', 'and': 'adn', 'you': 'yu', 
                'for': 'fro', 'with': 'wit', 'this': 'thsi',
                'that': 'taht', 'have': 'hav', 'what': 'wat'
            };
            return typos[match.toLowerCase()] || match;
        }),
        () => text.split('').map((c, i) => i === Math.floor(Math.random() * text.length) ? c.toUpperCase() : c).join('')
    ];
    
    return typoTypes[Math.floor(Math.random() * typoTypes.length)]();
}

function getRandomEmojis(count = 1, mood = 'chill') {
    if (Math.random() > 0.067) return '';
    
    const emojiMap = {
        'excited': ['🤩', '🥳', '💥', '🎉'],
        'chill': ['😌', '🍃', '🛋️', '✌️', '😎'],
        'sarcastic': ['🙄', '😏', '🤷', '😒', '👀'],
        'joking': ['😂', '🤣', '😜', '😝', '🤡'],
        'lazy': ['😴', '💤', '🛌', '😪', '🥱'],
        'paranoid': ['🫣', '🤐', '👀', '😬', '🙈']
    };
    
    const emojis = emojiMap[mood] || emojiMap['chill'];
    return Array(count).fill().map(() => emojis[Math.floor(Math.random() * emojis.length)]).join('');
}

function calculateTypingTime(response) {
    const wordCount = response.split(' ').length;
    return Math.min(5.0, 3.0 + (wordCount / 10.0));
}

function simulateTyping() {
    if (!botConfig.varyTypingSpeed) return botConfig.typingDelay;
    
    const baseDelay = botConfig.typingDelay;
    const variation = botConfig.typingVariation || 0.3;
    const min = baseDelay * (1 - variation);
    const max = baseDelay * (1 + variation);
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldReact(message) {
    if (!botConfig.addReactions) return false;
    if (Math.random() > botConfig.reactionChance) return false;
    
    const authorId = message.author.id;
    
    if (!userTypingPatterns[authorId]) {
        userTypingPatterns[authorId] = {
            lastReaction: 0,
            reactionCount: 0
        };
    }
    
    const now = Date.now();
    const userData = userTypingPatterns[authorId];
    
    if (now - userData.lastReaction < 30000) return false;
    if (userData.reactionCount >= 5) return false;
    
    return true;
}

function getReactionEmoji(message) {
    const content = message.content.toLowerCase();
    
    const reactionMap = [
        { keywords: ['lol', 'haha', 'funny', 'joke'], emoji: '😂' },
        { keywords: ['?', 'what', 'how', 'why', 'when'], emoji: '❓' },
        { keywords: ['good', 'great', 'awesome', 'nice', 'cool'], emoji: '👍' },
        { keywords: ['bad', 'sad', 'unfortunately', 'sorry'], emoji: '😢' },
        { keywords: ['wow', 'amazing', 'incredible', 'fantastic'], emoji: '😲' }
    ];
    
    for (const reaction of reactionMap) {
        if (reaction.keywords.some(keyword => content.includes(keyword))) {
            return reaction.emoji;
        }
    }
    
    const randomEmojis = ['👍', '😄', '👀', '💯', '✨', '🚀'];
    return randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
}

async function addReactionToMessage(message, emoji) {
    try {
        await message.react(emoji);
        const authorId = message.author.id;
        
        if (!userTypingPatterns[authorId]) {
            userTypingPatterns[authorId] = {
                lastReaction: Date.now(),
                reactionCount: 1
            };
        } else {
            userTypingPatterns[authorId].lastReaction = Date.now();
            userTypingPatterns[authorId].reactionCount += 1;
        }
        
        logger.info(`👍 Reacted with ${emoji} to ${message.author.username}`);
    } catch (error) {
        if (!error.message.includes('Missing Permissions')) {
            logger.error(`Failed to add reaction: ${error.message}`);
        }
    }
}

function isLowValueContent(message) {
    const content = message.content.trim();
    
    const shortGeneric = content.length < 10 && /^(ok|yes|no|maybe|idk|lol|lmao|haha|hey|hi|hello|sup|yo|kk|k)$/i.test(content);
    if (shortGeneric) return true;
    
    return false;
}

function addToUserMemory(userId, channelId, message) {
    if (!userContextMemory[channelId]) userContextMemory[channelId] = {};
    if (!userContextMemory[channelId][userId]) userContextMemory[channelId][userId] = [];

    userContextMemory[channelId][userId].push({
        content: message,
        timestamp: Date.now()
    });

    if (userContextMemory[channelId][userId].length > 10) {
        userContextMemory[channelId][userId].shift();
    }
}

function getUserMemory(userId, channelId) {
    if (!userContextMemory[channelId] || !userContextMemory[channelId][userId]) {
        return "";
    }

    const recent = userContextMemory[channelId][userId].slice(-5);
    return recent.map(m => m.content).join('\n');
}

function addToQueue(channelId, processFn) {
    if (!botConfig.queueEnabled) {
        processFn();
        return;
    }

    if (!messageQueue[channelId]) {
        messageQueue[channelId] = [];
    }

    messageQueue[channelId].push(processFn);

    if (messageQueue[channelId].length === 1) {
        processQueue(channelId);
    }
}

function processQueue(channelId) {
    if (!messageQueue[channelId] || messageQueue[channelId].length === 0) {
        delete messageQueue[channelId];
        return;
    }

    const processFn = messageQueue[channelId][0];
    
    const executeNext = () => {
        if (messageQueue[channelId] && messageQueue[channelId].length > 0) {
            messageQueue[channelId].shift();
        }
        if (messageQueue[channelId] && messageQueue[channelId].length > 0) {
            processQueue(channelId);
        } else {
            delete messageQueue[channelId];
        }
    };

    setTimeout(() => {
        processFn();
        setTimeout(executeNext, Math.random() * 3000 + 1000);
    }, Math.random() * 5000 + 2000);
}

function queuePendingReply(channelId, message, targetMessageId) {
    if (!pendingReplies[channelId]) pendingReplies[channelId] = [];
    pendingReplies[channelId].push({ message, targetMessageId, timestamp: Date.now() });
}

async function processPendingReplies(channel, accountId) {
    if (!pendingReplies[channel.id] || pendingReplies[channel.id].length === 0) return;
    
    const reply = pendingReplies[channel.id].shift();
    const typingTime = calculateTypingTime(reply.message);
    
    try { await channel.sendTyping(); } catch {}
    setTimeout(async () => {
        await sendMessageWithReference(channel, reply.message, reply.targetMessageId, accountId);
    }, typingTime * 1000);
}

async function sendMessageWithReference(channel, content, referenceId, accountId) {
    try {
        const message = await channel.send({
            content: content,
            reply: { messageReference: referenceId }
        });
        logger.info(`📤 Replied with reference: "${content}"`);
        return message;
    } catch (error) {
        logger.error(`Error sending referenced message: ${error.message}`);
        return null;
    }
}

async function getCachedChannelInfo(channel) {
    const cacheKey = channel.id;
    
    if (channelCache.has(cacheKey)) {
        return channelCache.get(cacheKey);
    }
    
    let serverName = 'Direct Message';
    let channelName = channel.name || 'Unknown Channel';
    
    if (channel.guild) {
        serverName = channel.guild.name || 'Unknown Server';
    }
    
    const info = { serverName, channelName };
    channelCache.set(cacheKey, info);
    
    try {
        const cacheData = {};
        if (fs.existsSync('channel_cache.json')) {
            const existing = fs.readFileSync('channel_cache.json', 'utf8');
            Object.assign(cacheData, JSON.parse(existing));
        }
        cacheData[cacheKey] = info;
        fs.writeFileSync('channel_cache.json', JSON.stringify(cacheData, null, 2));
    } catch (error) {
        logger.error(`Failed to save channel cache: ${error.message}`);
    }
    
    return info;
}

async function shouldStartConversation(channel, accountId) {
    const quietThreshold = 5 * 60 * 1000;
    const lastTime = channelLastMessageTime[channel.id] || 0;
    const timeSinceLastMessage = Date.now() - lastTime;
    
    return timeSinceLastMessage > quietThreshold && Math.random() < 0.2;
}

async function generateContextualMessage(accountId, channelId, dominantTopic, sentiment, mood) {
    const memoryContext = await getMemoryContext(accountId);
    const prompt = `the chat has been quiet, start a conversation about ${dominantTopic} with ${sentiment} sentiment, mood is ${mood}. recent context: ${memoryContext}`;
    
    const responseType = getResponseType();
    const enhancedPrompt = `${HUMAN_PROMPT}\n\nGenerate a casual message to start conversation. ${responseType.instruction}`;
    
    return await generateAI(enhancedPrompt, prompt, channelId, null, 'general', accountId);
}

async function makeRequestWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.response?.status === 429) {
                const waitTime = (i + 1) * 2000;
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            throw error;
        }
    }
    return null;
}

function loadBotConfig() {
    try {
        const configData = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
        const userConfig = JSON.parse(configData);
        botConfig = {
            maxResponsesPerDay: userConfig.ai?.maxResponsesPerDay || 50,
            cooldownMinutes: userConfig.ai?.cooldownMinutes || 0.5,
            channelCooldownMinutes: userConfig.ai?.channelCooldownMinutes || 1,
            minMessageLength: userConfig.ai?.minMessageLength || 1,
            skipRate: userConfig.ai?.skipRate || 0.10,
            responseChance: userConfig.ai?.responseChance || 0.80,
            maxRepliesPerUser: userConfig.ai?.maxRepliesPerUser || 3,
            typingDelay: userConfig.ai?.typingDelay || 2000,
            historySize: userConfig.ai?.historySize || 5,
            autoSendEnabled: userConfig.ai?.autoSendEnabled || true,
            autoSendChance: userConfig.ai?.autoSendChance || 0.50,
            autoSendInterval: userConfig.ai?.autoSendInterval || 900000,
            respondToGeneral: userConfig.ai?.respondToGeneral || 0.5,
            respondToMention: userConfig.ai?.respondToMention || 0.9,
            respondToOtherMention: userConfig.ai?.respondToOtherMention || 0.05,
            minReplyWords: userConfig.ai?.minReplyWords || 1,
            maxReplyWords: userConfig.ai?.maxReplyWords || 10,
            gmEnabled: userConfig.gm?.enabled || true,
            gmTime: userConfig.gm?.time || "09:00",
            gmTimezone: userConfig.gm?.timezone || "Africa/Tunis",
            gmMessage: userConfig.gm?.message || "gm",
            apiRetryCount: userConfig.api?.retryCount || 3,
            apiTimeout: userConfig.api?.timeout || 5000,
            apiMaxTokens: userConfig.api?.maxTokens || 25,
            apiTemperature: userConfig.api?.temperature || 0.7,
            apiTopP: userConfig.api?.top_p || 0.9,
            replyStyle: userConfig.ai?.replyStyle || "smart",
            respectSlowMode: userConfig.ai?.respectSlowMode || true,
            promptLanguage: userConfig.ai?.promptLanguage || "en",
            apiKeyRotation: userConfig.ai?.apiKeyRotation || true,
            maxSlowMode: userConfig.ai?.maxSlowMode || 300,
            qualityFilter: userConfig.ai?.qualityFilter || true,
            personaEnabled: userConfig.ai?.personaEnabled || true,
            queueEnabled: userConfig.ai?.queueEnabled || true,
            addTypos: userConfig.ai?.addTypos || false,
            typoChance: userConfig.ai?.typoChance || 0.15,
            varyTypingSpeed: userConfig.ai?.varyTypingSpeed || false,
            typingVariation: userConfig.ai?.typingVariation || 0.3,
            addReactions: userConfig.ai?.addReactions || false,
            reactionChance: userConfig.ai?.reactionChance || 0.3,
            maxReactionsPerUser: userConfig.ai?.maxReactionsPerUser || 5,
            quietChannelChance: userConfig.ai?.quietChannelChance || 0.2,
            quietThreshold: userConfig.ai?.quietThreshold || 300
        };

        HUMAN_PROMPT = `You are a normal human in a Discord server. Lowercase only. ${botConfig.minReplyWords}-${botConfig.maxReplyWords} words max. No punctuation.`;

        logger.info(`Config loaded`);
    } catch (error) {
        logger.error('Config error: ' + error.message);
        process.exit(1);
    }
}

async function loadConfigs() {
    try {
        const accountsData = fs.readFileSync(path.join(__dirname, 'accounts.json'), 'utf8');
        const apiKeysData = fs.readFileSync(path.join(__dirname, 'api_keys.json'), 'utf8');
        const apiKeys = JSON.parse(apiKeysData);

        const enabledModels = apiKeys.models.filter(m => m.enabled);
        if (enabledModels.length === 0) {
            throw new Error('No enabled AI models in api_keys.json');
        }

        aiConfig = {
            models: enabledModels,
            currentModelIndex: 0
        };

        return JSON.parse(accountsData);
    } catch (error) {
        logger.error('Config load error: ' + error.message);
        return [];
    }
}

function getRandomApiKey() {
    if (!botConfig.apiKeyRotation) {
        return aiConfig.models[aiConfig.currentModelIndex];
    }

    const availableModels = aiConfig.models.filter(model => !usedApiKeys.has(model.apiKey));

    if (availableModels.length === 0) {
        logger.info("All API keys rate limited. Waiting 24 hours...");
        usedApiKeys.clear();
        throw new Error('All API keys rate limited');
    }

    return availableModels[Math.floor(Math.random() * availableModels.length)];
}

function getChannelPersona(channelName) {
    if (!botConfig.personaEnabled) return "normal";

    const name = channelName.toLowerCase();

    if (name.includes('crypto') || name.includes('trading')) return "crypto";
    if (name.includes('game') || name.includes('play')) return "gamer";
    if (name.includes('tech') || name.includes('code')) return "tech";
    if (name.includes('music')) return "music";
    if (name.includes('movie')) return "movie";

    return "normal";
}

function applyPersonaToPrompt(prompt, persona) {
    if (!botConfig.personaEnabled || persona === "normal") return prompt;

    const personaPrompts = {
        "crypto": "You are a crypto enthusiast. Use crypto slang.",
        "gamer": "You are a casual gamer. Talk about games.",
        "tech": "You are interested in technology.",
        "music": "You love music.",
        "movie": "You watch movies and shows."
    };

    return `${personaPrompts[persona]}\n\n${prompt}`;
}

async function generateAI(systemPrompt, userPrompt, channelName, originalMessage, persona, accountId = 'default') {
    const fullSystemPrompt = applyPersonaToPrompt(systemPrompt, persona);
    
    const topic = detectTopic(userPrompt);
    const sentiment = analyzeSentiment(userPrompt);
    const mood = getBotMood(sentiment);
    const responseType = getResponseType();
    
    let enhancedPrompt = fullSystemPrompt;
    
    enhancedPrompt += `\n\nCurrent topic: ${topic}. Stay on topic.`;
    enhancedPrompt += `\nSentiment: ${sentiment}. Mood: ${mood}. Match this vibe.`;
    enhancedPrompt += `\nAvoid these words: ${bannedWords.join(', ')}.`;
    enhancedPrompt += `\nUse natural speech patterns occasionally (like "um", "well", "like").`;
    enhancedPrompt += `\nSometimes correct yourself naturally (like "wait no", "i mean").`;
    enhancedPrompt += `\n\nResponse style: ${responseType.instruction}. Keep it casual.`;

    let currentModel;
    let retryCount = 0;
    const currentTemperature = botConfig.apiTemperature;

    if (!rateLimiters[accountId]) {
        rateLimiters[accountId] = new RateLimiter(30, 60000);
    }

    while (retryCount < botConfig.apiRetryCount) {
        try {
            if (!rateLimiters[accountId].canMakeRequest()) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            currentModel = getRandomApiKey();

            logger.info(`🔑 [${channelName}] Trying ${currentModel.provider} (${currentModel.name}) [${persona}]`);

            let response;
            if (currentModel.provider === 'google') {
                const endpoint = currentModel.endpoint.includes('?key=')
                    ? currentModel.endpoint
                    : `${currentModel.endpoint}?key=${currentModel.apiKey}`;

                response = await axios.post(endpoint, {
                    contents: [{
                        parts: [{text: enhancedPrompt + '\n\n' + userPrompt}]
                    }],
                    generationConfig: {
                        maxOutputTokens: botConfig.apiMaxTokens,
                        temperature: currentTemperature,
                        topP: botConfig.apiTopP
                    }
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: botConfig.apiTimeout
                });

                let res = response.data.candidates[0].content.parts[0].text.trim().toLowerCase();

                const forbidden = ["as an ai", "bot", "assistant", "language model"];
                if (forbidden.some(word => res.includes(word))) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                if (res === lastGeneratedText) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                res = sanitizeMessage(res);
                res = addDisfluencies(res);
                res = addSelfCorrection(res);
                res += getRandomEmojis(1, mood);
                
                if (botConfig.addTypos) {
                    res = addTypo(res);
                }

                lastGeneratedText = res;
                logger.info(`🤖 [${channelName}] AI generated: "${res}"`);
                
                addToMemory(accountId, null, 'system', userPrompt, res, topic);
                
                return res.replace(/^["']|["']$/g, '').trim();

            } else {
                response = await axios.post(currentModel.endpoint, {
                    model: currentModel.modelName,
                    messages: [
                        { role: "system", content: enhancedPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    max_tokens: botConfig.apiMaxTokens,
                    temperature: currentTemperature,
                    top_p: botConfig.apiTopP
                }, {
                    headers: { 'Authorization': `Bearer ${currentModel.apiKey}`, 'Content-Type': 'application/json' },
                    timeout: botConfig.apiTimeout
                });

                let res = response.data.choices[0].message.content.trim().toLowerCase();

                const forbidden = ["as an ai", "bot", "assistant", "language model"];
                if (forbidden.some(word => res.includes(word))) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                if (res === lastGeneratedText) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                res = sanitizeMessage(res);
                res = addDisfluencies(res);
                res = addSelfCorrection(res);
                res += getRandomEmojis(1, mood);
                
                if (botConfig.addTypos) {
                    res = addTypo(res);
                }

                lastGeneratedText = res;
                logger.info(`🤖 [${channelName}] AI generated: "${res}"`);
                
                addToMemory(accountId, null, 'system', userPrompt, res, topic);
                
                return res.replace(/^["']|["']$/g, '').trim();
            }

        } catch (error) {
            if (error.response?.status === 429) {
                if (currentModel) usedApiKeys.add(currentModel.apiKey);
            }
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    return null;
}

async function getChannelInfo(channel) {
    try {
        const fetchedChannel = await channel.fetch();
        const channelName = fetchedChannel.name || 'Unknown Channel';
        let serverName = 'Direct Message';

        if (fetchedChannel.guild) {
            serverName = fetchedChannel.guild.name || 'Unknown Server';
        }

        return { serverName, channelName };
    } catch (error) {
        return { serverName: 'Unknown Server', channelName: 'Unknown Channel' };
    }
}

function shouldSkipMessageType(message) {
    const skipTypes = [6, 7, 8, 22, 24, 25];
    return skipTypes.includes(message.type);
}

async function sendMessage(message, reply) {
    try {
        if (botConfig.replyStyle === "mention") {
            await message.channel.send(`${message.author} ${reply}`);
            return "mention";
        }
        else {
            await message.reply(reply);
            return "discord_reply";
        }
    } catch (error) {
        if (error.code === 200000) {
            logger.error(`❌ Message blocked: "${reply}"`);
            return "blocked";
        }
        logger.error(`❌ Error sending message: ${error.message}`);
        return "error";
    }
}

function isMessageForBot(message, client) {
    if (message.mentions.has(client.user.id)) return true;
    if (message.content.toLowerCase().includes(client.user.username.toLowerCase())) return true;
    if (message.channel.type === 'DM') return true;
    return false;
}

async function initializeAccount(account) {
    const client = new DiscordClient({ checkUpdate: false });

    client.once('ready', async () => {
        logger.info(`${account.name} - Logged in`);

        dbConnections[account.name] = initDatabase(account.name);
        await loadUserProfiles(account.name);

        try {
            if (fs.existsSync('channel_cache.json')) {
                const cacheData = JSON.parse(fs.readFileSync('channel_cache.json', 'utf8'));
                for (const [id, info] of Object.entries(cacheData)) {
                    channelCache.set(id, info);
                }
            }
        } catch (error) {
            logger.error(`Failed to load channel cache: ${error.message}`);
        }

        activeClients.push({ client, account });

        setInterval(async () => {
            for (const channelConfig of account.channels) {
                const channel = client.channels.cache.get(channelConfig.id);
                if (channel && channelConfig.useAI) {
                    await processPendingReplies(channel, account.name);
                    
                    if (await shouldStartConversation(channel, account.name)) {
                        const recentMessages = await channel.messages.fetch({ limit: 5 });
                        const topics = recentMessages.map(m => detectTopic(m.content));
                        const sentiments = recentMessages.map(m => analyzeSentiment(m.content));
                        const dominantTopic = topics.sort((a,b) => 
                            topics.filter(v => v===a).length - topics.filter(v => v===b).length
                        ).pop() || 'general';
                        const dominantSentiment = sentiments.sort((a,b) => 
                            sentiments.filter(v => v===a).length - sentiments.filter(v => v===b).length
                        ).pop() || 'neutral';
                        const mood = getBotMood(dominantSentiment);
                        
                        const response = await generateContextualMessage(account.name, channel.id, dominantTopic, dominantSentiment, mood);
                        if (response) {
                            try { await channel.sendTyping(); } catch {}
                            setTimeout(async () => {
                                await channel.send(response);
                                logger.info(`📤 Started conversation: "${response}"`);
                                addToMemory(account.name, null, 'system', 'quiet channel start', response, dominantTopic);
                            }, calculateTypingTime(response) * 1000);
                        }
                    }
                }
            }
        }, 300000);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.id === client.user.id) return;
        if (message.author.bot) return;
        if (message.content.length < botConfig.minMessageLength) return;
        if (shouldSkipMessageType(message)) return;

        const chCfg = account.channels.find(c => c.id === message.channel.id);
        if (!chCfg || !chCfg.useAI) return;

        channelLastMessageTime[message.channel.id] = Date.now();

        const channelId = message.channel.id;
        const now = Date.now();

        const channelInfo = await getCachedChannelInfo(message.channel);
        const persona = getChannelPersona(channelInfo.channelName);
        const username = message.author.username;
        const displayName = `${channelInfo.serverName}/${channelInfo.channelName}`;

        const prefs = extractUserPreferences(message.content);
        if (Object.keys(prefs).length > 0) {
            saveUserProfile(account.name, message.author.id, prefs);
        }

        if (isLowValueContent(message)) {
            return;
        }

        if (!messageHistory[channelId]) messageHistory[channelId] = [];
        messageHistory[channelId].push(`${username}: ${message.content}`);
        if (messageHistory[channelId].length > botConfig.historySize) {
            messageHistory[channelId].shift();
        }

        addToUserMemory(message.author.id, channelId, message.content);
        const userMemory = getUserMemory(message.author.id, channelId);
        const userProfile = getUserProfile(account.name, message.author.id);

        logger.info(`📨 [${displayName}] ${username}: ${message.content.substring(0, 50)}... [${persona}]`);

        if (shouldReact(message)) {
            const emoji = getReactionEmoji(message);
            await addReactionToMessage(message, emoji);
        }

        const isForBot = isMessageForBot(message, client);

        if (isForBot) {
            if (Math.random() > botConfig.respondToMention) return;
        } else {
            if (Math.random() > botConfig.respondToGeneral) return;
        }

        if (Math.random() < botConfig.skipRate) {
            return;
        }

        const hasResp = await hasResponded(account.name, message.id);
        if (hasResp) return;

        addToQueue(channelId, async () => {
            const topic = detectTopic(message.content);
            const sentiment = analyzeSentiment(message.content);
            const mood = getBotMood(sentiment);
            const memoryContext = await getMemoryContext(account.name);
            const userContext = Object.entries(userProfile)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');

            const reply = await generateAI(
                `${HUMAN_PROMPT}\n\nUser preferences: ${userContext}\n\nRecent:\n${messageHistory[channelId].join('\n')}\n\nMemory:\n${memoryContext}`,
                `Reply to ${username}: "${message.content}" with ${mood} mood and ${sentiment} sentiment`,
                displayName,
                message.content,
                persona,
                account.name
            );
            
            if (reply) {
                try { await message.channel.sendTyping(); } catch {}
                
                const typingTime = calculateTypingTime(reply);
                setTimeout(async () => {
                    const replyMethod = await sendMessage(message, reply);
                    if (replyMethod !== "blocked") {
                        logger.info(`📤 [${displayName}] @${username}: "${reply}"`);
                        addToMemory(account.name, message.id, username, message.content, reply, topic);
                    }
                }, typingTime * 1000);
            }
        });
    });

    await makeRequestWithRetry(() => client.login(account.token));
}

function resetDailyCounter() {
    dailyResponseCount = {};
    usedApiKeys.clear();
    lastGeneratedText = null;
    userContextMemory = {};
    userTypingPatterns = {};
    userMessageCount = {};
    sentResponses.clear();
    skippedChannels.clear();
    logger.info('Daily counters reset');
}

async function fetchChannelsInteractive() {
    console.log('\n🔍 CHANNEL FETCH MODE');
    console.log('══════════════════════════════\n');

    loadBotConfig();
    
    let accounts = [];
    try {
        const accountsData = fs.readFileSync(path.join(__dirname, 'accounts.json'), 'utf8');
        accounts = JSON.parse(accountsData);
    } catch (error) {
        console.log('⚠️  No accounts.json found');
        return;
    }

    if (accounts.length === 0) {
        console.log('❌ No accounts configured');
        return;
    }

    console.log('Select account:');
    accounts.forEach((acc, idx) => {
        console.log(`${idx + 1}. ${acc.name}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    try {
        const accountChoice = await question('\nEnter account number: ');
        const accountIndex = parseInt(accountChoice) - 1;

        if (accountIndex < 0 || accountIndex >= accounts.length) {
            console.log('❌ Invalid account selection');
            rl.close();
            return;
        }

        const selectedAccount = accounts[accountIndex];
        console.log(`\n✅ Selected: ${selectedAccount.name}`);
        console.log('🔌 Logging in...\n');

        const client = new DiscordClient({ checkUpdate: false });

        client.once('ready', async () => {
            console.log('✅ Logged in successfully!\n');

            const guilds = Array.from(client.guilds.cache.values());
            
            if (guilds.length === 0) {
                console.log('❌ No servers found');
                client.destroy();
                rl.close();
                return;
            }

            let continueAdding = true;

            while (continueAdding) {
                console.log('\n📋 Available Servers:');
                guilds.forEach((guild, idx) => {
                    console.log(`${idx + 1}. ${guild.name} (${guild.memberCount || 'N/A'} members)`);
                });

                const serverChoice = await question('\nEnter server number: ');
                const serverIndex = parseInt(serverChoice) - 1;

                if (serverIndex < 0 || serverIndex >= guilds.length) {
                    console.log('❌ Invalid server selection');
                    continue;
                }

                const selectedGuild = guilds[serverIndex];
                console.log(`\n✅ Selected Server: ${selectedGuild.name}`);

                const channels = Array.from(selectedGuild.channels.cache.values())
                    .filter(ch => ch.type === 'GUILD_TEXT' || ch.type === 0);

                if (channels.length === 0) {
                    console.log('❌ No text channels found in this server');
                    continue;
                }

                console.log('\n📺 Available Channels:');
                channels.forEach((ch, idx) => {
                    console.log(`${idx + 1}. #${ch.name}`);
                });

                const channelChoice = await question('\nEnter channel number: ');
                const channelIndex = parseInt(channelChoice) - 1;

                if (channelIndex < 0 || channelIndex >= channels.length) {
                    console.log('❌ Invalid channel selection');
                    continue;
                }

                const selectedChannel = channels[channelIndex];
                console.log(`\n✅ Selected Channel: #${selectedChannel.name}`);

                const defaultName = `${selectedGuild.name} / ${selectedChannel.name}`;
                const nameChoice = await question(`\nSave as "${defaultName}"? (y/n or enter custom name): `);

                let channelName = defaultName;
                if (nameChoice.toLowerCase() !== 'y' && nameChoice.toLowerCase() !== 'yes' && nameChoice.trim() !== '') {
                    channelName = nameChoice.trim();
                }

                const existingChannelIndex = selectedAccount.channels.findIndex(ch => ch.id === selectedChannel.id);
                
                if (existingChannelIndex !== -1) {
                    selectedAccount.channels[existingChannelIndex] = {
                        id: selectedChannel.id,
                        name: channelName,
                        useAI: true
                    };
                    console.log(`\n✅ Updated existing channel: ${channelName}`);
                } else {
                    selectedAccount.channels.push({
                        id: selectedChannel.id,
                        name: channelName,
                        useAI: true
                    });
                    console.log(`\n✅ Added channel: ${channelName}`);
                }

                fs.writeFileSync(
                    path.join(__dirname, 'accounts.json'),
                    JSON.stringify(accounts, null, 2)
                );
                console.log('💾 Saved to accounts.json');

                const continueChoice = await question('\nOptions:\n1. Add another channel\n2. Back to server list\n3. Start bot\n4. Exit\n\nSelect option: ');

                if (continueChoice === '1') {
                    continue;
                } else if (continueChoice === '2') {
                    continue;
                } else if (continueChoice === '3') {
                    console.log('\n🚀 Starting bot...\n');
                    client.destroy();
                    rl.close();
                    await startBot();
                    return;
                } else {
                    continueAdding = false;
                }
            }

            client.destroy();
            rl.close();
        });

        client.login(selectedAccount.token).catch((error) => {
            console.log(`❌ Login failed: ${error.message}`);
            rl.close();
        });

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        rl.close();
    }
}

async function startBot() {
    console.log('🤖 Discord AI Bot - Ultra Enhanced Edition\n');

    loadBotConfig();
    const accounts = await loadConfigs();

    if (accounts.length === 0) {
        console.log('No accounts configured');
        return;
    }

    if (!aiConfig.models || aiConfig.models.length === 0) {
        console.log('No API keys configured');
        return;
    }

    cron.schedule('0 0 * * *', resetDailyCounter);

    for (const acc of accounts) {
        console.log(`Logging in ${acc.name}...`);
        await initializeAccount(acc);
        await new Promise(r => setTimeout(r, 4000));
    }

    console.log(`\n✅ Running with ${activeClients.length} accounts\n`);
}

console.log('══════════════════════════════');
console.log('🤖 Discord AI Bot - Ultra Enhanced');
console.log('══════════════════════════════\n');
console.log('1. Start bot');
console.log('2. Fetch channels\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Select option: ', async (choice) => {
    rl.close();
    if (choice === '1') {
        await startBot();
    } else if (choice === '2') {
        await fetchChannelsInteractive();
    } else {
        console.log('Invalid option');
        process.exit(0);
    }
});

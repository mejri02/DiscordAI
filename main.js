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
let userLastMessageTime = {};
let userResponseCount = {};
let conversationThreads = {};
let userTrustScores = {};

let HUMAN_PROMPT = "";

const bannedWords = ['discord', 'server', 'bot', 'channel', 'message'];

const topics = {
    gaming: ['game', 'play', 'console', 'pc', 'xbox', 'playstation', 'controller', 'gamer', 'minecraft', 'valorant', 'fortnite', 'cod', 'league', 'lol', 'ranked'],
    music: ['song', 'album', 'artist', 'band', 'concert', 'beats', 'tune', 'spotify', 'playlist', 'genre', 'rap', 'rock', 'pop', 'vibes'],
    movies: ['film', 'movie', 'cinema', 'actor', 'director', 'scene', 'plot', 'netflix', 'series', 'show', 'episode', 'watched'],
    tech: ['code', 'tech', 'software', 'hardware', 'gadget', 'app', 'update', 'phone', 'computer', 'laptop', 'keyboard', 'mouse'],
    food: ['food', 'eat', 'cook', 'recipe', 'snack', 'meal', 'yummy', 'hungry', 'dinner', 'lunch', 'breakfast', 'coffee', 'tea'],
    anime: ['anime', 'manga', 'episode', 'series', 'character', 'aot', 'naruto', 'one piece', 'bleach', 'demon slayer', 'jujutsu'],
    life: ['work', 'school', 'job', 'tired', 'sleep', 'bed', 'morning', 'night', 'day', 'weekend', 'busy', 'free'],
    sports: ['game', 'team', 'player', 'match', 'win', 'loss', 'score', 'goal', 'basketball', 'football', 'soccer', 'baseball']
};

const moods = {
    excited: { emoji: ['!', 'awesome', 'great', 'love'], multiplier: 1.2 },
    chill: { emoji: ['😌', 'cool', 'nice', 'yeah'], multiplier: 1.0 },
    sarcastic: { emoji: ['🙄', 'oh really', 'sure', 'right'], multiplier: 0.9 },
    joking: { emoji: ['😂', 'lol', 'funny', 'lmao'], multiplier: 1.1 },
    lazy: { emoji: ['😴', 'whatever', 'maybe', 'idk'], multiplier: 0.8 },
    paranoid: { emoji: ['👀', 'you sure', 'hmm', 'sus'], multiplier: 0.95 },
    thoughtful: { emoji: ['🤔', 'hmm', 'interesting', 'true'], multiplier: 1.05 }
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
                username TEXT,
                profile_data TEXT DEFAULT '{}',
                interaction_count INTEGER DEFAULT 1,
                last_seen INTEGER
            )`);
            
            db.run(`ALTER TABLE user_profiles ADD COLUMN username TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    logger.error(`Error adding username column: ${err.message}`);
                }
            });
            
            db.run(`ALTER TABLE user_profiles ADD COLUMN profile_data TEXT DEFAULT '{}'`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    logger.error(`Error adding profile_data column: ${err.message}`);
                }
            });
            
            db.run(`ALTER TABLE user_profiles ADD COLUMN interaction_count INTEGER DEFAULT 1`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    logger.error(`Error adding interaction_count column: ${err.message}`);
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS channel_cache (
                channel_id TEXT PRIMARY KEY,
                server_name TEXT,
                channel_name TEXT,
                last_active INTEGER
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS conversation_threads (
                thread_id TEXT PRIMARY KEY,
                participants TEXT,
                topic TEXT,
                message_count INTEGER DEFAULT 1,
                last_message INTEGER
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
        
        db.run(`DELETE FROM memory WHERE timestamp < ?`, [Date.now() - 86400000 * 3]);
    } catch (error) {
        logger.error(`Memory add error: ${error.message}`);
    }
}

function getMemoryContext(accountId, limit = 8) {
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
    if (!dbConnections[accountId]) return Promise.resolve({});
    
    return new Promise((resolve) => {
        try {
            dbConnections[accountId].all(
                `SELECT user_id, username, profile_data, interaction_count FROM user_profiles`,
                [],
                (err, rows) => {
                    if (err) {
                        logger.error(`Error loading profiles: ${err.message}`);
                        resolve({});
                        return;
                    }
                    if (!rows || rows.length === 0) {
                        resolve({});
                        return;
                    }
                    const profiles = {};
                    rows.forEach(row => {
                        try {
                            profiles[row.user_id] = {
                                ...JSON.parse(row.profile_data || '{}'),
                                username: row.username || 'unknown',
                                interactionCount: row.interaction_count || 1
                            };
                        } catch (e) {
                            logger.error(`Error parsing profile for ${row.user_id}: ${e.message}`);
                        }
                    });
                    userProfiles[accountId] = profiles;
                    resolve(profiles);
                }
            );
        } catch (error) {
            logger.error(`Load user profiles error: ${error.message}`);
            resolve({});
        }
    });
}

function saveUserProfile(accountId, userId, username, profile) {
    if (!dbConnections[accountId]) return;
    
    userProfiles[accountId] = userProfiles[accountId] || {};
    userProfiles[accountId][userId] = { 
        ...(userProfiles[accountId][userId] || {}), 
        ...profile,
        username,
        lastSeen: Date.now()
    };
    
    const existing = userProfiles[accountId][userId];
    const interactionCount = (existing.interactionCount || 0) + 1;
    
    dbConnections[accountId].run(
        `INSERT OR REPLACE INTO user_profiles (user_id, username, profile_data, interaction_count, last_seen)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, username, JSON.stringify(userProfiles[accountId][userId]), interactionCount, Date.now()]
    );
}

function getUserProfile(accountId, userId) {
    return (userProfiles[accountId] && userProfiles[accountId][userId]) || {};
}

function extractUserPreferences(text) {
    const prefs = {};
    
    const games = ['minecraft', 'valorant', 'fortnite', 'cod', 'league', 'genshin', 'roblox', 'csgo'];
    for (const game of games) {
        if (text.toLowerCase().includes(game)) {
            prefs.favorite_game = game;
            break;
        }
    }
    
    const music = ['rap', 'rock', 'pop', 'hip hop', 'metal', 'jazz', 'classical', 'edm'];
    for (const genre of music) {
        if (text.toLowerCase().includes(genre)) {
            prefs.music_genre = genre;
            break;
        }
    }
    
    const anime = ['naruto', 'one piece', 'aot', 'demon slayer', 'jujutsu', 'bleach'];
    for (const show of anime) {
        if (text.toLowerCase().includes(show)) {
            prefs.favorite_anime = show;
            break;
        }
    }
    
    const timeIndicators = ['morning', 'afternoon', 'evening', 'night', 'work', 'school', 'sleep'];
    for (const time of timeIndicators) {
        if (text.toLowerCase().includes(time)) {
            prefs.schedule = time;
            break;
        }
    }
    
    return prefs;
}

function detectTopic(text) {
    text = text.toLowerCase();
    const topicScores = {};
    
    for (const [topic, keywords] of Object.entries(topics)) {
        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                score += 1;
                if (text.split(' ').includes(keyword)) score += 2;
            }
        }
        if (score > 0) topicScores[topic] = score;
    }
    
    if (Object.keys(topicScores).length === 0) return 'general';
    
    return Object.entries(topicScores).sort((a, b) => b[1] - a[1])[0][0];
}

function analyzeSentiment(text) {
    const result = sentiment.analyze(text);
    if (result.score > 2) return 'very_positive';
    if (result.score > 0) return 'positive';
    if (result.score < -2) return 'very_negative';
    if (result.score < 0) return 'negative';
    return 'neutral';
}

function getBotMood(sentiment) {
    const moodMap = {
        'very_positive': ['excited', 'joking', 'chill'],
        'positive': ['chill', 'joking', 'excited'],
        'neutral': ['chill', 'thoughtful', 'lazy'],
        'negative': ['sarcastic', 'paranoid', 'lazy'],
        'very_negative': ['paranoid', 'sarcastic', 'lazy']
    };
    const available = moodMap[sentiment] || ['chill'];
    return available[Math.floor(Math.random() * available.length)];
}

function sanitizeMessage(message) {
    let sanitized = message.toLowerCase();
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '');
    sanitized = sanitized.replace(/discord\.gg\/[a-zA-Z0-9]+/g, '');
    
    for (const word of bannedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        sanitized = sanitized.replace(regex, '');
    }
    
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized;
}

function getResponseType(userMessageLength) {
    const rand = Math.random();
    
    if (userMessageLength < 20) {
        if (rand < 0.3) return { type: 'short', maxWords: 5, instruction: 'brief reply' };
        return { type: 'medium', maxWords: 10, instruction: 'natural reply' };
    }
    
    if (rand < 0.15) return { type: 'very_short', maxWords: 3, instruction: 'very short' };
    if (rand < 0.45) return { type: 'short', maxWords: 8, instruction: 'short' };
    if (rand < 0.75) return { type: 'medium', maxWords: 15, instruction: 'medium' };
    return { type: 'long', maxWords: 25, instruction: 'detailed' };
}

function addDisfluencies(text, chance = 0.2) {
    if (Math.random() > chance) return text;
    
    const disfluencies = {
        start: ['well', 'um', 'uh', 'like', 'i mean', 'you know'],
        middle: ['like', 'you know', 'i guess', 'sort of', 'kind of'],
        end: ['you know?', 'if that makes sense', 'idk']
    };
    
    const words = text.split(' ');
    if (words.length < 4) return text;
    
    const type = Math.random();
    
    if (type < 0.4) {
        const disfluency = disfluencies.start[Math.floor(Math.random() * disfluencies.start.length)];
        return `${disfluency} ${text}`;
    } else if (type < 0.8 && words.length > 5) {
        const pos = Math.floor(Math.random() * (words.length - 2)) + 1;
        const disfluency = disfluencies.middle[Math.floor(Math.random() * disfluencies.middle.length)];
        words.splice(pos, 0, disfluency);
        return words.join(' ');
    } else {
        const disfluency = disfluencies.end[Math.floor(Math.random() * disfluencies.end.length)];
        return `${text} ${disfluency}`;
    }
}

function addSelfCorrection(text, chance = 0.08) {
    if (Math.random() > chance) return text;
    
    const corrections = [
        'wait no', 'actually', 'i meant', 'my bad', 
        'hold on', 'scratch that', 'never mind'
    ];
    
    const correction = corrections[Math.floor(Math.random() * corrections.length)];
    
    if (Math.random() > 0.5) {
        return `${correction}, ${text}`;
    } else {
        const words = text.split(' ');
        if (words.length > 3) {
            const correctWord = words[Math.floor(Math.random() * words.length)];
            return `${correction} not ${correctWord}, ${text}`;
        }
        return `${correction} ${text}`;
    }
}

function addTypo(text, chance = 0.12) {
    if (!botConfig.addTypos || Math.random() > chance) return text;
    
    const commonTypos = {
        'the': 'teh', 'and': 'an', 'you': 'u', 'for': '4',
        'are': 'r', 'your': 'ur', 'because': 'cuz', 'with': 'w/',
        'what': 'wat', 'this': 'dis', 'that': 'dat', 'people': 'ppl',
        'about': 'abt', 'really': 'rly', 'please': 'pls', 'message': 'msg'
    };
    
    const words = text.split(' ');
    const wordIndex = Math.floor(Math.random() * words.length);
    const word = words[wordIndex].toLowerCase();
    
    if (commonTypos[word]) {
        words[wordIndex] = commonTypos[word];
    } else if (word.length > 3 && Math.random() > 0.5) {
        words[wordIndex] = word.slice(0, -1);
    } else if (word.length > 3) {
        const letters = word.split('');
        const swapIndex = Math.floor(Math.random() * (letters.length - 1));
        [letters[swapIndex], letters[swapIndex + 1]] = [letters[swapIndex + 1], letters[swapIndex]];
        words[wordIndex] = letters.join('');
    }
    
    return words.join(' ');
}

function getRandomEmojis(count = 1, mood = 'chill', chance = 0.1) {
    if (Math.random() > chance) return '';
    
    const emojiMap = {
        'excited': ['🤩', '🥳', '💥', '🎉', '🔥', '⚡'],
        'chill': ['😌', '🍃', '✌️', '😎', '👌', '💯'],
        'sarcastic': ['🙄', '😏', '🤷', '😒', '👀', '💀'],
        'joking': ['😂', '🤣', '😜', '😝', '🤡', '👻'],
        'lazy': ['😴', '💤', '🛌', '😪', '🥱', '😐'],
        'paranoid': ['🫣', '🤐', '👀', '😬', '🙈', '🤔'],
        'thoughtful': ['🤔', '🧐', '📝', '💭', '🤨', '❓']
    };
    
    const emojis = emojiMap[mood] || emojiMap['chill'];
    const selected = [];
    for (let i = 0; i < count; i++) {
        selected.push(emojis[Math.floor(Math.random() * emojis.length)]);
    }
    return ' ' + selected.join(' ');
}

function calculateTypingTime(response, baseDelay = 2.0) {
    const wordCount = response.split(' ').length;
    
    if (!botConfig.varyTypingSpeed) {
        return baseDelay;
    }
    
    let time = 1.5 + (wordCount * 0.15);
    time *= (0.8 + (Math.random() * 0.4));
    
    return Math.min(6.0, Math.max(1.0, time));
}

function simulateTyping() {
    const baseDelay = botConfig.typingDelay / 1000;
    
    if (!botConfig.varyTypingSpeed) {
        return baseDelay;
    }
    
    const variation = botConfig.typingVariation || 0.3;
    const min = baseDelay * (1 - variation);
    const max = baseDelay * (1 + variation);
    
    return min + (Math.random() * (max - min));
}

function shouldReact(message) {
    if (!botConfig.addReactions) return false;
    if (Math.random() > botConfig.reactionChance) return false;
    
    const authorId = message.author.id;
    const channelId = message.channel.id;
    
    if (!userTypingPatterns[authorId]) {
        userTypingPatterns[authorId] = {
            lastReaction: 0,
            reactionCount: 0,
            channelReactions: {}
        };
    }
    
    if (!userTypingPatterns[authorId].channelReactions[channelId]) {
        userTypingPatterns[authorId].channelReactions[channelId] = 0;
    }
    
    const now = Date.now();
    const userData = userTypingPatterns[authorId];
    
    if (now - userData.lastReaction < 60000) return false;
    if (userData.reactionCount >= botConfig.maxReactionsPerUser) return false;
    if (userData.channelReactions[channelId] >= 3) return false;
    
    return true;
}

function getReactionEmoji(message) {
    const content = message.content.toLowerCase();
    
    if (content.includes('lol') || content.includes('lmao') || content.includes('haha')) return '😂';
    if (content.includes('?')) return '❓';
    if (content.includes('good') || content.includes('nice') || content.includes('cool')) return '👍';
    if (content.includes('sad') || content.includes('rip') || content.includes('damn')) return '😢';
    if (content.includes('wow') || content.includes('omg') || content.includes('no way')) return '😲';
    if (content.includes('👀') || content.includes('sus')) return '👀';
    if (content.includes('fr') || content.includes('facts')) return '💯';
    if (content.includes('fire') || content.includes('lit')) return '🔥';
    
    const randomEmojis = ['👍', '😄', '👀', '💯', '🔥', '✅', '👌', '💀'];
    return randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
}

async function addReactionToMessage(message, emoji) {
    try {
        await message.react(emoji);
        const authorId = message.author.id;
        const channelId = message.channel.id;
        
        if (!userTypingPatterns[authorId]) {
            userTypingPatterns[authorId] = {
                lastReaction: Date.now(),
                reactionCount: 1,
                channelReactions: { [channelId]: 1 }
            };
        } else {
            userTypingPatterns[authorId].lastReaction = Date.now();
            userTypingPatterns[authorId].reactionCount += 1;
            userTypingPatterns[authorId].channelReactions[channelId] = 
                (userTypingPatterns[authorId].channelReactions[channelId] || 0) + 1;
        }
        
        logger.info(`👍 Reacted with ${emoji} to ${message.author.username}`);
    } catch (error) {
        if (!error.message.includes('Missing Permissions')) {
            logger.error(`Failed to add reaction: ${error.message}`);
        }
    }
}

function isLowValueContent(message) {
    const content = message.content.trim().toLowerCase();
    
    const spamPatterns = [
        /^(ok|yes|no|maybe|idk|lol|lmao|haha|hey|hi|hello|sup|yo|kk|k)$/i,
        /^(same|fr|real|damn|nice|cool|wtf|omg)$/i,
        /^[!?.]+$/,
        /^(lol)+$/i,
        /^(.)\1{3,}$/
    ];
    
    for (const pattern of spamPatterns) {
        if (pattern.test(content)) return true;
    }
    
    if (content.length < 2) return true;
    
    return false;
}

function addToUserMemory(userId, channelId, username, message) {
    if (!userContextMemory[channelId]) userContextMemory[channelId] = {};
    if (!userContextMemory[channelId][userId]) userContextMemory[channelId][userId] = [];

    userContextMemory[channelId][userId].push({
        username,
        content: message,
        timestamp: Date.now()
    });

    if (userContextMemory[channelId][userId].length > 15) {
        userContextMemory[channelId][userId] = userContextMemory[channelId][userId].slice(-15);
    }
}

function getUserMemory(userId, channelId) {
    if (!userContextMemory[channelId] || !userContextMemory[channelId][userId]) {
        return "";
    }

    const recent = userContextMemory[channelId][userId].slice(-8);
    return recent.map(m => `${m.username}: ${m.content}`).join('\n');
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
            setTimeout(() => processQueue(channelId), 2000 + Math.random() * 3000);
        } else {
            delete messageQueue[channelId];
        }
    };

    setTimeout(() => {
        processFn();
        setTimeout(executeNext, 3000 + Math.random() * 4000);
    }, 2000 + Math.random() * 4000);
}

function queuePendingReply(channelId, message, targetMessageId) {
    if (!pendingReplies[channelId]) pendingReplies[channelId] = [];
    pendingReplies[channelId].push({ message, targetMessageId, timestamp: Date.now() });
    
    if (pendingReplies[channelId].length > 5) {
        pendingReplies[channelId] = pendingReplies[channelId].slice(-5);
    }
}

async function processPendingReplies(channel, accountId) {
    if (!pendingReplies[channel.id] || pendingReplies[channel.id].length === 0) return;
    
    const now = Date.now();
    pendingReplies[channel.id] = pendingReplies[channel.id].filter(r => now - r.timestamp < 300000);
    
    if (pendingReplies[channel.id].length === 0) return;
    
    const reply = pendingReplies[channel.id].shift();
    
    try { await channel.sendTyping(); } catch {}
    
    const typingTime = simulateTyping();
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
        logger.info(`📤 Replied with reference: "${content.substring(0, 30)}..."`);
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
    
    let serverName = 'DM';
    let channelName = 'dm';
    
    if (channel.guild) {
        serverName = channel.guild.name || 'Unknown Server';
        channelName = channel.name || 'unknown';
    }
    
    const info = { serverName, channelName };
    channelCache.set(cacheKey, info);
    
    return info;
}

async function shouldStartConversation(channel, accountId) {
    if (!botConfig.autoSendEnabled) return false;
    
    const quietThreshold = (botConfig.quietThreshold || 300) * 1000;
    const lastTime = channelLastMessageTime[channel.id] || 0;
    const timeSinceLastMessage = Date.now() - lastTime;
    
    if (timeSinceLastMessage < quietThreshold) return false;
    
    try {
        const messages = await channel.messages.fetch({ limit: 5 });
        const botMessages = messages.filter(m => m.author.id === channel.client.user.id).size;
        
        if (botMessages >= 2) return false;
        
        const lastBotMessage = messages.find(m => m.author.id === channel.client.user.id);
        if (lastBotMessage && (Date.now() - lastBotMessage.createdTimestamp) < 300000) return false;
        
    } catch {}
    
    const chance = botConfig.autoSendChance || 0.3;
    return Math.random() < chance;
}

async function generateContextualMessage(accountId, channelId, dominantTopic, sentiment, mood) {
    const memoryContext = await getMemoryContext(accountId, 5);
    const timeOfDay = new Date().getHours();
    let timeGreeting = '';
    
    if (timeOfDay < 12) timeGreeting = 'morning';
    else if (timeOfDay < 17) timeGreeting = 'afternoon';
    else timeGreeting = 'evening';
    
    const prompt = `it's ${timeGreeting}, chat has been quiet. start conversation about ${dominantTopic}. vibe is ${mood}. recent: ${memoryContext}`;
    
    const responseType = getResponseType(50);
    const enhancedPrompt = `${HUMAN_PROMPT}\n\n${responseType.instruction}`;
    
    return await generateAI(enhancedPrompt, prompt, channelId, null, 'general', accountId);
}

async function makeRequestWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.response?.status === 429) {
                const waitTime = (i + 1) * 5000;
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
            maxResponsesPerDay: userConfig.ai?.maxResponsesPerDay || 30,
            cooldownMinutes: userConfig.ai?.cooldownMinutes || 1,
            channelCooldownMinutes: userConfig.ai?.channelCooldownMinutes || 2,
            minMessageLength: userConfig.ai?.minMessageLength || 2,
            skipRate: userConfig.ai?.skipRate || 0.15,
            userCooldownMinutes: userConfig.ai?.userCooldownMinutes || 1,
            responseChance: userConfig.ai?.responseChance || 0.5,
            maxRepliesPerUser: userConfig.ai?.maxRepliesPerUser || 3,
            typingDelay: userConfig.ai?.typingDelay || 3000,
            historySize: userConfig.ai?.historySize || 8,
            autoSendEnabled: userConfig.ai?.autoSendEnabled || true,
            autoSendChance: userConfig.ai?.autoSendChance || 0.3,
            autoSendInterval: userConfig.ai?.autoSendInterval || 900000,
            respondToGeneral: userConfig.ai?.respondToGeneral || 0.3,
            respondToMention: userConfig.ai?.respondToMention || 0.8,
            respondToOtherMention: userConfig.ai?.respondToOtherMention || 0.1,
            minReplyWords: userConfig.ai?.minReplyWords || 2,
            maxReplyWords: userConfig.ai?.maxReplyWords || 20,
            gmEnabled: userConfig.gm?.enabled || true,
            gmTime: userConfig.gm?.time || "09:00",
            gmTimezone: userConfig.gm?.timezone || "Africa/Tunis",
            gmMessage: userConfig.gm?.message || "gm",
            apiRetryCount: userConfig.api?.retryCount || 3,
            apiTimeout: userConfig.api?.timeout || 8000,
            apiMaxTokens: userConfig.api?.maxTokens || 40,
            apiTemperature: userConfig.api?.temperature || 0.8,
            apiTopP: userConfig.api?.top_p || 0.9,
            replyStyle: userConfig.ai?.replyStyle || "smart",
            respectSlowMode: userConfig.ai?.respectSlowMode || true,
            promptLanguage: userConfig.ai?.promptLanguage || "en",
            apiKeyRotation: userConfig.ai?.apiKeyRotation || true,
            maxSlowMode: userConfig.ai?.maxSlowMode || 300,
            qualityFilter: userConfig.ai?.qualityFilter || true,
            personaEnabled: userConfig.ai?.personaEnabled || true,
            queueEnabled: userConfig.ai?.queueEnabled || true,
            addTypos: userConfig.ai?.addTypos || true,
            typoChance: userConfig.ai?.typoChance || 0.12,
            varyTypingSpeed: userConfig.ai?.varyTypingSpeed || true,
            typingVariation: userConfig.ai?.typingVariation || 0.4,
            addReactions: userConfig.ai?.addReactions || true,
            reactionChance: userConfig.ai?.reactionChance || 0.2,
            maxReactionsPerUser: userConfig.ai?.maxReactionsPerUser || 5,
            quietChannelChance: userConfig.ai?.quietChannelChance || 0.15,
            quietThreshold: userConfig.ai?.quietThreshold || 180,
            databaseEnabled: userConfig.ai?.databaseEnabled || true,
            bannedWordsEnabled: userConfig.ai?.bannedWordsEnabled || true,
            disfluenciesEnabled: userConfig.ai?.disfluenciesEnabled || true,
            selfCorrectionEnabled: userConfig.ai?.selfCorrectionEnabled || true,
            topicDetection: userConfig.ai?.topicDetection || true,
            userProfiles: userConfig.ai?.userProfiles || true
        };

        HUMAN_PROMPT = `you're a normal person in discord chat. lowercase only. ${botConfig.minReplyWords}-${botConfig.maxReplyWords} words max. no punctuation. talk naturally like a real person.`;

        logger.info(`Config loaded - max ${botConfig.maxResponsesPerDay} responses/day`);
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
    if (!botConfig.apiKeyRotation || aiConfig.models.length === 1) {
        return aiConfig.models[0];
    }

    const availableModels = aiConfig.models.filter(model => !usedApiKeys.has(model.apiKey));

    if (availableModels.length === 0) {
        logger.info("All API keys cooling down. Waiting...");
        setTimeout(() => usedApiKeys.clear(), 3600000);
        return aiConfig.models[Math.floor(Math.random() * aiConfig.models.length)];
    }

    return availableModels[Math.floor(Math.random() * availableModels.length)];
}

function getChannelPersona(channelName) {
    if (!botConfig.personaEnabled) return "normal";

    const name = channelName.toLowerCase();

    if (name.includes('crypto') || name.includes('trading') || name.includes('finance')) return "crypto";
    if (name.includes('game') || name.includes('gaming') || name.includes('play')) return "gamer";
    if (name.includes('tech') || name.includes('code') || name.includes('dev')) return "tech";
    if (name.includes('music') || name.includes('songs') || name.includes('beats')) return "music";
    if (name.includes('movie') || name.includes('film') || name.includes('tv')) return "movie";
    if (name.includes('food') || name.includes('cooking') || name.includes('recipes')) return "food";
    if (name.includes('anime') || name.includes('manga')) return "anime";
    if (name.includes('sports') || name.includes('ball')) return "sports";
    if (name.includes('general') || name.includes('chat') || name.includes('lounge')) return "casual";

    return "normal";
}

function applyPersonaToPrompt(prompt, persona) {
    if (!botConfig.personaEnabled || persona === "normal") return prompt;

    const personaPrompts = {
        "crypto": "you're into crypto and trading. use crypto slang sometimes.",
        "gamer": "you're a casual gamer. talk about games and gaming.",
        "tech": "you like tech and coding. keep it simple though.",
        "music": "you love music. mention songs or artists casually.",
        "movie": "you watch movies and shows. reference them sometimes.",
        "food": "you like food and cooking. talk about eating.",
        "anime": "you watch anime. mention shows casually.",
        "sports": "you follow sports. talk about games and players.",
        "casual": "you're just chatting. be normal and chill."
    };

    return `${personaPrompts[persona]}\n\n${prompt}`;
}

async function generateAI(systemPrompt, userPrompt, channelName, originalMessage, persona, accountId = 'default') {
    const fullSystemPrompt = applyPersonaToPrompt(systemPrompt, persona);
    
    const topic = detectTopic(userPrompt);
    const sentiment = analyzeSentiment(userPrompt);
    const mood = getBotMood(sentiment);
    const responseType = getResponseType(userPrompt.length);
    
    let enhancedPrompt = fullSystemPrompt;
    
    enhancedPrompt += `\n\ntopic: ${topic}. stay on topic.`;
    enhancedPrompt += `\nvibe: ${mood}. match this energy.`;
    enhancedPrompt += `\navoid words: ${bannedWords.join(', ')}.`;
    enhancedPrompt += `\nbe natural. use filler words sometimes (um, like, well).`;
    enhancedPrompt += `\nsometimes correct yourself (wait no, i mean).`;
    enhancedPrompt += `\n\n${responseType.instruction}. be casual. lowercase only.`;

    let currentModel;
    let retryCount = 0;
    const currentTemperature = botConfig.apiTemperature;

    if (!rateLimiters[accountId]) {
        rateLimiters[accountId] = new RateLimiter(20, 60000);
    }

    while (retryCount < botConfig.apiRetryCount) {
        try {
            if (!rateLimiters[accountId].canMakeRequest()) {
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            currentModel = getRandomApiKey();

            logger.info(`🔑 [${channelName}] using ${currentModel.provider}`);

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

                const forbidden = ["as an ai", "as an assistant", "i'm an ai", "i am an ai", "language model", "bot", "ai language model"];
                if (forbidden.some(word => res.includes(word))) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                if (res === lastGeneratedText) {
                    retryCount++;
                    continue;
                }

                res = sanitizeMessage(res);
                
                if (Math.random() < 0.25) {
                    res = addDisfluencies(res, 0.3);
                }
                
                if (Math.random() < 0.15) {
                    res = addSelfCorrection(res, 0.1);
                }
                
                if (Math.random() < 0.2) {
                    res = addTypo(res, 0.15);
                }
                
                res += getRandomEmojis(1, mood, 0.15);

                const words = res.split(' ').length;
                if (words < botConfig.minReplyWords || words > botConfig.maxReplyWords) {
                    retryCount++;
                    continue;
                }

                lastGeneratedText = res;
                logger.info(`🤖 [${channelName}] generated: "${res.substring(0, 40)}..."`);
                
                if (botConfig.databaseEnabled) {
                    addToMemory(accountId, null, 'system', userPrompt, res, topic);
                }
                
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

                const forbidden = ["as an ai", "as an assistant", "i'm an ai", "i am an ai", "language model", "bot", "ai language model"];
                if (forbidden.some(word => res.includes(word))) {
                    usedApiKeys.add(currentModel.apiKey);
                    retryCount++;
                    continue;
                }

                if (res === lastGeneratedText) {
                    retryCount++;
                    continue;
                }

                res = sanitizeMessage(res);
                
                if (Math.random() < 0.25) {
                    res = addDisfluencies(res, 0.3);
                }
                
                if (Math.random() < 0.15) {
                    res = addSelfCorrection(res, 0.1);
                }
                
                if (Math.random() < 0.2) {
                    res = addTypo(res, 0.15);
                }
                
                res += getRandomEmojis(1, mood, 0.15);

                const words = res.split(' ').length;
                if (words < botConfig.minReplyWords || words > botConfig.maxReplyWords) {
                    retryCount++;
                    continue;
                }

                lastGeneratedText = res;
                logger.info(`🤖 [${channelName}] generated: "${res.substring(0, 40)}..."`);
                
                if (botConfig.databaseEnabled) {
                    addToMemory(accountId, null, 'system', userPrompt, res, topic);
                }
                
                return res.replace(/^["']|["']$/g, '').trim();
            }

        } catch (error) {
            if (error.response?.status === 429) {
                if (currentModel) usedApiKeys.add(currentModel.apiKey);
                logger.info(`Rate limited on ${currentModel?.provider}, switching...`);
            }
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    return null;
}

async function getChannelInfo(channel) {
    try {
        const fetchedChannel = await channel.fetch();
        const channelName = fetchedChannel.name || 'unknown';
        let serverName = 'DM';

        if (fetchedChannel.guild) {
            serverName = fetchedChannel.guild.name || 'unknown';
        }

        return { serverName, channelName };
    } catch (error) {
        return { serverName: 'unknown', channelName: 'unknown' };
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
            logger.error(`❌ Message blocked: "${reply.substring(0, 20)}..."`);
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
    
    if (message.reference && message.reference.messageId) {
        return true;
    }
    
    return false;
}

function updateUserTrust(userId, positive) {
    if (!userTrustScores[userId]) {
        userTrustScores[userId] = { score: 5, interactions: 0 };
    }
    
    userTrustScores[userId].interactions++;
    
    if (positive) {
        userTrustScores[userId].score = Math.min(10, userTrustScores[userId].score + 1);
    } else {
        userTrustScores[userId].score = Math.max(1, userTrustScores[userId].score - 2);
    }
}

function shouldRespondToUser(userId) {
    const trust = userTrustScores[userId];
    if (!trust) return true;
    
    if (trust.score < 3 && trust.interactions > 5) return false;
    return true;
}

async function initializeAccount(account) {
    const client = new DiscordClient({ checkUpdate: false });

    client.once('ready', async () => {
        logger.info(`${account.name} - Logged in`);

        if (botConfig.databaseEnabled) {
            dbConnections[account.name] = initDatabase(account.name);
            await loadUserProfiles(account.name);
        }

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
                        try {
                            const recentMessages = await channel.messages.fetch({ limit: 8 });
                            const nonBotMessages = recentMessages.filter(m => !m.author.bot);
                            
                            if (nonBotMessages.size === 0) continue;
                            
                            const topics = nonBotMessages.map(m => detectTopic(m.content));
                            const sentiments = nonBotMessages.map(m => analyzeSentiment(m.content));
                            
                            const dominantTopic = topics.sort((a,b) => 
                                topics.filter(v => v===a).length - topics.filter(v => v===b).length
                            ).pop() || 'general';
                            
                            const dominantSentiment = sentiments.sort((a,b) => 
                                sentiments.filter(v => v===a).length - sentiments.filter(v => v===b).length
                            ).pop() || 'neutral';
                            
                            const mood = getBotMood(dominantSentiment);
                            
                            const dailyTotal = dailyResponseCount[account.name] || 0;
                            if (dailyTotal >= botConfig.maxResponsesPerDay) continue;
                            
                            const response = await generateContextualMessage(account.name, channel.id, dominantTopic, dominantSentiment, mood);
                            
                            if (response) {
                                try { await channel.sendTyping(); } catch {}
                                
                                const typingTime = calculateTypingTime(response);
                                setTimeout(async () => {
                                    await channel.send(response);
                                    logger.info(`📤 Started conversation: "${response.substring(0, 30)}..."`);
                                    
                                    dailyResponseCount[account.name] = (dailyResponseCount[account.name] || 0) + 1;
                                    
                                    if (botConfig.databaseEnabled) {
                                        addToMemory(account.name, null, 'system', 'quiet channel start', response, dominantTopic);
                                    }
                                }, typingTime * 1000);
                            }
                        } catch (error) {
                            logger.error(`Error starting conversation: ${error.message}`);
                        }
                    }
                }
            }
        }, botConfig.autoSendInterval || 900000);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.id === client.user.id) return;
        if (message.author.bot) return;
        if (message.content.length < botConfig.minMessageLength) return;
        if (shouldSkipMessageType(message)) return;

        const chCfg = account.channels.find(c => c.id === message.channel.id);
        if (!chCfg || !chCfg.useAI) return;

        const dailyTotal = dailyResponseCount[account.name] || 0;
        if (dailyTotal >= botConfig.maxResponsesPerDay) return;

        channelLastMessageTime[message.channel.id] = Date.now();

        const channelId = message.channel.id;
        const userId = message.author.id;
        const now = Date.now();

        if (userLastMessageTime[userId] && (now - userLastMessageTime[userId]) < (botConfig.userCooldownMinutes * 60 * 1000)) {
            return;
        }
        userLastMessageTime[userId] = now;

        const channelInfo = await getCachedChannelInfo(message.channel);
        const persona = getChannelPersona(channelInfo.channelName);
        const username = message.author.username;
        const displayName = `${channelInfo.serverName}/${channelInfo.channelName}`;

        if (botConfig.userProfiles) {
            const prefs = extractUserPreferences(message.content);
            if (Object.keys(prefs).length > 0) {
                saveUserProfile(account.name, userId, username, prefs);
            }
        }

        if (isLowValueContent(message)) {
            if (Math.random() > 0.1) return;
        }

        if (!messageHistory[channelId]) messageHistory[channelId] = [];
        messageHistory[channelId].push(`${username}: ${message.content}`);
        if (messageHistory[channelId].length > botConfig.historySize) {
            messageHistory[channelId].shift();
        }

        if (botConfig.databaseEnabled) {
            addToUserMemory(userId, channelId, username, message.content);
        }

        logger.info(`📨 [${displayName}] ${username}: ${message.content.substring(0, 40)}...`);

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

        if (!shouldRespondToUser(userId)) {
            logger.info(`Skipping low trust user ${username}`);
            return;
        }

        const userResponseCount_key = `${account.name}_${userId}`;
        userResponseCount[userResponseCount_key] = (userResponseCount[userResponseCount_key] || 0) + 1;
        if (userResponseCount[userResponseCount_key] > botConfig.maxRepliesPerUser) return;

        if (botConfig.databaseEnabled) {
            const hasResp = await hasResponded(account.name, message.id);
            if (hasResp) return;
        }

        addToQueue(channelId, async () => {
            const topic = detectTopic(message.content);
            const sentiment = analyzeSentiment(message.content);
            const mood = getBotMood(sentiment);
            
            let memoryContext = '';
            let userContext = '';
            
            if (botConfig.databaseEnabled) {
                memoryContext = await getMemoryContext(account.name);
                const userMemory = getUserMemory(userId, channelId);
                const userProfile = getUserProfile(account.name, userId);
                
                userContext = Object.entries(userProfile)
                    .filter(([k]) => !['username', 'lastSeen', 'interactionCount'].includes(k))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
            }

            const history = messageHistory[channelId].slice(-5).join('\n');

            const reply = await generateAI(
                `${HUMAN_PROMPT}\n\nUser: ${username}\nPreferences: ${userContext || 'none'}\n\nRecent chat:\n${history}`,
                `reply to ${username}: "${message.content}" - be ${mood}, vibe is ${sentiment}`,
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
                        logger.info(`📤 [${displayName}] @${username}: "${reply.substring(0, 30)}..."`);
                        
                        dailyResponseCount[account.name] = (dailyResponseCount[account.name] || 0) + 1;
                        
                        if (botConfig.databaseEnabled) {
                            addToMemory(account.name, message.id, username, message.content, reply, topic);
                        }
                        
                        updateUserTrust(userId, true);
                    } else {
                        updateUserTrust(userId, false);
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
    userMessageCount = {};
    sentResponses.clear();
    skippedChannels.clear();
    userResponseCount = {};
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
    console.log('🤖 Discord AI Bot - Human Edition\n');

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
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`\n✅ Running with ${activeClients.length} accounts`);
    console.log(`📊 Max responses per day: ${botConfig.maxResponsesPerDay}`);
    console.log(`🤖 Response chance: ${botConfig.responseChance * 100}%`);
    console.log(`💬 Reply length: ${botConfig.minReplyWords}-${botConfig.maxReplyWords} words\n`);
}

console.log('══════════════════════════════');
console.log('🤖 Discord AI Bot - Human Edition');
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

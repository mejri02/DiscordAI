const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

console.log('══════════════════════════════');
console.log('🤖 COMPLETE BOT SETUP - ENHANCED EDITION');
console.log('══════════════════════════════\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function createConfig() {
    console.log('📝 Creating configuration files...\n');
    
    const config = {
        ai: {
            maxResponsesPerDay: 50,
            cooldownMinutes: 0.5,
            channelCooldownMinutes: 1,
            minMessageLength: 3,
            skipRate: 0.20,
            userCooldownMinutes: 0.5,
            responseChance: 0.60,
            maxRepliesPerUser: 3,
            typingDelay: 2000,
            historySize: 5,
            autoSendEnabled: true,
            autoSendChance: 0.50,
            autoSendInterval: 900000,
            respondToGeneral: 0.40,
            respondToMention: 0.90,
            respondToOtherMention: 0.05,
            minReplyWords: 2,
            maxReplyWords: 15,
            replyStyle: "smart",
            respectSlowMode: true,
            promptLanguage: "en",
            useMessageFile: false,
            apiKeyRotation: true,
            maxSlowMode: 300,
            qualityFilter: true,
            personaEnabled: true,
            queueEnabled: true,
            addTypos: true,
            typoChance: 0.15,
            varyTypingSpeed: true,
            typingVariation: 0.3,
            addReactions: true,
            reactionChance: 0.3,
            maxReactionsPerUser: 5,
            databaseEnabled: true,
            bannedWordsEnabled: true,
            disfluenciesEnabled: true,
            selfCorrectionEnabled: true,
            topicDetection: true,
            userProfiles: true
        },
        gm: {
            enabled: true,
            time: "09:00",
            timezone: "Africa/Tunis",
            message: "gm"
        },
        api: {
            retryCount: 3,
            timeout: 5000,
            maxTokens: 35,
            temperature: 0.7,
            top_p: 0.9
        }
    };
    
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('✅ Created config.json with enhanced features');
    
    console.log('\n✨ Enhanced Features Enabled:');
    console.log('   - Database Memory (SQLite)');
    console.log('   - Banned Words Filtering');
    console.log('   - Human-like Disfluencies (um, well, like)');
    console.log('   - Self-Corrections (wait no, i mean)');
    console.log('   - Topic Detection');
    console.log('   - User Profiles');
}

async function setupDiscord() {
    console.log('\n🔧 Discord Token Setup');
    console.log('──────────────────────\n');
    
    console.log('📖 How to get Discord user token:');
    console.log('1. Open Discord in browser (Chrome/Firefox)');
    console.log('2. Press F12 for Developer Tools');
    console.log('3. Go to Network tab');
    console.log('4. Send any message in Discord');
    console.log('5. Find the request to "messages"');
    console.log('6. Look for "authorization" header');
    console.log('7. Copy the token (starts with MTI...)\n');
    
    const token = await question('Enter your Discord user token: ');
    
    const accounts = [{
        name: "Main Bot",
        token: token.trim(),
        channels: []
    }];
    
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
    console.log('\n✅ Created accounts.json');
    
    return token;
}

async function setupAI() {
    console.log('\n🤖 AI API Configuration');
    console.log('──────────────────────\n');
    
    console.log('Select AI provider:');
    console.log('1. Grok API (xAI)');
    console.log('2. OpenAI');
    console.log('3. Google Gemini');
    console.log('4. Custom API');
    
    const choice = await question('\nEnter choice (1-4): ');
    
    let apiConfig;
    switch(choice) {
        case '1':
            console.log('\n🔑 Grok API Setup:');
            const grokKey = await question('Enter your Grok API key: ');
            apiConfig = {
                models: [{
                    name: "Grok API",
                    provider: "xai",
                    apiKey: grokKey,
                    endpoint: "https://api.x.ai/v1/chat/completions",
                    modelName: "grok-beta",
                    enabled: true
                }]
            };
            console.log('✅ Configured Grok API');
            break;
            
        case '2':
            const openaiKey = await question('Enter OpenAI API key: ');
            apiConfig = {
                models: [{
                    name: "OpenAI GPT-3.5",
                    provider: "openai",
                    apiKey: openaiKey,
                    endpoint: "https://api.openai.com/v1/chat/completions",
                    modelName: "gpt-3.5-turbo",
                    enabled: true
                }]
            };
            console.log('✅ Configured OpenAI');
            break;
            
        case '3':
            const googleKey = await question('Enter Google API key: ');
            apiConfig = {
                models: [{
                    name: "Google Gemini",
                    provider: "google",
                    apiKey: googleKey,
                    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
                    modelName: "gemini-pro",
                    enabled: true
                }]
            };
            console.log('✅ Configured Google Gemini');
            break;
            
        case '4':
            const customEndpoint = await question('Enter API endpoint: ');
            const customKey = await question('Enter API key: ');
            const customModel = await question('Enter model name: ');
            apiConfig = {
                models: [{
                    name: "Custom API",
                    provider: "custom",
                    apiKey: customKey,
                    endpoint: customEndpoint,
                    modelName: customModel,
                    enabled: true
                }]
            };
            console.log('✅ Configured Custom API');
            break;
            
        default:
            console.log('⚠️  Using fallback responses');
            apiConfig = { models: [] };
    }
    
    // Add multiple API keys option
    console.log('\n🔄 API Key Rotation');
    console.log('──────────────────────');
    const addMore = await question('Do you want to add more API keys for rotation? (y/n): ');
    
    if (addMore.toLowerCase() === 'y') {
        const moreKeys = await question('How many additional keys? (1-5): ');
        const count = parseInt(moreKeys) || 0;
        
        for (let i = 0; i < count; i++) {
            console.log(`\n🔑 Additional Key #${i + 1}:`);
            const extraKey = await question('Enter API key: ');
            
            apiConfig.models.push({
                name: `${apiConfig.models[0].name} #${i + 2}`,
                provider: apiConfig.models[0].provider,
                apiKey: extraKey,
                endpoint: apiConfig.models[0].endpoint,
                modelName: apiConfig.models[0].modelName,
                enabled: true
            });
        }
    }
    
    fs.writeFileSync('api_keys.json', JSON.stringify(apiConfig, null, 2));
    console.log(`\n✅ Created api_keys.json with ${apiConfig.models.length} model(s)`);
}

async function fetchChannelsAuto() {
    console.log('\n🔍 Auto Channel Fetch');
    console.log('──────────────────────\n');
    
    if (!fs.existsSync('accounts.json')) {
        console.log('❌ accounts.json not found. Run setup first.');
        return;
    }
    
    const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
    if (accounts.length === 0) {
        console.log('❌ No accounts configured');
        return;
    }
    
    const account = accounts[0];
    
    try {
        const userResponse = await axios.get('https://discord.com/api/v9/users/@me', {
            headers: { 'Authorization': account.token }
        });
        
        console.log(`✅ Token valid for ${userResponse.data.username}`);
        
        const guildsResponse = await axios.get('https://discord.com/api/v9/users/@me/guilds', {
            headers: { 'Authorization': account.token }
        });
        
        const guilds = guildsResponse.data;
        
        if (guilds.length === 0) {
            console.log('❌ No servers found');
            return;
        }
        
        console.log(`\n🏰 Found ${guilds.length} servers:`);
        console.log('══════════════════════════════\n');
        
        guilds.forEach((guild, index) => {
            console.log(`${index + 1}. ${guild.name} (${guild.id})`);
        });
        
        let continueAdding = true;
        
        while (continueAdding) {
            console.log('\n══════════════════════════════');
            const serverChoice = await question('\nSelect server number (or "q" to quit): ');
            
            if (serverChoice.toLowerCase() === 'q') {
                continueAdding = false;
                continue;
            }
            
            const serverIndex = parseInt(serverChoice) - 1;
            
            if (isNaN(serverIndex) || serverIndex < 0 || serverIndex >= guilds.length) {
                console.log('❌ Invalid server selection');
                continue;
            }
            
            const selectedGuild = guilds[serverIndex];
            console.log(`\n✅ Selected Server: ${selectedGuild.name}`);
            console.log('──────────────────────────────');
            
            const channelsResponse = await axios.get(`https://discord.com/api/v9/guilds/${selectedGuild.id}/channels`, {
                headers: { 'Authorization': account.token }
            });
            
            const textChannels = channelsResponse.data.filter(ch => ch.type === 0);
            
            if (textChannels.length === 0) {
                console.log('❌ No text channels found in this server');
                continue;
            }
            
            console.log(`\n📺 Channels in ${selectedGuild.name}:`);
            console.log('──────────────────────────────');
            
            textChannels.forEach((channel, index) => {
                console.log(`${index + 1}. #${channel.name} (${channel.id})`);
            });
            
            console.log('\n──────────────────────────────');
            const channelChoice = await question('Enter channel numbers to add (comma-separated, or "all"): ');
            
            let channelsToAdd = [];
            if (channelChoice.toLowerCase() === 'all') {
                channelsToAdd = textChannels;
            } else {
                const indices = channelChoice.split(',').map(num => parseInt(num.trim()) - 1);
                channelsToAdd = indices.filter(idx => idx >= 0 && idx < textChannels.length)
                                      .map(idx => textChannels[idx]);
            }
            
            console.log('\n──────────────────────────────');
            for (const channel of channelsToAdd) {
                const defaultName = `${selectedGuild.name} / ${channel.name}`;
                console.log(`\nChannel: #${channel.name}`);
                const nameChoice = await question(`Save as [${defaultName}]: `);
                const channelName = nameChoice.trim() || defaultName;
                
                if (!account.channels) account.channels = [];
                
                const existing = account.channels.findIndex(c => c.id === channel.id);
                if (existing !== -1) {
                    account.channels[existing] = {
                        id: channel.id,
                        name: channelName,
                        useAI: true
                    };
                    console.log(`   ✅ Updated: ${channelName}`);
                } else {
                    account.channels.push({
                        id: channel.id,
                        name: channelName,
                        useAI: true
                    });
                    console.log(`   ✅ Added: ${channelName}`);
                }
            }
            
            fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
            console.log('\n💾 Saved to accounts.json');
            
            console.log('\n──────────────────────────────');
            console.log('What would you like to do next?');
            console.log('1. Add more channels from this server');
            console.log('2. Choose another server');
            console.log('3. Configure channel personas');
            console.log('4. Finish and start bot');
            console.log('5. Exit setup');
            
            const nextChoice = await question('\nSelect option (1-5): ');
            
            switch(nextChoice) {
                case '1':
                    continue;
                case '2':
                    console.log('\n🏰 Available Servers:');
                    guilds.forEach((guild, index) => {
                        console.log(`${index + 1}. ${guild.name}`);
                    });
                    continue;
                case '3':
                    await configurePersonas(account);
                    break;
                case '4':
                    console.log('\n🚀 Starting bot...');
                    console.log('💡 Run: node main.js');
                    continueAdding = false;
                    break;
                case '5':
                    console.log('\n👋 Setup completed!');
                    continueAdding = false;
                    break;
                default:
                    console.log('❌ Invalid option, returning to server list');
            }
        }
        
        console.log('\n🎉 Channel setup complete!');
        
    } catch (error) {
        console.log(`\n❌ Error: ${error.response?.data?.message || error.message}`);
        if (error.response?.status === 401) {
            console.log('⚠️  Invalid Discord token. Please check your token.');
        }
    }
}

async function configurePersonas(account) {
    console.log('\n🎭 Channel Persona Configuration');
    console.log('──────────────────────────────\n');
    
    console.log('Available personas:');
    console.log('1. normal - Casual conversation');
    console.log('2. crypto - Crypto enthusiast (wen moon, HODL)');
    console.log('3. gamer - Gaming talk (gg, skill issue)');
    console.log('4. tech - Technology discussions');
    console.log('5. music - Music lover');
    console.log('6. movie - Movie buff');
    
    for (const channel of account.channels) {
        console.log(`\n📺 Channel: ${channel.name}`);
        console.log(`Current: normal`);
        
        const personaChoice = await question('Select persona (1-6, or press Enter to keep default): ');
        
        const personas = ['normal', 'crypto', 'gamer', 'tech', 'music', 'movie'];
        const index = parseInt(personaChoice) - 1;
        
        if (index >= 0 && index < personas.length) {
            channel.persona = personas[index];
            console.log(`✅ Set to: ${personas[index]}`);
        }
    }
    
    fs.writeFileSync('accounts.json', JSON.stringify([account], null, 2));
    console.log('\n💾 Personas saved to accounts.json');
}

async function addChannelManual() {
    console.log('\n✏️  Manual Channel Addition');
    console.log('──────────────────────\n');
    
    if (!fs.existsSync('accounts.json')) {
        console.log('❌ accounts.json not found');
        return;
    }
    
    const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
    const account = accounts[0];
    
    console.log('Enter channel details:');
    const channelId = await question('Channel ID: ');
    const channelName = await question('Channel Name: ');
    
    console.log('\nSelect channel persona:');
    console.log('1. normal');
    console.log('2. crypto');
    console.log('3. gamer');
    console.log('4. tech');
    console.log('5. music');
    console.log('6. movie');
    
    const personaChoice = await question('Select (1-6, default 1): ');
    const personas = ['normal', 'crypto', 'gamer', 'tech', 'music', 'movie'];
    const index = parseInt(personaChoice) - 1;
    const persona = (index >= 0 && index < personas.length) ? personas[index] : 'normal';
    
    if (!account.channels) account.channels = [];
    
    const existing = account.channels.findIndex(c => c.id === channelId);
    if (existing !== -1) {
        account.channels[existing] = {
            id: channelId,
            name: channelName,
            persona: persona,
            useAI: true
        };
        console.log(`✅ Updated channel: ${channelName} (${persona})`);
    } else {
        account.channels.push({
            id: channelId,
            name: channelName,
            persona: persona,
            useAI: true
        });
        console.log(`✅ Added channel: ${channelName} (${persona})`);
    }
    
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
    console.log('💾 Saved to accounts.json');
}

async function viewConfig() {
    console.log('\n📊 Current Configuration');
    console.log('──────────────────────\n');
    
    if (fs.existsSync('config.json')) {
        console.log('✅ config.json - Present');
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        console.log(`   Max Responses/Day: ${config.ai?.maxResponsesPerDay || 50}`);
        console.log(`   Features: Database, Topic Detection, Banned Words, Disfluencies`);
    } else {
        console.log('❌ config.json - Missing');
    }
    
    if (fs.existsSync('accounts.json')) {
        const acc = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
        console.log(`✅ accounts.json - ${acc.length} account(s)`);
        if (acc[0]?.channels) {
            console.log(`   Channels: ${acc[0].channels.length}`);
            acc[0].channels.forEach((ch, idx) => {
                const persona = ch.persona || 'normal';
                console.log(`   ${idx + 1}. ${ch.name} (${persona}) - AI: ${ch.useAI ? '✅' : '❌'}`);
            });
        }
    } else {
        console.log('❌ accounts.json - Missing');
    }
    
    if (fs.existsSync('api_keys.json')) {
        console.log('✅ api_keys.json - Present');
        const api = JSON.parse(fs.readFileSync('api_keys.json', 'utf8'));
        console.log(`   AI Models: ${api.models?.length || 0}`);
        api.models?.forEach((model, idx) => {
            console.log(`   ${idx + 1}. ${model.name} (${model.provider})`);
        });
    }
    
    // Check for database files
    const dbFiles = fs.readdirSync('.').filter(f => f.startsWith('conversations_') && f.endsWith('.db'));
    if (dbFiles.length > 0) {
        console.log(`\n📊 Database Files: ${dbFiles.length}`);
        dbFiles.forEach(db => console.log(`   - ${db}`));
    }
}

async function setupMultipleAccounts() {
    console.log('\n👥 Multi-Account Setup');
    console.log('──────────────────────\n');
    
    const accountCount = await question('How many Discord accounts to configure? (1-3): ');
    const count = parseInt(accountCount) || 1;
    
    const accounts = [];
    
    for (let i = 0; i < Math.min(count, 3); i++) {
        console.log(`\n🔐 Account #${i + 1}:`);
        const name = await question(`Account name (default: Bot ${i + 1}): `) || `Bot ${i + 1}`;
        const token = await question('Discord token: ');
        
        accounts.push({
            name: name,
            token: token.trim(),
            channels: []
        });
    }
    
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
    console.log(`\n✅ Created accounts.json with ${accounts.length} account(s)`);
}

async function main() {
    console.log('\n🔧 Setup Menu:');
    console.log('1. Complete Auto Setup (Recommended)');
    console.log('2. Quick Setup (Config + Discord + AI)');
    console.log('3. Fetch Channels Automatically');
    console.log('4. Add Channel Manually');
    console.log('5. Configure Multiple Accounts');
    console.log('6. Configure Channel Personas');
    console.log('7. View Current Configuration');
    console.log('8. Start Bot');
    console.log('9. Exit');
    
    const choice = await question('\nSelect option: ');
    
    switch(choice) {
        case '1':
            await createConfig();
            await setupDiscord();
            await setupAI();
            await fetchChannelsAuto();
            break;
            
        case '2':
            await createConfig();
            await setupDiscord();
            await setupAI();
            break;
            
        case '3':
            await fetchChannelsAuto();
            break;
            
        case '4':
            await addChannelManual();
            break;
            
        case '5':
            await setupMultipleAccounts();
            break;
            
        case '6':
            if (fs.existsSync('accounts.json')) {
                const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
                await configurePersonas(accounts[0]);
            } else {
                console.log('❌ accounts.json not found');
            }
            break;
            
        case '7':
            await viewConfig();
            break;
            
        case '8':
            console.log('\n🚀 Starting bot...');
            console.log('💡 Run: node main.js');
            console.log('   Then choose option 1 to start the bot\n');
            break;
            
        case '9':
            console.log('👋 Goodbye!');
            break;
            
        default:
            console.log('❌ Invalid option');
    }
    
    rl.close();
}

main();

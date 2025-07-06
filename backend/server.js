const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "poll-bot"
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Bot state
let isReady = false;
let scheduledPolls = [];
let activeGroups = [];
let activeTimeouts = new Map(); // Store active timeouts for cancellation

// Load scheduled polls from file
const loadScheduledPolls = () => {
    try {
        if (fs.existsSync('scheduled_polls.json')) {
            const data = fs.readFileSync('scheduled_polls.json', 'utf8');
            scheduledPolls = JSON.parse(data);
            console.log('Loaded scheduled polls:', scheduledPolls.length);
        }
    } catch (error) {
        console.error('Error loading scheduled polls:', error);
        scheduledPolls = [];
    }
};

// Save scheduled polls to file
const saveScheduledPolls = () => {
    try {
        fs.writeFileSync('scheduled_polls.json', JSON.stringify(scheduledPolls, null, 2));
        console.log('Saved scheduled polls to file');
    } catch (error) {
        console.error('Error saving scheduled polls:', error);
    }
};

// WhatsApp client events
client.on('qr', (qr) => {
    console.log('QR Code received, scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('WhatsApp client is ready!');
    isReady = true;
    
    // Load existing scheduled polls
    loadScheduledPolls();
    
    // Get all groups
    const chats = await client.getChats();
    activeGroups = chats.filter(chat => chat.isGroup);
    console.log(`Found ${activeGroups.length} groups`);
    
    // Setup scheduled polls
    setupScheduledPolls();
});

client.on('message', async (message) => {
    if (!message.fromMe && message.body.toLowerCase().includes('!help')) {
        const helpText = `
🤖 *Poll Bot Commands:*

• *!help* - Show this help message
• *!groups* - List all available groups
• *!polls* - Show scheduled polls
• *!delete [id]* - Delete scheduled poll (admin only)

*Use the web interface to create and schedule polls*
`;
        await message.reply(helpText);
    }
    
    if (!message.fromMe && message.body.toLowerCase() === '!groups') {
        let groupList = '*Available Groups:*\n\n';
        activeGroups.forEach((group, index) => {
            groupList += `${index + 1}. ${group.name}\n`;
        });
        await message.reply(groupList);
    }
    
    if (!message.fromMe && message.body.toLowerCase() === '!polls') {
        if (scheduledPolls.length === 0) {
            await message.reply('No scheduled polls found.');
            return;
        }
        
        let pollsList = '*Scheduled Polls:*\n\n';
        scheduledPolls.forEach((poll, index) => {
            pollsList += `${index + 1}. *${poll.question}*\n`;
            pollsList += `   Group: ${poll.groupName}\n`;
            pollsList += `   Scheduled: ${new Date(poll.scheduledTime).toLocaleString()}\n`;
            pollsList += `   Status: ${poll.status || 'pending'}\n`;
            pollsList += `   ID: ${poll.id}\n\n`;
        });
        await message.reply(pollsList);
    }
});

client.on('authenticated', () => {
    console.log('WhatsApp client authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    isReady = false;
});

// Setup scheduled polls
const setupScheduledPolls = () => {
    scheduledPolls.forEach(pollData => {
        if (pollData.status === 'pending') {
            const scheduledTime = new Date(pollData.scheduledTime);
            const now = new Date();
            
            if (scheduledTime > now) {
                const timeUntilExecution = scheduledTime.getTime() - now.getTime();
                
                const timeoutId = setTimeout(async () => {
                    await sendScheduledPoll(pollData);
                    activeTimeouts.delete(pollData.id);
                }, timeUntilExecution);
                
                activeTimeouts.set(pollData.id, timeoutId);
                console.log(`Scheduled poll: ${pollData.question} at ${scheduledTime.toLocaleString()}`);
            } else {
                // Mark as failed if scheduled time has passed
                pollData.status = 'failed';
                pollData.failureReason = 'Scheduled time has passed';
                saveScheduledPolls();
            }
        }
    });
};

// Send scheduled poll
const sendScheduledPoll = async (pollData) => {
    try {
        const group = activeGroups.find(g => g.id._serialized === pollData.groupId);
        if (!group) {
            console.error('Group not found for poll:', pollData.groupName);
            pollData.status = 'failed';
            pollData.failureReason = 'Group not found';
            saveScheduledPolls();
            return;
        }
        
        const poll = new Poll(pollData.question, pollData.options);
        await group.sendMessage(poll);
        console.log(`Sent scheduled poll to ${pollData.groupName}: ${pollData.question}`);
        
        // Update poll status
        pollData.status = 'sent';
        pollData.sentAt = new Date().toISOString();
        saveScheduledPolls();
        
    } catch (error) {
        console.error('Error sending scheduled poll:', error);
        pollData.status = 'failed';
        pollData.failureReason = error.message;
        saveScheduledPolls();
    }
};

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: isReady ? 'ready' : 'not ready',
        groupCount: activeGroups.length,
        scheduledPollCount: scheduledPolls.length
    });
});

app.get('/api/groups', (req, res) => {
    if (!isReady) {
        return res.status(400).json({ error: 'Bot not ready' });
    }
    
    const groups = activeGroups.map(group => ({
        id: group.id._serialized,
        name: group.name,
        participants: group.participants ? group.participants.length : 0
    }));
    
    res.json(groups);
});

app.get('/api/polls', (req, res) => {
    res.json(scheduledPolls);
});

app.post('/api/schedule-poll', (req, res) => {
    if (!isReady) {
        return res.status(400).json({ error: 'Bot not ready' });
    }
    
    const { groupId, question, options, scheduledTime } = req.body;
    
    if (!groupId || !question || !options || !scheduledTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'Options must be an array with at least 2 items' });
    }
    
    // Validate scheduled time
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    
    if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled time format' });
    }
    
    if (scheduledDate <= now) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }
    
    const group = activeGroups.find(g => g.id._serialized === groupId);
    if (!group) {
        return res.status(400).json({ error: 'Group not found' });
    }
    
    const pollId = Date.now().toString();
    const pollData = {
        id: pollId,
        groupId,
        groupName: group.name,
        question,
        options,
        scheduledTime: scheduledDate.toISOString(),
        status: 'pending',
        created: new Date().toISOString(),
        sentAt: null,
        failureReason: null
    };
    
    scheduledPolls.push(pollData);
    saveScheduledPolls();
    
    // Schedule the poll
    const timeUntilExecution = scheduledDate.getTime() - now.getTime();
    const timeoutId = setTimeout(async () => {
        await sendScheduledPoll(pollData);
        activeTimeouts.delete(pollId);
    }, timeUntilExecution);
    
    activeTimeouts.set(pollId, timeoutId);
    
    console.log(`Scheduled new poll: ${question} for group ${group.name} at ${scheduledDate.toLocaleString()}`);
    res.json({ success: true, pollId, message: 'Poll scheduled successfully' });
});

app.post('/api/send-poll', async (req, res) => {
    if (!isReady) {
        return res.status(400).json({ error: 'Bot not ready' });
    }
    
    const { groupId, question, options } = req.body;
    
    if (!groupId || !question || !options) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'Options must be an array with at least 2 items' });
    }
    
    try {
        const group = activeGroups.find(g => g.id._serialized === groupId);
        if (!group) {
            return res.status(400).json({ error: 'Group not found' });
        }
        
        const poll = new Poll(question, options);
        await group.sendMessage(poll);
        
        res.json({ success: true, message: 'Poll sent successfully' });
    } catch (error) {
        console.error('Error sending poll:', error);
        res.status(500).json({ error: 'Failed to send poll' });
    }
});

app.delete('/api/polls/:pollId', (req, res) => {
    const { pollId } = req.params;
    
    const pollIndex = scheduledPolls.findIndex(p => p.id === pollId);
    if (pollIndex === -1) {
        return res.status(404).json({ error: 'Poll not found' });
    }
    
    const poll = scheduledPolls[pollIndex];
    
    // Cancel the timeout if it exists and poll is still pending
    if (poll.status === 'pending' && activeTimeouts.has(pollId)) {
        clearTimeout(activeTimeouts.get(pollId));
        activeTimeouts.delete(pollId);
    }
    
    scheduledPolls.splice(pollIndex, 1);
    saveScheduledPolls();
    
    res.json({ success: true, message: 'Poll deleted successfully' });
});

app.put('/api/polls/:pollId/toggle', (req, res) => {
    const { pollId } = req.params;
    
    const poll = scheduledPolls.find(p => p.id === pollId);
    if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Only allow toggling for pending polls
    if (poll.status !== 'pending') {
        return res.status(400).json({ error: 'Can only toggle pending polls' });
    }
    
    // This endpoint is not really needed for one-time scheduling
    // but keeping it for compatibility
    res.json({ success: true, message: 'Toggle not applicable for one-time polls' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize WhatsApp client
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    
    // Clear all active timeouts
    activeTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
    });
    activeTimeouts.clear();
    
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    
    // Clear all active timeouts
    activeTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
    });
    activeTimeouts.clear();
    
    await client.destroy();
    process.exit(0);
});

// Export for testing
module.exports = { app, client };
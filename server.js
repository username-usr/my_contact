const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Import Chat model
const Chat = require('./models/Chat');

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contacts.html'));
});

// Chat API Routes
app.post('/api/chat', async (req, res) => {
    try {
        const { username, message } = req.body;

        if (!username || !message) {
            return res.status(400).json({ error: 'Username and message are required' });
        }

        // Get AI response from OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful startup assistant. Provide concise, actionable advice."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            max_tokens: 150
        });

        const aiResponse = completion.choices[0].message.content;

        // Save chat to MongoDB
        const chat = new Chat({
            username,
            message,
            response: aiResponse
        });

        await chat.save();

        res.json({
            success: true,
            response: {
                type: 'ai',
                content: aiResponse,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request'
        });
    }
});

app.get('/api/chat/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Get chat history from MongoDB
        const chatHistory = await Chat.find({ username })
            .sort({ timestamp: -1 })
            .limit(50);

        // Format chat history for frontend
        const formattedHistory = chatHistory.map(chat => ({
            type: 'user',
            content: chat.message,
            timestamp: chat.timestamp
        })).concat(chatHistory.map(chat => ({
            type: 'ai',
            content: chat.response,
            timestamp: chat.timestamp
        }))).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            success: true,
            chatHistory: formattedHistory
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching chat history'
        });
    }
});

// Dashboard API Routes
app.get('/api/dashboard', (req, res) => {
    res.json({
        todoList: [],
        notifications: []
    });
});

// Contacts API Routes
app.get('/api/contacts', (req, res) => {
    res.json({
        investors: [],
        volunteers: [],
        mentors: [],
        foundingTeam: [],
        collaborators: [],
        techTeam: [],
        others: []
    });
});

// Task Update API Route
app.post('/api/update-task', (req, res) => {
    const { taskId, completed } = req.body;
    res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
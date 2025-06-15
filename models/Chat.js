const mongoose = require('mongoose');

// Define the Chat schema
const chatSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    response: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Create indexes for better query performance
chatSchema.index({ username: 1, timestamp: -1 });

// Create and export the Chat model
const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat; 
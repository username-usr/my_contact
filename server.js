const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contacts.html'));
});

// AI-driven endpoint for adding/processing contact information
app.post('/api/add-contact-ai', async (req, res) => {
    try {
        const { username, message, collectedContactData } = req.body;

        if (!username || !message) {
            return res.status(400).json({ error: 'Username and message are required' });
        }

        const systemPrompt = `You are an AI assistant specialized in extracting contact information and guiding the user.
        Your goal is to collect the following details about a person the user met:
        - Name (the person's name)
        - How Met (e.g., through a mutual friend, at an event, online)
        - Where Met (e.g., specific location, event name, platform)
        - Conversation Summary (brief overview of what was discussed)
        - Person Details (any other relevant characteristics, background, or notes about the person)
        - X Score (an integer from 0-10, representing potential, where 10 is highest. Assign this if sufficient info is provided. If you assign a score, explain why briefly in aiResponse.)
        - Contact Type (Categorize the person as one of: Investor, Volunteer, Mentor, Founding Team, Collaborator, Tech Team, Other. Default to 'Other' if unsure.)

        You must analyze the user's input.
        If all necessary information (Name, How Met, Where Met, Conversation Summary) is present, confirm the extracted details and provide an X score and Contact Type.
        If any of these necessary fields are missing, clearly ask for the specific missing information.
        Format your response as a JSON string containing "aiResponse" (your text to the user) and "extractedData" (a JSON object with the fields you identified, including 'x_score' and 'contact_type' if applicable).

        Example for missing info:
        {"aiResponse": "I need more information. Could you please tell me the person's name and how you met them?", "extractedData": {"conversation_summary": "Discussed AI trends"}}

        Example for complete info with X score and Contact Type:
        {"aiResponse": "Great! I've extracted details for John Doe. Initial X score: 8/10 as an Investor. Ready to save?", "extractedData": {"name": "John Doe", "how_met": "Conference", "where_met": "Tech Summit", "conversation_summary": "Discussed AI trends", "person_details": "Angel investor", "x_score": 8, "contact_type": "Investor"}}
        `;

        const userMessage = `Current input: "${message}". Previously collected data: ${JSON.stringify(collectedContactData || {})}`;

        const chat = model.startChat({
            history: [],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const result = await chat.sendMessage(systemPrompt + "\n" + userMessage);
        const aiResponseContent = result.response.text();

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(aiResponseContent);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", aiResponseContent, parseError);
            return res.status(500).json({
                success: false,
                error: 'AI did not return a valid JSON response. Please try again or rephrase.',
                aiResponse: aiResponseContent
            });
        }

        res.json({
            success: true,
            aiResponse: parsedResponse.aiResponse,
            extractedData: parsedResponse.extractedData || {}
        });

    } catch (error) {
        console.error('Error in add-contact-ai endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request to add a contact.'
        });
    }
});

// Endpoint to save new contact to Supabase
app.post('/api/save-contact', async (req, res) => {
    try {
        const { username, contactData } = req.body;

        if (!username || !contactData || !contactData.name || !contactData.how_met || !contactData.where_met || !contactData.conversation_summary) {
            return res.status(400).json({ error: 'Missing required contact data for saving.' });
        }

        const { name, how_met, where_met, conversation_summary, person_details, x_score, contact_type } = contactData;

        const initial_y_factor_decay = 1.0; // Starting with no decay
        const current_timestamp = new Date().toISOString();

        const { data, error } = await supabase
            .from('contacts')
            .insert([
                {
                    user_id: username,
                    name: name,
                    how_met: how_met,
                    where_met: where_met,
                    conversation_summary: conversation_summary,
                    person_details: person_details || null,
                    x_score: x_score || 0,
                    y_factor_decay: initial_y_factor_decay,
                    last_interaction_date: current_timestamp,
                    contact_type: contact_type || 'Other' // Default to 'Other'
                }
            ])
            .select(); // Request inserted data back

        if (error) {
            console.error('Supabase contact insert error:', error);
            if (error.code === '42501') {
                return res.status(403).json({ success: false, error: 'Row-level security policy denied the insert. Ensure RLS is disabled or a suitable policy exists.' });
            }
            throw new Error('Failed to save contact to database');
        }

        res.json({ success: true, message: 'Contact saved successfully!', contact: data ? data[0] : null });

    } catch (error) {
        console.error('Error in save-contact endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while saving the contact.'
        });
    }
});

// NEW: Endpoint to update existing contact details
app.post('/api/contacts/update', async (req, res) => {
    try {
        const { id, username, updatedData } = req.body;

        if (!id || !username || !updatedData) {
            return res.status(400).json({ success: false, error: 'Missing contact ID, username, or update data.' });
        }

        const { data, error } = await supabase
            .from('contacts')
            .update(updatedData)
            .eq('id', id)
            .eq('user_id', username) // Ensure user can only update their own contacts
            .select();

        if (error) {
            console.error('Supabase contact update error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update contact.' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, error: 'Contact not found or unauthorized to update.' });
        }

        res.json({ success: true, message: 'Contact updated successfully!', contact: data[0] });

    } catch (error) {
        console.error('Error in /api/contacts/update endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while updating the contact.' });
    }
});

// NEW: Endpoint to handle AI-driven updates (re-connection or change of details)
app.post('/api/contacts/ai-update', async (req, res) => {
    try {
        const { id, username, prompt, updateType } = req.body; // updateType: 'reconnection' or 'details_change'

        if (!id || !username || !prompt || !updateType) {
            return res.status(400).json({ success: false, error: 'Missing contact ID, username, prompt, or update type.' });
        }

        // 1. Fetch the current contact data
        const { data: currentContact, error: fetchError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', id)
            .eq('user_id', username)
            .single();

        if (fetchError || !currentContact) {
            console.error('Supabase fetch error for AI update:', fetchError);
            return res.status(404).json({ success: false, error: 'Contact not found or unauthorized.' });
        }

        let aiPromptContent;
        let updateData = {};
        let aiResponseForUser = "";

        if (updateType === 'reconnection') {
            aiPromptContent = `You are an AI assistant helping a user manage their contacts. The user is providing a summary of a recent 'reconnection' conversation with "${currentContact.name}".
            Analyze the following conversation summary: "${prompt}"
            Based on this, re-evaluate their X-Score (0-10, higher is better potential) and suggest a new Y-Factor (0.0-1.0, lower is better decay).
            Also, update the 'last_interaction_date' to now.
            Explain the changes in X-Score and Y-Factor in your 'aiResponse'.
            Format your response as a JSON string containing "aiResponse" (your text to the user) and "updatedFields" (a JSON object with 'x_score', 'y_factor_decay', 'last_interaction_date').

            Example: {"aiResponse": "Great! Your interaction with John Doe was very positive. His X-Score increased to 9 and Y-Factor improved to 0.1. Keep up the good work!", "updatedFields": {"x_score": 9, "y_factor_decay": 0.1, "last_interaction_date": "2025-06-15T10:00:00Z"}}`;

        } else if (updateType === 'details_change') {
            aiPromptContent = `You are an AI assistant helping a user update contact details. The user is providing new information or clarification for "${currentContact.name}".
            Current details: ${JSON.stringify(currentContact)}.
            New information from user: "${prompt}"
            Extract any updated fields (name, how_met, where_met, conversation_summary, person_details) from the new information. Only include fields that have *changed*.
            Explain what details were updated in your 'aiResponse'.
            Format your response as a JSON string containing "aiResponse" and "updatedFields" (a JSON object with the fields that were updated).

            Example: {"aiResponse": "I've updated John Doe's person details to reflect his new role as CEO.", "updatedFields": {"person_details": "Now CEO of new startup."}}`;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid update type.' });
        }

        const chat = model.startChat({
            history: [],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const result = await chat.sendMessage(aiPromptContent);
        const aiResponseContent = result.response.text();

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(aiResponseContent);
            aiResponseForUser = parsedResponse.aiResponse;
            updateData = parsedResponse.updatedFields || {};
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON for AI update:", aiResponseContent, parseError);
            return res.status(500).json({
                success: false,
                error: 'AI did not return a valid JSON response for update. Please try again.',
                aiResponse: aiResponseContent // Send raw AI response for debugging
            });
        }

        // 3. Update the database with AI-suggested changes
        if (Object.keys(updateData).length > 0) {
            const { data, error } = await supabase
                .from('contacts')
                .update(updateData)
                .eq('id', id)
                .eq('user_id', username)
                .select();

            if (error) {
                console.error('Supabase contact AI update error:', error);
                throw new Error('Failed to save AI-suggested updates to contact.');
            }
        }

        res.json({ success: true, message: aiResponseForUser, updatedContact: updateData });

    } catch (error) {
        console.error('Error in /api/contacts/ai-update endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred during AI-driven contact update.' });
    }
});


// NEW: Endpoint to delete a contact
app.delete('/api/contacts/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.query.username; // Get username from query param for security check

        if (!id || !username) {
            return res.status(400).json({ success: false, error: 'Contact ID and username are required.' });
        }

        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id)
            .eq('user_id', username); // Ensure user can only delete their own contacts

        if (error) {
            console.error('Supabase contact delete error:', error);
            return res.status(500).json({ success: false, error: 'Failed to delete contact.' });
        }

        res.json({ success: true, message: 'Contact deleted successfully!' });

    } catch (error) {
        console.error('Error in /api/contacts/delete endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while deleting the contact.' });
    }
});


// In server.js, modify the /api/dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    const username = req.query.username || 'guest_user';

    try {
        // Fetch contacts for notifications (existing logic)
        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('name, last_interaction_date, x_score, y_factor_decay')
            .eq('user_id', username)
            .order('last_interaction_date', { ascending: false });

        if (contactError) {
            console.error('Error fetching contacts for notifications:', contactError);
            // Continue with other data even if contacts fail
            // throw new Error('Failed to fetch contacts for notifications'); // Don't throw here, just log
        }

        // NEW: Fetch todoList from Supabase
        const { data: todoList, error: todoError } = await supabase
            .from('todos')
            .select('*') // Select all fields
            .eq('user_id', username)
            .order('created_at', { ascending: true }); // Order by creation date

        if (todoError) {
            console.error('Error fetching todo list:', todoError);
            // throw new Error('Failed to fetch todo list'); // Don't throw here, just log
        }

        const notifications = [];
        const NOW = new Date();
        const DAY_IN_MS = 24 * 60 * 60 * 1000;

        // ... (rest of your existing notification logic for contacts) ...
        contacts.forEach(contact => {
            const lastInteraction = new Date(contact.last_interaction_date);
            const daysSinceLastInteraction = Math.floor((NOW - lastInteraction) / DAY_IN_MS);

            // Simple decay logic and notification trigger
            if (daysSinceLastInteraction > 30) {
                notifications.push({
                    id: `decay-<span class="math-inline">\{contact\.name\}\-</span>{Date.now()}`,
                    message: `🚩 Reconnect with ${contact.name}! It's been ${daysSinceLastInteraction} days.`,
                    type: 'urgent',
                    suggestion: `Consider sending a follow-up message or scheduling a quick call to re-establish the connection. Their X-score might be decaying!`
                });
            } else if (daysSinceLastInteraction > 14) {
                 notifications.push({
                    id: `followup-<span class="math-inline">\{contact\.name\}\-</span>{Date.now()}`,
                    message: `🗓️ Follow up with ${contact.name}. Last interaction ${daysSinceLastInteraction} days ago.`,
                    type: 'warning',
                    suggestion: `A short check-in message or sharing a relevant article could be beneficial.`
                 });
            } else if (daysSinceLastInteraction > 7) {
                 notifications.push({
                    id: `nurture-<span class="math-inline">\{contact\.name\}\-</span>{Date.now()}`,
                    message: `💡 Nurture connection with ${contact.name}. Last interaction ${daysSinceLastInteraction} days ago.`,
                    type: 'info',
                    suggestion: `Think about how you can add value or share a quick update.`
                 });
            }
        });


        res.json({
            todoList: todoList || [], // Use fetched todoList, or empty array if error
            notifications: notifications,
            templates: [
                { title: 'Investor Follow-up', content: 'Hi [Name], great meeting! I wanted to follow up on [topic]...' },
                { title: 'New Connection Intro', content: 'Hi [Name], enjoyed connecting at [Event]! Looking forward to [next steps]...' }
            ]
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching dashboard data'
        });
    }
});


// Contacts API Routes - Now fetches all details for the table and Kanban
app.get('/api/contacts', async (req, res) => {
    try {
        const username = req.query.username || 'guest_user';

        if (!username) {
            return res.status(400).json({ error: 'Username is required to fetch contacts' });
        }

        const { data: contacts, error } = await supabase
            .from('contacts')
            .select('id, name, how_met, where_met, conversation_summary, person_details, x_score, y_factor_decay, last_interaction_date, created_at, contact_type')
            .eq('user_id', username)
            .order('name', { ascending: true });

        if (error) {
            console.error('Supabase contacts select error:', error);
            throw new Error('Failed to fetch contacts from database');
        }

        // Return raw contacts, frontend will format and categorize
        res.json({ success: true, contacts: contacts });

    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching contacts'
        });
    }
});

// Task Update API Route (dummy)
// In server.js, modify the /api/update-task endpoint
app.post('/api/update-task', async (req, res) => {
    try {
        const { taskId, completed } = req.body;
        const username = req.body.username || 'guest_user'; // Ensure username is passed for RLS/security

        if (!taskId || username === undefined || completed === undefined) {
            return res.status(400).json({ success: false, error: 'Task ID, username, and completed status are required.' });
        }

        const { data, error } = await supabase
            .from('todos')
            .update({ completed: completed })
            .eq('id', taskId)
            .eq('user_id', username); // Ensure user can only update their own tasks

        if (error) {
            console.error('Supabase update task error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update task status.' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found or unauthorized to update.' });
        }

        res.json({ success: true, message: 'Task status updated successfully!' });
    } catch (error) {
        console.error('Error in /api/update-task endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while updating the task.' });
    }
});
// Endpoint to add a new to-do item
app.post('/api/add-todo', async (req, res) => {
    try {
        const { username, description, priority } = req.body;

        if (!username || !description) {
            return res.status(400).json({ success: false, error: 'Username and description are required.' });
        }

        const { data, error } = await supabase
            .from('todos') // Assuming you have a 'todos' table
            .insert([
                {
                    user_id: username,
                    description: description,
                    priority: priority || 'low', // Default to 'low'
                    completed: false,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Supabase add todo error:', error);
            return res.status(500).json({ success: false, error: 'Failed to add to-do item.' });
        }

        res.json({ success: true, message: 'To-Do item added successfully!', todo: data ? data[0] : null });

    } catch (error) {
        console.error('Error in /api/add-todo endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while adding the to-do item.' });
    }
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
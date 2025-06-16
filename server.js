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

app.get('/timeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

// AI-driven endpoint for adding/processing contact information
app.post('/api/add-contact-ai', async (req, res) => {
    try {
        const { username, message, collectedContactData, questionCount = 0 } = req.body;

        if (!username || !message) {
            return res.status(400).json({ error: 'Username and message are required' });
        }

        const systemPrompt = `You are an AI assistant specialized in extracting contact information and evaluating relationship potential with semantic understanding. Your goal is to collect the following required fields about a person the user met:
        - Name (e.g., "Emily Roberts")
        - How Met (e.g., "introduced by a mutual friend")
        - Where Met (e.g., "Startup networking event")
        - Conversation Summary (e.g., "Talked about scaling SaaS companies.")
        Optional fields:
        - Person Details (e.g., "knowledgeable in growth strategies")
        - X Score (1-100, calculated based on metrics below)
        - Contact Type (Investor, Volunteer, Mentor, Founding Team, Collaborator, Tech Team, Other; default: 'Other')

        **Rules**:
        - First, perform semantic analysis on the user's input: "${message}" and previously collected data: ${JSON.stringify(collectedContactData || {})}.
        - Deduce details to tick virtual checkboxes for six X-Score categories:
          1. Professional Relevance (0-16.67): Tick "Relevant industry" (e.g., tech, finance) and "Specific expertise" (e.g., growth strategies).
          2. Interaction Strength (0-16.67): Tick "Strong introduction" (e.g., via trusted contact) and "Engaged conversation" (e.g., in-depth).
          3. Potential Impact (0-16.67): Tick "Clear collaboration opportunity" (e.g., project partnership) and "High influence" (e.g., decision-maker).
          4. Personal Connection (0-16.67): Tick "Shared interests" (e.g., hobbies) and "Positive rapport" (e.g., friendly demeanor).
          5. Contact Influence (0-16.67): Tick "Wide network" (e.g., many connections) and "High authority" (e.g., C-level executive).
          6. Actionable Next Steps (0-16.67): Tick "Defined follow-up" (e.g., call scheduled) and "Resources shared" (e.g., article sent).
        - Assign scores: 2/2 checkboxes = 16.67, 1/2 = 8.33, 0/2 = 0 per category. Sum for total X-Score (1-100, min 1).
        - Explain X-Score breakdown in aiResponse (e.g., "X-Score: 85/100 = 16.67 (Professional Relevance: tech, expertise) + ...").
        - Do not ask for fields already provided. Limit questions to 3 rounds (questionCount: ${questionCount}).
        - Set readyToSave: true if all required fields are filled or after 3 questions.
        - If questionCount == 2, include: "This is the final question. You can save the contact afterward."
        - Format response as JSON with:
          - aiResponse: Message to user (question or confirmation).
          - extractedData: All extracted fields.
          - readyToSave: Boolean.
          - missingFields: Array of missing required fields.
          - xScoreAssigned: Boolean.

        **Example**:
        - Input: "Met Emily at SaaS conference, she’s a growth expert, we hit it off, planned follow-up."
        - Checkboxes: Professional Relevance (tech, expertise: 16.67), Interaction Strength (engaged: 8.33), Potential Impact (collaboration: 8.33), Personal Connection (rapport: 8.33), Contact Influence (none: 0), Actionable Next Steps (follow-up: 8.33).
        - X-Score: 50/100.
        - Response: {"aiResponse": "What was Emily’s name?", "extractedData": {"where_met": "SaaS conference", "x_score": 50}, ...}
        `;

        const userMessage = `Current input: "${message}". Question count: ${questionCount}. Previously collected data: ${JSON.stringify(collectedContactData || {})}`;

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
                error: 'AI did not return a valid JSON response.',
                aiResponse: aiResponseContent
            });
        }

        const newQuestionCount = parsedResponse.readyToSave ? 0 : Math.min(questionCount + 1, 3);

        res.json({
            success: true,
            aiResponse: parsedResponse.aiResponse,
            extractedData: parsedResponse.extractedData || {},
            readyToSave: parsedResponse.readyToSave || false,
            missingFields: parsedResponse.missingFields || [],
            questionCount: newQuestionCount,
            xScoreAssigned: parsedResponse.xScoreAssigned || false
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

        if (!username || !contactData) {
            return res.status(400).json({ error: 'Username and contact data are required.' });
        }

        const { name, how_met, where_met, conversation_summary, person_details, x_score, contact_type } = contactData;

        const initial_y_factor_decay = 1.0;
        const current_timestamp = new Date().toISOString();

        const { data: contactDataResult, error: contactError } = await supabase
            .from('contacts')
            .insert([
                {
                    user_id: username,
                    name: name || 'Unknown',
                    how_met: how_met || 'Not specified',
                    where_met: where_met || 'Not specified',
                    conversation_summary: conversation_summary || 'No summary provided',
                    person_details: person_details || null,
                    x_score: x_score !== undefined ? Math.max(1, parseInt(x_score)) : 1,
                    y_factor_decay: initial_y_factor_decay,
                    last_interaction_date: current_timestamp,
                    contact_type: contact_type || 'Other'
                }
            ])
            .select();

        if (contactError) {
            console.error('Supabase contact insert error:', contactError);
            throw new Error('Failed to save contact to database');
        }

        const contact = contactDataResult[0];

        const { error: interactionError } = await supabase
            .from('contact_interactions')
            .insert([
                {
                    contact_id: contact.id,
                    user_id: username,
                    interaction_date: current_timestamp,
                    conversation_summary: conversation_summary || 'No summary provided',
                    person_details: person_details || null,
                    x_score: x_score !== undefined ? Math.max(1, parseInt(x_score)) : 1,
                    contact_type: contact_type || 'Other'
                }
            ]);

        if (interactionError) {
            console.error('Supabase interaction insert error:', interactionError);
            throw new Error('Failed to save interaction to timeline');
        }

        res.json({ success: true, message: 'Contact and interaction saved successfully!', contact });

    } catch (error) {
        console.error('Error in save-contact endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while saving the contact and interaction.'
        });
    }
});

// Endpoint to fetch timeline for a specific contact
app.get('/api/contacts/timeline/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.query.username || 'guest_user';

        if (!id || !username) {
            return res.status(400).json({ error: 'Contact ID and username are required.' });
        }

        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id')
            .eq('id', id)
            .eq('user_id', username)
            .single();

        if (contactError || !contact) {
            console.error('Supabase fetch contact error:', contactError);
            return res.status(404).json({ success: false, error: 'Contact not found or unauthorized.' });
        }

        const { data: interactions, error: interactionError } = await supabase
            .from('contact_interactions')
            .select('interaction_date, conversation_summary, person_details, x_score, contact_type')
            .eq('contact_id', id)
            .eq('user_id', username)
            .order('interaction_date', { ascending: false });

        if (interactionError) {
            console.error('Supabase fetch interactions error:', interactionError);
            return res.status(500).json({ success: false, error: 'Failed to fetch timeline.' });
        }

        res.json({ success: true, timeline: interactions });

    } catch (error) {
        console.error('Error in /api/contacts/timeline endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching the timeline.' });
    }
});

// Endpoint to update existing contact details
app.post('/api/contacts/update', async (req, res) => {
    try {
        const { id, username, updatedData } = req.body;

        if (!id || !username || !updatedData) {
            return res.status(400).json({ success: false, error: 'Missing contact ID, username, or update data.' });
        }

        if (updatedData.x_score) {
            updatedData.x_score = Math.max(1, parseInt(updatedData.x_score));
        }

        const { data, error } = await supabase
            .from('contacts')
            .update(updatedData)
            .eq('id', id)
            .eq('user_id', username)
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

// Endpoint to handle AI-driven updates (re-connection or change of details)
app.post('/api/contacts/ai-update', async (req, res) => {
    try {
        const { id, username, prompt, updateType } = req.body;

        if (!id || !username || !prompt || !updateType) {
            return res.status(400).json({ success: false, error: 'Missing contact ID, username, prompt, or update type.' });
        }

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
        const current_timestamp = new Date().toISOString();

        if (updateType === 'reconnection') {
            aiPromptContent = `You are an AI assistant managing contacts with semantic understanding. Analyze the reconnection conversation with "${currentContact.name}": "${prompt}".
            Deduce details to tick virtual checkboxes for six X-Score categories (1-100 total):
            1. Professional Relevance (0-16.67): "Relevant industry", "Specific expertise".
            2. Interaction Strength (0-16.67): "Strong introduction", "Engaged conversation".
            3. Potential Impact (0-16.67): "Clear collaboration opportunity", "High influence".
            4. Personal Connection (0-16.67): "Shared interests", "Positive rapport".
            5. Contact Influence (0-16.67): "Wide network", "High authority".
            6. Actionable Next Steps (0-16.67): "Defined follow-up", "Resources shared".
            Scores: 2/2 checkboxes = 16.67, 1/2 = 8.33, 0/2 = 0 per category. Min X-Score: 1.
            Suggest new Y-Factor (0.0-1.0, higher for strong interactions).
            Update last_interaction_date, conversation_summary, person_details, contact_type if applicable.
            Explain X-Score breakdown in aiResponse.
            Format response as JSON with "aiResponse" and "updatedFields".

            Example: {"aiResponse": "X-Score: 85/100 = 16.67 (Professional Relevance: tech, expertise) + ...", "updatedFields": {"x_score": 85, "y_factor_decay": 0.9, ...}}`;
        } else if (updateType === 'details_change') {
            aiPromptContent = `You are an AI assistant updating contact details for "${currentContact.name}".
            Current details: ${JSON.stringify(currentContact)}.
            New information: "${prompt}".
            Extract changed fields (name, how_met, where_met, conversation_summary, person_details).
            Re-evaluate X-Score (1-100) using six categories:
            1. Professional Relevance (0-16.67): "Relevant industry", "Specific expertise".
            2. Interaction Strength (0-16.67): "Strong introduction", "Engaged conversation".
            3. Potential Impact (0-16.67): "Clear collaboration opportunity", "High influence".
            4. Personal Connection (0-16.67): "Shared interests", "Positive rapport".
            5. Contact Influence (0-16.67): "Wide network", "High authority".
            6. Actionable Next Steps (0-16.67): "Defined follow-up", "Resources shared".
            Scores: 2/2 checkboxes = 16.67, 1/2 = 8.33, 0/2 = 0 per category. Min X-Score: 1.
            Explain updated fields and X-Score in aiResponse.
            Format response as JSON with "aiResponse" and "updatedFields".

            Example: {"aiResponse": "X-Score: 85/100 = 16.67 (Professional Relevance: tech, expertise) + ...", "updatedFields": {"person_details": "Expert in SaaS", "x_score": 85}}`;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid update type.' });
        }

        const chat = await model.startChat({
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
            console.error("Failed to parse AI response as JSON for:", aiResponseContent, parseError);
            return res.status(500).json({
                success: false,
                error: 'AI did not return a valid JSON response for update.',
                aiResponse: aiResponseContent
            });
        }

        if (Object.keys(updateData).length > 0) {
            if (updateData.x_score) {
                updateData.x_score = Math.max(1, parseInt(updateData.x_score));
            }

            const { data: updatedContact, error: updateError } = await supabase
                .from('contacts')
                .update(updateData)
                .eq('id', id)
                .eq('user_id', username)
                .select()
                .single();

            if (updateError) {
                console.error('Supabase contact AI update:', updateError);
                throw new Error('Failed to save AI-suggested updates to contact.');
            }

            if (updateType === 'reconnection') {
                const { error: interactionError } = await supabase
                    .from('contact_interactions')
                    .insert([
                        {
                            contact_id: id,
                            user_id: username,
                            interaction_date: current_timestamp,
                            conversation_summary: updateData.conversation_summary || currentContact.conversation_summary,
                            person_details: updateData.person_details || currentContact.person_details,
                            x_score: updateData.x_score !== undefined ? Math.max(1, parseInt(updateData.x_score)) : currentContact.x_score,
                            contact_type: updateData.contact_type || currentContact.contact_type
                        }
                    ]);

                if (interactionError) {
                    console.error('Supabase interaction insert error:', interactionError);
                    throw new Error('Failed to save interaction to timeline');
                }
            }
        }

        res.json({ success: true, message: aiResponseForUser, updatedContact: updateData });

    } catch (error) {
        console.error('Error in /api/contacts/ai-update endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred during AI-driven contact update.' });
    }
});

// Endpoint to delete a contact
app.delete('/api/contacts/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.query.username;

        if (!id || !username) {
            return res.status(400).json({ error: 'Contact ID and username are required.' });
        }

        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id)
            .eq('user_id', username);

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

// Endpoint to update Y-Factor Decay
app.post('/api/update-decay', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username is required.' });
        }

        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('id, x_score, y_factor_decay, last_interaction_date')
            .eq('user_id', username);

        if (contactError) {
            console.error('Supabase fetch contacts error:', contactError);
            throw new Error('Failed to fetch contacts for decay update.');
        }

        const NOW = new Date();
        const DAY_IN_MS = 24 * 60 * 60 * 1000;

        for (const contact of contacts) {
            const lastInteraction = new Date(contact.last_interaction_date);
            const daysSinceLastInteraction = Math.floor((NOW - lastInteraction) / DAY_IN_MS);
            const decayRate = 0.01 * (100 - contact.x_score) / 100;
            const newYFactorDecay = Math.max(0, contact.y_factor_decay - (decayRate * daysSinceLastInteraction));

            const { error: updateError } = await supabase
                .from('contacts')
                .update({ y_factor_decay: newYFactorDecay })
                .eq('id', contact.id)
                .eq('user_id', username);

            if (updateError) {
                console.error('Supabase update decay error:', updateError);
                throw new Error('Failed to update Y-Factor Decay.');
            }
        }

        res.json({ success: true, message: 'Y-Factor Decay updated successfully!' });

    } catch (error) {
        console.error('Error in /api/update-decay endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while updating Y-Factor Decay.' });
    }
});

// Dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    const username = req.query.username || 'guest_user';

    try {
        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('id, name, last_interaction_date, x_score, y_factor_decay, where_met, conversation_summary')
            .eq('user_id', username)
            .order('last_interaction_date', { ascending: false });

        if (contactError) {
            console.error('Error fetching contacts for notifications:', contactError);
        }

        const { data: todoList, error: todoError } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', username)
            .order('created_at', { ascending: true });

        if (todoError) {
            console.error('Error fetching todo list:', todoError);
        }

        const notifications = [];
        const reconnectionTodos = [];
        const NOW = new Date();
        const DAY_IN_MS = 24 * 60 * 60 * 1000;

        contacts.forEach(contact => {
            const lastInteraction = new Date(contact.last_interaction_date);
            const daysSinceLastInteraction = Math.floor((NOW - lastInteraction) / DAY_IN_MS);

            if (daysSinceLastInteraction > 30 || contact.y_factor_decay < 0.3) {
                const reconnectTemplate = `Hi ${contact.name}, it’s been a while since we connected at ${contact.where_met || 'our last meeting'}. I’d love to catch up and discuss ${contact.conversation_summary || 'our previous topics'} further!`;
                notifications.push({
                    id: `reconnect-${contact.name}-${Date.now()}`,
                    message: `🚩 Reconnect with ${contact.name}! It's been ${daysSinceLastInteraction} days (Y-Factor: ${contact.y_factor_decay.toFixed(2)}).`,
                    type: 'contact',
                    suggestion: reconnectTemplate
                });
                reconnectionTodos.push({
                    user_id: username,
                    description: `Reconnect with ${contact.name}`,
                    priority: 'medium',
                    completed: false,
                    created_at: NOW.toISOString(),
                    contact_id: contact.id
                });
            } else if (daysSinceLastInteraction > 14) {
                notifications.push({
                    id: `followup-${contact.name}-${Date.now()}`,
                    message: `🗓️ Follow up with ${contact.name}. Last interaction ${daysSinceLastInteraction} days ago.`,
                    type: 'contact',
                    suggestion: `A short check-in message or sharing a relevant article could be beneficial.`
                });
            } else if (daysSinceLastInteraction > 7) {
                notifications.push({
                    id: `nurture-${contact.name}-${Date.now()}`,
                    message: `💡 Nurture connection with ${contact.name}. Last interaction ${daysSinceLastInteraction} days ago.`,
                    type: 'contact',
                    suggestion: `Think about how you can add value or share a quick update.`
                });
            }
        });

        // Insert reconnection todos if they don't already exist
        for (const todo of reconnectionTodos) {
            const { data: existingTodo, error: checkError } = await supabase
                .from('todos')
                .select('id')
                .eq('user_id', username)
                .eq('description', todo.description)
                .eq('completed', false)
                .single();

            if (!existingTodo && !checkError) {
                const { error: insertError } = await supabase
                    .from('todos')
                    .insert([todo]);

                if (insertError) {
                    console.error('Error inserting reconnection todo:', insertError);
                }
            }
        }

        res.json({
            todoList: todoList || [],
            notifications: notifications,
            templates: [
                { title: 'Investor Follow-up', content: 'Hi [Name], great meeting! I wanted to follow up on [topic]...' },
                { title: 'New Connection Intro', content: 'Hi [Name], enjoyed connecting at [Event]!... Looking forward to [next steps]' },
                { title: 'Reconnect', content: 'Hi [Name], it’s been a while since we connected at [Event]. I’d love to catch up!' }
            ]
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching dashboard data.'
        });
    }
});

// Contacts API Routes
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

        res.json({ success: true, contacts: contacts });

    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching contacts'
        });
    }
});

// Task Update API Route
app.post('/api/update-task', async (req, res) => {
    try {
        const { taskId, completed } = req.body;
        const username = req.body.username || 'guest_user';

        if (!taskId || username === undefined || completed === undefined) {
            return res.status(400).json({ success: false, error: 'Task ID, username, and completed status are required.' });
        }

        const { data, error } = await supabase
            .from('todos')
            .update({ completed: completed })
            .eq('id', taskId)
            .eq('user_id', username);

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
            return res.status(400).json({ error: 'Username and description are required.' });
        }

        const { data, error } = await supabase
            .from('todos')
            .insert([
                {
                    user_id: username,
                    description: description,
                    priority: priority || 'low',
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
        res.status(500).json({
            success: false,
            error: 'An error occurred while adding the to-do item.'
        });
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
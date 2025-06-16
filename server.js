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

        const systemPrompt = `You are an AI assistant specialized in extracting contact information efficiently and contextually. Your goal is to collect the following required fields about a person the user met:
        - Name (the person's full name, e.g., "Emily Roberts")
        - How Met (how the user met them, e.g., "introduced by a mutual friend" or "at a conference")
        - Where Met (general location or context, e.g., "Startup networking event" or "Cisco event in Chennai")
        - Conversation Summary (a brief overview of the discussion, e.g., "Talked about scaling SaaS companies.")
        Optional fields:
        - Person Details (additional notes about the person, e.g., role, expertise, interests, or impressions like "knowledgeable in growth strategies" or "seems very experienced")
        - X Score (an integer from 0-10, representing relationship potential. Calculate based on metrics below.)
        - Contact Type (Investor, Volunteer, Mentor, Founding Team, Collaborator, Tech Team, Other. Default to 'Other' if unsure.)

        **Rules**:
        - Analyze the user's current input: "${message}" and all previously collected data: ${JSON.stringify(collectedContactData || {})}.
        - Consolidate all inputs to fill required fields. Recognize semantic equivalents (e.g., "through my investor" = "through mutual connection").
        - For Where Met, accept general locations (e.g., "Startup networking event") and append clarifying details (e.g., "event hall" → "Startup networking event, event hall"). Do not ask for overly specific details like "near the stage" or "specific booth".
        - Accept short but valid conversation summaries (e.g., "Talked about SaaS.") as complete.
        - For Person Details, extract any additional information about the person, such as their expertise, role, impressions, or characteristics (e.g., "knowledgeable in growth strategies" or "very experienced"). If no such details are provided, leave Person Details as null.
        - Do not ask for a field if it’s already provided in collectedContactData or current input. Check for synonyms or partial matches.
        - If a required field is missing, ask a specific question about the *most critical* missing field. Include a 1-2 sentence example.
        - Limit questions to a maximum of 3 rounds (check questionCount: ${questionCount}).
        - Set 'readyToSave: true' if all required fields have minimal valid data or after 3 questions.
        - If questionCount == 2 (third question), include in aiResponse: "This is the final question. You can save the contact afterward."
        - Calculate X Score (0-10) using these metrics:
          - Professional Relevance (0-4): Based on conversation topics (e.g., SaaS, AI = 3, generic = 1), contact type (e.g., Investor/Collaborator = +1), and person details (e.g., expertise in growth strategies = +0.5).
          - Interaction Strength (0-3): Based on meeting context (e.g., mutual friend introduction = 2.5, casual encounter = 1).
          - Potential Impact (0-3): Based on implied outcomes (e.g., collaboration on user acquisition = 2.5, no clear outcome = 1).
          - Example: "Introduced by a friend at a startup event, discussed SaaS scaling, knowledgeable in growth strategies" → 3.5 (SaaS/expertise) + 2.5 (friend intro) + 2.5 (collaboration) = 8.5/10.
        - Explain X Score in aiResponse (e.g., "X-Score: 8.5/10 = 3.5 (SaaS/expertise) + 2.5 (friend intro) + 2.5 (collaboration)").
        - If all required fields are filled, confirm with: "All details provided! X-Score: [score]/10 = [breakdown]. Ready to save?"
        - Format your response as a JSON string with:
          - "aiResponse": Your message to the user (question or confirmation).
          - "extractedData": A JSON object with all extracted fields, including previous data.
          - "readyToSave": Boolean indicating if the contact is ready to save.
          - "missingFields": Array of missing required fields.
          - "xScoreAssigned": Boolean indicating if an X Score was assigned.

        **Question Examples**:
        - Missing Name: {"aiResponse": "What was the name of the person you met? For example, was it Emily Roberts?", "extractedData": {"how_met": "Conference"}, "readyToSave": false, "missingFields": ["name", "where_met", "conversation_summary"], "xScoreAssigned": false}
        - Missing How Met: {"aiResponse": "How did you meet ${collectedContactData?.name}? For example, was it through a friend or at an event?", "extractedData": {"name": "Emily Roberts", "where_met": "Startup event", "conversation_summary": "Talked about SaaS."}, "readyToSave": false, "missingFields": ["how_met"], "xScoreAssigned": false}
        - Complete Data: {"aiResponse": "All details provided! X-Score: 8.5/10 = 3.5 (SaaS/expertise) + 2.5 (friend intro) + 2.5 (collaboration). Ready to save?", "extractedData": {"name": "Emily Roberts", "how_met": "Introduced by a friend", "where_met": "Startup networking event", "conversation_summary": "Talked about SaaS scaling.", "person_details": "Knowledgeable in growth strategies", "x_score": 8.5, "contact_type": "Collaborator"}, "readyToSave": true, "missingFields": [], "xScoreAssigned": true}
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
                error: 'AI did not return a valid JSON response. Please try again or rephrase.',
                aiResponse: aiResponseContent
            });
        }

        // Increment question count, reset to 0 if readyToSave
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

        // Insert the contact into the contacts table
        const { data: contactDataResult, error: contactError } = await supabase
            .from('contacts')
            .insert([
                {
                    user_id: username, // username is a string (e.g., 'guest_user')
                    name: name || 'Unknown',
                    how_met: how_met || 'Not specified',
                    where_met: where_met || 'Not specified',
                    conversation_summary: conversation_summary || 'No summary provided',
                    person_details: person_details || null,
                    x_score: x_score !== undefined ? parseInt(x_score) : 0,
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

        // Insert the initial interaction into the contact_interactions table
        const { error: interactionError } = await supabase
            .from('contact_interactions')
            .insert([
                {
                    contact_id: contact.id,
                    user_id: username,
                    interaction_date: current_timestamp,
                    conversation_summary: conversation_summary || 'No summary provided',
                    person_details: person_details || null,
                    x_score: x_score !== undefined ? parseInt(x_score) : 0,
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

        // Fetch the contact to ensure it belongs to the user
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

        // Fetch the timeline (interactions) for the contact
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
            aiPromptContent = `You are an AI assistant helping a user manage their contacts. The user is providing a summary of a recent 'reconnection' conversation with "${currentContact.name}".
            Analyze the following conversation summary: "${prompt}"
            Based on this, re-evaluate their X-Score (0-10, higher is better potential) using these metrics:
            - Professional Relevance (0-4): Based on topics (e.g., SaaS, AI = 3, generic = 1), contact type (e.g., Investor = +1), and person details (e.g., expertise = +0.5).
            - Interaction Strength (0-3): Based on context (e.g., mutual introduction = 2.5, casual = 1).
            - Potential Impact (0-3): Based on outcomes (e.g., collaboration = 2.5, no outcome = 1).
            Suggest a new Y-Factor (0.0-1.0, lower is better decay).
            Update 'last_interaction_date' to now.
            Update 'conversation_summary' with the new summary.
            Update 'person_details' if new details are provided.
            Update 'contact_type' if applicable.
            Explain the X-Score breakdown in 'aiResponse'.
            Format your response as a JSON string with "aiResponse" and "updatedFields" (with 'conversation_summary', 'person_details', 'x_score', 'y_factor_decay', 'last_interaction_date', 'contact_type').

            Example: {"aiResponse": "Great! Interaction with Emily Roberts was strong. X-Score: 8.5/10 = 3.5 (SaaS/expertise) + 2.5 (friend intro) + 2.5 (collaboration).", "updatedFields": {"conversation_summary": "Discussed new SaaS strategies", "person_details": "Expert in SaaS", "x_score": 8.5, "y_factor_decay": 0.1, "last_interaction_date": "2025-06-16T11:41:00Z", "contact_type": "Collaborator"}}`;
        } else if (updateType === 'details_change') {
            aiPromptContent = `You are an AI assistant helping a user update contact details for "${currentContact.name}".
            Current details: ${JSON.stringify(currentContact)}.
            New information: "${prompt}"
            Extract updated fields (name, how_met, where_met, conversation_summary, person_details) that have *changed*.
            For person_details, include any new information about expertise, role, or impressions (e.g., "knowledgeable in growth strategies").
            Re-evaluate X-Score (0-10) using:
            - Professional Relevance (0-4): Based on topics, contact type, and person details.
            - Interaction Strength (0-3): Based on meeting context.
            - Potential Impact (0-3): Based on outcomes.
            Explain updated fields and X-Score breakdown in 'aiResponse'.
            Format your response as a JSON string with "aiResponse" and "updatedFields" (with changed fields and 'x_score').

            Example: {"aiResponse": "Updated person details. X-Score: 8.5/10 = 3.5 (SaaS/expertise) + 2.5 (friend intro) + 2.5 (collaboration).", "updatedFields": {"person_details": "Knowledgeable in growth strategies", "x_score": 8.5}}`;
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
            // Update the contact in the contacts table
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

            // If this is a reconnection, save the interaction to the timeline
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
                            x_score: updateData.x_score !== undefined ? parseInt(updateData.x_score) : currentContact.x_score,
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

        // Note: Interactions are automatically deleted due to ON DELETE CASCADE

        res.json({ success: true, message: 'Contact deleted successfully!' });

    } catch (error) {
        console.error('Error in /api/contacts/delete endpoint:', error);
        res.status(500).json({ success: false, error: 'An error occurred while deleting the contact.' });
    }
});

// Dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    const username = req.query.username || 'guest_user';

    try {
        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('name, last_interaction_date, x_score, y_factor_decay')
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
        const NOW = new Date();
        const DAY_IN_MS = 24 * 60 * 60 * 1000;

        contacts.forEach(contact => {
            const lastInteraction = new Date(contact.last_interaction_date);
            const daysSinceLastInteraction = Math.floor((NOW - lastInteraction) / DAY_IN_MS);

            if (daysSinceLastInteraction > 30) {
                notifications.push({
                    id: `decay-${contact.name}-${Date.now()}`,
                    message: `🚩 Reconnect with ${contact.name}! It's been ${daysSinceLastInteraction} days.`,
                    type: 'contact',
                    suggestion: `Consider sending a follow-up message or scheduling a quick call to re-establish the connection. Their X-score might be decaying!`
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

        res.json({
            todoList: todoList || [],
            notifications: notifications,
            templates: [
                { title: 'Investor Follow-up', content: 'Hi [Name], great meeting! I wanted to follow up on [topic]...' },
                { title: 'New Connection Intro', content: 'Hi [Name], enjoyed connecting at [Event]!... Looking forward to [next steps]' }
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
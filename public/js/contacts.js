document.addEventListener('DOMContentLoaded', () => {
    // Ensure a username is set for API calls, default to 'guest_user'
    if (!localStorage.getItem('username')) {
        localStorage.setItem('username', 'guest_user');
    }

    // Cache DOM elements
    const contactsTableBody = document.querySelector('#contactsTable tbody');
    const kanbanBoard = document.getElementById('kanbanBoard');
    const contactEditModal = document.getElementById('contactEditModal');
    const closeContactEditModalBtn = document.getElementById('closeContactEditModal');
    const aiEditToggleBtn = document.getElementById('aiEditToggleBtn');
    const standardEditForm = document.getElementById('standardEditForm');
    const aiUpdateForm = document.getElementById('aiUpdateForm');
    const saveEditButton = document.getElementById('saveEditButton');
    const sendAiPromptButton = document.getElementById('sendAiPromptButton');
    const aiPromptInput = document.getElementById('aiPromptInput');
    const aiUpdateResponseDiv = document.getElementById('aiUpdateResponse');
    const modalTitle = document.getElementById('modalTitle');
    const noContactsMessage = document.getElementById('noContactsMessage');
    const noKanbanContactsMessage = document.getElementById('noKanbanContactsMessage');

    // Edit form fields
    const editContactId = document.getElementById('editContactId');
    const editName = document.getElementById('editName');
    const editHowMet = document.getElementById('editHowMet');
    const editWhereMet = document.getElementById('editWhereMet');
    const editConversationSummary = document.getElementById('editConversationSummary');
    const editPersonDetails = document.getElementById('editPersonDetails');
    const editXScore = document.getElementById('editXScore');
    const editContactType = document.getElementById('editContactType');

    let allContactsData = []; // Store all contacts fetched from the server

    // Fetch and display contacts on load
    fetchContacts();
    setInterval(fetchContacts, 30000); // Periodic refresh

    // Define Kanban Columns (Contact Types)
    const CONTACT_TYPES = [
        'Investor', 'Volunteer', 'Mentor', 'Founding Team', 'Collaborator', 'Tech Team', 'Other'
    ];

    // --- Core Data Fetching ---
    async function fetchContacts() {
        const username = localStorage.getItem('username');
        if (!username) {
            console.warn('Username not found. Cannot fetch contacts.');
            return;
        }

        try {
            const response = await fetch(`/api/contacts?username=${username}`);
            const data = await response.json();

            if (data.success) {
                allContactsData = data.contacts; // Store raw data
                renderContactsTable(allContactsData);
                renderKanbanBoard(allContactsData);
            } else {
                console.error('Error fetching contacts:', data.error);
                contactsTableBody.innerHTML = `<tr><td colspan="8">Failed to load contacts: ${data.error}</td></tr>`;
                kanbanBoard.innerHTML = '<p>Failed to load contacts for Kanban.</p>';
            }
        } catch (error) {
            console.error('Network error fetching contacts:', error);
            contactsTableBody.innerHTML = `<tr><td colspan="8">Network error: ${error.message}</td></tr>`;
            kanbanBoard.innerHTML = '<p>Network error loading Kanban.</p>';
        }
    }

    // --- Render Contacts Table ---
    function renderContactsTable(contacts) {
        contactsTableBody.innerHTML = ''; // Clear existing rows
        if (!contacts || contacts.length === 0) {
            noContactsMessage.style.display = 'block';
            return;
        }
        noContactsMessage.style.display = 'none';

        contacts.forEach(contact => {
            const row = contactsTableBody.insertRow();
            row.setAttribute('data-contact-id', contact.id);

            row.insertCell().textContent = contact.name;
            row.insertCell().textContent = contact.how_met || 'N/A';
            row.insertCell().textContent = contact.where_met || 'N/A';
            row.insertCell().textContent = contact.conversation_summary || 'N/A';
            row.insertCell().textContent = contact.person_details || 'N/A';
            row.insertCell().textContent = contact.x_score !== undefined && contact.x_score !== null ? contact.x_score : 'N/A';
            row.insertCell().textContent = contact.last_interaction_date ? new Date(contact.last_interaction_date).toLocaleDateString() : 'N/A';

            const actionsCell = row.insertCell();
            actionsCell.className = 'actions-cell';
            const editButton = document.createElement('button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Edit Contact';
            editButton.className = 'action-button edit-button';
            editButton.onclick = () => openEditModal(contact.id);
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.title = 'Delete Contact';
            deleteButton.className = 'action-button delete-button';
            deleteButton.onclick = () => confirmDeleteContact(contact.id, contact.name);
            actionsCell.appendChild(deleteButton);
        });
    }

    // --- Render Kanban Board ---
    function renderKanbanBoard(contacts) {
        kanbanBoard.innerHTML = ''; // Clear existing columns
        if (!contacts || contacts.length === 0) {
            noKanbanContactsMessage.style.display = 'block';
            return;
        }
        noKanbanContactsMessage.style.display = 'none';

        const categorizedContacts = CONTACT_TYPES.reduce((acc, type) => {
            acc[type] = [];
            return acc;
        }, {});

        contacts.forEach(contact => {
            const type = contact.contact_type && CONTACT_TYPES.includes(contact.contact_type) ? contact.contact_type : 'Other';
            categorizedContacts[type].push(contact);
        });

        CONTACT_TYPES.forEach(type => {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.setAttribute('data-type', type);
            column.innerHTML = `<h3>${type}</h3><div class="kanban-cards-container" id="kanban-${type.replace(/\s/g, '')}"></div>`;
            kanbanBoard.appendChild(column);

            const cardsContainer = column.querySelector('.kanban-cards-container');
            categorizedContacts[type].forEach(contact => {
                cardsContainer.appendChild(createKanbanCard(contact));
            });

            // Make the cards container sortable
            new Sortable(cardsContainer, {
                group: 'kanban', // Allow dragging between groups
                animation: 150,
                onEnd: async function (evt) {
                    const movedItemId = evt.item.dataset.contactId;
                    const newType = evt.to.closest('.kanban-column').dataset.type;
                    const oldType = evt.from.closest('.kanban-column').dataset.type;

                    if (newType !== oldType) {
                        await updateContactType(movedItemId, newType);
                    }
                }
            });
        });
    }

    function createKanbanCard(contact) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('data-contact-id', contact.id);
        card.draggable = true; // Make cards draggable

        card.innerHTML = `
            <h4>${contact.name}</h4>
            <p><strong>X-Score:</strong> ${contact.x_score !== undefined && contact.x_score !== null ? contact.x_score : 'N/A'}</p>
            <p><strong>Last:</strong> ${contact.last_interaction_date ? new Date(contact.last_interaction_date).toLocaleDateString() : 'N/A'}</p>
            <div class="kanban-card-actions">
                <button class="action-button edit-button" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-button delete-button" title="Delete"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        card.querySelector('.edit-button').onclick = () => openEditModal(contact.id);
        card.querySelector('.delete-button').onclick = () => confirmDeleteContact(contact.id, contact.name);
        return card;
    }

    // --- Edit Modal Functionality ---
    async function openEditModal(contactId) {
        const contact = allContactsData.find(c => c.id === contactId);
        if (!contact) {
            alert('Contact not found!');
            return;
        }

        editContactId.value = contact.id;
        editName.value = contact.name || '';
        editHowMet.value = contact.how_met || '';
        editWhereMet.value = contact.where_met || '';
        editConversationSummary.value = contact.conversation_summary || '';
        editPersonDetails.value = contact.person_details || '';
        editXScore.value = contact.x_score !== undefined && contact.x_score !== null ? contact.x_score : '';
        editContactType.value = contact.contact_type || 'Other';

        // Set initial view to standard edit form
        showStandardEditForm();
        aiPromptInput.value = ''; // Clear AI prompt input
        aiUpdateResponseDiv.style.display = 'none'; // Hide AI response

        modalTitle.textContent = `Edit: ${contact.name}`;
        contactEditModal.classList.add('active');
    }

    closeContactEditModalBtn.addEventListener('click', () => {
        contactEditModal.classList.remove('active');
        aiUpdateResponseDiv.style.display = 'none'; // Ensure hidden on close
    });

    aiEditToggleBtn.addEventListener('click', () => {
        if (standardEditForm.style.display !== 'none') {
            showAiUpdateForm();
        } else {
            showStandardEditForm();
        }
        aiUpdateResponseDiv.style.display = 'none'; // Hide AI response on toggle
    });

    function showStandardEditForm() {
        standardEditForm.style.display = 'block';
        aiUpdateForm.style.display = 'none';
        modalTitle.textContent = `Edit: ${editName.value || 'Contact'}`;
        aiEditToggleBtn.innerHTML = '<i class="fas fa-star"></i>'; // Star icon for AI mode
    }

    function showAiUpdateForm() {
        standardEditForm.style.display = 'none';
        aiUpdateForm.style.display = 'block';
        modalTitle.textContent = 'AI-Guided Update';
        aiEditToggleBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>'; // Pencil icon for manual edit mode
    }

    saveEditButton.addEventListener('click', async () => {
        const id = editContactId.value;
        const username = localStorage.getItem('username');
        const updatedData = {
            name: editName.value,
            how_met: editHowMet.value,
            where_met: editWhereMet.value,
            conversation_summary: editConversationSummary.value,
            person_details: editPersonDetails.value,
            x_score: parseInt(editXScore.value) || 0, // Ensure integer
            contact_type: editContactType.value
        };

        try {
            const response = await fetch('/api/contacts/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, username, updatedData })
            });
            const data = await response.json();

            if (data.success) {
                alert('Contact updated successfully!');
                contactEditModal.classList.remove('active');
                fetchContacts(); // Re-render table and Kanban
            } else {
                alert('Failed to update contact: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Network error updating contact:', error);
            alert('Network error during update.');
        }
    });

    sendAiPromptButton.addEventListener('click', async () => {
        const id = editContactId.value;
        const username = localStorage.getItem('username');
        const prompt = aiPromptInput.value.trim();
        const updateType = document.querySelector('input[name="aiUpdateType"]:checked').value;

        if (!prompt) {
            alert('Please enter a prompt for the AI.');
            return;
        }

        aiUpdateResponseDiv.style.display = 'block';
        aiUpdateResponseDiv.textContent = 'Processing with AI...';

        try {
            const response = await fetch('/api/contacts/ai-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, username, prompt, updateType })
            });
            const data = await response.json();

            if (data.success) {
                aiUpdateResponseDiv.textContent = 'AI Response: ' + data.message;
                // Optionally, update the local contact data with AI suggested changes immediately
                // and then re-render, or just fetchContacts() after a short delay
                fetchContacts(); // Re-render to reflect potential score/date changes
            } else {
                aiUpdateResponseDiv.textContent = 'AI Error: ' + (data.error || 'Unknown AI error.');
            }
        } catch (error) {
            console.error('Network error during AI update:', error);
            aiUpdateResponseDiv.textContent = 'Network error: Could not connect to AI.';
        }
    });

    // --- Delete Functionality ---
    function confirmDeleteContact(contactId, contactName) {
        if (confirm(`Are you sure you want to delete ${contactName}? This cannot be undone.`)) {
            deleteContact(contactId);
        }
    }

    async function deleteContact(contactId) {
        const username = localStorage.getItem('username');
        if (!username) {
            alert('Username not found. Cannot delete contact.');
            return;
        }

        try {
            const response = await fetch(`/api/contacts/delete/${contactId}?username=${username}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                alert('Contact deleted successfully!');
                fetchContacts(); // Re-render table and Kanban
            } else {
                alert('Failed to delete contact: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Network error deleting contact:', error);
            alert('Network error during deletion.');
        }
    }

    async function updateContactType(contactId, newType) {
    const username = localStorage.getItem('username');
    if (!username) {
        alert('Username not found. Cannot update contact type.');
        return false;
    }

    try {
        const response = await fetch('/api/contacts/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: contactId,
                username,
                updatedData: { contact_type: newType }
            })
        });
        const data = await response.json();

        if (data.success) {
            console.log(`Contact ${contactId} updated to type ${newType}`);
            fetchContacts(); // Re-render table and Kanban to reflect the change
            return true;
        } else {
            alert('Failed to update contact type: ' + (data.error || 'Unknown error'));
            return false;
        }
    } catch (error) {
        console.error('Network error updating contact type:', error);
        alert('Network error during update.');
        return false;
    }
}

function renderKanbanBoard(contacts) {
    kanbanBoard.innerHTML = ''; // Clear existing columns
    if (!contacts || contacts.length === 0) {
        noKanbanContactsMessage.style.display = 'block';
        return;
    }
    noKanbanContactsMessage.style.display = 'none';

    const categorizedContacts = CONTACT_TYPES.reduce((acc, type) => {
        acc[type] = [];
        return acc;
    }, {});

    contacts.forEach(contact => {
        const type = contact.contact_type && CONTACT_TYPES.includes(contact.contact_type) ? contact.contact_type : 'Other';
        categorizedContacts[type].push(contact);
    });

    CONTACT_TYPES.forEach(type => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.setAttribute('data-type', type);
        column.innerHTML = `<h3>${type}</h3><div class="kanban-cards-container" id="kanban-${type.replace(/\s/g, '')}"></div>`;
        kanbanBoard.appendChild(column);

        const cardsContainer = column.querySelector('.kanban-cards-container');
        categorizedContacts[type].forEach(contact => {
            cardsContainer.appendChild(createKanbanCard(contact));
        });

        // Make the cards container sortable
        new Sortable(cardsContainer, {
            group: 'kanban', // Allow dragging between groups
            animation: 150,
            onEnd: async function (evt) {
                const movedItemId = evt.item.dataset.contactId;
                const newType = evt.to.closest('.kanban-column').dataset.type;
                const oldType = evt.from.closest('.kanban-column').dataset.type;

                if (newType !== oldType) {
                    const success = await updateContactType(movedItemId, newType);
                    if (!success) {
                        // Revert the UI change by re-rendering the Kanban board
                        fetchContacts();
                    }
                }
            }
        });
    });
}
    // --- Drag & Drop (SortableJS) Initialization ---
    // Initialized within renderKanbanBoard function now for dynamic columns
});
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    const contactList = document.getElementById('contactList');
    const timelineContainer = document.getElementById('timelineContainer');
    const noContactsMessage = document.getElementById('noContactsMessage');
    const noTimelineMessage = document.getElementById('noTimelineMessage');

    const username = localStorage.getItem('username') || 'guest_user';
    let allContactsData = [];
    let selectedContactId = null;

    // Fetch all contacts and render them in the sidebar
    async function fetchContacts() {
        try {
            const response = await fetch(`/api/contacts?username=${encodeURIComponent(username)}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch contacts.');
            }

            allContactsData = data.contacts;
            renderContactList(allContactsData);

            // If a contactId is provided in the URL, select that contact
            const urlParams = new URLSearchParams(window.location.search);
            const contactId = urlParams.get('contactId');
            if (contactId) {
                const contact = allContactsData.find(c => c.id === contactId);
                if (contact) {
                    selectContact(contactId);
                }
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
            contactList.innerHTML = `<p>Error loading contacts: ${error.message}</p>`;
            noContactsMessage.style.display = 'none';
        }
    }

    // Render the list of contacts in the sidebar
    function renderContactList(contacts) {
        contactList.innerHTML = ''; // Clear existing list
        if (!contacts || contacts.length === 0) {
            noContactsMessage.style.display = 'block';
            noTimelineMessage.style.display = 'block';
            return;
        }
        noContactsMessage.style.display = 'none';
        noTimelineMessage.style.display = 'block'; // Show until a contact is selected

        contacts.forEach(contact => {
            const contactItem = document.createElement('div');
            contactItem.className = 'contact-item';
            contactItem.setAttribute('data-contact-id', contact.id);
            contactItem.innerHTML = `
                <h3 class="contact-name">${contact.name || 'N/A'}</h3>
                <p class="contact-id">ID: ${contact.id || 'N/A'}</p>
                <p class="contact-details">${contact.person_details || 'No details available'}</p>
            `;
            contactItem.addEventListener('click', () => selectContact(contact.id));
            contactList.appendChild(contactItem);
        });
    }

    // Handle contact selection
    function selectContact(contactId) {
        // Remove 'selected' class from all contact items
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add 'selected' class to the clicked contact
        const selectedItem = document.querySelector(`.contact-item[data-contact-id="${contactId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        selectedContactId = contactId;
        fetchTimeline(contactId);
    }

    // Fetch and render the timeline for the selected contact
    async function fetchTimeline(contactId) {
        try {
            const response = await fetch(`/api/contacts/timeline/${contactId}?username=${encodeURIComponent(username)}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch timeline.');
            }

            renderTimeline(data.timeline);
        } catch (error) {
            console.error('Error fetching timeline:', error);
            timelineContainer.innerHTML = `<p>Error loading timeline: ${error.message}</p>`;
            noTimelineMessage.style.display = 'none';
        }
    }

    // Render the timeline with a tree-like structure
    function renderTimeline(interactions) {
        timelineContainer.innerHTML = ''; // Clear existing timeline

        if (!interactions || interactions.length === 0) {
            noTimelineMessage.style.display = 'block';
            return;
        }

        noTimelineMessage.style.display = 'none';

        interactions.forEach((interaction, index) => {
            const item = document.createElement('div');
            // Alternate left and right for each item
            item.className = `timeline-item ${index % 2 === 0 ? 'left' : 'right'}`;

            // Create the node (dot) on the central timeline
            const node = document.createElement('div');
            node.className = 'timeline-node';
            item.appendChild(node);

            // Create the branch (horizontal line)
            const branch = document.createElement('div');
            branch.className = 'timeline-branch';
            item.appendChild(branch);

            // Create the content box
            const content = document.createElement('div');
            content.className = 'timeline-content';
            content.innerHTML = `
                <h3>${new Date(interaction.interaction_date).toLocaleDateString()}</h3>
                <p><strong>Conversation:</strong> ${interaction.conversation_summary || 'N/A'}</p>
                <p><strong>Details:</strong> ${interaction.person_details || 'N/A'}</p>
                <p><strong>X-Score:</strong> ${interaction.x_score}/10</p>
                <p><strong>Type:</strong> ${interaction.contact_type || 'N/A'}</p>
            `;
            item.appendChild(content);

            timelineContainer.appendChild(item);
        });
    }

    // Initial fetch
    fetchContacts();
});
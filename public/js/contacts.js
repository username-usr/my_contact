document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display contacts
    fetchContacts();

    // Set up periodic refresh
    setInterval(fetchContacts, 30000); // Refresh every 30 seconds
});

function fetchContacts() {
    fetch('/api/contacts')
        .then(response => response.json())
        .then(data => {
            updateContactsList('investorsList', data.investors);
            updateContactsList('volunteersList', data.volunteers);
            updateContactsList('mentorsList', data.mentors);
            updateContactsList('foundingTeamList', data.foundingTeam);
            updateContactsList('collaboratorsList', data.collaborators);
            updateContactsList('techTeamList', data.techTeam);
            updateContactsList('othersList', data.others);
        })
        .catch(error => {
            console.error('Error fetching contacts:', error);
        });
}

function updateContactsList(containerId, contacts) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    contacts.forEach(contact => {
        const contactCard = document.createElement('div');
        contactCard.className = 'contact-card';
        
        const name = document.createElement('h3');
        name.textContent = contact.name;
        
        const role = document.createElement('p');
        role.className = 'contact-role';
        role.textContent = contact.role;
        
        const notes = document.createElement('p');
        notes.className = 'contact-notes';
        notes.textContent = contact.notes;
        
        contactCard.appendChild(name);
        contactCard.appendChild(role);
        contactCard.appendChild(notes);
        
        container.appendChild(contactCard);
    });
} 
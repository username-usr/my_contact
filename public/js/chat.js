// Check for username in localStorage
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const modal = document.getElementById('usernameModal');
    
    if (!username) {
        modal.classList.add('active');
    } else {
        // Load chat history for existing user
        loadChatHistory(username);
    }

    // Handle username submission
    document.getElementById('startChatButton').addEventListener('click', () => {
        const usernameInput = document.getElementById('usernameInput');
        const username = usernameInput.value.trim();
        
        if (username) {
            localStorage.setItem('username', username);
            modal.classList.remove('active');
            // Add welcome message
            addMessage('ai', `Welcome, ${username}! How can I help you today?`);
        }
    });

    // Handle message sending
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    function sendMessage() {
        const message = messageInput.value.trim();
        const username = localStorage.getItem('username');
        
        if (message && username) {
            addMessage('user', message);
            messageInput.value = '';
            
            // Send message to server
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    username
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    addMessage('ai', data.response.content);
                } else {
                    throw new Error(data.error || 'Failed to get response');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                addMessage('ai', 'Sorry, there was an error processing your message.');
            });
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});

// Function to load chat history
function loadChatHistory(username) {
    fetch(`/api/chat/${username}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.chatHistory) {
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = ''; // Clear existing messages
                
                data.chatHistory.forEach(chat => {
                    addMessage(chat.type, chat.content, new Date(chat.timestamp));
                });
            }
        })
        .catch(error => {
            console.error('Error loading chat history:', error);
        });
}

// Function to add a message to the chat
function addMessage(type, content, timestamp = new Date()) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = timestamp.toLocaleTimeString();
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timestampDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 
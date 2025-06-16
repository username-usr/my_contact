# *submitting for Hack the Vibe - 2025*
# Network Assistant Dashboard

A full-stack web application designed to assist startups and professionals in managing their networks, tasks, and communications efficiently. The application features a sleek dark-themed UI, a tree-like interaction timeline for contact management, a dashboard with to-do lists, notifications, email templates, and a Kanban board for task organization. It integrates AI-powered chat for enhanced user interaction and uses Supabase for persistent storage.

## Features

**Dashboard:**

- To-Do List: Manage tasks with priority levels (critical, important, not-important) and completion status.
- Notifications: View categorized notifications (urgent, warning, info) for timely updates.
- Email Templates: Access pre-defined email templates for quick communication.
- Kanban Board: Organize tasks across columns for efficient workflow management.


**Contacts Management:**

Organized contact list with details like name, how/where met, conversation summaries, person details, X-score, and last interaction.
Tree-like interaction timeline to visualize contact history with a central line, nodes, and alternating content boxes.
Edit and chat with contacts via a modal interface with AI-powered chat support.


**AI-Powered Chat:**

Interactive chat for user assistance, integrated with the Gemini API.
Chat history persistence for each user.


**Responsive Design:**

Fully responsive UI, optimized for both desktop and mobile devices.
Smooth scrolling and modal interactions on smaller screens.


**Supabase Integration:**

Persistent storage for contacts, tasks, notifications, and chat history.


**Theming:**

Customizable dark theme using CSS variables for easy styling adjustments.


## Prerequisites

- Node.js: Version 14 or higher
- npm: Version 6 or higher
- Supabase Account: For database integration
- Gemini API Key: For AI-powered chat functionality


## Installation

1. Clone the Repository:
```bash
git clone https://github.com/username-usr/my_contact.git
cd my_contact
```

2. Install Dependencies:
```bash 
npm install 
```

3. Set Up Environment Variables: 
Create a .env file in the root directory and add the following:

```Gemini_API_Key=your_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
PORT=3000
```

4. Run the Application: 
Start the development server:
```bash 
npm run dev
```

Open your browser and navigate to:
```http://localhost:3000```


## Project Structure
```
network-assistant-dashboard/
├── public/                   # Static assets
│   ├── css/
│   │   └── styles.css        # Global styles with timeline UI
│   ├── js/
│   │   └── timeline.js       # JavaScript for timeline page
│   └── index.html            # Main entry point (dashboard)
├── timeline.html             # Timeline page for contact interactions
├── server.js                 # Express.js backend (assumed)
├── .env                      # Environment variables
├── package.json              # Dependencies and scripts
└── README.md                 # Project documentation
```

## API Endpoints
The application uses a RESTful API to manage data. Below are the key endpoints:

- `GET /api/chat/`:usernameRetrieve chat history for a specific user.
Example Response:

```
{
  "success": true,
  "chatHistory": [
    { "user": "Hello", "ai": "Hi! How can I assist you?", "timestamp": "2025-06-16T11:20:00Z" }
  ]
}
```
- `GET /api/dashboard`: Fetch to-do list, notifications, and email templates for the dashboard.
Example Response:

```
{
  "success": true,
  "todos": [{ "task": "Follow up with client", "priority": "critical", "completed": false }],
  "notifications": [{ "title": "Meeting Reminder", "type": "urgent" }],
  "templates": [{ "title": "Follow-Up Email", "content": "Dear [Name],\n..." }]
}
```

- `GET /api/contacts?username=:username`: Retrieve the list of contacts for a user.
Example Response:

```
{
  "success": true,
  "contacts": [
    { "id": "123", "name": "John Doe", "person_details": "Met at conference", "x_score": 8 }
  ]
}
```

- `GET /api/contacts/timeline/:contactId?username=:username`: Fetch the interaction timeline for a specific contact.
Example Response:

```
{
  "success": true,
  "timeline": [
    {
      "interaction_date": "2025-06-10",
      "conversation_summary": "Discussed project timeline",
      "person_details": "Project manager",
      "x_score": 7,
      "contact_type": "Professional"
    }
  ]
}
```

- `POST /api/update-task`: Update the completion status of a task.
Request Body:
```
{ "taskId": "1", "completed": true }
```
Response:
```
{ "success": true, "message": "Task updated successfully" }
```

## Usage

1. **Dashboard:**

View and manage tasks in the to-do list with priority indicators.
Check notifications for updates (urgent, warning, info).
Use email templates for quick communication.
Organize tasks using the Kanban board by dragging and dropping cards.


2. **Contacts:**

View all contacts in a table with details like name, how/where met, conversation summaries, and X-score.
Click the "View Timeline" button to see a contact’s interaction history in a tree-like timeline UI.
Edit contact details or chat with contacts using the AI-powered chat modal.


3. **Timeline:**

Select a contact from the sidebar to view their interaction history.
The timeline displays interactions with a central vertical line, nodes, and branches, with content boxes alternating on either side.


## Development

- Backend: Built with Express.js for handling API requests and Supabase for database operations.
- Frontend: Uses vanilla JavaScript for interactivity, with pages like index.html (dashboard) and timeline.html (timeline UI).
- Styling: CSS with custom properties (--primary-color, --background-color, etc.) for theming. The timeline UI uses a tree-like structure with a central line and alternating content boxes.
- External Libraries: FontAwesome for icons, Google Fonts (Inter) for typography.


## Contributing

Contributions are welcome! Follow these steps to contribute:

- Fork the repository.
- Create a feature branch (git checkout -b feature/YourFeature).
- Commit your changes (git commit -m "Add YourFeature").
- Push to the branch (git push origin feature/YourFeature).
- Create a new Pull Request.

Please ensure your code follows the project’s coding style and includes appropriate comments.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For questions or feedback, feel free to open an issue on GitHub or reach out to the maintainers.

*Last updated: June 16, 2025*

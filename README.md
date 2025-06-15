# Startup Assistant Dashboard

A full-stack web application for startup assistance, featuring AI-powered chat, task management, and contact organization.

## Features

- **AI Chat**: Interactive chat interface with AI assistant
- **Dashboard**: To-do list, notifications, and email templates
- **Contacts**: Organized contact management system
- **Responsive Design**: Works on desktop and mobile devices
- **MongoDB Integration**: Persistent storage for chat history

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MongoDB Atlas account (or local MongoDB instance)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd startup-assistant-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
OPENAI_API_KEY=your_api_key_here
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

For MongoDB Atlas:
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Click "Connect" and choose "Connect your application"
4. Copy the connection string and replace `<username>`, `<password>`, and `<dbname>` with your values

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

```
startup-assistant-dashboard/
├── models/
│   └── Chat.js           # MongoDB Chat model
├── public/
│   ├── index.html        # AI Chat page
│   ├── dashboard.html    # Dashboard page
│   ├── contacts.html     # Contacts page
│   ├── styles.css        # Main stylesheet
│   └── js/
│       ├── chat.js       # Chat functionality
│       ├── dashboard.js  # Dashboard functionality
│       └── contacts.js   # Contacts functionality
├── server.js             # Express server
├── package.json          # Project dependencies
└── README.md            # This file
```

## API Endpoints

- `POST /api/chat`: Send chat messages and receive AI responses
- `GET /api/chat/:username`: Get chat history for a specific user
- `GET /api/dashboard`: Get to-do list, notifications, and templates
- `GET /api/contacts`: Get organized contact list
- `POST /api/update-task`: Update task completion status

## Development

- The application uses Express.js for the backend
- MongoDB with Mongoose for data persistence
- OpenAI API for AI chat responses
- Frontend is built with vanilla JavaScript
- Styling is done with CSS custom properties for easy theming

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
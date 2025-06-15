# Network Assistant Dashboard

A full-stack web application for startup assistance, featuring AI-powered chat, task management, and contact organization.

## Features

- **Dashboard**: To-do list, notifications, and email templates
- **Contacts**: Organized contact management system
- **Responsive Design**: Works on desktop and mobile devices
- **SupaBase Integration**: Persistent storage

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

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
PORT=3000
```

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
│
├── public/
│   ├── dashboard.html    # Dashboard page
│   ├── contacts.html     # Contacts page
│   ├── styles.css        # Main stylesheet
│   └── js/
│       ├── dashboard.js  # Dashboard functionality
│       └── contacts.js   # Contacts functionality
├── server.js             # Express server
├── package.json          # Project dependencies
└── README.md            # This file
```

## API Endpoints

- `GET /api/chat/:username`: Get chat history for a specific user
- `GET /api/dashboard`: Get to-do list, notifications, and templates
- `GET /api/contacts`: Get organized contact list
- `POST /api/update-task`: Update task completion status

## Development

- The application uses Express.js for the backend
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
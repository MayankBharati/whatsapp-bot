# WhatsApp Poll Bot

A web dashboard (React) + backend (Express + WhatsApp-web.js) application for scheduling and sending polls in your WhatsApp groups.

## Prerequisites

- **Node.js** v16 or higher  
- **npm** v8 or higher  

## Setup & Run

### 1. Clone & navigate

```bash
git clone https://github.com/MayankBharati/whatsapp-bot.git
cd whatsapp-poll-bot

2. Start the Backend

    cd backend
    npm install
    npm start

    By default it listens on http://localhost:3000.

3. Start the Frontend

    Open a new terminal, cd frontend

    npm install
    npm start

    The dashboard will open at http://localhost:3001.

Usage

    Open http://localhost:3001 in your browser.

    In the backend terminal, scan the QR code with your WhatsApp phone to authenticate.

    Once the bot is “Connected,” your active WhatsApp groups will appear in the dashboard.

    Schedule polls (with date-time picker), pause/resume or delete them.

    You can also send an instant poll from the “Send Instant Poll” tab.

Available Scripts
Backend (/backend)

    npm start
    Starts the Express + WhatsApp-web.js server on the port defined in PORT (defaults to 3000).

Frontend (/frontend)

    npm start
    Runs the React development server on port 3001.

    npm run build
    Builds the production bundle into frontend/build.
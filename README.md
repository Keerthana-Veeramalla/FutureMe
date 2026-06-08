# FutureMe — Meet the Future Version of Yourself

FutureMe is an AI-powered personal reflection experience. It acts as a mirror, allowing you to establish a chronological uplink and speak directly to a successful, older version of yourself.

By analyzing your current age, dream target age, goals, struggles, and one-year vision, FutureMe uses **Gemini 2.5 Flash** to generate a highly tailored, structured roadmap and an ongoing interactive chat.

---

## Features

1. **Personal Reflection Bridge**: Converts dreams, struggles, and visions into a heartfelt narrative letter.
2. **Dynamic Tone Adaptation**: The UI and message generation morph to match your selected tone:
   - **Motivational**: Inspiring and supportive.
   - **Brutally Honest**: Direct and no-excuses tough love.
   - **Calm Mentor**: Wise and long-term oriented.
   - **CEO Mode**: Strategic and execution-focused.
3. **Strategic Blueprint**: Outputs a custom Future Identity, 3 Next Actions, 1 Daily Habit, 1 Blindspot Warning, and 1 Daily Mantra.
4. **Interactive Character Chat**: Chat in real-time with your future self. The AI remains consistent to the generated persona, retaining knowledge of your goal, struggle, and tone.
5. **Rate Limiting & Safety**: Integrates express-rate-limit to protect AI endpoints from abuse.
6. **Premium Design**: Built using high-end glassmorphism, floating orbital animations, responsive layouts, and seamless text loading cycles.

---

## Project Structure

```text
futureme/
  frontend/
    index.html
    style.css
    script.js
  backend/
    server.js
    package.json
    .env
    .env.example
  README.md
```

---

## Installation & Setup

### 1. Pre-requisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ recommended).

### 2. Install Dependencies
Navigate to the `backend` directory and install the packages:
```bash
cd backend
npm install
```

### 3. Add Gemini API Key
Create a `.env` file inside the `backend/` directory (an `.env.example` has been provided for reference):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```
*Note: A functional Gemini API key has already been added to the local `.env` file during setup.*

### 4. Run the Application
Start the backend server in development mode:
```bash
npm run dev
```
The server will boot up on **port 5000**:
`🚀 Server running at: http://localhost:5000`

### 5. Access the Frontend
The frontend files are served directly through the Express backend.
Simply open your web browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## API Documentation

### 1. `POST /api/generate-futureme`
Generates the core FutureMe persona profile.

- **Request Body**:
  ```json
  {
    "name": "Keerthana",
    "age": 20,
    "futureAge": 25,
    "goal": "Build a successful healthcare startup",
    "struggle": "Lack of consistency",
    "oneYearVision": "Running a profitable healthcare company",
    "tone": "Motivational"
  }
  ```

- **Response Body**:
  ```json
  {
    "success": true,
    "data": {
      "message": "...",
      "futureIdentity": "...",
      "nextMoves": ["Action 1", "Action 2", "Action 3"],
      "habit": "...",
      "warning": "...",
      "mantra": "..."
    }
  }
  ```

### 2. `POST /api/chat-futureme`
Handles conversational responses from the generated future self.

- **Request Body**:
  ```json
  {
    "userProfile": {
      "name": "Keerthana",
      "age": 20,
      "futureAge": 25,
      "goal": "Build a successful healthcare startup",
      "struggle": "Lack of consistency",
      "oneYearVision": "Running a profitable healthcare company",
      "tone": "Motivational"
    },
    "chatHistory": [
      { "role": "futureme", "message": "I am you at age 30..." },
      { "role": "user", "message": "Will I actually make it?" }
    ],
    "question": "What should I focus on this week?",
    "futurePersona": {
      "futureIdentity": "...",
      "warning": "...",
      "habit": "...",
      "mantra": "..."
    }
  }
  ```

- **Response Body**:
  ```json
  {
    "success": true,
    "reply": "..."
  }
  ```

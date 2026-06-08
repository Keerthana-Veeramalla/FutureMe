const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Check if Gemini API key exists and is valid
const apiKey = process.env.GEMINI_API_KEY;
const isKeyConfigured = apiKey && apiKey !== "replace_with_your_gemini_api_key" && apiKey.trim() !== "";
if (!isKeyConfigured) {
  console.warn("\n=======================================================");
  console.warn("⚠️  WARNING: GEMINI_API_KEY is not configured or contains placeholder in .env!");
  console.warn("=======================================================\n");
}

// Initialize Gemini Client
const genAI = isKeyConfigured ? new GoogleGenerativeAI(apiKey) : null;

// Rate Limiters with detailed console warnings
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  handler: (req, res, next, options) => {
    console.warn(`[Rate Limit Error] Generate route blocked IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(options.statusCode).json({
      success: false,
      error: options.message.error
    });
  },
  message: {
    success: false,
    error: "Too many FutureMe generations from this IP. Please try again in 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  handler: (req, res, next, options) => {
    console.warn(`[Rate Limit Error] Chat route blocked IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(options.statusCode).json({
      success: false,
      error: options.message.error
    });
  },
  message: {
    success: false,
    error: "Too many questions to your FutureMe. Let your future self rest for 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helper: Truncate chat history to prevent context overflow.
 * Keeps the 1st message (initial greeting context) and the last N turns.
 */
function truncateChatHistory(history, maxTurns = 8) {
  if (!Array.isArray(history) || history.length <= maxTurns) {
    return history;
  }
  
  // Keep the first message (greeting) which holds key chronological uplink setup
  const greeting = history[0];
  // Keep the last (maxTurns - 1) messages to maintain conversational flow
  const recent = history.slice(-(maxTurns - 1));
  
  console.log(`[Context Management] Chat history truncated from ${history.length} to ${maxTurns} messages to prevent API token limit overflow.`);
  return [greeting, ...recent];
}

// In-memory tracker of models that hit permanent daily/hourly quota limits
const exhaustedModels = new Set();

/**
 * Helper: Call Gemini with model fallback and automatic retry backoff.
 * Attempts to use active models (gemini-2.5-flash and gemini-3.5-flash) first, and falls back to
 * lite variants (gemini-3.1-flash-lite) if quotas are exhausted.
 * Excludes exhausted models from candidate list on future requests to ensure instant backup uptime.
 */
async function generateContentWithFallback(prompt, generationConfig, endpoint = "unknown") {
  const models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let lastError = null;

  // Filter out models known to be exhausted to prevent delay
  const activeModels = models.filter(m => !exhaustedModels.has(m));
  const modelsToTry = activeModels.length > 0 ? activeModels : models;

  for (const modelName of modelsToTry) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`\n--- [Gemini Request] ---`);
        console.log(`Timestamp : ${new Date().toISOString()}`);
        console.log(`Endpoint  : ${endpoint}`);
        console.log(`Model     : ${modelName} (Attempt ${attempt}/${maxAttempts})`);
        console.log(`Prompt size: ~${prompt.length} chars`);
        console.log(`Config    :`, JSON.stringify(generationConfig));
        console.log(`------------------------`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: generationConfig
        });

        const responseText = result.response.text().trim();
        
        console.log(`\n--- [Gemini Response] ---`);
        console.log(`Timestamp : ${new Date().toISOString()}`);
        console.log(`Model Used: ${modelName}`);
        console.log(`Length    : ${responseText.length} chars`);
        console.log(`-------------------------`);

        return { text: responseText, modelUsed: modelName };
      } catch (error) {
        console.error(`\n❌ [Gemini Error] Failure with model ${modelName} on attempt ${attempt}:`, error.message);
        lastError = error;

        const errMsg = error.message || "";
        const isQuotaError = errMsg.includes("quota") || 
                             errMsg.includes("Quota") || 
                             errMsg.includes("429") || 
                             errMsg.includes("limit: 0") || 
                             errMsg.includes("limit: 20");

        if (isQuotaError) {
          console.warn(`[Quota Block] Model ${modelName} hit quota limits. Marking as exhausted to skip in future calls.`);
          exhaustedModels.add(modelName);
          break; // Break the attempts loop to immediately try the next model
        }

        // Wait and retry if more attempts are left (for transient errors like 503)
        if (attempt < maxAttempts) {
          const waitTime = 2000 * attempt; // 2s, 4s backoff
          console.log(`⏱️ Retrying in ${waitTime}ms...`);
          await delay(waitTime);
        }
      }
    }
  }

  throw lastError || new Error("All Gemini generation models and retries failed.");
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// API Route: Generate FutureMe Persona
app.post("/api/generate-futureme", generateLimiter, async (req, res) => {
  try {
    if (!genAI) {
      console.error("[API Error] Request received but Gemini client is unconfigured (missing API Key).");
      return res.status(500).json({
        success: false,
        error: "Gemini API key is not configured on the server. Please check the backend .env configuration."
      });
    }

    const { name, age, futureAge, goal, struggle, oneYearVision, tone } = req.body;

    if (!name || !age || !futureAge || !goal || !struggle || !oneYearVision || !tone) {
      console.warn("[API Warning] Missing required fields in generate-futureme request body.");
      return res.status(400).json({
        success: false,
        error: "Please provide all required fields: name, age, futureAge, goal, struggle, oneYearVision, tone."
      });
    }

    const toneInstructions = {
      "Motivational": "warm, deeply inspiring, highly supportive, encouraging, focusing on your unlimited potential.",
      "Brutally Honest": "brutally direct, sharp, refusing all excuses, offering tough-love, cutting straight through any self-deception.",
      "Calm Mentor": "peaceful, wise, grounded, patient, deeply reflective, emphasizing long-term balance and clarity.",
      "CEO Mode": "strategic, highly focused, execution-heavy, action-oriented, prioritizing systems, leverage, and ruthlessly efficient metrics.",
      "Best Friend": "empathetic, casual, close, warm, keeps it real, highly supportive, conversational and friendly.",
      "Older Sibling": "protective, caring, big-sibling guidance, slightly teasing, deeply honest and protective.",
      "Therapist": "reflective, warm, compassionate, guiding you to find your own answers, asking key open questions.",
      "Spiritual Guide": "holistic, purpose-driven, aligning actions with spiritual energy, focusing on inner peace, alignment, and mindfulness.",
      "Stoic Philosopher": "focused on virtue, reason, dichotomy of control, wisdom, endurance, and accepting whatever comes with calm focus.",
      "High Performance Coach": "optimizing habits, focus blocks, systems-driven execution, and performance frameworks.",
      "Investor Mindset": "ROI-driven, focusing on compound interest of daily actions, risk-reward analysis, and long-term asset/equity thinking.",
      "Future Millionaire": "focused on abundance, scale, leverage, wealth-building, and long-term financial independence.",
      "Soft & Encouraging": "gentle, comforting, kind, soothing, reassuring, avoiding harshness completely.",
      "Tough Love": "firm standards, uncompromising accountability, telling you what you need to hear, not what you want to hear."
    };

    let toneGuidance = toneInstructions[tone] || "balanced, thoughtful, and encouraging.";
    if (tone === "Custom Tone" && req.body.customToneDescription) {
      toneGuidance = `custom style described as: "${req.body.customToneDescription}".`;
    }

    const systemPrompt = `You are FutureMe, the future successful version of the user who is now ${futureAge} years old (current age is ${age}). You are not a generic motivational coach. You speak with high emotional intelligence, clarity, and deep personal understanding. Your job is to help the user see who they are becoming, what they must change, and what they should do next.

Write as if you are the user's future self speaking directly to their current self.

Selected tone styling: ${toneGuidance}

User Details:
Name: ${name}
Current Age: ${age}
Dream Future Age: ${futureAge}
Goal/Ambition: ${goal}
Current Struggle/Obstacle: ${struggle}
One-Year Vision: ${oneYearVision}

Return a valid JSON object matching the following structure:
{
  "message": "A powerful 120-180 word message from the future self. Address the user directly by name. Focus deeply on their struggle and how they overcame it.",
  "futureIdentity": "A concise description (1 sentence) of the future persona they have successfully become.",
  "nextMoves": ["Action Move 1 (Specific, clear action)", "Action Move 2 (Specific, clear action)", "Action Move 3 (Specific, clear action)"],
  "habit": "One small daily habit they must start today to bridge the gap.",
  "warning": "One critical mistake or trap they currently repeat that their future self warns them to stop immediately.",
  "mantra": "A short, memorable 3-7 word mantra they should repeat daily."
}

Ensure the values are highly tailored and emotional. Avoid generic cliches, but keep it practical. Make the response feel authentic, like a message sent across time.`;

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          message: { type: "STRING" },
          futureIdentity: { type: "STRING" },
          nextMoves: {
            type: "ARRAY",
            items: { type: "STRING" }
          },
          habit: { type: "STRING" },
          warning: { type: "STRING" },
          mantra: { type: "STRING" }
        },
        required: ["message", "futureIdentity", "nextMoves", "habit", "warning", "mantra"]
      }
    };

    const { text, modelUsed } = await generateContentWithFallback(systemPrompt, generationConfig, "generate-futureme");

    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (parseErr) {
      console.error(`\n❌ [JSON Parsing Error] Failed to parse response from model ${modelUsed}:`, parseErr.message);
      console.error(`Raw text that failed parsing:\n`, text);
      return res.status(502).json({
        success: false,
        error: "FutureMe returned a malformed response timeline. Please try again.",
        details: `JSON Parse error: ${parseErr.message}. Raw: ${text.substring(0, 100)}`
      });
    }

    return res.json({
      success: true,
      data: parsedData,
      model: modelUsed
    });

  } catch (error) {
    console.error("\n❌ [API Error] Generation handler exception:", error);
    return res.status(500).json({
      success: false,
      error: "FutureMe could not respond right now. Try again.",
      details: error.message || String(error)
    });
  }
});

// API Route: Chat with FutureMe Persona
app.post("/api/chat-futureme", chatLimiter, async (req, res) => {
  try {
    if (!genAI) {
      console.error("[API Error] Request received but Gemini client is unconfigured (missing API Key).");
      return res.status(500).json({
        success: false,
        error: "Gemini API key is not configured on the server. Please check the backend .env configuration."
      });
    }

    const { userProfile, chatHistory, question, futurePersona } = req.body;

    if (!userProfile || !question || !futurePersona) {
      console.warn("[API Warning] Missing required fields in chat-futureme request body.");
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userProfile, question, or futurePersona."
      });
    }

    // Ensure all critical persona parameters are sent
    const { name, age, futureAge, goal, struggle, oneYearVision, tone } = userProfile;
    const { futureIdentity, message: initialMessage, habit, warning, mantra } = futurePersona;

    if (!name || !futureAge || !tone || !futureIdentity || !initialMessage) {
      console.warn("[API Warning] Malformed userProfile or futurePersona objects.");
      return res.status(400).json({
        success: false,
        error: "Invalid profile or persona payload: check that all fields (futureIdentity, message, habit, warning, mantra, tone) are present."
      });
    }

    // Validate and clean chatHistory to prevent malformed history entries crashing the system
    let cleanHistory = [];
    if (Array.isArray(chatHistory)) {
      cleanHistory = chatHistory.filter(msg => {
        return msg && typeof msg === "object" && 
               (msg.role === "user" || msg.role === "futureme") &&
               typeof msg.message === "string";
      });
    } else {
      console.warn("[API Warning] chatHistory is not a valid array, defaulting to empty.");
    }

    // Truncate cleanHistory if it exceeds token limit rules
    const truncatedHistory = truncateChatHistory(cleanHistory, 8);

    const toneInstructions = {
      "Motivational": "warm, inspiring, and supportive. Emphasize their capacity to grow and cheer them on.",
      "Brutally Honest": "direct, sharp, cutting, and no-excuses. Focus on self-sabotaging behavior and give tough love.",
      "Calm Mentor": "peaceful, wise, patient, grounded. Help them look at the bigger picture and find stillness.",
      "CEO Mode": "strategic, execution-heavy, focused on leverage and systems. Treat their life like a high-growth company.",
      "Best Friend": "empathetic, casual, warm, conversational, and highly supportive. Keep it close and friendly.",
      "Older Sibling": "protective, caring, slightly teasing, but deeply supportive and honest.",
      "Therapist": "reflective, warm, compassionate, guiding them to find their own answers.",
      "Spiritual Guide": "holistic, purpose-driven, focusing on inner peace, alignment, and mindfulness.",
      "Stoic Philosopher": "focused on virtue, reason, dichotomy of control, accepting what comes, and rational endurance.",
      "High Performance Coach": "systems-driven, performance-heavy, optimizing habits and focus blocks.",
      "Investor Mindset": "ROI-driven, emphasizing compound interest of actions, leverage, and long-term thinking.",
      "Future Millionaire": "abundance-focused, wealth-building, leverage, and scaling their mindset.",
      "Soft & Encouraging": "gentle, comforting, kind, and reassuring. Avoid any harshness.",
      "Tough Love": "firm standards, uncompromising accountability, telling them exactly what they need to hear."
    };

    let toneStyle = toneInstructions[tone] || "thoughtful and mentor-like.";
    if (tone === "Custom Tone" && userProfile.customToneDescription) {
      toneStyle = `custom style described as: "${userProfile.customToneDescription}".`;
    }

    // Build the system instructions context incorporating ALL required elements
    let chatContext = `You are FutureMe, the version of ${name} who is ${futureAge} years old and has fully realized their goal of: "${goal}".
You already achieved the one-year vision of: "${oneYearVision}".
You are talking to your current self, who is ${age} years old and struggling with: "${struggle}".

Your voice tone is: ${tone} (be: ${toneStyle}).

Your profile/persona from the initial reflection bridge is:
- Future Identity: ${futureIdentity}
- Initial roadmap message to current self: ${initialMessage}
- Recommended daily habit: ${habit}
- Mistep Warning: ${warning}
- Focus Mantra: ${mantra}

Guidelines:
1. Speak in the first person ("I am you", "Your struggle", "Our future").
2. Adopt your selected tone strictly.
3. Reply directly, personally, and sharply to the user's question.
4. Do NOT mention that you are Gemini, an AI model, or created by Google. If asked, you are the future version of the user.
5. Provide a response in 2-5 short paragraphs.
6. Ensure your response includes at least one clear, actionable next step that they can take this week.

Return a valid JSON object matching the following structure:
{
  "reply": "Your response to the user's question, strictly respecting the tone and guidelines."
}

Recent chat history:
`;

    // Append history
    truncatedHistory.forEach(msg => {
      const speaker = msg.role === "user" ? "Current Me" : "Future Me";
      chatContext += `${speaker}: ${msg.message}\n`;
    });

    chatContext += `\nCurrent Me: ${question}\nFuture Me:`;

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          reply: { type: "STRING" }
        },
        required: ["reply"]
      }
    };

    const { text, modelUsed } = await generateContentWithFallback(chatContext, generationConfig, "chat-futureme");

    let parsedReply;
    try {
      parsedReply = JSON.parse(text);
    } catch (parseErr) {
      console.error(`\n❌ [JSON Parsing Error] Failed to parse chat response from model ${modelUsed}:`, parseErr.message);
      console.error(`Raw text that failed parsing:\n`, text);
      return res.status(502).json({
        success: false,
        error: "FutureMe returned a malformed chat frame. Please try again.",
        details: `JSON Parse error: ${parseErr.message}. Raw: ${text.substring(0, 100)}`
      });
    }

    // Validate reply text before returning
    if (!parsedReply || typeof parsedReply.reply !== "string" || parsedReply.reply.trim() === "") {
      console.error(`\n❌ [Validation Error] Gemini returned structured JSON but 'reply' string is missing or empty.`);
      return res.status(502).json({
        success: false,
        error: "FutureMe remained silent. Please try again.",
        details: "Validation error: reply property is missing or empty in structured JSON response."
      });
    }

    return res.json({
      success: true,
      reply: parsedReply.reply,
      model: modelUsed
    });

  } catch (error) {
    console.error("\n❌ [API Error] Chat handler exception:", error);
    return res.status(500).json({
      success: false,
      error: "FutureMe could not respond right now. Try again.",
      details: error.message || String(error)
    });
  }
});

// Fallback: serve frontend index.html for undefined routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 FutureMe Backend Server is running!`);
  console.log(`🔗 Local Address: http://localhost:${PORT}`);
  console.log(`📁 Serving frontend from: ${path.join(__dirname, "../frontend")}`);
  console.log(`=======================================================`);
});

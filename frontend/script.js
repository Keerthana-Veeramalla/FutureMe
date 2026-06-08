document.addEventListener("DOMContentLoaded", () => {
    // State Variables
    let userProfile = null;
    let futurePersona = null;
    let chatHistory = [];
    let loadingInterval = null;

    // Elements
    const form = document.getElementById("futureForm");
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    const placeholder = document.getElementById("placeholder");
    const loadingState = document.getElementById("loading");
    const loadingTitle = document.getElementById("loadingTitle");
    const loadingSubtitle = document.getElementById("loadingSubtitle");
    const errorState = document.getElementById("errorState");
    const errorMessage = document.getElementById("errorMessage");
    const retryBtn = document.getElementById("retryBtn");

    const resultCard = document.getElementById("resultCard");
    const resultsContainer = document.getElementById("resultsCardContainer");
    const responseEl = document.getElementById("futureResponse");
    const identityBadge = document.getElementById("identityBadge");
    const toneBadge = document.getElementById("resultToneBadge");
    const movesList = document.getElementById("movesList");
    const habitText = document.getElementById("habitText");
    const warningText = document.getElementById("warningText");
    const mantraText = document.getElementById("mantraText");

    const copyBtn = document.getElementById("copyBtn");
    const chatJumpBtn = document.getElementById("chatJumpBtn");

    // Chat Elements
    const chatLockedOverlay = document.getElementById("chatLockedOverlay");
    const chatWindowWrapper = document.getElementById("chatWindowWrapper");
    const chatHistoryEl = document.getElementById("chatHistory");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatSendBtn = document.getElementById("chatSendBtn");
    const typingIndicator = document.getElementById("typingIndicator");
    const chatHeaderName = document.getElementById("chatHeaderName");
    const chatHeaderTone = document.getElementById("chatHeaderTone");
    const resetChatBtn = document.getElementById("resetChatBtn");
    
    // Custom Select & Reset Buttons
    const customToneSelect = document.getElementById("customToneSelect");
    const toneInput = document.getElementById("tone");
    const customToneDescWrapper = document.getElementById("customToneDescWrapper");
    const customToneDescriptionInput = document.getElementById("customToneDescription");
    const globalResetBtn = document.getElementById("globalResetBtn");
    const resultResetBtn = document.getElementById("resultResetBtn");
    const chatResetTimelineBtn = document.getElementById("chatResetTimelineBtn");

    // Permanent Reset Icon Buttons & Voice Elements
    const headerResetTimelineBtn = document.getElementById("headerResetTimelineBtn");
    const headerResultResetBtn = document.getElementById("headerResultResetBtn");
    const headerChatResetBtn = document.getElementById("headerChatResetBtn");
    const speakResultBtn = document.getElementById("speakResultBtn");
    const chatMicBtn = document.getElementById("chatMicBtn");

    // Clickable Cards
    const cardGoals = document.getElementById("cardGoals");
    const cardStruggles = document.getElementById("cardStruggles");
    const cardWisdom = document.getElementById("cardWisdom");

    // Toast Element
    const toast = document.getElementById("toast");

    // Cinematic loading phrases
    const loadingPhrases = [
        { title: "Initiating temporal link...", sub: "Calibrating timeline coordinates." },
        { title: "Bridging the years...", sub: "Establishing secure data uplink." },
        { title: "Accessing future node...", sub: "Mapping ambitions and decision trees." },
        { title: "Synthesizing perspective...", sub: "Compiling lessons from the timeline." },
        { title: "Translating memory packets...", sub: "Formulating emotional response." },
        { title: "Decoding text stream...", sub: "Sealing the chronological loop." }
    ];

    // Helper: Show Toast
    function showToast(message, isError = false) {
        toast.textContent = message;
        if (isError) {
            toast.classList.add("toast-error");
        } else {
            toast.classList.remove("toast-error");
        }
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 4000);
    }

    // Helper: Build and Log Friendly Error Details (Development mode aware)
    function getFriendlyErrorMessage(error, serverResult = null) {
        // Log root cause to console
        console.error("FutureMe Request Failure Root Cause:", error);
        if (serverResult) {
            console.error("Server Response Error Context:", serverResult);
        }

        const isLocal = window.location.hostname === "localhost" || 
                        window.location.hostname === "127.0.0.1" || 
                        window.location.protocol === "file:";

        let msg = "FutureMe could not respond right now. Try again.";

        if (serverResult && serverResult.error) {
            msg = serverResult.error;
        } else if (error && error.message) {
            msg = error.message;
        }

        // Show detailed technical parameters to user if on localhost (dev mode)
        if (isLocal) {
            if (serverResult && serverResult.details) {
                msg += ` (Debug: ${serverResult.details})`;
            } else if (error && error.message) {
                msg += ` (Debug: ${error.message})`;
            }
        }

        return msg;
    }

    // Helper: Cycle Loading Text
    function startLoadingCycle() {
        let phase = 0;
        loadingTitle.textContent = loadingPhrases[phase].title;
        loadingSubtitle.textContent = loadingPhrases[phase].sub;

        loadingInterval = setInterval(() => {
            phase = (phase + 1) % loadingPhrases.length;
            loadingTitle.textContent = loadingPhrases[phase].title;
            loadingSubtitle.textContent = loadingPhrases[phase].sub;
        }, 3000);
    }

    function stopLoadingCycle() {
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }
    }

    // Helper: Set Dynamic Tone Theme
    function setToneTheme(tone) {
        // Remove existing classes
        document.body.classList.remove("tone-motivational", "tone-honest", "tone-mentor", "tone-ceo");
        
        let toneClass = "tone-motivational"; // default
        const honestTones = ["Brutally Honest", "Tough Love"];
        const mentorTones = ["Calm Mentor", "Best Friend", "Therapist", "Spiritual Guide", "Stoic Philosopher"];
        const ceoTones = ["CEO Mode", "High Performance Coach", "Investor Mindset", "Future Millionaire"];
        
        if (honestTones.includes(tone)) {
            toneClass = "tone-honest";
        } else if (mentorTones.includes(tone)) {
            toneClass = "tone-mentor";
        } else if (ceoTones.includes(tone)) {
            toneClass = "tone-ceo";
        }

        document.body.classList.add(toneClass);
    }

    // Custom Searchable Dropdown Logic
    const selectTrigger = customToneSelect.querySelector(".select-trigger");
    const optionsPanel = customToneSelect.querySelector(".options-panel");
    const searchInput = customToneSelect.querySelector(".select-search");
    const optionsList = customToneSelect.querySelector(".options-list");
    const selectedText = customToneSelect.querySelector(".selected-text");

    selectTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isActive = customToneSelect.classList.contains("active");
        if (isActive) {
            customToneSelect.classList.remove("active");
            optionsPanel.classList.add("hidden");
        } else {
            customToneSelect.classList.add("active");
            optionsPanel.classList.remove("hidden");
            searchInput.value = "";
            const options = optionsList.querySelectorAll("li");
            options.forEach(opt => opt.style.display = "");
            searchInput.focus();
        }
    });

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const options = optionsList.querySelectorAll("li");
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const val = opt.getAttribute("data-value").toLowerCase();
            if (text.includes(query) || val.includes(query)) {
                opt.style.display = "";
            } else {
                opt.style.display = "none";
            }
        });
    });

    optionsList.addEventListener("click", (e) => {
        const li = e.target.closest("li");
        if (!li) return;
        
        const value = li.getAttribute("data-value");
        const text = li.textContent.trim();
        
        toneInput.value = value;
        selectedText.textContent = text;
        
        optionsList.querySelectorAll("li").forEach(opt => {
            opt.classList.remove("selected");
        });
        li.classList.add("selected");
        
        customToneSelect.classList.remove("active");
        optionsPanel.classList.add("hidden");
        
        if (value === "Custom Tone") {
            customToneDescWrapper.classList.remove("hidden");
            customToneDescriptionInput.setAttribute("required", "required");
            customToneDescriptionInput.focus();
        } else {
            customToneDescWrapper.classList.add("hidden");
            customToneDescriptionInput.removeAttribute("required");
            customToneDescriptionInput.value = "";
        }
    });

    document.addEventListener("click", (e) => {
        if (!customToneSelect.contains(e.target)) {
            customToneSelect.classList.remove("active");
            optionsPanel.classList.add("hidden");
        }
    });

    // Reset Timeline Functionality
    function resetTimeline() {
        if (confirm("Are you sure you want to reset your timeline? This will clear all inputs, generated results, chat history, and cache.")) {
            // Cancel any active speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            resetSpeechButtons();

            // Clear form inputs
            form.reset();
            
            // Clear custom select dropdown
            toneInput.value = "";
            selectedText.textContent = "Select a voice tone...";
            optionsList.querySelectorAll("li").forEach(opt => {
                opt.classList.remove("selected");
            });
            customToneDescWrapper.classList.add("hidden");
            customToneDescriptionInput.removeAttribute("required");
            customToneDescriptionInput.value = "";
            
            // Reset client state
            userProfile = null;
            futurePersona = null;
            chatHistory = [];
            
            // Clear local/session storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Reset UI views
            placeholder.style.display = "block";
            resultCard.style.display = "none";
            errorState.classList.add("hidden");
            
            // Reset body theme class
            document.body.classList.remove("tone-motivational", "tone-honest", "tone-mentor", "tone-ceo");
            
            // Lock Chat
            chatLockedOverlay.classList.remove("hidden");
            chatWindowWrapper.classList.add("hidden");
            chatHistoryEl.innerHTML = "";
            
            // Scroll to form top
            form.scrollIntoView({ behavior: "smooth" });
            
            showToast("Timeline reset successful.");
        }
    }

    // Bind all reset buttons
    globalResetBtn.addEventListener("click", resetTimeline);
    resultResetBtn.addEventListener("click", resetTimeline);
    chatResetTimelineBtn.addEventListener("click", resetTimeline);
    if (headerResetTimelineBtn) headerResetTimelineBtn.addEventListener("click", resetTimeline);
    if (headerResultResetBtn) headerResultResetBtn.addEventListener("click", resetTimeline);
    if (headerChatResetBtn) headerChatResetBtn.addEventListener("click", resetTimeline);

    // Clickable Cards functionality
    if (cardGoals) {
        cardGoals.addEventListener("click", () => {
            const goalEl = document.getElementById("goal");
            goalEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => goalEl.focus(), 400);
        });
    }
    if (cardStruggles) {
        cardStruggles.addEventListener("click", () => {
            const struggleEl = document.getElementById("struggle");
            struggleEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => struggleEl.focus(), 400);
        });
    }
    if (cardWisdom) {
        cardWisdom.addEventListener("click", () => {
            document.getElementById("app").scrollIntoView({ behavior: "smooth" });
        });
    }

    // Text-to-Speech (TTS) Voice Synthesis Play/Pause controls
    let currentUtterance = null;
    let activeSpeechButton = null;

    function speakText(text, buttonEl) {
        if (window.speechSynthesis.speaking) {
            if (activeSpeechButton === buttonEl) {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                    updateSpeakButtonState(buttonEl, "playing");
                } else {
                    window.speechSynthesis.pause();
                    updateSpeakButtonState(buttonEl, "paused");
                }
                return;
            } else {
                window.speechSynthesis.cancel();
                resetSpeechButtons();
            }
        }

        resetSpeechButtons();

        currentUtterance = new SpeechSynthesisUtterance(text);
        activeSpeechButton = buttonEl;

        updateSpeakButtonState(buttonEl, "playing");

        currentUtterance.onend = () => {
            resetSpeechButtons();
        };

        currentUtterance.onerror = (e) => {
            console.error("Speech Synthesis Error:", e);
            resetSpeechButtons();
        };

        window.speechSynthesis.speak(currentUtterance);
    }

    function updateSpeakButtonState(buttonEl, state) {
        const iconEl = buttonEl.querySelector(".icon");
        const textEl = buttonEl.querySelector(".btn-text");

        if (state === "playing") {
            if (iconEl) iconEl.textContent = "⏸️";
            if (textEl) textEl.textContent = "Pause Voice";
            if (!iconEl && !textEl) buttonEl.textContent = "⏸️";
        } else if (state === "paused") {
            if (iconEl) iconEl.textContent = "▶️";
            if (textEl) textEl.textContent = "Resume Voice";
            if (!iconEl && !textEl) buttonEl.textContent = "▶️";
        }
    }

    function resetSpeechButtons() {
        if (speakResultBtn) {
            const iconEl = speakResultBtn.querySelector(".icon");
            const textEl = speakResultBtn.querySelector(".btn-text");
            if (iconEl) iconEl.textContent = "🔊";
            if (textEl) textEl.textContent = "Speak Reply";
        }

        document.querySelectorAll(".chat-speak-btn").forEach(btn => {
            btn.textContent = "🔊";
        });

        currentUtterance = null;
        activeSpeechButton = null;
    }

    // Bind Speak button on reflection card
    if (speakResultBtn) {
        speakResultBtn.addEventListener("click", () => {
            const responseText = document.getElementById("futureResponse").textContent;
            speakText(responseText, speakResultBtn);
        });
    }

    // Speech-to-Text (STT) Voice Chat support
    let recognition = null;
    let isRecording = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            if (chatMicBtn) {
                chatMicBtn.style.background = "rgba(239, 68, 68, 0.2)";
                chatMicBtn.style.borderColor = "rgba(239, 68, 68, 0.4)";
                chatMicBtn.querySelector(".mic-icon").textContent = "🛑";
            }
            showToast("Listening... Speak now.");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            chatInput.dispatchEvent(new Event('input'));
        };

        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            showToast(`Speech recognition error: ${event.error}`, true);
        };

        recognition.onend = () => {
            isRecording = false;
            if (chatMicBtn) {
                chatMicBtn.style.background = "rgba(255, 255, 255, .05)";
                chatMicBtn.style.borderColor = "rgba(255, 255, 255, .09)";
                chatMicBtn.querySelector(".mic-icon").textContent = "🎤";
            }
        };
    }

    if (chatMicBtn) {
        chatMicBtn.addEventListener("click", () => {
            if (!recognition) {
                showToast("Speech recognition is not supported in this browser.", true);
                return;
            }
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }

    // Keyboard handlers for textarea: Enter = Send, Shift+Enter = New line
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Form Submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const age = parseInt(document.getElementById("age").value);
        const futureAge = parseInt(document.getElementById("futureAge").value);
        const goal = document.getElementById("goal").value.trim();
        const struggle = document.getElementById("struggle").value.trim();
        const oneYearVision = document.getElementById("oneYearVision").value.trim();
        const tone = document.getElementById("tone").value;

        // Validation
        if (!name || !age || !futureAge || !goal || !struggle || !oneYearVision || !tone) {
            showToast("Please fill in all details.", true);
            return;
        }

        if (age >= futureAge) {
            showToast("Dream Future Age must be greater than Current Age.", true);
            return;
        }

        if (age <= 0 || futureAge <= 0) {
            showToast("Ages must be valid numbers.", true);
            return;
        }

        // Set state for Uplink loading
        setToneTheme(tone);
        placeholder.style.display = "none";
        resultCard.style.display = "none";
        errorState.classList.add("hidden");
        loadingState.style.display = "block";
        
        // Disable UI
        submitBtn.disabled = true;
        btnText.style.opacity = "0.5";
        btnLoader.classList.remove("hidden");

        startLoadingCycle();

        try {
            const response = await fetch("/api/generate-futureme", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    age,
                    futureAge,
                    goal,
                    struggle,
                    oneYearVision,
                    tone,
                    customToneDescription: tone === "Custom Tone" ? customToneDescriptionInput.value.trim() : undefined
                })
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonErr) {
                throw new Error("Unable to parse server response JSON frame.");
            }

            if (!response.ok || !result.success) {
                const err = new Error(result?.error || "Uplink configuration failed.");
                err.serverResult = result;
                throw err;
            }

            // Save session state
            userProfile = { 
                name, 
                age, 
                futureAge, 
                goal, 
                struggle, 
                oneYearVision, 
                tone,
                customToneDescription: tone === "Custom Tone" ? customToneDescriptionInput.value.trim() : undefined
            };
            futurePersona = result.data;

            // Render Results Card
            renderResults();

            // Setup and Unlock Chat
            initializeChat();

            showToast("Timeline bridge established successfully.");
        } catch (error) {
            const friendlyErr = getFriendlyErrorMessage(error, error.serverResult || null);
            stopLoadingCycle();
            loadingState.style.display = "none";
            errorState.classList.remove("hidden");
            errorMessage.textContent = friendlyErr;
            showToast("Uplink failed. Check connection details.", true);
        } finally {
            submitBtn.disabled = false;
            btnText.style.opacity = "1";
            btnLoader.classList.add("hidden");
            stopLoadingCycle();
        }
    });

    // Handle Retry
    retryBtn.addEventListener("click", () => {
        errorState.classList.add("hidden");
        placeholder.style.display = "block";
        form.scrollIntoView({ behavior: "smooth" });
    });

    // Populate and show the result card
    function renderResults() {
        loadingState.style.display = "none";
        resultCard.style.display = "block";

        responseEl.textContent = futurePersona.message;
        identityBadge.textContent = `${userProfile.name} • Age ${userProfile.futureAge}`;
        toneBadge.textContent = userProfile.tone;
        
        // Update tone badge colors dynamically
        toneBadge.className = "tone-badge"; // reset

        // Populating moves list
        movesList.innerHTML = "";
        futurePersona.nextMoves.forEach((move, index) => {
            const li = document.createElement("li");
            li.setAttribute("data-index", index + 1);
            li.textContent = move;
            movesList.appendChild(li);
        });

        // Habit & Warning
        habitText.textContent = futurePersona.habit;
        warningText.textContent = futurePersona.warning;

        // Mantra
        mantraText.textContent = futurePersona.mantra;

        // Smooth scroll to results if on mobile
        if (window.innerWidth <= 960) {
            resultsContainer.scrollIntoView({ behavior: "smooth" });
        }
    }

    // Initialize Interactive Chat
    function initializeChat() {
        chatLockedOverlay.classList.add("hidden");
        chatWindowWrapper.classList.remove("hidden");

        chatHeaderName.textContent = `Future ${userProfile.name}`;
        chatHeaderTone.textContent = `${userProfile.tone} Mode`;

        // Reset history list
        chatHistory = [];
        chatHistoryEl.innerHTML = "";

        // Add Initial Greeting
        const greeting = `I'm you at age ${userProfile.futureAge}. We survived the fears and did the work, ${userProfile.name}. I know exactly how hard your struggle with "${userProfile.struggle}" feels right now, but trust me, we found a way. Ask me anything about what's ahead, or how we got here.`;
        
        appendChatMessage("ai", greeting);
        chatHistory.push({ role: "futureme", message: greeting });
    }

    // Append Messages to Chat History Element
    function appendChatMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${sender}`;

        const bubble = document.createElement("div");
        bubble.className = "bubble";

        // Add TTS play/pause button if the sender is the future self
        if (sender === "ai") {
            const speakBtn = document.createElement("button");
            speakBtn.className = "chat-speak-btn";
            speakBtn.textContent = "🔊";
            speakBtn.title = "Speak message";
            speakBtn.style.background = "none";
            speakBtn.style.border = "none";
            speakBtn.style.color = "var(--muted)";
            speakBtn.style.cursor = "pointer";
            speakBtn.style.fontSize = "0.95rem";
            speakBtn.style.float = "right";
            speakBtn.style.marginLeft = "12px";
            speakBtn.style.marginTop = "2px";
            speakBtn.style.transition = "all 0.2s ease";
            speakBtn.style.outline = "none";
            
            speakBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                speakText(text, speakBtn);
            });
            bubble.appendChild(speakBtn);
        }

        // Convert simple line breaks to paragraphs
        const paragraphs = text.split("\n\n");
        paragraphs.forEach(para => {
            const p = document.createElement("p");
            p.textContent = para;
            bubble.appendChild(p);
        });

        msgDiv.appendChild(bubble);
        chatHistoryEl.appendChild(msgDiv);

        // Scroll history to bottom
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
    }

    // Chat Submission
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const question = chatInput.value.trim();
        if (!question || !userProfile || !futurePersona) return;

        // Add user message to UI
        appendChatMessage("user", question);
        chatInput.value = "";

        // Push to local chat history state
        chatHistory.push({ role: "user", message: question });

        // Show typing indicator
        typingIndicator.classList.remove("hidden");
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

        // Disable input
        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        try {
            const response = await fetch("/api/chat-futureme", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userProfile,
                    chatHistory,
                    question,
                    futurePersona
                })
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonErr) {
                throw new Error("Unable to parse chat response JSON frame.");
            }

            if (!response.ok || !result.success) {
                const err = new Error(result?.error || "Connection to timeline lost.");
                err.serverResult = result;
                throw err;
            }

            // Hide typing indicator
            typingIndicator.classList.add("hidden");

            // Display reply
            appendChatMessage("ai", result.reply);
            chatHistory.push({ role: "futureme", message: result.reply });

        } catch (error) {
            const friendlyErr = getFriendlyErrorMessage(error, error.serverResult || null);
            typingIndicator.classList.add("hidden");
            appendChatMessage("ai", `Timeline link unstable. FutureMe could not respond right now.\n\nReason: ${friendlyErr}`);
            showToast("Chat response failed.", true);
        } finally {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    });

    // Reset Chat Flow
    resetChatBtn.addEventListener("click", () => {
        if (confirm("Reset the chat conversation? This will clear history.")) {
            initializeChat();
            showToast("Conversation history cleared.");
        }
    });

    // Jump to Chat Section
    chatJumpBtn.addEventListener("click", () => {
        const chatSection = document.getElementById("chat");
        chatSection.scrollIntoView({ behavior: "smooth" });
    });

    // Copy Results System
    copyBtn.addEventListener("click", () => {
        if (!futurePersona || !userProfile) return;

        const formattedText = `🔮 FUTUREME REFLECTION REPORT
=====================================
Timeline Setup: ${userProfile.name} (Age ${userProfile.age}) -> Future Self (Age ${userProfile.futureAge})
Tone Setting: ${userProfile.tone}
Mantra Compass: "${futurePersona.mantra}"

--- MESSAGE FROM YOUR FUTURE SELF ---
${futurePersona.message}

--- STRATEGIC NEXT MOVES ---
${futurePersona.nextMoves.map((move, i) => `${i + 1}. ${move}`).join("\n")}

--- CORE ACTIONS ---
🔑 Daily Habit to Start: ${futurePersona.habit}
⚠️ Critical Blindspot Warning: ${futurePersona.warning}

=====================================
FutureMe AI Experience. Reflect. Act. Become.`;

        navigator.clipboard.writeText(formattedText)
            .then(() => {
                showToast("Reflection copied to clipboard! Share it with the world.");
            })
            .catch(err => {
                console.error("Copy failed", err);
                showToast("Failed to copy. Please try manually selecting the text.", true);
            });
    });

    // Intersection Observer for Premium Fade Up Animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll(".fade-up").forEach(el => {
        observer.observe(el);
    });
});

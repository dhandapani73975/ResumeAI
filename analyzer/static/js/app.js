/* ==========================================================================
   ResumeAI JS Engine - Client-Side Controller, Audio Speech & Theme Management
   ========================================================================== */

// Global Application State
let activeResumeId = null;
let activeResumeName = "";
let skillsChart = null;
let currentMockQuestionIndex = 0;
let mockQuestions = [];
let isRecordingAnswer = false;
let speechRecognitionObj = null;
const chatMessageHistory = [];

// ==========================================
// 1. Initialization and Theme Handler
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNavigation();
    initUploadZone();
    initChart();
    initSubtabs();
    initRewriter();
    initJobMatcher();
    initInterviewPrep();
    initSpeechMock();
    initChatCoach();
    
    // Proactively fetch initial dashboard metrics
    fetchAdminStats();
    fetchHistoryList();
    
    // Wire Print/Export PDF
    document.getElementById("printReportBtn").addEventListener("click", () => {
        window.print();
    });

    document.getElementById("quickHistoryBtn").addEventListener("click", () => {
        showTab("history");
    });
});

function initTheme() {
    const themeBtn = document.getElementById("themeToggleBtn");
    const currentTheme = localStorage.getItem("theme") || "dark";
    
    document.documentElement.setAttribute("data-theme", currentTheme);
    updateThemeLabel(currentTheme);

    themeBtn.addEventListener("click", () => {
        const activeTheme = document.documentElement.getAttribute("data-theme");
        const nextTheme = activeTheme === "dark" ? "light" : "dark";
        
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("theme", nextTheme);
        updateThemeLabel(nextTheme);
    });
}

function updateThemeLabel(theme) {
    const label = document.querySelector(".toggle-label");
    if (label) {
        label.textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
    }
}

// ==========================================
// 2. SPA Navigation & State Management
// ==========================================
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            
            // Check if tab is blocked for missing resume
            if (item.classList.contains("disabled-need-resume") && !activeResumeId) {
                alert("Please upload or select a resume first to unlock this section.");
                showTab("upload");
                return;
            }
            
            showTab(tabId);
        });
    });
}

function showTab(tabId) {
    // Hide all tab panels
    const panels = document.querySelectorAll(".tab-content");
    panels.forEach(p => p.classList.remove("active"));
    
    // Remove active from nav links
    const links = document.querySelectorAll(".nav-item");
    links.forEach(l => l.classList.remove("active"));
    
    // Activate target panel and link
    const targetPanel = document.getElementById(`${tabId}-tab`);
    const targetLink = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    
    if (targetPanel) {
        targetPanel.classList.add("active");
    }
    if (targetLink) {
        targetLink.classList.add("active");
    }
    
    // Context-dependent tab loads
    if (tabId === "analysis" && activeResumeId) {
        triggerResumeAnalysis(activeResumeId);
    } else if (tabId === "interview" && activeResumeId) {
        triggerInterviewPrep(activeResumeId);
    } else if (tabId === "admin") {
        fetchAdminStats();
    } else if (tabId === "history") {
        fetchHistoryList();
    }
}

function updateActiveResumeState(id, name) {
    activeResumeId = id;
    activeResumeName = name;
    
    // Unlock blocked resume navigation
    const disabledItems = document.querySelectorAll(".disabled-need-resume");
    disabledItems.forEach(item => item.classList.remove("disabled-need-resume"));
    
    // Update active badge in top header
    const badge = document.getElementById("activeResumeBadge");
    const nameLabel = document.getElementById("activeResumeName");
    if (badge && nameLabel) {
        nameLabel.textContent = name;
        badge.style.display = "flex";
    }
}

// ==========================================
// 3. File Upload Engine
// ==========================================
function initUploadZone() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("resumeFileInput");
    const browseBtn = document.getElementById("browseFilesBtn");
    
    browseBtn.addEventListener("click", () => fileInput.click());
    
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleUpload(e.target.files[0]);
        }
    });
    
    // Drag and Drop triggers
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        }, false);
    });
    
    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
        }, false);
    });
    
    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleUpload(files[0]);
        }
    });
}

function handleUpload(file) {
    const progressCard = document.getElementById("uploadProgressCard");
    const progressFileName = document.getElementById("progressFileName");
    const progressStatus = document.getElementById("progressStatus");
    const progressFill = document.getElementById("progressFill");
    
    progressFileName.textContent = file.name;
    progressStatus.textContent = "Uploading file securely...";
    progressFill.style.width = "20%";
    progressCard.style.display = "block";
    
    const formData = new FormData();
    formData.append("resume", file);
    
    // Simulated upload progress steps prior to fetch response
    setTimeout(() => { progressFill.style.width = "45%"; progressStatus.textContent = "Extracting raw text..."; }, 400);
    setTimeout(() => { progressFill.style.width = "75%"; progressStatus.textContent = "Building relational indexes..."; }, 1000);
    
    fetch("/api/upload/", {
        method: "POST",
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to parse file. Make sure it's a valid format.");
        }
        return response.json();
    })
    .then(data => {
        progressFill.style.width = "100%";
        progressStatus.textContent = "Upload successful! Triggering AI engine...";
        
        setTimeout(() => {
            progressCard.style.display = "none";
            updateActiveResumeState(data.id, data.filename);
            
            // Redirect straight to AI Analysis page!
            showTab("analysis");
            fetchAdminStats(); // Update dashboard in background
        }, 800);
    })
    .catch(error => {
        progressStatus.textContent = `Error: ${error.message}`;
        progressFill.style.backgroundColor = "var(--danger)";
        console.error("Upload error:", error);
    });
}

// ==========================================
// 4. AI Detailed Analysis Page Render
// ==========================================
function triggerResumeAnalysis(resumeId) {
    // Show spinner in summary text areas
    document.getElementById("experienceCritiqueText").textContent = "Triggering AI Critique...";
    document.getElementById("projectCritiqueText").textContent = "Evaluating structural patterns...";
    
    fetch(`/api/analyze/${resumeId}/`)
    .then(res => res.json())
    .then(data => {
        renderAnalysisPage(data);
    })
    .catch(err => {
        console.error("Analysis render error:", err);
    });
}

function renderAnalysisPage(data) {
    // 1. Animate Scores Radial Charts
    animateScoreCircle("atsScoreCircle", "atsScoreText", data.ats_score || 0);
    animateScoreCircle("strengthScoreCircle", "strengthScoreText", data.strength_score || 0);
    
    // 2. Render Text Critique
    document.getElementById("experienceCritiqueText").textContent = data.experience_critique || "N/A";
    document.getElementById("projectCritiqueText").textContent = data.project_critique || "N/A";
    
    // 3. Skills Lists
    const detectedList = document.getElementById("detectedSkillsList");
    const missingList = document.getElementById("missingSkillsList");
    
    detectedList.innerHTML = "";
    missingList.innerHTML = "";
    
    const detected = data.detected_skills || [];
    const missing = data.missing_skills || [];
    
    document.getElementById("countDetectedSkills").textContent = detected.length;
    document.getElementById("countMissingSkills").textContent = missing.length;
    
    detected.forEach(skill => {
        const badge = document.createElement("span");
        badge.className = "badge-skill detected";
        badge.textContent = skill;
        detectedList.appendChild(badge);
    });
    
    missing.forEach(skill => {
        const badge = document.createElement("span");
        badge.className = "badge-skill missing";
        badge.textContent = skill;
        missingList.appendChild(badge);
    });
    
    // 4. Grammar Suggestions
    const grammarList = document.getElementById("grammarSuggestionsList");
    grammarList.innerHTML = "";
    const suggestions = data.suggestions || ["No layout or styling errors detected. Excellent work!"];
    
    suggestions.forEach(tip => {
        const li = document.createElement("li");
        li.textContent = tip;
        grammarList.appendChild(li);
    });
    
    // 5. Keywords Optimization Table
    const keywordTable = document.getElementById("keywordsOptimizationTable");
    keywordTable.innerHTML = "";
    const keywords = data.keyword_optimizations || [];
    
    if (keywords.length === 0) {
        keywordTable.innerHTML = `<tr><td colspan="2" class="text-muted text-center">Your resume contains all core target terms.</td></tr>`;
    } else {
        keywords.forEach(item => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${item.keyword}</strong></td>
                <td>${item.reason}</td>
            `;
            keywordTable.appendChild(row);
        });
    }
    
    // 6. Action Plan Grid
    const tipsList = document.getElementById("actionableTipsList");
    tipsList.innerHTML = "";
    const tips = data.actionable_tips || [];
    
    tips.forEach((tip, idx) => {
        const card = document.createElement("div");
        card.className = "tip-card glass";
        card.innerHTML = `
            <div class="tip-card-icon">${idx + 1}</div>
            <div class="tip-card-content">
                <h4>Core Directive</h4>
                <p>${tip}</p>
            </div>
        `;
        tipsList.appendChild(card);
    });
}

function animateScoreCircle(circleId, textId, score) {
    const circle = document.getElementById(circleId);
    const text = document.getElementById(textId);
    
    let currentScore = 0;
    const interval = setInterval(() => {
        if (currentScore >= score) {
            clearInterval(interval);
        } else {
            currentScore++;
            circle.setAttribute("stroke-dasharray", `${currentScore}, 100`);
            text.textContent = `${currentScore}%`;
        }
    }, 15);
}

// Subtabs visual activation inside Analysis page
function initSubtabs() {
    const buttons = document.querySelectorAll(".detail-tab-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const panels = document.querySelectorAll(".subtab-panel");
            panels.forEach(p => p.classList.remove("active"));
            
            const targetPanel = document.getElementById(btn.getAttribute("data-subtab"));
            if (targetPanel) {
                targetPanel.classList.add("active");
            }
        });
    });
}

// ==========================================
// 5. AI Custom Text Rewriter
// ==========================================
function initRewriter() {
    const rewriteBtn = document.getElementById("triggerRewriteBtn");
    const inputArea = document.getElementById("rewriterInputText");
    const placeholder = document.getElementById("rewriterPlaceholder");
    const contentBox = document.getElementById("rewriterOutputContent");
    const outputText = document.getElementById("rewriterOutputText");
    const copyBtn = document.getElementById("copyRewrittenBtn");
    
    rewriteBtn.addEventListener("click", () => {
        const text = inputArea.value.trim();
        if (!text) {
            alert("Please paste a bullet point to optimize.");
            return;
        }
        
        rewriteBtn.textContent = "Rewriting...";
        rewriteBtn.disabled = true;
        
        fetch(`/api/chat/${activeResumeId}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: `Rewrite and optimize this specific resume bullet to make it highly professional, metric-oriented, and recruiter-focused: "${text}"`,
                history: []
            })
        })
        .then(res => res.json())
        .then(data => {
            placeholder.style.display = "none";
            contentBox.style.display = "flex";
            
            // Render text clean (stripping prompt prefixes)
            let cleaned = data.response || "";
            cleaned = cleaned.replace(/### AI Career Coach Insights[\s\S]*?\n\n/i, "");
            cleaned = cleaned.replace(/### Experience Bullet Rewrite[\s\S]*?\n\n/i, "");
            cleaned = cleaned.replace(/\* \*\*Before\*\*[\s\S]*?\* \*\*After \(Recruiter-Optimized\)\*\*: /i, "");
            
            outputText.innerHTML = cleaned.replace(/\n/g, "<br>");
            
            rewriteBtn.textContent = "Optimize with AI";
            rewriteBtn.disabled = false;
        })
        .catch(err => {
            console.error("Rewrite error:", err);
            rewriteBtn.textContent = "Optimize with AI";
            rewriteBtn.disabled = false;
        });
    });
    
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(outputText.textContent.trim());
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy to Clipboard"; }, 1500);
    });
}

// ==========================================
// 6. Interactive Job Description Matcher
// ==========================================
function initJobMatcher() {
    const matchBtn = document.getElementById("triggerJobMatchBtn");
    const jdTitle = document.getElementById("jdJobTitle");
    const jdText = document.getElementById("jdText");
    const container = document.getElementById("matcherOutputsContainer");
    
    matchBtn.addEventListener("click", () => {
        const title = jdTitle.value.trim() || "Target Role";
        const text = jdText.value.trim();
        
        if (!text) {
            alert("Please paste the target job description to match against.");
            return;
        }
        
        matchBtn.textContent = "Analyzing Match fit...";
        matchBtn.disabled = true;
        
        fetch(`/api/job-match/${activeResumeId}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                job_title: title,
                job_description: text
            })
        })
        .then(res => res.json())
        .then(data => {
            renderJobMatcherResults(data);
            matchBtn.textContent = "Analyze Job Match";
            matchBtn.disabled = false;
            fetchAdminStats(); // reload background counts
        })
        .catch(err => {
            console.error("Match error:", err);
            matchBtn.textContent = "Analyze Job Match";
            matchBtn.disabled = false;
        });
    });
}

function renderJobMatcherResults(data) {
    const container = document.getElementById("matcherOutputsContainer");
    container.innerHTML = "";
    
    const card = document.createElement("div");
    card.className = "matcher-results-card glass animate-slide-up";
    
    // Compiling visual overlap pills
    const matchedPills = data.matched_keywords.map(kw => `<span class="badge-skill detected">${kw}</span>`).join("");
    const missingPills = data.missing_keywords.map(kw => `<span class="badge-skill missing">${kw}</span>`).join("");
    
    const planBullets = data.action_plan.map(p => `<li>${p}</li>`).join("");
    const suggestionBullets = data.suggested_bullet_points.map(b => `<div class="rewritten-bubble">${b}</div>`).join("").replace(/\n/g, "");

    card.innerHTML = `
        <div class="match-score-summary">
            <div class="match-score-circle">${data.compatibility_score}%</div>
            <div class="match-summary-text">
                <h3>Compatibility Match Score</h3>
                <p>${data.role_fit}</p>
            </div>
        </div>
        
        <div class="critique-divider"></div>
        
        <div class="keywords-overlap-grid">
            <div class="keyword-box glass">
                <h4>Matched Keywords (${data.matched_keywords.length})</h4>
                <div class="badge-flex">${matchedPills || '<span class="text-muted">None detected.</span>'}</div>
            </div>
            <div class="keyword-box glass">
                <h4>Missing Search Gaps (${data.missing_keywords.length})</h4>
                <div class="badge-flex">${missingPills || '<span class="text-muted">Perfect overlap!</span>'}</div>
            </div>
        </div>
        
        <div class="critique-divider"></div>
        
        <div class="suggested-bullet-points-box">
            <h4 style="font-size: 13px; margin-bottom: 12px;">AI-written bullet alternatives to paste in:</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">${suggestionBullets}</div>
        </div>
        
        <div class="critique-divider"></div>
        
        <div class="keyword-box glass">
            <h4>Recommended Optimization Actions</h4>
            <ul class="suggestions-list" style="margin-top: 8px;">
                ${planBullets}
            </ul>
        </div>
    `;
    
    container.appendChild(card);
}

// ==========================================
// 7. Standard Interview Questions Prep
// ==========================================
function initInterviewPrep() {
    // Setup select handlers on question rows
    // Handled dynamically when compiling rows
}

function triggerInterviewPrep(resumeId) {
    const listWrapper = document.getElementById("interviewQuestionsList");
    listWrapper.innerHTML = `<div class="text-center py-4"><div class="loader-spinner m-auto"></div></div>`;
    
    fetch(`/api/interview-prep/${resumeId}/`)
    .then(res => res.json())
    .then(data => {
        mockQuestions = data.questions || [];
        renderInterviewQuestions(mockQuestions);
    })
    .catch(err => {
        console.error("Prep error:", err);
    });
}

function renderInterviewQuestions(questions) {
    const listWrapper = document.getElementById("interviewQuestionsList");
    listWrapper.innerHTML = "";
    
    if (questions.length === 0) {
        listWrapper.innerHTML = `<p class="text-muted">Could not compile question modules. Try reloading.</p>`;
        return;
    }
    
    questions.forEach((q, idx) => {
        const row = document.createElement("div");
        row.className = "question-row";
        row.setAttribute("data-q-idx", idx);
        
        row.innerHTML = `
            <span class="badge badge-purple">${q.category}</span>
            <div class="question-text-box">
                <h4>${q.question}</h4>
            </div>
        `;
        
        row.addEventListener("click", () => {
            document.querySelectorAll(".question-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");
            showQuestionTipPanel(q);
        });
        
        listWrapper.appendChild(row);
    });
    
    // Auto-select first question
    const firstRow = listWrapper.querySelector(".question-row");
    if (firstRow) {
        firstRow.click();
    }
}

function showQuestionTipPanel(question) {
    document.getElementById("interviewTipEmptyState").style.display = "none";
    
    const panel = document.getElementById("interviewTipContentPanel");
    const catBadge = document.getElementById("tipCategoryBadge");
    const title = document.getElementById("tipQuestionTitle");
    const description = document.getElementById("tipDescriptionText");
    
    catBadge.textContent = question.category;
    title.textContent = question.question;
    description.textContent = question.tip || "Focus on describing concrete system structures, business motivations, or team coordination models.";
    
    panel.style.display = "flex";
}

// ==========================================
// 8. Speech-Based Mock Interview Engine
// ==========================================
function initSpeechMock() {
    const toggleBtn = document.getElementById("triggerSpeechMockToggle");
    const panel = document.getElementById("speechMockPanel");
    const grid = document.getElementById("standardInterviewPrepGrid");
    const exitBtn = document.getElementById("exitSpeechMockBtn");
    
    toggleBtn.addEventListener("click", () => {
        if (mockQuestions.length === 0) {
            alert("No mock questions available. Please complete analysis first.");
            return;
        }
        
        grid.style.display = "none";
        panel.style.display = "flex";
        currentMockQuestionIndex = 0;
        
        loadSpeechMockQuestion(currentMockQuestionIndex);
    });
    
    exitBtn.addEventListener("click", () => {
        // Stop recognition if active
        if (isRecordingAnswer && speechRecognitionObj) {
            speechRecognitionObj.stop();
        }
        
        // Stop speaking
        window.speechSynthesis.cancel();
        
        panel.style.display = "none";
        grid.style.display = "grid";
    });
    
    // Read Question Aloud
    document.getElementById("speechReadQuestionBtn").addEventListener("click", () => {
        const activeQuestion = mockQuestions[currentMockQuestionIndex];
        if (activeQuestion) {
            speakTextAloud(activeQuestion.question);
        }
    });
    
    // Record Button Voice Recognition
    const micBtn = document.getElementById("speechMicBtn");
    micBtn.addEventListener("click", () => {
        if (!isRecordingAnswer) {
            startSpeechRecognition();
        } else {
            stopSpeechRecognition();
        }
    });
    
    // Next Question
    document.getElementById("speechNextBtn").addEventListener("click", () => {
        currentMockQuestionIndex++;
        if (currentMockQuestionIndex >= mockQuestions.length) {
            alert("Congratulations! You have completed the Speech-based Mock Interview!");
            exitBtn.click();
        } else {
            loadSpeechMockQuestion(currentMockQuestionIndex);
        }
    });
}

function loadSpeechMockQuestion(idx) {
    const q = mockQuestions[idx];
    if (!q) return;
    
    document.getElementById("speechQuestionCategory").textContent = q.category;
    document.getElementById("speechQuestionText").textContent = q.question;
    document.getElementById("speechQuestionTip").textContent = `💡 Tip: ${q.tip || "Be descriptive and structural."}`;
    
    // Hide transcription bubble
    document.getElementById("speechTranscriptBox").style.display = "none";
    document.getElementById("speechTranscribedText").textContent = "Listening...";
    
    // Cancel active synthesis speech
    window.speechSynthesis.cancel();
    
    // Proactively speak question aloud
    setTimeout(() => speakTextAloud(q.question), 500);
}

function speakTextAloud(text) {
    if (!('speechSynthesis' in window)) {
        console.warn("Speech synthesis not supported in this browser.");
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // clean pace
    
    // Try to find a good female/male natural voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(voice => voice.name.includes("Google") || voice.name.includes("Natural"));
    if (naturalVoice) {
        utterance.voice = naturalVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Web Speech recognition is not supported in this browser environment. Showing manual answer box instead.");
        simulateTextResponse();
        return;
    }
    
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.continuous = true;
    speechRecognitionObj.interimResults = true;
    speechRecognitionObj.lang = 'en-US';
    
    const wave = document.getElementById("audioWaveWrap");
    const micBtn = document.getElementById("speechMicBtn");
    const statusText = document.getElementById("speechMockStatusText");
    const transcriptBox = document.getElementById("speechTranscriptBox");
    const transcriptP = document.getElementById("speechTranscribedText");
    
    isRecordingAnswer = true;
    micBtn.querySelector("span").textContent = "Stop Recording";
    micBtn.classList.add("btn-danger");
    statusText.textContent = "Listening to your answer...";
    wave.style.display = "flex";
    transcriptBox.style.display = "block";
    transcriptP.textContent = "...";
    
    speechRecognitionObj.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        transcriptP.textContent = finalTranscript || interimTranscript || "...";
    };
    
    speechRecognitionObj.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        stopSpeechRecognition();
    };
    
    speechRecognitionObj.onend = () => {
        stopSpeechRecognition();
    };
    
    speechRecognitionObj.start();
}

function stopSpeechRecognition() {
    if (!isRecordingAnswer) return;
    
    isRecordingAnswer = false;
    const wave = document.getElementById("audioWaveWrap");
    const micBtn = document.getElementById("speechMicBtn");
    const statusText = document.getElementById("speechMockStatusText");
    
    micBtn.querySelector("span").textContent = "Record Answer";
    micBtn.classList.remove("btn-danger");
    statusText.textContent = "Answer recorded successfully!";
    wave.style.display = "none";
    
    if (speechRecognitionObj) {
        speechRecognitionObj.stop();
    }
}

function simulateTextResponse() {
    const transcriptBox = document.getElementById("speechTranscriptBox");
    const transcriptP = document.getElementById("speechTranscribedText");
    transcriptBox.style.display = "block";
    
    const response = prompt("Please type in your answer for this interview question:");
    if (response) {
        transcriptP.textContent = response;
    } else {
        transcriptBox.style.display = "none";
    }
}

// ==========================================
// 9. AI Career Coach Chat Assistant
// ==========================================
function initChatCoach() {
    const sendBtn = document.getElementById("chatSendMessageBtn");
    const inputArea = document.getElementById("chatInputMessage");
    
    sendBtn.addEventListener("click", () => {
        triggerChatMsg();
    });
    
    inputArea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            triggerChatMsg();
        }
    });
}

function triggerChatMsg() {
    const inputArea = document.getElementById("chatInputMessage");
    const text = inputArea.value.trim();
    
    if (!text) return;
    
    appendChatMessage("user", text);
    inputArea.value = "";
    
    // Add load bubble
    const container = document.getElementById("chatMessagesThread");
    const loadBubble = document.createElement("div");
    loadBubble.className = "message-bubble assistant loading";
    loadBubble.innerHTML = `
        <div class="avatar">RA</div>
        <div class="text"><div class="loader-spinner"></div></div>
    `;
    container.appendChild(loadBubble);
    container.scrollTop = container.scrollHeight;
    
    fetch(`/api/chat/${activeResumeId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: text,
            history: chatMessageHistory
        })
    })
    .then(res => res.json())
    .then(data => {
        // remove load bubble
        loadBubble.remove();
        
        appendChatMessage("assistant", data.response);
        
        // Cache historical dialogues
        chatMessageHistory.push({ sender: "user", text: text });
        chatMessageHistory.push({ sender: "assistant", text: data.response });
    })
    .catch(err => {
        loadBubble.remove();
        console.error("Chat engine failed:", err);
    });
}

function appendChatMessage(sender, rawText) {
    const container = document.getElementById("chatMessagesThread");
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${sender}`;
    
    // Convert basic markdown tags to html elements
    let formattedText = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formattedText = formattedText.replace(/### (.*?)\n/g, '<h3>$1</h3>');
    formattedText = formattedText.replace(/🚀/g, '🌟');
    
    // Parse numbered lists or standard bullets
    const lines = formattedText.split("\n");
    let inList = false;
    let listHTML = "<ul>";
    
    const parsedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("1. ") || trimmed.startsWith("2. ") || trimmed.startsWith("3. ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const inner = trimmed.substring(2);
            if (!inList) {
                inList = true;
                return `<ul><li>${inner}</li>`;
            }
            return `<li>${inner}</li>`;
        } else {
            if (inList) {
                inList = false;
                return `</ul><p>${trimmed}</p>`;
            }
            return trimmed ? `<p>${trimmed}</p>` : "";
        }
    });
    
    let joined = parsedLines.join("");
    if (inList) {
        joined += "</ul>";
    }

    bubble.innerHTML = `
        <div class="avatar">${sender === "user" ? "ME" : "RA"}</div>
        <div class="text">${joined}</div>
    `;
    
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

// ==========================================
// 10. Dashboard Skill chart integration
// ==========================================
function initChart() {
    // Initialise empty canvas prior to active data loadings
}

function updateDashboardSkillsChart(labels, values) {
    const ctx = document.getElementById("dashboardSkillsChart").getContext("2d");
    
    if (skillsChart) {
        skillsChart.destroy();
    }
    
    // check current theme for grid lines
    const activeTheme = document.documentElement.getAttribute("data-theme");
    const fontColor = activeTheme === "dark" ? "#94a3b8" : "#475569";
    const gridColor = activeTheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
    
    skillsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Identified Keywords Density",
                data: values,
                backgroundColor: "rgba(139, 92, 246, 0.4)",
                borderColor: "#8b5cf6",
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: fontColor, stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: fontColor }
                }
            }
        }
    });
}

// ==========================================
// 11. Backend API stats loader
// ==========================================
function fetchAdminStats() {
    fetch("/api/admin-stats/")
    .then(res => res.json())
    .then(data => {
        // Feed Dashboard Widgets
        document.getElementById("kpi-total-resumes").textContent = data.total_resumes;
        document.getElementById("kpi-avg-ats").innerHTML = `${data.avg_ats}<span>%</span>`;
        document.getElementById("kpi-total-matches").textContent = data.total_matches;
        
        // Populate Admin widgets
        document.getElementById("adminTotalResumes").textContent = data.total_resumes;
        document.getElementById("adminTotalMatches").textContent = data.total_matches;
        document.getElementById("adminTokensValue").textContent = data.total_tokens.toLocaleString();
        
        // Build detected skills chart values
        const chartLabels = data.detected_skills_chart.map(x => x.skill);
        const chartValues = data.detected_skills_chart.map(x => x.count);
        
        if (chartLabels.length > 0) {
            updateDashboardSkillsChart(chartLabels, chartValues);
        } else {
            // Default placeholder chart values
            updateDashboardSkillsChart(
                ["Python", "React", "Docker", "SQL", "Git"],
                [4, 3, 2, 5, 3]
            );
        }
        
        // Render Admin list details
        const listAdmin = document.getElementById("adminDetectedSkillsList");
        listAdmin.innerHTML = "";
        
        data.detected_skills_chart.forEach(item => {
            const maxVal = Math.max(...data.detected_skills_chart.map(x => x.count)) || 1;
            const pct = Math.round((item.count / maxVal) * 100);
            
            const div = document.createElement("div");
            div.className = "stat-row";
            div.innerHTML = `
                <div class="stat-label-row">
                    <span>${item.skill}</span>
                    <strong>${item.count} uploads</strong>
                </div>
                <div class="stat-progress-bar">
                    <div class="stat-progress-fill" style="width: ${pct}%;"></div>
                </div>
            `;
            listAdmin.appendChild(div);
        });
        
        // Renders Console logs
        const consoleBox = document.getElementById("adminConsoleBox");
        consoleBox.innerHTML = "";
        
        data.usage_logs.forEach(log => {
            const line = document.createElement("div");
            const statusClass = log.status.startsWith("failed") ? "failed" : "success";
            line.className = `log-line ${statusClass}`;
            line.textContent = `[${log.timestamp}] ACTION: ${log.action.toUpperCase()} | TOKENS: ${log.tokens} | STATUS: ${log.status.toUpperCase()}`;
            consoleBox.appendChild(line);
        });
        
        if (data.usage_logs.length === 0) {
            consoleBox.innerHTML = `<div class="log-line text-muted">Awaiting API traffic logs...</div>`;
        }
        
        // Update admin groq key display status indicator
        const dot = document.getElementById("adminGroqStatusCircle");
        const label = document.getElementById("adminGroqStatusLabel");
        
        if (data.groq_api_configured) {
            dot.className = "status-circle green";
            label.textContent = "Active (Connected via Llama-3 API Key)";
        } else {
            dot.className = "status-circle red-pulse";
            label.textContent = "Active (Running in High-Fidelity Mock Mode)";
        }
    })
    .catch(err => console.error("Error loading dashboard metrics:", err));
}

function fetchHistoryList() {
    fetch("/api/history/")
    .then(res => res.json())
    .then(data => {
        // Feed Dashboard Recent Listing
        const recentList = document.getElementById("dashboardRecentList");
        recentList.innerHTML = "";
        
        const history = data.history || [];
        const recent = history.slice(0, 3);
        
        recent.forEach(r => {
            const item = document.createElement("div");
            item.className = "user-profile animate-slide-up";
            item.style.cursor = "pointer";
            item.style.justifyContent = "space-between";
            item.style.padding = "10px 14px";
            
            const badgeClass = (r.ats_score || 0) >= 80 ? "pill-green" : "pill-red";
            item.innerHTML = `
                <div class="file-info-row">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                    <div class="text-group">
                        <h4 style="font-size: 13px;">${r.filename}</h4>
                        <p style="font-size: 11px;">Uploaded ${r.uploaded_at}</p>
                    </div>
                </div>
                <span class="pill ${badgeClass}">ATS: ${r.ats_score || '--'}%</span>
            `;
            
            item.addEventListener("click", () => {
                updateActiveResumeState(r.id, r.filename);
                showTab("analysis");
            });
            
            recentList.appendChild(item);
        });
        
        if (recent.length === 0) {
            recentList.innerHTML = `
                <div class="empty-state-compact">
                    <p>No resumes uploaded yet. Let's get started!</p>
                    <button class="btn btn-secondary btn-sm" onclick="showTab('upload')">Upload First Resume</button>
                </div>
            `;
        }
        
        // Feed Large History Table
        const tableBody = document.getElementById("historyTableBody");
        tableBody.innerHTML = "";
        
        history.forEach(r => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${r.filename}</strong></td>
                <td>${r.uploaded_at}</td>
                <td><span class="pill ${(r.ats_score || 0) >= 80 ? 'pill-green' : 'pill-red'}">${r.ats_score || '--'}%</span></td>
                <td>${r.strength_score || '--'}%</td>
                <td><span class="badge badge-purple">${r.matches_count} scenarios</span></td>
                <td>
                    <button class="btn-text btn-history-load" data-id="${r.id}" data-name="${r.filename}">Inspect Report</button>
                </td>
            `;
            
            row.querySelector(".btn-history-load").addEventListener("click", () => {
                updateActiveResumeState(r.id, r.filename);
                showTab("analysis");
            });
            
            tableBody.appendChild(row);
        });
        
        if (history.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-4">No resumes found in database storage.</td></tr>`;
        }
    })
    .catch(err => console.error("Error loading upload list:", err));
}

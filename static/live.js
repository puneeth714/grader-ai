let currentEngineUrl = "";
let currentSessionId = "";
let qpFile = null;
let ansFile = null;
let currentGradeData = null;
let isOfflineMode = false;

document.addEventListener("DOMContentLoaded", async () => {
    setupEngineUrl();
    setupDropzones();
    setupEventListeners();
    await checkEngineHealth();
    
    // Auto-load synthetic physics preset on startup
    await loadSyntheticPreset();
});

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function setupEngineUrl() {
    const customEngine = getQueryParam("engine");
    if (customEngine) {
        currentEngineUrl = customEngine.replace(/\/$/, "");
    } else {
        // Default production domain, with local fallback
        currentEngineUrl = "https://agent.sanskaraai.com";
    }
}

async function checkEngineHealth() {
    const statusPill = document.getElementById("engine-status-pill");
    const statusTxt = document.getElementById("engine-status-txt");
    const offlineBanner = document.getElementById("offline-banner");

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(`${currentEngineUrl}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.status === "ok") {
                isOfflineMode = false;
                statusPill.className = "engine-status-pill";
                statusTxt.textContent = `Engine Online (${new URL(currentEngineUrl).hostname})`;
                offlineBanner.style.display = "none";
                return;
            }
        }
    } catch (e) {
        console.warn("Primary engine health check failed, checking local engine:", e);
    }

    // Try local engine fallback if default engine failed
    if (!getQueryParam("engine") && currentEngineUrl !== "http://localhost:8000") {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch("http://localhost:8000/api/health", { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                currentEngineUrl = "http://localhost:8000";
                isOfflineMode = false;
                statusPill.className = "engine-status-pill";
                statusTxt.textContent = "Engine Online (localhost:8000)";
                offlineBanner.style.display = "none";
                return;
            }
        } catch (e) {
            console.warn("Local engine check also failed:", e);
        }
    }

    // Enter Offline mode if engine is unreachable
    isOfflineMode = true;
    statusPill.className = "engine-status-pill offline";
    statusTxt.textContent = "Engine Offline (Fallback Snapshot)";
    offlineBanner.style.display = "flex";
}

function setupDropzones() {
    setupZone("qp-zone", "qp-input", "qp-name", (file) => { qpFile = file; checkReady(); });
    setupZone("ans-zone", "ans-input", "ans-name", (file) => { ansFile = file; checkReady(); });
}

function setupZone(zoneId, inputId, nameId, onFileSelect) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const nameEl = document.getElementById(nameId);

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0], input, nameEl, onFileSelect);
        }
    });

    input.addEventListener("change", () => {
        if (input.files && input.files[0]) {
            handleFile(input.files[0], input, nameEl, onFileSelect);
        }
    });
}

function handleFile(file, input, nameEl, onFileSelect) {
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];

    if (file.size > MAX_SIZE) {
        showToast("File size exceeds 15MB limit!");
        input.value = "";
        return;
    }

    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        showToast("Please upload a valid image file (PNG, JPG, WEBP)");
        input.value = "";
        return;
    }

    nameEl.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    onFileSelect(file);
}

function checkReady() {
    const btn = document.getElementById("grade-btn");
    if (qpFile && ansFile) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function setupEventListeners() {
    document.getElementById("grade-btn").addEventListener("click", runGradingPipeline);
    document.getElementById("preset-btn").addEventListener("click", loadSyntheticPreset);
}

async function loadSyntheticPreset() {
    try {
        const qpRes = await fetch("/assets/synthetic_question_paper.png");
        const qpBlob = await qpRes.blob();
        qpFile = new File([qpBlob], "synthetic_question_paper.png", { type: "image/png" });
        document.getElementById("qp-name").textContent = "Loaded: synthetic_question_paper.png (Physics Exam)";

        const ansRes = await fetch("/assets/synthetic_answer_script.png");
        const ansBlob = await ansRes.blob();
        ansFile = new File([ansBlob], "synthetic_answer_script.png", { type: "image/png" });
        document.getElementById("ans-name").textContent = "Loaded: synthetic_answer_script.png (Alex Smith)";

        checkReady();
        showToast("Synthetic Physics Exam Paper & Answer Sheet loaded!");
    } catch (e) {
        console.error("Failed to load synthetic preset:", e);
    }
}

async function runGradingPipeline() {
    if (!qpFile || !ansFile) {
        showToast("Please upload both Question Paper and Answer Sheet!");
        return;
    }

    const btn = document.getElementById("grade-btn");
    const btnText = document.getElementById("grade-btn-text");
    const spinner = document.getElementById("grade-spinner");

    btn.disabled = true;
    btnText.textContent = "AI Grading in Progress…";
    spinner.style.display = "inline-block";

    currentSessionId = "session-" + Math.random().toString(36).substring(2, 10);

    if (isOfflineMode) {
        console.warn("Engine offline, executing fallback workflow.");
        await loadFallbackData();
        btnText.textContent = "🚀 Grade Script with AI Engine";
        spinner.style.display = "none";
        btn.disabled = false;
        return;
    }

    try {
        // Step 1: Parse Question Paper
        const parseFormData = new FormData();
        parseFormData.append("session_id", currentSessionId);
        parseFormData.append("mode", "exam");
        parseFormData.append("image", qpFile);

        const parseController = new AbortController();
        const parseTimeout = setTimeout(() => parseController.abort(), 12000);

        const parseRes = await fetch(`${currentEngineUrl}/api/parse`, {
            method: "POST",
            body: parseFormData,
            signal: parseController.signal
        });
        clearTimeout(parseTimeout);

        if (!parseRes.ok) {
            throw new Error(`Parse request failed with status ${parseRes.status}`);
        }

        const parseData = await parseRes.json();
        console.log("Parse API successful:", parseData);

        // Step 2: Grade Answer Script
        const gradeFormData = new FormData();
        gradeFormData.append("session_id", currentSessionId);
        gradeFormData.append("image", ansFile);

        const gradeController = new AbortController();
        const gradeTimeout = setTimeout(() => gradeController.abort(), 15000);

        const gradeRes = await fetch(`${currentEngineUrl}/api/grade`, {
            method: "POST",
            body: gradeFormData,
            signal: gradeController.signal
        });
        clearTimeout(gradeTimeout);

        if (!gradeRes.ok) {
            throw new Error(`Grade request failed with status ${gradeRes.status}`);
        }

        const gradeData = await gradeRes.json();
        console.log("Grade API successful:", gradeData);

        currentGradeData = gradeData;
        renderResults(gradeData);
        showToast("Grading complete!");

    } catch (err) {
        console.error("Engine call error, using static fallback:", err);
        showToast("Engine unreachable. Displaying fallback snapshot.");
        document.getElementById("offline-banner").style.display = "flex";
        isOfflineMode = true;
        await loadFallbackData();
    } finally {
        btnText.textContent = "🚀 Grade Script with AI Engine";
        spinner.style.display = "none";
        btn.disabled = false;
    }
}

async function loadFallbackData() {
    try {
        const res = await fetch("/data/live_demo_fallback.json");
        const fallback = await res.json();
        currentGradeData = fallback.grade;
        renderResults(fallback.grade);
    } catch (e) {
        console.error("Failed to load fallback JSON:", e);
        showToast("Error loading fallback data.");
    }
}

function renderResults(data) {
    const gradeObj = data.grade || {};
    const questions = gradeObj.questions || [];
    const totalSuggested = gradeObj.total_suggested ?? 0;
    const totalMax = gradeObj.total_max ?? 10;

    // Render annotated base64 PNG image
    const imgEl = document.getElementById("annotated-img");
    if (data.image) {
        if (data.image.startsWith("data:image")) {
            imgEl.src = data.image;
        } else {
            imgEl.src = `data:image/png;base64,${data.image}`;
        }
    } else {
        imgEl.src = "/assets/synthetic_answer_script.png";
    }

    // Render Score
    document.getElementById("score-display").textContent = `${totalSuggested.toFixed(1)} / ${totalMax.toFixed(1)}`;
    document.getElementById("confidence-display").textContent = `Session: ${data.session_id || currentSessionId} · AI Deterministic Mark`;

    // Render Questions
    const listEl = document.getElementById("questions-list");
    listEl.innerHTML = "";

    questions.forEach((q, idx) => {
        const qCard = document.createElement("div");
        qCard.className = "q-item-card";

        const rubricHtml = (q.rubric || []).map(r => `
            <div class="rubric-item ${r.matched ? 'matched' : ''}">
                <div class="rubric-dot"></div>
                <div><strong>${r.matched ? '✓' : '✗'} [${r.marks}m]</strong> ${escapeHtml(r.text)}</div>
            </div>
        `).join("");

        qCard.innerHTML = `
            <div class="q-item-header">
                <div class="q-label">${q.label}: Max ${q.max_marks} Marks</div>
                <div class="q-score-pill" id="pill-${idx}">${q.final_marks ?? q.suggested_marks} / ${q.max_marks}</div>
            </div>
            <div class="rubric-list">${rubricHtml}</div>
            <div class="q-reason"><strong>AI Reason:</strong> ${escapeHtml(q.ai_reason || "Verified against marking scheme.")}</div>
            <div class="override-box">
                <span style="font-size: 0.78rem; color: var(--text-muted);">Teacher Mark:</span>
                <input class="override-input" type="number" min="0" max="${q.max_marks}" step="0.5" 
                       value="${q.final_marks ?? q.suggested_marks}" 
                       onchange="updateTeacherMark(${idx}, this.value)">
                <span style="font-size: 0.75rem; color: var(--accent-green);" id="saved-tag-${idx}"></span>
            </div>
        `;

        listEl.appendChild(qCard);
    });

    // Render Markdown Card
    const cardEl = document.getElementById("card-markdown");
    cardEl.textContent = data.card || "No summary card available.";
}

async function updateTeacherMark(index, val) {
    if (!currentGradeData || !currentGradeData.grade) return;
    const questions = currentGradeData.grade.questions;
    if (!questions[index]) return;

    const newMarks = parseFloat(val);
    if (isNaN(newMarks)) return;

    questions[index].final_marks = newMarks;
    document.getElementById(`pill-${index}`).textContent = `${newMarks} / ${questions[index].max_marks}`;
    document.getElementById(`saved-tag-${index}`).textContent = "Saved";

    // Recalculate total
    const newTotal = questions.reduce((sum, q) => sum + (q.final_marks ?? q.suggested_marks), 0);
    const maxTotal = currentGradeData.grade.total_max ?? 10;
    document.getElementById("score-display").textContent = `${newTotal.toFixed(1)} / ${maxTotal.toFixed(1)}`;

    // Try posting override to backend if online
    if (!isOfflineMode && currentSessionId) {
        try {
            await fetch(`${currentEngineUrl}/api/override`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    label: questions[index].label,
                    final_marks: newMarks
                })
            });
            showToast(`Override saved for ${questions[index].label}`);
        } catch (e) {
            console.warn("Override sync failed:", e);
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

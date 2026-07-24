let demoState = null;
let initialDemoState = null;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  document.getElementById("signoff-btn").addEventListener("click", signOff);
  document.getElementById("reset-btn").addEventListener("click", resetDemo);
  document.getElementById("roi-form").addEventListener("submit", submitRoi);
  loadDemo();
  submitRoi();
});

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });
}

async function loadDemo() {
  const response = await fetch("/data/demo.json");
  demoState = await response.json();
  initialDemoState = structuredClone(demoState);
  renderAll();
}

function renderAll() {
  renderScript();
  renderQuestions();
  renderReport();
  renderPilot();
}

function renderScript() {
  const { script, questions, signed_off, signed_off_at } = demoState;
  const total = questions.reduce((sum, question) => sum + Number(question.teacher_marks), 0);
  const max = questions.reduce((sum, question) => sum + Number(question.max_marks), 0);
  const reviewSeconds = script.summary.estimated_teacher_time_seconds;
  const manualSeconds = script.summary.manual_time_seconds;

  document.getElementById("script-title").textContent = `${script.subject} - ${script.exam}`;
  document.getElementById("script-id").textContent = `#${script.id}`;
  document.getElementById("script-status").textContent = script.status;
  document.getElementById("score-label").textContent = `${total}/${max}`;
  document.getElementById("confidence-label").textContent = `${Math.round(script.summary.confidence * 100)}%`;
  document.getElementById("time-label").textContent = `${reviewSeconds}s vs ${Math.round(manualSeconds / 60)}m`;
  document.getElementById("teacher-total").textContent = `${total}/${max}`;
  document.getElementById("script-image").src = script.image_url;

  const note = signed_off
    ? `Signed off at ${new Date(signed_off_at).toLocaleString()}.`
    : "Teacher approval is required before marks are finalized.";
  document.getElementById("signoff-note").textContent = note;

  renderAnnotations();
}

function renderAnnotations() {
  const layer = document.getElementById("annotation-layer");
  layer.innerHTML = "";

  demoState.questions.forEach((question) => {
    const annotation = question.annotation;
    const node = document.createElement("div");
    node.className = `annotation ${annotation.type === "warning" ? "warning" : ""}`;
    node.style.left = `${annotation.x}%`;
    node.style.top = `${annotation.y}%`;
    node.style.width = `${annotation.w}%`;
    node.style.height = `${annotation.h}%`;
    node.textContent = annotation.label;
    layer.appendChild(node);
  });
}

function renderQuestions() {
  const list = document.getElementById("question-list");
  list.innerHTML = "";

  demoState.questions.forEach((question) => {
    const card = document.createElement("article");
    card.className = "question-card";

    const rubricRows = question.rubric
      .map(
        (item) => `
          <div class="rubric-row">
            <span class="dot ${item.matched ? "good" : ""}"></span>
            <span>${escapeHtml(item.text)}</span>
            <strong>${item.marks}</strong>
          </div>
        `,
      )
      .join("");

    card.innerHTML = `
      <div class="question-top">
        <div>
          <h3>${question.label}: ${escapeHtml(question.title)}</h3>
          <p class="note">Confidence ${Math.round(question.confidence * 100)}%</p>
        </div>
        <div class="score-pill">${question.teacher_marks}/${question.max_marks}</div>
      </div>
      <div class="rubric">${rubricRows}</div>
      <p class="reason">${escapeHtml(question.ai_reason)}</p>
      <form class="override-form" data-question="${question.id}">
        <input name="marks" type="number" min="0" max="${question.max_marks}" step="0.5" value="${question.teacher_marks}" aria-label="Teacher marks">
        <input name="comment" type="text" value="${escapeHtml(question.teacher_comment || "")}" placeholder="Teacher comment">
        <button class="ghost-btn" type="submit">Save</button>
      </form>
    `;

    card.querySelector("form").addEventListener("submit", submitOverride);
    list.appendChild(card);
  });
}

function renderReport() {
  const report = demoState.report;
  document.getElementById("report-summary").textContent = `${report.score}/${report.max_score} - ${report.grade_band}`;

  document.getElementById("mastery-list").innerHTML = report.concept_mastery
    .map(
      (item) => `
        <div class="bar-row">
          <div class="bar-label"><span>${escapeHtml(item.concept)}</span><span>${item.score}%</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${item.score}%"></div></div>
        </div>
      `,
    )
    .join("");

  document.getElementById("error-list").innerHTML = report.error_patterns
    .map(
      (item) => `
        <div class="list-item">
          <strong>${escapeHtml(item.type)} (${item.count})</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
      `,
    )
    .join("");

  document.getElementById("recommendation-list").innerHTML = report.recommendations
    .map((item) => `<div class="list-item"><strong>${escapeHtml(item)}</strong></div>`)
    .join("");

  document.getElementById("resource-list").innerHTML = report.resources
    .map(
      (item) => `
        <div class="list-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.kind)} - ${escapeHtml(item.detail)}</p>
        </div>
      `,
    )
    .join("");
}

function renderPilot() {
  const pilot = demoState.pilot;
  document.getElementById("pilot-title").textContent = pilot.title;
  document.getElementById("pilot-days").innerHTML = pilot.days
    .map(
      (item) => `
        <div class="timeline-step">
          <span>${escapeHtml(item.day)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="note">${escapeHtml(item.detail)}</p>
        </div>
      `,
    )
    .join("");

  document.getElementById("pilot-criteria").innerHTML = pilot.success_criteria
    .map((item) => `<div class="criterion">${escapeHtml(item)}</div>`)
    .join("");
}

async function submitOverride(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const questionId = form.dataset.question;
  const payload = {
    marks: Number(form.elements.marks.value),
    comment: form.elements.comment.value,
  };

  const question = demoState.questions.find((item) => item.id === questionId);
  if (!question) {
    showToast("Question not found");
    return;
  }
  if (payload.marks > question.max_marks) {
    showToast("Marks exceed maximum for this question");
    return;
  }

  question.teacher_marks = payload.marks;
  question.teacher_comment = payload.comment;
  question.overridden = payload.marks !== question.suggested_marks || Boolean(payload.comment.trim());
  syncScore();
  renderAll();
  showToast("Teacher review saved");
}

async function signOff() {
  demoState.signed_off = true;
  demoState.signed_off_at = new Date().toISOString();
  demoState.script.status = "Teacher signed off";
  renderAll();
  showToast("Script signed off");
}

async function resetDemo() {
  demoState = structuredClone(initialDemoState);
  renderAll();
  showToast("Demo reset");
}

async function submitRoi(event) {
  if (event) event.preventDefault();
  const form = document.getElementById("roi-form");
  const payload = Object.fromEntries(new FormData(form).entries());
  Object.keys(payload).forEach((key) => {
    payload[key] = Number(payload[key]);
  });

  const result = calculateRoi(payload);

  document.getElementById("roi-savings").textContent = currency.format(result.savings);
  document.getElementById("roi-percent").textContent = `${result.savings_percent}%`;
  document.getElementById("roi-scripts").textContent = result.scripts.toLocaleString("en-IN");
  document.getElementById("roi-days").textContent = `${result.time_saved_days} days`;
}

function calculateRoi(payload) {
  const currentCost = payload.scripts * payload.current_cost_per_script;
  const platformCost = payload.scripts * payload.platform_cost_per_script;
  const savings = currentCost - platformCost;
  return {
    scripts: payload.scripts,
    pages: payload.scripts * payload.pages_per_script,
    current_cost: currentCost,
    platform_cost: platformCost,
    savings,
    savings_percent: Number(((savings / currentCost) * 100).toFixed(1)),
    current_days: payload.current_days,
    projected_days: payload.projected_days,
    time_saved_days: Math.max(payload.current_days - payload.projected_days, 0),
  };
}

function syncScore() {
  const total = demoState.questions.reduce((sum, question) => sum + Number(question.teacher_marks), 0);
  const maxScore = demoState.questions.reduce((sum, question) => sum + Number(question.max_marks), 0);
  demoState.script.summary.ai_score = total;
  demoState.script.summary.max_score = maxScore;
  demoState.report.score = total;
  demoState.report.max_score = maxScore;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================
// SUPABASE SETUP - fill in your real project values here.
// Get these from: Supabase dashboard -> Project Settings -> API
// These two values are meant to be public (safe to ship in frontend
// code) - real security comes from Row Level Security policies in the
// database, not from hiding these.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uyhrvjkggjmbycmmpmjq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bT1-ynXT1McYkUGvxDBldw_SgOMcT9p";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Element references
// ============================================================
const modeButtons = document.querySelectorAll(".mode-btn");
const structuredFields = document.getElementById("structured-fields");
const freeformField = document.getElementById("freeform-field");
const form = document.getElementById("story-form");
const generateBtn = document.getElementById("generate-btn");
const errorMsg = document.getElementById("error-msg");
const copyBtn = document.getElementById("copy-btn");

const composeSection = document.getElementById("compose-section");
const threadSection = document.getElementById("thread-section");
const threadList = document.getElementById("thread-list");
const versionLabel = document.getElementById("version-label");
const startOverBtn = document.getElementById("start-over-btn");

const canvasEmpty = document.getElementById("canvas-empty");
const canvasLoading = document.getElementById("canvas-loading");
const canvasIframe = document.getElementById("canvas-iframe");
const loadingText = document.getElementById("loading-text");

const refineInput = document.getElementById("refine-input");
const refineBtn = document.getElementById("refine-btn");
const downloadBtn = document.getElementById("download-btn");
const shareBtn = document.getElementById("share-btn");
const shareResult = document.getElementById("share-result");
const shareLinkInput = document.getElementById("share-link-input");
const shareCopyBtn = document.getElementById("share-copy-btn");

const attachBtn = document.getElementById("attach-btn");
const imageInput = document.getElementById("image-input");
const thumbnailRow = document.getElementById("thumbnail-row");

const historySection = document.getElementById("history-section");
const historyList = document.getElementById("history-list");

const landingView = document.getElementById("landing-view");
const studioView = document.getElementById("studio-view");
const brandHomeBtn = document.getElementById("brand-home-btn");
const heroInput = document.getElementById("hero-input");
const heroBtn = document.getElementById("hero-btn");
const templateGrid = document.getElementById("template-grid");
const projectGrid = document.getElementById("project-grid");
const landingEmpty = document.getElementById("landing-empty");

const authGate = document.getElementById("auth-gate");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authTitle = document.getElementById("auth-title");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authMsg = document.getElementById("auth-msg");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const sharedView = document.getElementById("shared-view");
const sharedIframe = document.getElementById("shared-iframe");

let attachedImages = [];
let currentMode = "structured";
let currentHtml = null;
let thread = [];
let currentHistoryId = null; // a real database row id once saved
let currentUserId = null; // the logged-in user's id, needed for RLS-compliant inserts
let authMode = "login"; // 'login' | 'signup'

const AI_AVATAR_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <defs><linearGradient id="threadBeam" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#3FB6F5" /><stop offset="1" stop-color="#F5449E" />
  </linearGradient></defs>
  <polygon points="2.5,2.5 16.5,6.5 6.5,16.5" fill="url(#threadBeam)" opacity="0.92" />
  <rect x="11.5" y="11.5" width="18" height="18" rx="4.5" stroke="url(#threadBeam)" stroke-width="2.4" fill="none" />
  <rect x="16.5" y="16.5" width="8" height="8" rx="1.5" fill="#FBF7F2" fill-opacity="0.85" />
</svg>`;

const LOADING_MESSAGES = ["Sketching the layout…", "Choosing a palette…", "Placing the primary action…", "Tightening the details…"];
const REFINING_MESSAGES = ["Applying your change…", "Adjusting the design…"];

const TEMPLATES = [
  { name: "Support triage queue", blurb: "Grouped inbox \u2192 ticket detail \u2192 resolution.", color: "#3FB6F5", asA: "support lead", iWant: "see incoming tickets grouped by urgency", soThat: "my team answers the worst issues first" },
  { name: "Onboarding checklist", blurb: "Progressive setup with a first-value moment.", color: "#F5449E", asA: "new admin", iWant: "be walked through setting up my workspace", soThat: "I reach value without reading docs" },
  { name: "Usage \u2192 upgrade nudge", blurb: "Limit warning that sells the next plan.", color: "#8C7BF0", asA: "team owner", iWant: "see when we are near our plan limit", soThat: "we upgrade before anything breaks" },
  { name: "Approval flow", blurb: "Request, review, decision trail.", color: "#4FC3A1", asA: "finance manager", iWant: "approve or reject spend requests in one place", soThat: "nothing sits waiting on me" },
  { name: "Field dispatch board", blurb: "Map-less scheduling for mobile crews.", color: "#E0A73C", asA: "dispatcher", iWant: "assign jobs to the nearest available tech", soThat: "customers get same-day service" },
  { name: "Insight digest", blurb: "Weekly summary a stakeholder actually reads.", color: "#D8637A", asA: "product lead", iWant: "get a weekly summary of feature adoption", soThat: "I can spot drop-off without a dashboard" },
];

const PROJECT_DOT_COLORS = ["#3FB6F5", "#F5449E", "#8C7BF0", "#4FC3A1", "#E0A73C"];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ============================================================
// SHARED LINK VIEWING - works for anyone, logged in or not.
// Checked BEFORE the auth gate, since a share link should never require
// the viewer to have an account.
// ============================================================
async function checkForSharedLink() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("share");
  if (!slug) return false;

  const { data, error } = await supabase
    .from("prototypes")
    .select("html")
    .eq("share_slug", slug)
    .single();

  if (error || !data) {
    document.body.innerHTML = "<p style='color:#E38B7F;text-align:center;padding:60px 20px;font-family:sans-serif;'>This share link doesn't exist or is no longer available.</p>";
    return true;
  }

  sharedIframe.srcdoc = data.html;
  sharedView.style.display = "flex";
  return true;
}

// ============================================================
// AUTH
// ============================================================
function showAuthGate() {
  authGate.style.display = "flex";
  landingView.style.display = "none";
  studioView.style.display = "none";
  userEmailEl.style.display = "none";
  logoutBtn.style.display = "none";
  currentUserId = null;
}

function showApp(user) {
  authGate.style.display = "none";
  userEmailEl.textContent = user.email;
  userEmailEl.style.display = "";
  logoutBtn.style.display = "";
  currentUserId = user.id;
  showLanding();
}

authToggleBtn.addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  authTitle.textContent = authMode === "login" ? "Log in" : "Sign up";
  authSubmitBtn.textContent = authMode === "login" ? "Log in" : "Sign up";
  authToggleText.textContent = authMode === "login" ? "Don't have an account?" : "Already have an account?";
  authToggleBtn.textContent = authMode === "login" ? "Sign up" : "Log in";
  authMsg.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "";
  authMsg.classList.remove("success");
  authSubmitBtn.disabled = true;

  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      authMsg.textContent = "Check your email to confirm your account, then log in.";
      authMsg.classList.add("success");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange listener below handles showing the app
    }
  } catch (err) {
    authMsg.textContent = err.message;
  } finally {
    authSubmitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    showApp(session.user);
  } else {
    showAuthGate();
  }
});

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

// ============================================================
// Mode toggle
// ============================================================
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    currentMode = btn.dataset.mode;
    if (currentMode === "structured") {
      structuredFields.style.display = "";
      freeformField.style.display = "none";
    } else {
      structuredFields.style.display = "none";
      freeformField.style.display = "";
    }
    errorMsg.textContent = "";
  });
});

function cycleMessages(messages) {
  let i = 0;
  loadingText.textContent = messages[0];
  return setInterval(() => { i = (i + 1) % messages.length; loadingText.textContent = messages[i]; }, 1800);
}

// ============================================================
// Image attachments
// ============================================================
const MAX_IMAGES = 3;
attachBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async () => {
  const files = Array.from(imageInput.files || []).slice(0, MAX_IMAGES - attachedImages.length);
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      attachedImages.push(await fileToDataUrl(file));
    } catch {}
  }
  imageInput.value = "";
  renderThumbnails();
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderThumbnails() {
  thumbnailRow.innerHTML = "";
  attachedImages.forEach((dataUrl, idx) => {
    const div = document.createElement("div");
    div.className = "thumbnail";
    div.innerHTML = `<img src="${dataUrl}" alt="Reference image ${idx + 1}"><button type="button" class="thumbnail-remove" aria-label="Remove image">&times;</button>`;
    div.querySelector(".thumbnail-remove").addEventListener("click", () => { attachedImages.splice(idx, 1); renderThumbnails(); });
    thumbnailRow.appendChild(div);
  });
  attachBtn.style.opacity = attachedImages.length >= MAX_IMAGES ? "0.4" : "1";
  attachBtn.disabled = attachedImages.length >= MAX_IMAGES;
}

// ============================================================
// Copy prompt
// ============================================================
function getCurrentPromptText() {
  if (currentMode === "structured") {
    const asA = document.getElementById("asA").value.trim() || "user";
    const iWant = document.getElementById("iWant").value.trim();
    const soThat = document.getElementById("soThat").value.trim();
    return `As a ${asA}, I want ${iWant}, so that ${soThat}.`;
  }
  return freeformField.value.trim();
}

copyBtn.addEventListener("click", async () => {
  const text = getCurrentPromptText();
  if (!text) return;
  const label = document.getElementById("copy-btn-label");
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add("copied");
    if (label) label.textContent = "Copied";
    setTimeout(() => { copyBtn.classList.remove("copied"); if (label) label.textContent = "Copy"; }, 1500);
  } catch {
    errorMsg.textContent = "Couldn't copy - your browser may be blocking clipboard access.";
  }
});

// ============================================================
// Download
// ============================================================
downloadBtn.addEventListener("click", () => {
  if (!currentHtml) return;
  const blob = new Blob([currentHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prototype.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ============================================================
// Share (via database share_slug, RLS allows public read of shared rows)
// ============================================================
function makeSlug() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

shareBtn.addEventListener("click", async () => {
  if (!currentHtml || !currentHistoryId) {
    errorMsg.textContent = "Generate a prototype first before sharing it.";
    return;
  }
  errorMsg.textContent = "";
  shareBtn.disabled = true;
  const originalLabel = shareBtn.textContent;
  shareBtn.textContent = "Publishing\u2026";

  try {
    const slug = makeSlug();
    const { error } = await supabase.from("prototypes").update({ share_slug: slug }).eq("id", currentHistoryId);
    if (error) throw error;

    const url = `${window.location.origin}${window.location.pathname}?share=${slug}`;
    shareLinkInput.value = url;
    shareResult.style.display = "";
  } catch (err) {
    errorMsg.textContent = "Couldn't create a share link: " + err.message;
  } finally {
    shareBtn.disabled = false;
    shareBtn.textContent = originalLabel;
  }
});

shareCopyBtn.addEventListener("click", async () => {
  if (!shareLinkInput.value) return;
  const label = document.getElementById("share-copy-btn-label");
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    shareCopyBtn.classList.add("copied");
    if (label) label.textContent = "Copied";
    setTimeout(() => { shareCopyBtn.classList.remove("copied"); if (label) label.textContent = "Copy"; }, 1500);
  } catch {
    shareLinkInput.select();
  }
});

// ============================================================
// History / Recent projects - now backed by the real database, scoped
// to the logged-in user automatically via Row Level Security.
// ============================================================
async function loadHistoryFromDb() {
  const { data, error } = await supabase
    .from("prototypes")
    .select("id, label, html, thread, created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    console.error("Failed to load history:", error.message);
    return [];
  }
  return data || [];
}

async function saveOrUpdatePrototype({ label, html, thread }) {
  if (currentHistoryId) {
    const { error } = await supabase.from("prototypes").update({ label, html, thread, updated_at: new Date().toISOString() }).eq("id", currentHistoryId);
    if (error) throw error;
    return currentHistoryId;
  }
  if (!currentUserId) throw new Error("Not logged in - can't save this prototype.");
const { data, error } = await supabase.from("prototypes").insert({ label, html, thread, user_id: currentUserId }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function renderHistory() {
  const history = await loadHistoryFromDb();
  if (!history.length) {
    historySection.style.display = "none";
    return;
  }
  historyList.innerHTML = "";
  history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = entry.label;
    li.title = entry.label;
    li.addEventListener("click", () => loadFromHistory(entry));
    historyList.appendChild(li);
  });
  historySection.style.display = "";
}

function loadFromHistory(entry) {
  currentHtml = entry.html;
  thread = entry.thread || [];
  currentHistoryId = entry.id;
  attachedImages = [];
  renderThumbnails();
  showThreadView();
  renderThread();
  updateVersionLabel();
  renderCanvas(currentHtml);
  shareResult.style.display = "none";
  errorMsg.textContent = "";
}

// ============================================================
// Thread rendering
// ============================================================
function renderThread() {
  threadList.innerHTML = "";
  thread.forEach((m) => {
    const row = document.createElement("div");
    row.className = "thread-message " + m.role;
    if (m.role === "ai") {
      const rationaleHtml = m.rationale && m.rationale.length
        ? `<ul class="thread-rationale">${m.rationale.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
        : "";
      row.innerHTML = `<div class="thread-avatar">${AI_AVATAR_SVG}</div><div class="thread-bubble"><div>${escapeHtml(m.text)}</div>${rationaleHtml}</div>`;
    } else {
      row.innerHTML = `<div class="thread-bubble">${escapeHtml(m.text)}</div>`;
    }
    threadList.appendChild(row);
  });
  threadList.scrollTop = threadList.scrollHeight;
}

function updateVersionLabel() {
  const turns = thread.filter((m) => m.role === "user").length;
  if (turns <= 1) {
    versionLabel.textContent = "v1";
  } else {
    const refinements = turns - 1;
    versionLabel.textContent = `v${turns} \u00b7 ${refinements} refinement${refinements > 1 ? "s" : ""}`;
  }
}

function showThreadView() { composeSection.style.display = "none"; threadSection.style.display = "flex"; }
function showComposeView() { threadSection.style.display = "none"; composeSection.style.display = "flex"; }

function renderCanvas(html) {
  canvasEmpty.style.display = "none";
  canvasLoading.style.display = "none";
  canvasIframe.srcdoc = html;
  canvasIframe.style.display = "";
  canvasIframe.classList.remove("revealed");
  void canvasIframe.offsetWidth;
  canvasIframe.classList.add("revealed");
}

// ============================================================
// Top-level navigation: landing vs tool
// ============================================================
function showLanding() {
  studioView.style.display = "none";
  landingView.style.display = "block";
  renderProjects();
}

function showTool() {
  landingView.style.display = "none";
  studioView.style.display = "flex";
}

function startWithStructured(asA, iWant, soThat) {
  showTool();
  showComposeView();
  modeButtons.forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-mode="structured"]').classList.add("active");
  document.querySelector('[data-mode="structured"]').setAttribute("aria-selected", "true");
  document.querySelector('[data-mode="freeform"]').setAttribute("aria-selected", "false");
  currentMode = "structured";
  structuredFields.style.display = "";
  freeformField.style.display = "none";
  document.getElementById("asA").value = asA;
  document.getElementById("iWant").value = iWant;
  document.getElementById("soThat").value = soThat;
}

function startWithFreeform(text) {
  showTool();
  showComposeView();
  modeButtons.forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-mode="freeform"]').classList.add("active");
  document.querySelector('[data-mode="freeform"]').setAttribute("aria-selected", "true");
  document.querySelector('[data-mode="structured"]').setAttribute("aria-selected", "false");
  currentMode = "freeform";
  structuredFields.style.display = "none";
  freeformField.style.display = "";
  freeformField.value = text;
}

brandHomeBtn.addEventListener("click", showLanding);

heroBtn.addEventListener("click", () => {
  const text = heroInput.value.trim();
  if (text) startWithFreeform(text);
  else { showTool(); showComposeView(); }
});

function renderTemplates() {
  templateGrid.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "template-card";
    btn.innerHTML = `
      <div class="template-card-swatch">
        <span style="height:44%;background:${t.color};"></span>
        <span style="height:70%;background:rgba(255,255,255,0.14);"></span>
        <span style="height:30%;background:rgba(255,255,255,0.09);"></span>
      </div>
      <div class="template-card-body">
        <div class="template-card-name">${escapeHtml(t.name)}</div>
        <div class="template-card-blurb">${escapeHtml(t.blurb)}</div>
      </div>`;
    btn.addEventListener("click", () => startWithStructured(t.asA, t.iWant, t.soThat));
    templateGrid.appendChild(btn);
  });
}

function timeAgo(createdAt) {
  if (!createdAt) return "";
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

async function renderProjects() {
  const history = await loadHistoryFromDb();
  projectGrid.innerHTML = "";
  if (!history.length) {
    projectGrid.style.display = "none";
    landingEmpty.style.display = "";
    return;
  }
  projectGrid.style.display = "";
  landingEmpty.style.display = "none";

  history.forEach((entry, idx) => {
    const turns = (entry.thread || []).filter((m) => m.role === "user").length;
    const versionText = turns <= 1 ? "1 version" : turns + " versions";
    const dotColor = PROJECT_DOT_COLORS[idx % PROJECT_DOT_COLORS.length];

    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <div class="project-card-head">
        <span class="project-dot" style="background:${dotColor};"></span>
        <span class="project-title">${escapeHtml(entry.label)}</span>
        <span class="project-time">${timeAgo(entry.created_at)}</span>
      </div>
      <div class="project-meta"><span>${versionText}</span></div>
      <div class="project-actions">
        <button type="button" class="project-btn open-btn">Open</button>
        <button type="button" class="project-btn share-view">Share view</button>
      </div>`;

    card.querySelector(".open-btn").addEventListener("click", () => { showTool(); loadFromHistory(entry); });
    card.querySelector(".share-view").addEventListener("click", () => { showTool(); loadFromHistory(entry); shareBtn.click(); });
    projectGrid.appendChild(card);
  });
}

// ============================================================
// Start over
// ============================================================
startOverBtn.addEventListener("click", () => {
  currentHtml = null;
  thread = [];
  currentHistoryId = null;
  attachedImages = [];
  renderThumbnails();
  canvasIframe.style.display = "none";
  canvasEmpty.style.display = "";
  shareResult.style.display = "none";
  errorMsg.textContent = "";
  document.getElementById("iWant").value = "";
  document.getElementById("soThat").value = "";
  freeformField.value = "";
  heroInput.value = "";
  showLanding();
});

// ============================================================
// Generate (now sends the user's access token so the server can verify
// they're really logged in before calling Groq)
// ============================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";

  let payload, promptText;
  if (currentMode === "structured") {
    const asA = document.getElementById("asA").value.trim();
    const iWant = document.getElementById("iWant").value.trim();
    const soThat = document.getElementById("soThat").value.trim();
    if (!iWant || !soThat) { errorMsg.textContent = "Fill in at least the \u201cI want\u201d and \u201cso that\u201d parts."; return; }
    payload = { mode: "structured", asA, iWant, soThat };
    promptText = `As a ${asA || "user"}, I want ${iWant}, so that ${soThat}.`;
  } else {
    const text = freeformField.value.trim();
    if (text.length < 15) { errorMsg.textContent = "Give it a bit more detail (at least a sentence)."; return; }
    payload = { mode: "freeform", freeformText: text };
    promptText = text;
  }
  if (attachedImages.length) payload.images = attachedImages;

  generateBtn.disabled = true;
  generateBtn.classList.add("loading");
  canvasEmpty.style.display = "none";
  canvasIframe.style.display = "none";
  canvasIframe.classList.remove("revealed");
  canvasLoading.style.display = "";
  shareResult.style.display = "none";
  const loadingInterval = cycleMessages(LOADING_MESSAGES);

  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session has expired. Please log in again.");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong generating this.");

    currentHtml = data.html;
    currentHistoryId = null; // this is a NEW session - saveOrUpdatePrototype will insert a fresh row
    thread = [
      { role: "user", text: promptText },
      { role: "ai", text: "Here's a first draft.", rationale: data.rationale || [] },
    ];

    showThreadView();
    renderThread();
    updateVersionLabel();
    renderCanvas(currentHtml);

    const historyLabel = promptText.length > 60 ? promptText.slice(0, 60) + "\u2026" : promptText;
    currentHistoryId = await saveOrUpdatePrototype({ label: historyLabel, html: currentHtml, thread });
    await renderHistory();

    attachedImages = [];
    renderThumbnails();
  } catch (err) {
    canvasLoading.style.display = "none";
    canvasEmpty.style.display = "";
    errorMsg.textContent = err.message;
  } finally {
    clearInterval(loadingInterval);
    generateBtn.disabled = false;
    generateBtn.classList.remove("loading");
  }
});

// ============================================================
// Refine
// ============================================================
async function submitRefinement() {
  const instruction = refineInput.value.trim();
  if (!instruction) { errorMsg.textContent = "Describe the change you'd like to make."; return; }
  if (!currentHtml) { errorMsg.textContent = "Generate a prototype first before refining it."; return; }

  errorMsg.textContent = "";
  shareResult.style.display = "none";
  refineBtn.disabled = true;
  canvasLoading.style.display = "";
  canvasIframe.style.display = "none";
  const loadingInterval = cycleMessages(REFINING_MESSAGES);

  thread.push({ role: "user", text: instruction });
  renderThread();

  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session has expired. Please log in again.");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "refine", previousHtml: currentHtml, instruction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't apply that change.");

    currentHtml = data.html;
    thread.push({ role: "ai", text: "Updated the design.", rationale: data.rationale || [] });
    renderThread();
    updateVersionLabel();
    renderCanvas(currentHtml);
    refineInput.value = "";

    const label = thread.find((m) => m.role === "user").text.slice(0, 60);
    currentHistoryId = await saveOrUpdatePrototype({ label, html: currentHtml, thread });
  } catch (err) {
    thread.pop();
    renderThread();
    canvasLoading.style.display = "none";
    canvasIframe.style.display = "";
    errorMsg.textContent = err.message;
  } finally {
    clearInterval(loadingInterval);
    refineBtn.disabled = false;
  }
}

refineBtn.addEventListener("click", submitRefinement);
refineInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitRefinement(); } });

// ============================================================
// Init
// ============================================================
(async function init() {
  const handledAsShare = await checkForSharedLink();
  if (handledAsShare) return;

  renderTemplates();

  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    showApp(data.session.user);
  } else {
    showAuthGate();
  }
})();

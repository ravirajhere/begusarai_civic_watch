/* ============================================
   Begusarai Civic Watch — Logic
   Phase 1: Report + Map + Upvote + Filter + localStorage
   ============================================ */

// ============================================
// BEGUSARAI CENTER COORDINATES
// ============================================
const BEGUSARAI_CENTER = [25.4182, 86.1272];
const DEFAULT_ZOOM = 13;

// ============================================
// ISSUE TYPE CONFIG
// ============================================
const ISSUE_TYPES = {
  pothole: { label: "🕳️ Pothole", color: "#ef4444" },
  garbage: { label: "🗑️ Garbage", color: "#f59e0b" },
  water: { label: "💧 Water", color: "#3b82f6" },
  streetlight: { label: "💡 Streetlight", color: "#eab308" },
  other: { label: "🚧 Other", color: "#94a3b8" }
};

// ============================================
// STATE
// ============================================
let issues = [];
let currentFilter = "all";
let map = null;
let markersLayer = null;
let pendingPhotoData = null;
let pendingLocation = null; // { lat, lng }

// ============================================
// DOM ELEMENTS
// ============================================
const reportForm = document.getElementById("reportForm");
const issueType = document.getElementById("issueType");
const description = document.getElementById("description");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const previewImg = document.getElementById("previewImg");
const locationText = document.getElementById("locationText");
const locationHint = document.getElementById("locationHint");
const getLocationBtn = document.getElementById("getLocationBtn");
const submitBtn = document.getElementById("submitBtn");

const totalReportsEl = document.getElementById("totalReports");
const resolvedCountEl = document.getElementById("resolvedCount");
const pendingCountEl = document.getElementById("pendingCount");

const issuesList = document.getElementById("issuesList");
const filterBar = document.getElementById("filterBar");

// ============================================
// LOCALSTORAGE
// ============================================
function loadIssues() {
  try {
    const saved = localStorage.getItem("begusaraiCivicIssues");
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load issues:", e);
    return [];
  }
}

function saveIssues() {
  try {
    localStorage.setItem("begusaraiCivicIssues", JSON.stringify(issues));
  } catch (e) {
    console.error("Failed to save issues. Storage might be full:", e);
    alert("Storage full ho gaya. Kuch purane reports delete karo.");
  }
}

// ============================================
// STATS
// ============================================
function updateStats() {
  const total = issues.length;
  const resolved = issues.filter(i => i.resolved).length;
  const pending = total - resolved;

  totalReportsEl.textContent = total;
  resolvedCountEl.textContent = resolved;
  pendingCountEl.textContent = pending;
}

// ============================================
// MAP INIT
// ============================================
function initMap() {
  map = L.map("map").setView(BEGUSARAI_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function renderMarkers() {
  markersLayer.clearLayers();

  const filtered = currentFilter === "all"
    ? issues
    : issues.filter(i => i.type === currentFilter);

  filtered.forEach(issue => {
    if (issue.lat && issue.lng) {
      const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;

      const marker = L.circleMarker([issue.lat, issue.lng], {
        radius: 8,
        fillColor: config.color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(markersLayer);

      marker.bindPopup(`
        <strong>${config.label}</strong><br>
        ${escapeHtml(issue.description).substring(0, 80)}${issue.description.length > 80 ? "..." : ""}<br>
        <small>📍 ${escapeHtml(issue.location)}</small>
      `);
    }
  });
}

// ============================================
// RENDER ISSUES LIST
// ============================================
function renderIssues() {
  const filtered = currentFilter === "all"
    ? issues
    : issues.filter(i => i.type === currentFilter);

  if (filtered.length === 0) {
    issuesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>${currentFilter === "all" ? "No reports yet. Be the first to report!" : "No reports in this category."}</p>
      </div>
    `;
    return;
  }

  // Newest first
  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  issuesList.innerHTML = "";
  sorted.forEach(issue => {
    const card = createIssueCard(issue);
    issuesList.appendChild(card);
  });
}

function createIssueCard(issue) {
  const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;
  const card = document.createElement("div");
  card.className = "issue-card";

  const timeAgo = getTimeAgo(issue.timestamp);
  const upvoteCount = issue.upvotes || 0;
  const isUpvoted = issue.userUpvoted || false;

  card.innerHTML = `
    <img class="issue-photo" src="${issue.photo}" alt="Issue photo" onerror="this.style.display='none'">
    <div class="issue-content">
      <div class="issue-header">
        <span class="issue-type ${issue.type}">${config.label}</span>
        <span class="issue-time">${timeAgo}</span>
      </div>
      <p class="issue-description">${escapeHtml(issue.description)}</p>
      <p class="issue-location">📍 ${escapeHtml(issue.location)}</p>
      <div class="issue-actions">
        <button class="upvote-btn ${isUpvoted ? "upvoted" : ""}" data-id="${issue.id}">
          👍 <span>${upvoteCount}</span>
        </button>
        <button class="delete-btn" data-id="${issue.id}" aria-label="Delete report">🗑️</button>
      </div>
    </div>
  `;

  // Upvote handler
  card.querySelector(".upvote-btn").addEventListener("click", () => {
    toggleUpvote(issue.id);
  });

  // Delete handler
  card.querySelector(".delete-btn").addEventListener("click", () => {
    if (confirm("Ye report delete karni hai?")) {
      deleteIssue(issue.id);
    }
  });

  return card;
}

// ============================================
// UPVOTE
// ============================================
function toggleUpvote(id) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;

  if (issue.userUpvoted) {
    issue.upvotes = (issue.upvotes || 1) - 1;
    issue.userUpvoted = false;
  } else {
    issue.upvotes = (issue.upvotes || 0) + 1;
    issue.userUpvoted = true;
  }

  saveIssues();
  renderIssues();
}

// ============================================
// DELETE
// ============================================
function deleteIssue(id) {
  issues = issues.filter(i => i.id !== id);
  saveIssues();
  renderIssues();
  renderMarkers();
  updateStats();
}

// ============================================
// TIME AGO
// ============================================
function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN");
}

// ============================================
// ESCAPE HTML (safety)
// ============================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// PHOTO UPLOAD
// ============================================
photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Check size (max 2 MB)
  if (file.size > 2 * 1024 * 1024) {
    alert("Photo bahut badi hai. 2 MB se kam size ki photo choose karo.");
    photoInput.value = "";
    photoPreview.style.display = "none";
    pendingPhotoData = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    // Compress: use image resize if needed
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 600;
      const scale = Math.min(1, MAX_WIDTH / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressed = canvas.toDataURL("image/jpeg", 0.7);
      pendingPhotoData = compressed;
      previewImg.src = compressed;
      photoPreview.style.display = "block";
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// ============================================
// LOCATION AUTO-DETECT
// ============================================
getLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationHint.textContent = "Browser location support nahi karta.";
    locationHint.style.color = "#ef4444";
    return;
  }

  getLocationBtn.disabled = true;
  locationHint.textContent = "Location detect ho rahi hai...";
  locationHint.className = "location-hint";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      pendingLocation = { lat, lng };

      locationText.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      locationHint.textContent = `✅ Location captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      locationHint.className = "location-hint success";
      getLocationBtn.disabled = false;
    },
    (error) => {
      locationHint.textContent = "Location nahi mili. Manually type karo.";
      locationHint.style.color = "#ef4444";
      getLocationBtn.disabled = false;
      console.error(error);
    }
  );
});

// ============================================
// SUBMIT REPORT
// ============================================
reportForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Validation
  if (!issueType.value) {
    alert("Issue type select karo.");
    return;
  }
  if (!description.value.trim() || description.value.trim().length < 10) {
    alert("Description kam se kam 10 characters ka hona chahiye.");
    return;
  }
  if (!pendingPhotoData) {
    alert("Photo upload karo.");
    return;
  }
  if (!locationText.value.trim()) {
    alert("Location daalo ya 📍 click karo.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  // Create issue object
  const issue = {
    id: Date.now().toString(),
    type: issueType.value,
    description: description.value.trim(),
    photo: pendingPhotoData,
    location: locationText.value.trim(),
    lat: pendingLocation ? pendingLocation.lat : null,
    lng: pendingLocation ? pendingLocation.lng : null,
    timestamp: Date.now(),
    upvotes: 0,
    userUpvoted: false,
    resolved: false
  };

  issues.push(issue);
  saveIssues();

  // Reset form
  reportForm.reset();
  photoPreview.style.display = "none";
  pendingPhotoData = null;
  pendingLocation = null;
  locationHint.textContent = "Click 📍 to auto-detect your location";
  locationHint.className = "location-hint";
  locationHint.style.color = "";

  // Re-render
  renderIssues();
  renderMarkers();
  updateStats();

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit Report";

  // Success message
  alert("✅ Report submit ho gayi! Thank you for making Begusarai better.");

  // Scroll to issues list
  document.querySelector(".issues-section").scrollIntoView({ behavior: "smooth" });
});

// ============================================
// FILTER
// ============================================
filterBar.addEventListener("click", (e) => {
  if (!e.target.classList.contains("filter-btn")) return;

  currentFilter = e.target.dataset.filter;

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn === e.target);
  });

  renderIssues();
  renderMarkers();
});

// ============================================
// INIT
// ============================================
window.addEventListener("load", () => {
  issues = loadIssues();
  initMap();
  renderIssues();
  renderMarkers();
  updateStats();
  console.log(`✅ Begusarai Civic Watch loaded · ${issues.length} reports`);
});

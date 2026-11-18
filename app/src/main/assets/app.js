// Bilim ve Teknoloji Bülteni - Mobil İstemci (app.js)

const DEFAULT_KEY = "AQ.Ab8RN6JwbNP-Bs5JpV_7M-g7aXgE3i9IDr8w7ai7sL5yrMJEVw";
const STORAGE_KEY = "bulten_gemini_api_key";
const STORAGE_MODEL = "bulten_gemini_model";
const STORAGE_LAST_REPORT = "bulten_last_report_md";
const STORAGE_LAST_DATE = "bulten_last_date";

// DOM Elements
const generateBtn = document.getElementById("generateBtn");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const emptyState = document.getElementById("emptyState");
const markdownBody = document.getElementById("markdownBody");
const quickActions = document.getElementById("quickActions");
const shareBtn = document.getElementById("shareBtn");
const copyBtn = document.getElementById("copyBtn");
const dateBadge = document.getElementById("dateBadge");

// Settings Modal
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const apiKeyInput = document.getElementById("apiKeyInput");
const modelSelect = document.getElementById("modelSelect");

// Initialize State
let currentApiKey = localStorage.getItem(STORAGE_KEY) || DEFAULT_KEY;
let currentModel = localStorage.getItem(STORAGE_MODEL) || "gemini-flash-latest";
let currentRawMarkdown = "";

apiKeyInput.value = currentApiKey;
modelSelect.value = currentModel;

// Load Cached Report if available
window.addEventListener("DOMContentLoaded", () => {
  const cachedReport = localStorage.getItem(STORAGE_LAST_REPORT);
  const cachedDate = localStorage.getItem(STORAGE_LAST_DATE);
  if (cachedReport) {
    displayReport(cachedReport, cachedDate || "Son Kaydedilen");
  }
});

// Settings Handlers
settingsBtn.addEventListener("click", () => {
  apiKeyInput.value = currentApiKey;
  modelSelect.value = currentModel;
  settingsModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

saveSettingsBtn.addEventListener("click", () => {
  const val = apiKeyInput.value.trim();
  if (val) {
    currentApiKey = val;
    localStorage.setItem(STORAGE_KEY, val);
  }
  currentModel = modelSelect.value;
  localStorage.setItem(STORAGE_MODEL, currentModel);
  settingsModal.classList.add("hidden");
  alert("Ayarlar kaydedildi!");
});

// RSS Feeds
const FEEDS = [
  {
    name: "Google News (Bilim & Teknoloji)",
    url: "https://news.google.com/rss/search?q=bilim+OR+teknoloji+OR+%22yapay+zeka%22+OR+uzay&hl=tr&gl=TR&ceid=TR:tr"
  },
  {
    name: "NASA",
    url: "https://www.nasa.gov/feed/"
  },
  {
    name: "Universe Today",
    url: "https://www.universetoday.com/feed/"
  },
  {
    name: "Evrim Ağacı (Uzay & Bilim)",
    url: "https://evrimagaci.org/rss.xml"
  }
];

// Helper: Fetch RSS feed with proxy fallback
async function fetchFeed(feed) {
  const endpoints = [
    feed.url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers: { "Accept": "application/xml, text/xml" } });
      if (!resp.ok) continue;
      const text = await resp.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const items = Array.from(xml.querySelectorAll("item")).slice(0, 6);

      return items.map(item => {
        const title = item.querySelector("title")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        const pubDate = item.querySelector("pubDate")?.textContent || "";
        const desc = (item.querySelector("description")?.textContent || "")
          .replace(/<[^>]+>/g, " ")
          .substring(0, 200);
        return `[${feed.name}] ${title} (${pubDate}) - Link: ${link} | Özet: ${desc}`;
      }).join("\n");
    } catch (e) {
      // try next
    }
  }
  return "";
}

// Generate Bulletin
generateBtn.addEventListener("click", async () => {
  setLoading(true, "Canlı bilim & teknoloji akışları taranıyor...");

  try {
    // 1. Canlı beslemeleri tara
    const feedResults = await Promise.all(FEEDS.map(f => fetchFeed(f)));
    const liveContent = feedResults.filter(Boolean).join("\n\n");

    setLoading(true, "Yapay zeka ile analiz edilip bülten derleniyor...");

    const todayStr = new Date().toISOString().split("T")[0];
    const prompt = `Sen uzman bir Bilim, Teknoloji ve Uzay editörüsün.
Aşağıda canlı akışlardan çekilen en güncel gelişmeler ve genel bilim/teknoloji gündemi yer almaktadır.
Bugün (${todayStr}) için kapsamlı, akıcı, son derece okunaklı bir Türkçe **Bilim & Teknoloji Bülteni** hazırla.

### Canlı Gelişmeler & Bağlam:
${liveContent || "Canlı beslemeler hazır, en güncel bilim ve teknoloji gelişmelerini derle."}

### Rapor Formatı:
# ⚡ Bilim & Teknoloji Bülteni (${todayStr})

## 🔭 GÖK OLAYLARI & BİLİM TAKVİMİ
(Bu hafta gökyüzünde gözlemlenebilecek önemli gök olayları, gezegen konumları, meteor yağmurları veya önemli bilimsel etkinlikler)

## ⭐ ÖNE ÇIKAN GELİŞMELER
(Haberleri önemine göre 1-10 arasında puanla. Örn: ### ⭐ [9/10] Yapay Zeka / Uzay / Bilim Başlığı)
- Her haber için: Akıcı özet, bilimsel/teknolojik önemi, ilgili kaynak adı ve mutlaka [Haber Kaynağı](URL) tıklanabilir linki.

## 🔬 DİĞER BİLİM & İNOVASYON GELİŞMELERİ
(Fizik, biyoloji, yazılım, robotik ve teknoloji haberleri)

Kurallar:
- Haberlerin başına önem derecesine göre puan koy ([Puan/10]), dikkat çekenlere ⭐ ekle.
- Tüm haberlerde kaynak linklerini [Metin](URL) formatında tıklanabilir yap.`;

    // 2. Gemini API çağrısı
    let reportText = await callGemini(currentModel, prompt);

    // 3. Ekrana bas ve kaydet
    displayReport(reportText, todayStr);
    localStorage.setItem(STORAGE_LAST_REPORT, reportText);
    localStorage.setItem(STORAGE_LAST_DATE, todayStr);

  } catch (err) {
    alert("Hata oluştu: " + err.message);
  } finally {
    setLoading(false);
  }
});

// Gemini API Call via REST
async function callGemini(modelName, promptText) {
  const modelsToTry = [modelName, "gemini-flash-latest", "gemini-3.8-flash"];
  let lastError = null;

  for (const m of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${currentApiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.3 }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      lastError = e;
      if (e.message.includes("404") || e.message.includes("429")) {
        continue; // try next model
      }
      throw e;
    }
  }

  throw lastError || new Error("Gemini yanıt veremedi.");
}

function displayReport(markdownText, dateLabel) {
  currentRawMarkdown = markdownText;
  emptyState.classList.add("hidden");
  quickActions.classList.remove("hidden");
  dateBadge.textContent = `🗓️ Yayın Tarihi: ${dateLabel}`;

  if (window.marked) {
    markdownBody.innerHTML = marked.parse(markdownText);
  } else {
    markdownBody.innerText = markdownText;
  }

  // Smooth scroll
  markdownBody.scrollIntoView({ behavior: "smooth" });
}

function setLoading(isLoading, text = "") {
  if (isLoading) {
    loader.classList.remove("hidden");
    loaderText.textContent = text;
    generateBtn.disabled = true;
    generateBtn.style.opacity = "0.7";
  } else {
    loader.classList.add("hidden");
    generateBtn.disabled = false;
    generateBtn.style.opacity = "1";
  }
}

// Share & Copy Handlers
shareBtn.addEventListener("click", () => {
  if (!currentRawMarkdown) return;
  const title = "Bilim & Teknoloji Bülteni";
  if (window.AndroidBridge && window.AndroidBridge.shareText) {
    window.AndroidBridge.shareText(title, currentRawMarkdown);
  } else if (navigator.share) {
    navigator.share({ title: title, text: currentRawMarkdown }).catch(() => {});
  } else {
    navigator.clipboard.writeText(currentRawMarkdown);
    alert("Bülten metni panoya kopyalandı!");
  }
});

copyBtn.addEventListener("click", () => {
  if (!currentRawMarkdown) return;
  if (window.AndroidBridge && window.AndroidBridge.copyToClipboard) {
    window.AndroidBridge.copyToClipboard(currentRawMarkdown);
  } else {
    navigator.clipboard.writeText(currentRawMarkdown);
    alert("Bülten metni panoya kopyalandı!");
  }
});

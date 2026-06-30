const chatBox = document.getElementById("chatBox");
const historyList = document.getElementById("historyList");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const searchChats = document.getElementById("searchChats");
const chatCount = document.getElementById("chatCount");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const themeBtn = document.getElementById("themeBtn");
const attachBtn = document.getElementById("attachBtn");
const voiceBtn = document.getElementById("voiceBtn");
const fileInput = document.getElementById("fileInput");
const charCount = document.getElementById("charCount");
const draftStatus = document.getElementById("draftStatus");
const toast = document.getElementById("toast");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const promptPanel = document.getElementById("promptPanel");

const STORAGE_KEY = "nova-ai-chatbot-state";
const DRAFT_KEY = "nova-ai-draft";

let state = loadState();
let activeChatId = state.activeChatId || state.chats[0].id;
let recognition = null;

renderAll();
restoreDraft();

sendBtn.addEventListener("click", sendMessage);
newChatBtn.addEventListener("click", createNewChat);
searchChats.addEventListener("input", renderHistory);
exportBtn.addEventListener("click", exportCurrentChat);
clearBtn.addEventListener("click", clearCurrentChat);
themeBtn.addEventListener("click", toggleTheme);
attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFiles);
voiceBtn.addEventListener("click", startVoiceInput);
menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

messageInput.addEventListener("input", () => {
  resizeInput();
  charCount.textContent = `${messageInput.value.length} / 4000`;
  localStorage.setItem(DRAFT_KEY, messageInput.value);
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

promptPanel.addEventListener("click", (event) => {
  const card = event.target.closest(".prompt-card");
  if (!card) return;
  messageInput.value = card.dataset.prompt;
  messageInput.focus();
  messageInput.dispatchEvent(new Event("input"));
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.chats) && parsed.chats.length) return parsed;
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const starterChat = {
    id: crypto.randomUUID(),
    title: "Welcome to Nova AI",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: "bot",
        text: "Hello Zunaid! I am Nova AI. Ask me about cloud computing, Python, FastAPI, programming, or your next big project.",
        time: Date.now()
      }
    ]
  };

  return {
    theme: "dark",
    activeChatId: starterChat.id,
    chats: [starterChat]
  };
}

function saveState() {
  state.activeChatId = activeChatId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === activeChatId) || state.chats[0];
}

function renderAll() {
  document.body.classList.toggle("light", state.theme === "light");
  themeBtn.textContent = state.theme === "light" ? "Dark Mode" : "Light Mode";
  renderHistory();
  renderMessages();
  saveState();
}

function renderHistory() {
  const query = searchChats.value.trim().toLowerCase();
  const chats = state.chats
    .filter((chat) => chat.title.toLowerCase().includes(query) || chat.messages.some((message) => message.text.toLowerCase().includes(query)))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  chatCount.textContent = state.chats.length;
  historyList.innerHTML = "";

  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.className = `history-item ${chat.id === activeChatId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(chat.title)}</strong>
      <small>${chat.messages.length} messages - ${formatTime(chat.updatedAt)}</small>
    `;
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      sidebar.classList.remove("open");
      renderAll();
    });
    historyList.appendChild(button);
  });
}

function renderMessages() {
  const chat = getActiveChat();
  chatBox.innerHTML = "";

  chat.messages.forEach((message, index) => {
    chatBox.appendChild(createMessageNode(message, index));
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

function createMessageNode(message, index) {
  const article = document.createElement("article");
  article.className = `message ${message.role}`;

  const sender = message.role === "user" ? "You" : "Nova AI";
  article.innerHTML = `
    <div class="message-head">
      <span>${sender} - ${formatTime(message.time)}</span>
      <div class="message-actions">
        <button class="mini-btn" type="button" data-action="copy">Copy</button>
        ${message.role === "bot" ? '<button class="mini-btn" type="button" data-action="regen">Regenerate</button>' : ""}
      </div>
    </div>
    <div class="message-bubble">${escapeHtml(message.text)}</div>
  `;

  article.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    await navigator.clipboard.writeText(message.text);
    showToast("Message copied");
  });

  const regen = article.querySelector('[data-action="regen"]');
  if (regen) {
    regen.addEventListener("click", () => regenerateFrom(index));
  }

  return article;
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  const chat = getActiveChat();
  chat.messages.push({ role: "user", text, time: Date.now() });
  chat.title = makeTitle(text);
  chat.updatedAt = Date.now();

  messageInput.value = "";
  localStorage.removeItem(DRAFT_KEY);
  messageInput.dispatchEvent(new Event("input"));
  renderAll();
  showTyping();

  const reply = await getNovaReply(text, chat.messages);
  removeTyping();

  chat.messages.push({ role: "bot", text: reply, time: Date.now() });
  chat.updatedAt = Date.now();
  renderAll();
}

function showTyping() {
  const typing = document.createElement("article");
  typing.className = "message bot";
  typing.id = "typingMessage";
  typing.innerHTML = `
    <div class="message-head"><span>Nova AI is thinking...</span></div>
    <div class="message-bubble typing"><span></span><span></span><span></span></div>
  `;
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
  sendBtn.disabled = true;
}

function removeTyping() {
  document.getElementById("typingMessage")?.remove();
  sendBtn.disabled = false;
}

async function getNovaReply(text, history) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: history.slice(0, -1)
      })
    });

    const data = await response.json();

    if (data.reply) return data.reply;
    if (!response.ok) throw new Error(data.error || "Backend error");
  } catch (error) {
    console.warn("Nova backend unavailable, using local demo reply:", error.message);
  }

  return fakeNovaReply(text);
}

async function fakeNovaReply(text) {
  await wait(650);

  const lower = text.toLowerCase();
  if (lower.includes("cloud")) {
    return "Cloud computing means using internet-based servers to store data, run apps, and scale resources without buying physical machines. Example: Netflix runs huge video services by renting cloud infrastructure instead of maintaining every server itself.";
  }

  if (lower.includes("python")) {
    return `Here is a clean Python starter example:\n\nnum1 = float(input("First number: "))\noperator = input("Operator (+, -, *, /): ")\nnum2 = float(input("Second number: "))\n\nif operator == "+":\n    print(num1 + num2)\nelif operator == "-":\n    print(num1 - num2)\nelif operator == "*":\n    print(num1 * num2)\nelif operator == "/" and num2 != 0:\n    print(num1 / num2)\nelse:\n    print("Invalid input")`;
  }

  if (lower.includes("fastapi")) {
    return "FastAPI is a Python framework for building APIs quickly. It is fast, clean, and gives automatic docs. A basic route looks like: @app.get('/items') then a function returning JSON.";
  }

  if (lower.includes("startup")) {
    return "AI startup idea: a trust scanner for online sellers that checks product photos, reviews, seller behavior, and video proof to detect fake listings. Users: marketplaces and buyers. Revenue: SaaS API plus fraud-report dashboard.";
  }

  return "Great question. In a real Gemini-connected version, I would send this prompt to the Gemini API and stream the answer back here. For now, this frontend demo keeps everything local and shows how your chatbot experience will work.";
}

function createNewChat() {
  const chat = {
    id: crypto.randomUUID(),
    title: "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: "bot",
        text: "New chat started. What should we build, learn, or solve next?",
        time: Date.now()
      }
    ]
  };

  state.chats.unshift(chat);
  activeChatId = chat.id;
  renderAll();
  messageInput.focus();
}

function clearCurrentChat() {
  const chat = getActiveChat();
  chat.messages = [
    {
      role: "bot",
      text: "Chat cleared. Fresh start.",
      time: Date.now()
    }
  ];
  chat.title = "New Chat";
  chat.updatedAt = Date.now();
  renderAll();
  showToast("Current chat cleared");
}

function exportCurrentChat() {
  const chat = getActiveChat();
  const text = chat.messages
    .map((message) => `${message.role === "user" ? "You" : "Nova AI"}: ${message.text}`)
    .join("\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${chat.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-chat.txt`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Chat exported");
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  renderAll();
}

function handleFiles() {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  const names = files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ");
  messageInput.value = `Attached files: ${names}\n\nPlease analyze these files.`;
  messageInput.dispatchEvent(new Event("input"));
  showToast(`${files.length} file selected`);
  fileInput.value = "";
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Voice input is not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onstart = () => showToast("Listening...");
  recognition.onerror = () => showToast("Voice input failed");
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = `${messageInput.value} ${transcript}`.trim();
    messageInput.dispatchEvent(new Event("input"));
    messageInput.focus();
  };
  recognition.start();
}

function regenerateFrom(index) {
  const chat = getActiveChat();
  const previousUser = [...chat.messages.slice(0, index)].reverse().find((message) => message.role === "user");
  if (!previousUser) return;

  chat.messages = chat.messages.slice(0, index);
  messageInput.value = previousUser.text;
  sendMessage();
}

function restoreDraft() {
  messageInput.value = localStorage.getItem(DRAFT_KEY) || "";
  messageInput.dispatchEvent(new Event("input"));
  draftStatus.textContent = "Saved locally";
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
}

function makeTitle(text) {
  return text.length > 34 ? `${text.slice(0, 34)}...` : text;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

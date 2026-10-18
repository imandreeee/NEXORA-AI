
const API_URL =
  "https://nexora-ai-api.nexoraaaaiii-f43.workers.dev/";

const form = document.getElementById("chatForm");
const input = document.getElementById("prompt");
const messages = document.getElementById("messages");

const history = [];

function addMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  history.push({ role: "user", content: message });
  input.value = "";

  const loading = addMessage("NEXORA sta pensando...", "assistant");
  const sendButton = document.getElementById("sendButton");

  if (sendButton) sendButton.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Errore del servizio AI.");
    }

    loading.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
  } catch (error) {
    loading.textContent =
      "Non riesco a collegarmi a NEXORA AI. Riprova tra poco.";
    console.error("NEXORA API:", error);
  } finally {
    if (sendButton) sendButton.disabled = false;
    input.focus();
  }
});

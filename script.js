
'use strict';

const API_URL = 'https://nexora-ai-api.nexoraaaaiii-f43.workers.dev/';
const STORAGE_KEY = 'nexora-conversations-v1';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  form: $('#chatForm'),
  prompt: $('#prompt'),
  send: $('#sendButton'),
  messages: $('#messages'),
  welcome: $('#welcome'),
  newChat: $('#newChat'),
  history: $('#history'),
  chatView: $('#chatView'),
  exploreView: $('#exploreView'),
  pageName: $('#pageName'),
  themeToggle: $('#themeToggle'),
  mobileMenu: $('#mobileMenu')
};

let conversations = loadConversations();
let activeId = conversations[0]?.id || null;
let isSending = false;
let currentView = 'chat';

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];

    return saved.filter(chat =>
      chat && typeof chat.id === 'string' && Array.isArray(chat.messages)
    );
  } catch (error) {
    console.warn('Cronologia non disponibile:', error);
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Salvataggio cronologia:', error);
  }
}

function getActiveConversation() {
  return conversations.find(chat => chat.id === activeId);
}

function createConversation() {
  const chat = {
    id: createId(),
    title: 'Nuova conversazione',
    messages: [],
    updatedAt: Date.now()
  };

  conversations.unshift(chat);
  activeId = chat.id;

  renderHistory();
  renderMessages();
  showView('chat');
  elements.prompt.focus();
}

function addMessage(text, role, conversation = getActiveConversation()) {
  if (!conversation) return null;

  const message = { id: createId(), role, content: text };
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();

  renderMessages();
  renderHistory();
  saveConversations();

  return message;
}

/* Markdown sicuro: titoli, paragrafi, liste, tabelle e codice */

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatInline(text) {
  let html = escapeHtml(text);

  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  return html;
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split('|').map(cell => cell.trim());
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function renderMarkdown(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let i = 0;

  function flushParagraph() {
    if (!paragraph.length) return;
    output.push('<p>' + formatInline(paragraph.join(' ')) + '</p>');
    paragraph = [];
  }

  function isSpecial(line, next = '') {
    return !line.trim() ||
      /^\s*```/.test(line) ||
      /^#{1,6}\s+/.test(line) ||
      /^\s*[-*+]\s+/.test(line) ||
      /^\s*\d+[.)]\s+/.test(line) ||
      /^\s*>/.test(line) ||
      /^\s*(---+|\*\*\*+|___+)\s*$/.test(line) ||
      (line.includes('|') && isTableSeparator(next));
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    if (/^\s*```/.test(line)) {
      flushParagraph();
      const code = [];
      i++;

      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i++]);
      }

      if (i < lines.length) i++;
      output.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
      continue;
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph();
      output.push('<hr>');
      i++;
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4);
      output.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();

      const headers = splitTableRow(line);
      i += 2;
      const rows = [];

      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }

      let table = '<div class="nexora-table-wrap"><table class="nexora-table"><thead><tr>';

      headers.forEach(cell => {
        table += '<th>' + formatInline(cell) + '</th>';
      });

      table += '</tr></thead><tbody>';

      rows.forEach(row => {
        table += '<tr>';
        headers.forEach((_, index) => {
          table += '<td>' + formatInline(row[index] || '') + '</td>';
        });
        table += '</tr>';
      });

      table += '</tbody></table></div>';
      output.push(table);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quote = [];

      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(formatInline(lines[i].replace(/^\s*>\s?/, '')));
        i++;
      }

      output.push('<blockquote><p>' + quote.join('<br>') + '</p></blockquote>');
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      output.push('<ul>');

      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        output.push('<li>' + formatInline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>');
        i++;
      }

      output.push('</ul>');
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      output.push('<ol>');

      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        output.push('<li>' + formatInline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
        i++;
      }

      output.push('</ol>');
      continue;
    }

    if (paragraph.length && isSpecial(line, lines[i + 1] || '')) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }

  flushParagraph();
  return output.join('\n');
}

function renderMessages() {
  const chat = getActiveConversation();
  elements.messages.replaceChildren();

  const messages = chat ? chat.messages : [];
  elements.welcome.classList.toggle('hidden', messages.length > 0);

  for (const message of messages) {
    const bubble = document.createElement('div');
    bubble.className = `message ${message.role}`;

    if (message.role === 'assistant') {
  if (window.marked && window.DOMPurify) {
    const html = window.marked.parse(message.content, {
      gfm: true,
      breaks: true
    });

    bubble.innerHTML = window.DOMPurify.sanitize(html);
  } else {
    bubble.textContent = message.content;
  }
} else {
  bubble.textContent = message.content;
}

    elements.messages.appendChild(bubble);
  }

  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderHistory() {
  elements.history.replaceChildren();

  const ordered = [...conversations]
    .filter(chat => chat.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  for (const chat of ordered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.textContent = '◇ ' + chat.title;
    button.title = chat.title;

    if (chat.id === activeId) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'true');
    }

    button.addEventListener('click', () => {
      if (isSending) return;
      activeId = chat.id;
      renderHistory();
      renderMessages();
      showView('chat');
    });

    elements.history.appendChild(button);
  }

  if (!ordered.length) {
    const empty = document.createElement('div');
    empty.className = 'history-item';
    empty.textContent = '◇ Le tue chat appariranno qui';
    elements.history.appendChild(empty);
  }
}

function showView(view) {
  currentView = view;

  elements.chatView.classList.toggle('hidden', view !== 'chat');
  elements.exploreView.classList.toggle('hidden', view !== 'explore');
  elements.pageName.textContent = view === 'chat' ? 'AI Assistant' : 'Esplora Nexora';

  $$('.nav-item').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);

    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function autoResize() {
  elements.prompt.style.height = 'auto';
  elements.prompt.style.height = Math.min(elements.prompt.scrollHeight, 180) + 'px';
}

function setBusy(busy) {
  isSending = busy;
  elements.send.disabled = busy;
  elements.prompt.disabled = busy;
  elements.send.classList.toggle('is-loading', busy);
}

function showLoading() {
  const bubble = document.createElement('div');
  bubble.className = 'message assistant';
  bubble.textContent = 'NEXORA sta pensando...';
  bubble.setAttribute('aria-label', 'Risposta in preparazione');
  elements.messages.appendChild(bubble);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return bubble;
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function streamAssistantMessage(content, chat) {
  const message = {
    id: createId(),
    role: 'assistant',
    content: ''
  };

  chat.messages.push(message);

  const bubble = document.createElement('div');
  bubble.className = 'message assistant is-streaming';
  bubble.setAttribute('aria-label', 'Risposta di NEXORA AI');
  elements.messages.appendChild(bubble);

  // Velocità dinamica: più lenta sulle pause, più rapida nel testo normale.
  let i = 0;

  while (i < content.length) {
    const remaining = content.length - i;
    const current = content[i];

    let chunkSize = remaining > 500 ? 7 : remaining > 180 ? 5 : 3;
    let delay = remaining > 500 ? 5 : remaining > 180 ? 9 : 14;

    if (/[.!?…]/.test(current)) {
      chunkSize = 1;
      delay = 100;
    } else if (/[,;:]/.test(current)) {
      chunkSize = 1;
      delay = 55;
    } else if (current === '\n') {
      chunkSize = 1;
      delay = 70;
    }

    i = Math.min(i + chunkSize, content.length);
    message.content = content.slice(0, i);

    if (window.marked && window.DOMPurify) {
      const html = window.marked.parse(message.content, {
        gfm: true,
        breaks: true
      });

      bubble.innerHTML = window.DOMPurify.sanitize(html);
    } else {
      bubble.textContent = message.content;
    }

    elements.messages.scrollTop = elements.messages.scrollHeight;

    if (i < content.length) {
      await sleep(delay);
    }
  }

  bubble.classList.remove('is-streaming');
  message.content = content;
  chat.updatedAt = Date.now();

  saveConversations();
  renderHistory();
  renderMessages();
}


async function readGroqStream(response, chat) {
  if (!response.body) {
    throw new Error('Streaming non supportato dal browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const message = {
    id: createId(),
    role: 'assistant',
    content: ''
  };

  chat.messages.push(message);

  const bubble = document.createElement('div');
  bubble.className = 'message assistant is-streaming';
  bubble.setAttribute('aria-label', 'Risposta di NEXORA AI');
  elements.messages.appendChild(bubble);

  function updateBubble() {
    if (window.marked && window.DOMPurify) {
      const html = window.marked.parse(fullText, {
        gfm: true,
        breaks: true
      });

      bubble.innerHTML = window.DOMPurify.sanitize(html);
    } else {
      bubble.textContent = fullText;
    }

    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function processEvent(eventText) {
    for (const line of eventText.split('\n')) {
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      let packet;

      try {
        packet = JSON.parse(data);
      } catch {
        continue;
      }

      const delta = packet.choices?.[0]?.delta?.content;

      if (typeof delta === 'string' && delta.length) {
        fullText += delta;
        message.content = fullText;
        updateBubble();
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();

      buffer += decoder.decode(value || new Uint8Array(), {
        stream: !done
      });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const eventText of events) {
        processEvent(eventText);
      }

      if (done) break;
    }

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (!fullText.trim()) {
      throw new Error('NEXORA non ha ricevuto una risposta dal modello.');
    }

    message.content = fullText;
    chat.updatedAt = Date.now();
    bubble.classList.remove('is-streaming');

    saveConversations();
    renderHistory();
  } catch (error) {
    if (fullText.trim()) {
      message.content = fullText;
      saveConversations();
    } else {
      chat.messages = chat.messages.filter(item => item.id !== message.id);
      bubble.remove();
    }

    throw error;
  } finally {
    reader.releaseLock();
  }
}


async function sendMessage(text) {
  const message = text.trim();
  if (!message || isSending) return;

  if (!getActiveConversation()) {
    const chat = {
      id: createId(),
      title: 'Nuova conversazione',
      messages: [],
      updatedAt: Date.now()
    };

    conversations.unshift(chat);
    activeId = chat.id;
  }

  const chat = getActiveConversation();
  showView('chat');

  if (chat.messages.length === 0) {
    chat.title = message.replace(/\s+/g, ' ').slice(0, 38);
    if (message.length > 38) chat.title += '…';
  }

  addMessage(message, 'user', chat);
  elements.prompt.value = '';
  autoResize();
  setBusy(true);

  const loading = showLoading();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chat.messages.slice(-16).map(({ role, content }) => ({
          role,
          content
        }))
      })
    });

    
async function readGroqStream(response, chat) {
  if (!response.body) {
    throw new Error('Streaming non supportato dal browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const message = {
    id: createId(),
    role: 'assistant',
    content: ''
  };

  chat.messages.push(message);

  const bubble = document.createElement('div');
  bubble.className = 'message assistant is-streaming';
  bubble.setAttribute('aria-label', 'Risposta di NEXORA AI');
  elements.messages.appendChild(bubble);

  function updateBubble() {
    if (window.marked && window.DOMPurify) {
      const html = window.marked.parse(fullText, {
        gfm: true,
        breaks: true
      });

      bubble.innerHTML = window.DOMPurify.sanitize(html);
    } else {
      bubble.textContent = fullText;
    }

    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function processEvent(eventText) {
    for (const line of eventText.split('\n')) {
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      let packet;

      try {
        packet = JSON.parse(data);
      } catch {
        continue;
      }

      const delta = packet.choices?.[0]?.delta?.content;

      if (typeof delta === 'string' && delta.length) {
        fullText += delta;
        message.content = fullText;
        updateBubble();
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();

      buffer += decoder.decode(value || new Uint8Array(), {
        stream: !done
      });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const eventText of events) {
        processEvent(eventText);
      }

      if (done) break;
    }

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (!fullText.trim()) {
      throw new Error('NEXORA non ha ricevuto una risposta dal modello.');
    }

    message.content = fullText;
    chat.updatedAt = Date.now();
    bubble.classList.remove('is-streaming');

    saveConversations();
    renderHistory();
  } catch (error) {
    if (fullText.trim()) {
      message.content = fullText;
      saveConversations();
    } else {
      chat.messages = chat.messages.filter(item => item.id !== message.id);
      bubble.remove();
    }

    throw error;
  } finally {
    reader.releaseLock();
  }
}


  } catch (error) {
    console.error('NEXORA API:', error);
    loading.textContent = 'Non riesco a collegarmi a NEXORA AI. Controlla la connessione e riprova.';
    loading.classList.add('error');
  } finally {
    setBusy(false);
    elements.prompt.focus();
  }
}

function bindEvents() {
  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage(elements.prompt.value);
  });

  elements.prompt.addEventListener('input', autoResize);

  elements.prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  elements.newChat.addEventListener('click', () => {
    if (!isSending) createConversation();
  });

  $$('.nav-item').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });

  $$('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt;
      if (prompt) sendMessage(prompt);
    });
  });

  elements.themeToggle.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('light-atmosphere');
    elements.themeToggle.setAttribute('aria-pressed', String(enabled));

    try {
      localStorage.setItem('nexora-theme', enabled ? 'light' : 'dark');
    } catch (error) {
      console.warn('Preferenza tema non salvata:', error);
    }
  });

  if (elements.mobileMenu) {
    elements.mobileMenu.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('is-open');
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelector('.sidebar')?.classList.remove('is-open');
    }
  });
}

function init() {
  try {
    if (localStorage.getItem('nexora-theme') === 'light') {
      document.body.classList.add('light-atmosphere');
      elements.themeToggle.setAttribute('aria-pressed', 'true');
    }
  } catch (error) {
    console.warn('Preferenza tema non disponibile:', error);
  }

  conversations.sort((a, b) => b.updatedAt - a.updatedAt);

  if (!getActiveConversation()) {
    activeId = conversations[0]?.id || null;
  }

  bindEvents();
  renderHistory();
  renderMessages();
  showView('chat');
  autoResize();

  console.info('NEXORA AI inizializzata.');
}

init();

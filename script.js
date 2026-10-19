
'use strict';

const API_URL =
  "https://nexora-ai-api.nexoraaaaiii-f43.workers.dev/";

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

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

const STORAGE_KEY = 'nexora-conversations-v1';

let conversations = loadConversations();
let activeId = conversations.length
  ? conversations[0].id
  : null;
let isSending = false;
let currentView = 'chat';

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function loadConversations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]'
    );

    if (!Array.isArray(saved)) return [];

    return saved.filter(chat =>
      chat &&
      typeof chat.id === 'string' &&
      Array.isArray(chat.messages)
    );
  } catch (error) {
    console.warn('Cronologia non disponibile:', error);
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
    return true;
  } catch (error) {
    console.error('Salvataggio cronologia:', error);
    return false;
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

  const message = {
    role,
    content: text,
    id: createId()
  };

  conversation.messages.push(message);
  conversation.updatedAt = Date.now();

  
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatInline(text) {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  return html;
}

function renderMarkdown(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let i = 0;

  function flushParagraph() {
    if (paragraph.length) {
      output.push('<p>' +
        formatInline(paragraph.join(' ')) +
        '</p>');
      paragraph = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flushParagraph();
      i++;
      const code = [];

      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i++]);
      }

      if (i < lines.length) i++;

      output.push('<pre><code>' +
        escapeHtml(code.join('\n')) +
        '</code></pre>');
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)/);

    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      output.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      output.push('<ul>');

      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        output.push('<li>' +
          formatInline(lines[i].replace(/^\s*[-*+]\s+/, '')) +
          '</li>');
        i++;
      }

      output.push('</ul>');
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      output.push('<ol>');

      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        output.push('<li>' +
          formatInline(lines[i].replace(/^\s*\d+\.\s+/, '')) +
          '</li>');
        i++;
      }

      output.push('</ol>');
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }

  flushParagraph();
  return output.join('\n');
}


  renderMessages();
  renderHistory();
  saveConversations();

  return message;
}

function renderMessages() {
  const chat = getActiveConversation();

  elements.messages.replaceChildren();

  const messages = chat ? chat.messages : [];

  elements.welcome.classList.toggle(
    'hidden',
    messages.length > 0
  );

  for (const message of messages) {
    const  = document.createElement('div');
    bubble.className = `message ${message.role}`;
    if (message.role === 'assistant') {
  bubble.innerHTML = renderMarkdown(message.content);
} else {
  bubble.textContent = message.content;
}
    elements.messages.appendChild(bubble);
  }

  elements.messages.scrollTop =
    elements.messages.scrollHeight;
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

  if (ordered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-item';
    empty.textContent = '◇ Le tue chat appariranno qui';
    elements.history.appendChild(empty);
  }
}

function showView(view) {
  currentView = view;

  elements.chatView.classList.toggle(
    'hidden',
    view !== 'chat'
  );

  elements.exploreView.classList.toggle(
    'hidden',
    view !== 'explore'
  );

  elements.pageName.textContent =
    view === 'chat' ? 'AI Assistant' : 'Esplora Nexora';

  $$('.nav-item').forEach(button => {
    const active = button.dataset.view === view;

    button.classList.toggle('active', active);

    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function autoResize() {
  elements.prompt.style.height = 'auto';
  elements.prompt.style.height =
    Math.min(elements.prompt.scrollHeight, 180) + 'px';
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
  elements.messages.scrollTop =
    elements.messages.scrollHeight;

  return bubble;
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  messages: chat.messages.slice(-16).map(({ role, content }) => ({
    role,
    content
  }))
})
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error('Il server ha restituito una risposta non valida.');
    }

    if (!response.ok) {
      throw new Error(
        data.error || 'Il servizio AI ha restituito un errore.'
      );
    }

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('La risposta AI è vuota.');
    }

    chat.messages.push({
      id: createId(),
      role: 'assistant',
      content: data.reply
    });

    chat.updatedAt = Date.now();

    saveConversations();
    renderHistory();
    renderMessages();

  } catch (error) {
    console.error('NEXORA API:', error);

    loading.textContent =
      'Non riesco a collegarmi a NEXORA AI. ' +
      'Controlla la connessione e riprova.';

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
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  elements.newChat.addEventListener('click', () => {
    if (isSending) return;
    createConversation();
  });

  $$('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      showView(button.dataset.view);
    });
  });

  $$('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt;
      if (prompt) sendMessage(prompt);
    });
  });

  elements.themeToggle.addEventListener('click', () => {
    const enabled = document.body.classList.toggle(
      'light-atmosphere'
    );

    elements.themeToggle.setAttribute(
      'aria-pressed',
      String(enabled)
    );

    try {
      localStorage.setItem(
        'nexora-theme',
        enabled ? 'light' : 'dark'
      );
    } catch (error) {
      console.warn('Preferenza tema non salvata:', error);
    }
  });

  if (elements.mobileMenu) {
    elements.mobileMenu.addEventListener('click', () => {
      document.querySelector('.sidebar')
        .classList.toggle('is-open');
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelector('.sidebar')
        ?.classList.remove('is-open');
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

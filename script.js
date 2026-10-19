
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
  } catch (error) {
    console.error('Errore salvataggio:', error);
  }
}

function getActiveConversation() {
  return conversations.find(chat => chat.id === activeId);
}

function createConversation() {
  if (isSending) return;

  const chat = {
    id: createId(),
    title: 'Nuova conversazione',
    messages: [],
    updatedAt: Date.now()
  };

  conversations.unshift(chat);
  activeId = chat.id;

  saveConversations();
  renderHistory();
  renderMessages();
  showView('chat');
  elements.prompt.focus();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    const html = window.marked.parse(String(text), {
      gfm: true,
      breaks: true
    });

    return window.DOMPurify.sanitize(html);
  }

  return escapeHtml(text).replace(/\n/g, '<br>');
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
    const bubble = document.createElement('div');
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

  document.querySelector('.sidebar')
    ?.classList.remove('is-open');
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function streamAssistantMessage(content, chat, loading) {
  loading.remove();

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

  let i = 0;

  while (i < content.length) {
    const remaining = content.length - i;
    const current = content[i];

    let chunkSize = remaining > 500 ? 5 : remaining > 180 ? 3 : 2;
    let delay = remaining > 500 ? 5 : remaining > 180 ? 12 : 18;

    if (/[.!?…]/.test(current)) {
      chunkSize = 1;
      delay = 100;
    } else if (/[,;:]/.test(current)) {
      chunkSize = 1;
      delay = 50;
    } else if (current === '\n') {
      chunkSize = 1;
      delay = 65;
    }

    i = Math.min(i + chunkSize, content.length);
    message.content = content.slice(0, i);

    bubble.innerHTML = renderMarkdown(message.content);

    elements.messages.scrollTop =
      elements.messages.scrollHeight;

    if (i < content.length) {
      await sleep(delay);
    }
  }

  bubble.classList.remove('is-streaming');

  chat.updatedAt = Date.now();
  saveConversations();
  renderHistory();
}

async function sendMessage(text) {
  const content = text.trim();

  if (!content || isSending) return;

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
    chat.title = content.replace(/\s+/g, ' ').slice(0, 38);

    if (content.length > 38) {
      chat.title += '…';
    }
  }

  chat.messages.push({
    id: createId(),
    role: 'user',
    content
  });

  chat.updatedAt = Date.now();

  saveConversations();
  renderMessages();
  renderHistory();

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
        messages: chat.messages.slice(-16).map(
          ({ role, content }) => ({ role, content })
        )
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error('Risposta del server non valida.');
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Errore del server (${response.status}).`
      );
    }

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('La risposta AI è vuota.');
    }

    await streamAssistantMessage(data.reply.trim(), chat, loading);

  } catch (error) {
    console.error('NEXORA API:', error);

    loading.textContent =
      'NEXORA ha riscontrato un problema: ' +
      (error.message || 'connessione non disponibile.');

    loading.classList.add('error');

    saveConversations();
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

  elements.newChat.addEventListener('click', createConversation);

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
      console.warn('Tema non salvato:', error);
    }
  });

  if (elements.mobileMenu) {
    elements.mobileMenu.addEventListener('click', () => {
      document.querySelector('.sidebar')
        ?.classList.toggle('is-open');
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelector('.sidebar')
        ?.classList.remove('is-open');
    }
  });

  document.querySelector('.brand')?.addEventListener('click', event => {
    event.preventDefault();
    showView('chat');
  });
}

function init() {
  if (!elements.form || !elements.prompt ||
      !elements.send || !elements.messages ||
      !elements.welcome || !elements.newChat ||
      !elements.history || !elements.chatView ||
      !elements.exploreView || !elements.pageName ||
      !elements.themeToggle) {
    console.error('NEXORA: mancano elementi HTML richiesti.');
    return;
  }

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

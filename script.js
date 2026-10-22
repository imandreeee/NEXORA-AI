'use strict';

/*
 * NEXORA AI — frontend + Supabase Auth/cronologia
 * Inserisci i tuoi dati Supabase qui sotto.
 * Usa SOLO la Publishable Key. Mai inserire la Secret Key nel frontend.
 */
const API_URL = 'https://nexora-ai-api.nexoraaaaiii-f43.workers.dev/';
const SUPABASE_URL = 'https://ciuyzwuarbdsopncfpkd.supabase.co';
const SITE_URL = 'https://nexora-ai-ar4.pages.dev/';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1RTZH3BXnQClCbE_1Vqaqw_Jl16ISRA';
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

let supabaseClient = null;
let currentUser = null;
let conversations = loadConversations();
let activeId = conversations[0]?.id || null;
let isSending = false;
let syncing = false;

function createId() {
  return (globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
}


function getStorageKey() {
  return currentUser?.id
    ? `${STORAGE_KEY}:user:${currentUser.id}`
    : `${STORAGE_KEY}:guest`;
}

function loadConversations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(getStorageKey()) || '[]'
    );

    if (!Array.isArray(saved)) return [];

    return saved.filter(chat =>
      chat &&
      typeof chat.id === 'string' &&
      Array.isArray(chat.messages)
    ).map(chat => ({
      id: chat.id,
      title: typeof chat.title === 'string'
        ? chat.title
        : 'Nuova conversazione',
      messages: chat.messages.filter(m =>
        m &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string'
      ),
      updatedAt: Number(chat.updatedAt) || Date.now(),
      createdAt: Number(chat.createdAt) ||
        Number(chat.updatedAt) || Date.now()
    }));
  } catch {
    return [];
  }
}


function saveConversations() {
  try {
    localStorage.setItem(
      getStorageKey(),
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error('Errore salvataggio cronologia locale:', error);
  }
}


function getActiveConversation() {
  return conversations.find(chat => chat.id === activeId);
}

function makeConversation() {
  const now = Date.now();
  return {
    id: createId(),
    title: 'Nuova conversazione',
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function createConversation() {
  if (isSending) return;
  const chat = makeConversation();
  conversations.unshift(chat);
  activeId = chat.id;
  saveConversations();
  renderHistory();
  renderMessages();
  showView('chat');
  elements.prompt.focus();
}

function renderMarkdown(text) {
  const content = String(text);
  if (window.marked && window.DOMPurify) {
    return window.DOMPurify.sanitize(
      window.marked.parse(content, { gfm: true, breaks: true })
    );
  }
  const escaped = content.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  return escaped.replace(/\n/g, '<br>');
}

function renderMessages() {
  const chat = getActiveConversation();
  elements.messages.replaceChildren();
  const messages = chat ? chat.messages : [];
  elements.welcome.classList.toggle('hidden', messages.length > 0);

  for (const message of messages) {
    const bubble = document.createElement('div');
    bubble.className = `message ${message.role}`;
    if (message.role === 'assistant') bubble.innerHTML = renderMarkdown(message.content);
    else bubble.textContent = message.content;
    elements.messages.appendChild(bubble);
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

async function deleteConversation(id) {
  if (isSending) return;
  const chat = conversations.find(item => item.id === id);
  if (!chat) return;
  if (!window.confirm(`Eliminare la conversazione "${chat.title}"?`)) return;

  if (currentUser && supabaseClient) {
    const { error } = await supabaseClient.from('conversations')
      .delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) {
      console.error('Errore eliminazione Supabase:', error);
      alert('Non sono riuscito a eliminare la chat dal cloud. Riprova.');
      return;
    }
  }

  conversations = conversations.filter(item => item.id !== id);
  if (activeId === id) activeId = conversations[0]?.id || null;
  saveConversations();
  renderHistory();
  renderMessages();
}

function renderHistory() {
  elements.history.replaceChildren();
  const ordered = [...conversations]
    .filter(chat => chat.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!ordered.length) {
    const empty = document.createElement('div');
    empty.className = 'history-item';
    empty.textContent = '◇ Le tue chat appariranno qui';
    elements.history.appendChild(empty);
    return;
  }

  for (const chat of ordered) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;width:100%;';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.textContent = '◇ ' + chat.title;
    button.title = chat.title;
    button.style.cssText = 'flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;';
    if (chat.id === activeId) button.classList.add('active');
    button.addEventListener('click', () => {
      if (isSending) return;
      activeId = chat.id;
      renderHistory();
      renderMessages();
      showView('chat');
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Elimina conversazione';
    remove.setAttribute('aria-label', 'Elimina ' + chat.title);
    remove.style.cssText = 'flex:0 0 30px;min-width:30px;border:0;background:transparent;color:inherit;cursor:pointer;font-size:20px;border-radius:8px;';
    remove.addEventListener('click', () => deleteConversation(chat.id));

    row.append(button, remove);
    elements.history.appendChild(row);
  }
}

function showView(view) {
  elements.chatView.classList.toggle('hidden', view !== 'chat');
  elements.exploreView.classList.toggle('hidden', view !== 'explore');
  elements.pageName.textContent = view === 'chat' ? 'AI Assistant' : 'Esplora Nexora';
  $$('.nav-item').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('.sidebar')?.classList.remove('is-open');
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showLoading() {
  const bubble = document.createElement('div');
  bubble.className = 'message assistant';
  bubble.textContent = 'NEXORA sta pensando...';
  elements.messages.appendChild(bubble);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return bubble;
}

function toDbRow(chat) {
  return {
    id: chat.id,
    user_id: currentUser.id,
    title: chat.title,
    messages: chat.messages,
    created_at: new Date(chat.createdAt || chat.updatedAt).toISOString(),
    updated_at: new Date(chat.updatedAt || Date.now()).toISOString()
  };
}

async function syncConversation(chat) {
  if (!currentUser || !supabaseClient || !chat || syncing) return;
  syncing = true;
  try {
    const { error } = await supabaseClient.from('conversations').upsert(
      toDbRow(chat), { onConflict: 'id' }
    );
    if (error) throw error;
  } catch (error) {
    console.error('Sincronizzazione chat fallita:', error);
    setAccountStatus('Accesso attivo · sincronizzazione non riuscita');
  } finally {
    syncing = false;
  }
}



async function syncAllConversations() {
  if (!currentUser || !supabaseClient) return;

  const userId = currentUser.id;
  setAccountStatus('Sincronizzazione…');

  try {
    const { data, error } = await supabaseClient
      .from('conversations')
      .select('id,user_id,title,messages,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Non applicare i dati se nel frattempo è cambiato account.
    if (currentUser?.id !== userId) return;

    const remote = (data || []).map(row => ({
      id: row.id,
      title: row.title || 'Nuova conversazione',
      messages: Array.isArray(row.messages) ? row.messages : [],
      createdAt: Date.parse(row.created_at) || Date.now(),
      updatedAt: Date.parse(row.updated_at) || Date.now()
    }));

    // Unisce cronologia locale e cloud senza scartare chat uniche.
    const merged = new Map();

    for (const chat of conversations) {
      merged.set(chat.id, chat);
    }

    for (const cloudChat of remote) {
      const localChat = merged.get(cloudChat.id);

      if (!localChat) {
        merged.set(cloudChat.id, cloudChat);
        continue;
      }

      const localTime = Number(localChat.updatedAt) || 0;
      const cloudTime = Number(cloudChat.updatedAt) || 0;

      // Mantiene la versione più recente della conversazione.
      if (cloudTime > localTime) {
        merged.set(cloudChat.id, cloudChat);
      }
    }

    conversations = Array.from(merged.values())
      .sort((a, b) =>
        (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
      );

    // Mantiene la chat aperta se esiste ancora.
    if (!conversations.some(chat => chat.id === activeId)) {
      activeId = conversations[0]?.id || null;
    }

    saveConversations();
    renderHistory();
    renderMessages();

    setAccountStatus('Cronologia caricata');
    
    // Non caricare nuovamente la chat attiva se l'utente cambia account.
  } catch (error) {
    console.error('Errore caricamento cronologia:', error);
    setAccountStatus('Accesso attivo · errore sincronizzazione');
    alert(
      'Accesso effettuato, ma non riesco a caricare le chat da Supabase. Controlla URL, Publishable Key e policy RLS.'
    );
  }
}


function setAccountStatus(text) {
  const status = $('#nexoraAccountStatus');
  if (status) status.textContent = text;
}


function buildAccountUI() {
  const topActions = $('.top-actions');
  if (!topActions || $('#nexoraAccountButton')) return;

  const button = document.createElement('button');
  button.id = 'nexoraAccountButton';
  button.type = 'button';
  button.textContent = 'Accedi';
  button.style.cssText = 'border:1px solid rgba(150,150,190,.35);background:rgba(120,120,170,.12);color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer;font:inherit;';
  topActions.insertBefore(button, elements.themeToggle);

  const overlay = document.createElement('div');
  overlay.id = 'nexoraAuthOverlay';
  overlay.hidden = true;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(4,4,15,.78);backdrop-filter:blur(12px);align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <section role="dialog" aria-modal="true" aria-labelledby="nexoraAuthTitle"
      style="width:min(100%,420px);background:#11111f;color:#f5f5ff;border:1px solid #35354d;border-radius:20px;padding:24px;box-shadow:0 25px 80px #0008;font-family:inherit;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h2 id="nexoraAuthTitle" style="margin:0;font-size:22px;">Il tuo account NEXORA</h2>
        <button id="nexoraAuthClose" type="button" aria-label="Chiudi" style="background:transparent;color:inherit;border:0;font-size:25px;cursor:pointer;">×</button>
      </div>

      <p style="color:#b9b9d0;font-size:13px;line-height:1.5;">
        Accedi per sincronizzare le tue conversazioni su più dispositivi.
      </p>

      <form id="nexoraAuthForm" style="display:grid;gap:12px;">
        <label style="display:grid;gap:6px;font-size:13px;">Email
          <input id="nexoraEmail" type="email" autocomplete="email" required placeholder="nome@email.com"
            style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #41415b;background:#080812;color:white;">
        </label>

        <label style="display:grid;gap:6px;font-size:13px;">Password
          <input id="nexoraPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="La tua password"
            style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #41415b;background:#080812;color:white;">
        </label>

        <button id="nexoraLogin" type="submit" style="padding:12px;border:0;border-radius:10px;background:#8a75ff;color:white;font-weight:700;cursor:pointer;">Accedi</button>

        <button id="nexoraForgotPassword" type="button" style="border:0;background:transparent;color:#b9aaff;cursor:pointer;padding:7px;">Password dimenticata?</button>

        <button id="nexoraSignup" type="button" style="padding:11px;border:1px solid #45455e;border-radius:10px;background:transparent;color:inherit;cursor:pointer;">Crea un account</button>

        <button id="nexoraLogout" type="button" hidden style="padding:11px;border:1px solid #45455e;border-radius:10px;background:transparent;color:inherit;cursor:pointer;">Esci dall'account</button>
      </form>

      <form id="nexoraRecoveryForm" hidden style="display:none;gap:12px;margin-top:16px;">
        <p style="color:#b9b9d0;font-size:13px;line-height:1.5;margin:0;">
          Scegli una nuova password per il tuo account NEXORA.
        </p>

        <label style="display:grid;gap:6px;font-size:13px;">Nuova password
          <input id="nexoraNewPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Almeno 6 caratteri"
            style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #41415b;background:#080812;color:white;">
        </label>

        <label style="display:grid;gap:6px;font-size:13px;">Conferma password
          <input id="nexoraConfirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Ripeti la password"
            style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #41415b;background:#080812;color:white;">
        </label>

        <button id="nexoraSavePassword" type="submit" style="padding:12px;border:0;border-radius:10px;background:#8a75ff;color:white;font-weight:700;cursor:pointer;">Salva nuova password</button>

        <button id="nexoraCancelRecovery" type="button" style="padding:10px;border:1px solid #45455e;border-radius:10px;background:transparent;color:inherit;cursor:pointer;">Torna all'accesso</button>
      </form>

      <p id="nexoraAccountStatus" role="status" aria-live="polite" style="margin:12px 0 0;color:#c8c8e0;font-size:13px;line-height:1.5;"></p>

      <p style="color:#9292ac;font-size:11px;line-height:1.5;margin-bottom:0;">
        Non condividere la tua password con nessuno.
      </p>
    </section>`;

  document.body.appendChild(overlay);

  const authForm = $('#nexoraAuthForm');
  const recoveryForm = $('#nexoraRecoveryForm');
  const emailInput = $('#nexoraEmail');
  const passwordInput = $('#nexoraPassword');
  const loginButton = $('#nexoraLogin');
  const signupButton = $('#nexoraSignup');
  const logoutButton = $('#nexoraLogout');
  const forgotButton = $('#nexoraForgotPassword');
  const savePasswordButton = $('#nexoraSavePassword');

  function openOverlay() {
    overlay.hidden = false;
    overlay.style.display = 'flex';
  }

  function showLoginForm() {
    authForm.hidden = false;
    authForm.style.display = 'grid';
    recoveryForm.hidden = true;
    recoveryForm.style.display = 'none';
    $('#nexoraAuthTitle').textContent = 'Il tuo account NEXORA';
    $('#nexoraNewPassword').value = '';
    $('#nexoraConfirmPassword').value = '';
  }

  function showRecoveryForm() {
    openOverlay();
    authForm.hidden = true;
    authForm.style.display = 'none';
    recoveryForm.hidden = false;
    recoveryForm.style.display = 'grid';
    $('#nexoraAuthTitle').textContent = 'Reimposta password';
    setAccountStatus('Inserisci e conferma la tua nuova password.');
    $('#nexoraNewPassword').focus();
  }

  button.addEventListener('click', () => {
    showLoginForm();
    openOverlay();

    setAccountStatus(
      currentUser ? `Connesso come ${currentUser.email}` : 'Accedi o crea un account.'
    );

    logoutButton.hidden = !currentUser;
    loginButton.hidden = !!currentUser;
    signupButton.hidden = !!currentUser;
    forgotButton.hidden = !!currentUser;
    emailInput.value = currentUser?.email || '';
    passwordInput.value = '';
  });

  $('#nexoraAuthClose').addEventListener('click', closeAuth);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeAuth();
  });

  $('#nexoraCancelRecovery').addEventListener('click', () => {
    showLoginForm();
    setAccountStatus('Inserisci email e password per accedere.');
  });

  authForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!supabaseClient) {
      setAccountStatus('Supabase non è inizializzato. Ricarica la pagina.');
      return;
    }

    loginButton.disabled = true;
    setAccountStatus('Accesso in corso…');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });

      if (error) throw error;

      currentUser = data.user;
      updateAccountButton();
      await syncAllConversations();

      logoutButton.hidden = false;
      loginButton.hidden = true;
      signupButton.hidden = true;
      forgotButton.hidden = true;

      setAccountStatus(`Connesso come ${currentUser.email}`);
    } catch (error) {
      setAccountStatus(error.message || 'Accesso non riuscito.');
    } finally {
      loginButton.disabled = false;
    }
  });

  forgotButton.addEventListener('click', async () => {
    if (!supabaseClient) {
      setAccountStatus('Supabase non è inizializzato.');
      return;
    }

    const email = emailInput.value.trim();

    if (!email) {
      setAccountStatus('Inserisci prima la tua email nel campo Email.');
      emailInput.focus();
      return;
    }

    forgotButton.disabled = true;
    setAccountStatus('Invio della richiesta in corso…');

    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: SITE_URL
      });

      if (error) throw error;

      setAccountStatus(
        'Se l’indirizzo è associato a un account, riceverai un’email per reimpostare la password. Controlla anche Spam.'
      );
    } catch (error) {
      console.error('Recupero password:', error);
      setAccountStatus(
        error.message || 'Impossibile inviare la richiesta. Riprova più tardi.'
      );
    } finally {
      forgotButton.disabled = false;
    }
  });

  recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!supabaseClient) {
      setAccountStatus('Supabase non è inizializzato.');
      return;
    }

    const newPassword = $('#nexoraNewPassword').value;
    const confirmPassword = $('#nexoraConfirmPassword').value;

    if (newPassword.length < 6) {
      setAccountStatus('La password deve contenere almeno 6 caratteri.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setAccountStatus('Le due password non coincidono.');
      return;
    }

    savePasswordButton.disabled = true;
    setAccountStatus('Salvataggio della nuova password…');

    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      currentUser = data.user || currentUser;
      updateAccountButton();

      showLoginForm();
      loginButton.hidden = true;
      signupButton.hidden = true;
      forgotButton.hidden = true;
      logoutButton.hidden = false;

      setAccountStatus('Password aggiornata correttamente. Puoi continuare a usare NEXORA AI.');
      $('#nexoraNewPassword').value = '';
      $('#nexoraConfirmPassword').value = '';
    } catch (error) {
      console.error('Aggiornamento password:', error);
      setAccountStatus(
        error.message || 'Non è stato possibile aggiornare la password. Il link potrebbe essere scaduto.'
      );
    } finally {
      savePasswordButton.disabled = false;
    }
  });

  signupButton.addEventListener('click', async () => {
    if (!supabaseClient) {
      setAccountStatus('Supabase non è inizializzato.');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || password.length < 6) {
      setAccountStatus('Inserisci un’email valida e una password di almeno 6 caratteri.');
      return;
    }

    signupButton.disabled = true;
    setAccountStatus('Creazione account…');

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: SITE_URL }
      });

      if (error) throw error;

      if (data.session && data.user) {
        currentUser = data.user;
        updateAccountButton();
        await syncAllConversations();

        loginButton.hidden = true;
        signupButton.hidden = true;
        forgotButton.hidden = true;
        logoutButton.hidden = false;

        setAccountStatus('Account creato e accesso effettuato.');
      } else {
        setAccountStatus(
          'Account creato. Controlla la tua email per confermare la registrazione, poi accedi.'
        );
      }
    } catch (error) {
      setAccountStatus(error.message || 'Registrazione non riuscita.');
    } finally {
      signupButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    if (!supabaseClient) return;

    logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

     
currentUser = null;
conversations = loadConversations();
activeId = conversations[0]?.id || null;

updateAccountButton();

loginButton.hidden = false;
signupButton.hidden = false;
forgotButton.hidden = false;
logoutButton.hidden = true;

renderHistory();
renderMessages();

setAccountStatus('Sei uscito dall’account.');

    } catch (error) {
      setAccountStatus(error.message || 'Impossibile uscire dall’account.');
    } finally {
      logoutButton.disabled = false;
    }
  });
}

function closeAuth() {
  const overlay = $('#nexoraAuthOverlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.style.display = 'none';
  }
}

function updateAccountButton() {
  const button = $('#nexoraAccountButton');
  if (!button) return;
  button.textContent = currentUser ? 'Account' : 'Accedi';
  button.title = currentUser ? currentUser.email : 'Accedi o crea un account';
}

async function initSupabase() {
  buildAccountUI();
  if (SUPABASE_URL.startsWith('INCOLLA_') ||
      SUPABASE_PUBLISHABLE_KEY.startsWith('INCOLLA_') ||
      !window.supabase?.createClient) {
    setAccountStatus('Per attivare gli account, inserisci Project URL e Publishable Key in script.js.');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const { data } = await supabaseClient.auth.getSession();
currentUser = data.session?.user || null;

conversations = loadConversations();
activeId = conversations[0]?.id || null;

updateAccountButton();
renderHistory();
renderMessages();

  

supabaseClient.auth.onAuthStateChange((event, session) => {
  const previousUserId = currentUser?.id || null;
  currentUser = session?.user || null;
  const newUserId = currentUser?.id || null;

  updateAccountButton();

  if (previousUserId !== newUserId) {
    conversations = loadConversations();
    activeId = conversations[0]?.id || null;
    renderHistory();
    renderMessages();
  }

  if (event === 'PASSWORD_RECOVERY') {
    const overlay = $('#nexoraAuthOverlay');
    const authForm = $('#nexoraAuthForm');
    const recoveryForm = $('#nexoraRecoveryForm');

    if (overlay && authForm && recoveryForm) {
      overlay.hidden = false;
      overlay.style.display = 'flex';
      authForm.hidden = true;
      authForm.style.display = 'none';
      recoveryForm.hidden = false;
      recoveryForm.style.display = 'grid';
      $('#nexoraAuthTitle').textContent = 'Reimposta password';
      setAccountStatus('Link verificato. Inserisci la tua nuova password.');
    }
  }

  if (currentUser) {
    setTimeout(() => syncAllConversations(), 0);
  }
});

  if (currentUser) await syncAllConversations();
}

async function streamAssistantMessage(content, chat, bubble) {
  const message = { id: createId(), role: 'assistant', content: '' };
  chat.messages.push(message);
  bubble.classList.add('is-streaming');
  bubble.setAttribute('aria-label', 'Risposta di NEXORA AI');

  let i = 0;
  while (i < content.length) {
    const remaining = content.length - i;
    let chunkSize = remaining > 500 ? 6 : remaining > 180 ? 4 : 2;
    let delay = remaining > 500 ? 8 : remaining > 180 ? 14 : 20;
    const current = content[i];
    if (/[.!?…]/.test(current)) { chunkSize = 1; delay = 100; }
    else if (/[,;:]/.test(current)) { chunkSize = 1; delay = 55; }
    else if (current === '\n') { chunkSize = 1; delay = 70; }

    i = Math.min(i + chunkSize, content.length);
    message.content = content.slice(0, i);
    bubble.innerHTML = renderMarkdown(message.content);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    if (i < content.length) await sleep(delay);
  }

  bubble.classList.remove('is-streaming');
  chat.updatedAt = Date.now();
  saveConversations();
  renderHistory();
  await syncConversation(chat);
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || isSending) return;

  if (!getActiveConversation()) {
    const chat = makeConversation();
    conversations.unshift(chat);
    activeId = chat.id;
  }
  const chat = getActiveConversation();
  showView('chat');

  if (!chat.messages.length) {
    chat.title = content.replace(/\s+/g, ' ').slice(0, 38);
    if (content.length > 38) chat.title += '…';
  }

  chat.messages.push({ id: createId(), role: 'user', content });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chat.messages.slice(-16).map(({ role, content }) => ({ role, content }))
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      let details = '';
      try {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          details = data.error || '';
        } else {
          details = (await response.text()).slice(0, 200);
        }
      } catch {}
      throw new Error(details || `Errore server ${response.status}`);
    }

    let reply = '';
    if (contentType.includes('text/event-stream')) {
      if (!response.body) throw new Error('Stream della risposta vuoto.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';
          for (const event of events) {
            for (const line of event.split(/\r?\n/)) {
              if (!line.startsWith('data:')) continue;
              const raw = line.slice(5).trim();
              if (!raw || raw === '[DONE]') continue;
              try {
                const packet = JSON.parse(raw);
                const delta = packet.choices?.[0]?.delta?.content;
                if (typeof delta === 'string') reply += delta;
              } catch {}
            }
          }
          if (done) break;
        }
        if (buffer.trim()) {
          for (const line of buffer.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const packet = JSON.parse(raw);
              const delta = packet.choices?.[0]?.delta?.content;
              if (typeof delta === 'string') reply += delta;
            } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else if (contentType.includes('application/json')) {
      const data = await response.json();
      reply = typeof data.reply === 'string' ? data.reply : '';
    } else {
      throw new Error('Formato di risposta del Worker non riconosciuto.');
    }

    if (!reply.trim()) throw new Error('NEXORA non ha ricevuto una risposta dal modello.');
    loading.textContent = '';
    await streamAssistantMessage(reply.trim(), chat, loading);
  } catch (error) {
    console.error('NEXORA API:', error);
    loading.classList.remove('is-streaming');
    loading.classList.add('error');
    loading.textContent = 'NEXORA ha riscontrato un problema: ' +
      (error.message || 'connessione non disponibile.');
    saveConversations();
    await syncConversation(chat);
  } finally {
    setBusy(false);
    elements.prompt.focus();
  }
}

function bindEvents() {
  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    const message = elements.prompt.value.trim();
    if (!message || isSending) return;
    sendMessage(message);
  });
  elements.prompt.addEventListener('input', autoResize);
  elements.prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });
  elements.newChat.addEventListener('click', createConversation);

  $$('.nav-item').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
  $$('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.prompt) sendMessage(button.dataset.prompt);
    });
  });

  elements.themeToggle.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('light-atmosphere');
    elements.themeToggle.setAttribute('aria-pressed', String(enabled));
    try {
      localStorage.setItem('nexora-theme', enabled ? 'light' : 'dark');
    } catch (error) {
      console.warn('Tema non salvato:', error);
    }
  });

  elements.mobileMenu?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('is-open');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelector('.sidebar')?.classList.remove('is-open');
      closeAuth();
    }
  });
  document.querySelector('.brand')?.addEventListener('click', event => {
    event.preventDefault();
    showView('chat');
  });
}

async function init() {
  if (!elements.form || !elements.prompt || !elements.send ||
      !elements.messages || !elements.welcome || !elements.newChat ||
      !elements.history || !elements.chatView || !elements.exploreView ||
      !elements.pageName || !elements.themeToggle) {
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
  if (!getActiveConversation()) activeId = conversations[0]?.id || null;
  bindEvents();
  renderHistory();
  renderMessages();
  showView('chat');
  autoResize();
  await initSupabase();
  console.info('NEXORA AI inizializzata.');
}

init();

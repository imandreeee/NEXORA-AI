'use strict';

/* =========================================
   NEXORA AI — CORE ENGINE
   Local conversational simulation
========================================= */

const Nexora = (() => {
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

  const state = {
    conversations: [],
    activeId: null,
    typing: false,
    view: 'chat',
    atmosphere: false
  };

  const STORAGE_KEY = 'nexora-conversations-v1';

  /* =========================================
     KNOWLEDGE & RESPONSE ENGINE
  ========================================= */

  const knowledge = {
    greetings: [
      'Hey! Sono Nexora. Tutto pronto per trasformare un pensiero in qualcosa di concreto. Da dove partiamo?',
      'Connessione stabilita. Sono qui: idee, problemi, progetti o semplicemente curiosità. Spara.',
      'Eccoci. Il prossimo passo interessante potrebbe iniziare proprio da questa conversazione.'
    ],

    technology: [
      'La tecnologia migliore non è necessariamente quella più complessa: è quella che risolve un problema reale con eleganza. Partirei da tre elementi: obiettivo, strumenti e risultato misurabile.',
      'Il punto interessante della tecnologia è il modo in cui sistemi diversi possono collaborare. Software, dati e interfacce diventano davvero potenti quando sono progettati come un unico ecosistema.',
      'Per affrontare un progetto tecnologico, conviene separare ciò che è possibile fare, ciò che è utile fare e ciò che ha senso costruire adesso. Questa distinzione evita un sacco di complessità inutile.'
    ],

    programming: [
      'Per scrivere buon codice, partirei da una struttura semplice: separare la presentazione dalla logica, dare nomi chiari alle variabili e suddividere le funzionalità in moduli indipendenti. Meno caos oggi significa meno bug domani.',
      'Un progetto ben costruito non è quello con più righe di codice, ma quello che puoi capire, modificare ed estendere senza doverlo riscrivere ogni volta. Modularità e leggibilità sono fondamentali.',
      'Per individuare un bug, isolerei il comportamento problematico, verificherei gli input e controllerei la console del browser. Poi correggerei la causa, non soltanto il sintomo.'
    ],

    creativity: [
      'Proviamo a uscire dagli schemi: invece di aggiungere un’altra funzionalità a qualcosa che esiste già, potremmo ripensare completamente il modo in cui una persona interagisce con quel prodotto.',
      'Un’idea diventa interessante quando unisce tre elementi: un problema reale, una prospettiva inaspettata e una realizzazione abbastanza semplice da poter essere testata.',
      'Ti propongo questo approccio: manteniamo l’obiettivo, eliminiamo le convenzioni superflue e progettiamo una soluzione con una personalità riconoscibile.'
    ],

    science: [
      'Per comprendere un fenomeno scientifico, conviene distinguere ciò che osserviamo, il modello che usiamo per spiegarlo e le prove che permettono di verificarlo. È così che un’intuizione diventa conoscenza affidabile.',
      'La parte affascinante della scienza è che un modello può essere molto utile senza descrivere perfettamente ogni dettaglio della realtà. Le nuove evidenze ci aiutano a migliorarlo.'
    ],

    future: [
      'Il futuro non dipende soltanto dalle tecnologie che inventiamo, ma anche da come decidiamo di usarle. Le innovazioni più interessanti saranno probabilmente quelle capaci di amplificare le possibilità umane.',
      'Immagina strumenti digitali capaci di adattarsi al contesto, interfacce che scompaiono quando non servono e sistemi che collaborano senza complicare la vita alle persone. La vera evoluzione potrebbe essere questa.'
    ],

    help: [
      'Certo, affrontiamolo insieme. Possiamo dividere il problema in parti più piccole, individuare le priorità e costruire una soluzione concreta. Raccontami il contesto e lavoriamo sui dettagli.',
      'Ci sono. Prima definiamo il risultato che vuoi ottenere, poi identifichiamo il principale ostacolo e scegliamo il prossimo passo utile. Un problema alla volta.'
    ],

    philosophy: [
      'È una domanda interessante, perché dipende da cosa consideriamo davvero importante. Possiamo analizzarla da più prospettive, distinguendo le nostre intuizioni dai fatti verificabili.',
      'Non esiste sempre una risposta unica. A volte il modo migliore per affrontare una domanda è chiarire le ipotesi di partenza e capire quali conseguenze derivano da ciascuna.'
    ],

    default: [
      'Interessante. Proverei ad analizzare la questione da un’altra prospettiva: quali sono gli elementi fondamentali, cosa sappiamo già e quale risultato vogliamo ottenere?',
      'Possiamo esplorarlo. Il modo più utile per partire è individuare il punto centrale della tua richiesta e trasformarlo in qualcosa di concreto, un passaggio alla volta.',
      'Ricevuto. Ci sono diversi modi per affrontare questo tema. Possiamo partire dalle basi, approfondire gli aspetti più tecnici oppure concentrarci direttamente su una soluzione pratica.',
      'Bella domanda. Per andare oltre una risposta superficiale, conviene considerare il contesto, le possibili alternative e i compromessi coinvolti. È lì che spesso emergono le intuizioni migliori.'
    ]
  };

  const patterns = [
    {
      test: /\b(ciao|hey|ehi|salve|buongiorno|buonasera|hello|hi)\b/i,
      category: 'greetings'
    },
    {
      test: /\b(html|css|javascript|js|python|codice|programmazione|programmare|bug|debug|website|sito web|github|api|database|software|svilupp|algoritm)\b/i,
      category: 'programming'
    },
    {
      test: /\b(ai|intelligenza artificiale|machine learning|tecnologia|computer|server|rete|cyber|informatica|robot|modello linguistico)\b/i,
      category: 'technology'
    },
    {
      test: /\b(creativ|idea|invent|startup|design|progetto|immagina|crea|innovazion|concept)\b/i,
      category: 'creativity'
    },
    {
      test: /\b(futuro|futur|spazio|universo|quantistic|fisica|scienza|scientific|energia)\b/i,
      category: 'science'
    },
    {
      test: /\b(filosofia|filosof|senso della vita|coscienza|esistenza|pensiero|realtà)\b/i,
      category: 'philosophy'
    },
    {
      test: /\b(aiut|problema|difficoltà|non riesco|come faccio|spiegami|spiegare|consigli|soluzione)\b/i,
      category: 'help'
    },
    {
      test: /\b(domani|futuro|prossimi anni|innovazion|evoluzione)\b/i,
      category: 'future'
    }
  ];

  const pick = array =>
    array[Math.floor(Math.random() * array.length)];

  function generateResponse(input) {
    const normalized = input.trim();

    const match = patterns.find(item =>
      item.test.test(normalized)
    );

    const category = match ? match.category : 'default';
    let response = pick(knowledge[category]);

    const lower = normalized.toLowerCase();

    if (/\b(chi sei|cosa sei|presentati|tu chi sei)\b/.test(lower)) {
      return 'Sono Nexora, un’interfaccia sperimentale progettata per esplorare idee, ragionare sui problemi e aiutarti a sviluppare progetti. In questa versione utilizzo risposte locali predefinite: non sono collegato a un vero modello linguistico e non posso effettuare ricerche online.';
    }

    if (/\b(nexora|tuo nome|come ti chiami)\b/.test(lower)) {
      return 'NEXORA AI. Un’identità digitale pensata per unire tecnologia, creatività e un’interfaccia essenziale. Il mio obiettivo, in questa demo, è offrirti uno spazio per sperimentare.';
    }

    if (/\b(grazie|thanks|thank you)\b/.test(lower)) {
      return 'Figurati. Una buona idea è soltanto l’inizio: il bello è trasformarla in qualcosa che funziona davvero.';
    }

    if (/\b(che ore sono|ora esatta|orario)\b/.test(lower)) {
      return `L’orario locale del tuo dispositivo è ${new Date().toLocaleTimeString('it-IT')}.`;
    }

    if (/\b(che giorno è|data di oggi|data odierna)\b/.test(lower)) {
      return `La data locale del tuo dispositivo è ${new Date().toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}.`;
    }

    if (/\b(2\s*\+\s*2|quanto fa 2 più 2)\b/.test(lower)) {
      return '2 + 2 = 4. Anche i sistemi più avanzati devono saper partire dalle basi.';
    }

    if (/\b(riassumi|in breve|sintetizza)\b/.test(lower)) {
      response = 'Posso aiutarti a sintetizzare un testo, ma in questa demo non analizzo automaticamente documenti esterni. Incolla qui il contenuto e possiamo provare a lavorarci.';
    }

    return response;
  }

  /* =========================================
     STORAGE
  ========================================= */

  function loadConversations() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) return [];

      const parsed = JSON.parse(saved);

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(item =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          Array.isArray(item.messages)
        )
        .slice(0, 30);
    } catch (error) {
      console.warn('Nexora: cronologia non disponibile.', error);
      return [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.conversations.slice(0, 30))
      );
    } catch (error) {
      console.warn('Nexora: impossibile salvare la cronologia.', error);
    }
  }

  function activeConversation() {
    return state.conversations.find(
      conversation => conversation.id === state.activeId
    );
  }

  function createConversation() {
    const conversation = {
      id: makeId(),
      title: 'Nuova conversazione',
      messages: [],
      updatedAt: Date.now()
    };

    state.conversations.unshift(conversation);
    state.activeId = conversation.id;

    saveConversations();
    renderHistory();
    renderMessages();
    showView('chat');

    return conversation;
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /* =========================================
     SAFE MESSAGE RENDERING
  ========================================= */

  function appendMessageElement(role, content) {
    const wrapper = document.createElement('article');
    wrapper.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'N';

    const bubble = document.createElement('div');
    bubble.className = 'message-content';

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'YOU' : 'NEXORA CORE';

    const text = document.createElement('div');
    text.className = 'message-text';

    // User input is inserted as text, never interpreted as HTML.
    text.textContent = content;

    bubble.append(label, text);
    wrapper.append(avatar, bubble);
    elements.messages.appendChild(wrapper);

    return wrapper;
  }

  function showTyping() {
    const wrapper = document.createElement('article');
    wrapper.className = 'message assistant';
    wrapper.id = 'nexoraTyping';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'N';

    const bubble = document.createElement('div');
    bubble.className = 'message-content';

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = 'NEXORA CORE';

    const dots = document.createElement('div');
    dots.className = 'typing';
    dots.setAttribute('aria-label', 'Nexora sta elaborando');

    for (let i = 0; i < 3; i++) {
      dots.appendChild(document.createElement('span'));
    }

    bubble.append(label, dots);
    wrapper.append(avatar, bubble);
    elements.messages.appendChild(wrapper);

    scrollToBottom();
  }

  function hideTyping() {
    $('#nexoraTyping')?.remove();
  }

  function renderMessages() {
    elements.messages.replaceChildren();

    const conversation = activeConversation();
    const hasMessages = Boolean(
      conversation && conversation.messages.length
    );

    elements.welcome.classList.toggle('hidden', hasMessages);

    if (!conversation) return;

    for (const message of conversation.messages) {
      appendMessageElement(message.role, message.content);
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  /* =========================================
     CHAT LOGIC
  ========================================= */

  function updateConversationTitle(conversation, input) {
    if (conversation.messages.length !== 1) return;

    conversation.title = input.length > 30
      ? `${input.slice(0, 30).trim()}…`
      : input;
  }

  function addMessage(role, content) {
    const conversation = activeConversation();

    if (!conversation) return;

    conversation.messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    conversation.updatedAt = Date.now();

    if (role === 'user') {
      updateConversationTitle(conversation, content);
    }

    saveConversations();
    renderHistory();
    appendMessageElement(role, content);

    elements.welcome.classList.add('hidden');
    scrollToBottom();
  }

  function setBusy(busy) {
    state.typing = busy;
    elements.send.disabled = busy;
    elements.prompt.disabled = busy;

    const label = $('span', elements.send);

    if (label) {
      label.textContent = busy ? 'Attendi' : 'Invia';
    }
  }

  async function sendMessage(text) {
    const input = text.trim();

    if (!input || state.typing) return;

    if (!activeConversation()) {
      createConversation();
    }

    showView('chat');
    addMessage('user', input);
    elements.prompt.value = '';
    autoResize();

    setBusy(true);
    showTyping();

    // Simulated processing delay for the prototype.
    const delay = 550 + Math.random() * 650;

    await new Promise(resolve => setTimeout(resolve, delay));

    hideTyping();

    const response = generateResponse(input);
    addMessage('assistant', response);

    setBusy(false);
    elements.prompt.focus();
  }

  /* =========================================
     HISTORY
  ========================================= */

  function renderHistory() {
    elements.history.replaceChildren();

    const conversations = [...state.conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 15);

    if (!conversations.length) {
      const empty = document.createElement('p');
      empty.className = 'history-item';
      empty.textContent = 'Nessuna conversazione';
      elements.history.appendChild(empty);
      return;
    }

    for (const conversation of conversations) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'history-item';
      button.textContent = `◇ ${conversation.title}`;
      button.title = conversation.title;
      button.setAttribute('aria-label', `Apri ${conversation.title}`);

      if (conversation.id === state.activeId) {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        state.activeId = conversation.id;
        renderHistory();
        renderMessages();
        showView('chat');
        closeMobileMenu();
      });

      elements.history.appendChild(button);
    }
  }

  /* =========================================
     NAVIGATION
  ========================================= */

  function showView(view) {
    state.view = view;

    const isChat = view === 'chat';

    elements.chatView.classList.toggle('hidden', !isChat);
    elements.exploreView.classList.toggle('hidden', isChat);
    elements.pageName.textContent = isChat
      ? 'AI Assistant'
      : 'Esplora Nexora';

    $$('.nav-item').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    });

    closeMobileMenu();
  }

  function closeMobileMenu() {
    document.body.classList.remove('sidebar-open');
  }

  function toggleMobileMenu() {
    document.body.classList.toggle('sidebar-open');
  }

  /* =========================================
     COMPOSER
  ========================================= */

  function autoResize() {
    elements.prompt.style.height = 'auto';

    elements.prompt.style.height =
      `${Math.min(elements.prompt.scrollHeight, 150)}px`;
  }

  /* =========================================
     EVENTS
  ========================================= */

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
      createConversation();
      elements.prompt.focus();
      closeMobileMenu();
    });

    $$('.nav-item').forEach(button => {
      button.addEventListener('click', () => {
        showView(button.dataset.view);
      });
    });

    $$('[data-prompt]').forEach(button => {
      button.addEventListener('click', () => {
        const prompt = button.dataset.prompt;

        if (prompt) {
          sendMessage(prompt);
        }
      });
    });

    elements.themeToggle.addEventListener('click', () => {
      state.atmosphere = !state.atmosphere;

      document.body.classList.toggle(
        'light-atmosphere',
        state.atmosphere
      );

      elements.themeToggle.textContent =
        state.atmosphere ? '◑' : '◐';

      elements.themeToggle.setAttribute(
        'aria-label',
        state.atmosphere
          ? 'Ripristina atmosfera'
          : 'Cambia atmosfera'
      );
    });

    elements.mobileMenu.addEventListener(
      'click',
      toggleMobileMenu
    );

    document.addEventListener('click', event => {
      if (!document.body.classList.contains('sidebar-open')) {
        return;
      }

      const sidebar = $('.sidebar');

      if (
        !sidebar.contains(event.target) &&
        !elements.mobileMenu.contains(event.target)
      ) {
        closeMobileMenu();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    });
  }

  /* =========================================
     BOOT
  ========================================= */

  function init() {
    state.conversations = loadConversations();

    bindEvents();

    if (state.conversations.length) {
      state.conversations.sort(
        (a, b) => b.updatedAt - a.updatedAt
      );

      state.activeId = state.conversations[0].id;
    } else {
      createConversation();
    }

    renderHistory();
    renderMessages();
    showView('chat');
    autoResize();

    console.info(
      '%c NEXORA AI %c CORE INITIALIZED ',
      'background:#8b5cf6;color:#fff;padding:5px 9px;border-radius:4px 0 0 4px;font-weight:bold',
      'background:#101220;color:#a78bfa;padding:5px 9px;border-radius:0 4px 4px 0'
    );
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Nexora.init);


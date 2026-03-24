// ============================================================
// Plaud Coach – Skill-Driven Transcript Analysis
// ============================================================
// Extends the Ask Plaud Live UI with cos-kit skill routing.
// Upload a transcript → see available skills as buttons →
// click to run → get structured analysis results.
// Claude fallback for general questions about the transcript.
// ============================================================

(function () {
  'use strict';

  // ---------- State ----------

  let sessionId = null;
  let isProcessing = false;
  let currentMenuAnswerId = null;
  let selectedFiles = [];
  let availableSkills = [];   // ranked subset from triage
  let allSkills = [];          // full catalog for "Run another"
  let currentMode = 'cos';    // 'cos' or 'coach'
  let userSpeaker = null;     // participant label the user identified as

  // ---------- Skill icon mapping ----------

  const SKILL_ICONS = {
    'commitment-extractor': 'action',
    'meeting-risk-analysis': 'risk',
    'redteam': 'strategy',
    'execution-friction-xray': 'timeline',
    'stakeholder-analysis': 'todo',
    'decision-quality-audit': 'search',
    'effective-communication': 'speech',
  };

  const NUM_ACCENTS = 6;
  const SKILL_ACCENTS = {
    'commitment-extractor': 0,
    'meeting-risk-analysis': 1,
    'redteam': 2,
    'execution-friction-xray': 3,
    'stakeholder-analysis': 4,
    'decision-quality-audit': 5,
    'effective-communication': 0,
    'interview-analysis': 1,
  };

  function skillAccentClass(skillId, index) {
    const n = (skillId in SKILL_ACCENTS) ? SKILL_ACCENTS[skillId] : (index % NUM_ACCENTS);
    return 'skill-btn-icon--accent' + n;
  }

  /** Short, complete sentences for skill cards only (not API / routing). */
  const SKILL_UI_DESCRIPTIONS = {
    'commitment-extractor': 'Extract commitments, owners, and deadlines with evidence-backed citations.',
    'meeting-risk-analysis': 'Surface risks, tensions, and decision gaps with evidence from the meeting.',
    'redteam': 'Stress-test strategies and assumptions with adversarial, evidence-backed critique.',
    'execution-friction-xray': 'Spot execution friction and outline a concrete plan to reduce it.',
    'stakeholder-analysis': 'Map stakeholders, incentives, and engagement risks from the discussion.',
    'decision-quality-audit': 'Review how clearly decisions were made and what to improve next time.',
    'effective-communication': 'Review clarity, presence, and impact with quote-grounded feedback.',
    'interview-analysis': 'Score the interview against the rubric with evidence and a recommendation.',
  };

  function firstCompleteSentence(text) {
    if (!text || typeof text !== 'string') {
      return 'Run this analysis on your transcript.';
    }
    const t = text.trim();
    const idx = t.search(/[.!?](?=\s|$)/);
    if (idx !== -1) return t.slice(0, idx + 1).trim();
    return t;
  }

  function skillUiDescription(skill) {
    if (!skill) return '';
    if (skill.id && SKILL_UI_DESCRIPTIONS[skill.id]) {
      return SKILL_UI_DESCRIPTIONS[skill.id];
    }
    return firstCompleteSentence(skill.description);
  }

  // ---------- SVG icon templates ----------

  const ICONS = {
    timeline: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M2 8h8M2 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    strategy: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    summary: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M2 6.5h9M2 10h11M2 13.5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    action: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    risk: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 5v3.5M8 11h.007M3.5 13h9L8 3 3.5 13z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    email: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 5l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    todo: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="5" cy="4.5" r="0.8" fill="currentColor"/><circle cx="5" cy="8" r="0.8" fill="currentColor"/><circle cx="5" cy="11.5" r="0.8" fill="currentColor"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.4"/><path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    speech: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V11H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 7.5L8 3.5l2 4M8 3.5V10M3.5 10a4.5 4.5 0 009 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 11V3.5A.5.5 0 013.5 3H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    more: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="8" r="1.2" fill="currentColor"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    default: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M6 8h4M8 6v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
  };

  // ---------- DOM references ----------

  const appFrame = document.querySelector('.app-frame');
  const uploadScreen = document.getElementById('upload-screen');
  const chatArea = document.getElementById('chat-area');
  const messagesEl = document.getElementById('messages');
  const inputField = document.getElementById('input-field');
  const inputBar = document.getElementById('input-bar');
  const btnSend = document.getElementById('btn-send');
  const btnClear = document.getElementById('btn-clear');
  const modalOverlay = document.getElementById('modal-overlay');
  const btnConfirmClear = document.getElementById('btn-confirm-clear');
  const btnCancelClear = document.getElementById('btn-cancel-clear');
  const toastEl = document.getElementById('toast');
  const actionsMenuOverlay = document.getElementById('actions-menu-overlay');
  const actionsMenu = document.getElementById('actions-menu');
  const chipBar = document.getElementById('chip-bar');
  const chipScroll = document.getElementById('chip-scroll');

  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  const btnBrowse = document.getElementById('btn-browse');
  const fileListEl = document.getElementById('upload-file-list');
  const btnAnalyze = document.getElementById('btn-analyze');
  const analyzeBtnText = btnAnalyze.querySelector('.upload-btn-text');
  const analyzeBtnLoading = btnAnalyze.querySelector('.upload-btn-loading');
  const modeToggle = document.getElementById('mode-toggle');

  // ---------- API calls ----------

  async function apiUpload(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('mode', currentMode);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }

  async function apiChat(message, type = 'freetext') {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, type })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  // ---------- Mode toggle ----------

  if (modeToggle) {
    modeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-option');
      if (!btn || btn.classList.contains('mode-option--active')) return;
      currentMode = btn.dataset.mode;
      modeToggle.querySelectorAll('.mode-option').forEach(b => b.classList.remove('mode-option--active'));
      btn.classList.add('mode-option--active');
    });
  }

  // ---------- Upload screen ----------

  function updateFileList() {
    fileListEl.innerHTML = '';
    selectedFiles.forEach((file, i) => {
      const item = createEl('div', 'upload-file-item');
      const icon = file.name.endsWith('.pdf') ? '📄' : '📝';
      item.innerHTML = `
        <span class="file-item-name">${icon} ${escapeHtml(file.name)}</span>
        <button class="file-item-remove" data-index="${i}" aria-label="Remove">&times;</button>
      `;
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        selectedFiles.splice(i, 1);
        updateFileList();
      });
      fileListEl.appendChild(item);
    });
    btnAnalyze.disabled = selectedFiles.length === 0;
  }

  function setAnalyzeButtonState(isAnalyzing) {
    analyzeBtnText.hidden = isAnalyzing;
    analyzeBtnLoading.hidden = !isAnalyzing;
    btnAnalyze.disabled = isAnalyzing || selectedFiles.length === 0;
  }

  function addFiles(fileList) {
    for (const f of fileList) {
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.pdf') || ext.endsWith('.txt')) {
        if (!selectedFiles.some(sf => sf.name === f.name && sf.size === f.size)) {
          selectedFiles.push(f);
        }
      }
    }
    updateFileList();
  }

  btnBrowse.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  btnAnalyze.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || isProcessing) return;
    isProcessing = true;
    setAnalyzeButtonState(true);

    try {
      const data = await apiUpload(selectedFiles);
      sessionId = data.sessionId;
      availableSkills = data.skills || [];
      allSkills = data.allSkills || data.skills || [];
      const participants = data.participants || [];
      const named = participants.filter(p => !/^speaker\s*\d+$/i.test(p.trim()));
      if (named.length > 0) {
        transitionToSpeakerSelection(data.greeting, named, availableSkills, allSkills);
      } else {
        transitionToChat('Here\'s what I can analyze:', availableSkills, allSkills);
      }
    } catch (err) {
      showToast('Error: ' + err.message, 4000);
      setAnalyzeButtonState(false);
    }

    isProcessing = false;
  });

  // ---------- Screen transition ----------

  function transitionToChat(greeting, suggestedSkills, fullCatalog) {
    uploadScreen.hidden = true;
    chatArea.hidden = false;
    chipBar.hidden = false;
    inputBar.hidden = false;
    renderSkillGrid(greeting, suggestedSkills);
    const chipsCatalog = fullCatalog && fullCatalog.length ? fullCatalog : suggestedSkills;
    populateChipBar(chipsCatalog);
    inputField.focus();
  }

  function transitionToSpeakerSelection(greeting, participants, suggestedSkills, fullCatalog) {
    uploadScreen.hidden = true;
    chatArea.hidden = false;

    const wrapper = createEl('div', 'msg msg-ai');

    const greetText = createEl('div', 'greeting-text');
    greetText.innerHTML = greeting;
    wrapper.appendChild(greetText);

    const prompt = createEl('p', 'speaker-prompt',
      'First, I need to identify who you are in the conversation to best provide insight.');
    wrapper.appendChild(prompt);

    const chips = createEl('div', 'speaker-chips');
    participants.forEach(name => {
      const chip = createEl('button', 'speaker-chip', escapeHtml(name));
      chip.addEventListener('click', () => {
        handleSpeakerSelection(name, suggestedSkills, fullCatalog);
      });
      chips.appendChild(chip);
    });
    wrapper.appendChild(chips);

    messagesEl.appendChild(wrapper);
  }

  async function handleSpeakerSelection(speaker, suggestedSkills, fullCatalog) {
    if (isProcessing) return;
    isProcessing = true;

    renderUserMessage(speaker);
    userSpeaker = speaker;

    try {
      await fetch('/api/identify-speaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, speaker })
      });
    } catch { /* best-effort — session already stores it on success */ }

    chipBar.hidden = false;
    inputBar.hidden = false;
    renderSkillGrid('Got it! Here are a few things I can help with:', suggestedSkills);
    const chipsCatalog = fullCatalog && fullCatalog.length ? fullCatalog : suggestedSkills;
    populateChipBar(chipsCatalog);
    inputField.focus();

    isProcessing = false;
  }

  // ---------- Rendering helpers ----------

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    });
  }

  function createEl(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }

  function showToast(text, duration = 2000) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { toastEl.hidden = true; }, duration);
  }

  // ---------- Markdown → HTML (for skill insight output) ----------

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Close list if this line isn't a bullet
      if (inList && !trimmed.startsWith('- ')) {
        html += '</ul>';
        inList = false;
      }

      if (trimmed.startsWith('## ')) {
        html += '<h3>' + inlineMd(trimmed.slice(3)) + '</h3>';
      } else if (trimmed.startsWith('### ')) {
        html += '<h4>' + inlineMd(trimmed.slice(4)) + '</h4>';
      } else if (trimmed.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inlineMd(trimmed.slice(2)) + '</li>';
      } else if (trimmed.startsWith('→ ') || trimmed.startsWith('→')) {
        html += '<p class="arrow-line">' + inlineMd(trimmed) + '</p>';
      } else if (trimmed.length > 0) {
        html += '<p>' + inlineMd(trimmed) + '</p>';
      }
    }

    if (inList) html += '</ul>';
    return html;
  }

  function inlineMd(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // ---------- Render: Skill grid (after upload) ----------

  function renderSkillGrid(greeting, skills) {
    const wrapper = createEl('div', 'msg msg-ai');

    const greetingHtml = greeting || 'Your transcript is ready. Here\'s what I can analyze:';
    const greetText = createEl('div', 'greeting-text');
    greetText.innerHTML = greetingHtml; // greeting may contain <strong> tags from server
    wrapper.appendChild(greetText);

    const grid = createEl('div', 'skill-grid');

    skills.forEach((s, i) => {
      const btn = createEl('button', 'skill-btn');
      const iconKey = SKILL_ICONS[s.id] || 'default';
      const accent = skillAccentClass(s.id, i);
      btn.innerHTML = `
        <span class="skill-btn-icon ${accent}">${ICONS[iconKey] || ICONS.default}</span>
        <div class="skill-btn-text">
          <span class="skill-btn-label">${escapeHtml(s.label)}</span>
          <span class="skill-btn-desc">${escapeHtml(skillUiDescription(s))}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        if (!isProcessing) handleSkillExecution(s.command, s.label);
      });
      grid.appendChild(btn);
    });

    wrapper.appendChild(grid);

    const skillHint = createEl('div', 'skill-grid-hint');
    skillHint.appendChild(document.createTextNode('Think of me as your personal coach. If you have a question, '));
    const skillHintStrong = document.createElement('strong');
    skillHintStrong.textContent = 'I can help you think through it together';
    skillHint.appendChild(skillHintStrong);
    skillHint.appendChild(document.createTextNode(" and recommend frameworks. What's top of mind?"));
    wrapper.appendChild(skillHint);

    messagesEl.appendChild(wrapper);
  }

  // ---------- Populate chip bar with skills ----------

  function populateChipBar(skills) {
    chipScroll.innerHTML = '';
    skills.forEach((s, i) => {
      const iconKey = SKILL_ICONS[s.id] || 'default';
      const accent = skillAccentClass(s.id, i);
      const chip = createEl('button', 'chip chip-skill');
      chip.type = 'button';
      const iconSpan = createEl('span', 'chip-icon skill-btn-icon ' + accent);
      iconSpan.innerHTML = ICONS[iconKey] || ICONS.default;
      const labelSpan = createEl('span', 'chip-label', escapeHtml(s.label));
      chip.appendChild(iconSpan);
      chip.appendChild(labelSpan);
      chip.addEventListener('click', () => {
        if (!isProcessing) handleSkillExecution(s.command, s.label);
      });
      chipScroll.appendChild(chip);
    });
  }

  // ---------- Skill execution ----------

  async function handleSkillExecution(command, label) {
    if (isProcessing) return;
    isProcessing = true;
    appFrame.classList.add('processing');

    renderUserMessage(label);
    const pendingThinkingState = renderThinkingPending({ skillSlowHint: true });

    try {
      const response = await apiChat(command, 'skill-summary');

      clearThinkingPending(pendingThinkingState);

      if (response.type === 'skill-summary') {
        renderSkillSummary(response.content, command, label);
      } else if (response.type === 'error') {
        renderError(response.error);
      } else {
        renderError('Unexpected response');
      }
    } catch (err) {
      cleanupThinkingOnError(pendingThinkingState);
      renderError(err.message);
    }

    isProcessing = false;
    appFrame.classList.remove('processing');
  }

  async function handleDeepAnalysis(command, label, deepBtn) {
    if (isProcessing) return;
    isProcessing = true;
    appFrame.classList.add('processing');

    deepBtn.disabled = true;
    deepBtn.textContent = 'Running\u2026';

    const pendingThinkingState = renderThinkingPending({ skillSlowHint: true });

    try {
      const response = await apiChat(command, 'skill');

      clearThinkingPending(pendingThinkingState);

      if (response.type === 'skill-result') {
        renderSkillInsight(response.content);
      } else if (response.type === 'error') {
        renderError(response.error);
      } else {
        renderError('Unexpected response');
      }
    } catch (err) {
      cleanupThinkingOnError(pendingThinkingState);
      renderError(err.message);
    }

    isProcessing = false;
    appFrame.classList.remove('processing');
  }

  // ---------- Render: Skill summary (quick ~500-word overview) ----------

  function renderSkillSummary(markdownContent, command, label) {
    const wrapper = createEl('div', 'msg msg-ai');
    const answerId = 'answer-' + Date.now();

    const insightBlock = createEl('div', 'skill-insight');
    insightBlock.id = answerId;
    insightBlock.innerHTML = renderMarkdown(markdownContent);
    wrapper.appendChild(insightBlock);

    const actions = createEl('div', 'answer-actions');
    const copyBtn = createEl('button', 'answer-action-btn', ICONS.copy);
    copyBtn.title = 'Copy';
    const shareBtn = createEl('button', 'answer-action-btn', ICONS.share);
    shareBtn.title = 'Share';
    const moreBtn = createEl('button', 'answer-action-btn', ICONS.more);
    moreBtn.title = 'More options';

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(insightBlock.innerText).then(() => showToast('Copied to clipboard'));
    });

    shareBtn.addEventListener('click', async () => {
      const plainText = insightBlock.innerText;
      if (navigator.share) {
        try { await navigator.share({ text: plainText }); showToast('Shared'); return; } catch { /* canceled */ }
      }
      navigator.clipboard.writeText(plainText).then(() => showToast('Copied for sharing'));
    });

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentMenuAnswerId = answerId;
      actionsMenuOverlay.hidden = false;
    });

    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(moreBtn);
    wrapper.appendChild(actions);

    // Deep-analysis CTA
    const ctaText = createEl('p', 'deep-analysis-cta',
      'If you\u2019d like, I can perform a deeper analysis. It will take a bit more time, but will have more granularity and cite specific quotes from your conversation as evidence.');
    wrapper.appendChild(ctaText);

    const fuContainer = createEl('div', 'follow-ups');

    const deepBtn = createEl('button', 'follow-up-btn deep-analysis-btn', 'Start Deep Analysis');
    deepBtn.addEventListener('click', () => {
      if (!isProcessing) handleDeepAnalysis(command, label, deepBtn);
    });
    fuContainer.appendChild(deepBtn);

    const runAnotherBtn = createEl('button', 'follow-up-btn', 'Run another analysis');
    runAnotherBtn.addEventListener('click', () => {
      if (!isProcessing) renderSkillGrid('Pick another analysis to run:', allSkills.length > 0 ? allSkills : availableSkills);
    });
    fuContainer.appendChild(runAnotherBtn);

    wrapper.appendChild(fuContainer);
    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: Skill insight (markdown output) ----------

  function renderSkillInsight(markdownContent) {
    const wrapper = createEl('div', 'msg msg-ai');
    const answerId = 'answer-' + Date.now();

    const insightBlock = createEl('div', 'skill-insight');
    insightBlock.id = answerId;
    insightBlock.innerHTML = renderMarkdown(markdownContent);
    wrapper.appendChild(insightBlock);

    // Actions bar (copy/share/more)
    const actions = createEl('div', 'answer-actions');
    const copyBtn = createEl('button', 'answer-action-btn', ICONS.copy);
    copyBtn.title = 'Copy';
    const shareBtn = createEl('button', 'answer-action-btn', ICONS.share);
    shareBtn.title = 'Share';
    const moreBtn = createEl('button', 'answer-action-btn', ICONS.more);
    moreBtn.title = 'More options';

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(insightBlock.innerText).then(() => showToast('Copied to clipboard'));
    });

    shareBtn.addEventListener('click', async () => {
      const plainText = insightBlock.innerText;
      if (navigator.share) {
        try { await navigator.share({ text: plainText }); showToast('Shared'); return; } catch { /* canceled */ }
      }
      navigator.clipboard.writeText(plainText).then(() => showToast('Copied for sharing'));
    });

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentMenuAnswerId = answerId;
      actionsMenuOverlay.hidden = false;
    });

    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(moreBtn);
    wrapper.appendChild(actions);

    // "Run another analysis" button
    const runAnotherBtn = createEl('button', 'follow-up-btn', 'Run another analysis');
    runAnotherBtn.addEventListener('click', () => {
      if (!isProcessing) renderSkillGrid('Pick another analysis to run:', allSkills.length > 0 ? allSkills : availableSkills);
    });
    const fuContainer = createEl('div', 'follow-ups');
    fuContainer.appendChild(runAnotherBtn);
    wrapper.appendChild(fuContainer);

    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: Router suggestion buttons ----------

  function renderSuggestionButtons(suggestions) {
    const wrapper = createEl('div', 'msg msg-ai');

    const text = createEl('div', 'greeting-text',
      suggestions.length === 1
        ? 'I think this skill can help:'
        : 'A few skills might help here:');
    wrapper.appendChild(text);

    const container = createEl('div', 'suggest-inline');

    suggestions.forEach((s, i) => {
      const btn = createEl('button', 'suggest-inline-btn');
      const iconKey = SKILL_ICONS[s.skillId] || 'default';
      const accent = skillAccentClass(s.skillId, i);
      btn.innerHTML = `
        <span class="skill-btn-icon ${accent}">${ICONS[iconKey] || ICONS.default}</span>
        <div class="skill-btn-text">
          <span class="skill-btn-label">${escapeHtml(s.label)}</span>
          <span class="skill-btn-desc">${escapeHtml(skillUiDescription(s))}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        if (!isProcessing) handleSkillExecution(s.command, s.label);
      });
      container.appendChild(btn);
    });

    wrapper.appendChild(container);
    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: Clarify message ----------

  function renderClarifyMessage(question) {
    const wrapper = createEl('div', 'msg msg-ai');
    const block = createEl('div', 'greeting-text', escapeHtml(question));
    wrapper.appendChild(block);
    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: User message ----------

  function renderUserMessage(text) {
    const wrapper = createEl('div', 'msg msg-user');
    const bubble = createEl('div', 'msg-user-bubble', escapeHtml(text));
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: Thinking animation ----------

  function renderThinking(pendingState, thinkingSteps) {
    const duration = Math.max(2000, thinkingSteps.length * 1200);

    return new Promise(resolve => {
      const {
        wrapper,
        block,
        header,
        toggle,
        label,
        dots,
        timer,
        stepsContainer,
        startTime,
        timerInterval,
      } = pendingState;

      clearTimeout(pendingState.wordTimeout);
      const slowHintNode = block.querySelector('.thinking-skill-slow-hint');
      if (slowHintNode) slowHintNode.remove();
      if (pendingState.slowHintEl) pendingState.slowHintEl = null;
      toggle.style.visibility = 'visible';
      header.classList.remove('thinking-header-pending');
      block.classList.add('thinking-promote');
      stepsContainer.innerHTML = '';
      thinkingSteps.forEach(stepData => {
        const step = createEl('div', 'thinking-step');
        const stepTitle = createEl('div', 'thinking-step-title', typeof stepData === 'string' ? stepData : stepData.title);
        step.appendChild(stepTitle);

        if (typeof stepData !== 'string' && stepData.detail) {
          const stepDetail = createEl('div', 'thinking-step-detail', stepData.detail);
          step.appendChild(stepDetail);
        }

        stepsContainer.appendChild(step);
      });

      let isOpen = false;
      if (!pendingState.hasBoundToggle) {
        header.addEventListener('click', () => {
          isOpen = !isOpen;
          toggle.classList.toggle('expanded', isOpen);
          stepsContainer.classList.toggle('open', isOpen);
        });
        pendingState.hasBoundToggle = true;
      }

      const stepEls = stepsContainer.querySelectorAll('.thinking-step');
      const stepInterval = duration / (thinkingSteps.length + 1);
      let currentStep = 0;

      const stepTimer = setInterval(() => {
        if (currentStep < stepEls.length) {
          stepEls[currentStep].classList.add('active');
          currentStep++;
        }
      }, stepInterval);

      setTimeout(() => {
        clearInterval(timerInterval);
        clearInterval(stepTimer);
        stepEls.forEach(s => s.classList.add('active'));

        dots.remove();
        label.textContent = label.textContent + ' complete';
        block.classList.add('thinking-complete');

        const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        timer.textContent = `${finalElapsed}s`;

        resolve(wrapper);
      }, duration);
    });
  }

  const THINKING_WORDS = [
    { text: 'Thinking', delay: 5000 },
    { text: 'Analyzing', delay: 3000 },
    { text: 'Evaluating', delay: 3000 },
    { text: 'Processing', delay: 3000 },
    { text: 'Scoring', delay: 3000 },
    { text: 'Synthesizing', delay: 3000 },
  ];

  function renderThinkingPending(options) {
    const opts = options || {};
    const wrapper = createEl('div', 'msg msg-ai');
    const block = createEl('div', 'thinking-block');
    const header = createEl('div', 'thinking-header');
    const toggle = createEl('span', 'thinking-toggle', ICONS.chevron);
    const label = createEl('span', 'thinking-label', 'Thinking');
    const dots = createEl('span', 'thinking-dots', '<span></span><span></span><span></span>');
    const timer = createEl('span', 'thinking-timer', '0s');
    const stepsContainer = createEl('div', 'thinking-steps');
    const startTime = Date.now();

    wrapper.style.width = '100%';
    header.classList.add('thinking-header-pending');
    toggle.style.visibility = 'hidden';
    timer.style.marginLeft = 'auto';
    header.appendChild(toggle);
    header.appendChild(label);
    header.appendChild(dots);
    header.appendChild(timer);
    block.appendChild(header);
    block.appendChild(stepsContainer);
    let slowHintEl = null;
    if (opts.skillSlowHint) {
      slowHintEl = createEl('p', 'thinking-skill-slow-hint');
      slowHintEl.textContent =
        "I'm taking extra time to best answer your question. This may take a minute";
      block.appendChild(slowHintEl);
    }
    wrapper.appendChild(block);
    messagesEl.appendChild(wrapper);
    const timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      timer.textContent = `${elapsed}s`;
    }, 500);

    let wordIndex = 0;
    let wordTimeout = null;
    function scheduleNextWord() {
      wordTimeout = setTimeout(() => {
        wordIndex = (wordIndex + 1) % THINKING_WORDS.length;
        label.classList.remove('word-wipe');
        void label.offsetWidth;
        label.textContent = THINKING_WORDS[wordIndex].text;
        label.classList.add('word-wipe');
        scheduleNextWord();
      }, THINKING_WORDS[wordIndex].delay);
    }
    scheduleNextWord();

    return {
      wrapper,
      block,
      header,
      toggle,
      label,
      dots,
      timer,
      stepsContainer,
      startTime,
      timerInterval,
      wordTimeout,
      hasBoundToggle: false,
      slowHintEl,
    };
  }

  // ---------- Thinking cleanup helpers ----------

  function removeSkillSlowHint(pendingState) {
    if (!pendingState || !pendingState.slowHintEl) return;
    if (pendingState.slowHintEl.parentNode) {
      pendingState.slowHintEl.remove();
    }
    pendingState.slowHintEl = null;
  }

  function clearThinkingPending(pendingState) {
    if (!pendingState) return;
    removeSkillSlowHint(pendingState);
    clearTimeout(pendingState.wordTimeout);
    clearInterval(pendingState.timerInterval);
    if (pendingState.wrapper && pendingState.wrapper.parentNode) {
      pendingState.wrapper.remove();
    }
  }

  function cleanupThinkingOnError(pendingState) {
    if (!pendingState) return;
    removeSkillSlowHint(pendingState);
    clearInterval(pendingState.timerInterval);
    clearTimeout(pendingState.wordTimeout);
    if (pendingState.wrapper && pendingState.wrapper.parentNode) {
      pendingState.wrapper.remove();
    }
  }

  // ---------- Render: AI answer (Claude fallback) ----------

  function renderAnswer(answerHtml, followUps) {
    const wrapper = createEl('div', 'msg msg-ai');
    const answerId = 'answer-' + Date.now();

    const answerBlock = createEl('div', 'answer-block', answerHtml);
    answerBlock.id = answerId;
    wrapper.appendChild(answerBlock);

    const generateBtn = createEl('button', 'generate-more-btn', 'Generate more details');
    generateBtn.addEventListener('click', () => {
      if (!isProcessing) handleUserMessage('Expand on your previous answer with more detail', 'freetext');
    });
    wrapper.appendChild(generateBtn);

    const actions = createEl('div', 'answer-actions');
    const copyBtn = createEl('button', 'answer-action-btn', ICONS.copy);
    copyBtn.title = 'Copy';
    const shareBtn = createEl('button', 'answer-action-btn', ICONS.share);
    shareBtn.title = 'Share';
    const moreBtn = createEl('button', 'answer-action-btn', ICONS.more);
    moreBtn.title = 'More options';

    copyBtn.addEventListener('click', () => {
      const plainText = answerBlock.innerText;
      navigator.clipboard.writeText(plainText).then(() => showToast('Copied to clipboard'));
    });

    shareBtn.addEventListener('click', async () => {
      const plainText = answerBlock.innerText;
      if (navigator.share) {
        try {
          await navigator.share({ text: plainText });
          showToast('Shared');
          return;
        } catch {
          // User canceled share dialog; no action needed.
        }
      }
      navigator.clipboard.writeText(plainText).then(() => showToast('Copied for sharing'));
    });

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentMenuAnswerId = answerId;
      actionsMenuOverlay.hidden = false;
    });

    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(moreBtn);
    wrapper.appendChild(actions);

    if (followUps && followUps.length > 0) {
      const fuContainer = createEl('div', 'follow-ups');
      const fuLabel = createEl('div', 'follow-ups-label', 'Keep asking');
      fuContainer.appendChild(fuLabel);

      followUps.forEach(fuText => {
        const fuBtn = createEl('button', 'follow-up-btn', escapeHtml(fuText));
        fuBtn.addEventListener('click', () => {
          if (!isProcessing) handleUserMessage(fuText, 'freetext');
        });
        fuContainer.appendChild(fuBtn);
      });

      wrapper.appendChild(fuContainer);
    }

    messagesEl.appendChild(wrapper);
  }

  // ---------- Render: Error state ----------

  function renderError(message) {
    const wrapper = createEl('div', 'msg msg-ai');
    const errorBlock = createEl('div', 'error-block');
    errorBlock.innerHTML = `<p>${escapeHtml(message || 'Something went wrong.')}</p><button class="retry-btn">Try again</button>`;
    errorBlock.querySelector('.retry-btn').addEventListener('click', () => {
      wrapper.remove();
    });
    wrapper.appendChild(errorBlock);
    messagesEl.appendChild(wrapper);
  }

  // ---------- Core message handler (freetext + polymorphic response) ----------

  async function handleUserMessage(text, type = 'freetext') {
    if (isProcessing || !text.trim()) return;
    isProcessing = true;
    appFrame.classList.add('processing');
    inputField.value = '';
    autoResize();
    updateSendButton();

    renderUserMessage(text.trim());
    scrollToBottom();
    const pendingThinkingState = renderThinkingPending();

    try {
      const response = await apiChat(text.trim(), type);

      switch (response.type) {
        case 'suggest':
          // Router suggests skills — show as buttons
          clearThinkingPending(pendingThinkingState);
          renderSuggestionButtons(response.suggestions);
          break;

        case 'clarify':
          // Router needs clarification
          clearThinkingPending(pendingThinkingState);
          renderClarifyMessage(response.question);
          break;

        case 'skill-result':
          // Skill executed directly
          clearThinkingPending(pendingThinkingState);
          renderSkillInsight(response.content);
          break;

        case 'chat':
          // Claude fallback — standard thinking + answer flow
          if (response.thinking && response.thinking.length > 0) {
            await renderThinking(pendingThinkingState, response.thinking);
          } else {
            clearThinkingPending(pendingThinkingState);
          }
          renderAnswer(response.answer, response.followUps);
          break;

        case 'error':
          clearThinkingPending(pendingThinkingState);
          renderError(response.error);
          break;

        default:
          clearThinkingPending(pendingThinkingState);
          renderError('Unexpected response from server');
      }
    } catch (err) {
      cleanupThinkingOnError(pendingThinkingState);
      renderError(err.message);
    }

    isProcessing = false;
    appFrame.classList.remove('processing');
  }

  // ---------- Input handling ----------

  function autoResize() {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
  }

  function updateSendButton() {
    btnSend.disabled = !inputField.value.trim() || isProcessing;
  }

  inputField.addEventListener('input', () => {
    autoResize();
    updateSendButton();
  });

  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputField.value.trim() && !isProcessing) {
        handleUserMessage(inputField.value);
      }
    }
  });

  btnSend.addEventListener('click', () => {
    if (inputField.value.trim() && !isProcessing) {
      handleUserMessage(inputField.value);
    }
  });

  // ---------- Clear chat ----------

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (messagesEl.children.length === 0) return;
      modalOverlay.hidden = false;
    });

    btnConfirmClear.addEventListener('click', () => {
      messagesEl.innerHTML = '';
      modalOverlay.hidden = true;
      showToast('Messages cleared');
      // Return to upload screen
      chatArea.hidden = true;
      chipBar.hidden = true;
      inputBar.hidden = true;
      uploadScreen.hidden = false;
      sessionId = null;
      availableSkills = [];
      selectedFiles = [];
      updateFileList();
      setAnalyzeButtonState(false);
    });

    btnCancelClear.addEventListener('click', () => {
      modalOverlay.hidden = true;
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.hidden = true;
    });
  }

  // ---------- Actions menu ----------

  actionsMenuOverlay.addEventListener('click', (e) => {
    if (e.target === actionsMenuOverlay) {
      actionsMenuOverlay.hidden = true;
      currentMenuAnswerId = null;
    }
  });

  actionsMenu.querySelectorAll('.actions-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      actionsMenuOverlay.hidden = true;

      switch (action) {
        case 'share':
          showToast('Share — not yet implemented');
          break;
        case 'add-to-summary':
          showToast('Inserted successfully');
          break;
        case 'expand-answer':
          if (!isProcessing) handleUserMessage('Expand on your previous answer with more detail', 'freetext');
          break;
        case 'shorter-answer':
          if (!isProcessing) handleUserMessage('Give a shorter version of your previous answer', 'freetext');
          break;
        case 'helpful':
          showToast('Thanks for the feedback!');
          break;
        case 'not-helpful':
          showToast('Feedback recorded');
          break;
      }

      currentMenuAnswerId = null;
    });
  });

  // ---------- Utility ----------

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Init ----------

  setAnalyzeButtonState(false);

})();

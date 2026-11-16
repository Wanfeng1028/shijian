(function () {
  'use strict';

  var TASK_META = {
    reading: {
      label: '史料阅读',
      desc: '按步骤引导提取史料关键信息、联系教材知识、生成巩固题。',
      welcome: '你好，我是史鉴。先把你手头的史料发给我，或者选一个主题，我们先一起观察：你发现了什么？',
      quick: [
        '这段史料里最值得注意的细节是什么？',
        '这段史料和课本里的哪一课有联系？',
        '请帮我提炼这段史料的关键信息'
      ]
    },
    analysis: {
      label: '史料辨析',
      desc: '分析史料来源、作者、立场、价值与局限，给出简洁结论。',
      welcome: '你好，我是史鉴。把需要辨析的史料发给我，我们先看它是谁写的、在什么时候、为什么而写。',
      quick: [
        '这段史料的作者是谁？立场可能是什么？',
        '这段史料有什么价值，又有什么局限？',
        '这段史料可信吗？依据是什么？'
      ]
    },
    explanation: {
      label: '历史解释',
      desc: '按「明确问题-梳理背景-提取证据-分析逻辑-形成解释-迁移训练」结构展开。',
      welcome: '你好，我是史鉴。先告诉我你想解释的历史问题，我们按“明确问题—梳理背景—提取证据—分析逻辑—形成解释—迁移训练”一步步来。',
      quick: [
        '为什么会发生鸦片战争？',
        '新航路开辟带来了哪些变化？',
        '如何评价洋务运动？'
      ]
    }
  };

  function getQueryParam(name) {
    var query = window.location.search || '';
    var pairs = query.replace(/^[?&]/, '').split('&');
    var i;
    var pair;
    var index;
    var key;
    var value;

    for (i = 0; i < pairs.length; i++) {
      pair = pairs[i];
      if (!pair) {
        continue;
      }

      index = pair.indexOf('=');
      key = index >= 0 ? pair.slice(0, index) : pair;
      value = index >= 0 ? pair.slice(index + 1) : '';

      if (key === name) {
        try {
          return decodeURIComponent(value.replace(/\+/g, ' '));
        } catch (e) {
          return value;
        }
      }
    }

    return '';
  }

  function getInitialTask() {
    var urlTask = getQueryParam('task');
    var storedTask = '';

    try {
      storedTask = window.sessionStorage.getItem('shijian_task') || '';
    } catch (e) {
      storedTask = '';
    }

    if (TASK_META[urlTask]) {
      return urlTask;
    }

    if (TASK_META[storedTask]) {
      return storedTask;
    }

    return 'reading';
  }

  var currentTask = getInitialTask();
  var messages = [];
  var pendingImage = null;
  var pendingDocText = '';

  function updateTaskDesc() {
    var descEl = document.querySelector('#shijian-task-desc');
    var meta = TASK_META[currentTask];

    if (descEl && meta) {
      descEl.textContent = meta.desc;
    }
  }

  function scrollMessagesToBottom() {
    var listEl = document.querySelector('#shijian-messages');
    var lastEl;

    if (!listEl || !listEl.lastElementChild) {
      return;
    }

    lastEl = listEl.lastElementChild;

    try {
      lastEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (e) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }

  function addMessage(role, text) {
    var listEl = document.querySelector('#shijian-messages');
    var messageEl;
    var content = String(text);
    var parts;
    var i;
    var pEl;

    if (!listEl) {
      return;
    }

    messageEl = document.createElement('div');
    messageEl.className = role === 'user'
      ? 'shijian-message shijian-message--user'
      : 'shijian-message shijian-message--ai';

    if (role === 'user') {
      messageEl.textContent = content;
    } else {
      parts = content.split('\n\n');
      for (i = 0; i < parts.length; i++) {
        pEl = document.createElement('p');
        pEl.textContent = parts[i];
        messageEl.appendChild(pEl);
      }
    }

    messages.push({ role: role, content: content });
    listEl.appendChild(messageEl);
    scrollMessagesToBottom();
  }

  function renderQuick() {
    var boxEl = document.querySelector('#shijian-quick-questions');
    var meta = TASK_META[currentTask];
    var i;
    var question;
    var chipEl;

    if (!boxEl || !meta) {
      return;
    }

    boxEl.innerHTML = '';

    for (i = 0; i < meta.quick.length; i++) {
      question = meta.quick[i];

      (function (questionText) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'shijian-chip';
        button.setAttribute('data-question', questionText);
        button.textContent = questionText;

        button.addEventListener('click', function () {
          var inputEl = document.querySelector('#shijian-input');

          if (inputEl) {
            inputEl.value = questionText;
          }

          sendMessage();
        });

        boxEl.appendChild(button);
      })(question);
    }
  }

  function bindTaskTabs() {
    var tabEls = document.querySelectorAll('[data-task]');
    var i;

    for (i = 0; i < tabEls.length; i++) {
      tabEls[i].addEventListener('click', function () {
        var task = this.getAttribute('data-task');
        var meta = TASK_META[task];

        if (!meta) {
          return;
        }

        currentTask = task;

        try {
          window.sessionStorage.setItem('shijian_task', currentTask);
        } catch (e) {}

        updateTaskDesc();
        renderQuick();
        addMessage('ai', meta.welcome);
      });
    }
  }

  function init() {
    var profile = {};
    var gradeEl;
    var textbookEl;

    try {
      profile = window.ShijianStore.loadProfile() || {};
    } catch (e) {
      profile = {};
    }

    gradeEl = document.querySelector('#shijian-grade');
    textbookEl = document.querySelector('#shijian-textbook');

    if (gradeEl) {
      gradeEl.value = profile.grade || '';
    }

    if (textbookEl) {
      textbookEl.value = profile.textbook || '';
    }

    updateTaskDesc();
    addMessage('ai', TASK_META[currentTask].welcome);
    renderQuick();
    bindTaskTabs();
  }

  document.addEventListener('DOMContentLoaded', init);

function setStatus(text) {
  document.getElementById('shijian-status').textContent = text;
}

function shijianGetMessagesContainer() {
  return document.getElementById('shijian-messages') ||
    document.querySelector('.shijian-messages') ||
    document.querySelector('.shijian-message-list') ||
    (function () {
      const existing = document.querySelector('.shijian-message');
      return existing ? existing.parentNode : null;
    })();
}

function shijianRenderStreamBubble(bubble, content) {
  bubble.textContent = '';
  String(content).split('\n\n').forEach(function (part) {
    const p = document.createElement('p');
    p.textContent = part;
    bubble.appendChild(p);
  });
}

function shijianCreateStreamBubble() {
  const bubble = document.createElement('div');
  bubble.className = 'shijian-message shijian-message--ai';
  shijianRenderStreamBubble(bubble, '史鉴正在思考…');

  const container = shijianGetMessagesContainer();
  if (container) container.appendChild(bubble);
  scrollMessagesToBottom();

  return bubble;
}

async function sendMessage() {
  const input = document.getElementById('shijian-input');
  const sendBtn = document.getElementById('shijian-send');
  const text = input.value.trim();

  if (!text) return;

  addMessage('user', text);
  input.value = '';
  sendBtn.disabled = true;
  setStatus('史鉴正在思考…');

  const body = {
    action: 'chat',
    task: currentTask,
    grade: document.getElementById('shijian-grade').value,
    textbook: document.getElementById('shijian-textbook').value,
    topic: document.getElementById('shijian-topic').value,
    messages: messages.slice(-10)
  };

  if (pendingImage) body.imageData = pendingImage;
  if (pendingDocText) body.docText = pendingDocText;

  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let succeeded = false;
    let fatalError = false;
    let streamBubble = null;
    const controller = new AbortController();
    let stallTimerId = null;

    const armStallTimer = function () {
      if (stallTimerId !== null) clearTimeout(stallTimerId);
      stallTimerId = setTimeout(function () {
        controller.abort();
      }, 45000);
    };

    const clearStallTimer = function () {
      if (stallTimerId !== null) {
        clearTimeout(stallTimerId);
        stallTimerId = null;
      }
    };

    const removeStreamBubble = function () {
      if (streamBubble && streamBubble.parentNode) {
        streamBubble.parentNode.removeChild(streamBubble);
      }
    };

    if (attempt > 0) {
      input.value = '';
      setStatus('史鉴正在思考…');
    }

    streamBubble = shijianCreateStreamBubble();
    armStallTimer();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.indexOf('application/json') !== -1) {
        const data = await response.json();

        if (data && data.reply) {
          removeStreamBubble();
          addMessage('ai', data.reply);

          if (window.ShijianStore && typeof window.ShijianStore.saveRecord === 'function') {
            window.ShijianStore.saveRecord({
              date: new Date().toISOString(),
              topic: body.topic || text.slice(0, 20),
              task: currentTask,
              summary: String(data.reply).slice(0, 60)
            });
          }

          pendingImage = null;
          pendingDocText = null;
          document.getElementById('shijian-image-preview').textContent = '';
          document.getElementById('shijian-doc-name').textContent = '';
          document.getElementById('shijian-image-input').value = '';
          document.getElementById('shijian-doc-input').value = '';
          succeeded = true;
        } else if (data && data.error === 'backend_not_configured') {
          fatalError = true;
          removeStreamBubble();
          input.value = text;
          setStatus('后端未配置：请联系管理员配置 OPENROUTER_API_KEY 后再试');
        } else if (data && data.error === 'rate_limited') {
          fatalError = true;
          removeStreamBubble();
          input.value = text;
          setStatus('请求太频繁，请稍后再试');
        } else {
          throw new Error('invalid json response');
        }
      } else if (contentType.indexOf('text/event-stream') !== -1) {
        if (!response.body || typeof response.body.getReader !== 'function') {
          throw new Error('stream unsupported');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let gotFirstToken = false;
        let streamDone = false;

        while (!streamDone) {
          const result = await reader.read();

          if (result.done) {
            break;
          }

          armStallTimer();

          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i += 1) {
            let line = lines[i];

            if (line.charAt(line.length - 1) === '\r') {
              line = line.slice(0, -1);
            }

            if (!line || line.charAt(0) === ':') {
              continue;
            }

            if (line.indexOf('event:') === 0) {
              if (line.slice(6).trim() === 'error') {
                throw new Error('SSE error event');
              }
              continue;
            }

            if (line.indexOf('data:') !== 0) {
              continue;
            }

            let raw = line.slice(5);
            if (raw.charAt(0) === ' ') {
              raw = raw.slice(1);
            }

            if (!raw.trim()) {
              continue;
            }

            let msg;
            try {
              msg = JSON.parse(raw);
            } catch (parseError) {
              throw parseError;
            }

            if (msg && Object.prototype.hasOwnProperty.call(msg, 'error')) {
              throw new Error('SSE error payload');
            }

            if (msg && Object.prototype.hasOwnProperty.call(msg, 't')) {
              if (!gotFirstToken) {
                gotFirstToken = true;
                setStatus('史鉴正在回答…');
              }

              fullText += String(msg.t);
              shijianRenderStreamBubble(streamBubble, fullText);
            }

            if (msg && Object.prototype.hasOwnProperty.call(msg, 'done')) {
              streamDone = true;
              break;
            }
          }
        }

        if (!streamDone) {
          throw new Error('SSE ended without done');
        }

        shijianRenderStreamBubble(streamBubble, fullText);
        scrollMessagesToBottom();

        messages.push({ role: 'ai', content: fullText });

        if (window.ShijianStore && typeof window.ShijianStore.saveRecord === 'function') {
          window.ShijianStore.saveRecord({
            date: new Date().toISOString(),
            topic: body.topic || text.slice(0, 20),
            task: currentTask,
            summary: String(fullText).slice(0, 60)
          });
        }

        pendingImage = null;
        pendingDocText = null;
        document.getElementById('shijian-image-preview').textContent = '';
        document.getElementById('shijian-doc-name').textContent = '';
        document.getElementById('shijian-image-input').value = '';
        document.getElementById('shijian-doc-input').value = '';
        succeeded = true;
      } else {
        throw new Error('unsupported content type');
      }
    } catch (error) {
      if (!fatalError) {
        removeStreamBubble();
        input.value = text;
      }
    } finally {
      clearStallTimer();
    }

    if (succeeded) {
      setStatus('');
      sendBtn.disabled = false;
      return;
    }

    if (fatalError) {
      sendBtn.disabled = false;
      return;
    }

    if (attempt === maxAttempts - 1) {
      setStatus('服务暂时不可用，请稍后再试');
      sendBtn.disabled = false;
      return;
    }

    setStatus('史鉴正在思考…');
  }
}

function bindComposer() {
  document.getElementById('shijian-composer').addEventListener('submit', function (event) {
    event.preventDefault();
    sendMessage();
  });

  document.getElementById('shijian-input').addEventListener('keydown', function (event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

function bindUploads() {
  const imageInput = document.getElementById('shijian-image-input');
  const imagePreview = document.getElementById('shijian-image-preview');

  imageInput.addEventListener('change', function () {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;

    pendingImage = null;
    imagePreview.textContent = '';

    if (file.size > 2 * 1024 * 1024) {
      setStatus('图片超过 2MB，请换一张更小的图片');
      imageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      pendingImage = event.target.result;

      imagePreview.textContent = '';

      const img = document.createElement('img');
      img.src = pendingImage;
      img.alt = '图片预览';
      img.style.maxWidth = '120px';
      img.style.maxHeight = '120px';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '移除图片';
      removeBtn.addEventListener('click', function () {
        pendingImage = null;
        imagePreview.textContent = '';
        imageInput.value = '';
      });

      imagePreview.appendChild(img);
      imagePreview.appendChild(removeBtn);
    };
    reader.readAsDataURL(file);
  });

  const docInput = document.getElementById('shijian-doc-input');
  const docName = document.getElementById('shijian-doc-name');

  docInput.addEventListener('change', function () {
    const file = docInput.files && docInput.files[0];
    if (!file) return;

    docName.textContent = file.name;
    pendingDocText = null;

    if (/\.(txt|md)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = function (event) {
        pendingDocText = String(event.target.result || '');
      };
      reader.readAsText(file);
    } else {
      setStatus('PDF / Word 文档暂不支持直接读取正文，请把文字复制粘贴到输入框');
    }
  });
}

function bindEvaluate() {
  document.getElementById('shijian-evaluate-btn').addEventListener('click', async function () {
    if (messages.length < 2) {
      setStatus('先完成一次对话再生成评价');
      return;
    }

    setStatus('正在生成评价…');

    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, 60000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          task: currentTask,
          grade: document.getElementById('shijian-grade').value,
          textbook: document.getElementById('shijian-textbook').value,
          topic: document.getElementById('shijian-topic').value,
          messages: messages.slice(-10)
        }),
        signal: controller.signal
      });
      const data = await response.json();

      if (data && data.scores) {
        const result = document.getElementById('shijian-evaluate-result');
        const scores = data.scores;
        result.textContent = '';

        const dimensions = [
          { label: '信息提取', keys: ['信息提取', 'information_extraction', 'info_extraction', 'infoExtraction'] },
          { label: '史料辨析', keys: ['史料辨析', 'source_analysis', 'sourceAnalysis', 'evidence_analysis'] },
          { label: '历史联系', keys: ['历史联系', 'historical_connection', 'historicalConnection', 'connection'] },
          { label: '历史解释', keys: ['历史解释', 'historical_interpretation', 'historicalInterpretation', 'interpretation'] }
        ];

        function pickScore(keys, index) {
          if (Array.isArray(scores)) return scores[index];
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(scores, key)) {
              const value = scores[key];
              if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'score')) {
                return value.score;
              }
              return value;
            }
          }
          return undefined;
        }

        function scoreText(value) {
          if (value === undefined || value === null || value === '') return '— / 5';
          const number = Number(value);
          if (!Number.isFinite(number) || number < 1 || number > 5) return '— / 5';
          return String(number) + ' / 5';
        }

        dimensions.forEach(function (dimension, index) {
          const row = document.createElement('div');

          const label = document.createElement('span');
          label.textContent = dimension.label + '：';

          const score = document.createElement('span');
          score.textContent = scoreText(pickScore(dimension.keys, index));

          row.appendChild(label);
          row.appendChild(score);
          result.appendChild(row);
        });

        if (data.advice) {
          const advice = document.createElement('div');
          advice.textContent = '建议：' + String(data.advice);
          result.appendChild(advice);
        }

        setStatus('');
      } else {
        setStatus('评价生成失败，请稍后再试');
      }
    } catch (error) {
      setStatus('评价生成失败，请稍后再试');
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () { bindComposer(); bindUploads(); bindEvaluate(); });
})();

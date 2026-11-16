(function () {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  var document = window.document;
  if (!document) {
    return;
  }

  var PROFILE_KEY = 'shijian_profile';
  var RECORDS_KEY = 'shijian_records';
  var TASK_KEY = 'shijian_task';
  var RECORD_LIMIT = 200;
  var PROFILE_FIELDS = ['grade', 'semester', 'textbook', 'progress'];
  var RECORD_FIELDS = ['date', 'topic', 'task', 'summary'];

  window.ShijianStore = {
    loadProfile: function () {
      try {
        var raw = window.localStorage.getItem(PROFILE_KEY);
        if (raw === null) {
          return null;
        }
        var data = JSON.parse(raw);
        return isPlainObject(data) ? data : null;
      } catch (e) {
        return null;
      }
    },

    saveProfile: function (obj) {
      try {
        if (!isPlainObject(obj)) {
          return false;
        }
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(obj));
        return true;
      } catch (e) {
        return false;
      }
    },

    loadRecords: function () {
      try {
        var raw = window.localStorage.getItem(RECORDS_KEY);
        if (raw === null) {
          return [];
        }
        var data = JSON.parse(raw);
        return Array.isArray(data) ? data.slice() : [];
      } catch (e) {
        return [];
      }
    },

    saveRecord: function (rec) {
      try {
        var records = window.ShijianStore.loadRecords();
        records.push(normalizeRecord(rec));
        if (records.length > RECORD_LIMIT) {
          records = records.slice(records.length - RECORD_LIMIT);
        }
        window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
        return true;
      } catch (e) {
        return false;
      }
    },

    clearRecords: function () {
      try {
        window.localStorage.removeItem(RECORDS_KEY);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]';
  }

  function normalizeRecord(rec) {
    var source = rec && typeof rec === 'object' ? rec : {};
    var result = {};
    var i;
    var key;

    for (i = 0; i < RECORD_FIELDS.length; i++) {
      key = RECORD_FIELDS[i];
      result[key] = typeof source[key] !== 'undefined' ? source[key] : '';
    }

    return result;
  }

  function addClass(element, className) {
    if (!element) {
      return;
    }

    if (element.classList) {
      element.classList.add(className);
      return;
    }

    if ((' ' + element.className + ' ').indexOf(' ' + className + ' ') === -1) {
      element.className += ' ' + className;
    }
  }

  function removeClass(element, className) {
    if (!element) {
      return;
    }

    if (element.classList) {
      element.classList.remove(className);
      return;
    }

    element.className = (' ' + element.className + ' ')
      .replace(new RegExp(' ' + className + ' ', 'g'), ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function getEventElement(event) {
    var target = event && event.target;
    if (target && target.nodeType === 3 && target.parentNode) {
      return target.parentNode;
    }
    return target;
  }

  function closest(element, selector) {
    var matcher;

    if (!element) {
      return null;
    }

    if (element.nodeType !== 1) {
      return null;
    }

    if (element.closest) {
      return element.closest(selector);
    }

    matcher = element.matches || element.webkitMatchesSelector || element.mozMatchesSelector || element.msMatchesSelector || element.oMatchesSelector;

    while (element && element.nodeType === 1) {
      if (matcher && matcher.call(element, selector)) {
        return element;
      }
      element = element.parentElement;
    }

    return null;
  }

  function normalizePath(path) {
    if (!path) {
      return '/';
    }

    try {
      path = decodeURIComponent(path);
    } catch (e) {}

    if (path !== '/' && /\/$/.test(path)) {
      path = path.replace(/\/+$/, '');
    }

    path = path.replace(/\/index\.html$/i, '');

    return path || '/';
  }

  function bindTaskLinks() {
    document.addEventListener('click', function (event) {
      var element = getEventElement(event);
      var link = closest(element, '[data-shijian-task-link]');
      var task;

      if (!link || !link.hasAttribute || !link.hasAttribute('data-task')) {
        return;
      }

      task = link.getAttribute('data-task') || '';

      try {
        window.sessionStorage.setItem(TASK_KEY, task);
      } catch (e) {}
    });
  }

  function getProfileField(modal, name) {
    var selectors = [
      '[name="' + name + '"]',
      '#' + name,
      '[data-profile="' + name + '"]',
      '[data-shijian-profile="' + name + '"]'
    ];
    var i;
    var field;

    for (i = 0; i < selectors.length; i++) {
      field = modal.querySelector(selectors[i]);
      if (field) {
        return field;
      }
    }

    return null;
  }

  function fillProfileForm(modal) {
    var profile = window.ShijianStore.loadProfile() || {};
    var i;
    var key;
    var field;
    var value;

    for (i = 0; i < PROFILE_FIELDS.length; i++) {
      key = PROFILE_FIELDS[i];
      field = getProfileField(modal, key);

      if (!field) {
        continue;
      }

      value = Object.prototype.hasOwnProperty.call(profile, key) ? profile[key] : '';
      if (value === null || typeof value === 'undefined') {
        value = '';
      }

      try {
        field.value = value;
      } catch (e) {}
    }
  }

  function collectProfile(modal) {
    var profile = {};
    var i;
    var key;
    var field;
    var value;

    for (i = 0; i < PROFILE_FIELDS.length; i++) {
      key = PROFILE_FIELDS[i];
      field = getProfileField(modal, key);
      value = field && typeof field.value !== 'undefined' ? field.value : '';

      if (value === null || typeof value === 'undefined') {
        value = '';
      }

      if (typeof value !== 'string') {
        value = String(value);
      }

      profile[key] = value;
    }

    return profile;
  }

  function openProfileModal(modal) {
    var computedDisplay = '';

    if (!modal) {
      return;
    }

    fillProfileForm(modal);

    if (modal.removeAttribute) {
      modal.removeAttribute('hidden');
    }
    modal.hidden = false;
    addClass(modal, 'is-open');
    addClass(modal, 'is-visible');
    modal.setAttribute('aria-hidden', 'false');

    modal.style.display = '';

    if (window.getComputedStyle) {
      try {
        computedDisplay = window.getComputedStyle(modal).display;
      } catch (e) {}
    }

    if (!computedDisplay || computedDisplay === 'none') {
      modal.style.display = 'block';
    }
  }

  function closeProfileModal(modal) {
    if (!modal) {
      return;
    }

    modal.hidden = true;
    if (modal.setAttribute) {
      modal.setAttribute('hidden', 'hidden');
    }
    removeClass(modal, 'is-open');
    removeClass(modal, 'is-visible');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
  }

  function initProfileModal() {
    var modal = document.querySelector('#shijian-profile-modal');
    var form;
    var profile;
    var path;

    if (!modal || window.__shijianProfileBound) {
      return;
    }

    window.__shijianProfileBound = true;
    closeProfileModal(modal);

    document.addEventListener('click', function (event) {
      var element = getEventElement(event);
      var openButton;
      var closeButton;

      if (!element) {
        return;
      }

      openButton = closest(element, '[data-shijian-open-profile]');
      if (openButton) {
        event.preventDefault();
        openProfileModal(modal);
        return;
      }

      closeButton = closest(element, '[data-shijian-close-profile]');
      if (closeButton) {
        event.preventDefault();
        closeProfileModal(modal);
      }
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeProfileModal(modal);
      }
    });

    form = modal.querySelector('form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        window.ShijianStore.saveProfile(collectProfile(modal));
        closeProfileModal(modal);
      });
    }

    profile = window.ShijianStore.loadProfile();
    path = window.location.pathname || '';

    if (!profile && (path === '/' || /\/index\.html$/i.test(path))) {
      openProfileModal(modal);
    }
  }

  function initNavHighlight() {
    var currentPath = normalizePath(window.location.pathname || '/');
    var links = document.querySelectorAll('nav a');
    var i;
    var link;
    var href;
    var linkPath;

    for (i = 0; i < links.length; i++) {
      link = links[i];
      href = link.getAttribute('href');

      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) {
        continue;
      }

      if (link.hostname && link.hostname !== window.location.hostname) {
        continue;
      }

      linkPath = normalizePath(link.pathname || '');
      if (linkPath === currentPath) {
        addClass(link, 'is-active');
      }
    }
  }

  bindTaskLinks();

  ready(function () {
    initProfileModal();
    initNavHighlight();
  });
})();

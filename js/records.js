(function () {
  'use strict';

  var TASK_LABEL = {
    reading: '史料阅读',
    analysis: '史料辨析',
    explanation: '历史解释',
    general: '通用对话'
  };

  function formatDate(iso) {
    var date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function pickValue(record, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = record[keys[i]];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return '';
  }

  function getTaskLabel(value) {
    var key = value === undefined || value === null ? '' : String(value);

    if (Object.prototype.hasOwnProperty.call(TASK_LABEL, key)) {
      return TASK_LABEL[key];
    }

    return key;
  }

  function renderRecords() {
    var list = document.getElementById('shijian-records-list');
    var stats = document.getElementById('shijian-records-stats');
    var records = window.ShijianStore.loadRecords();

    if (!Array.isArray(records)) {
      records = [];
    }

    stats.textContent = '共 ' + records.length + ' 条记录';

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (records.length === 0) {
      var empty = document.createElement('p');
      empty.textContent = '暂无学习记录，去 AI 对话开始一次探究吧。';

      var link = document.createElement('a');
      link.href = 'chat.html';
      link.textContent = '去 AI 对话';

      empty.appendChild(document.createTextNode(' '));
      empty.appendChild(link);
      list.appendChild(empty);
      return;
    }

    function createCell(parent, className, value) {
      var cell = document.createElement('span');
      cell.className = className;
      cell.textContent = value;
      parent.appendChild(cell);
    }

    var table = document.createElement('div');
    table.className = 'shijian-records-table';

    var inner = document.createElement('div');
    inner.className = 'shijian-records-table__inner';
    table.appendChild(inner);

    var head = document.createElement('div');
    head.className = 'shijian-records-table__head';
    createCell(head, 'shijian-records-table__cell--date', '日期');
    createCell(head, 'shijian-records-table__cell--topic', '主题');
    createCell(head, 'shijian-records-table__cell--task', '任务类型');
    createCell(head, 'shijian-records-table__cell--summary', '摘要');
    inner.appendChild(head);

    records.forEach(function (record) {
      var row = document.createElement('div');
      row.className = 'shijian-records-table__row';

      var dateValue = pickValue(record, ['date', 'createdAt', 'created_at', 'iso', 'timestamp']);
      var topicValue = pickValue(record, ['topic', 'title', 'subject', 'theme', 'question', 'prompt']);
      var taskValue = pickValue(record, ['taskType', 'task_type', 'type', 'task']);
      var summaryValue = pickValue(record, ['summary', 'excerpt', 'abstract', 'answer', 'content', 'note']);

      createCell(row, 'shijian-records-table__cell--date', formatDate(dateValue));
      createCell(row, 'shijian-records-table__cell--topic', topicValue);
      createCell(row, 'shijian-records-table__cell--task', getTaskLabel(taskValue));
      createCell(row, 'shijian-records-table__cell--summary', summaryValue);

      inner.appendChild(row);
    });

    list.appendChild(table);
  }

  function init() {
    var clearButton = document.getElementById('shijian-clear-records');

    clearButton.addEventListener('click', function () {
      var confirmed = confirm('确定要清空全部学习记录吗？此操作不可恢复。');

      if (!confirmed) {
        return;
      }

      window.ShijianStore.clearRecords();
      renderRecords();
    });

    renderRecords();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

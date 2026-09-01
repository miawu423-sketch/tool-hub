/* 时间戳就地转换 · Bookmarklet 源码
 * 使用方式：把 install.html 里的书签拖到浏览器书签栏，
 * 打开任意页面后点一下书签，即可对当前标签页启用「选中文本自动弹气泡」。
 */
(function () {
  'use strict';

  // 已注入 → 二次点击视为切换开关
  if (window.__tsxBookmarklet) {
    window.__tsxBookmarklet.toggle();
    return;
  }

  var settings = {
    format: 'yyyy/MM/dd HH:mm:ss',
    tz: 'local'
  };
  var enabled = true;

  // ---------- 样式 ----------
  var style = document.createElement('style');
  style.textContent = [
    '#tsx-bubble{position:absolute;z-index:2147483647;min-width:220px;max-width:360px;',
    'background:#1f2937;color:#f9fafb;border-radius:10px;padding:10px 12px 8px;',
    'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;',
    'font-size:13px;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.15);',
    'opacity:0;transform:translateY(-4px);transition:opacity .12s,transform .12s;pointer-events:none;user-select:none;visibility:hidden}',
    '#tsx-bubble.tsx-show{opacity:1;transform:translateY(0);pointer-events:auto;visibility:visible}',
    '#tsx-bubble .tsx-arrow{position:absolute;top:-6px;left:16px;width:12px;height:12px;background:#1f2937;transform:rotate(45deg);border-radius:2px}',
    '#tsx-bubble .tsx-header{display:flex;align-items:center;justify-content:space-between;color:#9ca3af;font-size:11px;margin-bottom:6px}',
    '#tsx-bubble .tsx-header .tsx-title{letter-spacing:.3px}',
    '#tsx-bubble .tsx-header .tsx-close{cursor:pointer;padding:0 4px;border-radius:4px}',
    '#tsx-bubble .tsx-header .tsx-close:hover{background:#374151;color:#fff}',
    '#tsx-bubble .tsx-list{max-height:260px;overflow:auto}',
    '#tsx-bubble .tsx-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px dashed #374151}',
    '#tsx-bubble .tsx-row:last-child{border-bottom:none}',
    '#tsx-bubble .tsx-src{color:#9ca3af;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}',
    '#tsx-bubble .tsx-dst{color:#fef3c7;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;font-weight:600;cursor:pointer;padding:2px 6px;border-radius:4px;user-select:text}',
    '#tsx-bubble .tsx-dst:hover{background:#374151}',
    '#tsx-bubble .tsx-dst.tsx-copied{background:#059669;color:#fff}',
    '#tsx-bubble .tsx-empty{color:#9ca3af;font-size:12px}',
    '#tsx-bubble .tsx-footer{display:flex;justify-content:space-between;align-items:center;color:#6b7280;font-size:11px;margin-top:6px;padding-top:6px;border-top:1px solid #374151}',
    '#tsx-bubble .tsx-ctrl{display:flex;gap:6px;align-items:center}',
    '#tsx-bubble select{background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:4px;font-size:10px;padding:1px 4px;outline:none;font-family:inherit}',
    '#tsx-bubble .tsx-copyall{cursor:pointer;color:#93c5fd;padding:2px 6px;border-radius:4px}',
    '#tsx-bubble .tsx-copyall:hover{background:#374151;color:#dbeafe}',
    '#tsx-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
    'background:#111827;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;',
    'z-index:2147483647;opacity:0;transition:opacity .2s;pointer-events:none;',
    'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}',
    '#tsx-toast.tsx-show{opacity:1}'
  ].join('');
  document.head.appendChild(style);

  // ---------- 时间格式化 ----------
  function pad(n, w) { w = w || 2; return String(n).padStart(w, '0'); }

  function partsInTZ(date, tz) {
    if (tz === 'local') {
      return {
        y: date.getFullYear(), M: date.getMonth() + 1, d: date.getDate(),
        H: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), S: date.getMilliseconds()
      };
    }
    var offsetH = tz === 'utc' ? 0 : parseFloat(tz);
    var shifted = new Date(date.getTime() + offsetH * 3600 * 1000);
    return {
      y: shifted.getUTCFullYear(), M: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
      H: shifted.getUTCHours(), m: shifted.getUTCMinutes(), s: shifted.getUTCSeconds(), S: shifted.getUTCMilliseconds()
    };
  }

  function tzSuffix(tz) {
    if (tz === 'local') {
      var off = -new Date().getTimezoneOffset() / 60;
      return (off >= 0 ? '+' : '-') + pad(Math.abs(off)) + ':00';
    }
    if (tz === 'utc') return 'Z';
    var n = parseFloat(tz);
    return (n >= 0 ? '+' : '-') + pad(Math.abs(n)) + ':00';
  }

  function format(date, fmt, tz) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    var p = partsInTZ(date, tz);
    if (fmt === 'ISO') {
      return p.y + '-' + pad(p.M) + '-' + pad(p.d) + 'T' + pad(p.H) + ':' + pad(p.m) + ':' + pad(p.s) + tzSuffix(tz);
    }
    return fmt
      .replace(/yyyy/g, p.y)
      .replace(/MM/g, pad(p.M))
      .replace(/dd/g, pad(p.d))
      .replace(/HH/g, pad(p.H))
      .replace(/mm/g, pad(p.m))
      .replace(/ss/g, pad(p.s))
      .replace(/SSS/g, pad(p.S, 3));
  }

  // ---------- 识别 ----------
  var patterns = [
    { type: 'ISO',
      re: /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?)\b/g,
      parse: function (s) {
        var std = s.replace(' ', 'T');
        var d = new Date(std);
        return isNaN(d) ? null : d;
      } },
    { type: '毫秒',
      re: /(?<![\d.])\d{13}(?![\d.])/g,
      parse: function (s) { return new Date(parseInt(s, 10)); } },
    { type: '秒',
      re: /(?<![\d.])\d{10}(?![\d.])/g,
      parse: function (s) { return new Date(parseInt(s, 10) * 1000); } },
    { type: '日期',
      re: /\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2} \d{1,2}:\d{2}:\d{2})\b/g,
      parse: function (s) {
        var norm = s.replace(/\//g, '-').replace(' ', 'T');
        var d = new Date(norm);
        return isNaN(d) ? null : d;
      } }
  ];

  function findHits(text) {
    var hits = [];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i]; p.re.lastIndex = 0;
      var m;
      while ((m = p.re.exec(text)) !== null) {
        var raw = m[0], start = m.index, end = start + raw.length;
        var conflict = false;
        for (var j = 0; j < hits.length; j++) {
          var h = hits[j];
          if (!(end <= h.start || start >= h.end)) { conflict = true; break; }
        }
        if (conflict) continue;
        var d = p.parse(raw);
        if (!d || isNaN(d)) continue;
        hits.push({ start: start, end: end, type: p.type, text: raw, date: d });
      }
    }
    hits.sort(function (a, b) { return a.start - b.start; });
    return hits;
  }

  // ---------- 气泡 ----------
  var bubble = null, hideTimer = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.id = 'tsx-bubble';
    bubble.innerHTML =
      '<div class="tsx-arrow"></div>' +
      '<div class="tsx-header">' +
        '<span class="tsx-title">时间戳转换</span>' +
        '<span class="tsx-close" title="关闭">✕</span>' +
      '</div>' +
      '<div class="tsx-list"></div>' +
      '<div class="tsx-footer">' +
        '<div class="tsx-ctrl">' +
          '<select class="tsx-fmt">' +
            '<option value="yyyy/MM/dd HH:mm:ss">yyyy/MM/dd HH:mm:ss</option>' +
            '<option value="yyyy-MM-dd HH:mm:ss">yyyy-MM-dd HH:mm:ss</option>' +
            '<option value="yyyy/MM/dd HH:mm:ss.SSS">带毫秒</option>' +
            '<option value="MM/dd HH:mm:ss">MM/dd HH:mm:ss</option>' +
            '<option value="ISO">ISO 8601</option>' +
          '</select>' +
          '<select class="tsx-tz">' +
            '<option value="local">本地</option>' +
            '<option value="utc">UTC</option>' +
            '<option value="+8">+8</option>' +
            '<option value="+9">+9</option>' +
            '<option value="-5">-5</option>' +
            '<option value="-8">-8</option>' +
          '</select>' +
        '</div>' +
        '<span class="tsx-copyall" title="复制全部">复制全部</span>' +
      '</div>';
    document.documentElement.appendChild(bubble);
    bubble.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    bubble.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('tsx-close')) { hideBubble(); return; }
      if (t.classList.contains('tsx-dst')) { copyText(t.dataset.value, t); return; }
      if (t.classList.contains('tsx-copyall')) {
        var all = Array.prototype.slice.call(bubble.querySelectorAll('.tsx-dst'))
          .map(function (el) { return el.dataset.value; }).join('\n');
        copyText(all, t);
        return;
      }
    });
    var fmtSel = bubble.querySelector('.tsx-fmt');
    var tzSel = bubble.querySelector('.tsx-tz');
    try {
      var saved = JSON.parse(localStorage.getItem('tsx-settings') || '{}');
      if (saved.format) settings.format = saved.format;
      if (saved.tz) settings.tz = saved.tz;
    } catch (e) {}
    fmtSel.value = settings.format;
    tzSel.value = settings.tz;
    fmtSel.addEventListener('change', function () {
      settings.format = fmtSel.value; persistSettings(); rerender();
    });
    tzSel.addEventListener('change', function () {
      settings.tz = tzSel.value; persistSettings(); rerender();
    });
    return bubble;
  }

  function persistSettings() {
    try { localStorage.setItem('tsx-settings', JSON.stringify(settings)); } catch (e) {}
  }

  function copyText(text, el) {
    if (!text) return;
    var done = function () { flashCopied(el); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function flashCopied(el) {
    if (!el) return;
    var orig = el.textContent;
    el.classList.add('tsx-copied');
    el.textContent = '✓ 已复制';
    setTimeout(function () {
      el.classList.remove('tsx-copied');
      el.textContent = orig;
    }, 900);
  }

  function positionBubble(rect) {
    var b = bubble;
    b.style.left = '-9999px'; b.style.top = '-9999px';
    b.classList.add('tsx-show');
    var bw = b.offsetWidth;
    var vw = document.documentElement.clientWidth;
    var scrollX = window.scrollX || window.pageXOffset;
    var scrollY = window.scrollY || window.pageYOffset;
    var left = rect.left + scrollX;
    var top = rect.bottom + scrollY + 8;
    if (left + bw > scrollX + vw - 8) left = scrollX + vw - bw - 8;
    if (left < scrollX + 4) left = scrollX + 4;
    b.style.left = left + 'px'; b.style.top = top + 'px';
  }

  function hideBubble() { if (bubble) bubble.classList.remove('tsx-show'); }

  var lastRect = null;
  function renderBubble(hits, rect) {
    ensureBubble();
    lastRect = rect;
    var listEl = bubble.querySelector('.tsx-list');
    if (!hits.length) {
      listEl.innerHTML = '<div class="tsx-empty">未识别到时间戳</div>';
    } else {
      listEl.innerHTML = hits.map(function (h) {
        var converted = format(h.date, settings.format, settings.tz);
        var srcShort = h.text.length > 22 ? h.text.slice(0, 20) + '…' : h.text;
        return '<div class="tsx-row">' +
          '<span class="tsx-src" title="' + esc(h.text) + '（' + h.type + '）">' + esc(srcShort) + '</span>' +
          '<span class="tsx-dst" data-value="' + esc(converted) + '" title="点击复制">' + esc(converted) + '</span>' +
          '</div>';
      }).join('');
    }
    positionBubble(rect);
  }

  var lastHits = null;
  function rerender() {
    if (lastHits && lastRect) renderBubble(lastHits, lastRect);
  }

  // ---------- 选区监听 ----------
  function getSelectionInfo() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var text = sel.toString();
    if (!text || !text.trim()) return null;
    if (text.length > 5000) return null;
    var range = sel.getRangeAt(0);
    var rects = range.getClientRects();
    var rect = range.getBoundingClientRect();
    if (rects && rects.length) rect = rects[rects.length - 1];
    return { text: text, rect: rect };
  }

  function tryShow() {
    if (!enabled) return;
    var info = getSelectionInfo();
    if (!info) { hideBubble(); return; }
    var hits = findHits(info.text);
    lastHits = hits;
    if (!hits.length) { hideBubble(); return; }
    renderBubble(hits, info.rect);
  }

  function onMouseUp() { clearTimeout(hideTimer); hideTimer = setTimeout(tryShow, 30); }
  function onKeyUp(e) {
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.key === 'Shift' || e.key === 'Meta') {
      clearTimeout(hideTimer); hideTimer = setTimeout(tryShow, 30);
    }
  }
  function onMouseDown(e) { if (bubble && bubble.contains(e.target)) return; hideBubble(); }
  function onSelChange() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideBubble();
  }

  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('scroll', hideBubble, true);
  window.addEventListener('resize', hideBubble);
  document.addEventListener('selectionchange', onSelChange);

  // ---------- Toast + 状态切换 ----------
  function toast(msg) {
    var t = document.getElementById('tsx-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'tsx-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('tsx-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('tsx-show'); }, 1400);
  }

  window.__tsxBookmarklet = {
    toggle: function () {
      enabled = !enabled;
      if (!enabled) hideBubble();
      toast(enabled ? '⏱ 时间戳转换：已启用' : '⏱ 时间戳转换：已关闭');
    }
  };
  toast('⏱ 时间戳转换已启用，划中文字试试');
})();

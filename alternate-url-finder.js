// 可替代URL源码提取 v2.0 — 智能过滤版
// 托管于 GitHub Pages，书签通过一行加载器引用此文件
(function () {
  'use strict';

  if (document.getElementById('alt-url-panel')) {
    document.getElementById('alt-url-panel').remove();
    return;
  }

  var results = [];
  var currentUrl = location.href;
  var currentNorm = currentUrl.replace(/\/$/, '').replace(/^https?/, '');

  function isNoise(url) {
    var u = url.toLowerCase();
    if (/\/feed\/?($|\?)/.test(u)) return true;
    if (/\/comments\/feed/.test(u)) return true;
    if (/\/wp-json\//.test(u)) return true;
    if (/\/oembed/.test(u)) return true;
    if (/\.(xml|rss|atom|json|ics|vcf)($|\?)/.test(u)) return true;
    if (/format=xml/.test(u)) return true;
    if (/[?&]ical=/.test(u)) return true;
    if (/[?&]outlook-ical=/.test(u)) return true;
    if (/[?&]webcal=/.test(u)) return true;
    if (/\/ical\/?($|\?)/.test(u)) return true;
    if (/\/calendar\/export/.test(u)) return true;
    if (/\/xmlrpc\.php/.test(u)) return true;
    if (/\/trackback\/?$/.test(u)) return true;
    if (/wlwmanifest/.test(u)) return true;
    if (/\/rsd/.test(u)) return true;
    if (/\/embed\/?($|\?)/.test(u)) return true;
    if (/\/print\/?($|\?)/.test(u)) return true;
    return false;
  }

  function isSamePage(url) {
    var norm = url.replace(/\/$/, '').replace(/^https?/, '');
    return norm === currentNorm;
  }

  function fixUrl(url) {
    if (!url) return url;
    url = url.trim();
    if (/%[23][0-9A-Fa-f]/.test(url) && url.indexOf('://') === -1) {
      try { url = decodeURIComponent(url); } catch (e) { }
    }
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (/^(www\.|m\.|[a-z0-9-]+\.[a-z]{2,})/.test(url) && url.indexOf('://') === -1) return 'https://' + url;
    return url;
  }

  function isGarbledRelative(url) {
    try { var p = new URL(url); if (/\/[a-z0-9-]+\.[a-z]{2,}\//.test(p.pathname)) return true; } catch (e) { }
    return false;
  }

  function isHomepage(url) {
    var u = url.replace(/^https?:\/\//, '');
    var slashIdx = u.indexOf('/');
    return slashIdx === -1 || slashIdx === u.length - 1;
  }

  function addResult(type, url) {
    if (!url || !url.trim()) return;
    url = fixUrl(url.trim());
    if (isSamePage(url)) return;
    if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('javascript:')) return;
    if (isNoise(url)) return;
    if (isGarbledRelative(url)) return;
    if (isHomepage(url)) return;
    var normalized = url.replace(/\/$/, '');
    for (var i = 0; i < results.length; i++) { if (results[i].url.replace(/\/$/, '') === normalized) return; }
    results.push({ type: type, url: url });
  }

  // 1. canonical
  var canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) addResult('canonical', canonical.href);

  // 2. og:url
  var og = document.querySelector('meta[property="og:url"]');
  if (og && og.content) addResult('og:url', og.content);

  // 3. data-* attributes
  var dataAttrs = ['data-canonical-url', 'data-original-url', 'data-source-url', 'data-syndication-source', 'data-share-url'];
  dataAttrs.forEach(function (attr) {
    var els = document.querySelectorAll('[' + attr + ']');
    els.forEach(function (el) { addResult(attr, el.getAttribute(attr)); });
  });

  // 4. alternate links
  var alternates = document.querySelectorAll('link[rel="alternate"]');
  alternates.forEach(function (el) {
    var rawHref = el.getAttribute('href');
    if (!rawHref) return;
    var resolvedUrl = fixUrl(rawHref);
    if (resolvedUrl === currentUrl) return;
    if (isGarbledRelative(el.href)) return;
    var type = el.getAttribute('type') || '';
    if (/rss|atom|json|xml/.test(type)) return;
    var label = 'alternate';
    if (el.hreflang) label += ' [' + el.hreflang + ']';
    if (el.media && /max-width/.test(el.media)) label = '\u79FB\u52A8\u7248';
    addResult(label, resolvedUrl);
  });

  // 5. syndication-source / original-source
  var synMeta = document.querySelector('meta[name="syndication-source"]');
  if (synMeta && synMeta.content) addResult('syndication-source', synMeta.content);
  var origMeta = document.querySelector('meta[name="original-source"]');
  if (origMeta && origMeta.content) addResult('original-source', origMeta.content);

  // 6. 百度移动适配
  var mobileAgent = document.querySelector('meta[name="mobile-agent"]');
  if (mobileAgent && mobileAgent.content) {
    var m = mobileAgent.content.match(/url=(https?:\/\/\S+)/);
    if (m) addResult('\u767E\u5EA6\u79FB\u52A8\u9002\u914D', m[1]);
  }

  // 7. JSON-LD
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  var contentTypes = ['Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'Report', 'ScholarlyArticle', 'TechArticle', 'ReviewNewsArticle', 'AnalysisNewsArticle', 'OpinionNewsArticle', 'LiveBlogPosting', 'SocialMediaPosting'];
  function processLD(d) {
    if (!d) return;
    var dtype = (d['@type'] || '').toString();
    if (d.mainEntityOfPage) {
      var u = typeof d.mainEntityOfPage === 'string' ? d.mainEntityOfPage : d.mainEntityOfPage['@id'] || d.mainEntityOfPage.url;
      addResult('JSON-LD', u);
    }
    if (d.url) {
      var isContent = contentTypes.some(function (t) { return dtype.indexOf(t) !== -1; });
      if (isContent) addResult('JSON-LD url', d.url);
    }
  }
  scripts.forEach(function (s) {
    try {
      var d = JSON.parse(s.textContent);
      if (Array.isArray(d)) d.forEach(function (item) { processLD(item); });
      else processLD(d);
    } catch (e) { }
  });

  // 8. 正文来源文字
  var bodyText = document.body.innerText;
  var cnPatterns = [
    /\u6765\u6E90[\uFF1A:]\s*(https?:\/\/[^\s<"']+)/g,
    /\u539F\u6587[\u94FE\u63A5\u5730\u5740]*[\uFF1A:]\s*(https?:\/\/[^\s<"']+)/g,
    /\u8F6C\u8F7D\u81EA[\uFF1A:]\s*(https?:\/\/[^\s<"']+)/g,
    /\u9996\u53D1\u4E8E[\uFF1A:]\s*(https?:\/\/[^\s<"']+)/g,
    /Source[\uFF1A:]\s*(https?:\/\/[^\s<"']+)/gi,
    /Originally published (?:at|on)[\uFF1A:]?\s*(https?:\/\/[^\s<"']+)/gi,
    /This (?:article|story|post) (?:was )?(?:originally )?(?:appeared|published) (?:on|at|in)\s+[^.]*?(https?:\/\/[^\s<"']+)/gi
  ];
  cnPatterns.forEach(function (re) { var match; while ((match = re.exec(bodyText)) !== null) { addResult('\u6B63\u6587\u6765\u6E90', match[1]); } });

  // 9. amphtml
  var amp = document.querySelector('link[rel="amphtml"]');
  if (amp && amp.href) addResult('AMP', amp.href);

  // 10. shortlink
  var shortlink = document.querySelector('link[rel="shortlink"]');
  if (shortlink && shortlink.href) addResult('shortlink', shortlink.href);

  // ====== Build panel ======
  var panel = document.createElement('div');
  panel.id = 'alt-url-panel';
  panel.style.cssText = 'position:fixed;top:0;right:0;width:420px;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;';

  var header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;background:#1a1a2e;color:#fff;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
  header.innerHTML = '<span>\uD83D\uDD17 \u66FF\u4EE3URL\u8BC6\u522B v2 \u2014 \u627E\u5230 ' + results.length + ' \u4E2A</span><span style="cursor:pointer;font-size:18px;" onclick="document.getElementById(\'alt-url-panel\').remove()">\u2715</span>';
  panel.appendChild(header);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;';

  if (results.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#a0aec0;"><div style="font-size:48px;margin-bottom:12px;">\uD83D\uDE45</div><div style="font-size:14px;">\u672A\u627E\u5230\u53EF\u7528\u7684\u66FF\u4EE3URL</div><div style="font-size:12px;margin-top:8px;color:#cbd5e0;">\u5DF2\u81EA\u52A8\u8FC7\u6EE4RSS/API/\u6280\u672F\u94FE\u63A5</div></div>';
  } else {
    results.forEach(function (r) {
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:10px 12px;background:#f7fafc;border-radius:6px;margin-bottom:8px;font-size:13px;';
      var colors = { canonical: '#3182ce', 'og:url': '#38a169', 'JSON-LD': '#6b46c1', 'JSON-LD url': '#6b46c1', 'JSON-LD isPartOf': '#6b46c1', 'syndication-source': '#d69e2e', 'original-source': '#d69e2e', '\u6B63\u6587\u6765\u6E90': '#805ad5', '\u767E\u5EA6\u79FB\u52A8\u9002\u914D': '#e53e3e', AMP: '#ed8936', shortlink: '#718096', '\u79FB\u52A8\u7248': '#0891b2' };
      var color = colors[r.type] || '#4a5568';
      if (r.type.indexOf('data-') === 0) color = '#d69e2e';
      if (r.type.indexOf('alternate') === 0) color = '#dd6b20';

      var badge = document.createElement('span');
      badge.textContent = r.type;
      badge.style.cssText = 'flex-shrink:0;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:' + color + ';white-space:nowrap;';

      var urlSpan = document.createElement('span');
      urlSpan.textContent = r.url;
      urlSpan.style.cssText = 'word-break:break-all;color:#2b6cb0;flex:1;cursor:pointer;';
      urlSpan.onclick = (function (u) { return function () { window.open(u, '_blank'); }; })(r.url);

      var btnCopyOne = document.createElement('button');
      btnCopyOne.textContent = '\u590D\u5236';
      btnCopyOne.style.cssText = 'flex-shrink:0;background:#edf2f7;border:none;padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer;color:#4a5568;';
      btnCopyOne.onclick = (function (u) {
        return function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(u).then(function () { btnCopyOne.textContent = '\u2713'; setTimeout(function () { btnCopyOne.textContent = '\u590D\u5236'; }, 1000); });
          } else {
            var ta = document.createElement('textarea'); ta.value = u; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            btnCopyOne.textContent = '\u2713'; setTimeout(function () { btnCopyOne.textContent = '\u590D\u5236'; }, 1000);
          }
        };
      })(r.url);

      var btnOpenOne = document.createElement('button');
      btnOpenOne.textContent = '\u6253\u5F00';
      btnOpenOne.style.cssText = 'flex-shrink:0;background:#edf2f7;border:none;padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer;color:#4a5568;';
      btnOpenOne.onclick = (function (u) { return function () { window.open(u, '_blank'); }; })(r.url);

      item.appendChild(badge);
      item.appendChild(urlSpan);
      item.appendChild(btnCopyOne);
      item.appendChild(btnOpenOne);
      body.appendChild(item);
    });
  }
  panel.appendChild(body);

  var footer = document.createElement('div');
  footer.style.cssText = 'padding:12px 16px;background:#edf2f7;display:flex;gap:8px;flex-shrink:0;border-top:1px solid #e2e8f0;';
  var btnCopy = document.createElement('button');
  btnCopy.textContent = '\uD83D\uDCCB \u5168\u90E8\u590D\u5236';
  btnCopy.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;font-size:13px;font-weight:500;cursor:pointer;background:#667eea;color:#fff;';
  btnCopy.onclick = function () {
    var urls = results.map(function (r) { return r.url; });
    var text = urls.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { alert('\u5DF2\u590D\u5236 ' + urls.length + ' \u4E2AURL'); });
    } else {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      alert('\u5DF2\u590D\u5236 ' + urls.length + ' \u4E2AURL');
    }
  };
  var btnOpen = document.createElement('button');
  btnOpen.textContent = '\uD83D\uDD17 \u5168\u90E8\u6253\u5F00';
  btnOpen.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;font-size:13px;font-weight:500;cursor:pointer;background:#fff;color:#4a5568;border:1px solid #e2e8f0;';
  btnOpen.onclick = function () { results.forEach(function (r) { window.open(r.url, '_blank'); }); };
  footer.appendChild(btnCopy);
  footer.appendChild(btnOpen);
  panel.appendChild(footer);
  document.body.appendChild(panel);
})();

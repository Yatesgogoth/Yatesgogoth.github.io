/* =====================================================================
 *  main.js —— 网页的「逻辑层」（v4 个人品牌作品集）
 *  读取 data/profile.js（window.PROFILE），按 6 个层级生成页面，并处理交互：
 *    A 首屏 → B 精选成果（cases）→ C 职业轨迹（experience）
 *    → D 工作之外（projects / publications / leadership）→ E 关于我（about / education / awards / skills）→ F 联系
 *  所有个人内容都来自 profile.js；这里只负责「怎么展示、怎么动」。
 * ===================================================================== */
(function () {
  'use strict';

  /* ================= 1. 工具函数 ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const list = (a) => (Array.isArray(a) ? a : []);
  const pad = (n) => String(n).padStart(2, '0');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式下忽略 */ } }
  };
  // 本次浏览期间有效（关掉网站再打开会重置）：用于「每次打开网站播一次开场」
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 网站截图工具 / 搜索引擎爬虫：不播开场动画，直接显示最终画面（否则截图会截到轮播词重叠的中间帧）
  const IS_BOT = !!navigator.webdriver || /bot|crawl|spider|headless|lighthouse|screenshot|preview/i.test(navigator.userAgent);
  const params = new URLSearchParams(location.search);
  const IS_PREVIEW = params.has('preview');
  // 详情页路由：?case=anker（案例）或 ?story=drama（故事）；route 为空 = 首页
  let route = params.get('case') || params.get('story') || '';
  let kind = !params.get('case') && params.get('story') ? 'story' : 'case';

  let DATA = window.PROFILE || {};
  if (params.has('draft')) { try { const d = store.get('profile-draft'); if (d) DATA = JSON.parse(d); } catch (e) { /* 草稿损坏时用文件版本 */ } }
  const meta = () => DATA.meta || {};

  // 语言 / 主题优先级：网址参数 > 访客上次的选择 > profile.js 默认值
  let lang = params.get('lang') || store.get('site-lang') || meta().defaultLang || 'zh';
  let theme = params.get('theme') || store.get('site-theme') || meta().defaultTheme || 'light';

  const isI18n = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('zh' in v || 'en' in v);
  const t = (v) => {
    if (v == null) return '';
    if (isI18n(v)) { const x = v[lang]; return x !== undefined && x !== '' ? x : (v.zh || v.en || ''); }
    return v;
  };
  const T = (v) => esc(t(v));
  const plain = (v) => esc(String(t(v)).replace(/\*/g, ''));
  const rich = (v) => T(v).replace(/\*(.+?)\*/g, '<em class="ac">$1</em>');   // *文字* → 强调色
  const has = (v) => { const x = t(v); return x !== '' && x != null && x !== false; };
  const ui = (k) => T((DATA.ui || {})[k]);
  const E = (path) => (IS_PREVIEW ? ` data-edit="${esc(path)}"` : '');           // 只在编辑器预览中输出
  const each = (arr, keep, fn) => list(arr).map((x, i) => [x, i]).filter(([x]) => keep(x)).map(([x, i], k) => fn(x, i, k)).join('');
  const shown = (x) => x && x.show !== false;

  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15V4h11"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n] || ICONS.arrow}</svg>`;
  /* 个人标志：TH 衬线字母（粗竖细横，呼应标题字体）。由 12 个矩形组成，首屏开场结束时这些笔画会飞来拼合。
     缩写不是 TH 时退回为文字标志。 */
  const MARK = '<rect x="6" y="11" width="18" height="1.8"/><rect x="6" y="11" width="1.6" height="6"/><rect x="22.4" y="11" width="1.6" height="6"/>'
    + '<rect x="13" y="12" width="4" height="24.2"/><rect x="10" y="35.4" width="10" height="1.6"/>'
    + '<rect x="26.5" y="11" width="4" height="26"/><rect x="38" y="11" width="4" height="26"/>'
    + '<rect x="24.5" y="11" width="8" height="1.6"/><rect x="36" y="11" width="8" height="1.6"/>'
    + '<rect x="24.5" y="35.4" width="8" height="1.6"/><rect x="36" y="35.4" width="8" height="1.6"/><rect x="30.5" y="23.2" width="7.5" height="1.7"/>';
  const initials = () => String(t((DATA.basics || {}).initials) || 'TH').trim();
  const markSvg = (cls) => (initials().toUpperCase() === 'TH'
    ? `<span class="mark ${cls}" aria-hidden="true"><svg viewBox="5 9 40 30">${MARK}</svg></span>`
    : `<span class="seal ${cls}" aria-hidden="true">${esc(initials())}</span>`);
  const seal = () => markSvg('mark-sm');
  const pixelSeal = () => markSvg('mark-hero px-seal');   // 名字沿用：开场里「拼合」动画找的是 .px-seal 里的 rect

  /* 首屏大标题：把「轮播关键词」的最后一个词替换成可轮播的位置；找不到这个词就按原样显示 */
  function headlineHtml(b) {
    const words = list((DATA.hero || {}).rotatingWords).map((w) => String(t(w)).trim()).filter(Boolean);
    const raw = String(t(b.headline) || ''), fin = words[words.length - 1], at = fin ? raw.indexOf(fin) : -1;
    if (words.length < 2 || at < 0) return rich(b.headline);
    const slot = `<span class="rot" data-rot><span class="rot-strut">&#8203;</span>${words.map((w, i) => `<span class="rot-w"${i === words.length - 1 ? ' data-final' : ''}>${esc(w)}</span>`).join('')}</span>`;
    return rich(raw.slice(0, at)) + slot + rich(raw.slice(at + fin.length));
  }
  const universeHtml = () => {
    const photos = list((DATA.hero || {}).universePhotos).map(t).filter(Boolean);
    return photos.length ? `<div class="universe" aria-hidden="true"${E('hero.universePhotos')}><div class="u-stage">${photos.map((p) => `<figure class="u-card"><img ${imgSrc(p, '(max-width: 700px) 130px, 220px')} alt="" decoding="async" /></figure>`).join('')}</div></div>` : '';
  };

  /* ================= 2. 渲染 ================= */
  const app = $('#app');
  const secIndex = (id) => list(DATA.sections).findIndex((s) => s && s.id === id);
  const enLabel = (s) => String((s.nav && s.nav.en) || (s.title && String(s.title.en || '').replace(/\*/g, '')) || s.id);

  function renderNav(sections, away) {
    const b = DATA.basics || {};
    const to = (id) => (away ? `./#${id}" data-route="" data-hash="${id}` : `#${id}`);   // 案例页里，导航链接回到首页对应板块
    return `
    <a class="skip" href="#main">${lang === 'zh' ? '跳到正文' : 'Skip to content'}</a>
    <nav class="nav" id="nav" aria-label="${lang === 'zh' ? '主导航' : 'Primary'}">
      <div class="wrap nav-row">
        <a class="brand" href="${to('top')}" aria-label="${plain(b.brand || b.name)} — ${lang === 'zh' ? '回到首页' : 'home'}"${E('basics.brand')}>${seal()}<span class="brand-name">${plain(b.brand || b.name)}</span></a>
        <div class="nav-links" id="nav-links">
          ${sections.map((s, i) => `<a href="${to(esc(s.id))}" data-link="${esc(s.id)}"${E(`sections.${secIndex(s.id)}.nav`)}><span class="n">${pad(i + 1)}</span>${T(s.nav || s.title)}</a>`).join('')}
        </div>
        <div class="nav-tools">
          <button class="lang-btn" data-lang-toggle aria-label="中 / EN — ${lang === 'zh' ? 'Switch to English' : '切换到中文'}">${lang === 'zh' ? '<b>中</b> / EN' : '中 / <b>EN</b>'}</button>
          <button class="icon-btn theme-btn" id="theme-btn" aria-label="${lang === 'zh' ? '切换深浅色' : 'Toggle dark mode'}"><span class="moon">${icon('moon')}</span><span class="sun">${icon('sun')}</span></button>
          ${sections.some((s) => s.id === 'contact') ? `<a class="nav-cta" href="${to('contact')}">${ui('ctaContact')} ${icon('arrowUR')}</a>` : ''}
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${icon('menu')}</button>
        </div>
      </div>
    </nav>`;
  }

  function renderHero(hasWork) {
    const b = DATA.basics || {};
    return `
    <header class="hero" id="top" data-anchor="top">
      ${universeHtml()}
      <div class="wrap">
        <div class="hero-grid">
          <div>
            <p class="hero-name rv"${E('basics.name')}>${pixelSeal()}<span><strong>${plain(b.name)}</strong>&nbsp; ${plain(b.altName)}</span></p>
            <h1 class="hero-title rv" style="--d:1" aria-label="${plain(b.headline)}"${E('basics.headline')}>${headlineHtml(b)}</h1>
            ${has(b.slogan) ? `<p class="hero-slogan rv" style="--d:2"${E('basics.slogan')}>${rich(b.slogan)}</p>` : ''}
            <div class="hero-cta rv" style="--d:3">
              ${hasWork ? `<a class="btn primary" href="#experience"${E('ui.ctaWork')}>${ui('ctaWork')} ${icon('arrow')}</a>` : ''}
              ${has(b.resume) ? `<a class="btn" href="${esc(t(b.resume))}" download${E('basics.resume')}>${ui('downloadCv')} ${icon('arrowDown')}</a>` : ''}
              <a class="link" href="#contact"${E('ui.ctaContact')}>${ui('ctaContact')} ${icon('arrowUR')}</a>
            </div>
          </div>
          ${has(b.avatar) ? `
          <figure class="portrait rv" style="--d:1"${E('basics.avatar')}>
            <span class="orbit" aria-hidden="true"><i></i></span>
            <div class="frame img-rv"><img ${imgSrc(t(b.avatar), '(max-width: 900px) 180px, 260px')} alt="${T(b.avatarAlt) || plain(b.name)}" fetchpriority="high" /></div>
          </figure>` : ''}
        </div>
        ${list(DATA.stats).some((s) => has(s.value)) ? `
        <dl class="proof rv" style="--d:4" data-count>
          ${each(DATA.stats, (s) => has(s.value), (s, i) => `
            <div${E(`stats.${i}`)}>
              <dt class="sr-only">${T(s.label)}</dt>
              <dd><div class="proof-num">${has(s.prefix) ? `<span class="pre">${T(s.prefix)}</span>` : ''}<span class="count" data-to="${esc(t(s.value))}">${T(s.value)}</span>${has(s.suffix) ? `<small>${T(s.suffix)}</small>` : ''}</div>
              <div class="proof-label" aria-hidden="true">${T(s.label)}</div></dd>
            </div>`)}
        </dl>` : ''}
      </div>
    </header>`;
  }

  const kpisHtml = (arr, base, max) => {
    const items = list(arr).map((x, i) => [x, i]).filter(([x]) => has(x.value)).slice(0, max || 99);
    return items.length ? `<div class="kpis">${items.map(([x, i]) => `<div class="kpi"${E(`${base}.${i}`)}><b>${T(x.value)}</b><span>${T(x.label)}</span></div>`).join('')}</div>` : '';
  };
  const stepsHtml = (arr, base) => {
    const ok = (x) => has(x) || (x && (has(x.text) || has(x.title)));
    return list(arr).some(ok) ? `<ol class="steps-list">${each(arr, ok, (x, i) => {
      const body = x && !isI18n(x) && (x.title || x.text) ? `${has(x.title) ? `<strong>${T(x.title)}</strong>` : ''}${T(x.text)}` : T(x);
      return `<li${E(`${base}.${i}`)}><div>${body}</div></li>`;
    })}</ol>` : '';
  };
  /* 内容中的照片：点击可放大；alt 来自 profile.js */
  const ctxPhoto = (x, base, small) => (has(x.image) ? `
    <button class="ctx-photo${small ? ' small' : ''}" data-zoom data-src="${esc(bigSrc(t(x.image)))}" data-cap="${T(x.imageAlt)}" aria-label="${ui('enlarge')}: ${T(x.imageAlt)}"${E(`${base}.image`)}>
      <img ${imgSrc(t(x.image), '(max-width: 600px) 90vw, 360px')} alt="${T(x.imageAlt)}" loading="lazy" decoding="async" /><span class="zoom" aria-hidden="true">${icon('plus')}</span>
    </button>` : '');
  /* 照片按屏幕选尺寸：发布版里 build.py 会生成 480 / 960 / 1600 宽的 WebP，并把清单放进 window.IMAGES；
     本地预览没有清单时直接用原图。sizes = 这张图在页面上大约显示多宽，浏览器据此挑最合适的文件 */
  const IMGS = () => window.IMAGES || {};
  function imgSrc(path, sizes) {
    const m = IMGS()[path];
    if (!m) return `src="${esc(path)}"`;
    if (!list(m.v).length) return `src="${esc(path)}" width="${m.w}" height="${m.h}"`;   // Logo 等小图：只标尺寸，避免加载时页面跳动
    const mid = m.v[Math.min(1, m.v.length - 1)][1];
    return `src="${esc(mid)}" srcset="${m.v.map(([w, f]) => `${esc(f)} ${w}w`).join(', ')}" sizes="${sizes}" width="${m.w}" height="${m.h}"`;
  }
  const bigSrc = (path) => { const m = IMGS()[path]; return m && list(m.v).length ? m.v[m.v.length - 1][1] : path; };   // 点开看大图时用

  const tagsHtml = (arr, base) => (list(arr).some(has) ? `<div class="tags"${E(base)}>${list(arr).filter(has).map((x) => `<span>${T(x)}</span>`).join('')}</div>` : '');

  /* 案例右侧的视觉：优先使用真实图片；没有图片时用基于真实数据的图表 */
  function visualHtml(c, ci) {
    const v = c.visual || {}; const P = `cases.${ci}.visual`;
    const head = `<div class="visual-head mono"><span${E(`${P}.title`)}>${T(v.title)}</span><span>Fig. ${pad(ci + 1)}</span></div>`;
    const foot = has(v.note) ? `<p class="visual-foot"${E(`${P}.note`)}>${T(v.note)}</p>` : '';
    if (has(v.image)) {
      return `<figure class="visual visual-img rv"${E(`${P}.image`)}><img ${imgSrc(t(v.image), '(max-width: 900px) 100vw, 920px')} alt="${T(v.imageAlt)}" loading="lazy" decoding="async" />${has(v.title) ? `<figcaption>${T(v.title)}</figcaption>` : ''}</figure>`;
    }
    /* 像素图表：每个小方块带一个 data-t（0–1，滚动进度达到它时点亮），文字标记带 data-at（进度到了才亮）。
       不运行动画时（无 JS / 减少动态效果）方块默认全亮，图表照样完整。 */
    const cell = (tt) => `<i class="px" data-t="${tt.toFixed(3)}"></i>`;
    let body = '';
    if (v.type === 'bars') {
      const COLS = 48, items = list(v.items).map((x, i) => [x, i]).filter(([x]) => has(x.label));
      const max = Math.max(1, ...items.map(([x]) => Number(x.value) || 0));
      body = `<div class="pxbars">${items.map(([x, i]) => {
        const n = clamp(Math.round(((Number(x.value) || 0) / max) * COLS), 1, COLS);
        const cells = Array.from({ length: COLS }, (_, c) => (c < n ? cell(c / COLS) : '<i class="px off"></i>')).join('');
        return `<div class="pxbar-row"${E(`${P}.items.${i}`)}><span class="lbl">${T(x.label)}</span><span class="val" data-at="${((n - 1) / COLS).toFixed(3)}">${T(x.display) || T(x.value)}</span>
          <div class="pxbar" aria-hidden="true">${cells}</div></div>`;
      }).join('')}</div>`;
    } else if (v.type === 'loop') {
      const center = v.center || {}, N = 72, steps = list(v.steps).filter(has).slice(0, 4);
      const m = /^(\D*)([\d.]+)(.*)$/.exec(String(t(center.value)));   // 把「50+」拆成 前缀 / 数字 / 后缀，方便随滚动计数
      const dots = Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        return `<i class="px" data-t="${(i / N).toFixed(3)}" style="left:${(50 + 34 * Math.cos(a)).toFixed(2)}%;top:${(50 + 34 * Math.sin(a)).toFixed(2)}%"></i>`; }).join('');
      body = `
        <div class="loop"${E(`${P}.steps`)}>
          <div class="loop-ring" aria-hidden="true">${dots}</div>
          <div class="loop-center"${E(`${P}.center`)}><b${m ? ` data-count-to="${esc(m[2])}" data-pre="${esc(m[1])}" data-suf="${esc(m[3])}"` : ''}>${T(center.value)}</b><span>${T(center.label)}</span></div>
          ${steps.map((st, k) => `<div class="loop-step p${k + 1}" data-at="${(k / 4 + 0.02).toFixed(3)}"><i>${pad(k + 1)}</i>${T(st)}</div>`).join('')}
        </div>
        ${list(v.lineup).some(has) ? `<div class="lineup"${E(`${P}.lineup`)}>${list(v.lineup).filter(has).map((x) => `<span>${T(x)}</span>`).join('')}</div>` : ''}`;
    } else if (v.type === 'ladder') {
      const center = v.center || {}, items = list(v.items).map((x, i) => [x, i]).filter(([x]) => has(x.label));
      const C = 32, R = 10, per = C / Math.max(1, items.length);
      const heights = Array.from({ length: C }, (_, c) => Math.max(1, Math.ceil(R * Math.pow((c + 1) / C, 1.5))));   // 加速增长的曲线
      const total = heights.reduce((a, b) => a + b, 0);
      let k = 0; const groupEnd = [];
      const cols = heights.map((h, c) => { const col = Array.from({ length: h }, () => cell(k++ / total)).join('');
        if ((c + 1) % per < 1 || c === C - 1) groupEnd.push((k - 1) / total); return `<span class="pxcol">${col}</span>`; }).join('');
      body = `
        <div class="ladder">
          <div class="ladder-chart">
            <div class="pxladder" aria-hidden="true">${cols}</div>
            <div class="ladder-axis mono"><span>0</span><span${E(`${P}.center`)} data-at="0.98">${T(center.value)} <small>${T(center.label)}</small></span></div>
          </div>
          <ol>${items.map(([x, i], n) => `<li data-at="${(groupEnd[n] || 1).toFixed(3)}"${E(`${P}.items.${i}`)}><b>${T(x.label)}</b><span>${T(x.display)}</span></li>`).join('')}</ol>
        </div>`;
    }
    return `<div class="visual rv" data-viz${E(P)}>${head}${body}${foot}</div>`;
  }

  /* 生活片段：页面下方一排可滑动的卡片（尺寸统一，按 focus 取景） */
  function galleryHtml() {
    const g = DATA.gallery || {};
    const items = list(g.items).map((x, i) => [x, i]).filter(([x]) => has(x.image));
    if (!items.length) return '';
    return `
    <section class="section gallery-sec" id="gallery" data-anchor="gallery" aria-labelledby="h-gallery"${E('gallery')}>
      <div class="wrap">
        <div class="gallery-head">
          <div>
            <h2 class="gallery-title" id="h-gallery"${E('gallery.title')}>${T(g.title)}</h2>
            ${has(g.intro) ? `<p class="gallery-intro"${E('gallery.intro')}>${T(g.intro)}</p>` : ''}
          </div>
          <div class="gallery-ctrl">
            <span class="count mono" aria-live="polite"><span class="g-cur">01</span> / ${pad(items.length)}</span>
            <button class="g-prev" aria-label="${ui('prev')}">${icon('arrowL')}</button>
            <button class="g-next" aria-label="${ui('next')}">${icon('arrow')}</button>
          </div>
        </div>
        <div class="gallery-track" id="gallery-track" data-lenis-prevent tabindex="0" role="region" aria-label="${T(g.title)} — ${ui('galleryHint')}">
          ${items.map(([x, i], k) => `
            <figure class="g-card"${E(`gallery.items.${i}`)}>
              <button class="g-img" data-zoom data-group="gallery" data-index="${k}" aria-label="${ui('enlarge')}: ${T(x.alt) || T(x.caption)}">
                <img ${imgSrc(t(x.image), '(max-width: 600px) 72vw, 280px')} alt="${T(x.alt)}" loading="lazy" decoding="async" draggable="false" style="object-position:${esc(x.focus || '50% 40%')}" />
              </button>
              <figcaption>
                <span class="mono">${T(x.date)}</span>
                <span class="cap">${T(x.caption)}</span>
                ${has(x.link) ? `<a class="g-link" href="${esc(t(x.link))}">${ui('related')} ${icon('arrow')}</a>` : ''}
              </figcaption>
            </figure>`).join('')}
        </div>
        <div class="g-progress" aria-hidden="true"><i></i></div>
      </div>
    </section>`;
  }

  const RENDERERS = {
    /* C. 职业轨迹 */
    experience() {
      const items = list(DATA.experience).map((e, i) => [e, i]).filter(([e]) => has(e.company));
      if (!items.length) return '';
      const traj = items.slice().reverse().filter(([e]) => has(e.capability));
      return `
      ${traj.length ? `<div class="trajectory rv"><span class="traj-slider" aria-hidden="true"></span><span class="label mono">${ui('trajectory')}</span>${traj.map(([e, i], k) => `${k ? '<span class="traj-arrow" aria-hidden="true">→</span>' : ''}<span class="traj-step"${E(`experience.${i}.capability`)}><i>${esc(String(t(e.period)).slice(0, 4))}</i>${T(e.capability)}</span>`).join('')}</div>` : ''}
      <ol class="jobs">${items.map(([e, i]) => {
        const P = `experience.${i}`;
        const caseObj = list(DATA.cases).find((c) => c.id && c.id === e.caseId);
        return `
        <li class="job rv" id="job-${i}" data-anchor="job-${i}"${E(P)}>
          <div class="job-row"${caseObj ? ` data-go="${esc(caseObj.id)}"` : ''}>
            <div class="job-period mono"${E(`${P}.period`)}>${T(e.period)}</div>
            <div class="job-who">
              ${has(e.logoImage) || has(e.logo) ? `<div class="job-logo${has(e.logoImage) ? '' : ' mono-mark'}"${E(`${P}.${has(e.logoImage) ? 'logoImage' : 'logo'}`)}>${has(e.logoImage) ? `<img ${imgSrc(t(e.logoImage), '140px')} alt="${plain(e.company)} logo" loading="lazy" />` : T(e.logo)}</div>` : ''}
              <h3 class="job-company"${E(`${P}.company`)}>${T(e.company)}</h3>
              <div class="job-role"${E(`${P}.role`)}>${T(e.role)}</div>
              <div class="job-loc"${E(`${P}.location`)}>${T(e.location)}</div>
            </div>
            <div class="job-line"><p${E(`${P}.oneLiner`)}>${T(e.oneLiner || e.summary)}</p>
              ${has(e.capability) || caseObj ? `<div class="job-tags">${has(e.capability) ? `<span class="pill"${E(`${P}.capability`)}>${T(e.capability)}</span>` : ''}${caseObj ? `<a class="link case-link" href="${caseHref(caseObj.id)}" data-route="${esc(caseObj.id)}">${ui('caseStudy')} ${icon('arrow')}</a>` : ''}</div>` : ''}</div>
            <div class="job-kpis">${list(e.metrics).map((m, mi) => [m, mi]).filter(([m]) => has(m.value)).slice(0, 2).map(([m, mi]) => `<div${E(`${P}.metrics.${mi}`)}><b>${T(m.value)}</b><span>${T(m.label)}</span></div>`).join('')}</div>
            ${caseObj
              ? `<a class="job-toggle job-go" href="${caseHref(caseObj.id)}" data-route="${esc(caseObj.id)}" aria-label="${ui('caseStudy')} — ${plain(e.company)}">${icon('arrow')}</a>`
              : `<button class="job-toggle" aria-expanded="false" aria-controls="jd-${i}" aria-label="${ui('showMore')} — ${plain(e.company)}"><span class="pm" aria-hidden="true"></span></button>`}
          </div>
          <div class="collapse" id="jd-${i}"><div>
            <div class="job-detail">
              ${stepsHtml(e.bullets, `${P}.bullets`)}
              <div class="job-detail-foot">
                ${list(e.details).some(has) ? `<ul class="extra"${E(`${P}.details`)}>${list(e.details).filter(has).map((d) => `<li>${T(d)}</li>`).join('')}</ul>` : ''}
                ${tagsHtml(e.tags, `${P}.tags`)}
              </div>
            </div>
          </div></div>
        </li>`;
      }).join('')}</ol>`;
    },

    /* D. 工作之外 */
    beyond() {
      const groups = list((DATA.beyond || {}).groups).filter((g) => has(g.title));
      const p = DATA.projects || {};
      const catLabel = (id) => { const c = list(p.categories).find((x) => x.id === id); return c ? T(c.label) : ''; };
      const projFeat = (x, i) => `
        <article class="feat"${E(`projects.items.${i}`)}>
          <div class="feat-meta mono"><span>${T(x.period)}</span>${has(x.award) ? `<span class="pill">${T(x.award)}</span>` : ''}<span>${catLabel(x.category)}</span></div>
          <h3>${T(x.title)}</h3>
          <div class="role">${T(x.role)}</div>
          <p class="desc">${T(x.description)}</p>
          ${ctxPhoto(x, `projects.items.${i}`)}
          ${tagsHtml(x.tags, `projects.items.${i}.tags`)}
          ${has(x.link) ? `<a class="link" href="${esc(t(x.link))}" target="_blank" rel="noopener">Link ${icon('arrowUR')}</a>` : ''}
        </article>`;
      const projCompact = (x, i) => `
        <details data-key="projects.items.${i}"${E(`projects.items.${i}`)}>
          <summary><span class="yr mono">${esc(String(t(x.period)).slice(0, 7))}</span><span class="t">${T(x.title)}</span><span class="aw">${T(x.award) || T(x.role)}</span><span class="pm" aria-hidden="true"></span></summary>
          <div class="body"><p>${T(x.role)}${has(x.role) ? ' · ' : ''}${T(x.description)}</p>${tagsHtml(x.tags)}${ctxPhoto(x, `projects.items.${i}`, true)}</div>
        </details>`;
      const paperFeat = (x, i) => `
        <article class="feat"${E(`publications.${i}`)}>
          <div class="feat-meta mono"><span>${T(x.year)}</span>${has(x.role) ? `<span class="pill">${T(x.role)}</span>` : ''}<span>${T(x.issn)}</span></div>
          <h3 lang="en">${T(x.title)}</h3>
          <div class="role">${T(x.venue)}</div>
          ${stepsHtml(x.points, `publications.${i}.points`)}
          ${has(x.link) ? `<a class="link" href="${esc(t(x.link))}" target="_blank" rel="noopener">${ui('readPaper')} ${icon('arrowUR')}</a>` : ''}
        </article>`;
      const leadFeat = (x, i) => `
        <article class="feat"${E(`leadership.${i}`)}>
          <div class="feat-meta mono"><span>${T(x.period)}</span></div>
          <h3>${T(x.role)}</h3>
          <div class="role">${T(x.org)}</div>
          ${kpisHtml(x.metrics, `leadership.${i}.metrics`, 4)}
          ${stepsHtml(x.bullets, `leadership.${i}.bullets`)}
          ${ctxPhoto(x, `leadership.${i}`)}
        </article>`;
      const leadCompact = (x, i) => `
        <details data-key="leadership.${i}"${E(`leadership.${i}`)}>
          <summary><span class="yr mono">${esc(String(t(x.period)).slice(0, 7))}</span><span class="t">${T(x.role)}</span><span class="aw">${T(x.org)}</span><span class="pm" aria-hidden="true"></span></summary>
          <div class="body">${list(x.metrics).some((m) => has(m.value)) ? `<p class="tags">${list(x.metrics).filter((m) => has(m.value)).map((m) => `<span>${T(m.value)} ${T(m.label)}</span>`).join('')}</p>` : ''}${list(x.bullets).filter(has).map((b) => `<p>${T(b)}</p>`).join('')}${ctxPhoto(x, `leadership.${i}`, true)}</div>
        </details>`;

      const blocks = groups.map((g, k) => {
        let feats = '', compact = '';
        if (g.id === 'ventures' || g.id === 'research') {
          const pick = (feat) => each(p.items, (x) => has(x.title) && (x.group || 'ventures') === g.id && !!x.featured === feat, feat ? projFeat : projCompact);
          feats = (g.id === 'research' ? each(DATA.publications, (x) => has(x.title), paperFeat) : '') + pick(true);
          compact = pick(false);
        } else if (g.id === 'leadership') {
          feats = each(DATA.leadership, (x) => (has(x.role) || has(x.org)) && x.featured, leadFeat);
          compact = each(DATA.leadership, (x) => (has(x.role) || has(x.org)) && !x.featured, leadCompact);
        }
        if (!feats && !compact) return '';
        const gi = list((DATA.beyond || {}).groups).indexOf(g);
        return `
        <div class="bw-group rv" data-anchor="bw-${esc(g.id)}"${E(`beyond.groups.${gi}`)}>
          <div><div class="bw-label mono">D.${k + 1}</div><h3 class="bw-title">${T(g.title)}</h3>${has(g.intro) ? `<p class="bw-intro">${T(g.intro)}</p>` : ''}</div>
          <div>${feats ? `<div class="feats">${feats}</div>` : ''}${compact ? `<div class="compact">${compact}</div>` : ''}</div>
        </div>`;
      }).join('');
      return blocks ? `<div class="bw">${blocks}</div>` : '';
    },

    /* E. 关于我 */
    /* 故事（戏剧社等）：封面卡片，点进去是故事详情页；没有填内容时整个板块和导航项都不显示 */
    stories() {
      const items = storyItems();
      if (!items.length) return '';
      return `<div class="story-grid">${items.map(([x, i]) => `
        <a class="story-card rv" href="${storyHref(x.slug)}" data-route="${esc(x.slug)}" data-kind="story"${E(`stories.items.${i}`)}>
          ${has(x.cover) ? `<div class="story-cover"><img ${imgSrc(t(x.cover), '(max-width: 760px) 100vw, 640px')} alt="${T(x.coverAlt)}" loading="lazy" decoding="async" /></div>` : ''}
          <div class="story-meta mono">${has(x.period) ? `<span>${T(x.period)}</span>` : ''}${has(x.org) ? `<span>${T(x.org)}</span>` : ''}</div>
          <h3 class="story-title">${rich(x.title)}</h3>
          ${has(x.summary) ? `<p class="story-sum">${T(x.summary)}</p>` : ''}
          <span class="link">${ui('readStory')} ${icon('arrow')}</span>
        </a>`).join('')}</div>`;
    },

    profile() {
      const a = DATA.about || {}; const b = DATA.basics || {}; const s = DATA.skills || {};
      const paras = list(a.paragraphs).map((p, i) => [p, i]).filter(([p]) => has(p));
      const romans = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'];
      let n = 0; const sub = (label) => `<div class="sub-h mono"><b>E.${++n}</b><span>${label}</span></div>`;
      return `
      <div class="profile-grid">
        <aside class="profile-side">
          ${has(b.avatarFormal) ? `<figure${E('basics.avatarFormal')}><div class="frame img-rv"><img ${imgSrc(t(b.avatarFormal), '(max-width: 560px) 240px, (max-width: 900px) 200px, 380px')} loading="lazy" alt="${T(b.avatarAlt) || plain(b.name)}" loading="lazy" /></div></figure>` : ''}
          <dl class="facts">${each(a.facts, (f) => shown(f) && has(f.value), (f, i) => `<div${E(`about.facts.${i}`)}><dt class="mono">${T(f.label)}</dt><dd>${T(f.value)}</dd></div>`)}</dl>
        </aside>
        <div>
          ${paras.length ? `<p class="lead rv"${E(`about.paragraphs.${paras[0][1]}`)}>${T(paras[0][0])}</p>` : ''}
          ${paras.length > 1 ? `<div class="prose">${paras.slice(1).map(([p, i]) => `<p class="rv"${E(`about.paragraphs.${i}`)}>${T(p)}</p>`).join('')}</div>` : ''}

          ${list(a.highlights).some((h) => has(h.title)) ? `${sub(ui('principles'))}
          <div class="principles">${each(a.highlights, (h) => has(h.title), (h, i, k) => `<div class="principle rv" style="--d:${k % 2}"${E(`about.highlights.${i}`)}><span class="no">${romans[k] || k + 1}</span><h3>${T(h.title)}</h3><p>${T(h.text)}</p></div>`)}</div>` : ''}

          ${list(DATA.education).some((e) => has(e.school)) ? `${sub(ui('education'))}
          <div>${each(DATA.education, (e) => has(e.school), (e, i) => `
            <div class="edu rv"${E(`education.${i}`)}>
              <div class="edu-logo">${has(e.logoImage) ? `<img ${imgSrc(t(e.logoImage), '64px')} alt="${plain(e.school)} logo" loading="lazy" />` : ''}</div>
              <div>
                <h3>${T(e.school)}</h3>
                ${has(e.schoolAlt) ? `<div class="alt">${T(e.schoolAlt)}</div>` : ''}
                <div class="deg">${T(e.degree)}</div>
                <div class="dept">${T(e.dept)}${has(e.location) ? ` · ${T(e.location)}` : ''}</div>
                ${list(e.badges).some(has) ? `<div class="badges">${list(e.badges).filter(has).map((x) => `<span class="pill">${T(x)}</span>`).join('')}</div>` : ''}
                ${list(e.details).some(has) ? `<p class="note">${list(e.details).filter(has).map(T).join(' · ')}</p>` : ''}
                ${list(e.courses).some(has) ? `<p class="courses">${ui('courses')}：${list(e.courses).filter(has).map(T).join(' · ')}</p>` : ''}
                ${ctxPhoto(e, `education.${i}`)}
              </div>
              <div class="when mono">${T(e.period)}</div>
            </div>`)}</div>` : ''}

          ${list(DATA.awards).some((x) => has(x.title)) ? `${sub(ui('honours'))}
          <ul class="honours">${each(DATA.awards, (x) => has(x.title), (x, i) => `<li class="rv"${E(`awards.${i}`)}><span class="d mono">${T(x.date)}</span><span class="t">${T(x.title)}<br><span class="o">${T(x.org)}</span></span><span class="n">${T(x.note)}</span></li>`)}</ul>` : ''}

          ${list(s.toolkit).length ? `${sub(ui('toolkit'))}
          <div class="kit rv">${each(s.toolkit, (g) => list(g.items).some(has), (g, i) => `<div${E(`skills.toolkit.${i}`)}><h4>${T(g.name)}</h4><ul>${list(g.items).filter(has).map((x) => `<li>${T(x)}</li>`).join('')}</ul></div>`)}</div>` : ''}
          <div class="kv-grid rv">
            ${list(s.languages).some((l) => has(l.name)) ? `<div class="kv"><h4>${ui('languages')}</h4><ul>${each(s.languages, (l) => has(l.name), (l, i) => `<li${E(`skills.languages.${i}`)}><span>${T(l.name)}</span><span>${T(l.level)}</span></li>`)}</ul></div>` : ''}
            ${list(s.certificates).some((c) => has(c.name)) ? `<div class="kv"><h4>${ui('certificates')}</h4><ul>${each(s.certificates, (c) => has(c.name), (c, i) => `<li${E(`skills.certificates.${i}`)}><span>${T(c.name)}</span><span>${T(c.score)}</span></li>`)}</ul></div>` : ''}
          </div>
        </div>
      </div>`;
    },

    /* F. 联系 */
    contact(s, n) {
      const c = DATA.contact || {}; const b = DATA.basics || {};
      const email = t(b.email);
      return {
        raw: `
        <div class="closing">
          <div>
            <div class="sec-num mono" style="margin-bottom:28px"><b>Nº ${pad(n)}</b><span>${esc(enLabel(s))}</span></div>
            <h2 class="rv" id="h-contact"${E('contact.headline')}>${rich(c.headline)}</h2>
            ${has(c.text) ? `<p class="text rv"${E('contact.text')}>${T(c.text)}</p>` : ''}
            <div class="actions rv">
              ${email ? `<a class="btn primary" href="mailto:${esc(email)}"${E('basics.email')}>${esc(email)} ${icon('arrowUR')}</a>` : ''}
              ${has(b.resume) ? `<a class="btn" href="${esc(t(b.resume))}" download${E('basics.resume')}>${ui('downloadCv')} ${icon('arrowDown')}</a>` : ''}
            </div>
          </div>
          <ul class="c-list rv">
            ${each(DATA.contacts, (x) => shown(x) && has(x.value), (x, i) => `
              <li${E(`contacts.${i}`)}>
                <span class="k mono">${T(x.label)}</span>
                <span class="v">${T(x.value)}</span>
                <span class="c-act">
                  ${x.copy ? `<button data-copy="${T(x.value)}" aria-label="${ui('copy')} ${T(x.label)}" title="${ui('copy')}">${icon('copy')}</button>` : ''}
                  ${has(x.link) ? `<a href="${esc(t(x.link))}" ${/^https?:/.test(t(x.link)) ? 'target="_blank" rel="noopener"' : ''} aria-label="${T(x.label)}">${icon('arrowUR')}</a>` : ''}
                </span>
              </li>`)}
          </ul>
        </div>`
      };
    }
  };

  /* 案例详情页（index.html?case=anker）：首页只放经历摘要，完整故事在这里按「挑战 → 角色 → 方法 → 结果」讲 */
  const detailHref = (k, id) => { const u = new URLSearchParams(location.search); u.delete('case'); u.delete('story'); u.set(k, id); return '?' + esc(u.toString()); };
  const caseHref = (id) => detailHref('case', id);
  const storyHref = (id) => detailHref('story', id);
  /* 案例的滚动叙事：挑战 → 方法 → 结果。左边（手机上是顶部）是固定的章节目录 + 进度线，读到哪章亮哪章 */
  function storyHtml(c, P) {
    const chapters = [
      [ui('challenge'), has(c.challenge) ? `<p class="cs-lead">${T(c.challenge)}</p>` : '', `${P}.challenge`],
      [ui('approach'), (has(c.role) ? `<p class="cs-role"${E(`${P}.role`)}><span class="mono">${ui('role')}</span>${T(c.role)}</p>` : '') + stepsHtml(c.approach, `${P}.approach`), ''],
      [ui('outcome'), has(c.outcome) ? `<p class="cs-lead">${T(c.outcome)}</p>` : '', `${P}.outcome`]
    ].filter(([, body]) => body);
    if (!chapters.length) return '';
    return `
        <div class="cs-story">
          <aside class="cs-chapters" aria-hidden="true">
            <div class="cs-meter"><i></i></div>
            <ol>${chapters.map(([label], k) => `<li data-ch="${k}"><span class="n">${pad(k + 1)}</span>${label}</li>`).join('')}</ol>
          </aside>
          <div class="cs-chapter-list">${chapters.map(([label, body, path], k) => `
            <section class="cs-chapter" data-ch="${k}"${path ? E(path) : ''}>
              <h2 class="cs-label mono"><span class="n">${pad(k + 1)}</span> ${label}</h2>
              <div class="cs-content">${body}</div>
            </section>`).join('')}
          </div>
        </div>`;
  }

  /* 故事详情页（index.html?story=drama）：开头 → 关键数字 → 封面 → 时间线（每个事件：文字 + 照片 / 视频）→ 收获 */
  const storyItems = () => list((DATA.stories || {}).items).map((x, i) => [x, i]).filter(([x]) => x && x.show !== false && has(x.title) && has(x.slug));
  const embed = (src) => `<div class="story-embed"><iframe src="${esc(src)}" title="Video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  function videoHtml(url) {
    const u = String(url || '').trim(); let m;
    if (!u) return '';
    if ((m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(u))) return embed(`https://www.youtube-nocookie.com/embed/${m[1]}`);
    if ((m = /bilibili\.com\/video\/(BV\w+)/i.exec(u))) return embed(`https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=0&high_quality=1`);
    if (/\.(mp4|webm)(\?|$)/i.test(u)) return `<video class="story-video" src="${esc(u)}" controls preload="none" playsinline></video>`;
    return `<a class="link" href="${esc(u)}" target="_blank" rel="noopener">${ui('watchVideo')} ${icon('arrowUR')}</a>`;
  }
  function storyPage(x, si) {
    const P = `stories.items.${si}`;
    const events = list(x.events).map((e, k) => [e, k]).filter(([e]) => e && (has(e.title) || has(e.text) || list(e.images).some(has) || has(e.video)));
    const all = storyItems(), at = all.findIndex(([y]) => y === x), next = all.length > 1 ? all[(at + 1) % all.length][0] : null;
    const photo = (src, cap) => `<button class="ev-photo" data-zoom data-src="${esc(bigSrc(t(src)))}" data-cap="${esc(cap)}" aria-label="${ui('enlarge')}"><img ${imgSrc(t(src), '(max-width: 760px) 100vw, 420px')} alt="${esc(cap)}" loading="lazy" decoding="async" /></button>`;
    return `
    <article class="cs story-page" data-anchor="story-top">
      <div class="wrap">
        <a class="cs-back mono" href="./#stories" data-route="" data-hash="stories">${icon('arrowL')} ${ui('backToStories')}</a>
        <header class="cs-head">
          <div class="case-meta mono rv">
            ${has(x.period) ? `<span${E(`${P}.period`)}>${T(x.period)}</span>` : ''}${has(x.org) ? `<span${E(`${P}.org`)}>${T(x.org)}</span>` : ''}${has(x.role) ? `<span class="case-no"${E(`${P}.role`)}>${T(x.role)}</span>` : ''}
          </div>
          <h1 class="cs-title rv"${E(`${P}.title`)}>${rich(x.title)}</h1>
          ${has(x.summary) ? `<p class="cs-summary rv" style="--d:1"${E(`${P}.summary`)}>${T(x.summary)}</p>` : ''}
        </header>
        <div class="cs-kpis rv" style="--d:2">${kpisHtml(x.numbers, `${P}.numbers`)}</div>
        ${has(x.cover) ? `<figure class="story-hero rv"${E(`${P}.cover`)}>${photo(x.cover, t(x.coverAlt) || plain(x.title))}</figure>` : ''}
        ${events.length ? `
        <section class="story-timeline">
          <h2 class="cs-label mono">${ui('timeline')}</h2>
          <ol>${events.map(([e, k]) => {
            const imgs = list(e.images).filter(has);
            return `
            <li class="story-event rv"${E(`${P}.events.${k}`)}>
              <div class="ev-date mono">${T(e.date)}</div>
              <div class="ev-body">
                ${has(e.title) ? `<h3 class="ev-title">${rich(e.title)}</h3>` : ''}
                ${has(e.text) ? `<p class="ev-text">${T(e.text)}</p>` : ''}
                ${imgs.length ? `<div class="ev-photos n${Math.min(3, imgs.length)}">${imgs.map((im) => photo(im, plain(e.title))).join('')}</div>` : ''}
                ${has(e.video) ? videoHtml(t(e.video)) : ''}
              </div>
            </li>`;
          }).join('')}</ol>
        </section>` : ''}
        ${list(x.takeaways).some(has) ? `<section class="cs-block rv"${E(`${P}.takeaways`)}><h2 class="cs-label mono">${ui('takeaways')}</h2><div class="cs-content">${stepsHtml(x.takeaways, `${P}.takeaways`)}</div></section>` : ''}
        ${next ? `
        <a class="cs-next rv" href="${storyHref(next.slug)}" data-route="${esc(next.slug)}" data-kind="story">
          <span class="mono">${ui('nextStory')}</span><b>${rich(next.title)}</b>${icon('arrow')}
        </a>` : ''}
      </div>
    </article>`;
  }

  function casePage(c) {
    const ci = list(DATA.cases).indexOf(c), P = `cases.${ci}`;
    const exp = list(DATA.experience).find((e) => e.caseId === c.id);
    const ei = list(DATA.experience).indexOf(exp), EP = `experience.${ei}`;
    const block = (label, body, path) => (body ? `<section class="cs-block rv"${path ? E(path) : ''}><h2 class="cs-label mono">${label}</h2><div class="cs-content">${body}</div></section>` : '');
    const others = list(DATA.cases).filter((x) => has(x.title));
    const next = others[(others.indexOf(c) + 1) % others.length];
    return `
    <article class="cs" data-anchor="case-top">
      <div class="wrap">
        <a class="cs-back mono" href="./#experience" data-route="" data-hash="experience">${icon('arrowL')} ${ui('backToWork')}</a>
        <header class="cs-head">
          <div class="case-meta mono rv">
            <span class="case-no"${E(`${P}.label`)}>${T(c.label)}</span><span${E(`${P}.company`)}>${T(c.company)}</span>
            <span${E(`${P}.period`)}>${T(c.period)}</span><span${E(`${P}.sector`)}>${T(c.sector)}</span>
          </div>
          <h1 class="cs-title rv"${E(`${P}.title`)}>${rich(c.title)}</h1>
          ${has(c.summary) ? `<p class="cs-summary rv" style="--d:1"${E(`${P}.summary`)}>${T(c.summary)}</p>` : ''}
        </header>
        <div class="cs-kpis rv" style="--d:2">${kpisHtml(c.metrics, `${P}.metrics`)}</div>
        <div class="cs-visual">${visualHtml(c, ci)}</div>
        ${storyHtml(c, P)}
        <div class="cs-body">
          ${exp ? block(ui('inDetail'), stepsHtml(exp.bullets, `${EP}.bullets`) + (list(exp.details).some(has) ? `<ul class="extra"${E(`${EP}.details`)}>${list(exp.details).filter(has).map((d) => `<li>${T(d)}</li>`).join('')}</ul>` : '')) : ''}
          ${block(ui('tools'), tagsHtml(c.tools, `${P}.tools`))}
        </div>
        ${next && next !== c ? `
        <a class="cs-next rv" href="${caseHref(next.id)}" data-route="${esc(next.id)}">
          <span class="mono">${ui('nextCase')} · ${T(next.label)}</span>
          <b>${rich(next.title)}</b>${icon('arrow')}
        </a>` : ''}
      </div>
    </article>`;
  }

  function wrapSection(s, n, out) {
    const res = typeof out === 'string' ? { body: out } : out;
    const si = secIndex(s.id);
    return `
    <section class="section" id="${esc(s.id)}" data-section data-anchor="${esc(s.id)}" aria-labelledby="h-${esc(s.id)}">
      <div class="wrap">
        ${res.raw || `
        <div class="sec-rule" data-viz aria-hidden="true">${Array.from({ length: 64 }, (_, k) => `<i class="px" data-t="${(k / 64).toFixed(3)}"></i>`).join('')}</div>
        <header class="sec-head rv">
          <div class="sec-num mono"><b>Nº ${pad(n)}</b><span>${esc(enLabel(s))}</span></div>
          <div>
            <h2 class="sec-title" id="h-${esc(s.id)}"${E(`sections.${si}.title`)}>${rich(s.title)}</h2>
            ${has(s.intro) ? `<p class="sec-intro"${E(`sections.${si}.intro`)}>${T(s.intro)}</p>` : ''}
          </div>
        </header>
        ${res.body}`}
      </div>
    </section>`;
  }

  function renderFooter() {
    const b = DATA.basics || {};
    const showEditor = meta().showEditorLink !== false && !IS_PREVIEW;
    return `
    <footer class="footer">
      <div class="wrap foot-sign">
        <a class="brand" href="${route ? './' : '#top'}"${route ? ' data-route=""' : ''}>${seal()}<span>${plain(b.brand || b.name)}</span></a>
        ${has(b.slogan) ? `<p class="foot-slogan"${E('basics.slogan')}>${rich(b.slogan)}</p>` : ''}
      </div>
      <div class="wrap foot-row">
        <span class="mono">© ${new Date().getFullYear()} · ${ui('footerNote')}</span>
        <div class="foot-links mono">
          <button data-lang-toggle>${lang === 'zh' ? 'English' : '中文'}</button>
          <a href="#" data-top>${ui('backToTop')} ↑</a>
          ${showEditor ? `<a href="editor/index.html">${ui('editLink')}</a>` : ''}
        </div>
      </div>
    </footer>`;
  }

  function lightboxHtml() {
    return `
    <dialog class="lightbox" id="lightbox" aria-label="${ui('enlarge')}">
      <div class="lb-top"><span class="lb-count"></span><button class="lb-btn lb-close" aria-label="${ui('close')}">${icon('close')}</button></div>
      <div class="lb-stage">
        <button class="lb-btn lb-prev" aria-label="${ui('prev')}">${icon('arrowL')}</button>
        <img alt="" />
        <button class="lb-btn lb-next" aria-label="${ui('next')}">${icon('arrow')}</button>
      </div>
      <p class="lb-cap"></p>
    </dialog>`;
  }

  let started = false;
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    if (meta().accent && theme === 'light') document.documentElement.style.setProperty('--accent', meta().accent);
    else document.documentElement.style.removeProperty('--accent');
  }
  function render(opts = {}) {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyTheme();
    document.title = String(t(meta().title) || t((DATA.basics || {}).name) || 'Portfolio').replace(/\*/g, '');
    const md = $('meta[name="description"]'); if (md) md.setAttribute('content', t(meta().description));

    const sections = list(DATA.sections).filter((s) => s && s.enabled !== false && RENDERERS[s.id]);
    const blocks = []; const visible = [];
    sections.forEach((s) => {
      if (s.id === 'contact') blocks.push(galleryHtml());
      const out = RENDERERS[s.id](s, visible.length + 1); if (out) { visible.push(s); blocks.push(wrapSection(s, visible.length, out)); }
    });
    if (!sections.some((s) => s.id === 'contact')) blocks.push(galleryHtml());

    teardown();
    document.documentElement.classList.toggle('photos-mono', meta().photoStyle === 'mono');
    const cs = kind === 'case' && route && list(DATA.cases).find((c) => c && c.id === route && has(c.title));
    const stEntry = kind === 'story' && route && storyItems().find(([x]) => x.slug === route);
    if (route && !cs && !stEntry) route = '';
    const pageTitle = cs ? cs.title : stEntry ? stEntry[0].title : null;
    if (pageTitle) document.title = String(t(pageTitle)).replace(/\*/g, '') + ' · ' + plain((DATA.basics || {}).brand || (DATA.basics || {}).name);
    // 正式网址：首页 = 根网址；案例 / 故事页 = 各自的 ?case= / ?story= 网址（不带语言等其它参数）
    const canon = $('link[rel="canonical"]');
    if (canon && /^https?:/.test(location.protocol)) canon.setAttribute('href', location.origin + location.pathname + (route ? `?${kind}=${encodeURIComponent(route)}` : ''));
    app.innerHTML = cs || stEntry
      ? renderNav(visible, true) + '<main id="main">' + (cs ? casePage(cs) : storyPage(stEntry[0], stEntry[1])) + '</main>' + renderFooter() + lightboxHtml()
      : renderNav(visible) + '<main id="main">' + renderHero(visible.some((s) => s.id === 'experience')) + blocks.join('') + '</main>' + renderFooter() + lightboxHtml();
    bindUI();
    if (started) startMotion(opts.instant);
    if (IS_PREVIEW && focusPath) setFocus(focusPath, false);
  }

  /* ================= 3. 交互与动效（克制） ================= */
  const cleanups = [];
  function teardown() { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* ignore */ } } }

  function reveal(el, instant) {
    el.classList.add('in');
    if (el.hasAttribute('data-count')) {
      if (!instant) $$('.proof-num', el).forEach((n, k) => pixelStream(n, k * 0.12));   // 先取样（此时显示的还是最终数字），再开始计数
      $$('.count', el).forEach((c) => countUp(c, instant));
    }
  }
  function initReveal(instant) {
    const els = $$('.rv, .img-rv, [data-viz]').filter((el) => !el.closest('.hero.intro'));   // 首屏开场期间由开场动画负责显示
    if (instant || reduceMotion || !('IntersectionObserver' in window)) { els.forEach((el) => reveal(el, true)); return; }
    const targets = new Map();   // 被 clip-path 裁掉的图片观察父元素
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      (targets.get(en.target) || []).forEach((el) => reveal(el));
      io.unobserve(en.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => {
      if (el.getBoundingClientRect().bottom < 0) { reveal(el, true); return; }
      const target = el.classList.contains('img-rv') ? el.parentElement : el;
      if (!targets.has(target)) { targets.set(target, []); io.observe(target); }
      targets.get(target).push(el);
    });
    cleanups.push(() => io.disconnect());
  }

  function countUp(el, instant) {
    const raw = String(el.dataset.to || '0'); const to = parseFloat(raw.replace(/,/g, ''));
    if (isNaN(to)) return;
    const dec = (raw.split('.')[1] || '').length;
    if (instant || reduceMotion) { el.textContent = raw; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (now) => { const p = clamp((now - t0) / dur, 0, 1); el.textContent = p === 1 ? raw : (to * (1 - Math.pow(1 - p, 3))).toFixed(dec); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function initClock() {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
    const tick = () => $$('[data-clock]').forEach((c) => { c.textContent = fmt.format(new Date()); });
    tick(); const id = setInterval(tick, 30000);
    cleanups.push(() => clearInterval(id));
  }

  function initScroll() {
    const nav = $('#nav'), progress = $('#progress');
    const links = $$('#nav-links a'), sections = $$('[data-section]');
    let lastY = window.scrollY, ticking = false, current = '';
    const update = () => {
      ticking = false;
      const y = window.scrollY, vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
      if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (nav) {
        nav.classList.toggle('scrolled', y > 8);
        if (y > vh * 0.8 && y > lastY + 8 && !nav.classList.contains('open')) nav.classList.add('hidden');
        else if (y < lastY - 8 || y < vh * 0.8) nav.classList.remove('hidden');
      }
      let id = ''; sections.forEach((s) => { if (s.getBoundingClientRect().top <= vh * 0.35) id = s.id; });
      if (id !== current) { current = id; links.forEach((a) => { const on = a.dataset.link === id; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
      lastY = y;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); });
    update();
  }

  /* 展开 / 收起（案例与经历共用） */
  function setOpen(btn, open, instant) {
    const panel = document.getElementById(btn.getAttribute('aria-controls')); if (!panel) return;
    if (instant) document.body.classList.add('no-anim');
    panel.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    const label = btn.querySelector('span:not(.pm)');
    if (label && btn.dataset.open) label.textContent = open ? btn.dataset.open : btn.dataset.closed;
    if (instant) requestAnimationFrame(() => document.body.classList.remove('no-anim'));
  }

  /* 语言切换：淡出 → 重新渲染 → 回到刚才阅读的位置 → 淡入 */
  function readingAnchor() {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64) + 4;
    let best = null;
    $$('[data-anchor]').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top <= top + 60 && r.bottom > top) best = { id: el.dataset.anchor, offset: r.top }; });
    return best;
  }
  function switchLang() {
    const anchor = readingAnchor();
    const openPanels = $$('.collapse.open').map((p) => p.id);
    const openDetails = $$('details[open]').map((d) => d.dataset.key);
    const apply = () => {
      lang = lang === 'zh' ? 'en' : 'zh'; store.set('site-lang', lang);
      render({ instant: true });
      openPanels.forEach((id) => { const btn = $(`[aria-controls="${CSS.escape(id)}"]`); if (btn) setOpen(btn, true, true); });
      openDetails.forEach((k) => { const d = $(`details[data-key="${CSS.escape(k || '')}"]`); if (d) d.open = true; });
      if (anchor) { const el = $(`[data-anchor="${CSS.escape(anchor.id)}"]`); if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - anchor.offset); }
      requestAnimationFrame(() => document.body.classList.remove('switching'));
    };
    if (reduceMotion) { apply(); return; }
    document.body.classList.add('switching');
    setTimeout(apply, 220);
  }

  /* 首页 ⇄ 案例页：用 history 切换，不重新加载页面（也不会重播开场） */
  function go(id, hash, push, k) {
    route = id || ''; kind = k === 'story' ? 'story' : 'case';
    if (push !== false) {
      const u = new URL(location.href);
      u.searchParams.delete('case'); u.searchParams.delete('story');
      if (route) u.searchParams.set(kind, route);
      u.hash = hash || '';
      history.pushState(null, '', u);
    }
    render({ instant: true });
    const el = hash && document.getElementById(hash);
    jumpTo(el ? el.getBoundingClientRect().top + window.scrollY - navH() : 0, true);
  }
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    go(p.get('case') || p.get('story'), location.hash.slice(1), false, !p.get('case') && p.get('story') ? 'story' : 'case');
  });

  function bindUI() {
    const nav = $('#nav'), menu = $('#menu-btn');
    const closeMenu = () => { nav.classList.remove('open'); if (menu) { menu.innerHTML = icon('menu'); menu.setAttribute('aria-expanded', 'false'); } };
    if (menu) menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', open); menu.innerHTML = icon(open ? 'close' : 'menu'); });
    $$('#nav-links a').forEach((a) => a.addEventListener('click', closeMenu));
    $$('[data-lang-toggle]').forEach((b) => b.addEventListener('click', switchLang));
    const tb = $('#theme-btn');
    if (tb) tb.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.set('site-theme', theme); applyTheme(); });
    $$('.toggle, .job-toggle').forEach((btn) => btn.addEventListener('click', () => setOpen(btn, btn.getAttribute('aria-expanded') !== 'true')));
    const onClick = (e) => {
      const r = e.target.closest('a[data-route]');
      if (r && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); go(r.dataset.route, r.dataset.hash, true, r.dataset.kind); return; }
      if (e.target.closest('[data-top]')) { e.preventDefault(); jumpTo(0); return; }
      // 页内锚点（导航、按钮）：平滑滚动开启时交给 Lenis，并让出导航栏高度
      const anchor = lenis && e.target.closest('a[href^="#"]');
      if (anchor && anchor.getAttribute('href').length > 1) {
        const target = document.getElementById(anchor.getAttribute('href').slice(1));
        if (target) { e.preventDefault(); jumpTo(target.getBoundingClientRect().top + window.scrollY - navH() - 8); history.replaceState(null, '', anchor.getAttribute('href')); return; }
      }
      // 整行可点：有案例的经历 → 进入案例页；没有案例的 → 展开 / 收起
      const row = !e.target.closest('a, button') && e.target.closest('.job-row');
      if (row) {
        if (row.dataset.go) { go(row.dataset.go); return; }
        const tg = $('.job-toggle', row); if (tg) { setOpen(tg, tg.getAttribute('aria-expanded') !== 'true'); return; }
      }
      const el = e.target.closest('[data-copy]'); if (!el) return; e.preventDefault(); copyText(el.getAttribute('data-copy'));
    };
    app.addEventListener('click', onClick);
    cleanups.push(() => app.removeEventListener('click', onClick));
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); if (!el) return;
    el.innerHTML = icon('check') + esc(msg); el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function copyText(txt) {
    const done = () => toast(t((DATA.ui || {}).copied) || 'Copied');
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } ta.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }

  function initGallery() {
    const track = $('#gallery-track'); if (!track) return;
    const prints = $$('.g-card', track), prev = $('.g-prev'), next = $('.g-next'), cur = $('.g-cur'), bar = $('.g-progress i');
    // 计数 = 当前最左侧可见的照片；最后一张完整露出时视为到底
    const update = () => {
      const box = track.getBoundingClientRect(), left = track.scrollLeft;
      const atEnd = prints[prints.length - 1].getBoundingClientRect().right <= box.right + 4 || left >= track.scrollWidth - track.clientWidth - 4;
      let k = prints.findIndex((p) => p.getBoundingClientRect().right > box.left + 24);
      if (atEnd) k = prints.length - 1;
      if (cur) cur.textContent = pad(Math.max(0, k) + 1);
      if (prev) prev.disabled = left <= 4;
      if (next) next.disabled = atEnd;
      const max = track.scrollWidth - track.clientWidth;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.max(0.08, left / max) : 1})`;
    };
    $$('img', track).forEach((img) => { if (!img.complete) img.addEventListener('load', update, { once: true }); });
    const go = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    // 鼠标按住拖动（触屏本身就能滑动）
    let down = false, startX = 0, startLeft = 0, moved = false;
    track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft; });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    function onMove(e) { if (!down) return; const dx = e.clientX - startX; if (Math.abs(dx) > 5) { moved = true; track.classList.add('dragging'); } if (moved) track.scrollLeft = startLeft - dx; }
    function onUp() { if (!down) return; down = false; setTimeout(() => track.classList.remove('dragging'), 0); }
    track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    cleanups.push(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });
    update();
  }

  /* 大图查看：生活片段可左右翻页；其它照片单张查看 */
  let lbItems = [], lbIndex = 0;
  function openLightbox(items, index) {
    const dlg = $('#lightbox'); if (!dlg || !items.length) return;
    lbItems = items; lbIndex = index;
    showLb();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (lenis) { lenis.stop(); dlg.addEventListener('close', () => lenis.start(), { once: true }); }
  }
  function showLb() {
    const dlg = $('#lightbox'); const it = lbItems[lbIndex]; if (!dlg || !it) return;
    const img = $('img', dlg); img.src = it.src; img.alt = it.alt || '';
    $('.lb-cap', dlg).textContent = it.cap || '';
    $('.lb-count', dlg).textContent = lbItems.length > 1 ? `${pad(lbIndex + 1)} / ${pad(lbItems.length)}` : '';
    $$('.lb-prev, .lb-next', dlg).forEach((b) => { b.hidden = lbItems.length < 2; });
  }
  function bindLightbox() {
    const dlg = $('#lightbox'); if (!dlg) return;
    const step = (d) => { lbIndex = (lbIndex + d + lbItems.length) % lbItems.length; showLb(); };
    $('.lb-close', dlg).addEventListener('click', () => dlg.close());
    $('.lb-prev', dlg).addEventListener('click', () => step(-1));
    $('.lb-next', dlg).addEventListener('click', () => step(1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close(); });
    dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    const onZoom = (e) => {
      const el = e.target.closest('[data-zoom]'); if (!el) return;
      e.preventDefault();
      if (el.dataset.group === 'gallery') {
        const items = list((DATA.gallery || {}).items).filter((x) => has(x.image)).map((x) => ({ src: bigSrc(t(x.image)), alt: t(x.alt), cap: [t(x.caption), t(x.date)].filter(Boolean).join(' · ') }));
        openLightbox(items, Number(el.dataset.index) || 0);
      } else {
        openLightbox([{ src: el.dataset.src, alt: el.dataset.cap, cap: el.dataset.cap }], 0);
      }
    };
    app.addEventListener('click', onZoom);
    cleanups.push(() => app.removeEventListener('click', onZoom));
  }

  /* ---------- 首屏「照片宇宙」（v5） ----------
   * 首次访问：照片从远处飞入 → 每换一个轮播词，照片重新排成一个阵型 → 收拢到肖像位置
   *          → 像素印章聚合、其余首屏内容出现 → 照片退到背景里慢慢漂浮。全程 ≤ 2.5 秒，点击 / 滚动 / 按键可快进。
   * 再次访问、切换语言、编辑器预览：直接是最终状态。减少动态效果（reduced motion）：静止、无开场。 */
  const FORMS = {
    // 每张照片：[横向, 纵向（以肖像尺寸为单位，0 = 肖像中心）, 纵深 px, 左右转角, 平面转角, 缩放]
    cloud: [[-0.62, -0.38, -140, 18, -6, 0.92], [0.42, -0.52, 60, -14, 5, 1], [0.66, 0.12, -40, -22, 3, 0.96], [0.18, 0.56, 110, -8, -4, 1.04], [-0.4, 0.42, 0, 16, 6, 0.9], [-0.02, -0.04, -300, 0, -2, 0.86], [-1, 0.02, -260, 24, -8, 0.84]],
    shelf: (i) => [[-0.78, -0.26, 0.26, 0.78, -0.52, 0, 0.52][i % 7], i % 7 < 4 ? -0.3 : 0.32, 0, 0, 0, 0.74],
    arc: (i, n) => { const a = (n > 1 ? -60 + (120 * i) / (n - 1) : 0) * Math.PI / 180; return [1.05 * Math.sin(a), 0.4 - 0.36 * Math.cos(a), -380 * (1 - Math.cos(a)), (a * 180 / Math.PI) * 0.7, 0, 0.78]; },
    ring: (i, n) => { if (i === n - 1) return [0, 0, -220, 0, 0, 0.8]; const a = (i / (n - 1)) * Math.PI * 2 - Math.PI / 2; return [0.9 * Math.cos(a), 0.62 * Math.sin(a), i % 2 ? 80 : -80, 0, (i % 3 - 1) * 4, 0.76]; },
    stack: (i) => [((i * 37) % 9 - 4) / 100, ((i * 53) % 9 - 4) / 100, -i * 8, 0, ((i * 47) % 13) - 6, 0.94]
  };
  const FORM_ORDER = ['cloud', 'shelf', 'arc', 'ring'];
  // 开场结束后照片退到背景的纵深（px，越负越远越小）；位置由 freeSpots() 自动找首屏里没有文字的空白处
  const DRIFT_Z = [-520, -680, -460, -720, -540, -620, -580];
  const PERSPECTIVE = 1200;

  let forceIntro = false;   // 编辑器里点「重播开场」时为 true
  function initHero(instant) {
    const hero = $('.hero'); if (!hero) return;
    const G = window.gsap, cards = $$('.u-card', hero), stage = $('.u-stage', hero);
    const rot = $('[data-rot]', hero), words = rot ? $$('.rot-w', rot) : [];
    const sealEl = $('.px-seal', hero), pixels = sealEl ? $$('rect', sealEl) : [];
    const cfg = DATA.hero || {};
    const motion = !!G && !reduceMotion;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const full = motion && cards.length > 0 && (forceIntro
      || (!instant && !IS_PREVIEW && !IS_BOT && cfg.playIntro !== false && (params.has('intro') || !session.get('intro-seen'))));
    let tl = null, drifting = [], cancelled = false, heroVisible = true;

    const geo = () => {
      const hb = hero.getBoundingClientRect(), pf = $('.portrait .frame', hero);
      let cx = hb.width * 0.72, cy = hb.height * 0.45, W = hb.width * 0.3, H = W * 1.25;
      if (pf) { const r = pf.getBoundingClientRect(); cx = r.left - hb.left + r.width / 2; cy = r.top - hb.top + r.height / 2; W = r.width; H = r.height; }
      const narrow = hb.width < 700;   // 手机：阵型占满肖像区域，卡片相对大一些
      // 手机上肖像在标题下方、可能在屏幕外：开场阵型放在标题下方的可见区域里
      const ttl = $('.hero-title', hero);
      if (narrow && ttl) { const tb = ttl.getBoundingClientRect().bottom - hb.top, vis = window.innerHeight - hb.top; if (vis - tb > 160) cy = Math.min(cy, (tb + vis) / 2 + 10); }
      const ux = Math.min(W, hb.width * (narrow ? 0.42 : 0.32)), uy = Math.min(H * 0.8, ux * 1.1);
      const g = { w: hb.width, h: hb.height, cx, cy, ux, uy, cw: clamp(ux * (narrow ? 0.62 : 0.48), 92, 210) };
      g.spots = freeSpots(g, hb);
      return g;
    };
    // 背景照片的落点：在首屏里打格子，优先选不压到文字 / 肖像 / 数字的格子，并且彼此分散
    const freeSpots = (g, hb) => {
      const boxes = $$('.hero-slogan, .hero-name, .hero-title, .hero-cta, .portrait, .proof', hero).map((el) => {
        const r = el.getBoundingClientRect(); return [r.left - hb.left - 14, r.top - hb.top - 14, r.right - hb.left + 14, r.bottom - hb.top + 14];
      });
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
      const cols = 10, rows = 8, cand = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols) * g.w, y = top + ((r + 0.5) / rows) * (g.h - top);
        const sw = g.cw * 0.66, sh = sw * 0.8, a = [x - sw / 2, y - sh / 2, x + sw / 2, y + sh / 2];
        let ov = 0;
        boxes.forEach((b) => { ov += Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); });
        cand.push({ x, y, ov: ov / (sw * sh) });
      }
      cand.sort((p, q) => p.ov - q.ov || q.x - p.x);
      const picks = [];
      for (let gap = Math.max(g.w, g.h) / 4; picks.length < cards.length && gap > 1; gap *= 0.7) {
        cand.forEach((p) => { if (picks.length < cards.length && !picks.includes(p) && picks.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= gap)) picks.push(p); });
      }
      return picks;
    };
    // 把「阵型」换算成每张卡片的位置
    const formState = (name, i, n, g) => {
      const f = FORMS[name], v = typeof f === 'function' ? f(i, n) : f[i % f.length];
      return { x: g.cx + v[0] * g.ux, y: g.cy + v[1] * g.uy, z: v[2], rotationY: v[3], rotationZ: v[4], scale: v[5], autoAlpha: 1, filter: 'blur(0px)' };
    };
    const driftState = (i, g) => {
      const p = g.spots[i] || { x: g.w / 2, y: g.h / 2, ov: 1 }, z = DRIFT_Z[i % DRIFT_Z.length], k = (PERSPECTIVE - z) / PERSPECTIVE;
      const free = p.ov < 0.08, dark = theme === 'dark';
      // 透视会把远处的卡片往中心拉、并缩小：反算位置，让它在屏幕上正好落在空白格子里
      return { x: g.w / 2 + (p.x - g.w / 2) * k, y: g.h / 2 + (p.y - g.h / 2) * k, z, rotationY: ((i * 29) % 21) - 10, rotationZ: ((i * 41) % 17) - 8, scale: 1,
        // 压到文字的照片：电脑上很淡，手机上直接隐藏
        autoAlpha: free ? (dark ? 0.5 : 0.7) : g.w < 700 ? 0 : (dark ? 0.16 : 0.22), filter: `blur(${fine ? (free ? 0.8 : 2.4) : 0}px)` };
    };
    const place = (el, s) => {
      if (G) { G.set(el, Object.assign({ xPercent: -50, yPercent: -50 }, s)); return; }
      el.style.transform = `translate(-50%,-50%) translate3d(${s.x}px,${s.y}px,${s.z}px) rotateY(${s.rotationY}deg) rotateZ(${s.rotationZ}deg) scale(${s.scale})`;
      el.style.opacity = s.autoAlpha; el.style.filter = s.filter;
    };
    const setSize = (g) => hero.style.setProperty('--cw', Math.round(g.cw) + 'px');
    const sizeCards = () => cards.forEach((c) => { const img = $('img', c); const fit = () => { if (img.naturalWidth) c.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight; }; img.complete ? fit() : img.addEventListener('load', fit, { once: true }); });

    // 首屏滚出屏幕后暂停漂浮动画和鼠标视差，回来再继续（省电、滚动更顺）
    if (motion && window.ScrollTrigger) {
      const vis = window.ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top',
        onToggle: (st) => { heroVisible = st.isActive; drifting.forEach((d) => (heroVisible ? d.resume() : d.pause())); } });
      cleanups.push(() => vis.kill());
    }
    // 滚动视差：往下滚时，整层漂浮照片比文字移动得慢一些，形成前后纵深（手机上代替鼠标视差）
    if (motion && stage && window.ScrollTrigger) {
      const par = G.to(stage, { y: () => hero.offsetHeight * 0.18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } });
      cleanups.push(() => { par.scrollTrigger && par.scrollTrigger.kill(); par.kill(); G.set(stage, { clearProps: 'y' }); });
    }
    const startDrift = () => {
      if (!motion) return;
      drifting = cards.map((c, i) => G.to(c, { paused: !heroVisible, x: `+=${((i * 13) % 40) - 20}`, y: `+=${((i * 17) % 30) - 15}`, rotationZ: `+=${((i * 7) % 7) - 3}`,
        duration: 6 + (i % 4) * 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: (i % 3) * 0.4 }));
    };
    const settle = () => { const g = geo(); setSize(g); cards.forEach((c, i) => place(c, driftState(i, g))); };
    const assembleSeal = (fast) => {
      if (!pixels.length || !motion) return null;
      sealEl.classList.add('charging');
      return G.fromTo(pixels, { x: () => G.utils.random(-28, 28), y: () => G.utils.random(-22, 22), autoAlpha: 0 },
        { x: 0, y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: { amount: fast ? 0.25 : 0.3, from: 'random' },
          onComplete: () => sealEl.classList.remove('charging') });
    };

    sizeCards();
    // 窗口大小改变：重新计算背景照片的位置
    let rz;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (tl && tl.isActive()) return; drifting.forEach((d) => d.kill()); settle(); startDrift(); }, 200); };
    window.addEventListener('resize', onResize);
    // 鼠标视差：整个照片宇宙随鼠标轻微转动（只在电脑上）
    let onMove = null;
    if (motion && fine && stage) {
      G.set(stage, { transformOrigin: '50% 50%' });
      const ry = G.quickTo(stage, 'rotationY', { duration: 1.2, ease: 'power3' }), rx = G.quickTo(stage, 'rotationX', { duration: 1.2, ease: 'power3' });
      onMove = (e) => { if (!heroVisible) return; ry((e.clientX / window.innerWidth - 0.5) * 8); rx((e.clientY / window.innerHeight - 0.5) * -6); };
      window.addEventListener('pointermove', onMove, { passive: true });
    }
    cleanups.push(() => {
      cancelled = true; clearTimeout(rz);
      window.removeEventListener('resize', onResize);
      if (onMove) window.removeEventListener('pointermove', onMove);
      if (tl) tl.kill();
      if (G) { drifting.forEach((d) => d.kill()); G.killTweensOf(pixels); }
    });

    if (!full) {
      settle();
      if (motion && !instant) { G.from(cards, { autoAlpha: 0, duration: 1, stagger: 0.06, ease: 'power2.out' }); assembleSeal(true); }
      startDrift();
      return;
    }

    /* ----- 完整开场 ----- */
    session.set('intro-seen', '1');
    hero.classList.add('intro');            // 其余首屏元素先隐藏，由开场结束时显示
    const title = $('.hero-title', hero); if (title) title.classList.add('in');
    if (pixels.length) G.set(pixels, { autoAlpha: 0 });
    const n = cards.length, nw = words.length;
    let g = geo(); setSize(g);
    cards.forEach((c, i) => { const s = formState('cloud', i, n, g); place(c, Object.assign(s, { x: g.cx + (s.x - g.cx) * 1.8, y: g.cy + (s.y - g.cy) * 1.8, z: -1600, autoAlpha: 0 })); });

    // 关键词：先量好每个词的宽度，轮播时让位置宽度平滑变化
    let widths = [];
    const prepWords = () => {
      if (nw < 2) return;
      widths = words.map((w) => w.getBoundingClientRect().width);
      rot.classList.add('live');
      rot.style.width = widths[0] + 'px';
      G.set(words, { autoAlpha: 0 }); G.set(words[0], { autoAlpha: 1 });
    };
    const finishWords = () => { if (nw < 2) return; rot.classList.remove('live'); rot.style.width = ''; G.set(words, { clearProps: 'all' }); };

    const skipKeys = ['pointerdown', 'wheel', 'touchstart', 'keydown'];
    const skip = () => { if (tl) tl.timeScale(6); skipKeys.forEach((k) => window.removeEventListener(k, skip)); };
    const run = () => {
      if (cancelled) return;
      g = geo(); setSize(g);
      prepWords();
      const steps = Math.max(1, nw - 1), step = Math.min(0.42, 1.2 / steps), t0 = 0.55;
      tl = G.timeline({ defaults: { ease: 'power3.inOut' }, onComplete: () => { skip(); hero.classList.remove('intro'); startDrift(); } });
      tl.to(cards, { x: (i) => formState('cloud', i, n, g).x, y: (i) => formState('cloud', i, n, g).y, z: (i) => formState('cloud', i, n, g).z,
        autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.035 }, 0);
      for (let k = 1; k <= steps; k++) {
        const at = t0 + (k - 1) * step, name = k === steps ? 'stack' : FORM_ORDER[k % FORM_ORDER.length];
        tl.to(cards, { ...Object.fromEntries(['x', 'y', 'z', 'rotationY', 'rotationZ', 'scale'].map((p) => [p, (i) => formState(name, i, n, g)[p]])), duration: 0.5, stagger: 0.02 }, at);
        if (nw >= 2 && words[k]) {
          tl.to(words[k - 1], { yPercent: -45, autoAlpha: 0, duration: 0.26, ease: 'power2.in' }, at)
            .fromTo(words[k], { yPercent: 45, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.34, ease: 'power3.out' }, at + 0.12)
            .to(rot, { width: widths[k], duration: 0.4 }, at);
        }
      }
      const end = t0 + (steps - 1) * step + 0.3;
      tl.add(() => { reveal($('.hero-name', hero)); }, end - 0.15);
      const sealTw = assembleSeal(false); if (sealTw) tl.add(sealTw, end - 0.05);
      tl.add(() => { finishWords(); $$('.rv, .img-rv', hero).forEach((el) => { if (!el.classList.contains('in')) reveal(el); }); }, end);
      let gd = null; const D = (i) => driftState(i, gd || (gd = geo()));
      tl.to(cards, { ...Object.fromEntries(['x', 'y', 'z', 'rotationY', 'rotationZ', 'scale', 'autoAlpha', 'filter'].map((p) => [p, (i) => D(i)[p]])),
        duration: 0.55, ease: 'power2.inOut', stagger: 0.02 }, end);
      skipKeys.forEach((k) => window.addEventListener(k, skip, { passive: true }));
    };
    // 等字体与照片准备好（最多 0.9 秒），避免照片还没加载就飞进来
    const ready = [document.fonts ? document.fonts.ready : null].concat(cards.map((c) => { const img = $('img', c); return img.decode ? img.decode().catch(() => null) : null; }));
    Promise.race([Promise.all(ready), new Promise((r) => setTimeout(r, 900))]).then(run);
  }

  /* ---------- Phase 2：数据像素语言 ----------
   * 1) 案例图表：滚动经过时像素逐格点亮（跟滚动进度绑定，往回滚会熄灭），最前沿的几格是橙色
   * 2) 案例正文：章节目录跟随阅读进度
   * 3) 首屏数字：计数时橙色像素流进数字笔画后消散 */
  const ST = window.ScrollTrigger;
  if (window.gsap && ST) window.gsap.registerPlugin(ST);
  const scrollFx = () => !!(window.gsap && ST) && !reduceMotion;
  const track = (st) => { cleanups.push(() => st.kill()); return st; };

  function initPixelViz() {
    if (!scrollFx()) return;   // 跟滚动位置绑定，切换语言 / 页面后也能直接画出当前进度，所以不区分 instant
    $$('[data-viz]').forEach((viz) => {
      const cells = $$('[data-t]', viz).map((el) => [el, +el.dataset.t]);
      if (!cells.length) return;
      const marks = $$('[data-at]', viz).map((el) => [el, +el.dataset.at]);
      const counters = $$('[data-count-to]', viz);
      const paint = (p) => {
        const done = p >= 0.999;
        cells.forEach(([el, tt]) => { const on = p >= tt; el.classList.toggle('on', on); el.classList.toggle('edge', on && !done && p - tt < 0.06); });
        marks.forEach(([el, at]) => el.classList.toggle('on', p >= at));
        counters.forEach((el) => { const to = parseFloat(el.dataset.countTo), dec = (el.dataset.countTo.split('.')[1] || '').length;
          el.textContent = el.dataset.pre + (done ? el.dataset.countTo : (to * Math.min(1, p / 0.9)).toFixed(dec)) + el.dataset.suf; });
      };
      viz.classList.add('viz-live');
      paint(0);
      track(ST.create({ trigger: viz, start: 'top 85%', end: 'bottom 60%', onUpdate: (st) => paint(st.progress), onRefresh: (st) => paint(st.progress) }));
    });
  }

  /* 能力主线：往下滚动经历列表时，绿色滑块从 2023 一格格滑到 2025 DTC growth */
  function initTrajectory() {
    const tr = $('.trajectory'), jobs = $('.jobs');
    if (!tr || !jobs || !scrollFx()) return;
    const steps = $$('.traj-step', tr), slider = $('.traj-slider', tr);
    if (steps.length < 2 || !slider) return;
    tr.classList.add('traj-live');
    let cur = -1;
    const move = (k, force) => {
      if (k === cur && !force) return;
      cur = k;
      const st = steps[k];
      slider.style.width = st.offsetWidth + 'px'; slider.style.height = st.offsetHeight + 'px';
      slider.style.transform = `translate(${st.offsetLeft}px, ${st.offsetTop}px)`;
      steps.forEach((x, j) => { x.classList.toggle('on', j === k); x.classList.toggle('done', j < k); });
    };
    const at = (p) => Math.min(steps.length - 1, Math.floor(p * steps.length));
    move(0);
    track(ST.create({ trigger: jobs, start: 'top 75%', end: 'bottom 75%', onUpdate: (st) => move(at(st.progress)), onRefresh: (st) => move(at(st.progress), true) }));
  }

  function initStory() {
    const story = $('.cs-story'); if (!story) return;
    const items = $$('.cs-chapters li', story), chapters = $$('.cs-chapter', story);
    const setOn = (k) => items.forEach((li, j) => li.classList.toggle('on', j === k));
    setOn(0);
    items.forEach((li, k) => li.addEventListener('click', () => {
      const top = chapters[k].getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64) - 24;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    // 「方法」里的步骤逐条出现
    $$('.cs-chapter .steps-list li', story).forEach((li, k) => { li.classList.add('rv'); li.style.setProperty('--d', k); });
    if (!ST || !window.gsap) return;
    chapters.forEach((ch, k) => track(ST.create({ trigger: ch, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => { if (st.isActive) setOn(k); } })));
    track(ST.create({ trigger: $('.cs-chapter-list', story), start: 'top 55%', end: 'bottom 55%', onUpdate: (st) => story.style.setProperty('--p', st.progress.toFixed(4)) }));
  }

  // 首屏数字：把最终数字画到隐藏画布上取样，得到组成笔画的点；像素从下方飞进这些点，到达后渐隐
  function pixelStream(num, delay) {
    const G = window.gsap;
    if (!G || reduceMotion || IS_BOT) return;
    const box = num.getBoundingClientRect(); if (!box.width || !box.height) return;
    const off = document.createElement('canvas'), oc = off.getContext('2d');
    off.width = Math.ceil(box.width); off.height = Math.ceil(box.height);
    oc.fillStyle = '#000';
    $$('.pre, .count, small', num).forEach((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      oc.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      oc.textBaseline = 'alphabetic';
      oc.fillText(el.textContent, r.left - box.left, r.top - box.top + r.height * 0.82);
    });
    const data = oc.getImageData(0, 0, off.width, off.height).data, pts = [], step = 3;
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) if (data[(y * off.width + x) * 4 + 3] > 120) pts.push([x, y]);
    if (!pts.length) return;
    while (pts.length > 240) pts.splice(Math.floor(Math.random() * pts.length), 1);
    const pad = 48, W = box.width + pad * 2, H = box.height + pad * 2, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.className = 'px-stream'; cv.setAttribute('aria-hidden', 'true');
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = `left:${-pad}px;top:${-pad}px;width:${W}px;height:${H}px`;
    num.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() || '#ff5b1f';
    const parts = pts.map(([x, y]) => ({ tx: pad + x, ty: pad + y, sx: pad + Math.random() * box.width, sy: H - Math.random() * pad * 0.6, d: Math.random() * 0.75, dur: 0.55 + Math.random() * 0.35 }));
    const t0 = performance.now() + (delay || 0) * 1000, end = Math.max(...parts.map((q) => q.d + q.dur));
    const tick = () => {
      const tt = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((q) => {
        const k = clamp((tt - q.d) / q.dur, 0, 1); if (k <= 0 || k >= 1) return;
        const e = 1 - Math.pow(1 - k, 3);
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.fillRect(q.sx + (q.tx - q.sx) * e, q.sy + (q.ty - q.sy) * e, 2, 2);
      });
      if (tt > end) stop();
    };
    const stop = () => { G.ticker.remove(tick); cv.remove(); };
    G.ticker.add(tick);
    cleanups.push(stop);
  }

  /* ---------- Phase 3：细节交互（吸附与平滑滚动只在电脑的精确鼠标上启用；手机 / 触屏 / 减少动态效果时关闭） ---------- */
  const SPLIT = window.SplitText;
  if (window.gsap && SPLIT) window.gsap.registerPlugin(SPLIT);
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktopFx = () => !!window.gsap && fineHover && !reduceMotion && !IS_PREVIEW && !IS_BOT;
  const navH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;

  // 惯性平滑滚动（Lenis）：只接管鼠标滚轮，触控板手势与触屏保持原生；整个页面只初始化一次
  let lenis = null;
  function initSmooth() {
    if (lenis || !window.Lenis || !desktopFx() || meta().smoothScroll === false) return;
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
    if (ST) lenis.on('scroll', ST.update);
    window.gsap.ticker.add((time) => lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
  }
  function jumpTo(y, instant) {
    if (lenis) lenis.scrollTo(y, { immediate: !!instant || reduceMotion, force: true });
    else window.scrollTo({ top: y, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
  }

  // 大标题逐行升起（只用于英文：中文没有空格，按行拆分会出错，保留原来的淡入）
  function initSplitHeads() {
    if (!SPLIT || !scrollFx() || IS_PREVIEW || lang !== 'en') return;
    $$('.sec-title, .cs-title, .closing h2, .gallery-title').forEach((h) => {
      h.classList.add('split-head');
      const split = SPLIT.create(h, { type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => window.gsap.from(self.lines, { yPercent: 105, duration: 0.95, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: h, start: 'top 88%', once: true } }) });
      cleanups.push(() => split.revert());
    });
  }

  // 磁吸按钮：鼠标靠近时按钮轻微跟随（最多约 10px）
  function initMagnetic() {
    if (!desktopFx()) return;
    const G = window.gsap;
    $$('.btn, .nav-cta, .job-toggle, .gallery-ctrl button, .theme-btn').forEach((b) => {
      const xTo = G.quickTo(b, 'x', { duration: 0.4, ease: 'power3' }), yTo = G.quickTo(b, 'y', { duration: 0.4, ease: 'power3' });
      const m = (e) => { const r = b.getBoundingClientRect();
        xTo(clamp((e.clientX - r.left - r.width / 2) * 0.3, -10, 10)); yTo(clamp((e.clientY - r.top - r.height / 2) * 0.4, -8, 8)); };
      const l = () => { xTo(0); yTo(0); };
      b.addEventListener('pointermove', m); b.addEventListener('pointerleave', l);
      cleanups.push(() => { b.removeEventListener('pointermove', m); b.removeEventListener('pointerleave', l); });
    });
  }

  function startMotion(instant) {
    initSmooth();
    initSplitHeads();
    initMagnetic();
    initHero(instant);
    initGallery();
    bindLightbox();
    initStory();
    initReveal(instant);
    initTrajectory();
    initPixelViz();
    initClock();
    initScroll();
  }

  /* ================= 4. 编辑器联动（只在编辑器右侧预览中生效） ================= */
  let focusPath = '';
  function findEditEl(path) {
    const parts = String(path).split('.');
    while (parts.length) {
      const el = document.querySelector(`[data-edit="${CSS.escape(parts.join('.'))}"]`);
      if (el) return el;
      parts.pop();
    }
    return null;
  }
  function bringIntoView(el) {
    const panel = el.closest('.collapse');
    if (panel && !panel.classList.contains('open')) { const btn = $(`[aria-controls="${CSS.escape(panel.id)}"]`); if (btn) setOpen(btn, true); }
    const det = el.closest('details'); if (det && !det.open) det.open = true;
    setTimeout(() => {
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      if (r.top < vh * 0.12 || r.bottom > vh * 0.88) el.scrollIntoView({ behavior: 'smooth', block: r.height > vh * 0.7 ? 'start' : 'center' });
    }, panel ? 300 : 0);
  }
  function setFocus(path, scroll) {
    focusPath = path;
    $$('.edit-focus').forEach((x) => x.classList.remove('edit-focus'));
    const el = findEditEl(path); if (!el) return;
    el.classList.add('edit-focus');
    if (scroll) { bringIntoView(el); el.classList.remove('edit-flash'); void el.offsetWidth; el.classList.add('edit-flash'); }
  }
  if (IS_PREVIEW) {
    document.documentElement.classList.add('is-preview');
    let hoverEl = null;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-edit]');
      if (el === hoverEl) return;
      if (hoverEl) hoverEl.classList.remove('edit-hover');
      hoverEl = el; if (el) { el.classList.add('edit-hover'); el.title = t((DATA.ui || {}).clickToEdit) || ''; }
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-tools, .toggle, .job-toggle, summary, [data-lang-toggle]')) return;
      const el = e.target.closest('[data-edit]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      setFocus(el.dataset.edit, false);
      window.parent.postMessage({ type: 'profile:select', path: el.dataset.edit }, '*');
    }, true);
  }

  window.addEventListener('message', (e) => {
    const msg = e.data || {};
    if (msg.type === 'profile:update' && msg.data) {
      const y = window.scrollY;
      const openPanels = $$('.collapse.open').map((p) => p.id);
      DATA = msg.data; if (msg.lang) lang = msg.lang; if (msg.theme) theme = msg.theme;
      render({ instant: true });
      openPanels.forEach((id) => { const btn = $(`[aria-controls="${CSS.escape(id)}"]`); if (btn) setOpen(btn, true, true); });
      window.scrollTo(0, y);
    } else if (msg.type === 'profile:intro') {
      window.scrollTo(0, 0); forceIntro = true; render(); forceIntro = false;
    } else if (msg.type === 'profile:focus' && msg.path) {
      const m = /^cases\.(\d+)/.exec(msg.path), c = m && list(DATA.cases)[+m[1]];
      const ms = /^stories\.items\.(\d+)/.exec(msg.path), sx = ms && list((DATA.stories || {}).items)[+ms[1]];
      let want = route, wk = kind;
      if (c && c.id) { want = c.id; wk = 'case'; }
      else if (sx && sx.slug && has(sx.title)) { want = sx.slug; wk = 'story'; }
      else if (/^(basics|hero|stats|experience|beyond|projects|publications|leadership|about|education|awards|skills|gallery|contact|contacts|stories)\b/.test(msg.path)) want = '';
      if (want !== route || (want && wk !== kind)) go(want, '', true, wk);
      setFocus(msg.path, true);
    } else if (msg.type === 'profile:scrollTo' && msg.id) {
      if (route) go('', msg.id, true);
      const el = document.getElementById(msg.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ================= 5. 启动 ================= */
  render();
  started = true;
  startMotion(false);
  if (IS_PREVIEW && window.parent !== window) window.parent.postMessage({ type: 'profile:ready' }, '*');
})();

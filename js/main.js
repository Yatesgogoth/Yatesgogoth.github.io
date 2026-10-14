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

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const IS_PREVIEW = params.has('preview');
  let route = params.get('case') || '';   // 非空 = 正在看某个案例详情页

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
  const seal = () => `<span class="seal" aria-hidden="true">${T((DATA.basics || {}).initials) || 'TH'}</span>`;

  /* 像素印章：3×5 像素字体拼出缩写，外框也是像素；开场结束时由散落的像素聚合而成 */
  const PIX = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111' };
  function pixelSeal() {
    const ini = String(t((DATA.basics || {}).initials) || 'TH').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (!ini) return seal();
    const lw = ini.length * 4 - 1, N = Math.max(13, lw + 6), ox = Math.floor((N - lw) / 2), oy = Math.floor((N - 5) / 2);
    const px = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!x || !y || x === N - 1 || y === N - 1) px.push([x, y]);
    [...ini].forEach((c, k) => { for (let i = 0; i < 15; i++) if (PIX[c][i] === '1') px.push([ox + k * 4 + (i % 3), oy + Math.floor(i / 3)]); });
    return `<span class="seal px-seal" aria-hidden="true"><svg viewBox="0 0 ${N} ${N}">${px.map(([x, y]) => `<rect x="${x + 0.08}" y="${y + 0.08}" width=".84" height=".84"/>`).join('')}</svg></span>`;
  }

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
    return photos.length ? `<div class="universe" aria-hidden="true"${E('hero.universePhotos')}><div class="u-stage">${photos.map((p) => `<figure class="u-card"><img src="${esc(p)}" alt="" decoding="async" /></figure>`).join('')}</div></div>` : '';
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
        <a class="brand" href="${to('top')}"${E('basics.brand')}>${seal()}<span class="brand-name">${plain(b.brand || b.name)}</span></a>
        <div class="nav-links" id="nav-links">
          ${sections.map((s, i) => `<a href="${to(esc(s.id))}" data-link="${esc(s.id)}"${E(`sections.${secIndex(s.id)}.nav`)}><span class="n">${pad(i + 1)}</span>${T(s.nav || s.title)}</a>`).join('')}
        </div>
        <div class="nav-tools">
          <button class="lang-btn" data-lang-toggle aria-label="${lang === 'zh' ? 'Switch to English' : '切换到中文'}">${lang === 'zh' ? '<b>中</b> / EN' : '中 / <b>EN</b>'}</button>
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
            <div class="frame img-rv"><img src="${esc(t(b.avatar))}" alt="${T(b.avatarAlt) || plain(b.name)}" fetchpriority="high" /></div>
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
    <button class="ctx-photo${small ? ' small' : ''}" data-zoom data-src="${esc(t(x.image))}" data-cap="${T(x.imageAlt)}" aria-label="${ui('enlarge')}: ${T(x.imageAlt)}"${E(`${base}.image`)}>
      <img src="${esc(t(x.image))}" alt="${T(x.imageAlt)}" loading="lazy" /><span class="zoom" aria-hidden="true">${icon('plus')}</span>
    </button>` : '');
  const tagsHtml = (arr, base) => (list(arr).some(has) ? `<div class="tags"${E(base)}>${list(arr).filter(has).map((x) => `<span>${T(x)}</span>`).join('')}</div>` : '');

  /* 案例右侧的视觉：优先使用真实图片；没有图片时用基于真实数据的图表 */
  function visualHtml(c, ci) {
    const v = c.visual || {}; const P = `cases.${ci}.visual`;
    const head = `<div class="visual-head mono"><span${E(`${P}.title`)}>${T(v.title)}</span><span>Fig. ${pad(ci + 1)}</span></div>`;
    const foot = has(v.note) ? `<p class="visual-foot"${E(`${P}.note`)}>${T(v.note)}</p>` : '';
    if (has(v.image)) {
      return `<figure class="visual visual-img rv"${E(`${P}.image`)}><img src="${esc(t(v.image))}" alt="${T(v.imageAlt)}" loading="lazy" />${has(v.title) ? `<figcaption>${T(v.title)}</figcaption>` : ''}</figure>`;
    }
    let body = '';
    if (v.type === 'bars') {
      const max = Math.max(1, ...list(v.items).map((x) => Number(x.value) || 0));
      body = `<div class="bars">${each(v.items, (x) => has(x.label), (x, i) => `
        <div class="bar-row"${E(`${P}.items.${i}`)}><span class="lbl">${T(x.label)}</span><span class="val">${T(x.display) || T(x.value)}</span>
          <div class="bar-track" aria-hidden="true"><i style="--w:${clamp(((Number(x.value) || 0) / max) * 100, 2, 100).toFixed(1)}%"></i></div></div>`)}</div>`;
    } else if (v.type === 'loop') {
      const center = v.center || {};
      body = `
        <div class="loop"${E(`${P}.steps`)}>
          <div class="loop-ring" aria-hidden="true"></div>
          <div class="loop-center"${E(`${P}.center`)}><b>${T(center.value)}</b><span>${T(center.label)}</span></div>
          ${list(v.steps).filter(has).slice(0, 4).map((s, k) => `<div class="loop-step p${k + 1}" style="--d:${k}"><i>${pad(k + 1)}</i>${T(s)}</div>`).join('')}
        </div>
        ${list(v.lineup).some(has) ? `<div class="lineup"${E(`${P}.lineup`)}>${list(v.lineup).filter(has).map((x) => `<span>${T(x)}</span>`).join('')}</div>` : ''}`;
    } else if (v.type === 'ladder') {
      const center = v.center || {};
      body = `
        <div class="ladder">
          <div class="ladder-end start">0</div>
          <ol>${each(v.items, (x) => has(x.label), (x, i) => `<li${E(`${P}.items.${i}`)}><b>${T(x.label)}</b><span>${T(x.display)}</span></li>`)}</ol>
          <div class="ladder-end end"${E(`${P}.center`)}>${T(center.value)}<small>${T(center.label)}</small></div>
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
        <div class="gallery-track" id="gallery-track" tabindex="0" role="region" aria-label="${T(g.title)} — ${ui('galleryHint')}">
          ${items.map(([x, i], k) => `
            <figure class="g-card"${E(`gallery.items.${i}`)}>
              <button class="g-img" data-zoom data-group="gallery" data-index="${k}" aria-label="${ui('enlarge')}: ${T(x.alt) || T(x.caption)}">
                <img src="${esc(t(x.image))}" alt="${T(x.alt)}" loading="lazy" draggable="false" style="object-position:${esc(x.focus || '50% 40%')}" />
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
      ${traj.length ? `<div class="trajectory rv"><span class="label mono">${ui('trajectory')}</span>${traj.map(([e, i], k) => `${k ? '<span class="traj-arrow" aria-hidden="true">→</span>' : ''}<span class="traj-step"${E(`experience.${i}.capability`)}><i>${esc(String(t(e.period)).slice(0, 4))}</i>${T(e.capability)}</span>`).join('')}</div>` : ''}
      <ol class="jobs">${items.map(([e, i]) => {
        const P = `experience.${i}`;
        const caseObj = list(DATA.cases).find((c) => c.id && c.id === e.caseId);
        return `
        <li class="job rv" id="job-${i}" data-anchor="job-${i}"${E(P)}>
          <div class="job-row">
            <div class="job-period mono"${E(`${P}.period`)}>${T(e.period)}</div>
            <div class="job-who">
              ${has(e.logoImage) || has(e.logo) ? `<div class="job-logo${has(e.logoImage) ? '' : ' mono-mark'}"${E(`${P}.${has(e.logoImage) ? 'logoImage' : 'logo'}`)}>${has(e.logoImage) ? `<img src="${esc(t(e.logoImage))}" alt="${plain(e.company)} logo" loading="lazy" />` : T(e.logo)}</div>` : ''}
              <h3 class="job-company"${E(`${P}.company`)}>${T(e.company)}</h3>
              <div class="job-role"${E(`${P}.role`)}>${T(e.role)}</div>
              <div class="job-loc"${E(`${P}.location`)}>${T(e.location)}</div>
            </div>
            <div class="job-line"${E(`${P}.oneLiner`)}>${T(e.oneLiner || e.summary)}${has(e.capability) ? `<br><span class="pill">${T(e.capability)}</span>` : ''}
              ${caseObj ? `<a class="link case-link" href="${caseHref(caseObj.id)}" data-route="${esc(caseObj.id)}">${ui('caseStudy')} ${icon('arrow')}</a>` : ''}</div>
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
    profile() {
      const a = DATA.about || {}; const b = DATA.basics || {}; const s = DATA.skills || {};
      const paras = list(a.paragraphs).map((p, i) => [p, i]).filter(([p]) => has(p));
      const romans = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'];
      let n = 0; const sub = (label) => `<div class="sub-h mono"><b>E.${++n}</b><span>${label}</span></div>`;
      return `
      <div class="profile-grid">
        <aside class="profile-side">
          ${has(b.avatarFormal) ? `<figure${E('basics.avatarFormal')}><div class="frame img-rv"><img src="${esc(t(b.avatarFormal))}" alt="${T(b.avatarAlt) || plain(b.name)}" loading="lazy" /></div></figure>` : ''}
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
              <div class="edu-logo">${has(e.logoImage) ? `<img src="${esc(t(e.logoImage))}" alt="${plain(e.school)} logo" loading="lazy" />` : ''}</div>
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
          <ul class="honours">${each(DATA.awards, (x) => has(x.title), (x, i) => `<li class="rv"${E(`awards.${i}`)}><span class="d mono">${T(x.date)}</span><span>${T(x.title)}<br><span class="o">${T(x.org)}</span></span><span class="n">${T(x.note)}</span></li>`)}</ul>` : ''}

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
  const caseHref = (id) => { const u = new URLSearchParams(location.search); u.set('case', id); return '?' + esc(u.toString()); };
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
        <div class="cs-body">
          ${block(ui('challenge'), has(c.challenge) ? `<p class="cs-lead">${T(c.challenge)}</p>` : '', `${P}.challenge`)}
          ${block(ui('role'), has(c.role) ? `<p>${T(c.role)}</p>` : '', `${P}.role`)}
          ${block(ui('approach'), stepsHtml(c.approach, `${P}.approach`))}
          ${block(ui('outcome'), has(c.outcome) ? `<p class="cs-lead">${T(c.outcome)}</p>` : '', `${P}.outcome`)}
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
    const cs = route && list(DATA.cases).find((c) => c && c.id === route && has(c.title));
    if (route && !cs) route = '';
    if (cs) document.title = String(t(cs.title)).replace(/\*/g, '') + ' · ' + plain((DATA.basics || {}).brand || (DATA.basics || {}).name);
    app.innerHTML = cs
      ? renderNav(visible, true) + '<main id="main">' + casePage(cs) + '</main>' + renderFooter() + lightboxHtml()
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
    if (el.hasAttribute('data-count')) $$('.count', el).forEach((c) => countUp(c, instant));
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
  function go(id, hash, push) {
    route = id || '';
    if (push !== false) {
      const u = new URL(location.href);
      if (route) u.searchParams.set('case', route); else u.searchParams.delete('case');
      u.hash = hash || '';
      history.pushState(null, '', u);
    }
    render({ instant: true });
    const el = hash && document.getElementById(hash);
    if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); go(p.get('case'), location.hash.slice(1), false); });

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
      if (r && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); go(r.dataset.route, r.dataset.hash); return; }
      if (e.target.closest('[data-top]')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
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
        const items = list((DATA.gallery || {}).items).filter((x) => has(x.image)).map((x) => ({ src: t(x.image), alt: t(x.alt), cap: [t(x.caption), t(x.date)].filter(Boolean).join(' · ') }));
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
      || (!instant && !IS_PREVIEW && cfg.playIntro !== false && (params.has('intro') || !store.get('intro-v5-seen'))));
    let tl = null, drifting = [], cancelled = false;

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

    const startDrift = () => {
      if (!motion) return;
      drifting = cards.map((c, i) => G.to(c, { x: `+=${((i * 13) % 40) - 20}`, y: `+=${((i * 17) % 30) - 15}`, rotationZ: `+=${((i * 7) % 7) - 3}`,
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
      onMove = (e) => { ry((e.clientX / window.innerWidth - 0.5) * 8); rx((e.clientY / window.innerHeight - 0.5) * -6); };
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
    store.set('intro-v5-seen', '1');
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

  function startMotion(instant) {
    initHero(instant);
    initGallery();
    bindLightbox();
    initReveal(instant);
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
      const want = c && c.id ? c.id : (/^(basics|hero|stats|experience|beyond|projects|publications|leadership|about|education|awards|skills|gallery|contact|contacts)\b/.test(msg.path) ? '' : route);
      if (want !== route) go(want, '', true);
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

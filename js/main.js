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

  /* ================= 2. 渲染 ================= */
  const app = $('#app');
  const secIndex = (id) => list(DATA.sections).findIndex((s) => s && s.id === id);
  const enLabel = (s) => String((s.nav && s.nav.en) || (s.title && String(s.title.en || '').replace(/\*/g, '')) || s.id);

  function renderNav(sections) {
    const b = DATA.basics || {};
    return `
    <a class="skip" href="#main">${lang === 'zh' ? '跳到正文' : 'Skip to content'}</a>
    <nav class="nav" id="nav" aria-label="${lang === 'zh' ? '主导航' : 'Primary'}">
      <div class="wrap nav-row">
        <a class="brand" href="#top"${E('basics.brand')}>${seal()}<span class="brand-name">${plain(b.brand || b.name)}</span></a>
        <div class="nav-links" id="nav-links">
          ${sections.map((s, i) => `<a href="#${esc(s.id)}" data-link="${esc(s.id)}"${E(`sections.${secIndex(s.id)}.nav`)}><span class="n">${pad(i + 1)}</span>${T(s.nav || s.title)}</a>`).join('')}
        </div>
        <div class="nav-tools">
          <button class="lang-btn" data-lang-toggle aria-label="${lang === 'zh' ? 'Switch to English' : '切换到中文'}">${lang === 'zh' ? '<b>中</b> / EN' : '中 / <b>EN</b>'}</button>
          <button class="icon-btn theme-btn" id="theme-btn" aria-label="${lang === 'zh' ? '切换深浅色' : 'Toggle dark mode'}"><span class="moon">${icon('moon')}</span><span class="sun">${icon('sun')}</span></button>
          ${sections.some((s) => s.id === 'contact') ? `<a class="nav-cta" href="#contact">${ui('ctaContact')} ${icon('arrowUR')}</a>` : ''}
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${icon('menu')}</button>
        </div>
      </div>
    </nav>`;
  }

  function renderHero(hasWork) {
    const b = DATA.basics || {};
    return `
    <header class="hero" id="top" data-anchor="top">
      <div class="wrap">
        <div class="hero-meta mono rv">
          ${has(b.status) ? `<span class="status"${E('basics.status')}><i aria-hidden="true"></i>${T(b.status)}</span>` : ''}
          ${has(b.credential) ? `<span${E('basics.credential')}>${T(b.credential)}</span>` : ''}
          ${has(b.location) ? `<span${E('basics.location')}>${T(b.location)}</span>` : ''}
          <span class="clock-wrap">${ui('localTime')} <span data-clock>--:--</span></span>
        </div>
        <div class="hero-grid">
          <div>
            <p class="hero-name rv"${E('basics.name')}>${seal()}<span><strong>${plain(b.name)}</strong>&nbsp; ${plain(b.altName)}</span></p>
            <h1 class="hero-title rv" style="--d:1"${E('basics.headline')}>${rich(b.headline)}</h1>
            ${has(b.tagline) ? `<p class="hero-lede rv" style="--d:2"${E('basics.tagline')}>${T(b.tagline)}</p>` : ''}
            <div class="hero-cta rv" style="--d:3">
              ${hasWork ? `<a class="btn primary" href="#work"${E('ui.ctaWork')}>${ui('ctaWork')} ${icon('arrow')}</a>` : ''}
              ${has(b.resume) ? `<a class="btn" href="${esc(t(b.resume))}" download${E('basics.resume')}>${ui('downloadCv')} ${icon('arrowDown')}</a>` : ''}
              <a class="link" href="#contact"${E('ui.ctaContact')}>${ui('ctaContact')} ${icon('arrowUR')}</a>
            </div>
          </div>
          ${has(b.avatar) ? `
          <figure class="portrait rv" style="--d:1"${E('basics.avatar')}>
            <div class="frame img-rv"><img src="${esc(t(b.avatar))}" alt="${T(b.avatarAlt) || plain(b.name)}" fetchpriority="high" /></div>
            <figcaption class="mono"><span>Fig. 00</span><span${E('basics.portraitCaption')}>${T(b.portraitCaption)}</span></figcaption>
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
    /* B. 精选成果 */
    work() {
      if (!list(DATA.cases).some((c) => has(c.title))) return '';
      return each(DATA.cases, (c) => has(c.title), (c, i) => {
        const P = `cases.${i}`; const id = esc(c.id || `case-${i + 1}`);
        return `
        <article class="case tone-${esc(c.tone || 'paper')}" id="case-${id}" data-anchor="case-${id}" aria-labelledby="case-${id}-t"${E(P)}>
          <div class="case-meta mono rv">
            <span class="case-no"${E(`${P}.label`)}>${T(c.label)}</span>
            <span${E(`${P}.company`)}>${T(c.company)}</span>
            <span${E(`${P}.period`)}>${T(c.period)}</span>
            <span${E(`${P}.sector`)}>${T(c.sector)}</span>
          </div>
          <div class="case-grid">
            <div>
              <h3 class="case-title rv" id="case-${id}-t"${E(`${P}.title`)}>${rich(c.title)}</h3>
              ${has(c.summary) ? `<p class="case-summary rv" style="--d:1"${E(`${P}.summary`)}>${T(c.summary)}</p>` : ''}
              <div class="rv" style="--d:2">${kpisHtml(c.metrics, `${P}.metrics`, 4)}</div>
            </div>
            ${visualHtml(c, i)}
          </div>
          <div class="crao rv">
            <div${E(`${P}.challenge`)}><h4>${ui('challenge')}</h4><p>${T(c.challenge)}</p></div>
            <div${E(`${P}.role`)}><h4>${ui('role')}</h4><p>${T(c.role)}</p></div>
            <div${E(`${P}.approach`)}><h4>${ui('approach')}</h4><ul>${list(c.approach).filter((a) => has(a.title)).map((a) => `<li>${T(a.title)}</li>`).join('')}</ul></div>
            <div${E(`${P}.outcome`)}><h4>${ui('outcome')}</h4><p>${T(c.outcome)}</p></div>
          </div>
          <div class="case-more">
            <button class="toggle" aria-expanded="false" aria-controls="full-${id}" data-open="${ui('closeCase')}" data-closed="${ui('readCase')}"><span>${ui('readCase')}</span><span class="pm" aria-hidden="true"></span></button>
            <div class="collapse" id="full-${id}"><div>
              <div class="case-full">
                <div><h4 class="mono muted" style="font-size:11px;margin:0 0 6px">${ui('approach')}</h4>${stepsHtml(c.approach, `${P}.approach`)}</div>
                <div class="full-side">
                  <h4>${ui('allResults')}</h4>${kpisHtml(c.metrics, `${P}.metrics`)}
                  ${list(c.tools).some(has) ? `<h4 style="margin-top:22px">${ui('tools')}</h4>${tagsHtml(c.tools, `${P}.tools`)}` : ''}
                </div>
              </div>
            </div></div>
          </div>
        </article>`;
      });
    },

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
              <h3 class="job-company"${E(`${P}.company`)}>${T(e.company)}</h3>
              <div class="job-role"${E(`${P}.role`)}>${T(e.role)}</div>
              <div class="job-loc"${E(`${P}.location`)}>${T(e.location)}</div>
            </div>
            <div class="job-line"${E(`${P}.oneLiner`)}>${T(e.oneLiner || e.summary)}${has(e.capability) ? `<br><span class="pill">${T(e.capability)}</span>` : ''}</div>
            <div class="job-kpis">${list(e.metrics).map((m, mi) => [m, mi]).filter(([m]) => has(m.value)).slice(0, 2).map(([m, mi]) => `<div${E(`${P}.metrics.${mi}`)}><b>${T(m.value)}</b><span>${T(m.label)}</span></div>`).join('')}</div>
            <button class="job-toggle" aria-expanded="false" aria-controls="jd-${i}" aria-label="${ui('showMore')} — ${plain(e.company)}"><span class="pm" aria-hidden="true"></span></button>
          </div>
          <div class="collapse" id="jd-${i}"><div>
            <div class="job-detail">
              ${stepsHtml(e.bullets, `${P}.bullets`)}
              <div class="job-detail-foot">
                ${list(e.details).some(has) ? `<ul class="extra"${E(`${P}.details`)}>${list(e.details).filter(has).map((d) => `<li>${T(d)}</li>`).join('')}</ul>` : ''}
                ${tagsHtml(e.tags, `${P}.tags`)}
                ${caseObj ? `<a class="link" href="#case-${esc(caseObj.id)}">${ui('viewCase')} · ${T(caseObj.label)} ${icon('arrow')}</a>` : ''}
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
      <div class="wrap foot-row">
        <a class="brand" href="#top">${seal()}<span>${plain(b.brand || b.name)}</span></a>
        <span class="mono">© ${new Date().getFullYear()} · ${ui('footerNote')}</span>
        <div class="foot-links mono">
          <button data-lang-toggle>${lang === 'zh' ? 'English' : '中文'}</button>
          <a href="#top">${ui('backToTop')} ↑</a>
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
    app.innerHTML = renderNav(visible) + '<main id="main">' + renderHero(visible.some((s) => s.id === 'work')) + blocks.join('') + '</main>' + renderFooter() + lightboxHtml();
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
    const els = $$('.rv, .img-rv, [data-viz]');
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

  function bindUI() {
    const nav = $('#nav'), menu = $('#menu-btn');
    const closeMenu = () => { nav.classList.remove('open'); if (menu) { menu.innerHTML = icon('menu'); menu.setAttribute('aria-expanded', 'false'); } };
    if (menu) menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', open); menu.innerHTML = icon(open ? 'close' : 'menu'); });
    $$('#nav-links a').forEach((a) => a.addEventListener('click', closeMenu));
    $$('[data-lang-toggle]').forEach((b) => b.addEventListener('click', switchLang));
    const tb = $('#theme-btn');
    if (tb) tb.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.set('site-theme', theme); applyTheme(); });
    $$('.toggle, .job-toggle').forEach((btn) => btn.addEventListener('click', () => setOpen(btn, btn.getAttribute('aria-expanded') !== 'true')));
    const onClick = (e) => { const el = e.target.closest('[data-copy]'); if (!el) return; e.preventDefault(); copyText(el.getAttribute('data-copy')); };
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

  function startMotion(instant) {
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
    } else if (msg.type === 'profile:focus' && msg.path) {
      setFocus(msg.path, true);
    } else if (msg.type === 'profile:scrollTo' && msg.id) {
      const el = document.getElementById(msg.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ================= 5. 启动 ================= */
  render();
  started = true;
  startMotion(false);
  if (IS_PREVIEW && window.parent !== window) window.parent.postMessage({ type: 'profile:ready' }, '*');
})();

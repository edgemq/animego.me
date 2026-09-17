// content.js
// Запускается на страницах animego.me / animego.org в основном окне
(function () {
  'use strict';

  if (window !== window.top) return;

  const host = window.location.hostname;
  if (!host.endsWith('animego.me') && !host.endsWith('animego.org') && !host.endsWith('animego.co') && !host.includes('animego')) {
    return;
  }

  console.log('[AnimeGO Next Episode] Скрипт инициализирован на AnimeGO.');

  let lastSwitchTime = 0;
  const SWITCH_COOLDOWN_MS = 3000;
  let isCssFullscreenActive = false;
  let lastWasFullscreen = false;

  // Идентификатор комнаты для удаленного пульта
  let currentRoomId = getOrCreateRoomId();

  // Базовый URL для веб-пульта (по умолчанию или из localStorage)
  const DEFAULT_REMOTE_URL = 'https://edgemq.github.io/animego.me/remote.html';

  function getRemoteBaseUrl() {
    return localStorage.getItem('animego_remote_base_url') || DEFAULT_REMOTE_URL;
  }

  function setRemoteBaseUrl(url) {
    if (url && url.trim()) {
      localStorage.setItem('animego_remote_base_url', url.trim());
    } else {
      localStorage.removeItem('animego_remote_base_url');
    }
  }

  function getFullRemoteUrl() {
    const base = getRemoteBaseUrl();
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}room=${encodeURIComponent(currentRoomId)}&v=131&_t=${Date.now()}`;
  }

  function generateRoomId() {
    return 'ago_' + Math.random().toString(36).substring(2, 9);
  }

  function getOrCreateRoomId() {
    // Поддержка сохранения комнаты при переключении между зеркалами (animego.me <-> animego.co)
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get('ago_room');
    if (id && id !== 'ago_6i22fynxm' && !id.includes('510iyjpv9')) {
      try {
        sessionStorage.setItem('animego_remote_room_id', id);
        localStorage.setItem('animego_remote_room_id', id);
        if (chrome?.storage?.local) chrome.storage.local.set({ animego_p2p_room: id });
      } catch (e) {}
      urlParams.delete('ago_room');
      const cleanSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
      window.history.replaceState({}, document.title, window.location.pathname + cleanSearch + window.location.hash);
      return id;
    }

    // Приоритет отдаем sessionStorage (уникален для текущей вкладки),
    // чтобы при открытии нескольких вкладок AnimeGO они не конфликтовали за один и тот же Peer ID
    id = sessionStorage.getItem('animego_remote_room_id');
    if (!id || id === 'ago_6i22fynxm' || id.includes('510iyjpv9')) {
      id = generateRoomId();
      try {
        sessionStorage.setItem('animego_remote_room_id', id);
        localStorage.setItem('animego_remote_room_id', id);
        if (chrome?.storage?.local) chrome.storage.local.set({ animego_p2p_room: id });
      } catch (e) {}
    }
    return id;
  }

  // Стили для полноэкранного режима и элементов пульта
  const style = document.createElement('style');
  style.textContent = `
    .animego-ext-fullscreen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      min-width: 100vw !important;
      min-height: 100vh !important;
      aspect-ratio: auto !important;
      z-index: 2147483647 !important;
      background: #000 !important;
      margin: 0 !important;
      padding: 0 !important;
      padding-top: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }
    .animego-ext-fullscreen iframe,
    iframe.animego-ext-fullscreen {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      border: 0 !important;
      border-radius: 0 !important;
      display: block !important;
      background: #000 !important;
    }

    /* Плавающая кнопка вызова пульта */
    #animego-remote-trigger-btn {
      position: fixed !important;
      bottom: 24px !important;
      left: 24px !important;
      z-index: 2147483640 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      background: rgba(18, 24, 38, 0.88) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 28px !important;
      color: #ffffff !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      padding: 10px 18px !important;
      cursor: pointer !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
      transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease !important;
      user-select: none !important;
    }
    #animego-remote-trigger-btn:hover {
      transform: scale(1.04) translateY(-2px) !important;
      background: rgba(30, 40, 64, 0.95) !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55) !important;
    }
    #animego-remote-trigger-btn:active {
      transform: scale(0.97) !important;
    }
    #animego-remote-trigger-btn .remote-dot {
      width: 8px !important;
      height: 8px !important;
      border-radius: 50% !important;
      background: #10b981 !important;
      box-shadow: 0 0 8px #10b981 !important;
      animation: animego-pulse 2s infinite !important;
    }
    @keyframes animego-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    /* Модальное окно с QR-кодом */
    #animego-remote-modal-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(8, 10, 15, 0.75) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      z-index: 2147483646 !important;
      display: none;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      animation: animego-fade-in 0.2s ease-out !important;
    }
    #animego-remote-modal-overlay.visible {
      display: flex !important;
    }
    @keyframes animego-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .animego-modal-card {
      background: #131722 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 20px !important;
      padding: 24px !important;
      max-width: 380px !important;
      width: 90% !important;
      color: #f8fafc !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 16px !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6) !important;
      position: relative !important;
    }
    .animego-modal-header {
      width: 100% !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    }
    .animego-modal-title {
      font-size: 16px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }
    .animego-modal-close {
      background: none !important;
      border: none !important;
      color: #94a3b8 !important;
      font-size: 20px !important;
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 8px !important;
      transition: color 0.15s ease, background-color 0.15s ease !important;
    }
    .animego-modal-close:hover {
      color: #fff !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .animego-qr-wrap {
      background: #ffffff !important;
      padding: 12px !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
    }
    .animego-qr-img {
      width: 200px !important;
      height: 200px !important;
      display: block !important;
      border-radius: 6px !important;
    }
    .animego-room-info {
      font-size: 13px !important;
      color: #94a3b8 !important;
      text-align: center !important;
      line-height: 1.4 !important;
    }
    .animego-room-code-badge {
      display: inline-block !important;
      background: rgba(37, 99, 235, 0.15) !important;
      color: #60a5fa !important;
      border: 1px solid rgba(37, 99, 235, 0.3) !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      font-weight: 700 !important;
      font-family: monospace !important;
    }
    .animego-btn-group {
      display: flex !important;
      width: 100% !important;
      gap: 8px !important;
    }
    .animego-action-btn {
      flex: 1 !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      color: #fff !important;
      border-radius: 10px !important;
      padding: 10px 12px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: background-color 0.15s ease !important;
    }
    .animego-action-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
    }
    .animego-action-btn.primary {
      background: #2563eb !important;
      border-color: #3b82f6 !important;
    }
    .animego-action-btn.primary:hover {
      background: #1d4ed8 !important;
    }
    .animego-url-config {
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 6px !important;
      text-align: left !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      padding-top: 12px !important;
    }
    .animego-url-label {
      font-size: 11px !important;
      color: #64748b !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }
    .animego-url-input-row {
      display: flex !important;
      gap: 6px !important;
    }
    .animego-url-input {
      flex: 1 !important;
      background: rgba(0, 0, 0, 0.3) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px !important;
      color: #e2e8f0 !important;
      padding: 6px 10px !important;
      font-size: 12px !important;
      outline: none !important;
    }
    .animego-url-input:focus {
      border-color: #2563eb !important;
    }
  `;
  document.head.appendChild(style);

  /**
   * Отображение всплывающего уведомления на экране компьютера
   */
  function showToast(message, type = 'info') {
    const existing = document.getElementById('animego-next-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'animego-next-toast';
    toast.textContent = message;

    const bgColors = {
      info: 'rgba(25, 28, 36, 0.95)',
      success: 'rgba(20, 115, 60, 0.95)',
      warning: 'rgba(160, 90, 20, 0.95)'
    };

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483647',
      padding: '12px 20px',
      borderRadius: '8px',
      backgroundColor: bgColors[type] || bgColors.info,
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '500',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      transform: 'translateY(10px)',
      opacity: '0',
      pointerEvents: 'none'
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 350);
    }, 3000);
  }

  /**
   * Очистка названия аниме от артефактов тегов, "AnimeGO'" и прочих служебных надписей
   */
  function cleanAnimeTitle(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/<[^>]+>/g, '')
      .replace(/AnimeGO['"]*\s*\/?>/gi, '')
      .replace(/^AnimeGO\s*[-|:]?\s*/i, '')
      .replace(/\s*[-|:]?\s*AnimeGO.*$/i, '')
      .replace(/^\s*Смотреть\s+(?:аниме\s+)?(?:бесплатно\s+)?(?:в\s+хорошем\s+качестве\s+)?/i, '')
      .replace(/\s*(?:смотреть\s+онлайн|онлайн|все\s+серии).*$/i, '')
      .replace(/^[«"'\s]+|[»"'\s]+$/g, '')
      .trim();
  }

  /**
   * Поиск элемента IFRAME плеера (Aniboom / Kodik / Sibnet)
   */
  function getPlayerIframe() {
    return (
      document.querySelector('[data-anime-player-target="iframeContainer"] iframe') ||
      document.querySelector('.player-video__online iframe') ||
      document.querySelector('.player-video iframe') ||
      document.querySelector('#player iframe') ||
      document.querySelector('.video-responsive iframe') ||
      document.querySelector('iframe[src*="aniboom"]') ||
      document.querySelector('iframe[src*="kodik"]') ||
      document.querySelector('iframe[data-src*="kodik"]') ||
      document.querySelector('iframe')
    );
  }

  /**
   * Контейнер плеера на странице AnimeGO (включая animego.co и Kodik)
   */
  function getPlayerContainer() {
    return (
      document.querySelector('[data-anime-player-target="iframeContainer"]') ||
      document.querySelector('.player-video__online') ||
      document.querySelector('.player-video') ||
      document.querySelector('.video-responsive') ||
      document.querySelector('#player') ||
      document.querySelector('iframe[src*="kodik"]')?.parentElement ||
      document.querySelector('iframe[data-src*="kodik"]')?.parentElement ||
      document.querySelector('iframe')?.parentElement
    );
  }

  /**
   * Проверка полноэкранного режима с допуском DPI
   */
  function isFullscreen() {
    const isDocFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (isDocFs) return true;

    const heightDiff = Math.abs(window.innerHeight - screen.height);
    const widthDiff = Math.abs(window.innerWidth - screen.width);
    if (heightDiff <= 8 && widthDiff <= 8) return true;

    if ((window.screenTop === 0 || window.screenY === 0) && heightDiff <= 25) {
      return true;
    }

    return false;
  }

  // Сброс и сохранение свойств предков (transform, contain, filter),
  // которые блокируют выход position: fixed на весь viewport
  let overriddenAncestors = [];

  function clearAncestorRestrictions(element) {
    let cur = element?.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (!overriddenAncestors.some((item) => item.el === cur)) {
        const style = window.getComputedStyle(cur);
        const needsReset =
          (style.transform && style.transform !== 'none') ||
          (style.contain && style.contain !== 'none') ||
          (style.filter && style.filter !== 'none') ||
          (style.perspective && style.perspective !== 'none') ||
          (style.willChange && (style.willChange.includes('transform') || style.willChange.includes('filter')));

        if (needsReset) {
          overriddenAncestors.push({
            el: cur,
            transform: cur.style.transform,
            contain: cur.style.contain,
            filter: cur.style.filter,
            perspective: cur.style.perspective,
            willChange: cur.style.willChange
          });
          cur.style.setProperty('transform', 'none', 'important');
          cur.style.setProperty('contain', 'none', 'important');
          cur.style.setProperty('filter', 'none', 'important');
          cur.style.setProperty('perspective', 'none', 'important');
          cur.style.setProperty('will-change', 'none', 'important');
        }
      }
      cur = cur.parentElement;
    }
  }

  function restoreAncestorRestrictions() {
    for (const item of overriddenAncestors) {
      try {
        if (item.transform) item.el.style.transform = item.transform;
        else item.el.style.removeProperty('transform');

        if (item.contain) item.el.style.contain = item.contain;
        else item.el.style.removeProperty('contain');

        if (item.filter) item.el.style.filter = item.filter;
        else item.el.style.removeProperty('filter');

        if (item.perspective) item.el.style.perspective = item.perspective;
        else item.el.style.removeProperty('perspective');

        if (item.willChange) item.el.style.willChange = item.willChange;
        else item.el.style.removeProperty('will-change');
      } catch (e) {}
    }
    overriddenAncestors = [];
  }

  /**
   * Растягивание контейнера и фрейма плеера на 100vw x 100vh
   */
  function ensurePlayerFullscreenStyle() {
    if (!lastWasFullscreen && !isCssFullscreenActive) return;

    const container = getPlayerContainer();
    if (container && !container.classList.contains('animego-ext-fullscreen')) {
      container.classList.add('animego-ext-fullscreen');
      container.style.setProperty('position', 'fixed', 'important');
      container.style.setProperty('top', '0', 'important');
      container.style.setProperty('left', '0', 'important');
      container.style.setProperty('width', '100vw', 'important');
      container.style.setProperty('height', '100vh', 'important');
      container.style.setProperty('max-width', '100vw', 'important');
      container.style.setProperty('max-height', '100vh', 'important');
      container.style.setProperty('min-width', '100vw', 'important');
      container.style.setProperty('min-height', '100vh', 'important');
      container.style.setProperty('aspect-ratio', 'auto', 'important');
      container.style.setProperty('padding', '0', 'important');
      container.style.setProperty('padding-top', '0', 'important');
      container.style.setProperty('margin', '0', 'important');
      container.style.setProperty('z-index', '2147483647', 'important');
      container.style.setProperty('background', '#000', 'important');
      document.body.style.overflow = 'hidden';
      isCssFullscreenActive = true;
      clearAncestorRestrictions(container);
    }

    const iframes = document.querySelectorAll(
      '.animego-ext-fullscreen iframe, [data-anime-player-target="iframeContainer"] iframe, .player-video__online iframe, .player-video iframe, #player iframe, iframe[src*="aniboom"], iframe[src*="kodik"], iframe'
    );
    iframes.forEach((f) => {
      f.classList.add('animego-ext-fullscreen');
      f.style.setProperty('position', 'absolute', 'important');
      f.style.setProperty('top', '0', 'important');
      f.style.setProperty('left', '0', 'important');
      f.style.setProperty('width', '100%', 'important');
      f.style.setProperty('height', '100%', 'important');
      f.style.setProperty('min-width', '100%', 'important');
      f.style.setProperty('min-height', '100%', 'important');
      f.style.setProperty('max-width', '100%', 'important');
      f.style.setProperty('max-height', '100%', 'important');
      f.style.setProperty('border', '0', 'important');
      f.style.setProperty('background', '#000', 'important');
      f.style.setProperty('display', 'block', 'important');
    });
  }

  let lastFullscreenToggleTime = 0;

  /**
   * Перевод всей страницы и плеера в полноэкранный режим без рамок браузера (F11 + CSS + Native)
   */
  async function applyFullscreenMode() {
    lastWasFullscreen = true;
    isCssFullscreenActive = true;
    lastFullscreenToggleTime = Date.now();

    ensurePlayerFullscreenStyle();

    // 1. Команда в background.js для перевода окна браузера в F11 Fullscreen (Chrome API)
    try {
      chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
    } catch (e) {}

    // 2. Оповещаем плеер внутри iframe
    broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'ENTER_FULLSCREEN' });

    // 3. Вызываем HTML5 Fullscreen ТОЛЬКО если есть прямой жест пользователя на ПК
    if (navigator.userActivation?.isActive) {
      try {
        const target = getPlayerIframe() || getPlayerContainer();
        if (target && !document.fullscreenElement && target.requestFullscreen) {
          target.requestFullscreen().catch(() => {});
        }
      } catch (e) {}
    }
  }

  /**
   * Выход из полноэкранного режима
   */
  function exitFullscreenMode() {
    const container = getPlayerContainer();
    if (container) {
      container.classList.remove('animego-ext-fullscreen');
      container.style.removeProperty('position');
      container.style.removeProperty('top');
      container.style.removeProperty('left');
      container.style.removeProperty('width');
      container.style.removeProperty('height');
      container.style.removeProperty('max-width');
      container.style.removeProperty('max-height');
      container.style.removeProperty('min-width');
      container.style.removeProperty('min-height');
      container.style.removeProperty('aspect-ratio');
      container.style.removeProperty('padding');
      container.style.removeProperty('padding-top');
      container.style.removeProperty('margin');
      container.style.removeProperty('z-index');
      container.style.removeProperty('background');
    }
    document.querySelectorAll('.animego-ext-fullscreen').forEach((el) => {
      el.classList.remove('animego-ext-fullscreen');
      if (el.tagName === 'IFRAME') {
        el.style.removeProperty('position');
        el.style.removeProperty('top');
        el.style.removeProperty('left');
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        el.style.removeProperty('min-width');
        el.style.removeProperty('min-height');
        el.style.removeProperty('max-width');
        el.style.removeProperty('max-height');
        el.style.removeProperty('border');
        el.style.removeProperty('background');
        el.style.removeProperty('display');
      }
    });

    restoreAncestorRestrictions();

    document.body.style.overflow = '';
    isCssFullscreenActive = false;
    lastWasFullscreen = false;

    // Оповещаем фреймы о выходе из полноэкранного режима
    broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'EXIT_FULLSCREEN' });

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      }
    } catch (e) {}

    try {
      chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: false });
    } catch (e) {}
  }

  // Выход по Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('animego-remote-modal-overlay');
      if (modal && modal.classList.contains('visible')) {
        modal.classList.remove('visible');
        return;
      }
      exitFullscreenMode();
    }
  });

  // Отслеживание выхода из полноэкранного режима при изменении размера окна
  window.addEventListener('resize', () => {
    // Не сбрасываем в момент переключения серии или перехода в fullscreen (кулдаун 3.5 сек)
    if (Date.now() - lastSwitchTime < 4000) return;
    if (Date.now() - lastFullscreenToggleTime < 3500) return;

    const isStillFs = isFullscreen();
    if (!isStillFs && isCssFullscreenActive) {
      exitFullscreenMode();
    }
  });

  // Наблюдатель за DOM для автоматического применения стилей к новому контейнеру плеера
  const domObserver = new MutationObserver(() => {
    if (lastWasFullscreen || isCssFullscreenActive) {
      ensurePlayerFullscreenStyle();
    }
  });

  domObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  /**
   * Отправка команды старта в фрейм плеера
   */
  function sendAutoplayTrigger(targetWindow = null) {
    const message = {
      type: 'ANIMEGO_AUTOPLAY_TRIGGER'
    };

    if (targetWindow) {
      try {
        targetWindow.postMessage(message, '*');
      } catch (e) {}
    } else {
      broadcastToFrames(message);
    }
  }

  /**
   * Рассылка сообщений во все дочерние фреймы страницы
   */
  function broadcastToFrames(message) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((f) => {
      try {
        f.contentWindow?.postMessage(message, '*');
      } catch (e) {}
    });
  }

  /**
   * Поиск кнопки следующей серии
   */
  function findNextEpisodeButton() {
    // Поддержка animego.co
    if (window.location.hostname.includes('animego.co')) {
      const coLinks = document.querySelectorAll('.flex-episodes-links a');
      if (coLinks.length > 0) {
        const epMatch = window.location.pathname.match(/episode-(\d+)/);
        const curEp = epMatch ? parseInt(epMatch[1], 10) : 1;
        const nextEp = curEp + 1;
        for (const a of coLinks) {
          if (a.href.includes(`/episode-${nextEp}.html`) || a.textContent.includes(`${nextEp} серия`)) {
            return { button: a, container: a, number: nextEp };
          }
        }
      }
    }

    const activeItem =
      document.querySelector('.player-video-bar__series .player-video-bar__item.active') ||
      document.querySelector('.player-video-bar__item.active') ||
      document.querySelector('[data-anime-player-episodes-target="episode"].active');

    let currentNum = null;
    if (activeItem) {
      const attr = activeItem.getAttribute('data-episode-number');
      if (attr) {
        currentNum = parseInt(attr, 10);
      } else {
        const text = activeItem.querySelector('button')?.textContent?.trim();
        if (text) currentNum = parseInt(text, 10);
      }
    }

    // Вариант А: точный поиск элемента со следующим номером (currentNum + 1)
    if (currentNum && !isNaN(currentNum)) {
      const targetNum = currentNum + 1;
      const targetItem =
        document.querySelector(`.player-video-bar__series .player-video-bar__item[data-episode-number="${targetNum}"]`) ||
        document.querySelector(`.player-video-bar__item[data-episode-number="${targetNum}"]`) ||
        document.querySelector(`[data-anime-player-episodes-target="episode"][data-episode-number="${targetNum}"]`);

      if (targetItem) {
        const btn =
          targetItem.querySelector('button[data-action*="chooseEpisode"]') ||
          targetItem.querySelector('button.player-video-bar__number') ||
          targetItem.querySelector('button') ||
          targetItem;
        return { button: btn, container: targetItem, number: targetNum };
      }
    }

    // Вариант Б: следующий соседний элемент
    if (activeItem) {
      let sibling = activeItem.nextElementSibling;
      while (sibling) {
        if (sibling.classList && sibling.classList.contains('player-video-bar__item')) {
          const btn =
            sibling.querySelector('button[data-action*="chooseEpisode"]') ||
            sibling.querySelector('button.player-video-bar__number') ||
            sibling.querySelector('button') ||
            sibling;
          const num = sibling.getAttribute('data-episode-number') || btn.textContent?.trim();
          return { button: btn, container: sibling, number: num };
        }
        sibling = sibling.nextElementSibling;
      }
    }

    // Вариант В: кнопка "Следующий эпизод" со стрелкой
    const arrowBtn =
      document.querySelector('button[data-anime-player-episodes-target="mobileNext"]') ||
      document.querySelector('button.next.m-ep-arrow');
    if (arrowBtn && !arrowBtn.disabled) {
      return { button: arrowBtn, container: null, number: 'следующую' };
    }

    return null;
  }

  /**
   * Поиск кнопки предыдущей серии
   */
  function findPrevEpisodeButton() {
    // Поддержка animego.co
    if (window.location.hostname.includes('animego.co')) {
      const coLinks = document.querySelectorAll('.flex-episodes-links a');
      if (coLinks.length > 0) {
        const epMatch = window.location.pathname.match(/episode-(\d+)/);
        const curEp = epMatch ? parseInt(epMatch[1], 10) : 1;
        const prevEp = curEp - 1;
        if (prevEp >= 1) {
          for (const a of coLinks) {
            if (a.href.includes(`/episode-${prevEp}.html`) || a.textContent.includes(`${prevEp} серия`)) {
              return { button: a, container: a, number: prevEp };
            }
          }
        }
      }
    }

    const activeItem =
      document.querySelector('.player-video-bar__series .player-video-bar__item.active') ||
      document.querySelector('.player-video-bar__item.active') ||
      document.querySelector('[data-anime-player-episodes-target="episode"].active');

    let currentNum = null;
    if (activeItem) {
      const attr = activeItem.getAttribute('data-episode-number');
      if (attr) {
        currentNum = parseInt(attr, 10);
      } else {
        const text = activeItem.querySelector('button')?.textContent?.trim();
        if (text) currentNum = parseInt(text, 10);
      }
    }

    // Вариант А: точный поиск элемента с предыдущим номером (currentNum - 1)
    if (currentNum && !isNaN(currentNum) && currentNum > 1) {
      const targetNum = currentNum - 1;
      const targetItem =
        document.querySelector(`.player-video-bar__series .player-video-bar__item[data-episode-number="${targetNum}"]`) ||
        document.querySelector(`.player-video-bar__item[data-episode-number="${targetNum}"]`) ||
        document.querySelector(`[data-anime-player-episodes-target="episode"][data-episode-number="${targetNum}"]`);

      if (targetItem) {
        const btn =
          targetItem.querySelector('button[data-action*="chooseEpisode"]') ||
          targetItem.querySelector('button.player-video-bar__number') ||
          targetItem.querySelector('button') ||
          targetItem;
        return { button: btn, container: targetItem, number: targetNum };
      }
    }

    // Вариант Б: предыдущий соседний элемент
    if (activeItem) {
      let sibling = activeItem.previousElementSibling;
      while (sibling) {
        if (sibling.classList && sibling.classList.contains('player-video-bar__item')) {
          const btn =
            sibling.querySelector('button[data-action*="chooseEpisode"]') ||
            sibling.querySelector('button.player-video-bar__number') ||
            sibling.querySelector('button') ||
            sibling;
          const num = sibling.getAttribute('data-episode-number') || btn.textContent?.trim();
          return { button: btn, container: sibling, number: num };
        }
        sibling = sibling.previousElementSibling;
      }
    }

    // Вариант В: кнопка "Предыдущий эпизод" со стрелкой (если есть)
    const arrowBtn =
      document.querySelector('button[data-anime-player-episodes-target="mobilePrev"]') ||
      document.querySelector('button.prev.m-ep-arrow');
    if (arrowBtn && !arrowBtn.disabled) {
      return { button: arrowBtn, container: null, number: 'предыдущую' };
    }

    return null;
  }

  /**
   * Переключение на следующую серию
   */
  async function switchToNextEpisode(wasFullscreen = false) {
    const now = Date.now();
    if (now - lastSwitchTime < SWITCH_COOLDOWN_MS) {
      console.log('[AnimeGO Next Episode] Запрос проигнорирован (сработал кулдаун).');
      return;
    }

    const nextInfo = findNextEpisodeButton();
    if (!nextInfo || !nextInfo.button) {
      console.log('[AnimeGO Next Episode] Следующая серия не найдена.');
      showToast('Это последняя доступная серия', 'info');
      return;
    }

    lastSwitchTime = now;
    lastWasFullscreen = wasFullscreen;

    const modeText = wasFullscreen ? ' [Полный экран F11]' : '';
    showToast(`Переключение на серию ${nextInfo.number}${modeText}...`, 'success');

    // Прокручиваем карусель к серии
    if (nextInfo.container && typeof nextInfo.container.scrollIntoView === 'function') {
      nextInfo.container.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Сохраняем и укрепляем полный экран ДО клика по серии
    if (wasFullscreen) {
      await applyFullscreenMode();
    }

    // Выполняем ровно один клик по кнопке серии
    setTimeout(() => {
      try {
        console.log(`[AnimeGO Next Episode] Клик по серии ${nextInfo.number}...`);
        nextInfo.button.focus();
        nextInfo.button.click();

        // Подкрепляем fullscreen и отправляем сигналы запуска в новый плеер
        [400, 1000, 1800, 2600].forEach((delay) => {
          setTimeout(() => {
            if (wasFullscreen) {
              ensurePlayerFullscreenStyle();
              try {
                chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
              } catch (e) {}
            }
            sendAutoplayTrigger();
          }, delay);
        });
      } catch (err) {
        console.error('[AnimeGO Next Episode] Ошибка клика по кнопке серии:', err);
      }
    }, 200);
  }

  /**
   * Переключение на предыдущую серию (по команде с пульта)
   */
  async function switchToPrevEpisode(wasFullscreen = false) {
    const now = Date.now();
    if (now - lastSwitchTime < SWITCH_COOLDOWN_MS) {
      console.log('[AnimeGO Next Episode] Запрос проигнорирован (сработал кулдаун).');
      return;
    }

    const prevInfo = findPrevEpisodeButton();
    if (!prevInfo || !prevInfo.button) {
      console.log('[AnimeGO Next Episode] Предыдущая серия не найдена.');
      showToast('Это первая доступная серия', 'info');
      return;
    }

    lastSwitchTime = now;
    lastWasFullscreen = wasFullscreen;

    const modeText = wasFullscreen ? ' [Полный экран F11]' : '';
    showToast(`Переключение на серию ${prevInfo.number}${modeText}...`, 'success');

    // Прокручиваем карусель к серии
    if (prevInfo.container && typeof prevInfo.container.scrollIntoView === 'function') {
      prevInfo.container.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Сохраняем полный экран ДО клика
    if (wasFullscreen) {
      await applyFullscreenMode();
    }

    // Выполняем ровно один клик по кнопке предыдущей серии
    setTimeout(() => {
      try {
        console.log(`[AnimeGO Next Episode] Клик по предыдущей серии ${prevInfo.number}...`);
        prevInfo.button.focus();
        prevInfo.button.click();

        [400, 1000, 1800, 2600].forEach((delay) => {
          setTimeout(() => {
            if (wasFullscreen) {
              ensurePlayerFullscreenStyle();
              try {
                chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
              } catch (e) {}
            }
            sendAutoplayTrigger();
          }, delay);
        });
      } catch (err) {
        console.error('[AnimeGO Next Episode] Ошибка клика по предыдущей серии:', err);
      }
    }, 200);
  }

  /**
   * Эмуляция полноценной цепочки событий мыши (pointerdown -> mousedown -> click)
   */
  function simulateRealClick(el) {
    if (!el) return;
    try {
      el.focus?.();
      const rect = el.getBoundingClientRect();
      const clientX = rect.left + (rect.width ? rect.width / 2 : 10);
      const clientY = rect.top + (rect.height ? rect.height / 2 : 10);
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        buttons: 1
      };

      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
        el.dispatchEvent(new MouseEvent(type, eventInit));
      });
      el.click?.();
    } catch (e) {}
  }

  /**
   * Нажатие на кнопку запуска плеера на странице AnimeGO (до создания iframe)
   */
  function tryStartTopPlayer() {
    console.log('[AnimeGO Remote] Попытка запуска плеера через эмуляцию клика...');
    let triggered = false;

    // 1. Поиск кнопок и оверлеев запуска AnimeGO.me
    const startElements = document.querySelectorAll(
      '.player-start-button, .player-start-overlay button, .player-start-overlay, [data-action*="startPlayer"], .player-start-button svg'
    );

    startElements.forEach((el) => {
      simulateRealClick(el);
      triggered = true;
    });

    // 2. Альтернативный запуск через клик по текущей серии (инициализирует плеер на AnimeGO)
    const activeEpBtn = document.querySelector(
      '.player-video-bar__series .player-video-bar__item.active button, .player-video-bar__item.active button, [data-anime-player-episodes-target="episode"].active'
    );
    if (activeEpBtn) {
      simulateRealClick(activeEpBtn);
      triggered = true;
    }

    // 3. Запуск плеера на animego.co
    const coWatchBtn = document.querySelector('.page__btn-watch, .tabs-block__select button');
    if (coWatchBtn) {
      simulateRealClick(coWatchBtn);
      triggered = true;
    }

    // Раскрытие ленивых iframe на animego.co (data-src -> src)
    const lazyIframes = document.querySelectorAll('iframe[data-src], iframe[src*="kodik"]');
    lazyIframes.forEach((ifr) => {
      let dSrc = ifr.getAttribute('data-src') || ifr.src;
      if (dSrc) {
        if (dSrc.startsWith('//')) dSrc = 'https:' + dSrc;
        if (ifr.src !== dSrc) ifr.src = dSrc;
        ifr.classList.remove('d-none');
        triggered = true;
      }
    });

    if (triggered) {
      showToast('📱 Запуск плеера...', 'info');

      if (isCssFullscreenActive || lastWasFullscreen) {
        applyFullscreenMode();
      }

      [400, 1000, 1800, 2600].forEach((delay) => {
        setTimeout(() => sendAutoplayTrigger(), delay);
      });
      setTimeout(sendCurrentInfoToRemote, 1500);
      return true;
    }

    return false;
  }

  /**
   * Загрузка и парсинг доступных озвучек и плееров (из DOM или через прямой AJAX-запрос)
   */
  async function loadTranslationsAndProviders() {
    // На animego.co плеер ТОЛЬКО Kodik!
    if (window.location.hostname.includes('animego.co')) {
      return {
        translations: [{ id: 'kodik', name: 'Kodik (Все озвучки)', active: true }],
        providers: [{ id: 'kodik', name: 'Kodik', active: true }]
      };
    }

    const translations = [];
    const providers = [];

    function extractFromDom() {
      // 1. Озвучки из открытого или скрытого меню
      const tBtns = document.querySelectorAll(
        '#playerMenu button[data-anime-player-target="translation"], [data-anime-player-target="translation"], button[data-translation], button[data-translation-id], button[data-action*="chooseTranslation"]'
      );
      tBtns.forEach((btn) => {
        const id = btn.getAttribute('data-translation') || btn.getAttribute('data-translation-id') || btn.getAttribute('data-id');
        const name = btn.querySelector('.text-truncate')?.textContent.trim() || btn.textContent.trim();
        const isActive = btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-pressed') === 'true';
        if (name && id && !translations.some((t) => t.id === id || t.name === name)) {
          translations.push({ id, name, active: isActive });
        }
      });

      // 2. Плееры из меню
      const pBtns = document.querySelectorAll(
        '#playerMenu button[data-anime-player-target="provider"], [data-anime-player-target="provider"], button[data-provider], button[data-action*="chooseProvider"]'
      );
      pBtns.forEach((btn) => {
        if (btn.classList.contains('d-none')) return;
        const id = btn.getAttribute('data-provider') || btn.getAttribute('data-id');
        const name = btn.getAttribute('data-provider-title') || btn.querySelector('.text-truncate')?.textContent.trim() || btn.textContent.trim();
        const isActive = btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-pressed') === 'true';
        if (name && !providers.some((p) => p.name === name)) {
          providers.push({ id: id || name, name, active: isActive });
        }
      });
    }

    extractFromDom();

    // Если меню еще не заполнено AnimeGO (асинхронный AJAX), запросим напрямую /player/videos/{epId}
    if (translations.length === 0) {
      const epEl =
        document.querySelector('.player-video-bar__item.active') ||
        document.querySelector('.player-video-bar__item[data-episode]') ||
        document.querySelector('[data-episode]');

      const epId = epEl ? epEl.getAttribute('data-episode') : null;
      if (epId) {
        try {
          const res = await fetch(`/player/videos/${epId}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.content) {
              const menuTarget = document.querySelector('#playerMenu, [data-anime-player-episodes-target="playerMenu"]');
              if (menuTarget && menuTarget.children.length <= 1) {
                menuTarget.innerHTML = json.data.content;
              }
              const doc = new DOMParser().parseFromString(json.data.content, 'text/html');

              const tBtns = doc.querySelectorAll('button[data-anime-player-target="translation"], button[data-translation]');
              tBtns.forEach((btn) => {
                const id = btn.getAttribute('data-translation') || btn.getAttribute('data-translation-id');
                const name = btn.querySelector('.text-truncate')?.textContent.trim() || btn.textContent.trim();
                const isActive = btn.classList.contains('active');
                if (name && id && !translations.some((t) => t.id === id || t.name === name)) {
                  translations.push({ id, name, active: isActive || translations.length === 0 });
                }
              });

              const pBtns = doc.querySelectorAll('button[data-anime-player-target="provider"], button[data-provider]');
              pBtns.forEach((btn) => {
                const id = btn.getAttribute('data-provider') || btn.getAttribute('data-id');
                const name = btn.getAttribute('data-provider-title') || btn.querySelector('.text-truncate')?.textContent.trim() || btn.textContent.trim();
                const isActive = btn.classList.contains('active');
                if (name && !providers.some((p) => p.name === name)) {
                  providers.push({ id: id || name, name, active: isActive || providers.length === 0 });
                }
              });
            }
          }
        } catch (e) {}
      }
    }

    // Если всё ещё пусто, смотрим на текущие плашки в интерфейсе страницы
    const activeDubEl = document.querySelector('.player-video-bar__dubbing');
    const activeDub = activeDubEl ? activeDubEl.textContent.trim() : '';
    if (translations.length === 0 && activeDub && activeDub !== '---') {
      translations.push({ id: 'current', name: activeDub, active: true });
    }

    const activePlayerEl = document.querySelector('.player-video-bar__player');
    const activePlayerName = activePlayerEl ? activePlayerEl.textContent.trim() : '';

    // Гарантируем стандартный набор плееров AnimeGO, если список пуст
    if (providers.length === 0) {
      const defaultProviders = ['AniBoom', 'Kodik', 'Sibnet'];
      defaultProviders.forEach((dp, idx) => {
        const isAct = activePlayerName ? activePlayerName.toLowerCase().includes(dp.toLowerCase()) : idx === 0;
        providers.push({ id: dp.toLowerCase(), name: dp, active: isAct });
      });
    }

    return { translations, providers };
  }

  /**
   * Получение полной информации о текущем аниме со страницы
   */
  async function getCurrentAnimeInfo() {
    // Поддержка animego.co: парсинг серий, озвучек и франшизы
    if (window.location.hostname.includes('animego.co')) {
      const coTitleEl = document.querySelector('.page2__header-header h1, .page__header h1, h1');
      const rawCoTitle = coTitleEl ? coTitleEl.textContent.trim() : document.title;
      const coTitle = cleanAnimeTitle(rawCoTitle);

      // 1. Серии (приоритет: данные из Kodik iframe через player.js)
      let coEpisodes = latestKodikState?.episodes && latestKodikState.episodes.length > 0
        ? [...latestKodikState.episodes]
        : [];
      let curEp = latestKodikState?.currentEpisode || 1;

      if (coEpisodes.length === 0) {
        const coLinks = document.querySelectorAll('.flex-episodes-links a');
        coLinks.forEach((a) => {
          const m = a.textContent.match(/(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (!coEpisodes.includes(n)) coEpisodes.push(n);
          }
        });
        coEpisodes.sort((a, b) => a - b);
        const epMatch = window.location.pathname.match(/episode-(\d+)/);
        if (epMatch) curEp = parseInt(epMatch[1], 10);
      }

      // 2. Озвучки (приоритет: данные из Kodik iframe через player.js)
      let coTranslations = latestKodikState?.translations && latestKodikState.translations.length > 0
        ? [...latestKodikState.translations]
        : [];

      if (coTranslations.length === 0) {
        const options = document.querySelectorAll(
          '.serial-translations-box select option, select option[data-media-id], select option[data-translation-type]'
        );
        if (options.length > 0) {
          options.forEach((opt) => {
            const id = opt.getAttribute('data-id') || opt.value;
            const title = opt.getAttribute('data-title') || opt.textContent.split('(')[0].trim();
            const epCount = opt.getAttribute('data-episode-count');
            const isSelected = opt.selected || opt.hasAttribute('selected');
            const name = epCount ? `${title} (${epCount} эп.)` : opt.textContent.trim();
            if (id && title && !coTranslations.some(t => t.id === id)) {
              coTranslations.push({ id, name, active: isSelected });
            }
          });
        }
      }

      if (coTranslations.length === 0) {
        const items = document.querySelectorAll('.serial-translations-box .dropdown-content .item, .serial-translations-box .item[data-link]');
        items.forEach((it) => {
          const id = it.getAttribute('data-link');
          const title = it.querySelector('.inner-item span:first-child')?.textContent?.trim() || it.textContent.trim();
          const ep = it.querySelector('.subtitle-icon')?.textContent?.trim();
          const isSelected = it.classList.contains('selected');
          const name = ep ? `${title} (${ep})` : title;
          if (id && title && !coTranslations.some(t => t.id === id)) {
            coTranslations.push({ id, name, active: isSelected });
          }
        });
      }

      // Если плеер ещё не развернут и .serial-translations-box отсутствует в DOM,
      // извлекаем список озвучек прямо из описания тайтла на странице
      if (coTranslations.length === 0) {
        const dubLi = Array.from(document.querySelectorAll('li, .page2__list li, .page__list li')).find((li) => {
          const sp = li.querySelector('span');
          return sp && sp.textContent.trim().toLowerCase().startsWith('озвучка');
        });
        if (dubLi) {
          const text = dubLi.textContent.replace(/^Озвучка:\s*/i, '').trim();
          const dubNames = text.split(/,\s*/);
          const seenNames = new Set();
          dubNames.forEach((name, idx) => {
            const clean = name.replace(/&amp;/g, '&').trim();
            if (clean && !seenNames.has(clean.toLowerCase())) {
              seenNames.add(clean.toLowerCase());
              coTranslations.push({
                id: clean,
                name: clean,
                active: idx === 0
              });
            }
          });
        }
      }

      // 3. Франшиза (сезоны и доп. сюжеты) СТРОГО из #franchise-block-each (исключая похожие аниме)
      const franchise = [];
      const currentUrlClean = (window.location.origin + window.location.pathname).replace(/\/$/, '');
      const franchiseLinks = document.querySelectorAll(
        '#franchise-block-each a.item, .franchise-block a.item, #franchise-block-each a'
      );
      franchiseLinks.forEach((a) => {
        let href = a.getAttribute('href') || '';
        if (!href || (!href.endsWith('.html') && !href.includes('.html'))) return;
        if (href.startsWith('/')) href = 'https://animego.co' + href;
        const cleanHref = href.split('?')[0].split('#')[0].replace(/\/$/, '');
        if (cleanHref === currentUrlClean) return; // Исключаем текущую открытую страницу
        if (franchise.some((f) => f.url === href || f.url === cleanHref)) return;

        const nameEl = a.querySelector('.name, .info .name, .title');
        const text = cleanAnimeTitle(nameEl ? nameEl.textContent : a.textContent);
        if (!text || text.length < 2) return;

        const dateEl = a.querySelector('.date');
        const dateText = dateEl && dateEl.textContent.trim() ? ` (${dateEl.textContent.trim()})` : '';

        const imgEl = a.querySelector('img');
        let poster = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
        if (poster.startsWith('/')) poster = 'https://animego.co' + poster;

        franchise.push({
          title: text + dateText,
          url: href,
          poster: poster
        });
      });

      return {
        type: 'CURRENT_INFO',
        from: 'pc',
        title: coTitle || 'AnimeGO.co Player',
        isPlayerStarted: true,
        currentEpisode: curEp,
        episodes: coEpisodes.length > 0 ? coEpisodes : [1],
        translations: coTranslations.length > 0 ? coTranslations : [{ id: 'kodik', name: 'Kodik (Все озвучки)', active: true }],
        providers: [{ id: 'kodik', name: 'Kodik (Только Kodik)', active: true }],
        franchise: franchise.slice(0, 15),
        url: window.location.href,
        mirror: 'animego.co',
        isMirrorCo: true,
        isKodik: true,
        timestamp: Date.now()
      };
    }

    const titleEl = document.querySelector('.anime-title h1, .anime-title, h1');
    let title = cleanAnimeTitle(titleEl ? titleEl.textContent : document.title);

    // Проверка статуса запуска плеера
    const startBtn = document.querySelector('.player-start-button, .player-start-overlay button, .player-start-overlay');
    const isPlayerStarted = !startBtn || startBtn.offsetParent === null;

    // Активная серия
    const activeItem =
      document.querySelector('.player-video-bar__series .player-video-bar__item.active') ||
      document.querySelector('.player-video-bar__item.active') ||
      document.querySelector('[data-anime-player-episodes-target="episode"].active');

    let currentEpisode = null;
    if (activeItem) {
      const attr = activeItem.getAttribute('data-episode-number');
      currentEpisode = attr ? parseInt(attr, 10) : parseInt(activeItem.textContent.trim(), 10);
    }

    // Список всех доступных серий
    const episodeElements = document.querySelectorAll(
      '.player-video-bar__series .player-video-bar__item, [data-anime-player-episodes-target="episode"]'
    );
    const episodes = [];
    episodeElements.forEach((el) => {
      const attr = el.getAttribute('data-episode-number');
      const num = attr ? parseInt(attr, 10) : parseInt(el.textContent.trim(), 10);
      if (num && !isNaN(num) && !episodes.includes(num)) {
        episodes.push(num);
      }
    });
    episodes.sort((a, b) => a - b);

    // Озвучки и плееры
    const { translations, providers } = await loadTranslationsAndProviders();

    // Другие сезоны / франшиза со страницы аниме
    const franchise = [];
    const franchiseLinks = document.querySelectorAll(
      '.seasons-item .seasons__link, .anime-franchise a, .franchise a, [data-anime-franchise] a, .anime-related a, .media a[href*="/anime/"]'
    );
    franchiseLinks.forEach((a) => {
      const href = a.getAttribute('href');
      const text = a.textContent.trim();
      if (href && href.includes('/anime/') && text && text.length > 2 && !franchise.some((f) => f.url === href)) {
        franchise.push({
          title: text,
          url: href.startsWith('/') ? window.location.origin + href : href
        });
      }
    });

    return {
      type: 'CURRENT_INFO',
      from: 'pc',
      title: title || 'AnimeGO Player',
      isPlayerStarted: isPlayerStarted,
      currentEpisode: currentEpisode || 1,
      episodes: episodes.length > 0 ? episodes : [1],
      translations: translations,
      providers: providers,
      franchise: franchise.slice(0, 10),
      url: window.location.href,
      mirror: window.location.hostname,
      isMirrorCo: window.location.hostname.includes('animego.co'),
      timestamp: Date.now()
    };
  }

  let latestKodikState = null;
  let lastSentHash = '';
  let lastSentTime = 0;
  let activePeer = null;
  let activePeerConn = null;

  /**
   * Отправка данных на пульт через WebRTC DataChannel
   */
  function sendToRemote(payload) {
    if (activePeerConn && activePeerConn.open) {
      try {
        activePeerConn.send(payload);
        return true;
      } catch (e) {
        console.warn('[AnimeGO Remote] Ошибка отправки по P2P WebRTC:', e);
      }
    }
    return false;
  }

  /**
   * Отправка информации о текущем тайтле на пульт
   */
  async function sendCurrentInfoToRemote(force = false) {
    if (!activePeerConn || !activePeerConn.open) {
      return;
    }

    try {
      const info = await getCurrentAnimeInfo();
      const stateHash = `${info.title}_${info.currentEpisode}_${info.isPlayerStarted}_${info.translations.length}_${info.providers.length}_${info.episodes.length}_${info.mirror}`;

      const now = Date.now();
      if (!force && stateHash === lastSentHash && now - lastSentTime < 1000) {
        return;
      }

      lastSentHash = stateHash;
      lastSentTime = now;

      sendToRemote(info);
    } catch (err) {
      // Игнорируем
    }
  }

  /**
   * Переключение озвучки на странице AnimeGO
   */
  function switchTranslation(idOrTitle) {
    if (!idOrTitle) return false;

    // Поддержка animego.co: переключение через кастомный dropdown, <select> и Kodik iframe
    if (window.location.hostname.includes('animego.co')) {
      const cleanTarget = String(idOrTitle).toLowerCase().trim();

      // 1. Поиск соответствующего <option> в <select>
      const sel = document.querySelector('.serial-translations-box select');
      let matchedOpt = null;
      if (sel) {
        matchedOpt = sel.querySelector(`option[value="${idOrTitle}"], option[data-id="${idOrTitle}"]`) ||
                     Array.from(sel.options).find(o => {
                       const t = (o.getAttribute('data-title') || o.textContent).toLowerCase();
                       return t === cleanTarget || t.includes(cleanTarget) || cleanTarget.includes(t.split('(')[0].trim());
                     });
      }

      const linkId = matchedOpt ? (matchedOpt.getAttribute('data-id') || matchedOpt.value) : idOrTitle;

      // 2. Клик по кастомному dropdown
      let item = document.querySelector(
        `.serial-translations-box .dropdown-content .item[data-link="${linkId}"], .serial-translations-box .dropdown-content .item[data-link="${cleanTarget}"]`
      );
      if (!item) {
        const allItems = document.querySelectorAll('.serial-translations-box .dropdown-content .item');
        for (const it of allItems) {
          const t = it.textContent.toLowerCase();
          if (t.includes(cleanTarget) || cleanTarget.includes(t.replace(/\(.*?\)/g, '').trim())) {
            item = it;
            break;
          }
        }
      }

      if (item) {
        console.log('[AnimeGO Remote] Клик по элементу озвучки animego.co:', item.textContent.trim());
        simulateRealClick(item);
      }

      if (sel && matchedOpt) {
        sel.value = matchedOpt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 3. Прямое обновление Kodik iframe по data-media-id и data-media-hash
      if (matchedOpt) {
        const mediaId = matchedOpt.getAttribute('data-media-id');
        const mediaHash = matchedOpt.getAttribute('data-media-hash');
        const mediaType = matchedOpt.getAttribute('data-media-type') || 'serial';
        if (mediaId && mediaHash) {
          const kodikIframe = document.querySelector('iframe[src*="kodik"], iframe[data-src*="kodik"]');
          if (kodikIframe) {
            const curEpMatch = window.location.pathname.match(/episode-(\d+)/);
            const curEp = curEpMatch ? curEpMatch[1] : '';
            let newSrc = `https://kodikplayer.com/${mediaType}/${mediaId}/${mediaHash}/720p`;
            if (curEp) newSrc += `?episode=${curEp}`;
            console.log('[AnimeGO Remote] Обновление Kodik iframe:', newSrc);
            kodikIframe.src = newSrc;
          }
        }
      }

      if (item || matchedOpt) {
        const title = matchedOpt ? (matchedOpt.getAttribute('data-title') || matchedOpt.text) : (item ? item.textContent.trim() : idOrTitle);
        showToast(`📱 Озвучка: ${title}`, 'success');
        setTimeout(sendCurrentInfoToRemote, 1200);
        return true;
      }

      showToast(`Озвучка ${idOrTitle} не найдена`, 'warning');
      return false;
    }

    const target = String(idOrTitle).toLowerCase().trim();

    function tryClick() {
      const buttons = document.querySelectorAll(
        '#playerMenu button[data-anime-player-target="translation"], [data-anime-player-target="translation"], button[data-translation], button[data-translation-id], button[data-action*="chooseTranslation"]'
      );

      for (const btn of buttons) {
        const id = (btn.getAttribute('data-translation') || btn.getAttribute('data-translation-id') || '').toLowerCase();
        const title = (btn.querySelector('.text-truncate')?.textContent || btn.textContent || '').toLowerCase().trim();

        if (id === target || title === target || title.includes(target) || target.includes(title)) {
          console.log(`[AnimeGO Remote] Выбрана озвучка: ${btn.textContent.trim()}`);
          showToast(`📱 Озвучка: ${btn.textContent.trim()}`, 'success');
          btn.focus?.();
          btn.click();
          if (isCssFullscreenActive || lastWasFullscreen) applyFullscreenMode();
          setTimeout(() => {
            sendCurrentInfoToRemote();
          }, 800);
          return true;
        }
      }
      return false;
    }

    if (tryClick()) return true;

    // Если кнопки меню ещё не открыты в DOM, пробуем открыть меню
    const toggleBtn = document.querySelector('.player-video-bar__btn__trans-player');
    if (toggleBtn) {
      toggleBtn.click();
      setTimeout(tryClick, 300);
    }
    return false;
  }

  /**
   * Переключение плеера на странице AnimeGO
   */
  function switchProvider(idOrTitle) {
    if (!idOrTitle) return false;
    if (window.location.hostname.includes('animego.co')) {
      showToast('На animego.co доступен только плеер Kodik', 'info');
      return true;
    }
    const target = String(idOrTitle).toLowerCase().trim();

    function tryClick() {
      const buttons = document.querySelectorAll(
        '#playerMenu button[data-anime-player-target="provider"], [data-anime-player-target="provider"], button[data-provider], button[data-action*="chooseProvider"]'
      );

      for (const btn of buttons) {
        if (btn.classList.contains('d-none')) continue;
        const id = (btn.getAttribute('data-provider') || '').toLowerCase();
        const title = (btn.getAttribute('data-provider-title') || btn.querySelector('.text-truncate')?.textContent || btn.textContent || '').toLowerCase().trim();

        if (id === target || title === target || title.includes(target) || target.includes(title)) {
          console.log(`[AnimeGO Remote] Выбран плеер: ${btn.textContent.trim()}`);
          showToast(`📱 Плеер: ${btn.textContent.trim()}`, 'success');
          btn.focus?.();
          btn.click();
          if (isCssFullscreenActive || lastWasFullscreen) applyFullscreenMode();
          setTimeout(() => {
            sendCurrentInfoToRemote();
          }, 800);
          return true;
        }
      }
      return false;
    }

    if (tryClick()) return true;

    const toggleBtn = document.querySelector('.player-video-bar__btn__trans-player');
    if (toggleBtn) {
      toggleBtn.click();
      setTimeout(tryClick, 300);
    }
    return false;
  }

  /**
   * Выполняет fetch запрос с обходом ограничений CORS через background.js
   */
  async function crossOriginFetch(url, options = {}) {
    try {
      const targetUrl = new URL(url, window.location.href);
      // Если запрос к тому же источнику (same-origin), выполняем напрямую
      if (targetUrl.origin === window.location.origin) {
        const res = await fetch(url, options);
        const text = await res.text();
        return { ok: res.ok, status: res.status, text };
      }
    } catch (e) {}

    // Кросс-доменный запрос (например с animego.me на animego.co) отправляем через background service worker
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'FETCH_URL', url, options }, (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn('[AnimeGO Remote] Ошибка запроса через background, фолбэк на прямой fetch:', chrome.runtime.lastError);
            fetch(url, options)
              .then(async (r) => resolve({ ok: r.ok, status: r.status, text: await r.text() }))
              .catch((err) => resolve({ ok: false, status: 0, text: '', error: err.message }));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        console.warn('[AnimeGO Remote] Не удалось отправить сообщение в background:', err);
        fetch(url, options)
          .then(async (r) => resolve({ ok: r.ok, status: r.status, text: await r.text() }))
          .catch((fetchErr) => resolve({ ok: false, status: 0, text: '', error: fetchErr.message }));
      }
    });
  }

  /**
   * Поиск аниме на указанном источнике (animego.me или animego.co) и отправка на пульт
   */
  async function searchAnimeGo(query, requestedSource) {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    const source = requestedSource || (window.location.hostname.includes('animego.co') ? 'animego.co' : 'animego.me');
    console.log(`[AnimeGO Remote] Поиск "${cleanQuery}" (источник: ${source})`);
    showToast(`📱 Поиск [${source}]: "${cleanQuery}"...`, 'info');

    try {
      const results = [];
      const seenUrls = new Set();

      if (source === 'animego.co') {
        const searchUrl = `https://animego.co/index.php?do=search&subaction=search&story=${encodeURIComponent(cleanQuery)}`;
        const res = await crossOriginFetch(searchUrl);
        if (res.ok && res.text) {
          const html = res.text;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const cards = doc.querySelectorAll('article.card, .card');

          cards.forEach((card) => {
            const link = card.querySelector('.card__title a, a.card__link, h3 a, a[href*=".html"]');
            if (!link) return;
            let url = link.getAttribute('href') || '';
            if (!url.includes('.html')) return;
            if (url.startsWith('/')) url = 'https://animego.co' + url;
            if (seenUrls.has(url)) return;

            let title = cleanAnimeTitle(link.textContent || card.querySelector('.card__title')?.textContent);
            if (!title || title.length < 2) return;

            const img = card.querySelector('.card__img img, img');
            let poster = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
            if (poster.startsWith('/')) poster = 'https://animego.co' + poster;

            const metaEl = card.querySelector('.card__category, .card__info, .card__meta');
            const meta = metaEl ? metaEl.textContent.replace(/\s+/g, ' ').trim() : 'animego.co (РФ)';

            seenUrls.add(url);
            results.push({ title, url, poster, meta, source: 'animego.co' });
          });
        }
      } else {
        const animeUrl = `https://animego.me/search/anime?q=${encodeURIComponent(cleanQuery)}`;
        const allUrl = `https://animego.me/search/all?q=${encodeURIComponent(cleanQuery)}`;

        const [resAnime, resAll] = await Promise.allSettled([
          crossOriginFetch(animeUrl),
          crossOriginFetch(allUrl)
        ]);

        let combinedHtml = '';
        if (resAnime.status === 'fulfilled' && resAnime.value && resAnime.value.ok && resAnime.value.text) {
          combinedHtml += resAnime.value.text;
        }
        if (resAll.status === 'fulfilled' && resAll.value && resAll.value.ok && resAll.value.text) {
          combinedHtml += '\n' + resAll.value.text;
        }

        if (combinedHtml) {
          const doc = new DOMParser().parseFromString(combinedHtml, 'text/html');
          const items = doc.querySelectorAll(
            '.ani-grid__item, [class*="ani-grid__item"], .seasons-item, .animes-grid-item, .animes-list-item'
          );

          items.forEach((item) => {
            const titleLink =
              item.querySelector('.ani-grid__item-title a, .seasons__name a, .card-title, .anime-title, h5 a, h4 a, h2 a') ||
              item.querySelector('a[href*="/anime/"]');
            if (!titleLink) return;

            let url = titleLink.getAttribute('href') || '';
            if (!url || !url.includes('/anime/') || url === '/anime' || url === '/anime/') return;
            if (url.startsWith('/')) url = 'https://animego.me' + url;
            if (seenUrls.has(url)) return;

            let title = cleanAnimeTitle(titleLink.getAttribute('title') || titleLink.textContent);
            if (!title || title.length < 2) {
              const pTitle = item.querySelector('.ani-grid__item-title, .seasons__name');
              if (pTitle) title = cleanAnimeTitle(pTitle.textContent);
            }
            if (!title || title.length < 2) return;

            const img = item.querySelector('.ani-grid__item-picture img, .seasons__img, .image__img, img');
            let poster = '';
            if (img) {
              poster = img.getAttribute('src') || img.getAttribute('data-src') || '';
              if (poster.startsWith('/')) poster = 'https://animego.me' + poster;
            }

            const metaEl = item.querySelector('.ani-grid__item-genres, .seasons__info, .anime-year, .text-muted, [class*="genre"], .card-text');
            const meta = metaEl ? metaEl.textContent.replace(/\s+/g, ' ').trim() : 'animego.me';

            seenUrls.add(url);
            results.push({ title, url, poster, meta, source: 'animego.me' });
          });

          const extraLinks = doc.querySelectorAll('a[href*="/anime/"][title]');
          extraLinks.forEach((a) => {
            let url = a.getAttribute('href') || '';
            if (!url || url === '/anime' || url === '/anime/' || url.includes('/search/')) return;
            if (url.startsWith('/')) url = 'https://animego.me' + url;
            if (seenUrls.has(url)) return;

            let title = cleanAnimeTitle(a.getAttribute('title') || a.textContent);
            if (!title || title.length < 2) return;

            seenUrls.add(url);
            results.push({ title, url, poster: '', meta: 'animego.me', source: 'animego.me' });
          });
        }
      }

      // Ранжирование по релевантности
      const queryWords = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      results.forEach((item) => {
        const titleLower = item.title.toLowerCase();
        let score = 0;
        let matchedWords = 0;

        queryWords.forEach((word) => {
          if (titleLower.includes(word)) {
            score += 15;
            matchedWords++;
          }
        });

        if (titleLower.includes(cleanQuery.toLowerCase())) {
          score += 40;
        }

        if (queryWords.length > 0 && titleLower.startsWith(queryWords[0])) {
          score += 20;
        }

        item.score = score;
        item.matchedWords = matchedWords;
      });

      results.sort((a, b) => b.score - a.score || b.matchedWords - a.matchedWords);

      const responsePayload = {
        type: 'SEARCH_RESULTS',
        from: 'pc',
        source: source,
        query: cleanQuery,
        results: results.slice(0, 35),
        timestamp: Date.now()
      };

      sendToRemote(responsePayload);

      showToast(`📱 [${source}] Найдено: ${results.length}`, 'success');
    } catch (err) {
      console.error('[AnimeGO Remote] Ошибка поиска:', err);
      showToast('📱 Ошибка поиска аниме', 'warning');
    }
  }

  /**
   * Получение вариантов тайтла / сезонов на целевом зеркале для выбора пользователем
   */
  async function fetchMirrorOptions(targetMirror) {
    const curHost = window.location.hostname;
    const destMirror = targetMirror || (curHost.includes('animego.co') ? 'animego.me' : 'animego.co');

    const titleEl = document.querySelector('.anime-title h1, .page2__header-header h1, h1');
    const rawTitle = titleEl ? titleEl.textContent.trim() : document.title;
    const cleanTitle = cleanAnimeTitle(rawTitle);

    const baseTitle = cleanTitle.split(/[:—–]|(?:\d+\s*сезон)/i)[0].replace(/\[.*?\]|\(.*?\)/g, '').trim() || cleanTitle;

    showToast(`📱 Поиск вариантов на ${destMirror}...`, 'info');

    const options = [];
    const seenUrls = new Set();

    if (destMirror.includes('animego.co')) {
      try {
        const searchUrl = `https://animego.co/index.php?do=search&subaction=search&story=${encodeURIComponent(baseTitle)}`;
        const res = await crossOriginFetch(searchUrl);
        if (res.ok && res.text) {
          const html = res.text;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const cards = doc.querySelectorAll('article.card, .card');

          cards.forEach((card) => {
            const titleLink = card.querySelector('.card__title a, a.card__link, h3 a, a[href*=".html"]');
            if (!titleLink) return;
            const href = titleLink.getAttribute('href');
            if (!href || !href.includes('.html')) return;
            const fullUrl = href.startsWith('/') ? 'https://animego.co' + href : href;
            if (seenUrls.has(fullUrl)) return;
            seenUrls.add(fullUrl);

            const t = cleanAnimeTitle(titleLink.textContent || card.querySelector('.card__title')?.textContent);
            if (!t) return;

            const img = card.querySelector('.card__img img, img');
            let poster = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
            if (poster.startsWith('/')) poster = 'https://animego.co' + poster;

            const metaEl = card.querySelector('.card__category, .card__info, .card__meta');
            const meta = metaEl ? metaEl.textContent.replace(/\s+/g, ' ').trim() : 'animego.co (РФ)';

            options.push({ title: t, url: fullUrl, poster, meta, source: 'animego.co' });
          });
        }
      } catch (e) {
        console.error('[AnimeGO Remote] Ошибка поиска на animego.co:', e);
      }
    } else {
      try {
        const cleanQuery = baseTitle.replace(/^[«"'\s]+|[»"'\s]+$/g, '').trim();
        const animeUrl = `https://animego.me/search/anime?q=${encodeURIComponent(cleanQuery)}`;
        const allUrl = `https://animego.me/search/all?q=${encodeURIComponent(cleanQuery)}`;

        const [resAnime, resAll] = await Promise.allSettled([
          crossOriginFetch(animeUrl),
          crossOriginFetch(allUrl)
        ]);

        let combinedHtml = '';
        if (resAnime.status === 'fulfilled' && resAnime.value?.ok && resAnime.value.text) {
          combinedHtml += resAnime.value.text;
        }
        if (resAll.status === 'fulfilled' && resAll.value?.ok && resAll.value.text) {
          combinedHtml += '\n' + resAll.value.text;
        }

        if (combinedHtml) {
          const doc = new DOMParser().parseFromString(combinedHtml, 'text/html');
          const cards = doc.querySelectorAll(
            '.ani-grid__item, [class*="ani-grid__item"], .animes-grid-item, .animes-list-item, .seasons-item, article.card'
          );

          cards.forEach((card) => {
            const titleLink =
              card.querySelector('.ani-grid__item-title a, .seasons__name a, .card-title, .anime-title, h5 a, h4 a, h2 a') ||
              card.querySelector('a[href*="/anime/"]');
            if (!titleLink) return;

            let href = titleLink.getAttribute('href') || '';
            if (!href || href === '/anime/' || href.includes('/search/')) return;
            // Исключаем ссылки на разделы навигации / каталога
            if (/\/anime\/(top|ongoing|filter|catalog|random|season|status|type)(\/|$)/i.test(href)) return;

            const fullUrl = href.startsWith('/') ? 'https://animego.me' + href : href;
            if (seenUrls.has(fullUrl)) return;
            seenUrls.add(fullUrl);

            const t = cleanAnimeTitle(titleLink.getAttribute('title') || titleLink.textContent);
            if (!t || t.length < 2) return;

            const img = card.querySelector('img');
            let poster = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
            if (poster.startsWith('/')) poster = 'https://animego.me' + poster;

            const metaEl = card.querySelector('.ani-grid__item-meta, .card__info, .card__meta, .text-gray-dark');
            const meta = metaEl ? metaEl.textContent.replace(/\s+/g, ' ').trim() : 'animego.me';

            options.push({ title: t, url: fullUrl, poster, meta, source: 'animego.me' });
          });
        }
      } catch (e) {
        console.error('[AnimeGO Remote] Ошибка поиска на animego.me:', e);
      }
    }

    const payload = {
      type: 'MIRROR_OPTIONS',
      from: 'pc',
      targetMirror: destMirror,
      query: baseTitle,
      options: options.slice(0, 15),
      timestamp: Date.now()
    };

    sendToRemote(payload);
    showToast(`📱 Найдено вариантов зеркала: ${options.length}`, 'success');

    return options;
  }

  /**
   * Прямое переключение на указанный номер серии
   */
  async function switchToEpisodeNumber(targetNum, wasFullscreen = false) {
    if (!targetNum || isNaN(targetNum)) return;

    // Поддержка переключения серий на animego.co (ссылки .flex-episodes-links a)
    if (window.location.hostname.includes('animego.co')) {
      const coLinks = document.querySelectorAll('.flex-episodes-links a');
      for (const a of coLinks) {
        const m = a.textContent.match(/(\d+)/);
        if (m && parseInt(m[1], 10) === parseInt(targetNum, 10)) {
          showToast(`Переключение на серию ${targetNum}...`, 'success');
          if (a.href) {
            window.location.href = a.href;
            return;
          }
        }
      }
    }

    const targetItem =
      document.querySelector(`.player-video-bar__series .player-video-bar__item[data-episode-number="${targetNum}"]`) ||
      document.querySelector(`.player-video-bar__item[data-episode-number="${targetNum}"]`) ||
      document.querySelector(`[data-anime-player-episodes-target="episode"][data-episode-number="${targetNum}"]`);

    let btn = null;
    if (targetItem) {
      btn =
        targetItem.querySelector('button[data-action*="chooseEpisode"]') ||
        targetItem.querySelector('button.player-video-bar__number') ||
        targetItem.querySelector('button') ||
        targetItem;
    } else {
      const allBtns = document.querySelectorAll(
        '.player-video-bar__series button, [data-anime-player-episodes-target="episode"] button'
      );
      for (const b of allBtns) {
        if (b.textContent.trim() === String(targetNum)) {
          btn = b;
          break;
        }
      }
    }

    if (!btn) {
      showToast(`Серия ${targetNum} не найдена`, 'warning');
      return;
    }

    lastSwitchTime = Date.now();
    lastWasFullscreen = wasFullscreen;

    showToast(`Переключение на серию ${targetNum}...`, 'success');

    if (targetItem && typeof targetItem.scrollIntoView === 'function') {
      targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    if (wasFullscreen) {
      await applyFullscreenMode();
    }

    setTimeout(() => {
      try {
        btn.focus?.();
        btn.click();

        [400, 1000].forEach((delay) => {
          setTimeout(() => {
            if (wasFullscreen) {
              ensurePlayerFullscreenStyle();
              try {
                chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
              } catch (e) {}
            }
          }, delay);
        });

        setTimeout(sendCurrentInfoToRemote, 1200);
      } catch (err) {
        console.error('[AnimeGO Next Episode] Ошибка клика по серии:', err);
      }
    }, 200);
  }

  /**
   * Открытие страницы аниме по переданному URL
   */
  function openAnimeByUrl(targetUrl, preferredMirror) {
    if (!targetUrl || typeof targetUrl !== 'string') return;
    try {
      const parsed = new URL(targetUrl, window.location.origin);
      if (parsed.hostname.includes('animego')) {
        let hostToUse = window.location.host;
        if (preferredMirror && preferredMirror.includes('animego')) {
          hostToUse = preferredMirror;
        }
        const sep = parsed.search ? '&' : '?';
        const finalUrl = `${window.location.protocol}//${hostToUse}${parsed.pathname}${parsed.search}${sep}ago_room=${encodeURIComponent(currentRoomId)}${parsed.hash}`;
        showToast('📱 Открытие аниме с пульта...', 'info');
        window.location.href = finalUrl;
      } else {
        showToast('Недопустимый URL аниме', 'warning');
      }
    } catch (e) {
      console.error('[AnimeGO Remote] Неверный URL:', targetUrl, e);
    }
  }

  /**
   * Переключение между зеркалами
   */
  async function switchMirrorWithSearch(targetMirror) {
    const curHost = window.location.hostname;
    const destMirror = targetMirror || (curHost.includes('animego.co') ? 'animego.me' : 'animego.co');

    // Получаем список вариантов и отправляем на пульт
    const options = await fetchMirrorOptions(destMirror);
    if (options && options.length === 1) {
      openAnimeByUrl(options[0].url, destMirror);
    }
  }

  /**
   * Обработка команд, пришедших с мобильного пульта через WebRTC P2P DataChannel
   */
  function handleRemoteCommand(rawMessage) {
    if (!rawMessage) return;

    let parsed = rawMessage;
    if (typeof rawMessage === 'string') {
      try {
        parsed = JSON.parse(rawMessage);
      } catch (e) {
        parsed = { command: rawMessage };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      parsed = { command: rawMessage };
    }

    if (parsed.from === 'pc') return;

    const command = parsed.command || parsed.action || parsed.type;
    const extra = parsed;

    if (!command) return;
    console.log('[AnimeGO Remote] Получена команда:', command, extra);

    const isFsNow = isFullscreen() || isCssFullscreenActive || lastWasFullscreen;

    switch (command) {
      case 'SWITCH_MIRROR': {
        if (extra.url) {
          openAnimeByUrl(extra.url, extra.mirror);
        } else {
          fetchMirrorOptions(extra.mirror);
        }
        break;
      }

      case 'FETCH_MIRROR_OPTIONS': {
        fetchMirrorOptions(extra.mirror || extra.targetMirror);
        break;
      }

      case 'SEARCH_ANIME':
        searchAnimeGo(extra.query || extra.q, extra.source);
        break;

      case 'OPEN_ANIME':
        openAnimeByUrl(extra.url || extra.href, extra.mirror);
        break;

      case 'CHOOSE_EPISODE': {
        const epNum = parseInt(extra.episode || extra.number, 10);
        showToast(`📱 Серия: ${epNum}`, 'info');
        broadcastToFrames({
          type: 'ANIMEGO_REMOTE_COMMAND',
          command: 'CHOOSE_EPISODE',
          episode: epNum
        });
        if (window.location.hostname.includes('animego.co') || latestKodikState) {
          if (latestKodikState) {
            latestKodikState.currentEpisode = epNum;
          }
          setTimeout(() => sendCurrentInfoToRemote(true), 800);
        } else {
          switchToEpisodeNumber(epNum, isFsNow);
        }
        break;
      }

      case 'CHOOSE_TRANSLATION': {
        const trTitle = extra.title || extra.name || extra.id;
        showToast(`📱 Озвучка: ${trTitle}`, 'info');
        broadcastToFrames({
          type: 'ANIMEGO_REMOTE_COMMAND',
          command: 'CHOOSE_TRANSLATION',
          id: extra.id,
          title: extra.title || extra.name
        });
        if (latestKodikState && latestKodikState.translations) {
          latestKodikState.translations.forEach((t) => {
            t.active = (t.id == extra.id || t.name === trTitle || t.name.toLowerCase().includes(String(trTitle).toLowerCase()));
          });
        }
        if (!window.location.hostname.includes('animego.co')) {
          switchTranslation(extra.id || extra.title || extra.name);
        } else {
          setTimeout(() => sendCurrentInfoToRemote(true), 800);
        }
        break;
      }

      case 'CHOOSE_PROVIDER':
        switchProvider(extra.id || extra.title || extra.name);
        break;

      case 'CHOOSE_QUALITY':
        showToast(`📱 Качество: ${extra.quality}`, 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'CHOOSE_QUALITY', quality: extra.quality });
        break;

      case 'START_PLAYER':
        tryStartTopPlayer();
        break;

      case 'GET_CURRENT_INFO':
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'REQUEST_KODIK_STATE' });
        sendCurrentInfoToRemote(true);
        break;

      case 'NEXT_EPISODE':
        showToast('📱 Пульт: Следующая серия', 'info');
        if (window.location.hostname.includes('animego.co') || latestKodikState) {
          broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'NEXT_EPISODE' });
          if (latestKodikState && latestKodikState.currentEpisode) {
            latestKodikState.currentEpisode++;
          }
          setTimeout(() => sendCurrentInfoToRemote(true), 1000);
        } else {
          switchToNextEpisode(isFsNow);
          setTimeout(sendCurrentInfoToRemote, 1800);
        }
        break;

      case 'PREV_EPISODE':
        showToast('📱 Пульт: Предыдущая серия', 'info');
        if (window.location.hostname.includes('animego.co') || latestKodikState) {
          broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'PREV_EPISODE' });
          if (latestKodikState && latestKodikState.currentEpisode && latestKodikState.currentEpisode > 1) {
            latestKodikState.currentEpisode--;
          }
          setTimeout(() => sendCurrentInfoToRemote(true), 1000);
        } else {
          switchToPrevEpisode(isFsNow);
          setTimeout(sendCurrentInfoToRemote, 1800);
        }
        break;

      case 'TOGGLE_FULLSCREEN':
        if (isFullscreen() || isCssFullscreenActive) {
          showToast('📱 Пульт: Выход из полноэкранного режима', 'info');
          exitFullscreenMode();
        } else {
          showToast('📱 Пульт: Полный экран', 'info');
          applyFullscreenMode();
        }
        break;

      case 'TOGGLE_PLAY':
        if (tryStartTopPlayer()) return;
        showToast('📱 Пульт: Пауза / Воспроизведение', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'TOGGLE_PLAY' });
        break;

      case 'PLAY':
        if (tryStartTopPlayer()) return;
        showToast('📱 Пульт: Воспроизведение', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'PLAY' });
        break;

      case 'PAUSE':
        showToast('📱 Пульт: Пауза', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'PAUSE' });
        break;

      case 'SEEK_BACK':
        showToast(`📱 Пульт: -${extra.seconds || 10}с`, 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'SEEK_BACK', seconds: extra.seconds || 10 });
        break;

      case 'SEEK_FORWARD':
        showToast(`📱 Пульт: +${extra.seconds || 10}с`, 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'SEEK_FORWARD', seconds: extra.seconds || 10 });
        break;

      case 'VOLUME_UP':
        showToast('📱 Пульт: Громкость +', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'VOLUME_UP' });
        break;

      case 'VOLUME_DOWN':
        showToast('📱 Пульт: Громкость -', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'VOLUME_DOWN' });
        break;

      case 'TOGGLE_MUTE':
        showToast('📱 Пульт: Звук вкл/выкл', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'TOGGLE_MUTE' });
        break;

      default:
        console.log('[AnimeGO Remote] Неизвестная команда:', command);
        break;
    }
  }

  const P2P_ICE_SERVERS = [
    { urls: 'stun:edgemq.online:3478' },
    {
      urls: [
        'turn:edgemq.online:3478?transport=udp',
        'turn:edgemq.online:3478?transport=tcp'
      ],
      username: 'animego',
      credential: 'animego2026_remote'
    },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  /**
   * Инициализация прямого WebRTC P2P соединения (PeerJS) с пультом на телефоне
   */
  function initPeerJS(roomId) {
    if (typeof Peer === 'undefined') {
      console.warn('[AnimeGO Remote] PeerJS не обнаружен в расширении');
      return;
    }

    try {
      if (activePeer) {
        try { activePeer.destroy(); } catch (e) {}
      }

      console.log('[AnimeGO Remote] Инициализация P2P WebRTC узла для комнаты:', roomId);
      activePeer = new Peer(roomId, {
        debug: 1,
        config: {
          iceServers: P2P_ICE_SERVERS,
          sdpSemantics: 'unified-plan'
        }
      });

      activePeer.on('open', (id) => {
        console.log('[AnimeGO Remote] P2P Peer готов к подключению с телефона! ID:', id);
      });

      activePeer.on('connection', (conn) => {
        console.log('[AnimeGO Remote] Получено прямое P2P WebRTC подключение от:', conn.peer);
        if (activePeerConn && activePeerConn !== conn) {
          try { activePeerConn.close(); } catch (e) {}
        }
        activePeerConn = conn;

        if (conn.peerConnection) {
          conn.peerConnection.onconnectionstatechange = () => {
            console.log('[AnimeGO Remote] WebRTC Connection State:', conn.peerConnection.connectionState);
          };
          conn.peerConnection.oniceconnectionstatechange = () => {
            console.log('[AnimeGO Remote] WebRTC ICE State:', conn.peerConnection.iceConnectionState);
          };
        }

        const onOpen = () => {
          console.log('[AnimeGO Remote] P2P соединение установлено');
          showToast('📱 Пульт подключен', 'success');
          broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'REQUEST_KODIK_STATE' });
          sendCurrentInfoToRemote(true, false);
        };

        if (conn.open) {
          onOpen();
        } else {
          conn.on('open', onOpen);
        }

        conn.on('data', (data) => {
          let message = data;
          if (typeof data === 'string') {
            try { message = JSON.parse(data); } catch (e) {}
          }
          handleRemoteCommand(message);
        });

        conn.on('close', () => {
          console.log('[AnimeGO Remote] P2P WebRTC соединение закрыто');
          if (activePeerConn === conn) activePeerConn = null;
        });

        conn.on('error', (err) => {
          console.warn('[AnimeGO Remote] P2P ошибка:', err);
          if (activePeerConn === conn) activePeerConn = null;
        });
      });

      activePeer.on('disconnected', () => {
        console.log('[AnimeGO Remote] P2P узел временно отключен от сигнального сервера, переподключение...');
        try { activePeer.reconnect(); } catch (e) {}
      });

      activePeer.on('error', (err) => {
        console.warn('[AnimeGO Remote] PeerJS событие ошибки:', err);
        if (err && err.type === 'unavailable-id') {
          console.warn(`[AnimeGO Remote] ID "${currentRoomId}" уже занят. Генерируем новый свободный ID...`);
          currentRoomId = generateRoomId();
          try {
            sessionStorage.setItem('animego_remote_room_id', currentRoomId);
            localStorage.setItem('animego_remote_room_id', currentRoomId);
            if (chrome?.storage?.local) chrome.storage.local.set({ animego_p2p_room: currentRoomId });
          } catch (e) {}

          const badge = document.getElementById('animego-room-display');
          if (badge) badge.textContent = currentRoomId;
          const qrImg = document.querySelector('.animego-qr-img');
          if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(getFullRemoteUrl())}`;
          }

          setTimeout(() => initPeerJS(currentRoomId), 300);
        }
      });

      if (!window.__animegoPeerWatchdog) {
        window.__animegoPeerWatchdog = setInterval(() => {
          if (activePeer && activePeer.disconnected && !activePeer.destroyed) {
            try { activePeer.reconnect(); } catch (e) {}
          }
        }, 5000);
      }

      window.addEventListener('beforeunload', () => {
        if (activePeer) {
          try { activePeer.destroy(); } catch (e) {}
        }
      });
    } catch (err) {
      console.error('[AnimeGO Remote] Ошибка старта PeerJS:', err);
    }
  }

  /**
   * Создание плавающей кнопки «📱 Пульт» и модального окна с QR-кодом
   */
  function initRemoteUI() {
    if (document.getElementById('animego-remote-trigger-btn')) return;

    // Плавающая кнопка
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'animego-remote-trigger-btn';
    triggerBtn.innerHTML = `
      <span class="remote-dot"></span>
      <span>📱 Пульт</span>
    `;
    document.body.appendChild(triggerBtn);

    // Модальное окно
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'animego-remote-modal-overlay';

    function updateModalContent() {
      const fullUrl = getFullRemoteUrl();
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(fullUrl)}`;

      modalOverlay.innerHTML = `
        <div class="animego-modal-card" id="animego-modal-card">
          <div class="animego-modal-header">
            <div class="animego-modal-title">
              <span>📱</span> Пульт с телефона
            </div>
            <button class="animego-modal-close" id="animego-modal-close-btn">&times;</button>
          </div>

          <div class="animego-qr-wrap">
            <img class="animego-qr-img" src="${qrApiUrl}" alt="QR код для пульта" />
          </div>

          <div class="animego-room-info">
            Отсканируйте камерой телефона или введите код:<br>
            Комната: <span class="animego-room-code-badge" id="animego-room-display">${currentRoomId}</span>
            <button id="animego-new-room-btn" title="Сгенерировать новую комнату при сбое" style="background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 6px;">🔄</button>
          </div>

          <div class="animego-btn-group">
            <button class="animego-action-btn primary" id="animego-copy-link-btn">📋 Скопировать ссылку</button>
            <button class="animego-action-btn" id="animego-copy-code-btn">🔑 Скопировать код</button>
          </div>

          <div style="margin-top: 10px;">
            <button class="animego-action-btn" id="animego-switch-mirror-btn" style="width: 100%; background: rgba(255, 122, 0, 0.15); border-color: rgba(255, 122, 0, 0.4); color: #ffb74d; font-size: 12px; padding: 8px 12px;">
              🌐 Перейти на ${window.location.hostname.includes('animego.co') ? 'animego.me' : 'зеркало animego.co (для РФ)'}
            </button>
          </div>

          <div class="animego-url-config">
            <div class="animego-url-label">URL страницы пульта (GitHub / Netlify):</div>
            <div class="animego-url-input-row" style="margin-top: 4px;">
              <input type="text" class="animego-url-input" id="animego-base-url-input" value="${getRemoteBaseUrl()}" placeholder="https://.../remote.html" style="width: 100%; box-sizing: border-box;">
            </div>
          </div>
        </div>
      `;

      // Привязка обработчиков внутри модалки
      const switchMirrorBtn = modalOverlay.querySelector('#animego-switch-mirror-btn');
      switchMirrorBtn?.addEventListener('click', () => {
        const curHost = window.location.hostname;
        const targetHost = curHost.includes('animego.co') ? 'animego.me' : 'animego.co';
        switchMirrorWithSearch(targetHost);
      });
      const closeBtn = modalOverlay.querySelector('#animego-modal-close-btn');
      closeBtn?.addEventListener('click', () => {
        modalOverlay.classList.remove('visible');
      });

      const copyLinkBtn = modalOverlay.querySelector('#animego-copy-link-btn');
      copyLinkBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullUrl).then(() => {
          copyLinkBtn.textContent = '✅ Ссылка скопирована!';
          setTimeout(() => { copyLinkBtn.textContent = '📋 Скопировать ссылку'; }, 2000);
        }).catch(() => {
          showToast('Не удалось скопировать', 'warning');
        });
      });

      const newRoomBtn = modalOverlay.querySelector('#animego-new-room-btn');
      newRoomBtn?.addEventListener('click', () => {
        currentRoomId = generateRoomId();
        try {
          sessionStorage.setItem('animego_remote_room_id', currentRoomId);
          localStorage.setItem('animego_remote_room_id', currentRoomId);
          if (chrome?.storage?.local) chrome.storage.local.set({ animego_p2p_room: currentRoomId });
        } catch (e) {}
        updateModalContent();
        initPeerJS(currentRoomId);
        showToast('Создана новая комната: ' + currentRoomId, 'success');
      });

      const copyCodeBtn = modalOverlay.querySelector('#animego-copy-code-btn');
      copyCodeBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomId).then(() => {
          copyCodeBtn.textContent = '✅ Код скопирован!';
          setTimeout(() => { copyCodeBtn.textContent = '🔑 Скопировать код'; }, 2000);
        });
      });

      const urlInput = modalOverlay.querySelector('#animego-base-url-input');
      const saveUrl = () => {
        const val = urlInput.value.trim();
        if (val) {
          setRemoteBaseUrl(val);
          updateModalContent();
          showToast('URL пульта обновлен', 'success');
        }
      };
      urlInput?.addEventListener('change', saveUrl);
      urlInput?.addEventListener('blur', saveUrl);
    }

    updateModalContent();
    document.body.appendChild(modalOverlay);

    // Открытие модалки
    triggerBtn.addEventListener('click', () => {
      updateModalContent();
      modalOverlay.classList.add('visible');
    });

    // Закрытие при клике по затемнению вокруг карточки
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('visible');
      }
    });
  }

  // Запуск прямого P2P узла (WebRTC)
  initPeerJS(currentRoomId);

  // Быстрая синхронизация после загрузки страницы (если P2P активен)
  setTimeout(() => sendCurrentInfoToRemote(true), 350);
  setTimeout(() => sendCurrentInfoToRemote(true), 1200);
  setTimeout(() => sendCurrentInfoToRemote(true), 2500);

  // Наблюдатель за динамическим появлением .serial-translations-box на animego.co
  if (window.location.hostname.includes('animego.co')) {
    let coObserverTimeout = null;
    const coObserver = new MutationObserver(() => {
      if (document.querySelector('.serial-translations-box select, select option[data-media-id], .serial-translations-box .item[data-link]')) {
        if (!coObserverTimeout) {
          coObserverTimeout = setTimeout(() => {
            console.log('[AnimeGO Remote] Обнаружен блок озвучек на animego.co, отправка на пульт...');
            sendCurrentInfoToRemote(true);
            coObserverTimeout = null;
          }, 200);
        }
      }
    });
    coObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

    document.addEventListener('change', (e) => {
      if (e.target && (e.target.closest?.('.serial-translations-box') || e.target.matches?.('.serial-translations-box select'))) {
        setTimeout(() => sendCurrentInfoToRemote(true), 250);
      }
    });
  }

  // Слушаем событие обновления меню плеера от Stimulus AnimeGO
  document.addEventListener('anime-player:menu-updated', () => {
    sendCurrentInfoToRemote(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRemoteUI);
  } else {
    initRemoteUI();
  }

  // Прием сообщений от iframe плеера (включая player.js)
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'ANIMEGO_EXIT_FULLSCREEN') {
      exitFullscreenMode();
      return;
    }


    if (event.data.type === 'ANIMEGO_FRAME_READY') {
      console.log('[AnimeGO Next Episode] Фрейм плеера готов к воспроизведению.');
      if (lastWasFullscreen) {
        applyFullscreenMode();
      }
      sendAutoplayTrigger(event.source);
      return;
    }

    if (event.data.type === 'ANIMEGO_PLAYING') {
      if (lastWasFullscreen) {
        ensurePlayerFullscreenStyle();
        try {
          chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
        } catch (e) {}
      }
      return;
    }

    if (event.data.type === 'ANIMEGO_EPISODE_ENDED') {
      const isTopFs = Boolean(isFullscreen() || isCssFullscreenActive || lastWasFullscreen);
      const wasFullscreen = Boolean(event.data.wasFullscreen || isTopFs);

      console.log(`[AnimeGO Next Episode] Получен сигнал окончания серии. Полный экран: ${wasFullscreen}`);
      switchToNextEpisode(wasFullscreen);
      return;
    }

    if (event.data.type === 'ANIMEGO_KODIK_STATE') {
      console.log('[AnimeGO Next Episode] Получено состояние Kodik из фрейма:', event.data);
      latestKodikState = {
        translations: Array.isArray(event.data.translations) ? event.data.translations : (latestKodikState?.translations || []),
        episodes: Array.isArray(event.data.episodes) ? event.data.episodes : (latestKodikState?.episodes || []),
        currentEpisode: event.data.currentEpisode || latestKodikState?.currentEpisode || 1,
        timestamp: Date.now()
      };
      sendCurrentInfoToRemote(true);
      return;
    }
  });
})();

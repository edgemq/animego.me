// content.js
// Запускается на страницах animego.me / animego.org в основном окне
(function () {
  'use strict';

  if (window !== window.top) return;

  console.log('[AnimeGO Next Episode] Скрипт инициализирован.');

  let lastSwitchTime = 0;
  const SWITCH_COOLDOWN_MS = 3000;
  let isCssFullscreenActive = false;
  let lastWasFullscreen = false;

  // Идентификатор комнаты для удаленного пульта
  const currentRoomId = getOrCreateRoomId();

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
    return `${base}${separator}room=${encodeURIComponent(currentRoomId)}`;
  }

  function getOrCreateRoomId() {
    let id = sessionStorage.getItem('animego_remote_room_id');
    if (!id) {
      id = 'ago_' + Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 6);
      sessionStorage.setItem('animego_remote_room_id', id);
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
      z-index: 2147483647 !important;
      background: #000 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .animego-ext-fullscreen iframe {
      width: 100% !important;
      height: 100% !important;
      border: 0 !important;
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
   * Контейнер плеера на странице AnimeGO
   */
  function getPlayerContainer() {
    return (
      document.querySelector('[data-anime-player-target="iframeContainer"]') ||
      document.querySelector('.player-video__online') ||
      document.querySelector('.player-video')
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

  /**
   * Растягивание контейнера и фрейма плеера на 100vw x 100vh
   */
  function ensurePlayerFullscreenStyle() {
    if (!lastWasFullscreen && !isCssFullscreenActive) return;

    const container = getPlayerContainer();
    if (container && !container.classList.contains('animego-ext-fullscreen')) {
      container.classList.add('animego-ext-fullscreen');
      document.body.style.overflow = 'hidden';
      isCssFullscreenActive = true;
    }

    const iframes = document.querySelectorAll(
      '.animego-ext-fullscreen iframe, [data-anime-player-target="iframeContainer"] iframe, .player-video iframe'
    );
    iframes.forEach((f) => {
      f.style.setProperty('width', '100%', 'important');
      f.style.setProperty('height', '100%', 'important');
      f.style.setProperty('border', '0', 'important');
    });
  }

  /**
   * Перевод всей страницы в полноэкранный режим без рамок браузера (F11 + CSS)
   */
  async function applyFullscreenMode() {
    lastWasFullscreen = true;
    isCssFullscreenActive = true;

    ensurePlayerFullscreenStyle();

    // 1. Команда в background.js для перевода окна браузера в F11 Fullscreen (Chrome API)
    try {
      chrome.runtime.sendMessage({ action: 'SET_FULLSCREEN', fullscreen: true });
    } catch (e) {}

    // 2. Попытка перевести documentElement в HTML5 Fullscreen (если разрешено браузером)
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      }
    } catch (e) {}
  }

  /**
   * Выход из полноэкранного режима
   */
  function exitFullscreenMode() {
    const container = getPlayerContainer();
    if (container) {
      container.classList.remove('animego-ext-fullscreen');
    }
    document.querySelectorAll('.animego-ext-fullscreen').forEach((el) => {
      el.classList.remove('animego-ext-fullscreen');
    });
    document.body.style.overflow = '';
    isCssFullscreenActive = false;
    lastWasFullscreen = false;

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
    // Не сбрасываем в момент переключения серии (кулдаун 4 сек)
    if (Date.now() - lastSwitchTime < 4000) return;

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
   * Обработка команд, пришедших с мобильного пульта через ntfy.sh
   */
  function handleRemoteCommand(rawMessage) {
    let command = rawMessage;
    let extra = {};

    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed && typeof parsed === 'object') {
        command = parsed.command || parsed.action || parsed.type;
        extra = parsed;
      }
    } catch (e) {}

    if (!command) return;
    console.log('[AnimeGO Remote] Получена команда:', command, extra);

    const isFsNow = isFullscreen() || isCssFullscreenActive || lastWasFullscreen;

    switch (command) {
      case 'NEXT_EPISODE':
        showToast('📱 Пульт: Следующая серия', 'info');
        switchToNextEpisode(isFsNow);
        break;

      case 'PREV_EPISODE':
        showToast('📱 Пульт: Предыдущая серия', 'info');
        switchToPrevEpisode(isFsNow);
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
        showToast('📱 Пульт: Пауза / Воспроизведение', 'info');
        broadcastToFrames({ type: 'ANIMEGO_REMOTE_COMMAND', command: 'TOGGLE_PLAY' });
        break;

      case 'PLAY':
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

  /**
   * Подключение к pub/sub топику ntfy.sh через Server-Sent Events (SSE)
   */
  function initRemoteSSE(roomId) {
    const sseUrl = `https://ntfy.sh/${encodeURIComponent(roomId)}/sse`;
    console.log(`[AnimeGO Remote] Подключение к ntfy.sh (комната: ${roomId})...`);

    try {
      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        console.log('[AnimeGO Remote] SSE соединение установлено.');
      };

      eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message' && data.message) {
            handleRemoteCommand(data.message);
          }
        } catch (err) {
          handleRemoteCommand(event.data);
        }
      };

      eventSource.onerror = (err) => {
        // EventSource браузера автоматически восстанавливает соединение при разрывах
        console.warn('[AnimeGO Remote] SSE соединение прервано, ожидание переподключения...');
      };
    } catch (e) {
      console.error('[AnimeGO Remote] Ошибка инициализации EventSource:', e);
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
            Комната: <span class="animego-room-code-badge">${currentRoomId}</span>
          </div>

          <div class="animego-btn-group">
            <button class="animego-action-btn primary" id="animego-copy-link-btn">📋 Скопировать ссылку</button>
            <button class="animego-action-btn" id="animego-copy-code-btn">🔑 Скопировать код</button>
          </div>

          <div class="animego-url-config">
            <div class="animego-url-label">URL страницы пульта (GitHub / Netlify):</div>
            <div class="animego-url-input-row">
              <input type="text" class="animego-url-input" id="animego-base-url-input" value="${getRemoteBaseUrl()}" placeholder="https://.../remote.html">
              <button class="animego-action-btn" id="animego-save-url-btn" style="padding: 6px 12px;">💾</button>
            </div>
          </div>
        </div>
      `;

      // Привязка обработчиков внутри модалки
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

      const copyCodeBtn = modalOverlay.querySelector('#animego-copy-code-btn');
      copyCodeBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomId).then(() => {
          copyCodeBtn.textContent = '✅ Код скопирован!';
          setTimeout(() => { copyCodeBtn.textContent = '🔑 Скопировать код'; }, 2000);
        });
      });

      const saveUrlBtn = modalOverlay.querySelector('#animego-save-url-btn');
      const urlInput = modalOverlay.querySelector('#animego-base-url-input');
      saveUrlBtn?.addEventListener('click', () => {
        const val = urlInput.value.trim();
        if (val) {
          setRemoteBaseUrl(val);
          updateModalContent();
          showToast('URL пульта обновлен', 'success');
        }
      });
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

  // Запуск интерфейса пульта и SSE подписчика
  initRemoteSSE(currentRoomId);

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
    }
  });
})();

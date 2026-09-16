// player.js
// Скрипт внедряется во все фреймы (включая Shaka Player / Aniboom)
(function () {
  'use strict';

  let hasClickedPlay = false;
  let hasReportedEnded = false;
  let autoplayTimer = null;
  let autoplayAttempts = 0;

  /**
   * Проверка полноэкранного режима с учетом масштабирования Windows (DPI)
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
   * Проверка, является ли элемент рекламой
   */
  function isAdElement(el) {
    if (!el) return true;
    return Boolean(
      el.closest(
        '.yandex-ad-slot, .vx-ad-layer, .shaka-client-side-ad-container, .shaka-server-side-ad-container, .vx-ad-play-overlay, [class*="ad-slot"], [class*="ad-layer"]'
      )
    );
  }

  /**
   * Эмуляция клика
   */
  function simulateClick(element) {
    if (!element) return;
    try {
      element.focus?.();
      const eventOptions = { bubbles: true, cancelable: true, view: window };
      element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
      element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
      element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      element.click?.();
      element.dispatchEvent(new MouseEvent('click', eventOptions));
    } catch (e) {
      try {
        element.click?.();
      } catch (err) {}
    }
  }

  /**
   * Запуск воспроизведения
   */
  function tryStartPlayback() {
    if (hasClickedPlay) return true;

    // Ищем кнопку запуска Aniboom / Shaka Player
    const startBtn =
      document.querySelector('.player-start-button') ||
      document.querySelector('.player-start-overlay button') ||
      document.querySelector('.player-start-overlay') ||
      document.querySelector('button.shaka-play-button') ||
      document.querySelector('button[aria-label="Воспроизвести"]') ||
      document.querySelector('.vjs-big-play-button, .play-btn, .kodik-play, #play');

    if (startBtn) {
      hasClickedPlay = true;
      console.log('[AnimeGO Next Episode] Стартовая кнопка найдена. Однократный клик...');
      simulateClick(startBtn);
      return true;
    }

    const video = Array.from(document.querySelectorAll('video')).find((v) => !isAdElement(v));
    if (video) {
      if (!video.paused && video.currentTime > 0) {
        hasClickedPlay = true;
        return true;
      }
      video.play().then(() => {
        hasClickedPlay = true;
      }).catch(() => {});
    }

    return false;
  }

  /**
   * Процедура ожидания появления кнопки старта
   */
  function startAutoplaySequence() {
    if (hasClickedPlay) return;

    if (tryStartPlayback()) return;

    if (autoplayTimer) clearInterval(autoplayTimer);

    autoplayAttempts = 0;
    autoplayTimer = setInterval(() => {
      autoplayAttempts++;

      if (hasClickedPlay || autoplayAttempts > 25) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
        return;
      }

      tryStartPlayback();
    }, 250);
  }

  /**
   * Отслеживание видео и завершения серии
   */
  function trackVideo(video) {
    if (!video || isAdElement(video) || video.__animego_tracked) return;
    video.__animego_tracked = true;

    console.log('[AnimeGO Next Episode] Подключено видео:', video.id || 'video');

    const markPlaying = () => {
      hasClickedPlay = true;
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
      try {
        window.top.postMessage({ type: 'ANIMEGO_PLAYING' }, '*');
      } catch (e) {}
    };

    video.addEventListener('play', markPlaying);
    video.addEventListener('playing', markPlaying);

    function checkEnded(eventSource) {
      if (hasReportedEnded) return;

      // Проверяем, что видео имеет валидную длительность (> 30 сек)
      if (!video.duration || video.duration < 30 || !Number.isFinite(video.duration)) {
        return;
      }

      // Проверяем, что текущая позиция действительно в конце видео (до конца <= 1.5 сек)
      const isAtEnd = eventSource === 'ended' || (video.currentTime >= video.duration - 1.5 && video.currentTime > 5);

      if (isAtEnd) {
        hasReportedEnded = true;
        const wasFs = isFullscreen();
        console.log(`[AnimeGO Next Episode] Серия завершена (${eventSource}). Позиция: ${video.currentTime}/${video.duration}. Полный экран: ${wasFs}`);

        try {
          window.top.postMessage(
            {
              type: 'ANIMEGO_EPISODE_ENDED',
              wasFullscreen: wasFs,
              timestamp: Date.now()
            },
            '*'
          );
        } catch (e) {
          console.error('[AnimeGO Next Episode] Ошибка отправки postMessage:', e);
        }
      }
    }

    video.addEventListener('ended', () => checkEnded('ended'));

    video.addEventListener('timeupdate', () => {
      if (!hasReportedEnded && video.duration && video.duration > 30) {
        if (video.currentTime >= video.duration - 1.5 && video.currentTime > 5) {
          checkEnded('timeupdate');
        }
      }
    });

    // Сброс флага при перемотке назад от конца
    video.addEventListener('seeking', () => {
      if (video.duration && video.currentTime < video.duration - 5) {
        hasReportedEnded = false;
      }
    });
  }

  function scanForVideos() {
    document.querySelectorAll('video').forEach((v) => {
      if (!isAdElement(v)) trackVideo(v);
    });
  }

  function getActiveVideo() {
    return Array.from(document.querySelectorAll('video')).find((v) => !isAdElement(v));
  }

  // Прием сигналов от родительского окна AnimeGO
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'ANIMEGO_AUTOPLAY_TRIGGER') {
      console.log('[AnimeGO Next Episode] Получен сигнал ANIMEGO_AUTOPLAY_TRIGGER.');
      hasClickedPlay = false;
      hasReportedEnded = false;
      startAutoplaySequence();
      return;
    }

    if (event.data.type === 'ANIMEGO_REMOTE_COMMAND') {
      const cmd = event.data.command;
      console.log('[AnimeGO Player] Получена команда с пульта:', cmd);
      const video = getActiveVideo();

      switch (cmd) {
        case 'TOGGLE_PLAY': {
          if (!video || (video.paused && video.currentTime === 0 && !hasClickedPlay)) {
            tryStartPlayback();
          } else if (video.paused) {
            video.play().catch(() => tryStartPlayback());
          } else {
            video.pause();
          }
          break;
        }
        case 'PLAY': {
          if (video) {
            video.play().catch(() => tryStartPlayback());
          } else {
            tryStartPlayback();
          }
          break;
        }
        case 'PAUSE': {
          if (video) video.pause();
          break;
        }
        case 'SEEK_BACK': {
          const delta = Number(event.data.seconds) || 10;
          if (video) {
            video.currentTime = Math.max(0, video.currentTime - delta);
          }
          break;
        }
        case 'SEEK_FORWARD': {
          const delta = Number(event.data.seconds) || 10;
          if (video) {
            const maxDuration = video.duration || 999999;
            video.currentTime = Math.min(maxDuration, video.currentTime + delta);
          }
          break;
        }
        case 'VOLUME_UP': {
          if (video) {
            video.volume = Math.min(1, Math.round((video.volume + 0.1) * 10) / 10);
            video.muted = false;
          }
          break;
        }
        case 'VOLUME_DOWN': {
          if (video) {
            video.volume = Math.max(0, Math.round((video.volume - 0.1) * 10) / 10);
          }
          break;
        }
        case 'TOGGLE_MUTE': {
          if (video) {
            video.muted = !video.muted;
          }
          break;
        }
        default:
          break;
      }
    }
  });

  // Обработка клавиши Escape внутри фрейма
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      try {
        window.top.postMessage({ type: 'ANIMEGO_EXIT_FULLSCREEN' }, '*');
      } catch (err) {}
    }
  });

  // Сообщаем родительскому окну, что фрейм готов
  try {
    window.top.postMessage({ type: 'ANIMEGO_FRAME_READY' }, '*');
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanForVideos();
      startAutoplaySequence();
    });
  } else {
    scanForVideos();
    startAutoplaySequence();
  }

  // Наблюдатель за появлением видео и кнопок
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'VIDEO') {
            if (!isAdElement(node)) trackVideo(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('video').forEach((v) => {
              if (!isAdElement(v)) trackVideo(v);
            });

            if (!hasClickedPlay) {
              const startBtn = node.querySelector?.('.player-start-button, .player-start-overlay, button.shaka-play-button');
              if (startBtn) {
                tryStartPlayback();
              }
            }
          }
        }
      }
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();


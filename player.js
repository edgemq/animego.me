// player.js
// Скрипт внедряется во все фреймы (включая Shaka Player / Aniboom)
(function () {
  'use strict';

  // Работаем если фрейм запущен на animego (animego.me, animego.org, animego.co)
  function isAllowedHost(str) {
    if (!str) return false;
    return str.includes('animego.me') || str.includes('animego.org') || str.includes('animego.co') || str.includes('animego');
  }

  let isAllowed = false;
  try {
    if (isAllowedHost(window.top.location.hostname)) {
      isAllowed = true;
    }
  } catch (e) {
    const ref = document.referrer || '';
    if (isAllowedHost(ref)) {
      isAllowed = true;
    } else {
      const host = window.location.hostname;
      if (host.includes('kodik') || host.includes('aniboom') || host.includes('sibnet')) {
        isAllowed = true;
      }
    }
  }
  if (!isAllowed) return;

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
   * Поиск кнопки полноэкранного режима в плеере (Shaka Player / Aniboom / Kodik / VideoJS)
   */
  function getFullscreenButton() {
    return document.querySelector(
      'button.shaka-fullscreen-button, .vjs-fullscreen-control, button[aria-label*="полноэкран" i], button[aria-label*="fullscreen" i], button[aria-label*="Полноэкранный" i], [title*="полный экран" i], [title*="fullscreen" i], [title*="Полноэкранный" i], .jw-icon-fullscreen, .fullscreen-btn, .btn-fullscreen'
    );
  }

  /**
   * Вход в полноэкранный режим внутри плеера
   */
  function enterPlayerFullscreen() {
    if (isFullscreen()) return;

    // Вызываем нативный fullscreen только если есть локальный жест пользователя на ПК
    if (navigator.userActivation?.isActive) {
      const fsBtn = getFullscreenButton();
      if (fsBtn) {
        console.log('[AnimeGO Player] Нажатие нативной кнопки полноэкранного режима:', fsBtn);
        simulateClick(fsBtn);
        return;
      }

      const video = getActiveVideo();
      const container =
        document.querySelector('.shaka-video-container') ||
        document.querySelector('.video-js') ||
        video?.parentElement ||
        video;

      if (container && container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      }
    }
  }

  /**
   * Выход из полноэкранного режима внутри плеера
   */
  function exitPlayerFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      }
    } catch (e) {}

    const fsBtn = getFullscreenButton();
    if (fsBtn && (fsBtn.classList.contains('active') || fsBtn.getAttribute('aria-pressed') === 'true')) {
      simulateClick(fsBtn);
    }
  }

  /**
   * Переключение полноэкранного режима внутри плеера
   */
  function togglePlayerFullscreen() {
    if (isFullscreen()) {
      exitPlayerFullscreen();
      try {
        window.top.postMessage({ type: 'ANIMEGO_EXIT_FULLSCREEN' }, '*');
      } catch (e) {}
    } else {
      enterPlayerFullscreen();
    }
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

    // Ищем кнопку запуска Aniboom / Shaka Player / Kodik
    const startBtn =
      document.querySelector('.player-start-button') ||
      document.querySelector('.player-start-overlay button') ||
      document.querySelector('.player-start-overlay') ||
      document.querySelector('button.shaka-play-button') ||
      document.querySelector('button[aria-label="Воспроизвести"]') ||
      document.querySelector('button[aria-label="Play"]') ||
      document.querySelector('.vjs-big-play-button, .play-btn, .kodik-play, #play, .play_button, .play_btn, .play-button') ||
      document.querySelector('.kodik-player-play, .btn-play, [data-action="play"]');

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
        case 'TOGGLE_FULLSCREEN': {
          togglePlayerFullscreen();
          break;
        }
        case 'ENTER_FULLSCREEN': {
          enterPlayerFullscreen();
          break;
        }
        case 'EXIT_FULLSCREEN': {
          exitPlayerFullscreen();
          break;
        }
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
        case 'REQUEST_KODIK_STATE': {
          notifyParentAboutKodik();
          break;
        }
        case 'CHOOSE_TRANSLATION': {
          const rawId = String(event.data.id || '').trim();
          const cleanId = rawId.toLowerCase();
          const cleanTitle = String(event.data.title || '').toLowerCase().trim();
          console.log('[AnimeGO Player] Kodik: смена озвучки на:', rawId, cleanTitle);

          // 1. Поиск в кастомном dropdown
          let item = document.querySelector(
            `.serial-translations-box .dropdown-content .item[data-link="${rawId}"], .serial-translations-box .dropdown-content .item[data-link="${cleanId}"]`
          );

          if (!item && cleanTitle) {
            const allItems = document.querySelectorAll('.serial-translations-box .dropdown-content .item');
            for (const it of allItems) {
              const text = it.textContent.toLowerCase();
              if (text.includes(cleanTitle) || cleanTitle.includes(text.replace(/\(.*?\)/g, '').trim())) {
                item = it;
                break;
              }
            }
          }

          if (item) {
            simulateClick(item);
            const inner = item.querySelector('.inner-item, span');
            if (inner) simulateClick(inner);
          } else {
            // Если выпадающий список скрыт, пробуем открыть кнопку
            const btn = document.querySelector('.serial-translations-box .select-button');
            if (btn) simulateClick(btn);
          }

          // 2. Поиск и обновление скрытого <select>
          const select = document.querySelector('.serial-translations-box select');
          if (select) {
            let matchedOpt = select.querySelector(`option[value="${rawId}"], option[data-id="${rawId}"]`);
            if (!matchedOpt && cleanTitle) {
              matchedOpt = Array.from(select.options).find(o => {
                const t = (o.getAttribute('data-title') || o.textContent).toLowerCase();
                return t.includes(cleanTitle) || cleanTitle.includes(t.split('(')[0].trim());
              });
            }
            if (matchedOpt) {
              select.value = matchedOpt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              try {
                if (window.$) window.$(select).val(matchedOpt.value).trigger('change');
                if (window.jQuery) window.jQuery(select).val(matchedOpt.value).trigger('change');
              } catch (e) {}
            }
          }

          setTimeout(notifyParentAboutKodik, 500);
          setTimeout(notifyParentAboutKodik, 1500);
          break;
        }
        case 'CHOOSE_EPISODE': {
          const epNum = parseInt(event.data.episode, 10);
          if (isNaN(epNum)) break;
          console.log('[AnimeGO Player] Kodik: смена серии на:', epNum);

          let item = document.querySelector(
            `.serial-series-box .dropdown-content .item[data-link="${epNum}"]`
          );

          if (!item) {
            const allItems = document.querySelectorAll('.serial-series-box .dropdown-content .item');
            for (const it of allItems) {
              const text = it.textContent.trim();
              if (text.includes(`${epNum} серия`) || text === String(epNum)) {
                item = it;
                break;
              }
            }
          }

          if (item) {
            simulateClick(item);
            const inner = item.querySelector('.inner-item, span');
            if (inner) simulateClick(inner);
          }

          const select = document.querySelector('.serial-series-box select');
          if (select) {
            const opt = select.querySelector(`option[value="${epNum}"], option[data-title*="${epNum} серия"]`) ||
                        Array.from(select.options).find(o => o.value == epNum || o.text.includes(`${epNum} серия`));
            if (opt) {
              select.value = opt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              try {
                if (window.$) window.$(select).val(opt.value).trigger('change');
                if (window.jQuery) window.jQuery(select).val(opt.value).trigger('change');
              } catch (e) {}
            }
          }

          setTimeout(notifyParentAboutKodik, 500);
          setTimeout(notifyParentAboutKodik, 1500);
          break;
        }
        case 'NEXT_EPISODE': {
          const nextBtn = document.querySelector(
            '.serial-next, .serial-next-box, button.serial-next, [class*="serial-next"], [title*="Дальше" i]'
          ) || Array.from(document.querySelectorAll('button, div, a')).find(el => el.textContent.trim().startsWith('Дальше'));

          if (nextBtn) {
            console.log('[AnimeGO Player] Kodik: клик кнопки Дальше');
            simulateClick(nextBtn);
          } else {
            // Фолбэк: вычисляем следующую серию
            const seriesSelect = document.querySelector('.serial-series-box select');
            const curVal = seriesSelect ? parseInt(seriesSelect.value, 10) : 1;
            const nextVal = curVal + 1;
            const nextItem = document.querySelector(`.serial-series-box .dropdown-content .item[data-link="${nextVal}"]`);
            if (nextItem) simulateClick(nextItem);
            if (seriesSelect) {
              seriesSelect.value = String(nextVal);
              seriesSelect.dispatchEvent(new Event('change', { bubbles: true }));
              try {
                if (window.$) window.$(seriesSelect).val(String(nextVal)).trigger('change');
                if (window.jQuery) window.jQuery(seriesSelect).val(String(nextVal)).trigger('change');
              } catch (e) {}
            }
          }
          setTimeout(notifyParentAboutKodik, 500);
          setTimeout(notifyParentAboutKodik, 1500);
          break;
        }
        case 'PREV_EPISODE': {
          const seriesSelect = document.querySelector('.serial-series-box select');
          const curVal = seriesSelect ? parseInt(seriesSelect.value, 10) : 1;
          const prevVal = Math.max(1, curVal - 1);
          const prevItem = document.querySelector(`.serial-series-box .dropdown-content .item[data-link="${prevVal}"]`);
          if (prevItem) simulateClick(prevItem);
          if (seriesSelect) {
            seriesSelect.value = String(prevVal);
            seriesSelect.dispatchEvent(new Event('change', { bubbles: true }));
            try {
              if (window.$) window.$(seriesSelect).val(String(prevVal)).trigger('change');
              if (window.jQuery) window.jQuery(seriesSelect).val(String(prevVal)).trigger('change');
            } catch (e) {}
          }
          setTimeout(notifyParentAboutKodik, 500);
          setTimeout(notifyParentAboutKodik, 1500);
          break;
        }
        case 'CHOOSE_QUALITY': {
          const targetQ = String(event.data.quality || '').toLowerCase().replace('p', '');
          console.log('[AnimeGO Player] Запрос качества:', targetQ);

          const qualityOptions = document.querySelectorAll(
            '.quality-box .item, .quality-box [data-quality], .shaka-resolutions button, .vjs-menu-item, [data-quality], .quality-picker button, button[aria-label*="качество" i], button[aria-label*="quality" i]'
          );

          let matched = false;
          for (const opt of qualityOptions) {
            const text = (opt.textContent || opt.getAttribute('data-quality') || '').toLowerCase();
            if (targetQ && text.includes(targetQ)) {
              simulateClick(opt);
              matched = true;
              break;
            }
          }

          if (!matched) {
            const select = document.querySelector('.quality-box select, select.quality-select, select[name="quality"]');
            if (select) {
              for (const option of select.options) {
                if (targetQ && option.text.includes(targetQ)) {
                  select.value = option.value;
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  break;
                }
              }
            }
          }
          break;
        }
        default:
          break;
      }
    }
  });

  /**
   * Сбор информации из Kodik плеера (озвучки и серии) и передача на верхний уровень
   */
  function notifyParentAboutKodik() {
    try {
      // 1. Озвучки из .serial-translations-box
      const translations = [];
      const transSelect = document.querySelector('.serial-translations-box select');
      if (transSelect) {
        Array.from(transSelect.options).forEach((opt) => {
          const id = opt.getAttribute('data-id') || opt.value;
          const title = opt.getAttribute('data-title') || opt.textContent.split('(')[0].trim();
          const epCount = opt.getAttribute('data-episode-count');
          const isSelected = opt.selected || opt.hasAttribute('selected');
          const name = epCount ? `${title} (${epCount} эп.)` : opt.textContent.trim();
          if (id && title && !translations.some(t => t.id === id)) {
            translations.push({ id, name, active: isSelected });
          }
        });
      }
      if (translations.length === 0) {
        document.querySelectorAll('.serial-translations-box .dropdown-content .item').forEach((it) => {
          const id = it.getAttribute('data-link');
          const title = it.querySelector('.inner-item span:first-child')?.textContent?.trim() || it.textContent.trim();
          const ep = it.querySelector('.subtitle-icon')?.textContent?.trim();
          const isSelected = it.classList.contains('selected');
          const name = ep ? `${title} (${ep})` : title;
          if (id && title && !translations.some(t => t.id === id)) {
            translations.push({ id, name, active: isSelected });
          }
        });
      }

      // 2. Серии из .serial-series-box
      const episodes = [];
      let currentEpisode = 1;
      const seriesSelect = document.querySelector('.serial-series-box select');
      if (seriesSelect) {
        Array.from(seriesSelect.options).forEach((opt) => {
          const val = parseInt(opt.value, 10);
          if (!isNaN(val) && !episodes.includes(val)) {
            episodes.push(val);
          }
          if (opt.selected || opt.hasAttribute('selected')) {
            currentEpisode = val;
          }
        });
      }
      if (episodes.length === 0) {
        document.querySelectorAll('.serial-series-box .dropdown-content .item').forEach((it) => {
          const val = parseInt(it.getAttribute('data-link'), 10);
          if (!isNaN(val) && !episodes.includes(val)) episodes.push(val);
          if (it.classList.contains('selected')) currentEpisode = val;
        });
      }
      episodes.sort((a, b) => a - b);

      if (translations.length > 0 || episodes.length > 0) {
        window.top.postMessage({
          type: 'ANIMEGO_KODIK_STATE',
          translations: translations.length > 0 ? translations : null,
          episodes: episodes.length > 0 ? episodes : null,
          currentEpisode: currentEpisode
        }, '*');
      }
    } catch (e) {}
  }

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

  // Периодический опрос Kodik при загрузке страницы
  [400, 1000, 2200, 4500, 8000].forEach((delay) => {
    setTimeout(notifyParentAboutKodik, delay);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanForVideos();
      startAutoplaySequence();
      notifyParentAboutKodik();
    });
  } else {
    scanForVideos();
    startAutoplaySequence();
    notifyParentAboutKodik();
  }

  // Наблюдатель за появлением видео, кнопок и элементов управления Kodik
  let lastKodikCheck = 0;
  const observer = new MutationObserver((mutations) => {
    let checkKodik = false;
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

            if (node.classList?.contains('serial-translations-box') ||
                node.classList?.contains('serial-series-box') ||
                node.querySelector?.('.serial-translations-box, .serial-series-box')) {
              checkKodik = true;
            }
          }
        }
      }
    }

    const now = Date.now();
    if (checkKodik && now - lastKodikCheck > 800) {
      lastKodikCheck = now;
      setTimeout(notifyParentAboutKodik, 300);
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();


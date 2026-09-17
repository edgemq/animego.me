// background.js
// Надежное управление системным полноэкранным режимом (F11) через Chrome API

let preFullscreenState = 'normal';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.action === 'SET_FULLSCREEN') {
    const shouldBeFullscreen = Boolean(message.fullscreen);
    const targetWinId = sender.tab?.windowId;

    function applyState(winId) {
      if (!winId) return;

      chrome.windows.get(winId, (win) => {
        if (chrome.runtime.lastError || !win) {
          chrome.windows.getLastFocused({ populate: false }, (fallbackWin) => {
            if (fallbackWin && fallbackWin.id) {
              applyState(fallbackWin.id);
            }
          });
          return;
        }

        if (win.state === 'minimized') return;

        if (shouldBeFullscreen) {
          if (win.state !== 'fullscreen') {
            preFullscreenState = win.state || 'normal';
          }
          chrome.windows.update(winId, { state: 'fullscreen', focused: true }, () => {
            if (!chrome.runtime.lastError) {
              console.log(`[AnimeGO Background] Окно ${winId} переведено в: fullscreen`);
            }
          });
        } else {
          const restoreState = preFullscreenState === 'maximized' ? 'maximized' : 'normal';
          chrome.windows.update(winId, { state: restoreState, focused: true }, () => {
            if (!chrome.runtime.lastError) {
              console.log(`[AnimeGO Background] Окно ${winId} восстановлено в: ${restoreState}`);
            }
          });
        }
      });
    }

    function scheduleFullscreenRetries(winId) {
      if (!shouldBeFullscreen) return;
      // Серия проверок и повторов, чтобы компенсировать сброс fullscreen
      // при удалении старого iframe сайтом AnimeGO:
      [300, 600, 1000, 1600, 2400, 3200].forEach((delay) => {
        setTimeout(() => {
          chrome.windows.get(winId, (w) => {
            if (!chrome.runtime.lastError && w && w.state !== 'fullscreen' && w.state !== 'minimized') {
              console.log(`[AnimeGO Background] Повторный перевод окна ${winId} в fullscreen (через ${delay}мс)...`);
              chrome.windows.update(winId, { state: 'fullscreen', focused: true });
            }
          });
        }, delay);
      });
    }

    if (targetWinId) {
      applyState(targetWinId);
      scheduleFullscreenRetries(targetWinId);
    } else {
      chrome.windows.getLastFocused({ populate: false }, (win) => {
        if (win && win.id) {
          applyState(win.id);
          scheduleFullscreenRetries(win.id);
        }
      });
    }
  }

  // Ручное переключение зеркала (animego.me <-> animego.co)
  if (message.action === 'SWITCH_MIRROR') {
    const tabId = sender.tab?.id;
    const currentUrl = sender.tab?.url || message.url;
    if (tabId && currentUrl) {
      try {
        const u = new URL(currentUrl);
        const isCo = u.hostname.includes('animego.co');
        const targetHost = isCo ? 'animego.me' : 'animego.co';
        const targetUrl = `${u.protocol}//${targetHost}${u.pathname}${u.search}${u.hash}`;
        chrome.tabs.update(tabId, { url: targetUrl });
      } catch (e) {}
    }
  }

  // Проксирование кросс-доменных запросов (поиск между animego.me и animego.co в обход CORS)
  if (message.action === 'FETCH_URL') {
    fetch(message.url, message.options || {})
      .then(async (res) => {
        const text = await res.text();
        sendResponse({ ok: res.ok, status: res.status, text });
      })
      .catch((err) => {
        console.error('[AnimeGO Background] Ошибка FETCH_URL:', err);
        sendResponse({ ok: false, status: 0, text: '', error: err.message || String(err) });
      });
    return true; // Держим канал связи открытым для асинхронного sendResponse
  }
});

// Автоматическое переключение на зеркало animego.co при блокировке/ошибке animego.me (для РФ)
const recentMirrorRedirects = new Map();

if (chrome.webNavigation && chrome.webNavigation.onErrorOccurred) {
  chrome.webNavigation.onErrorOccurred.addListener((details) => {
    // Реагируем только на основное окно вкладки (frameId === 0)
    if (details.frameId !== 0 || !details.url) return;

    try {
      const u = new URL(details.url);
      const isAnimeGoMe = u.hostname === 'animego.me' || u.hostname.endsWith('.animego.me');

      if (isAnimeGoMe) {
        const lastTime = recentMirrorRedirects.get(details.tabId) || 0;
        if (Date.now() - lastTime < 12000) return; // Защита от частых цикличных перенаправлений
        recentMirrorRedirects.set(details.tabId, Date.now());

        const mirrorUrl = details.url.replace(/animego\.me/i, 'animego.co');
        console.log(`[AnimeGO Mirror] Ошибка загрузки ${details.url} (${details.error}). Автоперенаправление на зеркало: ${mirrorUrl}`);

        chrome.tabs.update(details.tabId, { url: mirrorUrl });
      }
    } catch (e) {}
  });
}



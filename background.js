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
});


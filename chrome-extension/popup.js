const ENDPOINT_KEY = 'playerEndpoint';

const endpointInput = document.querySelector('#endpoint');
const statusElement = document.querySelector('#status');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');

function normalizeEndpoint(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Адреса має починатися з http:// або https://');
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function showState(state) {
  statusElement.className = 'status';

  if (state?.error) {
    statusElement.classList.add('error');
    statusElement.textContent = state.error;
  } else if (state?.active) {
    statusElement.classList.add('active');
    statusElement.textContent = 'Передача активна';
  } else {
    statusElement.textContent = 'Готово';
  }

  startButton.disabled = Boolean(state?.active);
  stopButton.disabled = !state?.active;
}

async function queryState() {
  const response = await chrome.runtime.sendMessage({
    target: 'service-worker',
    type: 'GET_CAPTURE_STATE',
  });
  if (!response?.ok) {
    throw new Error(response?.error || 'Не вдалося отримати стан передачі');
  }
  showState(response.state);
}

async function startCapture() {
  startButton.disabled = true;
  statusElement.className = 'status';
  statusElement.textContent = 'Підключення…';

  try {
    const endpoint = normalizeEndpoint(endpointInput.value);
    await chrome.storage.local.set({ [ENDPOINT_KEY]: endpoint });

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error('Активну вкладку не знайдено');
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });

    const response = await chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'START_CAPTURE',
      endpoint,
      tabId: tab.id,
      streamId,
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Не вдалося запустити передачу');
    }
    await queryState();
  } catch (error) {
    showState({
      active: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function stopCapture() {
  stopButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'STOP_CAPTURE',
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Не вдалося зупинити передачу');
    }
    await queryState();
  } catch (error) {
    showState({
      active: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

startButton.addEventListener('click', () => {
  void startCapture();
});

stopButton.addEventListener('click', () => {
  void stopCapture();
});

const stored = await chrome.storage.local.get(ENDPOINT_KEY);
endpointInput.value = stored[ENDPOINT_KEY] ?? 'http://127.0.0.1:5371';

await queryState().catch((error) => {
  showState({
    active: false,
    error: error instanceof Error ? error.message : String(error),
  });
});

setInterval(() => {
  void queryState().catch(() => undefined);
}, 750);

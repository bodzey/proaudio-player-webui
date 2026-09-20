const OFFSCREEN_PATH = 'offscreen.html';
const STATE_KEY = 'networkAudioCapture';

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  if (existing.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Capture the active tab audio and send it to ProAudio Player.',
  });
}

async function readState() {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return (
    stored[STATE_KEY] ?? {
      active: false,
      endpoint: null,
      tabId: null,
      error: null,
    }
  );
}

async function writeState(state) {
  await chrome.storage.session.set({ [STATE_KEY]: state });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'service-worker') {
    return undefined;
  }

  const run = async () => {
    switch (message.type) {
      case 'START_CAPTURE': {
        await ensureOffscreenDocument();
        await writeState({
          active: false,
          endpoint: message.endpoint,
          tabId: message.tabId,
          error: null,
        });
        await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'START_CAPTURE',
          streamId: message.streamId,
          endpoint: message.endpoint,
          tabId: message.tabId,
        });
        return { ok: true };
      }
      case 'STOP_CAPTURE': {
        await ensureOffscreenDocument();
        await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'STOP_CAPTURE',
        });
        return { ok: true };
      }
      case 'CAPTURE_STATE': {
        await writeState({
          active: Boolean(message.active),
          endpoint: message.endpoint ?? null,
          tabId: message.tabId ?? null,
          error: message.error ?? null,
        });
        return { ok: true };
      }
      case 'GET_CAPTURE_STATE':
        return { ok: true, state: await readState() };
      default:
        return { ok: false, error: 'Unknown message' };
    }
  };

  run()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return true;
});

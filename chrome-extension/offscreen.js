const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const CHUNK_FRAMES = 960;
const CHUNK_SAMPLES = CHUNK_FRAMES * CHANNELS;
const MAX_QUEUED_BYTES = 2 * 1024 * 1024;

let capture = null;

function networkAudioUrl(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Player endpoint must use HTTP or HTTPS.');
  }
  url.pathname = '/api/v1/audio/network';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function reportState({ active, endpoint = null, tabId = null, error = null }) {
  await chrome.runtime.sendMessage({
    target: 'service-worker',
    type: 'CAPTURE_STATE',
    active,
    endpoint,
    tabId,
    error,
  });
}

async function stopCapture(error = null) {
  const current = capture;
  if (!current || current.stopping) {
    if (!current && error) {
      await reportState({ active: false, error });
    }
    return;
  }

  current.stopping = true;
  capture = null;

  current.processor.port.onmessage = null;
  current.stream.getTracks().forEach((track) => track.stop());

  try {
    current.source.disconnect();
    current.processor.disconnect();
    current.silent.disconnect();
  } catch {
    // The graph may already be disconnected after a tab closes.
  }

  if (current.chunkOffset > 0 && !error) {
    const partial = current.chunk.slice(0, current.chunkOffset);
    current.enqueue(partial);
  }

  try {
    await current.writeChain;
    if (error) {
      await current.writer.abort(error);
    } else {
      await current.writer.close();
    }
  } catch {
    // The receiver can close first during navigation or container restart.
  }

  try {
    await current.request;
  } catch (requestError) {
    if (!error) {
      error = requestError instanceof Error ? requestError.message : String(requestError);
    }
  }

  await current.context.close().catch(() => undefined);
  await reportState({
    active: false,
    endpoint: current.endpoint,
    tabId: current.tabId,
    error,
  });
}

async function startCapture({ streamId, endpoint, tabId }) {
  await stopCapture();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  const context = new AudioContext({
    sampleRate: SAMPLE_RATE,
    latencyHint: 'interactive',
  });
  await context.audioWorklet.addModule('pcm-worklet.js');

  const source = context.createMediaStreamSource(stream);
  const processor = new AudioWorkletNode(context, 'proaudio-pcm-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [CHANNELS],
  });
  const silent = context.createGain();
  silent.gain.value = 0;

  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  const body = new TransformStream();
  const writer = body.writable.getWriter();
  let queuedBytes = 0;
  let writeChain = Promise.resolve();

  const current = {
    endpoint,
    tabId,
    stream,
    context,
    source,
    processor,
    silent,
    writer,
    request: null,
    stopping: false,
    chunk: new Float32Array(CHUNK_SAMPLES),
    chunkOffset: 0,
    writeChain,
    enqueue: null,
  };

  const fail = (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    void stopCapture(message);
  };

  current.enqueue = (samples) => {
    const bytes = new Uint8Array(
      samples.buffer,
      samples.byteOffset,
      samples.byteLength,
    ).slice();

    queuedBytes += bytes.byteLength;
    if (queuedBytes > MAX_QUEUED_BYTES) {
      fail(new Error('Network audio sender cannot keep up with the player.'));
      return;
    }

    writeChain = writeChain
      .then(() => writer.write(bytes))
      .finally(() => {
        queuedBytes -= bytes.byteLength;
      });
    current.writeChain = writeChain;
    writeChain.catch(fail);
  };

  processor.port.onmessage = (event) => {
    if (current.stopping || capture !== current) {
      return;
    }

    const samples = new Float32Array(event.data);
    let offset = 0;
    while (offset < samples.length) {
      const writable = Math.min(
        samples.length - offset,
        current.chunk.length - current.chunkOffset,
      );
      current.chunk.set(
        samples.subarray(offset, offset + writable),
        current.chunkOffset,
      );
      current.chunkOffset += writable;
      offset += writable;

      if (current.chunkOffset === current.chunk.length) {
        current.enqueue(current.chunk);
        current.chunk = new Float32Array(CHUNK_SAMPLES);
        current.chunkOffset = 0;
      }
    }
  };

  for (const track of stream.getTracks()) {
    track.addEventListener(
      'ended',
      () => {
        void stopCapture();
      },
      { once: true },
    );
  }

  capture = current;
  current.request = fetch(networkAudioUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-proaudio-pcm',
      'X-ProAudio-Sample-Format': 'float32le',
      'X-ProAudio-Sample-Rate': String(SAMPLE_RATE),
      'X-ProAudio-Channels': String(CHANNELS),
    },
    body: body.readable,
    duplex: 'half',
    cache: 'no-store',
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(
        payload || `Player rejected network audio with HTTP ${response.status}.`,
      );
    }
    return response;
  });

  await context.resume();
  await reportState({
    active: true,
    endpoint,
    tabId,
    error: null,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') {
    return undefined;
  }

  const run = async () => {
    if (message.type === 'START_CAPTURE') {
      await startCapture(message);
      return { ok: true };
    }
    if (message.type === 'STOP_CAPTURE') {
      await stopCapture();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown message' };
  };

  run()
    .then(sendResponse)
    .catch(async (error) => {
      const messageText = error instanceof Error ? error.message : String(error);
      await stopCapture(messageText);
      sendResponse({ ok: false, error: messageText });
    });
  return true;
});

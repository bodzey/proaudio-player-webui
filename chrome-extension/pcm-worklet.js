class ProAudioPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const left = input?.[0];
    if (!left) {
      return true;
    }

    const right = input[1] ?? left;
    const interleaved = new Float32Array(left.length * 2);
    for (let frame = 0; frame < left.length; frame += 1) {
      const offset = frame * 2;
      interleaved[offset] = left[frame];
      interleaved[offset + 1] = right[frame] ?? left[frame];
    }

    this.port.postMessage(interleaved.buffer, [interleaved.buffer]);
    return true;
  }
}

registerProcessor('proaudio-pcm-capture', ProAudioPcmProcessor);

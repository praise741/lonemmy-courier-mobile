/**
 * Notification sound utility using expo-av.
 * Generates a short two-tone chime WAV in-memory — no external audio files needed.
 * Falls back gracefully on error (console.error only).
 */
import { Audio } from 'expo-av';

let isAudioConfigured = false;

async function ensureAudioConfigured(): Promise<void> {
  if (isAudioConfigured) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });
  isAudioConfigured = true;
}

// ---------------------------------------------------------------------------
// Two-tone chime: 800 Hz for 100 ms then 1 200 Hz for 100 ms
// WAV: 8 000 Hz sample rate, 16-bit mono PCM
// ---------------------------------------------------------------------------
let cachedSource: { uri: string } | null = null;

function getChimeSource(): { uri: string } {
  if (cachedSource) return cachedSource;

  const sampleRate = 8000;
  const bitsPerSample = 16;
  const numChannels = 1;
  const bytesPerSample = bitsPerSample / 8;

  const duration1 = 0.1; // 100 ms — first tone
  const duration2 = 0.1; // 100 ms — second tone
  const totalDuration = duration1 + duration2;
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const dataSize = totalSamples * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt  chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true);             // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate two-tone chime samples
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const freq = t < duration1 ? 800 : 1200;
    const value = Math.sin(2 * Math.PI * freq * t);

    // Envelope: 10 ms attack, 20 ms release
    const attack = Math.min(t / 0.01, 1);
    const release = Math.min((totalDuration - t) / 0.02, 1);
    const envelope = Math.min(attack, release);

    const sample = Math.max(
      -32768,
      Math.min(32767, Math.floor(value * envelope * 0.3 * 32767)),
    );
    view.setInt16(44 + i * 2, sample, true);
  }

  // Convert to base64 data URI
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  cachedSource = { uri: `data:audio/wav;base64,${base64}` };
  return cachedSource;
}

let isPlaying = false;

/**
 * Play a short notification chime using expo-av.
 * Safe to call multiple times — overlapping plays are prevented.
 * Errors are caught and logged (never thrown to caller).
 */
export async function playNotificationSound(): Promise<void> {
  if (isPlaying) return;
  isPlaying = true;

  try {
    await ensureAudioConfigured();

    const source = getChimeSource();
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      volume: 1.0,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (error) {
    console.error('playNotificationSound error:', error);
  } finally {
    isPlaying = false;
  }
}

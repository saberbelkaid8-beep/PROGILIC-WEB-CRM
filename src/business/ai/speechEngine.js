/**
 * Speech Recognition and Live Audio Waveform Engine
 */

export class SpeechEngine {
  constructor(options = {}) {
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.animFrameId = null;
    this.silenceTimer = null;
    this.lang = options.lang || 'ar-DZ';

    this.initWebSpeech();
  }

  initWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Engine: Web Speech API not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStatusChange({ listening: true, state: 'listening' });
      this.startAudioVisualization();
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      this.resetSilenceTimer();

      this.onResult({
        final: finalTranscript.trim(),
        interim: interimTranscript.trim()
      });
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.onError(event.error);
      if (event.error !== 'no-speech') {
        this.stop();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStatusChange({ listening: false, state: 'idle' });
      this.stopAudioVisualization();
    };
  }

  setLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  start() {
    if (!this.recognition) {
      this.onError('Browser does not support Web Speech API');
      return;
    }

    if (this.isListening) return;

    try {
      this.recognition.lang = this.lang;
      this.recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      this.onError(err.message || 'Speech recognition start error');
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Error stopping speech recognition:', err);
      }
    }
    this.isListening = false;
    this.stopAudioVisualization();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    // Auto silence stop after 3 seconds of no speech
    this.silenceTimer = setTimeout(() => {
      if (this.isListening) {
        this.stop();
      }
    }, 3500);
  }

  async startAudioVisualization() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.isListening) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 128);
        this.onAudioLevel(normalized);
        this.animFrameId = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('Audio visualization permission/error:', err);
    }
  }

  stopAudioVisualization() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.onAudioLevel(0);
  }
}

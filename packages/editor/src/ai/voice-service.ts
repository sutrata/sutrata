export interface VoiceServiceCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class VoiceService {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public start(lang: string, callbacks: VoiceServiceCallbacks) {
    if (!this.recognition) {
      callbacks.onError('Web Speech API is not supported in this browser.');
      return;
    }
    if (this.isListening) {
      return;
    }

    this.recognition.lang = lang;
    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      callbacks.onResult(text, finalTranscript.length > 0);
    };

    this.recognition.onerror = (event: any) => {
      // Ignore 'no-speech' error to prevent crashing, just log it
      if (event.error === 'no-speech') {
        console.warn('Speech recognition: no speech detected');
        return;
      }
      callbacks.onError(event.error || 'Speech recognition error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      callbacks.onError(e.message || String(e));
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Failed to stop recognition:', e);
      }
      this.isListening = false;
    }
  }

  public abort() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.error('Failed to abort recognition:', e);
      }
      this.isListening = false;
    }
  }
}
export const voiceServiceInstance = new VoiceService();

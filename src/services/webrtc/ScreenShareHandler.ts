interface DisplayMediaDevice {
  getDisplayMedia(constraints: DisplayMediaStreamOptions): Promise<MediaStream>;
}

export class ScreenShareHandler {
  private stream: MediaStream | null = null;
  private readonly endListeners = new Set<() => void>();
  private readonly mediaDevices: DisplayMediaDevice | undefined;

  constructor(mediaDevices?: DisplayMediaDevice) {
    this.mediaDevices = mediaDevices;
  }

  get currentStream(): MediaStream | null {
    return this.stream;
  }

  isSupported(): boolean {
    if (this.mediaDevices) return true;
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  }

  async start(): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('Screen sharing is not supported in this browser');
    }

    this.stop();

    const mediaDevices = this.mediaDevices ?? navigator.mediaDevices;
    const stream = await mediaDevices.getDisplayMedia({ video: true, audio: false });
    this.stream = stream;

    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stop();
        this.notifyEnded();
      };
    }

    return stream;
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  onEnded(listener: () => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  private notifyEnded(): void {
    this.endListeners.forEach((listener) => listener());
  }
}

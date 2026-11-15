export type SignalingMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'status'; status: string };

export interface SignalingSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export type SignalingSocketFactory = (url: string) => SignalingSocket;

const READY_STATE_OPEN = 1;

function defaultSocketFactory(url: string): SignalingSocket {
  if (typeof WebSocket === 'undefined') {
    throw new Error('WebSocket is not supported in this environment');
  }

  return new WebSocket(url) as unknown as SignalingSocket;
}

export class SignalingClient {
  private socket: SignalingSocket | null = null;
  private readonly listeners = new Set<(message: SignalingMessage) => void>();

  constructor(
    private readonly url: string,
    private readonly socketFactory: SignalingSocketFactory = defaultSocketFactory,
  ) {}

  connect(): Promise<void> {
    if (this.socket?.readyState === READY_STATE_OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let socket: SignalingSocket;

      try {
        socket = this.socketFactory(this.url);
      } catch (error) {
        reject(error);
        return;
      }

      this.socket = socket;

      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('Could not connect to the help signaling service'));
      socket.onmessage = (event) => this.handleMessage(event);
      socket.onclose = () => {
        this.socket = null;
      };

      if (socket.readyState === READY_STATE_OPEN) {
        resolve();
      }
    });
  }

  sendOffer(sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'offer', sdp });
  }

  sendAnswer(sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'answer', sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    this.send({ type: 'ice-candidate', candidate });
  }

  onMessage(listener: (message: SignalingMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
    this.socket?.close();
    this.socket = null;
  }

  private send(message: SignalingMessage): void {
    if (this.socket?.readyState !== READY_STATE_OPEN) {
      throw new Error('Signaling connection is not open');
    }

    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(event: MessageEvent): void {
    let message: SignalingMessage;

    try {
      message = JSON.parse(String(event.data)) as SignalingMessage;
    } catch {
      return;
    }

    if (typeof message !== 'object' || message === null || typeof message.type !== 'string') {
      return;
    }

    this.listeners.forEach((listener) => listener(message));
  }
}

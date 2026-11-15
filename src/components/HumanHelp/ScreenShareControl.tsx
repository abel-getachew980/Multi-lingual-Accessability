'use client';

import { useEffect, useRef, useState } from 'react';
import { useTutor } from '@/context/TutorContext';
import { SignalingClient } from '@/services/webrtc/SignalingClient';
import { ScreenShareHandler } from '@/services/webrtc/ScreenShareHandler';
import { WebRTCConnector } from '@/services/webrtc/WebRTCConnector';
import { humanHelpCopy } from './copy';
import styles from './HumanHelp.module.css';

export function ScreenShareControl() {
  const {
    humanHelpRequest,
    screenShareActive,
    toggleScreenShare,
    preferences,
  } = useTutor();
  const copy = humanHelpCopy[preferences.language];
  const [error, setError] = useState<string | null>(null);
  const handlerRef = useRef<ScreenShareHandler | null>(null);
  const connectorRef = useRef<WebRTCConnector | null>(null);
  const toggleRef = useRef(toggleScreenShare);
  const activeRef = useRef(screenShareActive);

  useEffect(() => {
    toggleRef.current = toggleScreenShare;
    activeRef.current = screenShareActive;
  }, [screenShareActive, toggleScreenShare]);

  useEffect(() => () => {
    connectorRef.current?.disconnect();
    handlerRef.current?.stop();
    if (activeRef.current) toggleRef.current();
  }, []);

  const isConnected = humanHelpRequest?.status === 'connected'
    || humanHelpRequest?.status === 'in_progress';

  const stopSharing = () => {
    connectorRef.current?.disconnect();
    connectorRef.current = null;
    handlerRef.current?.stop();
    handlerRef.current = null;
  };

  const handleToggle = async () => {
    setError(null);

    if (screenShareActive) {
      stopSharing();
      toggleScreenShare();
      return;
    }

    if (!isConnected) {
      setError(copy.onlyConnected);
      return;
    }

    const handler = new ScreenShareHandler();
    if (!handler.isSupported()) {
      setError(copy.screenShareUnsupported);
      return;
    }

    const signalingUrl = process.env.NEXT_PUBLIC_WEBRTC_SIGNALING_SERVER;
    if (!signalingUrl) {
      setError(copy.screenShareNotConfigured);
      return;
    }

    try {
      const stream = await handler.start();
      const signaling = new SignalingClient(signalingUrl);
      await signaling.connect();
      const connector = new WebRTCConnector({ signaling });

      handler.onEnded(() => {
        connectorRef.current?.disconnect();
        connectorRef.current = null;
        handlerRef.current = null;
        toggleRef.current();
      });

      await connector.shareScreen(stream);

      handlerRef.current = handler;
      connectorRef.current = connector;
      toggleScreenShare();
    } catch {
      handler.stop();
      setError(copy.screenShareError);
    }
  };

  return (
    <div className={styles.screenShare}>
      <button
        type="button"
        className={screenShareActive ? styles.stopButton : styles.shareButton}
        onClick={() => void handleToggle()}
        aria-pressed={screenShareActive}
        aria-describedby={error ? 'screen-share-error' : 'screen-share-hint'}
        disabled={!isConnected}
      >
        {screenShareActive ? copy.stopScreenShare : copy.shareScreen}
      </button>
      <p id="screen-share-hint" className={styles.hint}>{copy.screenShareHint}</p>
      {error && <p id="screen-share-error" role="alert" className={styles.error}>{error}</p>}
    </div>
  );
}

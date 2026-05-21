import { useEffect, useMemo, useRef, useState } from 'react'
import {
  disconnectSession,
  getSessionStatus,
  redeemConnectToken,
  startSession,
} from '../api'

function formatRemaining(ms) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function summarizeGamepad(gamepad) {
  return {
    index: gamepad.index,
    buttons: gamepad.buttons.map((button) => Number(button.value.toFixed(2))),
    axes: gamepad.axes.map((axis) => Number(axis.toFixed(2))),
  }
}

export default function StreamingControlPlane({ selection }) {
  const [authToken, setAuthToken] = useState('demo-tenant-token')
  const [session, setSession] = useState(null)
  const [queueMessage, setQueueMessage] = useState('')
  const [status, setStatus] = useState('idle')
  const [remainingMs, setRemainingMs] = useState(0)
  const [signalStatus, setSignalStatus] = useState('offline')

  const peerRef = useRef(null)
  const wsRef = useRef(null)
  const inputChannelRef = useRef(null)
  const stageRef = useRef(null)

  const overlayText = useMemo(() => formatRemaining(remainingMs), [remainingMs])

  const sendInputPacket = (type, payload) => {
    const channel = inputChannelRef.current
    if (!channel || channel.readyState !== 'open') {
      return
    }

    channel.send(
      JSON.stringify({
        type,
        payload,
        sentAt: Date.now(),
      }),
    )
  }

  const bootstrapWebRtc = async (activeSession) => {
    const connect = await redeemConnectToken({
      sessionId: activeSession.sessionId,
      connectToken: activeSession.connectToken,
    })

    const peer = new RTCPeerConnection({ iceServers: connect.iceServers })
    const inputChannel = peer.createDataChannel(connect.dataChannelLabel || 'input-forwarding', {
      ordered: true,
    })

    inputChannel.onopen = () => setSignalStatus('datachannel-open')
    inputChannel.onclose = () => setSignalStatus('datachannel-closed')

    peer.onicecandidate = (event) => {
      if (!event.candidate || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return
      }

      wsRef.current.send(
        JSON.stringify({
          type: 'candidate',
          candidate: event.candidate,
          sessionId: activeSession.sessionId,
        }),
      )
    }

    peer.ontrack = (event) => {
      const video = document.getElementById('stream-video')
      if (!video) {
        return
      }

      const [stream] = event.streams
      if (stream) {
        video.srcObject = stream
      }
    }

    const ws = new WebSocket(connect.signalingEndpoint)
    ws.onopen = async () => {
      setSignalStatus('ws-open')
      const offer = await peer.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
      await peer.setLocalDescription(offer)
      ws.send(
        JSON.stringify({
          type: 'offer',
          sdp: offer.sdp,
          sessionId: activeSession.sessionId,
        }),
      )
    }

    ws.onmessage = async (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }

      if (data.type === 'answer' && data.sdp) {
        await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp })
      }

      if (data.type === 'candidate' && data.candidate) {
        await peer.addIceCandidate(data.candidate)
      }
    }

    ws.onerror = () => setSignalStatus('ws-error')
    ws.onclose = () => setSignalStatus('ws-closed')

    peerRef.current = peer
    wsRef.current = ws
    inputChannelRef.current = inputChannel
  }

  const clearWebRtc = () => {
    if (inputChannelRef.current) {
      inputChannelRef.current.close()
      inputChannelRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }
  }

  const handleStart = async () => {
    setStatus('allocating')
    setQueueMessage('')

    const result = await startSession({
      authToken,
      gameId: selection?.desktopMode ? '' : selection?.id,
      desktopMode: Boolean(selection?.desktopMode),
    })

    if (!result.ok && result.status === 202) {
      setStatus('queued')
      setQueueMessage(result.payload.message)
      return
    }

    if (!result.ok) {
      setStatus('error')
      setQueueMessage(result.payload.message || 'Failed to start session')
      return
    }

    setSession(result.payload)
    setRemainingMs(result.payload.remainingMs)
    setStatus('active')

    try {
      await bootstrapWebRtc(result.payload)
    } catch {
      setSignalStatus('unavailable')
    }
  }

  const handleEnd = async () => {
    if (session?.sessionId) {
      await disconnectSession(session.sessionId)
    }

    clearWebRtc()
    setSession(null)
    setRemainingMs(0)
    setStatus('idle')
    setSignalStatus('offline')
  }

  useEffect(() => {
    if (!session?.sessionId) {
      return
    }

    let mounted = true

    const poll = async () => {
      const response = await getSessionStatus(session.sessionId)
      if (!mounted) {
        return
      }

      if (!response.ok || response.payload.disconnect) {
        clearWebRtc()
        setSession(null)
        setRemainingMs(0)
        setStatus('idle')
        setSignalStatus('offline')
        return
      }

      setRemainingMs(response.payload.remainingMs)
    }

    poll().catch(() => {})
    const interval = setInterval(() => {
      poll().catch(() => {})
    }, 1000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [session?.sessionId])

  useEffect(() => {
    const keyDown = (event) => sendInputPacket('keyboard-down', { code: event.code })
    const keyUp = (event) => sendInputPacket('keyboard-up', { code: event.code })

    const mouseMove = (event) => {
      if (document.pointerLockElement !== stageRef.current) {
        return
      }

      sendInputPacket('mouse-move', {
        movementX: event.movementX,
        movementY: event.movementY,
      })
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('mousemove', mouseMove)

    const pollGamepad = setInterval(() => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      for (const pad of pads) {
        if (pad) {
          sendInputPacket('gamepad', summarizeGamepad(pad))
        }
      }
    }, 80)

    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('mousemove', mouseMove)
      clearInterval(pollGamepad)
    }
  }, [])

  return (
    <section className="panel panel-wide">
      <header className="panel-head">
        <h2>WebRTC Streaming Session</h2>
        <span className={`status-dot ${status === 'active' ? 'online' : ''}`}></span>
      </header>

      <p className="panel-label">Input forwarding: keyboard / pointer lock / gamepad via RTCDataChannel</p>

      <div className="auth-row">
        <input value={authToken} onChange={(event) => setAuthToken(event.target.value)} placeholder="Auth token" />
        <button className="action-btn" type="button" onClick={handleStart} disabled={status === 'active' || status === 'allocating'}>
          Start Session
        </button>
        <button className="action-btn" type="button" onClick={handleEnd} disabled={!session}>
          End Session
        </button>
      </div>

      <div className="stream-stage" ref={stageRef} onClick={() => stageRef.current?.requestPointerLock()}>
        <video id="stream-video" autoPlay muted playsInline />
        <div className="clock-overlay">{overlayText}</div>
      </div>

      {queueMessage && <p className="panel-label">{queueMessage}</p>}
      <p className="panel-label">Signal status: {signalStatus}</p>
      <p className="panel-label">Selected target: {selection?.label || 'Unassigned'}</p>
    </section>
  )
}

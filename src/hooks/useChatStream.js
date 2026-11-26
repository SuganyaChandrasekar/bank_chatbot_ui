import { useCallback, useEffect, useRef, useState } from 'react'
import usePiiMasking from './usePiiMasking'

function parseSsePayload(frame) {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  if (!data || data === '[DONE]') return { done: true }

  try {
    return JSON.parse(data)
  } catch {
    return { token: data }
  }
}

export default function useChatStream(
  url,
  {
    enabled = true,
    onConnectionChange,
    onActivity,
    sseUrl = import.meta.env.VITE_CHAT_SSE_URL,
  } = {},
) {
  const socketRef = useRef(null)
  const sseAbortRef = useRef(null)
  const responseRef = useRef('')
  const threadIdRef = useRef(null)
  const transportRef = useRef(url ? 'websocket' : 'sse')
  const fallbackAttemptedRef = useRef(false)
  const manualDisconnectRef = useRef(false)
  const [transport, setTransport] = useState(url ? 'websocket' : 'sse')
  const [connectionState, setConnectionState] = useState(!enabled ? 'idle' : url ? 'connecting' : sseUrl ? 'fallback' : 'idle')
  const [messages, setMessages] = useState([])
  const [currentResponse, setCurrentResponse] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const maskSensitiveText = usePiiMasking()

  const updateConnectionState = useCallback((nextState) => {
    setConnectionState(nextState)
    onConnectionChange?.(nextState === 'open')
  }, [onConnectionChange])

  const processPayload = useCallback((payload) => {
    if (typeof payload.thread_id === 'string') threadIdRef.current = payload.thread_id
    if (payload.type === 'completion' || payload.type === 'complete' || payload.done) {
      onActivity?.()
      const completedResponse = responseRef.current
      if (completedResponse) {
        setMessages((current) => [...current, { role: 'assistant', content: completedResponse }])
      }
      responseRef.current = ''
      setCurrentResponse('')
      setIsStreaming(false)
      return
    }

    if (payload.type === 'account_options') {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          type: 'account_options',
          content: payload.content,
          accounts: payload.accounts ?? [],
          accountChoiceSubmitted: false,
        },
      ])
      responseRef.current = ''
      setCurrentResponse('')
      return
    }

    if (payload.type === 'transfer') {
      setMessages((current) => [...current, {
        role: 'assistant',
        type: 'transfer',
        content: payload.content || payload.message,
        transactionId: payload.transaction_id,
        status: payload.status,
        mfaRequired: payload.mfa_required === true,
        transfer: payload.transfer,
      }])
      responseRef.current = ''
      setCurrentResponse('')
      setIsStreaming(false)
      return
    }

    if (payload.type === 'financial') {
      const { balance, currency = 'USD', account_label: accountLabel } = payload.payload ?? {}
      const numericBalance = Number(balance)
      const formattedBalance = Number.isFinite(numericBalance)
        ? numericBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : 'unavailable'

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: accountLabel
            ? `Your ${accountLabel.toLowerCase()} balance is ${currency} ${formattedBalance}.`
            : `Your available balance is ${currency} ${formattedBalance}.`,
        },
      ])
      responseRef.current = ''
      setCurrentResponse('')
      setIsStreaming(false)
      return
    }

    if (payload.type === 'error') {
      const errorContent = payload.content || 'Chat workflow is unavailable.'
      responseRef.current = responseRef.current
        ? `${responseRef.current}\n${errorContent}`
        : errorContent
      setCurrentResponse(responseRef.current)
      setIsStreaming(true)
      return
    }

    const token = payload.token ?? payload.content ?? ''
    if (token) {
      setCurrentResponse((current) => {
        const nextResponse = current + token
        responseRef.current = nextResponse
        return nextResponse
      })
      setIsStreaming(true)
    }
  }, [onActivity])

  const fallbackToSse = useCallback(() => {
    if (!sseUrl || fallbackAttemptedRef.current || manualDisconnectRef.current) return false
    fallbackAttemptedRef.current = true
    transportRef.current = 'sse'
    setTransport('sse')
    updateConnectionState('fallback')
    return true
  }, [sseUrl, updateConnectionState])

  const connect = useCallback(() => {
    if (!enabled || !url || socketRef.current || transportRef.current === 'sse') return
    manualDisconnectRef.current = false
    updateConnectionState('connecting')
    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.onopen = () => {
      transportRef.current = 'websocket'
      setTransport('websocket')
      fallbackAttemptedRef.current = false
      updateConnectionState('open')
    }
    socket.onmessage = (event) => {
      let payload
      try { payload = JSON.parse(event.data) } catch { payload = { token: event.data } }
      processPayload(payload)
    }
    socket.onerror = () => {
      if (!fallbackToSse()) updateConnectionState('error')
    }
    socket.onclose = () => {
      socketRef.current = null
      setIsStreaming(false)
      if (transportRef.current === 'sse') return
      if (!fallbackToSse()) updateConnectionState('closed')
    }
  }, [enabled, fallbackToSse, processPayload, updateConnectionState, url])

  const streamSseMessage = useCallback(async (content, accountChoice) => {
    const controller = new AbortController()
    sseAbortRef.current = controller
    setIsStreaming(true)

    try {
      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          content,
          ...(threadIdRef.current ? { thread_id: threadIdRef.current } : {}),
          ...(accountChoice === undefined ? {} : { account_choice: accountChoice }),
        }),
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok || !response.body) throw new Error('SSE connection failed')
      updateConnectionState('open')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        frames.forEach((frame) => processPayload(parseSsePayload(frame)))
        if (done) break
      }

      if (responseRef.current) processPayload({ done: true })
    } catch (error) {
      if (error.name !== 'AbortError') updateConnectionState('error')
    } finally {
      sseAbortRef.current = null
      setIsStreaming(false)
    }
  }, [processPayload, sseUrl, updateConnectionState])

  useEffect(() => {
    if (enabled) connect()
    return () => {
      manualDisconnectRef.current = true
      socketRef.current?.close()
      sseAbortRef.current?.abort()
    }
  }, [connect, enabled])

  const sendMessage = useCallback((content, { accountChoice } = {}) => {
    const maskedContent = maskSensitiveText(content.trim())
    if (!maskedContent) return false
    const appendUserMessage = () => setMessages((current) => [
      ...current.map((message) => message.type === 'account_options'
        ? { ...message, accountChoiceSubmitted: true }
        : message),
      { role: 'user', content: maskedContent },
    ])

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'message',
        content: maskedContent,
        ...(threadIdRef.current ? { thread_id: threadIdRef.current } : {}),
        ...(accountChoice === undefined ? {} : { account_choice: accountChoice }),
      }))
      appendUserMessage()
      onActivity?.()
      setIsStreaming(true)
      return true
    }

    if (enabled && transportRef.current === 'sse' && sseUrl) {
      appendUserMessage()
      onActivity?.()
      streamSseMessage(maskedContent, accountChoice)
      return true
    }

    return false
  }, [enabled, maskSensitiveText, onActivity, sseUrl, streamSseMessage])

  const appendLocalMessage = useCallback((message) => {
    setMessages((current) => [...current, message])
  }, [])

  const getSandboxCards = useCallback(async () => {
    const apiUrl = (import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000').replace(/\/$/, '')
    const response = await fetch(`${apiUrl}/sandbox/cards`, {
      credentials: 'include',
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.detail || 'Card information is unavailable.')
    return result
  }, [])

  const submitCardFreeze = useCallback(async (message, card, otp) => {
    const apiUrl = (import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000').replace(/\/$/, '')
    const response = await fetch(
      `${apiUrl}/sandbox/cards/${encodeURIComponent(card.card_id)}/freeze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otp_code: otp }),
      },
    )
    const result = await response.json()
    if (!response.ok) throw new Error(result.detail || 'This card action could not be completed.')

    setMessages((current) => current.map((entry) => (
      entry.type === 'card_freeze' && entry.cardActionId === message.cardActionId
        ? {
            ...entry,
            content: result.message,
            complete: true,
            cards: entry.cards.map((item) => (
              item.card_id === result.card_id ? { ...item, status: result.status } : item
            )),
          }
        : entry
    )))
    return result
  }, [])

  const updateTransfer = useCallback((requestId, result) => {
    setMessages((current) => current.map((message) => (
      message.type === 'transfer' && message.transactionId === requestId
        ? {
            ...message,
            content: `Transfer ${result.status === 'SUCCESS' ? 'submitted' : 'not completed'}. Reference: ${result.transaction_id}`,
            status: result.status,
            mfaRequired: false,
          }
        : message
    )))
  }, [])

  const submitTransfer = useCallback(async (message, otp) => {
    const apiUrl = (import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000').replace(/\/$/, '')
    const idempotencyKey = message.idempotencyKey || message.transactionId
    const response = await fetch(`${apiUrl}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      credentials: 'include',
      body: JSON.stringify({
        source_account_id: message.transfer.source_account_id,
        destination_account_id: message.transfer.destination_account_id,
        amount: message.transfer.amount,
        currency: message.transfer.currency,
        confirmed: true,
        ...(otp ? { otp_code: otp } : {}),
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      setMessages((current) => current.map((entry) => (
        entry.type === 'transfer' && entry.transactionId === message.transactionId
          ? { ...entry, idempotencyKey: crypto.randomUUID() }
          : entry
      )))
      throw new Error(result.detail || 'This transfer action could not be completed.')
    }
    updateTransfer(message.transactionId, result)
    return result
  }, [updateTransfer])

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true
    socketRef.current?.close()
    sseAbortRef.current?.abort()
    socketRef.current = null
    sseAbortRef.current = null
    threadIdRef.current = null
    responseRef.current = ''
    fallbackAttemptedRef.current = false
    transportRef.current = url ? 'websocket' : 'sse'
    setTransport(url ? 'websocket' : 'sse')
    setMessages([])
    setCurrentResponse('')
    setIsStreaming(false)
    updateConnectionState('closed')
  }, [url, updateConnectionState])

  return {
    connectionState,
    transport,
    messages,
    currentResponse,
    isStreaming,
    connect,
    disconnect,
    sendMessage,
    appendLocalMessage,
    getSandboxCards,
    submitCardFreeze,
    submitTransfer,
  }
}

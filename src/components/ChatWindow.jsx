import { useEffect, useRef, useState } from 'react'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import { Alert, Avatar, Box, Button, CircularProgress, Container, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import useChatStream from '../hooks/useChatStream'

const statusLabels = {
  idle: 'Start a sandbox session',
  open: 'Secure connection active',
  connecting: 'Connecting securely',
  fallback: 'Using secure backup connection',
  closed: 'Connection closed',
  error: 'Connection unavailable',
}

const suggestedTasks = [
  { label: 'Check my balance', icon: <AccountBalanceWalletOutlinedIcon />, prompt: 'Can you help me check my account balance?' },
  { label: 'Review a transaction', icon: <ReceiptLongOutlinedIcon />, prompt: 'I have a question about a recent transaction.' },
  { label: 'Manage my card', icon: <CreditCardOutlinedIcon />, prompt: 'I want to freeze my debit card.' },
]

function isCardFreezeRequest(content) {
  return /\b(freeze|block|lock)\b/i.test(content) && /\b(card|debit|credit)\b/i.test(content)
}

function CardFreezeActions({ message, onSubmitCardFreeze }) {
  const [selectedCardId, setSelectedCardId] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeCards = message.cards.filter((card) => card.status === 'active')
  const selectedCard = activeCards.find((card) => card.card_id === selectedCardId)

  const runAction = async () => {
    if (!selectedCard || otp.length !== 6) return
    setBusy(true)
    setError('')
    try {
      await onSubmitCardFreeze(message, selectedCard, otp)
      setOtp('')
    } catch (actionError) {
      setError(actionError.message)
      setOtp('')
    } finally {
      setBusy(false)
    }
  }

  if (message.complete) return null

  return (
    <Stack spacing={1.25} sx={{ mt: 1.5, alignItems: 'flex-start' }}>
      {message.cards.map((card) => (
        <Button
          key={card.card_id}
          variant={selectedCardId === card.card_id ? 'contained' : 'outlined'}
          disabled={busy || card.status !== 'active'}
          onClick={() => {
            setSelectedCardId(card.card_id)
            setOtp('')
            setError('')
          }}
          sx={{ whiteSpace: 'normal', textAlign: 'left' }}
        >
          {card.name} ···· {card.last_4} ({card.status})
        </Button>
      ))}
      {selectedCard ? (
        <>
          <Typography variant="caption" color="text.secondary">
            Enter your one-time code here. It will not be sent in chat.
          </Typography>
          <TextField
            type="password"
            label="6-digit verification code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6, 'aria-label': '6-digit verification code' } }}
            disabled={busy}
            size="small"
          />
          <Button variant="contained" disabled={busy || otp.length !== 6} onClick={runAction}>
            Verify and freeze card
          </Button>
        </>
      ) : null}
      {error ? <Typography role="alert" variant="caption" color="error">{error}</Typography> : null}
    </Stack>
  )
}

function TransferActions({ message, onSubmitTransfer }) {
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const runAction = async () => {
    setBusy(true)
    setError('')
    try {
      await onSubmitTransfer(message, message.mfaRequired ? otp : undefined)
      setOtp('')
    } catch (actionError) {
      setError(actionError.message)
      if (message.mfaRequired) setOtp('')
    } finally {
      setBusy(false)
    }
  }

  if (message.status !== 'PENDING_CONFIRMATION') return null

  return (
    <Stack spacing={1.25} sx={{ mt: 1.5, alignItems: 'flex-start' }}>
      {message.mfaRequired ? (
        <>
          <TextField
            label="6-digit verification code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6, 'aria-label': '6-digit verification code' } }}
            disabled={busy}
            size="small"
          />
          <Button variant="contained" disabled={busy || otp.length !== 6} onClick={runAction}>
            Verify and send transfer
          </Button>
        </>
      ) : (
        <Button variant="contained" disabled={busy} onClick={runAction}>
          Confirm transfer
        </Button>
      )}
      {error ? <Typography role="alert" variant="caption" color="error">{error}</Typography> : null}
    </Stack>
  )
}

export default function ChatWindow({ url = import.meta.env.VITE_CHAT_WS_URL, sseUrl = import.meta.env.VITE_CHAT_SSE_URL }) {
  const [draft, setDraft] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [cardLookupBusy, setCardLookupBusy] = useState(false)
  const conversationRef = useRef(null)
  const { userId, startSandboxSession, endSandboxSession, setRealtimeOnline } = useAuth()
  const {
    connectionState,
    transport,
    messages,
    currentResponse,
    isStreaming,
    sendMessage,
    appendLocalMessage,
    getSandboxCards,
    submitCardFreeze,
    submitTransfer,
  } = useChatStream(url, { enabled: Boolean(userId), onConnectionChange: setRealtimeOnline, sseUrl })
  useEffect(() => {
    const conversation = conversationRef.current
    if (conversation) conversation.scrollTop = conversation.scrollHeight
  }, [messages, currentResponse, isStreaming])

  const handleSandboxSession = async () => {
    setSessionBusy(true)
    setSessionError('')
    try {
      if (userId) await endSandboxSession()
      else await startSandboxSession()
    } catch (error) {
      setSessionError(error.name === 'TimeoutError'
        ? 'Sandbox sign-in timed out. Make sure the local orchestrator is running, then try again.'
        : 'Sandbox sign-in is unavailable. Check the local backend configuration.')
    } finally {
      setSessionBusy(false)
    }
  }
  const handleCardFreezeRequest = async (requestText) => {
    appendLocalMessage({ role: 'user', content: requestText.trim() })
    setCardLookupBusy(true)
    try {
      const cards = await getSandboxCards()
      appendLocalMessage({
        role: 'assistant',
        type: 'card_freeze',
        cardActionId: crypto.randomUUID(),
        content: cards.length
          ? 'Choose the card to freeze. Standard verification is required.'
          : 'No cards are available for this sandbox user.',
        cards,
      })
    } catch (error) {
      appendLocalMessage({
        role: 'assistant',
        content: error.message || 'Card information is currently unavailable.',
      })
    } finally {
      setCardLookupBusy(false)
    }
  }
  const handleSubmit = (event) => {
    event.preventDefault()
    if (isCardFreezeRequest(draft)) {
      setDraft('')
      void handleCardFreezeRequest(draft)
      return
    }
    if (sendMessage(draft)) setDraft('')
  }

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (draft.trim() && !isStreaming && !cardLookupBusy) {
      event.currentTarget.closest('form')?.requestSubmit()
      setDraft('')
    }
  }

  const handleSuggestion = (prompt) => {
    if (isCardFreezeRequest(prompt)) {
      void handleCardFreezeRequest(prompt)
      return
    }
    if (sendMessage(prompt)) setDraft('')
  }

  return (
    <Box className="app-shell" sx={{ width: '100%', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: { xs: 0, sm: 3, md: 4 } }}>
      <Container maxWidth="lg" disableGutters sx={{ width: '100%', height: { xs: '100dvh', sm: 'calc(100dvh - 48px)', md: 'min(820px, calc(100dvh - 64px))' }, minHeight: 0, display: 'flex', flexDirection: 'column', px: { xs: 0, sm: 3 } }}>
        <Box component="header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 2.5, sm: 1 }, py: { xs: 2, sm: 1.5 }, gap: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar variant="rounded" sx={{ width: 42, height: 42, bgcolor: 'primary.main', color: 'secondary.light', borderRadius: 1.5 }}>
              <SupportAgentRoundedIcon aria-hidden="true" />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.2, letterSpacing: 0.8 }}>ALBIAN</Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 650 }}>Personal banking support</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button size="small" variant={userId ? 'text' : 'outlined'} onClick={handleSandboxSession} disabled={sessionBusy} sx={{ whiteSpace: 'nowrap', minWidth: 0 }}>
              {sessionBusy ? 'Please wait' : userId ? 'End sandbox session' : 'Sandbox login'}
            </Button>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: connectionState === 'open' ? 'success.main' : 'text.secondary' }} aria-label={`${transport} connection status: ${statusLabels[connectionState]}`}>
            <LockOutlinedIcon sx={{ fontSize: 17 }} aria-hidden="true" />
            <Typography variant="caption" sx={{ fontWeight: 650, display: { xs: 'none', sm: 'block' } }}>{statusLabels[connectionState]}</Typography>
            <Box aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connectionState === 'open' ? 'success.main' : 'secondary.main' }} />
            </Stack>
          </Stack>
        </Box>

        <Paper component="section" aria-label="Northstar banking assistant" elevation={0} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: { xs: 0, sm: 2 }, boxShadow: { xs: 'none', sm: '0 18px 55px rgba(23, 43, 53, 0.08)' } }}>
          <Box sx={{ px: { xs: 2, sm: 4 }, py: { xs: 1.5, sm: 2.5 }, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, color: 'text.primary' }}>Your secure conversation</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Here to help with your everyday banking</Typography>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0, color: 'success.main', bgcolor: '#EFF6F2', px: 1.25, py: 0.75, borderRadius: 1 }}>
              <ShieldOutlinedIcon sx={{ fontSize: 16 }} aria-hidden="true" />
              <Typography variant="caption" sx={{ fontWeight: 650 }}>Protected</Typography>
            </Stack>
          </Box>

          <Box ref={conversationRef} component="main" aria-live="polite" aria-label="Conversation messages" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 4 }, bgcolor: '#F7F9F9' }}>
            {sessionError ? <Alert severity="error" sx={{ maxWidth: 740, mx: 'auto', mb: 2 }}>{sessionError}</Alert> : null}
            {messages.length === 0 && !currentResponse ? (
              <Box sx={{ maxWidth: 690, mx: 'auto', py: { xs: 1, sm: 2 } }}>
                <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', mb: { xs: 3.5, sm: 4.5 } }}>
                  <Avatar sx={{ width: 54, height: 54, bgcolor: '#E6EFED', color: 'primary.main', mb: 0.5 }}><SupportAgentRoundedIcon fontSize="medium" aria-hidden="true" /></Avatar>
                  <Typography component="h1" variant="h5" sx={{ lineHeight: 1.15, textAlign: 'center', color: 'text.primary' }}>Good day. How can we help?</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460 }}>Get help with your accounts, cards, and recent activity. Tell us what you need.</Typography>
                </Stack>

                <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.8, mb: 1.25 }}>POPULAR REQUESTS</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                  {suggestedTasks.map((task) => (
                    <Button key={task.label} variant="outlined" onClick={() => handleSuggestion(task.prompt)} disabled={!userId || isStreaming} startIcon={task.icon} sx={{ flex: '1 1 190px', minWidth: 0, minHeight: 56, justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.3, px: 1.75, py: 1.25, color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { borderColor: 'primary.main', bgcolor: '#F0F5F4' }, '& .MuiButton-startIcon': { flexShrink: 0, color: 'primary.main' } }}>
                      {task.label}
                    </Button>
                  ))}
                </Box>
                <Alert severity="info" icon={<ShieldOutlinedIcon />} sx={{ mt: 3, border: 1, borderColor: '#DCE8E5', bgcolor: '#F0F6F4', color: 'text.secondary', '& .MuiAlert-icon': { color: 'success.main' } }}>
                  For your security, never share your password, PIN, or one-time verification code in chat.
                </Alert>
              </Box>
            ) : (
              <Stack spacing={2.5} sx={{ maxWidth: 740, mx: 'auto' }}>
                {messages.map((message, index) => (
                  <Box key={`${message.role}-${index}`} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: { xs: '94%', sm: '82%' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, px: 0.5 }}>{message.role === 'user' ? 'You' : 'Northstar assistant'}</Typography>
                    <Paper elevation={0} sx={{ p: 1.75, border: 1, borderColor: message.role === 'user' ? 'primary.main' : '#D9E3E2', borderRadius: 1.5, bgcolor: message.role === 'user' ? 'primary.main' : '#EAF1F0', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary' }}>
                      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}</Typography>
                      {message.type === 'account_options' && message.accounts?.length ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5, rowGap: 1 }}>
                          {message.accounts.map((account) => (
                            <Button
                              key={account.choice}
                              variant="outlined"
                              disabled={isStreaming || message.accountChoiceSubmitted}
                              onClick={() => sendMessage(
                                `Check my ${account.label.toLowerCase()} balance`,
                                { accountChoice: account.choice },
                              )}
                              sx={{ minHeight: 44, whiteSpace: 'normal', textAlign: 'left' }}
                            >
                              {account.label}
                            </Button>
                          ))}
                        </Stack>
                      ) : null}
                      {message.type === 'transfer' ? (
                        <>
                          {message.transfer ? (
                            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                              {message.transfer.amount} {message.transfer.currency} from {message.transfer.source_account} to {message.transfer.recipient}
                            </Typography>
                          ) : null}
                          <TransferActions
                            message={message}
                            onSubmitTransfer={submitTransfer}
                          />
                        </>
                      ) : null}
                      {message.type === 'card_freeze' ? (
                        <CardFreezeActions
                          message={message}
                          onSubmitCardFreeze={submitCardFreeze}
                        />
                      ) : null}
                    </Paper>
                  </Box>
                ))}
                {currentResponse ? (
                  <Box sx={{ alignSelf: 'flex-start', maxWidth: { xs: '94%', sm: '82%' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, px: 0.5 }}>Northstar assistant</Typography>
                    <Paper elevation={0} sx={{ p: 1.75, border: 1, borderColor: '#D9E3E2', borderRadius: 1.5, bgcolor: '#EAF1F0' }}><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{currentResponse}</Typography></Paper>
                  </Box>
                ) : null}
                {isStreaming && !currentResponse ? <CircularProgress size={20} aria-label="Assistant is responding" sx={{ color: 'primary.main' }} /> : null}
              </Stack>
            )}
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ px: { xs: 2, sm: 4 }, pt: 2, pb: { xs: 'max(14px, env(safe-area-inset-bottom))', sm: 2.25 }, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction="row" spacing={1} sx={{ maxWidth: 740, mx: 'auto', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <TextField fullWidth multiline maxRows={4} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={userId ? 'Write a message...' : 'Start a sandbox session to chat'} slotProps={{ htmlInput: { 'aria-label': 'Message your banking assistant' } }} disabled={!userId || isStreaming || cardLookupBusy} sx={{ flex: '1 1 220px', minWidth: 0, width: 'auto', '& .MuiOutlinedInput-root': { bgcolor: '#F7F9F9', borderRadius: 1.5 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }} />
              <IconButton type="submit" disabled={!userId || !draft.trim() || isStreaming || cardLookupBusy} aria-label="Send message" sx={{ width: 48, height: 48, flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1.5, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: '#E8EDEE', color: '#98A5A8' } }}>
                {isStreaming || cardLookupBusy ? <CircularProgress size={21} color="inherit" aria-label="Sending message" /> : <ArrowUpwardRoundedIcon aria-hidden="true" />}
              </IconButton>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.25 }}>
              <LockOutlinedIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom', mr: 0.5 }} aria-hidden="true" />Your conversation is private and secure
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

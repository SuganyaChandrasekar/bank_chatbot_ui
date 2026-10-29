import { Box, CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import ChatWindow from './components/ChatWindow'
import { AuthProvider } from './context/AuthContext'
import theme from './theme/theme'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Box sx={{ width: '100%', minHeight: '100dvh' }}>
          <ChatWindow />
        </Box>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

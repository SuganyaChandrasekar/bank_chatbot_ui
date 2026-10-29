import { createTheme, responsiveFontSizes } from '@mui/material/styles'

const theme = responsiveFontSizes(createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#163B4D', dark: '#102C3A', light: '#315D6B', contrastText: '#FFFFFF' },
    secondary: { main: '#B28A45', dark: '#89682F', light: '#D2B16F', contrastText: '#17212B' },
    background: { default: '#F2F6F7', paper: '#FFFFFF' },
    text: { primary: '#172B35', secondary: '#63737A' },
    divider: '#DCE5E6',
    success: { main: '#39765E' },
  },
  typography: {
    fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
    h1: { fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontWeight: 700 },
    h2: { fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontWeight: 700 },
    h5: { fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 650, textTransform: 'none' },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { margin: 0, minWidth: 320, backgroundColor: '#F2F6F7' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
}), { variants: ['h4', 'h5', 'h6'] })

export default theme

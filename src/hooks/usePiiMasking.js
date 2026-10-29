import { useCallback } from 'react'

const LABELED_FIELD_PATTERNS = [
  {
    pattern: /((?:\b(?:bank\s+)?account(?:\s+(?:number|no\.?))?|\bacct\.?\s*(?:number|no\.?)?|\brouting(?:\s+(?:number|no\.?))?)\b\s*(?:(?:is|:|=|#)\s*)?)(\d(?:[ -]?\d){3,19})/gi,
    replacement: '$1[ACCOUNT_NUMBER]',
  },
  {
    pattern: /(\b(?:social\s+security\s+(?:number|no\.?)?|ssn)\b\s*(?:(?:is|:|=|#)\s*)?)(\d{3}[ -]?\d{2}[ -]?\d{4})/gi,
    replacement: '$1[SSN]',
  },
  {
    pattern: /(\b(?:phone|telephone|mobile)(?:\s+(?:number|no\.?))?\b\s*(?:(?:is|:|=|#)\s*)?)(\+?[\d(). -]{7,20}\d)/gi,
    replacement: '$1[PHONE]',
  },
  {
    pattern: /(\b(?:date\s+of\s+birth|dob|birth\s*date)\b\s*(?:(?:is|:|=|#)\s*)?)(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})/gi,
    replacement: '$1[DATE_OF_BIRTH]',
  },
  {
    pattern: /(\b(?:pin|otp|one[- ]time\s+code|password|passcode)\b\s*(?:(?:is|:|=|#)\s*)?)([^\s,;]+)/gi,
    replacement: '$1[REDACTED]',
  },
  {
    pattern: /(\b(?:full\s+name|name|email(?:\s+address)?|street\s+address|home\s+address)\b\s*(?:(?:is|:|=)\s*))([^,;\n]+)/gi,
    replacement: '$1[REDACTED]',
  },
]

const EMAIL_PATTERN = /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/gi
const SSN_PATTERN = /\b\d{3}[ -]?\d{2}[ -]?\d{4}\b/g
const PHONE_PATTERN = /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g
const DATE_PATTERN = /\b(?:\d{1,2}[/-]\d{1,2}[/-](?:19|20)?\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})\b/g
const LONG_NUMBER_PATTERN = /(?<!\d)(?:\d[ -]?){7,19}\d(?!\d)/g
const CARD_NUMBER_PATTERN = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g

function passesLuhn(value) {
  const digits = value.replace(/\D/g, '')
  let sum = 0
  let doubleDigit = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }

  return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0
}

export function maskPii(text) {
  if (typeof text !== 'string') return text

  let maskedText = text
  for (const { pattern, replacement } of LABELED_FIELD_PATTERNS) {
    maskedText = maskedText.replace(pattern, replacement)
  }

  return maskedText
    .replace(EMAIL_PATTERN, '[EMAIL]')
    .replace(SSN_PATTERN, '[SSN]')
    .replace(PHONE_PATTERN, '[PHONE]')
    .replace(DATE_PATTERN, '[DATE]')
    .replace(CARD_NUMBER_PATTERN, (match) => (passesLuhn(match) ? '[CARD_NUMBER]' : match))
    .replace(LONG_NUMBER_PATTERN, '[ACCOUNT_NUMBER]')
}

export default function usePiiMasking() {
  return useCallback((text) => maskPii(text), [])
}
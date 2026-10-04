const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export function toAsciiDigits(value) {
  return String(value || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
}

export function normalizePhone(input) {
  let digits = toAsciiDigits(input).replace(/\D/g, '')
  if (digits.startsWith('880')) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null
}

export function phoneToEmail(input) {
  const phone = normalizePhone(input)
  return phone ? `${phone}@phone.gramride.app` : null
}

export function normalizePin(input) {
  return toAsciiDigits(input).replace(/\s/g, '')
}
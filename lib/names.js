// FILE: lib/names.js   (new file)
// Small helpers so route/stop names and fares show in the user's language.

// Bangla name if the language is Bangla and one was entered, otherwise the English name.
export const localName = (item, lang) =>
  lang === 'bn' && item && item.name_bn && item.name_bn.trim() ? item.name_bn : item?.name

// A ride stores its pickup/destination as English text. Find the matching stop
// of its route and show that stop's name in the current language.
export const stopText = (stops, text, lang) => {
  if (!text) return text
  const stop = (stops || []).find((s) => s.name === text)
  return stop ? localName(stop, lang) : text
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
export const toBnDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[d])

// ৳50 in English, ৳৫০ in Bangla
export const money = (amount, lang) => {
  if (amount === null || amount === undefined || amount === '') return '৳'
  return lang === 'bn' ? `৳${toBnDigits(amount)}` : `৳${amount}`
}

// Any number (seats, minutes, queue position, 5:00 countdown) with Bangla digits in Bangla
export const num = (value, lang) => (lang === 'bn' ? toBnDigits(value) : String(value))
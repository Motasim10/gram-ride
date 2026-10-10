// FILE: lib/sms.js   (new file)
// Sends an SMS through BulkSMSBD. If SMS_API_KEY is not set, it runs in TEST MODE:
// the message is printed in the terminal instead of being sent.
export async function sendSms(phone01, message) {
  const apiKey = process.env.SMS_API_KEY
  const senderId = process.env.SMS_SENDER_ID
  if (!apiKey || !senderId) {
    console.log(`[SMS TEST MODE] to ${phone01}: ${message}`)
    return { ok: true, test: true }
  }
  const number = '88' + phone01 // 01XXXXXXXXX -> 8801XXXXXXXXX
  try {
    const res = await fetch('https://bulksmsbd.net/api/smsapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, senderid: senderId, number, message }),
    })
    const text = await res.text()
    let code = null
    try { code = JSON.parse(text).response_code } catch {}
    if (code === 202 || /\b202\b/.test(text)) return { ok: true }
    console.error('[SMS] provider refused:', text)
    return { ok: false }
  } catch (e) {
    console.error('[SMS] network error', e)
    return { ok: false }
  }
}
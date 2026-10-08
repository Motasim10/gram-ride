// The support phone number. Change it here and it updates everywhere (Help page and the login page).
export const HOTLINE_NUMBER = '01700-000000' // TODO: replace with your real support number


// Help videos. Paste a YouTube link in `url` and the video appears on the Help page for that role.
// Leave `url` empty to hide a video. `duration` is optional, for example '1:45'.
export const HELP_VIDEOS = {
  passenger: [
    { title: { bn: 'কীভাবে রাইড বুক করবেন?', en: 'How to book a ride' }, duration: '', url: '' },
    { title: { bn: 'রিজার্ভ রাইডে দরদাম', en: 'Negotiating a reserve ride' }, duration: '', url: '' },
  ],
  driver: [
    { title: { bn: 'চালক হিসেবে অনলাইনে যাবেন কীভাবে?', en: 'How to go online as a driver' }, duration: '', url: '' },
    { title: { bn: 'যাত্রী নেওয়া ও ট্রিপ শেষ করা', en: 'Accepting passengers and finishing a trip' }, duration: '', url: '' },
  ],
}
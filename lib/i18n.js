'use client'
import { createContext, useContext, useEffect, useState } from 'react'

const translations = {
  bn: {
    login: 'লগ ইন',
    email: 'ইমেইল',
    password: 'পাসওয়ার্ড',
    loggingIn: 'লগ ইন হচ্ছে...',
    logInButton: 'লগ ইন করুন',
    createAccountTitle: 'অ্যাকাউন্ট তৈরি করুন',
    name: 'নাম',
    phone: 'ফোন নম্বর',
    iAmA: 'আমি একজন:',
    passenger: 'যাত্রী',
    driver: 'চালক',
    creatingAccount: 'অ্যাকাউন্ট তৈরি হচ্ছে...',
    createAccountButton: 'অ্যাকাউন্ট তৈরি করুন',
    welcome: 'স্বাগতম',
    loggedInAs: 'আপনি লগইন করেছেন একজন',
    requestRide: 'রাইড বুক করুন',
    viewRequests: 'রাইড অনুরোধ দেখুন',
    walletStats: 'ওয়ালেট ও পরিসংখ্যান',
    tripHistory: 'ট্রিপ ইতিহাস',

    requestRideTitle: 'রাইড বুক করুন',
    rideType: 'রাইডের ধরন',
    shared: 'শেয়ার্ড',
    reserve: 'রিজার্ভ (পুরো গাড়ি)',
    vehicle: 'যানবাহন',
    cng5: 'সিএনজি (৫ আসন)',
    auto2: 'অটো (২ আসন)',
    pickup: 'পিকআপ',
    destination: 'গন্তব্য',
    peopleTraveling: 'কতজন যাত্রী?',
    seatsNeeded: 'কয়টি আসন প্রয়োজন',
    maxFor: 'সর্বোচ্চ',
    requesting: 'অনুরোধ পাঠানো হচ্ছে...',
    findRide: 'রাইড খুঁজুন',
    yourRide: 'আপনার রাইড',
    from: 'কোথা থেকে',
    to: 'কোথায়',
    type: 'ধরন',
    seats: 'আসন',
    status: 'অবস্থা',
    searching: 'খোঁজা হচ্ছে',
    negotiating: 'দরদাম চলছে',
    accepted: 'গৃহীত',
    completed: 'সম্পন্ন',
    waitingForQuote: 'চালকের ভাড়ার প্রস্তাবের অপেক্ষায়...',
    driverQuoted: 'চালক প্রস্তাব দিয়েছেন',
    accept: 'গ্রহণ করুন',
    yourCounterOffer: 'আপনার পাল্টা প্রস্তাব (৳)',
    sendCounterOffer: 'পাল্টা প্রস্তাব পাঠান',
    youOffered: 'আপনি প্রস্তাব দিয়েছেন',
    waitingForDriverResponse: "চালকের উত্তরের অপেক্ষায়...",
    driversFinalOffer: 'চালকের চূড়ান্ত প্রস্তাব',
    finalOfferNote: 'এটি চালকের চূড়ান্ত মূল্য — গ্রহণ করুন, অথবা বাতিল করে অন্য চালক খুঁজুন।',
    cancelFindAnother: 'বাতিল করুন ও অন্য চালক খুঁজুন',
    confirmedAt: 'নিশ্চিত হয়েছে',
    fare: 'ভাড়া',

    rateYourTrip: 'আপনার ট্রিপ রেট করুন',
    farePaid: 'পরিশোধিত ভাড়া',
    anyComments: 'কোনো মন্তব্য? (ঐচ্ছিক)',
    submitRating: 'রেটিং জমা দিন',
    submitting: 'জমা হচ্ছে...',
    skip: 'এড়িয়ে যান',
    thanksForFeedback: 'আপনার মতামতের জন্য ধন্যবাদ!',
    done: 'সম্পন্ন',

    rideRequestsTitle: 'রাইড অনুরোধ',
    sendQuoteNote: 'একটি অনুরোধ নিতে ভাড়ার প্রস্তাব পাঠান।',
    noRequestsWaiting: 'এই মুহূর্তে কোনো অনুরোধ নেই।',
    yourFareQuote: 'আপনার ভাড়ার প্রস্তাব (৳)',
    sendQuote: 'প্রস্তাব পাঠান',
    yourActiveRide: 'আপনার চলমান রাইড',
    completeTrip: 'ট্রিপ সম্পন্ন করুন',
    completing: 'সম্পন্ন হচ্ছে...',
    confirmCashReceived: 'নগদ গ্রহণ নিশ্চিত করুন: ৳',
    didYouReceive: 'আপনি কি যাত্রীর কাছ থেকে ৳',
    inCash: 'নগদ গ্রহণ করেছেন?',
    yesReceived: 'হ্যাঁ, আমি ৳',
    received: 'গ্রহণ করেছি',
    noGoBack: 'না, ফিরে যান',
    negotiatingTitle: 'দরদাম চলছে',
    youQuoted: 'আপনি প্রস্তাব দিয়েছেন',
    waitingForPassengerResponse: 'যাত্রীর উত্তরের অপেক্ষায়...',
    passengerCountered: 'যাত্রী পাল্টা প্রস্তাব দিয়েছেন',
    yourFinalOffer: 'আপনার চূড়ান্ত প্রস্তাব (৳)',
    sendFinalOffer: 'চূড়ান্ত প্রস্তাব পাঠান',
    notInterestedRelease: 'আগ্রহী নই — অনুরোধ ছেড়ে দিন',
    youSentFinalOffer: 'আপনি চূড়ান্ত প্রস্তাব পাঠিয়েছেন',
    waitingForPassengerDecision: 'যাত্রীর সিদ্ধান্তের অপেক্ষায়...',

    walletStatsTitle: 'ওয়ালেট ও পরিসংখ্যান',
    totalEarnings: 'মোট আয়',
    totalTrips: 'মোট ট্রিপ',
    rating: 'রেটিং',
    noRatingsYet: 'এখনো কোনো রেটিং নেই',
    ratingsCount: 'টি রেটিং',
    walletNote: 'নগদ পরিশোধ ও সাবস্ক্রিপশন বিলিং এখনো চালু হয়নি — এই স্ক্রিনে আপনার প্রকৃত ট্রিপ ও রেটিং পরিসংখ্যান দেখানো হচ্ছে।',

    tripHistoryTitle: 'ট্রিপ ইতিহাস',
    noCompletedTrips: 'এখনো কোনো ট্রিপ সম্পন্ন হয়নি।',

    notificationsTitle: 'নোটিফিকেশন',
    noNotificationsYet: 'এখনো কোনো নোটিফিকেশন নেই।',

        complaints: 'অভিযোগ',
    fileComplaint: 'অভিযোগ দাখিল করুন',
    category: 'ধরন',
    catFare: 'ভাড়া বিরোধ',
    catBehavior: 'আচরণ',
    catSafety: 'নিরাপত্তা',
    catNoShow: 'অনুপস্থিতি',
    describeIssue: 'সমস্যাটি লিখুন',
    submitComplaint: 'অভিযোগ জমা দিন',
    complaintSubmitted: 'আপনার অভিযোগ জমা হয়েছে। আমরা এটি পর্যালোচনা করব।',
    myComplaints: 'আমার অভিযোগসমূহ',
    noComplaintsYet: 'আপনি এখনো কোনো অভিযোগ দাখিল করেননি।',
    open: 'খোলা',
    resolved: 'সমাধান হয়েছে',
    fileAComplaint: 'একটি অভিযোগ দাখিল করুন',
    selectARide: 'একটি ট্রিপ বেছে নিন',

    loading: 'লোড হচ্ছে...',

    notif: {
      quoted: (p) => `একজন চালক আপনার "${p.destination}"-এ যাওয়ার রাইডের জন্য ৳${p.amount} প্রস্তাব দিয়েছেন।`,
      countered: (p) => `যাত্রী ৳${p.amount} পাল্টা প্রস্তাব দিয়েছেন।`,
      finalOffer: (p) => `চালকের চূড়ান্ত প্রস্তাব: আপনার রাইডের জন্য ৳${p.amount}।`,
      rideConfirmedForPassenger: (p) => `আপনার রাইড ৳${p.amount} টাকায় নিশ্চিত হয়েছে!`,
      rideConfirmedForDriver: (p) => `যাত্রী আপনার ৳${p.amount} প্রস্তাব গ্রহণ করেছেন! রাইড নিশ্চিত হয়েছে।`,
      cancelled: () => `যাত্রী দরদাম বাতিল করেছেন। রাইডটি আবার খোলা তালিকায় ফিরে গেছে।`,
      tripComplete: (p) => `আপনার "${p.destination}"-এ ট্রিপ সম্পন্ন হয়েছে। ভাড়া: ৳${p.amount}।`,
      ratingReceived: (p) => `আপনি ${p.stars}-স্টার রেটিং পেয়েছেন।`,
    },
  },
  en: {
    login: 'Log In',
    email: 'Email',
    password: 'Password',
    loggingIn: 'Logging in...',
    logInButton: 'Log In',
    createAccountTitle: 'Create Account',
    name: 'Name',
    phone: 'Phone',
    iAmA: 'I am a:',
    passenger: 'Passenger',
    driver: 'Driver',
    creatingAccount: 'Creating account...',
    createAccountButton: 'Create Account',
    welcome: 'Welcome',
    loggedInAs: "You're logged in as a",
    requestRide: 'Request a Ride',
    viewRequests: 'View Ride Requests',
    walletStats: 'Wallet & Stats',
    tripHistory: 'Trip History',

    requestRideTitle: 'Request a Ride',
    rideType: 'Ride Type',
    shared: 'Shared',
    reserve: 'Reserve (Full Vehicle)',
    vehicle: 'Vehicle',
    cng5: 'CNG (5 seats)',
    auto2: 'Auto (2 seats)',
    pickup: 'Pickup',
    destination: 'Destination',
    peopleTraveling: 'How many people are traveling?',
    seatsNeeded: 'Seats needed',
    maxFor: 'Max',
    requesting: 'Requesting...',
    findRide: 'Find a Ride',
    yourRide: 'Your Ride',
    from: 'From',
    to: 'To',
    type: 'Type',
    seats: 'Seats',
    status: 'Status',
    searching: 'Searching',
    negotiating: 'Negotiating',
    accepted: 'Accepted',
    completed: 'Completed',
    waitingForQuote: 'Waiting for a driver to send a fare quote...',
    driverQuoted: 'Driver quoted',
    accept: 'Accept',
    yourCounterOffer: 'Your counter-offer (৳)',
    sendCounterOffer: 'Send Counter-Offer',
    youOffered: 'You offered',
    waitingForDriverResponse: "Waiting for the driver's response...",
    driversFinalOffer: "Driver's final offer",
    finalOfferNote: "This is the driver's final price — accept it, or cancel and look for another driver.",
    cancelFindAnother: 'Cancel & Find Another Driver',
    confirmedAt: 'Confirmed at',
    fare: 'Fare',

    rateYourTrip: 'Rate Your Trip',
    farePaid: 'Fare paid',
    anyComments: 'Any comments? (optional)',
    submitRating: 'Submit Rating',
    submitting: 'Submitting...',
    skip: 'Skip',
    thanksForFeedback: 'Thanks for your feedback!',
    done: 'Done',

    rideRequestsTitle: 'Ride Requests',
    sendQuoteNote: 'Send a fare quote to claim a request.',
    noRequestsWaiting: 'No requests waiting right now.',
    yourFareQuote: 'Your fare quote (৳)',
    sendQuote: 'Send Quote',
    yourActiveRide: 'Your Active Ride',
    completeTrip: 'Complete Trip',
    completing: 'Completing...',
    confirmCashReceived: 'Confirm cash received: ৳',
    didYouReceive: 'Did you receive ৳',
    inCash: 'in cash from the passenger?',
    yesReceived: 'Yes, I received ৳',
    received: '',
    noGoBack: 'No, go back',
    negotiatingTitle: 'Negotiating',
    youQuoted: 'You quoted',
    waitingForPassengerResponse: "Waiting for the passenger's response...",
    passengerCountered: 'Passenger countered',
    yourFinalOffer: 'Your final offer (৳)',
    sendFinalOffer: 'Send Final Offer',
    notInterestedRelease: 'Not interested — release ride',
    youSentFinalOffer: 'You sent final offer',
    waitingForPassengerDecision: "Waiting for the passenger's decision...",

    walletStatsTitle: 'Wallet & Stats',
    totalEarnings: 'Total Earnings',
    totalTrips: 'Total Trips',
    rating: 'Rating',
    noRatingsYet: 'No ratings yet',
    ratingsCount: 'rating(s)',
    walletNote: "Cash payouts and subscription billing aren't set up yet — this screen shows your real trip and rating stats today.",

    tripHistoryTitle: 'Trip History',
    noCompletedTrips: 'No completed trips yet.',

    notificationsTitle: 'Notifications',
    noNotificationsYet: 'No notifications yet.',

        complaints: 'Complaints',
    fileComplaint: 'File a Complaint',
    category: 'Category',
    catFare: 'Fare Dispute',
    catBehavior: 'Behavior',
    catSafety: 'Safety',
    catNoShow: 'No-show',
    describeIssue: 'Describe the issue',
    submitComplaint: 'Submit Complaint',
    complaintSubmitted: "Your complaint has been submitted. We'll review it.",
    myComplaints: 'My Complaints',
    noComplaintsYet: "You haven't filed any complaints yet.",
    open: 'Open',
    resolved: 'Resolved',
    fileAComplaint: 'File a Complaint',
    selectARide: 'Select a trip',

    loading: 'Loading...',

    notif: {
      quoted: (p) => `A driver quoted ৳${p.amount} for your ride to "${p.destination}".`,
      countered: (p) => `Passenger countered with ৳${p.amount}.`,
      finalOffer: (p) => `Driver's final offer: ৳${p.amount} for your ride.`,
      rideConfirmedForPassenger: (p) => `Your ride is confirmed at ৳${p.amount}!`,
      rideConfirmedForDriver: (p) => `Passenger accepted your ৳${p.amount} offer! Ride confirmed.`,
      cancelled: () => `Passenger cancelled the negotiation. The ride is back in the open pool.`,
      tripComplete: (p) => `Your trip to "${p.destination}" is complete. Fare: ৳${p.amount}.`,
      ratingReceived: (p) => `You received a ${p.stars}-star rating.`,
    },
  },
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('bn')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('gramride_lang')
    if (saved) setLang(saved)
    setMounted(true)
  }, [])

  const toggleLang = () => {
    const next = lang === 'bn' ? 'en' : 'bn'
    setLang(next)
    localStorage.setItem('gramride_lang', next)
  }

  const t = (key) => (translations[lang] && translations[lang][key]) || key

  const tn = (key, params = {}) => {
    const fn = translations[lang] && translations[lang].notif && translations[lang].notif[key]
    return fn ? fn(params) : key
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, tn, mounted }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
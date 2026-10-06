// Icons copied from the Gram Ride prototype. Plain strokes, no icon library. Colour comes from the text colour (currentColor).
const Ic = ({ children, size = 22, className = "", strokeWidth = 2.1 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    className={className}
  >{children}</svg>
);

export const IconHome        = (p) => <Ic {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1v-9"/></Ic>;
export const IconMapPin       = (p) => <Ic {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/></Ic>;
export const IconNavigation   = (p) => <Ic {...p}><path d="M12 2 5 21l7-4.2L19 21 12 2Z"/></Ic>;
export const IconCar          = (p) => <Ic {...p}><path d="M4 16v-3.2a2 2 0 0 1 .5-1.3l1.9-2.3A2 2 0 0 1 8 8.4h8a2 2 0 0 1 1.6.8l1.9 2.3a2 2 0 0 1 .5 1.3V16"/><path d="M4 16h16v2.4a.9.9 0 0 1-.9.9H17a.9.9 0 0 1-.9-.9V17H8v1.4a.9.9 0 0 1-.9.9H4.9a.9.9 0 0 1-.9-.9Z"/><circle cx="7.5" cy="16" r="1.3"/><circle cx="16.5" cy="16" r="1.3"/></Ic>;
export const IconAutoRickshaw = (p) => <Ic {...p}><path d="M6 8.5h9l2.5 5.5H4Z"/><path d="M4 14h14.5"/><path d="M9 8.5V5.5h3.5"/><circle cx="7.5" cy="17" r="1.7"/><circle cx="16" cy="17" r="1.7"/></Ic>;
export const IconWallet       = (p) => <Ic {...p}><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10h17"/><circle cx="16.5" cy="14" r="1.2"/></Ic>;
export const IconUser         = (p) => <Ic {...p}><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c1-3.6 4-5.6 7-5.6s6 2 7 5.6"/></Ic>;
export const IconPhone        = (p) => <Ic {...p}><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></Ic>;
export const IconPhoneCall    = (p) => <Ic {...p}><path d="M6 4.5h3l1.4 3.6-1.9 1.7a10.5 10.5 0 0 0 5.7 5.7l1.7-1.9 3.6 1.4v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4.5 6.1 1.5 1.5 0 0 1 6 4.5Z"/></Ic>;
export const IconStar         = (p) => <Ic {...p}><path d="M12 3.5l2.5 5.2 5.7.7-4.2 4 1.1 5.7L12 16.4l-5.1 2.7 1.1-5.7-4.2-4 5.7-.7Z"/></Ic>;
export const IconSOS          = (p) => <Ic {...p}><path d="M12 3 21 19H3Z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.3" r="0.15" fill="currentColor" stroke="none"/></Ic>;
export const IconPlus         = (p) => <Ic {...p}><path d="M12 5v14M5 12h14"/></Ic>;
export const IconMinus        = (p) => <Ic {...p}><path d="M5 12h14"/></Ic>;
export const IconX            = (p) => <Ic {...p}><path d="M6 6l12 12M18 6 6 18"/></Ic>;
export const IconCheck        = (p) => <Ic {...p}><path d="M5 12.5l4.5 4.5L19.5 7"/></Ic>;
export const IconCheckCircle  = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.2"/></Ic>;
export const IconGlobe        = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z"/></Ic>;
export const IconChevronDown  = (p) => <Ic {...p}><path d="M6 9.5l6 6 6-6"/></Ic>;
export const IconArrowLeft    = (p) => <Ic {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Ic>;
export const IconClock        = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Ic>;
export const IconBanknote     = (p) => <Ic {...p}><rect x="2.5" y="6.5" width="19" height="11" rx="1.8"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v0M18 15v0"/></Ic>;
export const IconPower        = (p) => <Ic {...p}><path d="M12 3.5v7"/><path d="M7 6.2a7.2 7.2 0 1 0 10 0"/></Ic>;
export const IconBell         = (p) => <Ic {...p}><path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 14.5 6 10.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></Ic>;
export const IconVolume2      = (p) => <Ic {...p}><path d="M4 9.3h3.4L12 5.4v13.2L7.4 14.7H4Z"/><path d="M15.8 8.1a5.3 5.3 0 0 1 0 7.8"/><path d="M18.5 5.6a9.2 9.2 0 0 1 0 12.8"/></Ic>;
export const IconHelpCircle   = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M9.4 9.3a2.6 2.6 0 1 1 3.8 2.3c-.9.5-1.2 1-1.2 2"/><path d="M12 17.1v.05"/></Ic>;
export const IconAlertTriangle = (p) => <Ic {...p}><path d="M12 3.5 21 19H3Z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.3" r="0.15" fill="currentColor" stroke="none"/></Ic>;
export const IconMessageSquare = (p) => <Ic {...p}><path d="M4 5.5h16v10.2H9.2L5 19.2v-3.5H4Z"/></Ic>;
export const IconPlayCircle   = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M10 8.6l5.2 3.4-5.2 3.4Z" fill="currentColor" stroke="none"/></Ic>;
export const IconPencil = (p) => <Ic {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></Ic>;
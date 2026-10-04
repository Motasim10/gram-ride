// Icons copied from the admin design file (gram_ride_admin). Plain strokes, no icon library.
const Ic = ({ children, size = 20, className = "", strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);

export const IconGrid        = (p) => <Ic {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.4"/></Ic>;
export const IconUsers        = (p) => <Ic {...p}><circle cx="9" cy="8.3" r="3"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.2 13.2c2 .2 3.6 1.7 4.3 4.3"/></Ic>;
export const IconUser         = (p) => <Ic {...p}><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c1-3.6 4-5.6 7-5.6s6 2 7 5.6"/></Ic>;
export const IconCar          = (p) => <Ic {...p}><path d="M4 16v-3.2a2 2 0 0 1 .5-1.3l1.9-2.3A2 2 0 0 1 8 8.4h8a2 2 0 0 1 1.6.8l1.9 2.3a2 2 0 0 1 .5 1.3V16"/><path d="M4 16h16v2.4a.9.9 0 0 1-.9.9H17a.9.9 0 0 1-.9-.9V17H8v1.4a.9.9 0 0 1-.9.9H4.9a.9.9 0 0 1-.9-.9Z"/><circle cx="7.5" cy="16" r="1.3"/><circle cx="16.5" cy="16" r="1.3"/></Ic>;
export const IconAutoRickshaw = (p) => <Ic {...p}><path d="M6 8.5h9l2.5 5.5H4Z"/><path d="M4 14h14.5"/><path d="M9 8.5V5.5h3.5"/><circle cx="7.5" cy="17" r="1.7"/><circle cx="16" cy="17" r="1.7"/></Ic>;
export const IconAlertTriangle= (p) => <Ic {...p}><path d="M12 3.5 21 19H3Z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.3" r="0.15" fill="currentColor" stroke="none"/></Ic>;
export const IconWallet       = (p) => <Ic {...p}><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10h17"/><circle cx="16.5" cy="14" r="1.2"/></Ic>;
export const IconBarChart     = (p) => <Ic {...p}><path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2.5 20h19"/></Ic>;
export const IconTag          = (p) => <Ic {...p}><path d="M11.5 3.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-.3.7l-9 9a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4l9-9a1 1 0 0 1 .7-.3Z"/><circle cx="15.5" cy="7.5" r="1.4"/></Ic>;
export const IconSearch       = (p) => <Ic {...p}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5 15 15"/></Ic>;
export const IconBell         = (p) => <Ic {...p}><path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 14.5 6 10.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></Ic>;
export const IconLogOut       = (p) => <Ic {...p}><path d="M9 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H9"/><path d="M14.5 16.5 19 12l-4.5-4.5"/><path d="M19 12H9"/></Ic>;
export const IconCheck        = (p) => <Ic {...p}><path d="M5 12.5l4.5 4.5L19.5 7"/></Ic>;
export const IconX            = (p) => <Ic {...p}><path d="M6 6l12 12M18 6 6 18"/></Ic>;
export const IconStar         = (p) => <Ic {...p}><path d="M12 3.5l2.5 5.2 5.7.7-4.2 4 1.1 5.7L12 16.4l-5.1 2.7 1.1-5.7-4.2-4 5.7-.7Z"/></Ic>;
export const IconMapPin       = (p) => <Ic {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/></Ic>;
export const IconClock        = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Ic>;
export const IconChevronDown  = (p) => <Ic {...p}><path d="M6 9.5l6 6 6-6"/></Ic>;
export const IconTrendingUp   = (p) => <Ic {...p}><path d="M3.5 17 10 10.5l4 4 6.5-7.5"/><path d="M15.5 6.5H20.5V11.5"/></Ic>;
export const IconFileText     = (p) => <Ic {...p}><path d="M7 3.5h7l3.5 3.5V20.5H7Z"/><path d="M14 3.5V7h3.5"/><path d="M9.5 12.5h5M9.5 16h5"/></Ic>;
export const IconShieldCheck  = (p) => <Ic {...p}><path d="M12 3.5 19 6.5v5c0 5-3 7.8-7 9-4-1.2-7-4-7-9v-5Z"/><path d="M9 12l2 2 4-4.3"/></Ic>;
export const IconMenu = (p) => <Ic {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Ic>;
export const IconChevronRight = (p) => <Ic {...p}><path d="M9.5 6l6 6-6 6"/></Ic>;
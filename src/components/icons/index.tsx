import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: P, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

export const IconToday = (p: P) => base(p, <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>);
export const IconCalendar = (p: P) => base(p, <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" /></>);
export const IconCapture = (p: P) => base(p, <><path d="M12 5v14M5 12h14" strokeWidth={2.2} /></>);
export const IconMoney = (p: P) => base(p, <><rect x="2.5" y="6" width="19" height="12" rx="3" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5h.01M18 14.5h.01" /></>);
export const IconMemory = (p: P) => base(p, <><path d="M9 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H9Z" /><path d="M9 9h6M9 12.5h6M9 16h3" /></>);
export const IconInbox = (p: P) => base(p, <><path d="M4 13V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" /><path d="M4 13h4l1.5 2.5h5L16 13h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z" /></>);
export const IconSavings = (p: P) => base(p, <><path d="M6 8.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" /><path d="M8 8.5V7a4 4 0 0 1 8 0v1.5M10 4.5h4" /><path d="M9 15h6" /></>);
export const IconHabits = (p: P) => base(p, <><path d="M4 12.5 9 17.5 20 6.5" /><path d="M4 7h5M4 17h2" strokeOpacity={0.5} /></>);
export const IconVault = (p: P) => base(p, <><rect x="3.5" y="4" width="17" height="16" rx="3" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5v1.5M12 14v1.5M8.5 12H10M14 12h1.5" /></>);
export const IconInsights = (p: P) => base(p, <><path d="M4 19h16" /><path d="M6 15l4-5 3 3 5-7" /><circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none" /></>);
export const IconSettings = (p: P) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" /></>);
export const IconCheck = (p: P) => base(p, <path d="M5 12.5 10 17.5 19 7.5" />);
export const IconClose = (p: P) => base(p, <path d="M6 6l12 12M18 6 6 18" />);
export const IconClock = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IconBell = (p: P) => base(p, <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconMic = (p: P) => base(p, <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" /></>);
export const IconCamera = (p: P) => base(p, <><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4v-10Z" /><circle cx="12" cy="13" r="3" /></>);
export const IconLink = (p: P) => base(p, <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconSearch = (p: P) => base(p, <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>);
export const IconArrowRight = (p: P) => base(p, <><path d="M5 12h14M13 6l6 6-6 6" /></>);
export const IconChevronLeft = (p: P) => base(p, <path d="M15 5l-7 7 7 7" />);
export const IconChevronRight = (p: P) => base(p, <path d="M9 5l7 7-7 7" />);
export const IconPin = (p: P) => base(p, <><path d="M9 4h6l-.8 5.2L17 12v1.5H7V12l2.8-2.8L9 4Z" /><path d="M12 13.5V21" /></>);
export const IconTrash = (p: P) => base(p, <><path d="M5 7h14M9 7V5h6v2M8 7l.8 12h6.4L16 7" /></>);
export const IconEdit = (p: P) => base(p, <><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="M12.5 7.5l4 4" /></>);
export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IconSun = (p: P) => base(p, <><circle cx="12" cy="12" r="3.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>);
export const IconMoon = (p: P) => base(p, <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />);
export const IconRefresh = (p: P) => base(p, <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>);
export const IconCloud = (p: P) => base(p, <path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7Z" />);
export const IconCloudOff = (p: P) => base(p, <><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 16 7.5M18 10a4.5 4.5 0 0 1 1.5 8.7" /><path d="M3 3l18 18" /></>);
export const IconDownload = (p: P) => base(p, <><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>);
export const IconUpload = (p: P) => base(p, <><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></>);
export const IconFile = (p: P) => base(p, <><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v4h4" /></>);
export const IconTag = (p: P) => base(p, <><path d="M4 12V5h7l9 9-7 7-9-9Z" /><circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none" /></>);
export const IconPill = (p: P) => base(p, <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" /><path d="M9 9l6 6" /></>);
export const IconDrop = (p: P) => base(p, <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />);
export const IconRun = (p: P) => base(p, <><circle cx="15" cy="5" r="1.6" /><path d="M6 21l4-6 3 2 1-4-3-2 2-3 3 2 3-1" /><path d="M9 10 7 13H4" /></>);
export const IconSleep = (p: P) => base(p, <><path d="M17 15.5A7 7 0 0 1 8.5 7a7 7 0 1 0 8.5 8.5Z" /><path d="M16 3h4l-4 4h4" /></>);
export const IconHeart = (p: P) => base(p, <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />);
export const IconFlag = (p: P) => base(p, <><path d="M6 21V4" /><path d="M6 4h11l-2 4 2 4H6" /></>);
export const IconRepeat = (p: P) => base(p, <><path d="M4 10a5 5 0 0 1 5-5h9" /><path d="M15 2l3 3-3 3" /><path d="M20 14a5 5 0 0 1-5 5H6" /><path d="M9 22l-3-3 3-3" /></>);
export const IconWarning = (p: P) => base(p, <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17h.01" /></>);
export const IconInfo = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>);
export const IconSkip = (p: P) => base(p, <><path d="M6 6l8 6-8 6V6Z" /><path d="M18 6v12" /></>);
export const IconMenu = (p: P) => base(p, <path d="M4 7h16M4 12h16M4 17h16" />);
export const IconSpark = (p: P) => base(p, <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM5 17l.7 2 2 .7-2 .7L5 22l-.7-1.6-2-.7 2-.7L5 17Z" />);
export const IconShield = (p: P) => base(p, <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" /></>);
export const IconLogout = (p: P) => base(p, <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4M18 12H9" /></>);
export const IconCompass = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" fillOpacity={0.25} /></>);
export const IconWallet = IconMoney;
export const IconBasket = (p: P) => base(p, <><path d="M3.5 10h17l-1.5 9h-14l-1.5-9Z" /><path d="M8 10l3-6M16 10l-3-6M9.5 14v2M14.5 14v2" /></>);
export const IconInstall = (p: P) => base(p, <><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" /><path d="M10 18h4" /></>);

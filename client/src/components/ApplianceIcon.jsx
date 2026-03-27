function IconWrapper({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function ApplianceIcon({ type }) {
  switch (type) {
    case "fan":
      return (
        <IconWrapper>
          <circle cx="12" cy="12" r="2.1" />
          <path d="M12 3.6c2.4 0 3.8 2.9 2.4 5l-1 1.4" />
          <path d="M19.1 10.5c1.1 2.1-.7 4.7-3 4.6l-1.8-.1" />
          <path d="M8.1 18.6c-2.2 1-4.7-1-4.4-3.3l.2-1.7" />
        </IconWrapper>
      );
    case "ac":
      return (
        <IconWrapper>
          <rect x="4" y="6" width="16" height="6" rx="2" />
          <path d="M7 15v1" />
          <path d="M12 15v3" />
          <path d="M17 15v1" />
          <path d="M9 18c0 1-.8 1.6-1.5 2" />
          <path d="M15 18c0 1 .8 1.6 1.5 2" />
        </IconWrapper>
      );
    case "light":
      return (
        <IconWrapper>
          <path d="M8.2 10.4a3.8 3.8 0 1 1 7.6 0c0 1.6-.8 2.4-1.7 3.3-.6.6-.9 1.3-1 2H11c-.1-.7-.4-1.4-1-2-.9-.9-1.8-1.7-1.8-3.3Z" />
          <path d="M10 18h4" />
          <path d="M10.6 20.2h2.8" />
        </IconWrapper>
      );
    case "tv":
      return (
        <IconWrapper>
          <rect x="4" y="6" width="16" height="10" rx="2" />
          <path d="M10 20h4" />
          <path d="M12 16v4" />
        </IconWrapper>
      );
    case "fridge":
      return (
        <IconWrapper>
          <rect x="7" y="4" width="10" height="16" rx="2" />
          <path d="M9.5 8h5" />
          <path d="M12 11v2" />
          <path d="M12 17h.01" />
        </IconWrapper>
      );
    case "water-heater":
      return (
        <IconWrapper>
          <rect x="7" y="4" width="10" height="14" rx="3" />
          <path d="M12 8v6" />
          <path d="M10 11h4" />
          <path d="M9 20h6" />
          <path d="M18.5 9.2c1.1 1.1 1.1 2.8 0 3.9" />
        </IconWrapper>
      );
    case "projector":
      return (
        <IconWrapper>
          <rect x="5" y="8" width="14" height="8" rx="2" />
          <circle cx="15.5" cy="12" r="1.8" />
          <path d="M9 16v3" />
          <path d="M15 16v3" />
        </IconWrapper>
      );
    case "computer":
      return (
        <IconWrapper>
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M9 20h6" />
          <path d="M12 16v4" />
        </IconWrapper>
      );
    case "lab-equipment":
      return (
        <IconWrapper>
          <path d="M10 4v4l-3.5 6.2A2.8 2.8 0 0 0 8.9 19h6.2a2.8 2.8 0 0 0 2.4-4.2L14 8V4" />
          <path d="M9 12h6" />
        </IconWrapper>
      );
    case "motor":
      return (
        <IconWrapper>
          <rect x="5" y="8" width="11" height="8" rx="2" />
          <path d="M16 10h3l1 2-1 2h-3" />
          <path d="M8 18v2" />
          <path d="M13 18v2" />
        </IconWrapper>
      );
    case "conveyor":
      return (
        <IconWrapper>
          <path d="M5 10h14" />
          <path d="M7 10v4" />
          <path d="M17 10v4" />
          <circle cx="8" cy="17" r="2" />
          <circle cx="16" cy="17" r="2" />
        </IconWrapper>
      );
    case "cnc":
      return (
        <IconWrapper>
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 9h6" />
          <path d="M12 9v6" />
          <path d="M9 15h6" />
        </IconWrapper>
      );
    case "compressor":
      return (
        <IconWrapper>
          <rect x="5" y="7" width="14" height="10" rx="2" />
          <circle cx="9" cy="12" r="2" />
          <path d="M15 10h2" />
          <path d="M15 14h3" />
        </IconWrapper>
      );
    case "pump":
      return (
        <IconWrapper>
          <circle cx="10" cy="12" r="3" />
          <path d="M13 12h6" />
          <path d="M10 9V5" />
          <path d="M7 12H5" />
        </IconWrapper>
      );
    case "hvac":
      return (
        <IconWrapper>
          <rect x="4" y="6" width="16" height="7" rx="2" />
          <path d="M7 17c0 1-.7 1.7-1.5 2.3" />
          <path d="M12 17c0 1-.7 1.7-1.5 2.3" />
          <path d="M17 17c0 1-.7 1.7-1.5 2.3" />
        </IconWrapper>
      );
    case "server":
      return (
        <IconWrapper>
          <rect x="6" y="4" width="12" height="6" rx="1.8" />
          <rect x="6" y="14" width="12" height="6" rx="1.8" />
          <path d="M9 7h.01" />
          <path d="M9 17h.01" />
          <path d="M12 7h4" />
          <path d="M12 17h4" />
        </IconWrapper>
      );
    case "router":
      return (
        <IconWrapper>
          <rect x="5" y="12" width="14" height="6" rx="2" />
          <path d="M9 12V9" />
          <path d="M15 12V9" />
          <path d="M8 8c1-.9 2.3-1.4 4-1.4S15 7.1 16 8" />
        </IconWrapper>
      );
    case "generator":
      return (
        <IconWrapper>
          <rect x="4" y="8" width="14" height="9" rx="2" />
          <path d="M18 11h2" />
          <path d="M7 17v2" />
          <path d="M15 17v2" />
          <path d="M9 12h3" />
          <path d="M10.5 10.5v3" />
        </IconWrapper>
      );
    case "smart-plug":
      return (
        <IconWrapper>
          <rect x="8" y="6" width="8" height="12" rx="2" />
          <path d="M10 4v3" />
          <path d="M14 4v3" />
          <path d="M12 12h.01" />
        </IconWrapper>
      );
    default:
      return (
        <IconWrapper>
          <rect x="7" y="4" width="10" height="16" rx="2" />
          <path d="M9.5 8h5" />
          <path d="M12 17h.01" />
        </IconWrapper>
      );
  }
}

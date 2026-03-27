function IconWrapper({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function ApplianceIcon({ type }) {
  if (type === "fan") {
    return (
      <IconWrapper>
        <circle cx="12" cy="12" r="2.1" />
        <path d="M12 3.6c2.4 0 3.8 2.9 2.4 5l-1 1.4" />
        <path d="M19.1 10.5c1.1 2.1-.7 4.7-3 4.6l-1.8-.1" />
        <path d="M8.1 18.6c-2.2 1-4.7-1-4.4-3.3l.2-1.7" />
      </IconWrapper>
    );
  }

  if (type === "ac") {
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
  }

  if (type === "light") {
    return (
      <IconWrapper>
        <path d="M8.2 10.4a3.8 3.8 0 1 1 7.6 0c0 1.6-.8 2.4-1.7 3.3-.6.6-.9 1.3-1 2H11c-.1-.7-.4-1.4-1-2-.9-.9-1.8-1.7-1.8-3.3Z" />
        <path d="M10 18h4" />
        <path d="M10.6 20.2h2.8" />
      </IconWrapper>
    );
  }

  if (type === "tv") {
    return (
      <IconWrapper>
        <rect x="4" y="6" width="16" height="10" rx="2" />
        <path d="M10 20h4" />
        <path d="M12 16v4" />
      </IconWrapper>
    );
  }

  if (type === "water-heater") {
    return (
      <IconWrapper>
        <rect x="7" y="4" width="10" height="14" rx="3" />
        <path d="M12 8v6" />
        <path d="M10 11h4" />
        <path d="M9 20h6" />
        <path d="M18.5 9.2c1.1 1.1 1.1 2.8 0 3.9" />
      </IconWrapper>
    );
  }

  return (
    <IconWrapper>
      <rect x="7" y="4" width="10" height="16" rx="2" />
      <path d="M9.5 8h5" />
      <path d="M12 17h.01" />
    </IconWrapper>
  );
}
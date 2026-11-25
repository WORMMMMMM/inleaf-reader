import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 15,
  className,
  children
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `icon ${className}` : 'icon'}
    >
      {children}
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return <Svg {...props}><path d="M10 3.5L5.5 8 10 12.5" /></Svg>;
}

export function IconChevronRight(props: IconProps) {
  return <Svg {...props}><path d="M6 3.5L10.5 8 6 12.5" /></Svg>;
}

export function IconChevronDown(props: IconProps) {
  return <Svg {...props}><path d="M3.5 6L8 10.5 12.5 6" /></Svg>;
}

export function IconChevronUp(props: IconProps) {
  return <Svg {...props}><path d="M3.5 10L8 5.5 12.5 10" /></Svg>;
}

export function IconMinus(props: IconProps) {
  return <Svg {...props}><path d="M3.5 8h9" /></Svg>;
}

export function IconPlus(props: IconProps) {
  return <Svg {...props}><path d="M8 3.5v9M3.5 8h9" /></Svg>;
}

export function IconFitWidth(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 3.5v9M14 3.5v9M5 8h6M6.5 6L4.5 8l2 2M9.5 6l2 2-2 2" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </Svg>
  );
}

export function IconListTree(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h10M3 8h7M3 12h8.5" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M12.4 3.6l-1.05 1.05M4.65 11.35L3.6 12.4" />
    </Svg>
  );
}

export function IconWarmPaper(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 3.5h4.2c1 0 1.3.5 1.3 1.3v8.2c0-.6-.5-1-1.3-1H2.5V3.5z" />
      <path d="M13.5 3.5H9.3c-1 0-1.3.5-1.3 1.3v8.2c0-.6.5-1 1.3-1h4.2V3.5z" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.2 9.8A5.4 5.4 0 0 1 6.2 2.8a5.5 5.5 0 1 0 7 7z" />
    </Svg>
  );
}

export function IconPanelRight(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.8" />
      <path d="M10 2.5v11" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.75 3.75l1 1M11.25 11.25l1 1M12.25 3.75l-1 1M4.75 11.25l-1 1" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return <Svg {...props}><path d="M4 4l8 8M12 4l-8 8" /></Svg>;
}

export function IconUnderline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 3v4.5a3.5 3.5 0 0 0 7 0V3M3.5 13h9" />
    </Svg>
  );
}

export function IconHighlighter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 2.5l4 4-6.5 6.5H3v-4l6.5-6.5zM2.5 14h11" />
    </Svg>
  );
}

export function IconNote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 2.5h10v8l-3 3H3v-11z" />
      <path d="M10 10.5v3h3M5.5 6h5M5.5 8.5h3.5" />
    </Svg>
  );
}

export function IconTranslate(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 4h6M5.5 2.5V4M7.2 4c-.5 2.4-2 4.3-4.2 5.4M4 5.8c.7 1.3 1.7 2.4 3 3.2" />
      <path d="M9 13.5l2.3-6 2.2 6M9.7 11.5h3.1" />
    </Svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2l1.2 3.6L12.8 6.8 9.2 8 8 11.6 6.8 8 3.2 6.8l3.6-1.2L8 2z" />
      <path d="M12.8 11l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4z" />
    </Svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.8 2.8l2.4 2.4-7.4 7.4-3 .6.6-3 7.4-7.4z" />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
      <path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 4.5h10.4M6 4.5V3h4v1.5M4.3 4.5l.6 8.5a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.6-8.5" />
    </Svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 3.5h11l-4.2 5v4l-2.6-1.3V8.5l-4.2-5z" />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2.5v7.5M5 7.5L8 10.5l3-3M3 13h10" />
    </Svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 5H10a3.5 3.5 0 1 1 0 7H6.5M5.5 5L3 7.5 5.5 10" />
    </Svg>
  );
}

export function IconArea(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 5.5V3h2.5M10.5 3H13v2.5M13 10.5V13h-2.5M5.5 13H3v-2.5" />
    </Svg>
  );
}

export function IconJump(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 9.5l6.5-6.5M9 3h4v4M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" />
    </Svg>
  );
}

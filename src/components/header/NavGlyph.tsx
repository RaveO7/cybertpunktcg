import { SettingsIcon } from "./SettingsIcon";
import type { NavIcon } from "./use-navigation";

export function NavGlyph({ icon }: { icon: NavIcon }) {
  const common = {
    "aria-hidden": true,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
  } as const;
  switch (icon) {
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <path d="M8 3.5h11v15H8z" />
          <path d="M5 6.5v14h11" />
        </svg>
      );
    case "investment":
      return (
        <svg {...common}>
          <path d="M3.5 20.5h17" />
          <path d="m4.5 15.5 5-5 4 3.5 6-7" />
          <path d="M15.5 7h4v4" />
        </svg>
      );
    case "decks":
      return (
        <svg {...common}>
          <path d="M9 6.5h10v14H9z" />
          <path d="M6.5 4.5h10M4.5 8v12.5" />
        </svg>
      );
    case "tournaments":
      return (
        <svg {...common}>
          <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
          <path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.8 10.5M16.5 6h3v1.5a3 3 0 0 1-3.3 3" />
          <path d="M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z" />
        </svg>
      );
    case "wishlist":
      return (
        <svg {...common}>
          <path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
        </svg>
      );
    case "howto":
      return (
        <svg {...common}>
          <path d="M4 5.5c3-1.5 5.5-1.5 8 0v14c-2.5-1.5-5-1.5-8 0z" />
          <path d="M12 5.5c2.5-1.5 5-1.5 8 0v14c-3-1.5-5.5-1.5-8 0" />
        </svg>
      );
    case "binder":
      return (
        <svg {...common}>
          <path d="M5 3.5h13v17H5z" />
          <path d="M8.5 3.5v17M11.5 8h4M11.5 11.5h4" />
        </svg>
      );
    case "settings":
      return <SettingsIcon size={22} />;
  }
}

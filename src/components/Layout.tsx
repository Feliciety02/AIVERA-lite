import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { Menu, X } from "lucide-react";
import { Logo } from "./ui";

const LINKS = [
  { to: "/", label: "Scan" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/findings", label: "Findings" },
  { to: "/reports", label: "Reports" },
  { to: "/activity", label: "Activity" },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) => `rounded-full px-3 py-1.5 text-sm ${isActive ? "bg-primary-soft font-medium text-primary" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-medium tracking-wide">AIVERA <span className="font-normal text-slate-500">Lite</span></span>
          </NavLink>
          <nav className="ml-auto hidden gap-1 md:flex">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass}>{l.label}</NavLink>)}
          </nav>
          <button className="ml-auto rounded-full p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass}>{l.label}</NavLink>)}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}


'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Code2,
  GraduationCap,
  History,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Stethoscope,
  X,
  LogIn,
  UserPlus,
} from 'lucide-react';

import Logo from './Logo';
import InstallButton from './InstallButton';
import { createClient } from '@/lib/supabase-browser';

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/coding', label: 'Coding', icon: Code2 },
  { href: '/medicine', label: 'Medicine', icon: Stethoscope },
  { href: '/learning', label: 'Learning', icon: GraduationCap },
  { href: '/history', label: 'Chat history', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Shell({
  children,
  name,
  email,
  isAdmin,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  isAdmin: boolean;
}) {
  const path = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Detect guest users
  const isGuest = !email || email === 'Not signed in';

  // Guests only access public AI sections
  const visibleNav = isGuest
    ? NAV.filter((item) =>
        ['/', '/coding', '/medicine', '/learning'].includes(item.href)
      )
    : NAV;

  // Only authenticated administrators see Admin
  const items = !isGuest && isAdmin
    ? [...visibleNav, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : visibleNav;

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const nav = (
    <nav
      className="flex flex-1 flex-col gap-1 p-3"
      aria-label="Main"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/' ? path === '/' : path.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
              active
                ? 'bg-saffron-soft text-saffron'
                : 'text-mute hover:bg-ink-700 hover:text-paper'
            }`}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  // Guest and authenticated profile sections
  const profile = (
    <div className="border-t border-ink-700 p-3">

      {isGuest ? (
        // GUEST: Never display Logout or account information
        <div className="space-y-2">

          <Link
            href="/login"
            title="Log in"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-saffron px-3 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            <LogIn size={18} />
            {!collapsed && <span>Log in</span>}
          </Link>


        </div>
      ) : (
        // LOGGED-IN USER: Display profile and Logout
        <>
          <div className="flex items-center gap-3 px-1 pb-2">

            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-600 text-sm font-semibold">
              {name?.slice(0, 1).toUpperCase() || 'U'}
            </span>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm">{name}</p>
                <p className="truncate text-xs text-mute">{email}</p>
              </div>
            )}

          </div>

          <button
            onClick={logout}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-mute transition-colors hover:bg-ink-700 hover:text-paper"
          >
            <LogOut size={18} />
            {!collapsed && <span>Log out</span>}
          </button>
        </>
      )}

    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside
        className={`hidden flex-col border-r border-ink-700 bg-ink-900 transition-[width] md:flex ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex h-16 items-center border-b border-ink-700 px-4">
          <Link href="/">
            <Logo withName={!collapsed} />
          </Link>
        </div>

        {nav}
        {profile}
      </aside>

      {/* MOBILE OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* MOBILE SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-ink-900 transition-transform md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-700 px-4">
          <Logo />

          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="p-2"
          >
            <X size={20} />
          </button>
        </div>

        {nav}
        {profile}
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-900/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-5">

          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="p-2 md:hidden"
          >
            <Menu size={22} />
          </button>

          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
            className="hidden p-2 text-mute hover:text-paper md:block"
          >
            {collapsed
              ? <PanelLeftOpen size={20} />
              : <PanelLeftClose size={20} />
            }
          </button>

          <span className="md:hidden">
            <Logo size={28} />
          </span>

          {/* RIGHT HEADER ACTIONS */}
          <div className="ml-auto flex items-center gap-2">

            <InstallButton />

            {isGuest ? (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm text-paper transition-colors hover:bg-ink-700"
                >
                  Log in
                </Link>

                <Link
                  href="/login"
                  className="rounded-xl bg-saffron px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <span className="hidden max-w-[180px] truncate text-sm text-mute sm:block">
                {name}
              </span>
            )}

          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}

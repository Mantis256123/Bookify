"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Library", href: "/" },
  { label: "Add New", href: "/books/new" },
  { label: "Extract Text", href: "/extract-text" },
];

const Navbar = () => {
  const pathName = usePathname();
  const { user } = useUser();
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <header className="w-full fixed z-50 bg-(--bg-primary)">
      <div className="wrapper navbar-height py-4 flex justify-between items-center">
        <Link href="/" className="flex gap-0.5 items-center">
          <Image src="/assets/logo.png" alt="Bookify" width={42} height={26} />
          <span className="logo-text">Bookify</span>
        </Link>

        <nav className="flex w-fit items-center gap-7.5">
          {navItems.map((item) => {
            const isActive =
              pathName === item.href ||
              (item.href !== "/" && pathName.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "nav-link-base",
                  isActive ? "nav-link-active" : "text-black hover:opacity-70",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {isMounted && (
            <div className="flex gap-7.5 items-center">
              <Show when="signed-out">
                <div className="ml-2 flex items-center gap-4">
                  <SignInButton mode="modal">
                    <button type="button" className="nav-btn">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="btn-primary px-4 py-2 text-sm cursor-pointer"
                    >
                      Sign up
                    </button>
                  </SignUpButton>
                </div>
              </Show>
              <Show when="signed-in">
                <div className="nav-user-link">
                  <UserButton />
                  {user?.firstName && (
                    <Link href="/subscriptions" className="nav-user-name">
                      {user.firstName}
                    </Link>
                  )}
                </div>
              </Show>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;

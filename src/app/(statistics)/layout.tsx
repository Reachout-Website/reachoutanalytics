import React from "react";
import { SignOutButton } from "../(main)/components/SignOutButton";

export default function StatisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="absolute right-4 top-4 z-10">
        <SignOutButton />
      </div>
      {children}
    </>
  );
}

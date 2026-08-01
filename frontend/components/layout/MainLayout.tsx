"use client";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-950 text-white">

      <Sidebar />

      <div className="flex flex-col flex-1">

        <Navbar />

        <main className="flex-1 overflow-y-auto p-6">

          {children}

        </main>

      </div>

    </div>
  );
}
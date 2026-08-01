"use client";

import {
  LayoutDashboard,
  Trophy,
  Users,
  History,
  Settings,
} from "lucide-react";

const menu = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Live Match",
    icon: Trophy,
  },
  {
    name: "Players",
    icon: Users,
  },
  {
    name: "History",
    icon: History,
  },
  {
    name: "Settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800">

      <div className="p-6">

        <h1 className="text-2xl font-bold text-green-400">

          🏏 Cricket Scorebook

        </h1>

      </div>

      <nav className="px-3">

        {menu.map((item) => {

          const Icon = item.icon;

          return (

            <button
              key={item.name}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2 hover:bg-slate-800 transition"
            >

              <Icon size={20} />

              {item.name}

            </button>

          );

        })}

      </nav>

    </aside>
  );
}
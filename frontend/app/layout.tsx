import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "Cricket Scorebook",
  description: "Weekend Cricket Scorebook",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070912] text-white antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

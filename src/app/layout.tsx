import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Globalworking · Cuadro de Mando",
  description: "Cuadro de mando de indicadores clave — Globalworking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex h-full text-stone-900" style={{ background: '#f5f1ea' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto lg:pl-0">
          <div className="w-full max-w-[1600px] mx-auto px-4 py-6 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}

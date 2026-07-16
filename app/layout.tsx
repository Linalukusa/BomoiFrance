import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOMOI Mediation Hub",
  description: "Sensibilisation au don du sang, en partenariat avec l'EFS Occitanie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

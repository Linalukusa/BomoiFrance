import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOMOI Mediation Hub",
  description: "Sensibilisation au don du sang, en partenariat avec l'EFS Occitanie",
};

export const viewport: Viewport = {
  // La maquette est conçue en clair uniquement : sans ceci, Safari/Chrome
  // appliquent leur propre thème sombre aux contrôles de formulaire natifs
  // (et parfois au fond de page) quand l'appareil est en mode sombre.
  colorScheme: "light",
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

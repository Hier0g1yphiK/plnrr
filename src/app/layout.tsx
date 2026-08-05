import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito, Inter } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "plnrr",
  description: "Stream prep productivity tools",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem("plnrr:theme");
    var valid = ["fairy-light","fairy-dark","circuit-light","circuit-dark"];
    if (valid.indexOf(theme) === -1) {
      // Migrate old values
      if (theme === "light") theme = "fairy-light";
      else theme = "fairy-dark";
    }
    document.documentElement.classList.add(theme);
    if (theme.indexOf("-dark") !== -1) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}

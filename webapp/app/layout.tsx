import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Command Center - IoT Agent",
  description: "Action-oriented interface for IoT device agents",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Suppress MetaMask phishing detection errors (known issue) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args[0]?.toString() || '';
                  // Filter out MetaMask phishing detection errors
                  if (
                    message.includes('eth-phishing-detect') ||
                    message.includes('Cannot read properties of undefined') ||
                    message.includes('whitelist')
                  ) {
                    return; // Suppress this error
                  }
                  originalError.apply(console, args);
                };
              }
            `,
          }}
        />
      </head>
      <body className={inter.variable}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}


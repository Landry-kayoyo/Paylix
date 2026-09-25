import type { Metadata } from "next";
import "./globals.css";
import { HashRedirect } from "@/components/auth/hash-redirect";

export const viewport = { themeColor: '#0d9488', width: 'device-width', initialScale: 1 };
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  title: "Paylix - Gestion Financière Scolaire",
  description: "Plateforme de gestion financière pour établissements scolaires",
  applicationName: "Paylix",
  icons: [
    { rel: 'icon', url: '/icon-192.png' },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
  ],
};

// Inline script that runs SYNCHRONOUSLY before React hydration.
// Catches #access_token hash from Supabase invite/recovery links
// and immediately redirects to /update-password before any server
// component redirect can strip the hash fragment.
const HASH_REDIRECT_SCRIPT = `
(function(){
  try {
    var h = window.location.hash;
    if (!h) return;
    var p = new URLSearchParams(h.substring(1));
    if (window.location.pathname !== '/update-password' && p.has('access_token') && (p.get('type') === 'invite' || p.get('type') === 'recovery')) {
      window.location.replace('/update-password' + h);
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className="h-full antialiased font-sans"
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Paylix" />
        <meta name="theme-color" content="#0d9488" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Synchronous hash detector — runs before React, preserves auth token */}
        <script dangerouslySetInnerHTML={{ __html: HASH_REDIRECT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <HashRedirect />
        {children}
      </body>
    </html>
  );
}

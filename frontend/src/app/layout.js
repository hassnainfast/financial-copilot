import './globals.css';

export const metadata = {
  title: 'Hisaab - حساب | Your Business Companion',
  description: 'AI-powered financial assistant for shopkeepers. Record transactions via voice, photo, or manual entry in Urdu.',
  keywords: 'financial copilot, shopkeeper, urdu, hisaab, حساب, transactions, inventory',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <meta name="theme-color" content="#0b1326" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}

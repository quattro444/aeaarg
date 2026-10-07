import './globals.css'
import Navbar from './components/Navbar'
export const metadata = { title: 'Pistoia Ping Pong' }
export default function RootLayout({ children }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var v=localStorage.getItem('ppp-theme')||'auto';var d=v==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light':(v==='notte'?'dark':'light');document.documentElement.setAttribute('data-theme',d)}catch(e){}})()` }} />
      </head>
      <body>
        <Navbar />
        <div className="wrap">{children}</div>
      </body>
    </html>
  )
}

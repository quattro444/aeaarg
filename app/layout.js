import './globals.css'
import Navbar from './components/Navbar'
export const metadata = { title: 'Pistoia Ping Pong' }
export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>
        <Navbar />
        <div className="wrap">{children}</div>
      </body>
    </html>
  )
}

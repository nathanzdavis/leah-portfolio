import './globals.css';

export const metadata = { title: 'Leah Mosier', description: 'Cellist, percussionist, and composer' };

export default function RootLayout({ children }) {
  return <html lang="en"><head>
    <link rel="icon" href="/new_favicon.ico" />
    <link rel="stylesheet" href="/static/css/screen.min.css" />
    <link rel="stylesheet" href="/static/css/custom.min.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Slab%7CAguafina+Script%7CAlbert+Sans%7CAboreto&display=swap" />
  </head><body>{children}</body></html>;
}

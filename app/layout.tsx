import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Austin FC Fan Assistant', description: 'Your guide to Austin FC and a great day at Q2 Stadium.' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }

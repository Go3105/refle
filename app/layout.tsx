import './styles/global.css';
import { inter } from './styles/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: {
        template: '%s | Acme Dashboard',
        default: 'Acme Dashboard',
    },
    description: 'The official Next.js Learn Dashboard built with App Router.',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body
                className={`${inter.className} antialiased`}
                style={{ overscrollBehaviorX: "auto" }}
            >
                {children}
            </body>
        </html>
    );
}

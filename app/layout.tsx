import './styles/global.css';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ConversationProvider } from './context/ConversationContext';
import { SessionProvider } from 'next-auth/react';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    preload: false,
});


export const metadata: Metadata = {
    title: {
        template: '%s | Acme Dashboard',
        default: 'Acme Dashboard',
    },
    description: 'The official Next.js Learn Dashboard built with App Router.',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body
                className={`${inter.className} antialiased`}
                style={{ overscrollBehaviorX: "auto" }}
            >
                <SessionProvider>
                    <ConversationProvider>
                        {children}
                    </ConversationProvider>
                </SessionProvider>
            </body>
        </html>
    );
}

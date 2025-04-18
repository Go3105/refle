import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        authorized({ auth, request }) {
            try {
                if (!auth) {
                    return false;
                }
                return true;
            } catch (error) {
                console.error(error);
            }
        },
    },
});

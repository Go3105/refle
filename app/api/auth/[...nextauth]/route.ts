import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// NextAuthの設定
const authOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        }),
    ],
    // 必要に応じてコールバックやセッション設定
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 
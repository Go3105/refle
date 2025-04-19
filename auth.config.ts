// import GoogleProvider from 'next-auth/providers/google';

// export const authConfig = {
//     secret: process.env.NEXTAUTH_SECRET,
//     pages: {
//         signIn: '/login',
//     },
//     callbacks: {
//         authorized({ auth, request: { nextUrl } }) {
//             const isLoggedIn = !!auth?.user;
//             const isOnDashboard = nextUrl.pathname.startsWith('/');
//             if (isOnDashboard) {
//                 if (isLoggedIn) return true;
//                 return false; // Redirect unauthenticated users to login page
//             } else if (isLoggedIn) {
//                 return Response.redirect(new URL('/', nextUrl));
//             }
//             return true;
//         },
//     },
//     providers: [
//         GoogleProvider({
//             clientId: process.env.GOOGLE_CLIENT_ID || '',
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
//         }),
//     ],
// };
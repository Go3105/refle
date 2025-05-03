import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';

const prisma = new PrismaClient();

export async function fetchUserData() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('ログインしていません');
    }
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    return user;
}

export async function fetchNotionInfo() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('ログインしていません');
    }
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            notion_api_token: true,
            notion_database_id: true,
        },
    });
    if (!user) throw new Error('ユーザーが見つかりません');
    return user;
}
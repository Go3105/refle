import { NextResponse } from 'next/server';
import { updateUserNotionData } from '@/lib/userdata';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const email = session.user.email;
        const body = await req.json();
        const { notion_api_token, notion_database_id } = body;
        if (!notion_api_token && !notion_database_id) {
            return NextResponse.json({ error: 'No data to update' }, { status: 400 });
        }
        const ok = updateUserNotionData(email, { notion_api_token, notion_database_id });
        if (!ok) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user data' }, { status: 500 });
    }
} 
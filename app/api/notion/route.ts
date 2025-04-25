import { auth } from '@/auth';
import { users } from '../../../lib/userdata';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
    try {
        // Get current session
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const email = session.user.email;
        // Find user credentials
        const user = users.find(u => u.email === email);
        if (!user) {
            return NextResponse.json({ error: 'User Notion credentials not found' }, { status: 403 });
        }
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const pageTitle = `${month}月${day}日`;

        const notion = new Client({
            auth: user.notion_api_token
        });

        const response = await notion.pages.create({
            parent: {
                database_id: user.notion_database_id
            },
            properties: {
                タイトル: {
                    title: [
                        {
                            text: {
                                content: pageTitle
                            }
                        }
                    ]
                },
                今日の振り返り: {
                    rich_text: [
                        {
                            text: {
                                content: '今日の振り返り結果を載せる'
                            }
                        }
                    ]
                }
            }
        });

        return NextResponse.json({ success: true, page: response });
    } catch (error) {
        console.error('Error creating Notion page:', error);
        return NextResponse.json(
            { error: 'Failed to create Notion page' },
            { status: 500 }
        );
    }
} 
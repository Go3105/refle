import { auth } from '@/auth';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        // Get current session
        const { summary } = await req.json();
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const notion_api_token = process.env.NOTION_API_TOKEN;
        const notion_database_id = process.env.NOTION_DATABASE_ID;

        if (!notion_api_token || !notion_database_id) {
            return NextResponse.json({ error: 'Notion credentials not found' }, { status: 403 });
        }

        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const pageTitle = `${month}月${day}日`;

        const notion = new Client({
            auth: notion_api_token
        });

        const response = await notion.pages.create({
            parent: {
                database_id: notion_database_id
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
                                content: summary
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
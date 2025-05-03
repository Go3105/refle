import { auth } from '@/auth';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { fetchUserData, fetchNotionInfo } from '@/app/lib/fetchdata';

export async function POST(req: Request) {
    try {
        // Get current session
        const { summary } = await req.json();
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // fetchNotionInfoでNotion連携情報を取得
        const notionInfo = await fetchNotionInfo();
        const notion_api_token = notionInfo.notion_api_token;
        const notion_database_id = notionInfo.notion_database_id;
        if (!notion_api_token || !notion_database_id) {
            return NextResponse.json({ error: 'Notion連携情報が未登録です' }, { status: 400 });
        }

        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const pageTitle = `${month}月${day}日`;

        // Notionクライアントのauthにnotion_api_tokenを渡す
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
            { error: 'Failed to create Notion page', detail: String(error) },
            { status: 500 }
        );
    }
} 
export const runtime = 'edge';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
    auth: process.env.NOTION_API_TOKEN
});

export async function POST() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const pageTitle = `${month}月${day}日`;

        const response = await notion.pages.create({
            parent: {
                database_id: process.env.NOTION_DATABASE_ID!
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
'use server';

import { signOut } from "@/auth";
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export async function signOutAction() {
    await signOut();
}

export async function registerUser({ email, notion_api_token, notion_database_id }: {
    email: string;
    notion_api_token: string;
    notion_database_id: string;
}) {
    return await prisma.user.create({
        data: {
            id: randomUUID(),
            email: email,
            notion_api_token: notion_api_token,
            notion_database_id: notion_database_id,
            last_talk_date: '',
            last_talk_summary: '',
        },
    });
}

export async function updateNotionAPIToken({ email, notion_api_token }: {
    email: string;
    notion_api_token: string;
}) {
    return await prisma.user.update({
        where: { email },
        data: {
            notion_api_token: notion_api_token,
        },
    });
}

export async function updateNotionDatabaseId({ email, notion_database_id }: {
    email: string;
    notion_database_id: string;
}) {
    return await prisma.user.update({
        where: { email },
        data: {
            notion_database_id: notion_database_id,
        },
    });
}



-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "notion_api_token" TEXT NOT NULL,
    "notion_database_id" TEXT NOT NULL,
    "last_talk_date" TEXT NOT NULL,
    "last_talk_summary" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

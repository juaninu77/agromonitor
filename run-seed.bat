@echo off
cd /d %~dp0
call npx prisma db push --force-reset --accept-data-loss
call npx prisma generate
call npx tsx prisma/seed.ts
call npx tsx scripts/check-db.ts
pause



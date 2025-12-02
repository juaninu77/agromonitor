Set-Location -Path "C:\Projects\agromonitor"
Write-Host "Aplicando schema a la base de datos..."
npx prisma db push --accept-data-loss
Write-Host "Generando cliente Prisma..."
npx prisma generate
Write-Host "Ejecutando seed..."
npx tsx prisma/seed.ts
Write-Host "Verificando datos..."
npx tsx scripts/check-db.ts
Write-Host "Completado!"



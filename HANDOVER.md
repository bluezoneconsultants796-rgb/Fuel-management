# Handover checklist

Before going live, make sure ALL of these are done:

1. **Secrets** – rotate the database password, set a fresh `JWT_SECRET`
   (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Never ship `.env`.
2. **Admin account** – create a real admin for the client and delete/deactivate the demo accounts
   (admin@fleet.dev etc.). Never run `npm run seed` on the live database.
3. **Slip storage** – uploads are on local disk. On Railway attach a persistent Volume
   (mount at `/app/uploads` or set `UPLOAD_DIR`) or move `storage.service.ts` to S3/Cloudinary.
   Otherwise slip images are lost on every redeploy.
4. **CORS** – set `CORS_ORIGIN` to the real origin(s) instead of `*`.
5. **Build** – `cd mobile && npx eas build -p android --profile preview` (APK) and test on a real phone.
6. **Smoke test** – login as each role, upload a slip (camera + gallery + PDF), verify an entry,
   download the monthly PDF report.

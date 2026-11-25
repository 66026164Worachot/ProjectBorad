import 'dotenv/config';

import { storePaymentSlipFromDataUrl } from '../services/paymentService.js';
import { supabase } from '../services/supabase.js';

const bucketName =
  process.env.SLIP_BUCKET ||
  process.env.SUPABASE_PAYMENTS_BUCKET ||
  'payment-slips';
  
const sampleSlip =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y6N9yEAAAAASUVORK5CYII=';

async function main() {
  console.log('🔍 Checking Supabase slip configuration...');
  console.log(`→ Project: ${process.env.SUPABASE_URL || '(missing SUPABASE_URL)'}`);
  console.log(`→ Bucket : ${bucketName}`);

  try {
    console.log('\n1) Listing buckets');
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      throw error;
    }

    const names = (buckets || []).map(bucket => bucket.name);
    console.log('   Buckets:', names.length ? names.join(', ') : '(none found)');

    if (!names.includes(bucketName)) {
      console.warn(`   ⚠️  Bucket "${bucketName}" not found. It will be created automatically if the Service Role can create buckets.`);
    }
  } catch (error) {
    console.error('\n✖ Failed to list buckets:', error.message || error);
    console.error('   → ตรวจสอบว่าใช้ Service Role Key และเปิดใช้งาน Storage แล้ว');
    process.exit(1);
  }

  let uploadedPath;

  try {
    console.log('\n2) Uploading diagnostic slip');
    const { storagePath, publicUrl } = await storePaymentSlipFromDataUrl({
      dataUrl: sampleSlip,
      bookingId: 'diagnostic',
      userId: 'diagnostic-user'
    });

    uploadedPath = storagePath;
    console.log('   ✅ Upload success');
    console.log(`   Storage path: ${storagePath}`);
    console.log(`   Public URL  : ${publicUrl}`);
  } catch (error) {
    console.error('\n✖ Upload failed');
    console.error('   Code   :', error.code || error.message);
    console.error('   Message:', error.details || error.message);
    console.error('   → ตรวจสอบการตั้งค่า bucket, นโยบาย Storage และขนาดไฟล์สูงสุด');
    process.exit(1);
  }

  if (uploadedPath) {
    try {
      console.log('\n3) Cleaning up diagnostic file');
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([uploadedPath]);

      if (error) {
        throw error;
      }

      console.log('   🧹 Removed diagnostic slip successfully');
    } catch (error) {
      console.error('\n⚠️  Unable to remove diagnostic slip automatically:', error.message || error);
      console.error('   → สามารถลบไฟล์ทดสอบด้วยตนเองผ่าน Supabase Dashboard ได้');
    }
  }

  console.log('\n🎉 Supabase Storage is ready for slip uploads');
}

main();

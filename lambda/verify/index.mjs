// yallain-verify-id — triggered by S3 "ObjectCreated" events on the private IDs bucket (prefix ids/).
// Runs inside the VPC's private subnets so it can reach RDS through yallain-db-sg;
// reaches S3 through the VPC gateway endpoint. Every run is logged to CloudWatch Logs.
//
// It stands in for the national-registry check: once BOTH sides of a user's ID are uploaded
// and each is a real JPG/PNG within 10 MB, the user is marked "verified" in RDS.
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

const s3 = new S3Client({});
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png']);

let pool; // reused across warm invocations
const db = () => {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'yallain',
    connectionLimit: 2,
    connectTimeout: 5000,
  });
  return pool;
};

const log = (obj) => console.log(JSON.stringify(obj));

export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const match = key.match(/^ids\/(\d+)\/(front|back)\.(jpg|png)$/);
    if (!match) { log({ event: 'ignored', key }); continue; }
    const userId = Number(match[1]);

    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `ids/${userId}/` }));
    const objects = listed.Contents ?? [];
    const sides = {};
    for (const obj of objects) {
      const side = obj.Key.split('/').pop().split('.')[0];
      if (side === 'front' || side === 'back') sides[side] = obj;
    }
    if (!sides.front || !sides.back) {
      log({ event: 'waiting_for_other_side', userId, have: Object.keys(sides) });
      continue;
    }

    // Check both files really are images of an allowed size.
    const checks = await Promise.all(['front', 'back'].map(async (side) => {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: sides[side].Key }));
      return { side, type: head.ContentType, bytes: head.ContentLength, ok: TYPES.has(head.ContentType) && head.ContentLength > 0 && head.ContentLength <= MAX_BYTES };
    }));
    const passed = checks.every((c) => c.ok);
    const status = passed ? 'verified' : 'rejected';

    const [result] = await db().execute(
      `UPDATE users SET verification_status = ?, verified_at = UTC_TIMESTAMP()
        WHERE id = ? AND verification_status IN ('none', 'pending')`,
      [status, userId],
    );
    log({ event: 'verification_result', userId, status, checks, rowsUpdated: result.affectedRows });
  }
  return { ok: true };
};

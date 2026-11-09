// AWS clients. On EC2 the SDK picks up credentials from the instance's IAM role automatically —
// there are no access keys anywhere in this code or in .env.
const { S3Client } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const config = require('./config');

const s3 = new S3Client({ region: config.aws.region });
const sns = new SNSClient({ region: config.aws.region });

const MAX_ID_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' };

// WR6: a short-lived, single-file upload permission. S3 itself rejects files that are
// too big, the wrong type, or aimed at any other key — the browser never sees AWS credentials.
async function presignIdUpload(userId, side, contentType) {
  const ext = ALLOWED_TYPES[contentType];
  const key = `ids/${userId}/${side}.${ext}`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: config.aws.idsBucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_ID_PHOTO_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 300, // seconds
  });
  return { url, fields, key };
}

// WR3: one-time code by SMS through Amazon SNS.
async function sendSms(phoneNumber, message) {
  await sns.send(new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
    },
  }));
}

module.exports = { presignIdUpload, sendSms, MAX_ID_PHOTO_BYTES, ALLOWED_TYPES };

# YallaIn on AWS

The YallaIn fan registration journey as a web app on AWS. It's a Software Engineering for Cloud Applications team project at AAST.

Fans create an account, verify their mobile number by one-time code, and register their national ID with photos. They then pick the clubs and artists they follow. The rule "one ticket per verified ID" is enforced by the database.

| Page | Route | AWS services it uses |
| --- | --- | --- |
| WR1 Welcome | `/` | EC2 serves the page, S3 assets bucket serves the hero photo |
| WR2 Create account | `/signup` | RDS `users` (bcrypt password hash, unique mobile) |
| WR3 Verify mobile | `/verify` | SNS sends the SMS code; RDS `otp_codes` stores it hashed, with expiry and attempts |
| WR4 Add email (optional) | `/email` | RDS |
| WR5 National ID | `/national-id` | RDS: a unique HMAC hash makes one account per ID; only the last 4 digits are stored |
| WR6 ID photos | `/id-photo` | S3 private bucket with **pre-signed POST** (browser uploads to S3 directly), IAM role, RDS `id_documents` |
| WR7 ID verified | `/id-status` | **Lambda** triggered by the S3 upload writes the result to RDS; logs go to CloudWatch |
| WR8 Favorites | `/favorites` | RDS catalog and a `LIKE` search, S3 assets bucket for artist images |
| Login / Logout | `/login` | RDS; sessions are stored in RDS so an EC2 restart doesn't log anyone out |
| Home | `/home` | RDS reads back everything the journey saved |
| Health check | `/healthz` | Proves that EC2 can reach RDS |

## Repository layout

```
app/                Node.js 20 + Express + EJS web app (runs on EC2)
  server.js         entry point: security headers, sessions in RDS, routes
  src/routes/       auth.js (WR1–WR3, login), onboarding.js (WR4–WR8), api.js (uploads, status), home.js
  src/aws.js        S3 pre-signed POST + SNS publish (credentials come from the EC2 IAM role)
  src/otp.js        6-digit codes: hashed, 5-minute expiry, 3 tries, 60 s resend cooldown
  src/validators.js Egyptian mobile and national ID rules, password rules
  views/            one template per Figma screen (WR1–WR8, login, home)
  public/           CSS, small page scripts, logo
  scripts/db-init.js  creates the tables and the catalog: npm run db:init
assets/             images for the PUBLIC S3 assets bucket (hero/, panels/, artists/)
db/                 schema.sql, seed.sql
lambda/verify/      yallain-verify-id Lambda (S3 trigger → RDS)
deploy/             Nginx config, EC2 setup and deploy scripts, IAM / bucket policy JSON
```

## Run it on your laptop (no AWS needed)

With `S3_IDS_BUCKET` empty and `OTP_MODE=demo`, the app runs fully locally:

- ID photos are saved in `app/uploads/`.
- A local stand-in for the Lambda marks you verified about 4 seconds after both sides are uploaded.
- The SMS code is shown on the page and printed in the terminal.

1. Install Node.js 20+ and MySQL 8 (or XAMPP's MariaDB).
2. Create a database and user, for example:
   ```sql
   CREATE DATABASE yallain;
   CREATE USER 'yallain'@'localhost' IDENTIFIED BY 'devpass';
   GRANT ALL ON yallain.* TO 'yallain'@'localhost';
   ```
3. Set up and start the app:
   ```bash
   cd app
   npm install
   cp .env.example .env      # Windows: copy .env.example .env
   ```
4. In `.env`, set:
   ```
   NODE_ENV=development
   DB_HOST=127.0.0.1
   DB_USER=yallain
   DB_PASS=devpass
   S3_IDS_BUCKET=
   ASSETS_BASE_URL=
   OTP_MODE=demo
   ```
5. Run:
   ```bash
   npm run db:init
   npm run dev               # http://localhost:3000
   ```

For the national ID step, use a fake ID with a valid format, e.g. `2 990315 01 0123 4`. Use any JPG/PNG for the ID photos. **Never use a real person's ID.**

## Deploy on AWS

The full click-by-click steps are in the team's *YallaIn on AWS — Implementation Steps* doc. The short version:

1. **Network**: create the VPC `10.0.0.0/16` with:
   - public subnets `10.0.10.0/24` and `10.0.20.0/24`, routed to the IGW
   - private subnets `10.0.100.0/24` and `10.0.200.0/24`, local route only
   - an S3 gateway endpoint on both route tables
   - security groups `web-sg` (80 and 22), `lambda-sg`, and `db-sg` (3306 from `web-sg` and `lambda-sg` only)
   - NACLs
2. **RDS**: MySQL 8, `db.t3.micro`, both private subnets in the DB subnet group, no public access, `db-sg`.
3. **S3**: create two buckets.
   - `yallain-assets-<team>` is public-read through [`deploy/aws/assets-bucket-policy.json`](deploy/aws/assets-bucket-policy.json). Upload its images with:
     ```bash
     aws s3 sync assets s3://yallain-assets-<team>
     ```
   - `yallain-ids-<team>` keeps Block Public Access on, and needs the CORS rules in [`deploy/aws/ids-bucket-cors.json`](deploy/aws/ids-bucket-cors.json) with your Elastic IP.
4. **EC2**: Amazon Linux 2023, `t3.micro`, in a public subnet with `web-sg`, an Elastic IP, and an IAM role (`LabInstanceProfile` in Learner Lab, or [`ec2-role-policy.json`](deploy/aws/ec2-role-policy.json)). Then on the instance:
   ```bash
   git clone <this repo> && cd YallaIn-Aws
   bash deploy/ec2-setup.sh        # first run creates app/.env → edit it → run again
   ```
5. **Lambda** `yallain-verify-id`:
   - Build the package with `cd lambda/verify && npm run package`, then upload `lambda/verify.zip`.
   - Runtime: Node.js 20, handler `index.handler`, 15 s timeout.
   - Environment: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`.
   - VPC: both private subnets with `lambda-sg`.
   - Role: `LabRole`, or `AWSLambdaVPCAccessExecutionRole` + [`lambda-role-policy.json`](deploy/aws/lambda-role-policy.json).
   - Trigger: S3 `yallain-ids-<team>`, all object-create events, prefix `ids/`.
6. **SNS (optional)**: verify the team's phone numbers in the SMS sandbox, then set `OTP_MODE=sms`.

To redeploy after pushing new code: `bash deploy/deploy.sh`.

## How an ID photo upload flows (good to know for the discussion)

1. The browser asks EC2 for permission: `POST /api/upload-url`.
2. EC2 uses its IAM role to sign an **S3 pre-signed POST**. It is valid for 5 minutes, works for one key (`ids/<userId>/front.jpg`), and S3 enforces the limits of 10 MB and JPG/PNG only.
3. The browser uploads the file **directly to the private S3 bucket**, through the internet, not via EC2.
4. The browser calls `POST /api/upload-complete`. EC2 records the key in RDS and sets the status to `pending`.
5. S3 fires an event, and **Lambda** runs inside the private subnets. It checks that both sides exist and are valid images, then sets `verified` in RDS through `db-sg`. Its logs go to CloudWatch.
6. The WR7 page polls `/api/verification-status` until it reads `verified`.

## Security choices

- **Passwords**: bcrypt hashes.
- **OTP codes**: hashed, expire, have limited tries, and every auth endpoint is rate-limited.
- **National IDs**: never stored. The database keeps an HMAC (keyed hash) for the uniqueness check, plus the last 4 digits.
- **No AWS keys anywhere**: EC2 and Lambda use IAM roles.
- **SQL**: every query uses `?` placeholders.
- **CSRF**: SameSite cookies and an Origin check on every POST.
- **Headers**: Helmet security headers, including a Content-Security-Policy.
- **Network**: RDS has no public access, and the ID bucket is private.

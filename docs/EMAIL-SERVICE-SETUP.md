# Email Service Setup - Options & Guide

## Current Status

❌ **AWS SES is NOT configured** - That's why you're not receiving emails.

The code is ready, but AWS SES requires setup. Here are your options:

---

## Option 1: AWS SES (FREE - Recommended for Production)

### Cost
- **FREE Tier:** 62,000 emails/month if sending from EC2
- **FREE Tier:** 1,000 emails/month otherwise
- **After free tier:** $0.10 per 1,000 emails

### Setup Time
- **15-30 minutes** (one-time setup)

### Setup Steps

1. **Create AWS Account** (if you don't have one)
   - Go to https://aws.amazon.com/
   - Sign up (requires credit card but won't charge for free tier)

2. **Verify Sender Email**
   - Go to AWS SES Console: https://console.aws.amazon.com/ses/
   - Click "Verified identities" → "Create identity"
   - Identity type: **Email address**
   - Email: Your email (e.g., noreply@repwise.app or your personal email)
   - Click "Create identity"
   - **Check your email** for verification link
   - Click the link to verify

3. **Request Production Access** (Optional for now)
   - By default, SES is in "Sandbox mode" (can only send to verified emails)
   - For testing, add your test email as a verified recipient
   - For production, request production access (takes 24 hours)

4. **Create IAM User for API Access**
   - Go to IAM Console: https://console.aws.amazon.com/iam/
   - Users → Create user
   - Name: "repwise-ses"
   - Attach policy: **AmazonSESFullAccess**
   - Create access key → Copy Access Key ID and Secret Access Key

5. **Set Environment Variables**
   
   Create `/Users/manavmht/Documents/HOS/.env`:
   ```env
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   SES_SENDER_EMAIL=noreply@repwise.app
   SES_REGION=us-east-1
   ```

6. **Restart Backend**
   ```bash
   cd /Users/manavmht/Documents/HOS
   source .venv/bin/activate
   uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
   ```

7. **Test**
   - Register a new user
   - Check your email for the OTP code
   - Should arrive within seconds!

---

## Option 2: Development Mode (FREE - Quick Test)

For testing without email setup, I can add a **development mode** that:
- Shows the OTP code in the API response (only in DEBUG mode)
- Logs the OTP to console
- Allows you to test the flow without email

### Implementation (5 minutes)

I can add this to the backend:
```python
# In auth/service.py
if settings.DEBUG:
    # Return OTP in response for development
    return {"dev_otp": code}
```

And update the frontend to show the code in development.

**Pros:** Instant testing, no AWS setup  
**Cons:** Not production-ready, need to set up SES eventually

---

## Option 3: Alternative Email Service (Resend - $20/month)

If you want to avoid AWS complexity:

### Resend
- **Cost:** FREE for 3,000 emails/month, then $20/month for 50,000
- **Setup:** 10 minutes (simpler than AWS)
- **API:** Much cleaner than AWS SES

### Setup Steps
1. Sign up at https://resend.com/
2. Verify your domain or use their test domain
3. Get API key
4. Install: `pip install resend`
5. Replace EmailService to use Resend API

---

## My Recommendation

### For Right Now (Testing)
**Use Option 2 (Development Mode)** - I can implement this in 5 minutes so you can test the flow immediately without any AWS setup.

### For Production
**Use Option 1 (AWS SES)** - It's FREE for your scale and you're already using AWS for other services.

---

## Quick Decision

**What would you like me to do?**

**A) Set up development mode** (5 min) - Show OTP in console/response for testing  
**B) Guide you through AWS SES setup** (15-30 min) - Full email sending  
**C) Switch to Resend** (10 min setup + $20/month) - Simpler than AWS  

**I recommend Option A for immediate testing, then Option B for production.**

Let me know and I'll implement it!

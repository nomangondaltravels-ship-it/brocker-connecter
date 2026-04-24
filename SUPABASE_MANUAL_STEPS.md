# Supabase Manual Steps

These items cannot be completed from this local code session because they depend on your live Supabase dashboard/account settings.

## Already Completed In Code

- Email signup via Supabase Auth
- Email sign-in via Supabase Auth
- Forgot password request flow
- Reset password page
- Auth callback page for confirmation and recovery links
- Branded auth email template content file

## Still Required In Supabase Dashboard

### 0. Run Complaint Center SQL

Before complaint moderation can use the full backend fields, run:

- `supabase-complaints-center.sql`
- `supabase-support-center.sql`
- `supabase-real-estate-companies.sql`
- `supabase-property-category-layout.sql`
- `supabase-broker-toolkit.sql`
- `supabase-broker-toolkit-seed.sql`

This safely adds the complaint schema, admin action fields, and repeat-offense summary view on top of the existing project.

### 1. Enable Email Auth

Open:

- Supabase Dashboard
- Authentication
- Providers
- Email

Confirm:

- Email provider is enabled
- Confirm email is enabled for production if you want account verification before sign-in

### 2. Add Redirect URLs

Open:

- Authentication
- URL Configuration

Add these redirect URLs:

- `https://www.nomanproperties.com/auth-callback.html`
- `https://www.nomanproperties.com/reset-password.html`
- `https://www.nomanproperties.com/index.html`

For local testing add:

- `http://localhost:3000/auth-callback.html`
- `http://localhost:3000/reset-password.html`
- `http://localhost:3000/index.html`

If your production domain is different, replace the website domain above.

Important:

- The app now sends auth emails to `auth-callback.html`
- `auth-callback.html` then routes recovery links to `reset-password.html`
- So `auth-callback.html` must be allowed in Supabase Auth redirects

### 3. Paste Auth Email Templates

Open:

- Authentication
- Email Templates

Use the content from:

- `auth-email-templates.md`

Templates to update:

- Confirm signup
- Reset password

### 4. Verify SMTP / Resend

Open:

- Project Settings
- Authentication
- SMTP Settings

Confirm:

- SMTP host is `smtp.resend.com`
- SMTP port is `587`
- SMTP username is `resend`
- SMTP password is your Resend API key
- TLS is enabled if Supabase shows that option
- Sender email belongs to your verified Resend domain/subdomain
- Sender name is set to `Broker Connector` or your preferred production name
- Supabase is using Custom SMTP, not the default mail provider

Recommended sender:

- `no-reply@nomanproperties.com`

### 5. Check Resend Domain

In Resend, confirm:

- Domain status is verified
- DKIM/SPF are passing
- Sender email uses that verified domain
- The same sender identity is allowed in Resend

### 5A. Delivery Logs

In Resend dashboard, check email activity:

- If no reset email attempt appears, the issue is before delivery
- If the attempt appears but is not delivered, the issue is sender/domain/deliverability related

### 6. Test With A Real Registered Email

Test this order:

1. Register with a real email
2. Check confirmation email
3. Confirm account
4. Sign in
5. Click Forgot Password
6. Check reset email
7. Open reset link
8. Set new password
9. Sign in again

## Optional CLI Setup

If you want local CLI-based Supabase access later:

```powershell
winget install Supabase.CLI
supabase login
cd "C:\Users\HHHH\OneDrive\Desktop\brocker-site"
supabase init
supabase link --project-ref unggpaomyzvurmawnahj
```

After that, CLI-based inspection becomes easier.

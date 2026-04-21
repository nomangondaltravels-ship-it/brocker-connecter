# Broker Connector Auth Email Templates

Use these templates inside **Supabase Auth > Email Templates** with your existing Resend SMTP setup.

## Redirect URLs To Add In Supabase

Add these URLs in **Authentication > URL Configuration**:

- `https://www.nomanproperties.com/auth-callback.html`
- `https://www.nomanproperties.com/reset-password.html`
- `https://www.nomanproperties.com/index.html`
- `http://localhost:3000/auth-callback.html`
- `http://localhost:3000/reset-password.html`
- `http://localhost:3000/index.html`

If your production domain is different, replace it with the live website domain.

## Confirm Signup Template

Subject:

```text
Confirm your Broker Connector account
```

HTML:

```html
<div style="margin:0;padding:32px 0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#243041;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(148,163,184,0.2);border-radius:20px;padding:32px;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
    <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:#8f6a12;margin-bottom:12px;">Broker Connector</div>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;color:#243041;">Confirm your email</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#6b7280;">
      Welcome to Broker Connector. Please confirm your email address to activate your broker account and continue to Broker Desk.
    </p>
    <div style="margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#f0de9b,#d4af37 45%,#9e7415 100%);color:#111827;text-decoration:none;font-weight:700;border-radius:14px;padding:14px 22px;">
        Confirm Email
      </a>
    </div>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#6b7280;">
      If the button does not work, copy and open this link:
    </p>
    <p style="margin:0;font-size:13px;line-height:1.7;word-break:break-all;color:#243041;">
      {{ .ConfirmationURL }}
    </p>
  </div>
</div>
```

## Reset Password Template

Subject:

```text
Reset your Broker Connector password
```

HTML:

```html
<div style="margin:0;padding:32px 0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#243041;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(148,163,184,0.2);border-radius:20px;padding:32px;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
    <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:#8f6a12;margin-bottom:12px;">Broker Connector</div>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;color:#243041;">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#6b7280;">
      We received a request to reset your Broker Connector password. Use the button below to choose a new password securely.
    </p>
    <div style="margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#f0de9b,#d4af37 45%,#9e7415 100%);color:#111827;text-decoration:none;font-weight:700;border-radius:14px;padding:14px 22px;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#6b7280;">
      If the button does not work, copy and open this link:
    </p>
    <p style="margin:0;font-size:13px;line-height:1.7;word-break:break-all;color:#243041;">
      {{ .ConfirmationURL }}
    </p>
  </div>
</div>
```

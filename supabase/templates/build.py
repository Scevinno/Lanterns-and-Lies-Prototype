"""Builds the three Supabase Auth email templates from one layout (Creative Coach, 17 Nov 2026).

Run:  python build.py            -> writes confirm-signup.html, reset-password.html, change-email.html
      python build.py --preview  -> also writes preview-*.html with local images and a sample code
Paste each file's body (everything after the two comment lines) into Supabase: Authentication > Emails.
Images live in public/email/ and are served from https://lanternsandlies.com/email/.
Email rules: tables and inline styles only, no web fonts (the wordmark is in the header picture), no WebP.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://lanternsandlies.com"
NIGHT, PANEL, LINE, TEXT, DIM, LAMP = "#14161C", "#22252E", "#3A3E4A", "#EDE6D6", "#A9A497", "#D9A441"
SERIF = "Georgia,'Times New Roman',serif"
SANS = "'Segoe UI',Helvetica,Arial,sans-serif"

EMAILS = {
    "confirm-signup": dict(
        subject="Your Lanterns & Lies code", where="Confirm signup",
        title="Confirm your email",
        lead="Enter this code in the game to finish creating your account.",
        ignore="If you didn't sign up, you can ignore this email."),
    "reset-password": dict(
        subject="Reset your Lanterns & Lies password", where="Reset password",
        title="Choose a new password",
        lead="Enter this code in the game to set a new password.",
        ignore="If you didn't ask for this, you can ignore this email. Your password stays the same."),
    "change-email": dict(
        subject="Confirm your new Lanterns & Lies email", where="Change email address",
        title="Confirm your new email",
        lead="Enter this code in the game to move your account to this email.",
        ignore="If you didn't ask for this, you can ignore this email."),
}


def body(e, img, code):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>{e['subject']}</title></head>
<body style="margin:0;padding:0;background:{NIGHT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{e['lead']}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{NIGHT}" style="background:{NIGHT}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
  <tr><td style="padding:0"><img src="{img}/header.jpg" width="560" alt="Lanterns &amp; Lies" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px 12px 0 0"></td></tr>
  <tr><td bgcolor="{PANEL}" style="background:{PANEL};border:1px solid {LINE};border-top:0;border-radius:0 0 12px 12px;padding:32px 28px 28px;text-align:center">
    <h1 style="margin:0 0 10px;font-family:{SERIF};font-size:26px;line-height:1.25;font-weight:700;color:{TEXT}">{e['title']}</h1>
    <p style="margin:0 0 24px;font-family:{SANS};font-size:16px;line-height:1.5;color:{TEXT}">{e['lead']}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px">
    <tr>
      <td valign="middle" style="padding:0 14px 0 0"><img src="{img}/lantern.png" width="40" alt="" style="display:block;width:40px;height:auto;border:0"></td>
      <td valign="middle" bgcolor="{NIGHT}" style="background:{NIGHT};border:2px solid {LAMP};border-radius:10px;padding:14px 22px">
        <span style="font-family:'Courier New',Courier,monospace;font-size:32px;line-height:1;letter-spacing:6px;font-weight:700;color:{LAMP}">{code}</span>
      </td>
    </tr>
    </table>
    <p style="margin:0 0 6px;font-family:{SANS};font-size:14px;line-height:1.5;color:{DIM}">The code works for one hour.</p>
    <p style="margin:0;font-family:{SANS};font-size:14px;line-height:1.5;color:{DIM}">{e['ignore']}</p>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-family:{SANS};font-size:12px;line-height:1.6;color:{DIM}">
    <a href="{SITE}" style="color:{DIM};text-decoration:none"><b style="color:{TEXT}">Lanterns <span style="color:{LAMP}">&amp;</span> Lies</b> &middot; lanternsandlies.com</a><br>
    Questions? <a href="mailto:support@lanternsandlies.com" style="color:{DIM}">support@lanternsandlies.com</a>
  </td></tr>
  </table>
</td></tr>
</table>
</body></html>
"""


if __name__ == "__main__":
    preview = "--preview" in sys.argv
    local = "file:///" + os.path.join(HERE, "..", "..", "public", "email").replace("\\", "/")
    for name, e in EMAILS.items():
        html = body(e, SITE + "/email", "{{ .Token }}")
        with open(os.path.join(HERE, name + ".html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(f"<!-- Subject: {e['subject']} -->\n<!-- Paste into Supabase: Authentication > Emails > {e['where']}. Built by build.py; edit there. -->\n{html}")
        if preview:
            with open(os.path.join(HERE, f"preview-{name}.html"), "w", encoding="utf-8") as f:
                f.write(body(e, local, "48201739"))
    print("ok")

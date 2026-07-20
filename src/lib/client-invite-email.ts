const CANTARA_FOOTER = `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
    <tr>
      <td style="font-family:Georgia,'Times New Roman',serif;color:#21263C;font-size:14px;font-weight:600;letter-spacing:0.08em;">
        Cantara Pet Advisors
      </td>
    </tr>
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:12px;line-height:1.6;padding-top:8px;">
        Business sale readiness and M&amp;A advisory for pet care businesses.<br/>
        <a href="https://cantarapet.com" style="color:#b8922a;text-decoration:none;">cantarapet.com</a>
      </td>
    </tr>
  </table>
`

export function buildClientPortalInviteEmail(args: {
  businessName: string
  contactName: string
  email: string
  password: string
  loginUrl: string
  businessCategories?: string
  advisorName?: string
  settingsUrl?: string
}) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:#21263C;padding:20px 24px;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#F1E6BB;font-size:18px;letter-spacing:0.12em;">Cantara</p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;color:rgba(241,230,187,0.65);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">Client Portal Invitation</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:15px;line-height:1.6;">Hi ${args.contactName},</p>
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          You have been invited to the Cantara portal for <strong>${args.businessName}</strong>.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#334155;">
              <strong>Log-in and password details:</strong><br/>
              <strong>Login:</strong> <a href="${args.loginUrl}" style="color:#b8922a;">${args.loginUrl}</a><br/>
              <strong>Email:</strong> ${args.email}<br/>
              <strong>Password:</strong> ${args.password}
            </td>
          </tr>
        </table>
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          To ensure you can access the portal, please log-in before the onboarding call with the Cantara team.
        </p>
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          During our call, we will show you how the portal works in detail.
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          We&apos;re excited to work with you!<br/><br/>
          Cantara Pet Business Advisors Team
        </p>
        ${CANTARA_FOOTER}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function buildTeamInviteEmail(args: {
  clientName: string
  memberName: string
  email: string
  password: string
  loginUrl: string
  advisorName?: string
}) {
  const advisor = args.advisorName?.trim() || 'Cantara Pet Advisors'
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 16px;">Hi ${args.memberName},</p>
        <p style="margin:0 0 16px;">You have been invited to the Cantara client portal for <strong>${args.clientName}</strong>.</p>
        <p style="margin:0 0 16px;"><strong>Login:</strong> <a href="${args.loginUrl}" style="color:#b8922a;">${args.loginUrl}</a><br/>
        <strong>Email:</strong> ${args.email}<br/>
        <strong>Password:</strong> ${args.password}</p>
        <p style="margin:0 0 16px;">To ensure you have access to the portal, please login prior to the on-boarding call with the Cantara team.<br/>We will review how the portal works in detail during our call.<br/>We&rsquo;re excited to work with you!<br/>Cantara Pet Team</p>
        <p style="margin:0;">Thank you,<br/><strong>${advisor}</strong></p>
        ${CANTARA_FOOTER}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

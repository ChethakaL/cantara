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
  const advisor = args.advisorName?.trim() || 'your Cantara advisor'
  const categoryLine = args.businessCategories?.trim()
    ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;"><strong>Business focus:</strong> ${args.businessCategories}</p>`
    : ''
  const settingsUrl = args.settingsUrl || args.loginUrl.replace(/\/login\/client\/?$/, '/dashboard/settings')

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
          ${advisor} has invited you to the Cantara client portal for <strong>${args.businessName}</strong>.
          This secure workspace is where you will review your document checklist, upload assigned materials, and stay in touch with your Cantara team.
        </p>
        ${categoryLine}
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#334155;">
              <strong>Portal login:</strong> <a href="${args.loginUrl}" style="color:#b8922a;">${args.loginUrl}</a><br/>
              <strong>Email:</strong> ${args.email}<br/>
              <strong>Temporary password:</strong> ${args.password}
            </td>
          </tr>
        </table>
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          After signing in, start on the <strong>Overview</strong> tab, then use <strong>Assign</strong> and <strong>Document Upload</strong> for your checklist.
        </p>
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          You can change your password anytime from <a href="${settingsUrl}" style="color:#b8922a;">Account Settings</a> in the portal.
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          Warm regards,<br/>
          <strong>${advisor}</strong><br/>
          Cantara Pet Advisors
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
        <p style="margin:0 0 16px;">After signing in, you will see the document checklist and any items assigned to you.</p>
        <p style="margin:0;">Thank you,<br/><strong>${advisor}</strong></p>
        ${CANTARA_FOOTER}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

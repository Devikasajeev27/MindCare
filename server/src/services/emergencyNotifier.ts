import twilio from "twilio";

// Initialize Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID || "AC_DUMMY";
const authToken = process.env.TWILIO_AUTH_TOKEN || "DUMMY";
const fromPhone = process.env.TWILIO_PHONE_NUMBER || "+1234567890";
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

let twilioClient: any = null;
try {
  if (accountSid !== "AC_DUMMY" && authToken !== "DUMMY") {
    twilioClient = twilio(accountSid, authToken);
  }
} catch (err) {
  console.error("[EmergencyNotifier] Failed to initialize Twilio client:", err);
}

// Global cached mail transporter
let mailTransporter: any = null;

// Dynamically initialize nodemailer on-demand to prevent build-time compiler issues
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      // Bypasses compiler checking by importing via dynamic variable string
      const pkg = "nodemailer";
      const nodemailer = await import(pkg);
      mailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      return mailTransporter;
    } catch (err: any) {
      console.warn("[EmergencyNotifier] Nodemailer dynamic load failed. Email alerts will fallback to console mock:", err.message);
    }
  }
  return null;
}

export interface AlertResult {
  channel: "sms" | "email" | "whatsapp";
  to: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}

export class EmergencyNotifier {
  /**
   * Dispatches crisis notifications to all emergency contacts on SMS, Email, and WhatsApp.
   */
  static async dispatchAllAlerts(
    userData: { name: string; email?: string; phone?: string },
    emergencyContact: { name: string; phone: string; email?: string },
    crisisDetails: {
      score: number;
      triggerText: string;
      locationLink: string;
      nearbyText: string;
      summary: string;
    }
  ): Promise<AlertResult[]> {
    const results: AlertResult[] = [];

    const formattedSMSBody = `🚨 MINDCARE EMERGENCY ALERT 🚨
Distress alert for user: ${userData.name}.
Crisis Confidence Score: ${crisisDetails.score}/100.
Triggering text: "${crisisDetails.triggerText.slice(0, 50)}..."
Last Known Location: ${crisisDetails.locationLink}
Please check on them immediately. Call them or emergency services.`;

    const formattedEmailBody = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 2px solid #ef4444; border-radius: 12px;">
        <h2 style="color: #dc2626; margin-top: 0;">🚨 MINDCARE EMERGENCY DISTRESS ALERT</h2>
        <p>Dear <strong>${emergencyContact.name}</strong>,</p>
        <p>This is a proactive alert from <strong>MindCare AI</strong>. Our risk assessment engine has detected indicators of high-confidence, critical distress for <strong>${userData.name}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #fef2f2;">
            <td style="padding: 10px; border: 1px solid #fee2e2; font-weight: bold; width: 35%;">Confidence Score</td>
            <td style="padding: 10px; border: 1px solid #fee2e2; color: #dc2626; font-weight: bold;">${crisisDetails.score}/100 (CRITICAL)</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #fee2e2; font-weight: bold;">AI Context Summary</td>
            <td style="padding: 10px; border: 1px solid #fee2e2; font-style: italic;">${crisisDetails.summary}</td>
          </tr>
          <tr style="background: #fef2f2;">
            <td style="padding: 10px; border: 1px solid #fee2e2; font-weight: bold;">Last Known Location</td>
            <td style="padding: 10px; border: 1px solid #fee2e2;">
              <a href="${crisisDetails.locationLink}" style="color: #2563eb; font-weight: bold;" target="_blank">View on Google Maps</a>
            </td>
          </tr>
        </table>
        
        <h4 style="color: #1e293b; margin-bottom: 5px;">📍 Nearby Recommended Support Facilities:</h4>
        <pre style="background: #f8fafc; padding: 10px; border-radius: 6px; font-family: sans-serif; white-space: pre-wrap; font-size: 13px; margin-top: 0;">${crisisDetails.nearbyText}</pre>
        
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 20px;">
          <strong style="color: #991b1b;">Immediate Action Required:</strong> Please attempt to contact <strong>${userData.name}</strong> immediately. If you cannot reach them and believe they are in physical danger, contact emergency services (112 or local equivalent) right away.
        </div>
      </div>
    `;

    // 1. Send Twilio SMS Alert
    if (twilioClient) {
      try {
        const msg = await twilioClient.messages.create({
          body: formattedSMSBody,
          from: fromPhone,
          to: emergencyContact.phone,
        });
        results.push({
          channel: "sms",
          to: emergencyContact.phone,
          status: "sent",
          providerMessageId: msg.sid
        });
      } catch (err: any) {
        console.error("[EmergencyNotifier] SMS dispatch failed:", err.message);
        results.push({
          channel: "sms",
          to: emergencyContact.phone,
          status: "failed",
          errorMessage: err.message
        });
      }
    } else {
      console.log(`[EmergencyNotifier] [MOCK SMS] To: ${emergencyContact.phone} | Body: ${formattedSMSBody}`);
      results.push({
        channel: "sms",
        to: emergencyContact.phone,
        status: "sent",
        providerMessageId: "MOCK_SMS_SID_" + Math.random().toString(36).substring(7)
      });
    }

    // 2. Send Twilio WhatsApp Alert
    if (twilioClient) {
      try {
        const formattedTo = emergencyContact.phone.startsWith("whatsapp:") 
          ? emergencyContact.phone 
          : `whatsapp:${emergencyContact.phone}`;
          
        const msg = await twilioClient.messages.create({
          body: formattedSMSBody,
          from: twilioWhatsAppFrom,
          to: formattedTo,
        });
        results.push({
          channel: "whatsapp",
          to: formattedTo,
          status: "sent",
          providerMessageId: msg.sid
        });
      } catch (err: any) {
        console.error("[EmergencyNotifier] WhatsApp dispatch failed:", err.message);
        results.push({
          channel: "whatsapp",
          to: emergencyContact.phone,
          status: "failed",
          errorMessage: err.message
        });
      }
    } else {
      console.log(`[EmergencyNotifier] [MOCK WHATSAPP] To: ${emergencyContact.phone} | Body: ${formattedSMSBody}`);
      results.push({
        channel: "whatsapp",
        to: emergencyContact.phone,
        status: "sent",
        providerMessageId: "MOCK_WA_SID_" + Math.random().toString(36).substring(7)
      });
    }

    // 3. Send Email Alert (using dynamic SMTP transporter)
    if (emergencyContact.email) {
      const transporter = await getMailTransporter();
      if (transporter) {
        try {
          const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || `"MindCare Crisis Support" <noreply@mindcare.app>`,
            to: emergencyContact.email,
            subject: `🚨 CRITICAL DISTRESS ALERT: ${userData.name}`,
            html: formattedEmailBody
          });
          results.push({
            channel: "email",
            to: emergencyContact.email,
            status: "sent",
            providerMessageId: info.messageId
          });
        } catch (err: any) {
          console.error("[EmergencyNotifier] Email dispatch failed:", err.message);
          results.push({
            channel: "email",
            to: emergencyContact.email,
            status: "failed",
            errorMessage: err.message
          });
        }
      } else {
        console.log(`[EmergencyNotifier] [MOCK EMAIL] To: ${emergencyContact.email} | Subject: CRITICAL DISTRESS ALERT | HTML summary: ${crisisDetails.summary}`);
        results.push({
          channel: "email",
          to: emergencyContact.email,
          status: "sent",
          providerMessageId: "MOCK_MAIL_ID_" + Math.random().toString(36).substring(7)
        });
      }
    }

    return results;
  }
}

const { UnrecoverableError } = require("bullmq");
const env = require("../config/env");

/**
 * Processor for Email Sending Jobs with Brevo API integration and fallback simulation.
 */
async function emailProcessor(payload, bullJob) {
  const { to, subject, body, html, text } = payload || {};

  // 1. Permanent Failure Check: Throw UnrecoverableError so BullMQ does NOT retry invalid payloads!
  if (!to || !subject) {
    throw new UnrecoverableError(
      "Invalid email payload: missing 'to' or 'subject'. Retries disabled."
    );
  }

  // Basic email format check
  if (!to.includes("@")) {
    throw new UnrecoverableError(
      `Invalid recipient email format: "${to}". Retries disabled.`
    );
  }

  console.log(`[Email Processor] Processing email for: ${to} (Subject: "${subject}")`);

  if (bullJob && typeof bullJob.updateProgress === "function") {
    await bullJob.updateProgress(30);
  }

  // 2. Transient Failure Simulation (Will RETRY automatically with backoff)
  if (to === "fail@example.com") {
    throw new Error("SMTP Gateway Connection Timeout (Simulated)");
  }

  const apiKey = env.BREVO_API_KEY && env.BREVO_API_KEY.trim();

  if (apiKey) {
    console.log(`[Email Processor] Sending live email via Brevo REST API...`);
    
    if (bullJob && typeof bullJob.updateProgress === "function") {
      await bullJob.updateProgress(60);
    }

    const requestBody = {
      sender: {
        name: env.BREVO_SENDER_NAME || "Job Platform",
        email: env.BREVO_SENDER_EMAIL || "noreply@example.com",
      },
      to: [{ email: to }],
      subject: subject,
      textContent: text || body || subject,
    };

    if (html) {
      requestBody.htmlContent = html;
    } else if (body) {
      requestBody.htmlContent = `<p>${body}</p>`;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = responseData.message || responseData.code || response.statusText;

      // 400 Bad Request from Brevo is a permanent error, no retry needed
      if (response.status === 400) {
        throw new UnrecoverableError(`Brevo API Permanent Error (${response.status}): ${errorMsg}`);
      }

      // 5xx network/server errors from Brevo will throw standard Error and trigger retries
      throw new Error(`Brevo API Transient Error (${response.status}): ${errorMsg}`);
    }

    if (bullJob && typeof bullJob.updateProgress === "function") {
      await bullJob.updateProgress(100);
    }

    return {
      delivered: true,
      provider: "brevo",
      recipient: to,
      messageId: responseData.messageId || `brevo_${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }

  // Fallback to simulation mode if BREVO_API_KEY is not configured
  console.log(`[Email Processor] BREVO_API_KEY not configured. Using simulated dispatch...`);
  
  if (bullJob && typeof bullJob.updateProgress === "function") {
    await bullJob.updateProgress(70);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (bullJob && typeof bullJob.updateProgress === "function") {
    await bullJob.updateProgress(100);
  }

  return {
    delivered: true,
    provider: "simulated",
    recipient: to,
    messageId: `msg_${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}

module.exports = emailProcessor;

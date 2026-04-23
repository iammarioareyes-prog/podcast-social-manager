export const metadata = {
  title: "Terms of Service | I Am Mario Areyes Podcast Manager",
};

export default function TermsPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: "48px 24px", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "#666", marginBottom: 40 }}>Last updated: April 23, 2026</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>1. Acceptance of Terms</h2>
      <p>By accessing or using the I Am Mario Areyes Podcast Social Media Manager ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>2. Description of Service</h2>
      <p>The App is a private social media management tool that enables the podcast operator to schedule and publish video content to connected social media platforms including Instagram, TikTok, and YouTube. The App connects to Google Drive to source content and uses AI to generate captions.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>3. Permitted Use</h2>
      <p>The App is intended solely for use by the authorized operator of the "I Am Mario Areyes" podcast. You agree to use the App only for lawful purposes and in accordance with the terms of service of any connected third-party platforms (Instagram, TikTok, YouTube, Google).</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>4. Third-Party Platform Compliance</h2>
      <p>By connecting your social media accounts, you authorize the App to publish content on your behalf. You are solely responsible for ensuring that all content posted through the App complies with the community guidelines and terms of service of each respective platform.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>5. OAuth Access & Permissions</h2>
      <p>The App uses OAuth 2.0 to connect to third-party platforms. Access tokens are stored securely and used exclusively to publish content and retrieve analytics data as directed by you. You may revoke access at any time through the Settings page or directly through each platform's security settings.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>6. Data Security</h2>
      <p>We implement reasonable security measures to protect your data. However, no method of electronic transmission or storage is 100% secure. You use the App at your own risk.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>7. Content Ownership</h2>
      <p>You retain full ownership of all content published through the App. The App does not claim any rights over your videos, captions, or other content.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>8. Limitation of Liability</h2>
      <p>The App is provided "as is" without warranties of any kind. We are not liable for any failed posts, platform outages, API changes by third parties, or any indirect damages arising from use of the App.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>9. Changes to Terms</h2>
      <p>We reserve the right to update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>10. Contact</h2>
      <p>For questions about these Terms, contact: <a href="mailto:iammarioareyes@gmail.com" style={{ color: "#7c3aed" }}>iammarioareyes@gmail.com</a></p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
        <a href="/" style={{ color: "#7c3aed", textDecoration: "none" }}>← Back to App</a>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <a href="/privacy" style={{ color: "#7c3aed", textDecoration: "none" }}>Privacy Policy</a>
      </div>
    </div>
  );
}

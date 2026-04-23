export const metadata = {
  title: "Privacy Policy | I Am Mario Areyes Podcast Manager",
};

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: "48px 24px", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 40 }}>Last updated: April 23, 2026</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>1. Overview</h2>
      <p>This Privacy Policy describes how the I Am Mario Areyes Podcast Social Media Manager ("the App") collects, uses, and protects information when you connect your social media accounts and use the publishing features of the App.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>2. Information We Collect</h2>
      <p>The App collects the following categories of information:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>OAuth Access Tokens:</strong> When you connect Instagram, TikTok, YouTube, or Google Drive, we store the access tokens required to authenticate API calls on your behalf. These tokens are stored securely in our database and are never shared with third parties.</li>
        <li><strong>Platform Account Data:</strong> We retrieve your platform username, account ID, and basic analytics (follower count, view count) solely to display in the App dashboard.</li>
        <li><strong>Content Metadata:</strong> File names, Drive folder names, and post titles from your Google Drive are stored to build the posting schedule.</li>
        <li><strong>Post Records:</strong> We store a history of posts created and published through the App, including captions, scheduled times, and publication status.</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>3. How We Use Your Information</h2>
      <p>Information collected is used exclusively to:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>Authenticate and publish content to connected social platforms on your behalf</li>
        <li>Schedule and track post status</li>
        <li>Display analytics and account information in the dashboard</li>
        <li>Generate AI captions using the Anthropic Claude API (clip title and guest name only — no personal data is sent)</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>4. TikTok Data</h2>
      <p>When you connect your TikTok account, the App receives an access token that allows it to publish videos to TikTok on your behalf using the TikTok Content Posting API. The App:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>Does <strong>not</strong> access your TikTok followers, messages, or personal profile beyond what is required for video publishing</li>
        <li>Does <strong>not</strong> sell or share TikTok data with any third party</li>
        <li>Stores your TikTok access token securely and uses it solely to post content you have authorized</li>
        <li>Allows you to revoke access at any time from the Settings page or TikTok's app permissions page</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>5. Instagram & Facebook Data</h2>
      <p>When you connect your Instagram account via the Facebook Graph API, the App accesses your Instagram Business Account to publish Reels and retrieve follower/post counts. No personal messages or private data are accessed.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>6. YouTube & Google Data</h2>
      <p>When you connect your YouTube or Google Drive account, the App uses Google OAuth 2.0 to upload videos and read Drive folder contents. The App does not access Gmail, Google Contacts, or any other Google services.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>7. Data Storage & Security</h2>
      <p>All data is stored in a Supabase (PostgreSQL) database secured with row-level security and accessed only via server-side API routes using a service role key. Access tokens are never exposed to the client browser.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>8. Data Retention</h2>
      <p>Post records and platform tokens are retained for as long as the App is in use. You may request deletion of your data at any time by contacting us.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>9. Third-Party Services</h2>
      <p>The App integrates with the following third-party services, each governed by their own privacy policies:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li><a href="https://www.tiktok.com/legal/page/global/privacy-policy/en" style={{ color: "#7c3aed" }}>TikTok Privacy Policy</a></li>
        <li><a href="https://privacycenter.instagram.com/policy" style={{ color: "#7c3aed" }}>Instagram / Meta Privacy Policy</a></li>
        <li><a href="https://policies.google.com/privacy" style={{ color: "#7c3aed" }}>Google / YouTube Privacy Policy</a></li>
        <li><a href="https://anthropic.com/privacy" style={{ color: "#7c3aed" }}>Anthropic Privacy Policy</a></li>
        <li><a href="https://supabase.com/privacy" style={{ color: "#7c3aed" }}>Supabase Privacy Policy</a></li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>10. Your Rights</h2>
      <p>You have the right to access, correct, or delete any data we hold about you. You can revoke OAuth permissions at any time through the Settings page or directly through each platform. To request data deletion, contact us at the email below.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>11. Contact</h2>
      <p>For privacy questions or data deletion requests, contact: <a href="mailto:iammarioareyes@gmail.com" style={{ color: "#7c3aed" }}>iammarioareyes@gmail.com</a></p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
        <a href="/" style={{ color: "#7c3aed", textDecoration: "none" }}>← Back to App</a>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <a href="/terms" style={{ color: "#7c3aed", textDecoration: "none" }}>Terms of Service</a>
      </div>
    </div>
  );
}

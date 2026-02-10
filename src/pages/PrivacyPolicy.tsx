import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'February 10, 2026';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-foreground">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-sm sm:prose dark:prose-invert max-w-none space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">BuilderLYNK Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>

          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              BuilderLYNK ("we," "our," or "us") operates the BuilderLYNK mobile application and web platform (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By accessing or using the Service, you agree to this Privacy Policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, phone number, company name, job title, and password when you create an account.</li>
              <li><strong>Profile Information:</strong> Avatar/profile photo, display name, and role within your organization.</li>
              <li><strong>Employment Data:</strong> Employee PIN codes, timecard records, punch-in/out times, job assignments, and cost code selections.</li>
              <li><strong>Financial Information:</strong> Vendor details, invoice data, billing information, purchase orders, and subcontract details entered into the platform. We do not directly process or store credit card payment information.</li>
              <li><strong>Communications:</strong> Messages, notes, and announcements sent through the platform.</li>
              <li><strong>Uploaded Content:</strong> Photos, documents, receipts, delivery tickets, plans, and other files you upload.</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, browser type, and app version.</li>
              <li><strong>Location Data:</strong> Precise GPS location when you punch in/out or upload job site photos (only with your permission).</li>
              <li><strong>Camera &amp; Photos:</strong> Access to your device camera for punch clock selfies, receipt scanning, and job site documentation (only with your permission).</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, timestamps, and interaction patterns.</li>
              <li><strong>Log Data:</strong> IP address, access times, referring URLs, and error logs.</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Authentication Providers:</strong> If you sign in via third-party providers (e.g., Google), we receive your name and email from that provider.</li>
              <li><strong>Employer/Administrator:</strong> Your employer or company administrator may provide your information when adding you to the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, operate, and maintain the Service, including time tracking, receipt management, project management, and accounting features.</li>
              <li>Authenticate your identity and manage your account.</li>
              <li>Process and track employee punch-in/out records and timecards.</li>
              <li>Enable job site photo documentation with location verification.</li>
              <li>Facilitate communication between team members.</li>
              <li>Generate reports and analytics for your organization.</li>
              <li>Send transactional emails (account verification, password resets, notifications).</li>
              <li>Improve, personalize, and optimize the Service.</li>
              <li>Detect, prevent, and address technical issues, fraud, or security concerns.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Legal Basis for Processing (GDPR)</h2>
            <p>Where applicable, we process your data based on:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Contract Performance:</strong> To provide the Service you or your employer has engaged.</li>
              <li><strong>Legitimate Interest:</strong> To improve our Service, ensure security, and prevent fraud.</li>
              <li><strong>Consent:</strong> For location data, camera access, and push notifications — you may revoke consent at any time through your device settings.</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. How We Share Your Information</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Your Employer/Organization:</strong> Administrators within your company can access your work-related data including timecards, photos, and activity logs.</li>
              <li><strong>Service Providers:</strong> Third-party vendors who assist in operating the Service (e.g., cloud hosting, email delivery, OCR processing). These providers are contractually obligated to protect your data.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, legal process, or governmental request.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your data may be transferred to the acquiring entity.</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing.</li>
            </ul>
            <p className="mt-2"><strong>We do not sell your personal information to third parties.</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Storage and Security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Data is stored on secure servers provided by Supabase (hosted on AWS infrastructure).</li>
              <li>We use encryption in transit (TLS/SSL) and at rest for sensitive data.</li>
              <li>Row-Level Security (RLS) policies ensure users can only access data they are authorized to view.</li>
              <li>PIN codes used for employee authentication are stored securely.</li>
              <li>We implement regular security audits and monitoring.</li>
            </ul>
            <p className="mt-2">
              While we strive to use commercially acceptable means to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide the Service. Timecard records, financial data, and audit logs may be retained for longer periods as required by law or your organization's policies. When data is no longer needed, it is securely deleted or anonymized.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Your Rights and Choices</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li><strong>Portability:</strong> Request a machine-readable copy of your data.</li>
              <li><strong>Opt-Out:</strong> Opt out of non-essential communications.</li>
              <li><strong>Withdraw Consent:</strong> Revoke previously given consent for location, camera, or notification access via your device settings.</li>
              <li><strong>Restrict Processing:</strong> Request limitation of data processing under certain conditions.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at <a href="mailto:privacy@builderlynk.com" className="text-primary hover:underline">privacy@builderlynk.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Permissions We Request</h2>
            <p>Our mobile application may request the following device permissions:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Camera:</strong> Required for punch clock face verification, receipt scanning, delivery ticket photos, and job site documentation. Photos are uploaded to your organization's secure storage.</li>
              <li><strong>Location (GPS):</strong> Used to verify punch-in/out locations at job sites and geo-tag job photos. Location data is shared with your employer for workforce management.</li>
              <li><strong>Push Notifications:</strong> To alert you of new messages, task assignments, and important updates. You can disable notifications in your device settings at any time.</li>
              <li><strong>Local Storage:</strong> To store authentication tokens and app preferences locally on your device.</li>
              <li><strong>Internet Access:</strong> Required for syncing data with the cloud platform.</li>
            </ul>
            <p className="mt-2">
              All permissions are optional and requested only when needed. You can manage permissions through your device settings. Denying certain permissions may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Children's Privacy</h2>
            <p>
              The Service is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected data from a child under 16, we will take steps to delete it promptly. If you believe a child has provided us with personal data, please contact us at <a href="mailto:privacy@builderlynk.com" className="text-primary hover:underline">privacy@builderlynk.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws. We ensure appropriate safeguards are in place, including standard contractual clauses, to protect your data during such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Third-Party Services</h2>
            <p>Our Service integrates with the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase:</strong> Database hosting, authentication, and file storage.</li>
              <li><strong>Resend:</strong> Transactional email delivery.</li>
              <li><strong>Mapbox:</strong> Map display and geocoding for job site locations.</li>
              <li><strong>Google/MediaPipe:</strong> Face detection for punch clock verification (processed on-device, not sent to Google).</li>
            </ul>
            <p className="mt-2">
              Each third-party service has its own privacy policy. We encourage you to review their policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. California Privacy Rights (CCPA)</h2>
            <p>If you are a California resident, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Know what personal information is collected, used, shared, or sold.</li>
              <li>Delete personal information held by us and our service providers.</li>
              <li>Opt out of the sale of personal information (we do not sell personal information).</li>
              <li>Non-discrimination for exercising your CCPA rights.</li>
            </ul>
            <p className="mt-2">
              To exercise your California privacy rights, contact us at <a href="mailto:privacy@builderlynk.com" className="text-primary hover:underline">privacy@builderlynk.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Cookies and Tracking Technologies</h2>
            <p>
              We use local storage and session tokens (not traditional cookies) to maintain your authentication state and app preferences. We do not use third-party advertising trackers or analytics cookies. Usage data is collected for service improvement purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">15. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page and updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the revised policy. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">16. Account Deletion</h2>
            <p>
              You may request deletion of your account and associated personal data at any time by contacting us at <a href="mailto:privacy@builderlynk.com" className="text-primary hover:underline">privacy@builderlynk.com</a>. Upon request, we will delete or anonymize your personal data within 30 days, except where retention is required by law or legitimate business purposes (e.g., financial records, audit logs).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">17. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
            <ul className="list-none pl-0 space-y-1">
              <li><strong>Email:</strong> <a href="mailto:privacy@builderlynk.com" className="text-primary hover:underline">privacy@builderlynk.com</a></li>
              <li><strong>Website:</strong> <a href="https://builderlynk.lovable.app" className="text-primary hover:underline">builderlynk.lovable.app</a></li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
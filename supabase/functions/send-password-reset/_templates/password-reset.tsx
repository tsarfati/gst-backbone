import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetEmailProps {
  resetUrl: string;
  userEmail: string;
}

export const PasswordResetEmail = ({
  resetUrl,
  userEmail,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your BuilderLynk password</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with Logo */}
        <Section style={header}>
          <Img
            src="https://builderlynk.lovable.app/email-assets/builderlynk-logo.png?v=1"
            alt="BuilderLynk"
            width="200"
            height="auto"
            style={logo}
          />
        </Section>

        {/* Main Content */}
        <Section style={content}>
          <Heading style={h1}>Reset Your Password</Heading>
          
          <Text style={text}>
            Hi there,
          </Text>
          
          <Text style={text}>
            We received a request to reset the password for your BuilderLynk account associated with <strong>{userEmail}</strong>.
          </Text>
          
          <Text style={text}>
            Click the button below to set a new password:
          </Text>

          {/* CTA Button */}
          <Section style={buttonContainer}>
            <Link href={resetUrl} style={button}>
              Reset Password
            </Link>
          </Section>

          <Text style={textSmall}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>
            {resetUrl}
          </Text>

          <Text style={text}>
            This link will expire in 1 hour for security reasons.
          </Text>

          <Text style={textMuted}>
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} BuilderLynk. All rights reserved.
          </Text>
          <Text style={footerTextSmall}>
            Construction Management Made Simple
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail

// Styles - BuilderLynk Brand Colors
// Primary Navy: hsl(210, 52%, 28%) = #224466 approx
// Accent Orange: hsl(28, 85%, 52%) = #E88A2D

const main = {
  backgroundColor: '#f4f6f8',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
}

const header = {
  backgroundColor: '#1e3a5f',
  padding: '32px 40px',
  textAlign: 'center' as const,
  borderRadius: '8px 8px 0 0',
}

const logo = {
  margin: '0 auto',
}

const content = {
  backgroundColor: '#ffffff',
  padding: '40px',
  borderLeft: '1px solid #e5e7eb',
  borderRight: '1px solid #e5e7eb',
}

const h1 = {
  color: '#1e3a5f',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 24px',
  padding: '0',
  textAlign: 'center' as const,
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const textSmall = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0 8px',
  textAlign: 'center' as const,
}

const linkText = {
  color: '#1e3a5f',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
  wordBreak: 'break-all' as const,
}

const textMuted = {
  color: '#9ca3af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0 0',
  fontStyle: 'italic' as const,
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#E88A2D',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const footer = {
  backgroundColor: '#1e3a5f',
  padding: '24px 40px',
  textAlign: 'center' as const,
  borderRadius: '0 0 8px 8px',
}

const footerText = {
  color: '#ffffff',
  fontSize: '14px',
  margin: '0 0 4px',
}

const footerTextSmall = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0',
}

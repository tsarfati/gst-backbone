 import {
   Body,
   Container,
   Head,
   Heading,
   Html,
   Link,
   Preview,
   Text,
   Img,
   Section,
 } from 'npm:@react-email/components@0.0.22'
 import * as React from 'npm:react@18.3.1'
 
interface ConfirmationEmailProps {
  confirmUrl: string
  userEmail: string
  companyName?: string
  companyLogoUrl?: string
  builderLogoUrl?: string
}

export const ConfirmationEmail = ({
  confirmUrl,
  userEmail,
  builderLogoUrl,
}: ConfirmationEmailProps) => (
   <Html>
     <Head />
     <Preview>Confirm your BuilderLYNK account</Preview>
     <Body style={main}>
       <Container style={container}>
         <Section style={header}>
          <Img
             src={builderLogoUrl || "https://builderlynk.com"}
             alt="BuilderLYNK"
             height="150"
             style={{ display: 'block', margin: '0 auto', width: 'auto', maxWidth: '420px' }}
           />
         </Section>
 
        <Section style={content}>
          <Heading style={h1}>Confirm Your BuilderLYNK Account</Heading>
           
           <Text style={text}>
             Thanks for signing up! Please confirm your email address to get started.
           </Text>
           
           <Text style={text}>
             Click the button below to verify your account:
           </Text>

           <Text style={smallText}>Email: {userEmail}</Text>

           <Section style={buttonContainer}>
             <Link href={confirmUrl} style={button}>
               Confirm Your Email
             </Link>
           </Section>
 
           <Text style={smallText}>Or copy and paste this link into your browser:</Text>
           <Text style={linkText}>
             <Link href={confirmUrl} style={link}>
               {confirmUrl}
             </Link>
           </Text>
 
           <Text style={smallText}>
             If you didn't create an account with BuilderLYNK, you can safely ignore this email.
           </Text>
         </Section>
 
         <Section style={footer}>
           <Text style={footerText}>
             © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
           </Text>
         </Section>
       </Container>
     </Body>
   </Html>
 )
 
 export default ConfirmationEmail
 
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}
 
const container = {
  margin: '40px auto',
  padding: '0',
  maxWidth: '600px',
}
 
const header = {
  backgroundColor: '#1e3a5f',
  padding: '16px 20px',
  textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
}

const content = {
  backgroundColor: '#ffffff',
  padding: '40px 30px',
}
 
 const h1 = {
   color: '#1e3a5f',
   fontSize: '24px',
   fontWeight: '700',
   margin: '0 0 16px 0',
   textAlign: 'center' as const,
 }
 
 const text = {
   color: '#374151',
   fontSize: '16px',
   lineHeight: '1.6',
   margin: '0 0 14px 0',
 }
 
 const buttonContainer = {
   textAlign: 'center' as const,
   margin: '8px 0 20px 0',
 }
 
 const button = {
   backgroundColor: '#E88A2D',
   borderRadius: '8px',
   color: '#ffffff',
   display: 'inline-block',
   fontSize: '16px',
   fontWeight: '600',
   padding: '12px 26px',
   textDecoration: 'none',
 }
 
 const smallText = {
   color: '#6b7280',
   fontSize: '13px',
   lineHeight: '1.6',
   margin: '10px 0 8px 0',
   textAlign: 'center' as const,
 }
 
 const linkText = {
   textAlign: 'center' as const,
   margin: '0 0 12px 0',
 }
 
 const link = {
   color: '#E88A2D',
   fontSize: '12px',
   wordBreak: 'break-all' as const,
 }
 
 const footer = {
   backgroundColor: '#1e3a5f',
   padding: '18px 24px',
   textAlign: 'center' as const,
   borderRadius: '0 0 12px 12px',
 }
 
 const footerText = {
   color: '#ffffff',
   fontSize: '12px',
   margin: '0',
 }

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
 
 interface MagicLinkEmailProps {
   magicLinkUrl: string
   token: string
 }
 
 export const MagicLinkEmail = ({
   magicLinkUrl,
   token,
 }: MagicLinkEmailProps) => (
   <Html>
     <Head />
     <Preview>Your BuilderLYNK login link</Preview>
     <Body style={main}>
       <Container style={container}>
         {/* Header */}
         <Section style={header}>
           <Img
             src="https://builderlynk.lovable.app/email-assets/builderlynk-logo.png?v=2"
             alt="BuilderLYNK"
             height="50"
             style={{ margin: '0 auto' }}
           />
         </Section>
 
         {/* Content */}
         <Section style={content}>
           <Heading style={h1}>Login to BuilderLYNK</Heading>
           
           <Text style={text}>
             Click the button below to securely log in to your account:
           </Text>
 
           <Section style={buttonContainer}>
             <Link href={magicLinkUrl} style={button}>
               Log In to BuilderLYNK
             </Link>
           </Section>
 
           <Text style={smallText}>
             Or use this one-time code:
           </Text>
           <Section style={codeContainer}>
             <Text style={code}>{token}</Text>
           </Section>
 
           <Text style={smallText}>
             This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
           </Text>
         </Section>
 
         {/* Footer */}
         <Section style={footer}>
           <Text style={footerText}>
             © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
           </Text>
         </Section>
       </Container>
     </Body>
   </Html>
 )
 
 export default MagicLinkEmail
 
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
   padding: '30px',
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
   margin: '0 0 20px 0',
   textAlign: 'center' as const,
 }
 
 const text = {
   color: '#374151',
   fontSize: '16px',
   lineHeight: '1.6',
   margin: '0 0 20px 0',
   textAlign: 'center' as const,
 }
 
 const buttonContainer = {
   textAlign: 'center' as const,
   margin: '30px 0',
 }
 
 const button = {
   backgroundColor: '#E88A2D',
   borderRadius: '8px',
   color: '#ffffff',
   display: 'inline-block',
   fontSize: '16px',
   fontWeight: '600',
   padding: '14px 32px',
   textDecoration: 'none',
 }
 
 const smallText = {
   color: '#6b7280',
   fontSize: '14px',
   lineHeight: '1.6',
   margin: '20px 0 10px 0',
   textAlign: 'center' as const,
 }
 
 const codeContainer = {
   textAlign: 'center' as const,
   margin: '0 0 20px 0',
 }
 
 const code = {
   display: 'inline-block',
   padding: '16px 32px',
   backgroundColor: '#f4f4f4',
   borderRadius: '8px',
   border: '1px solid #e5e5e5',
   color: '#1e3a5f',
   fontSize: '24px',
   fontWeight: '700',
   letterSpacing: '4px',
   fontFamily: 'monospace',
 }
 
 const footer = {
   backgroundColor: '#1e3a5f',
   padding: '20px 30px',
   textAlign: 'center' as const,
   borderRadius: '0 0 12px 12px',
 }
 
 const footerText = {
   color: '#ffffff',
   fontSize: '12px',
   margin: '0',
 }
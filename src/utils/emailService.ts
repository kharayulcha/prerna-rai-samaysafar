import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn('SMTP credentials not configured. Email sending will fail.');
  console.warn('Please set SMTP_USER and SMTP_PASS in your .env file');
}

// Create transporter with better error handling
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // Increase timeouts for slower connections
  connectionTimeout: 15000, 
  greetingTimeout: 15000,
  socketTimeout: 15000,
});

// Send OTP email
export const sendOTPEmail = async (email: string, otpCode: string, fullName: string): Promise<void> => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject: 'SamaySafar - Email Verification OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">SamaySafar Email Verification</h2>
        <p>Hello ${fullName},</p>
        <p>Thank you for registering with SamaySafar. Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">${otpCode}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this verification, please ignore this email.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Best regards,<br>
          The SamaySafar Team
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully to ${email}');
  } catch (error: any) {
    console.error('Error sending OTP email:', error);

    // Provide helpful error messages for common issues
    if (error.code === 'EAUTH') {
      const errorMessage = `
      `;
      console.error(errorMessage);
      throw new Error('Gmail authentication failed. Please use an App Password instead of your regular password. See console for details.');
    }

    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Failed to connect to email server. Please check your internet connection.');
    }

    throw new Error(`Failed to send OTP email: ${error.message || 'Unknown error'}`);
  }
};

// Send user credentials email (permanent password, created by organization)
export const sendUserCredentialsEmail = async (
  email: string,
  password: string,
  fullName: string,
  orgName: string,
  role: string
): Promise<void> => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject: 'SamaySafar - Your Account Credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">SamaySafar Account Created</h2>
        <p>Hello ${fullName},</p>
        <p>
          The organization <strong>${orgName}</strong> has created your SamaySafar account as a
          <strong>${role}</strong>.
        </p>
        <p>Your login credentials are:</p>
        <div style="background-color: #f5f5f5; padding: 16px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <p>
          This is your <strong>permanent password</strong>. For security, we recommend that you change it
          after your first login from the account settings page.
        </p>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Best regards,<br>
          The SamaySafar Team
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('User credentials email sent successfully to ${email}');
  } catch (error: any) {
    console.error('Error sending user credentials email:', error);

    if (error.code === 'EAUTH') {
      throw new Error('Gmail authentication failed while sending credentials email.');
    }

    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Failed to connect to email server while sending credentials email.');
    }

    throw new Error(`Failed to send user credentials email: ${error.message || 'Unknown error'}`);
  }
};

// Send password reset OTP email
export const sendPasswordResetOTPEmail = async (email: string, otpCode: string, fullName: string): Promise<void> => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject: 'SamaySafar - Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">SamaySafar Password Reset</h2>
        <p>Hello ${fullName},</p>
        <p>You have requested to reset your password. Please use the following OTP to proceed:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">${otpCode}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Best regards,<br>
          The SamaySafar Team
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset OTP email sent successfully to ${email}`);
  } catch (error: any) {
    console.error('Error sending password reset OTP email:', error);

    if (error.code === 'EAUTH') {
      throw new Error('Gmail authentication failed. Please use an App Password instead of your regular password.');
    }

    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Failed to connect to email server. Please check your internet connection.');
    }

    throw new Error(`Failed to send password reset OTP email: ${error.message || 'Unknown error'}`);
  }
};

// Generate 6 digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
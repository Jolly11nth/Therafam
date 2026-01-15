import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-a3c0b8e9/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Sign up new user
app.post("/make-server-a3c0b8e9/auth/signup", async (c) => {
  try {
    const { email, password, userType, fullName, therapistData } = await c.req.json();
    console.log(`📝 Signup request for: ${email}`);

    // Check if user already exists
    const existingUser = await kv.get(`user:email:${email}`);

    if (existingUser) {
      console.log('❌ User already exists');
      
      // If user exists but is not verified, allow resending verification
      if (!existingUser.is_verified) {
        console.log('⚠️ User exists but not verified, sending new verification code');
        
        // Generate new verification code
        const verificationCode = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Store verification
        await kv.set(`email_verification:${email}`, {
          user_id: existingUser.id,
          verification_code: verificationCode,
          email,
          expires_at: expiresAt.toISOString(),
          is_verified: false
        });
        
        console.log(`📧 New verification code for ${email}: ${verificationCode}`);
        
        // Send verification email
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .logo { text-align: center; margin-bottom: 30px; }
                .logo h1 { color: #10b981; font-size: 32px; margin: 0; }
                .code-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .code { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
                .content { color: #374151; line-height: 1.6; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <h1>🌿 Therafam</h1>
                </div>
                <div class="content">
                  <h2 style="color: #111827; margin-bottom: 20px;">Email Verification Required</h2>
                  <p>Hello,</p>
                  <p>Your account exists but needs email verification. Please use the code below to verify your email:</p>
                  <div class="code-box">
                    <div class="code">${verificationCode}</div>
                  </div>
                  <p><strong>This code will expire in 24 hours.</strong></p>
                  <p>If you didn't request this, please ignore this email.</p>
                </div>
                <div class="footer">
                  <p>This is an automated email from Therafam. Please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Therafam. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `;
        
        await sendEmail(
          email,
          'Therafam - Verify Your Email',
          emailHtml
        );
        
        return c.json({ 
          success: false, 
          error: 'Account exists but not verified. A new verification code has been sent. Please check your email.',
          unverified: true,
          verificationCode // For development only
        }, 400);
      }
      
      return c.json({ 
        success: false, 
        error: 'An account with this email already exists. Please sign in instead.' 
      }, 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    console.log(`🔐 Password hashed: ${passwordHash.substring(0, 20)}...`);

    // Create user ID
    const userId = crypto.randomUUID();

    // Create user
    const newUser = {
      id: userId,
      email,
      password_hash: passwordHash,
      user_type: userType,
      is_verified: false,
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null
    };

    // Store user by ID and email
    await kv.set(`user:${userId}`, newUser);
    await kv.set(`user:email:${email}`, newUser);

    console.log('✅ User created successfully:', userId);

    // Create user profile
    if (userType === 'client') {
      const names = fullName?.split(' ') || [];
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      const profile = {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString()
      };

      await kv.set(`user_profile:${userId}`, profile);
    } else if (userType === 'therapist') {
      // Create therapist profile
      if (therapistData) {
        const therapistProfile = {
          user_id: userId,
          first_name: therapistData.firstName,
          last_name: therapistData.lastName,
          phone_number: therapistData.phoneNumber,
          license_type: therapistData.licenseType,
          license_number: therapistData.licenseNumber,
          license_state: therapistData.licenseState,
          years_experience: therapistData.yearsExperience,
          specializations: [therapistData.specialization],
          bio: therapistData.bio || '',
          is_verified: false,
          is_accepting_clients: false,
          created_at: new Date().toISOString()
        };

        await kv.set(`therapist_profile:${userId}`, therapistProfile);
        console.log('✅ Therapist profile created successfully');
      }
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification
    await kv.set(`email_verification:${email}`, {
      user_id: userId,
      verification_code: verificationCode,
      email,
      expires_at: expiresAt.toISOString(),
      is_verified: false
    });

    console.log(`📧 Verification code for ${email}: ${verificationCode}`);

    // Send verification email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #10b981; font-size: 32px; margin: 0; }
            .code-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
            .content { color: #374151; line-height: 1.6; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🌿 Therafam</h1>
            </div>
            <div class="content">
              <h2 style="color: #111827; margin-bottom: 20px;">Welcome to Therafam!</h2>
              <p>Hello,</p>
              <p>Thank you for joining Therafam. To complete your registration, please verify your email address using the code below:</p>
              <div class="code-box">
                <div class="code">${verificationCode}</div>
              </div>
              <p><strong>This code will expire in 24 hours.</strong></p>
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from Therafam. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Therafam. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      email,
      'Therafam - Verify Your Email',
      emailHtml
    );

    return c.json({ 
      success: true,
      userId: userId,
      verificationCode // In production, this should be sent via email only
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Signup failed' 
    }, 500);
  }
});

// Sign in user
app.post("/make-server-a3c0b8e9/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();
    console.log(`🔐 Login attempt for: ${email}`);

    // Get user
    const user = await kv.get(`user:email:${email}`);

    if (!user) {
      console.log('❌ User not found');
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }

    console.log(`🔍 User found, verifying password...`);
    console.log(`🔍 User object:`, JSON.stringify(user, null, 2));
    console.log(`🔍 Password hash exists: ${!!user.password_hash}`);
    console.log(`🔍 Password hash type: ${typeof user.password_hash}`);
    
    if (!user.password_hash) {
      console.log('❌ No password hash stored for user');
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }
    
    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    console.log(`🔍 Password verification result: ${passwordValid}`);
    
    if (!passwordValid) {
      console.log('❌ Invalid password');
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }

    // Check if verified
    if (!user.is_verified) {
      console.log('❌ Email not verified, sending new verification code');
      
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Store verification
      await kv.set(`email_verification:${email}`, {
        user_id: user.id,
        verification_code: verificationCode,
        email,
        expires_at: expiresAt.toISOString(),
        is_verified: false
      });
      
      console.log(`📧 New verification code for ${email}: ${verificationCode}`);
      
      // Send verification email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .logo { text-align: center; margin-bottom: 30px; }
              .logo h1 { color: #10b981; font-size: 32px; margin: 0; }
              .code-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
              .code { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
              .content { color: #374151; line-height: 1.6; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <h1>🌿 Therafam</h1>
              </div>
              <div class="content">
                <h2 style="color: #111827; margin-bottom: 20px;">Email Verification Required</h2>
                <p>Hello,</p>
                <p>To access your account, please verify your email address using the code below:</p>
                <div class="code-box">
                  <div class="code">${verificationCode}</div>
                </div>
                <p><strong>This code will expire in 24 hours.</strong></p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>This is an automated email from Therafam. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} Therafam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      await sendEmail(
        email,
        'Therafam - Verify Your Email',
        emailHtml
      );
      
      return c.json({ 
        success: false, 
        error: 'Email not verified. A new verification code has been sent to your email.',
        unverified: true,
        verificationCode // For development only
      }, 401);
    }

    // Get user profile
    let profile = null;
    if (user.user_type === 'client') {
      profile = await kv.get(`user_profile:${user.id}`);
    } else {
      profile = await kv.get(`therapist_profile:${user.id}`);
    }

    // Update last login
    user.last_login_at = new Date().toISOString();
    await kv.set(`user:${user.id}`, user);
    await kv.set(`user:email:${email}`, user);

    console.log('✅ Login successful');
    return c.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_active: user.is_active,
        created_at: user.created_at,
        profile
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Login failed' 
    }, 500);
  }
});

// Verify email
app.post("/make-server-a3c0b8e9/auth/verify-email", async (c) => {
  try {
    const { email, code } = await c.req.json();
    console.log(`📧 Email verification attempt for: ${email}`);

    // Get verification record
    const verification = await kv.get(`email_verification:${email}`);

    if (!verification || verification.is_verified) {
      console.log('❌ Invalid verification code or already verified');
      return c.json({ success: false, error: 'Invalid verification code' }, 400);
    }

    // Check if code matches
    if (verification.verification_code !== code) {
      console.log('❌ Verification code mismatch');
      return c.json({ success: false, error: 'Invalid verification code' }, 400);
    }

    // Check if expired
    const expiresAt = new Date(verification.expires_at);
    if (expiresAt < new Date()) {
      console.log('❌ Verification code expired');
      return c.json({ success: false, error: 'Verification code expired' }, 400);
    }

    // Mark verification as verified
    verification.is_verified = true;
    await kv.set(`email_verification:${email}`, verification);

    // Update user
    const user = await kv.get(`user:${verification.user_id}`);
    if (user) {
      user.is_verified = true;
      await kv.set(`user:${user.id}`, user);
      await kv.set(`user:email:${email}`, user);
    }

    console.log('✅ Email verified successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Verification error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    }, 500);
  }
});

// Resend verification code
app.post("/make-server-a3c0b8e9/auth/resend-verification", async (c) => {
  try {
    const { email } = await c.req.json();
    console.log(`📧 Resend verification request for: ${email}`);

    // Check if user exists
    const user = await kv.get(`user:email:${email}`);

    if (!user) {
      console.log('❌ User not found');
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    if (user.is_verified) {
      console.log('❌ Email already verified');
      return c.json({ success: false, error: 'Email already verified' }, 400);
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store new verification
    await kv.set(`email_verification:${email}`, {
      user_id: user.id,
      verification_code: verificationCode,
      email,
      expires_at: expiresAt.toISOString(),
      is_verified: false
    });

    console.log(`📧 New verification code for ${email}: ${verificationCode}`);

    // Send verification email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #10b981; font-size: 32px; margin: 0; }
            .code-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
            .content { color: #374151; line-height: 1.6; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🌿 Therafam</h1>
            </div>
            <div class="content">
              <h2 style="color: #111827; margin-bottom: 20px;">Email Verification</h2>
              <p>Hello,</p>
              <p>Here is your new verification code:</p>
              <div class="code-box">
                <div class="code">${verificationCode}</div>
              </div>
              <p><strong>This code will expire in 24 hours.</strong></p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from Therafam. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Therafam. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      email,
      'Therafam - New Verification Code',
      emailHtml
    );

    return c.json({ 
      success: true,
      verificationCode // In production, this should be sent via email only
    });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Resend verification failed' 
    }, 500);
  }
});

// Request password reset
app.post("/make-server-a3c0b8e9/auth/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();
    console.log(`🔑 Password reset request for: ${email}`);

    // Check if user exists
    const user = await kv.get(`user:email:${email}`);

    if (!user) {
      console.log('❌ User not found');
      // For security, don't reveal if email exists or not
      return c.json({ 
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent.'
      });
    }

    // Generate reset code
    const resetCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store reset code
    await kv.set(`password_reset:${email}`, {
      user_id: user.id,
      reset_code: resetCode,
      email,
      expires_at: expiresAt.toISOString(),
      is_used: false
    });

    console.log(`🔑 Password reset code for ${email}: ${resetCode}`);

    // Send email with reset code
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #10b981; font-size: 32px; margin: 0; }
            .code-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
            .content { color: #374151; line-height: 1.6; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🌿 Therafam</h1>
            </div>
            <div class="content">
              <h2 style="color: #111827; margin-bottom: 20px;">Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset your password. Use the verification code below to continue:</p>
              <div class="code-box">
                <div class="code">${resetCode}</div>
              </div>
              <p><strong>This code will expire in 30 minutes.</strong></p>
              <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>For your security, never share this code with anyone.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from Therafam. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Therafam. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailSent = await sendEmail(
      email,
      'Therafam - Password Reset Code',
      emailHtml
    );

    if (!emailSent) {
      console.log('⚠️ Email sending failed, but returning success for security');
    }

    return c.json({ 
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.',
      resetCode // For development only - in production, remove this line
    });
  } catch (error) {
    console.error('❌ Password reset request error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Password reset request failed' 
    }, 500);
  }
});

// Verify reset code
app.post("/make-server-a3c0b8e9/auth/verify-reset-code", async (c) => {
  try {
    const { email, code } = await c.req.json();
    console.log(`🔑 Verifying reset code for: ${email}`);

    // Get reset record
    const resetRecord = await kv.get(`password_reset:${email}`);

    if (!resetRecord || resetRecord.is_used) {
      console.log('❌ Invalid or already used reset code');
      return c.json({ success: false, error: 'Invalid or expired reset code' }, 400);
    }

    // Check if code matches
    if (resetRecord.reset_code !== code) {
      console.log('❌ Reset code mismatch');
      return c.json({ success: false, error: 'Invalid reset code' }, 400);
    }

    // Check if expired
    const expiresAt = new Date(resetRecord.expires_at);
    if (expiresAt < new Date()) {
      console.log('❌ Reset code expired');
      return c.json({ success: false, error: 'Reset code expired' }, 400);
    }

    console.log('✅ Reset code verified successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Reset code verification error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Reset code verification failed' 
    }, 500);
  }
});

// Reset password with code
app.post("/make-server-a3c0b8e9/auth/reset-password", async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    console.log(`🔑 Resetting password for: ${email}`);

    // Get reset record
    const resetRecord = await kv.get(`password_reset:${email}`);

    if (!resetRecord || resetRecord.is_used) {
      console.log('❌ Invalid or already used reset code');
      return c.json({ success: false, error: 'Invalid or expired reset code' }, 400);
    }

    // Check if code matches
    if (resetRecord.reset_code !== code) {
      console.log('❌ Reset code mismatch');
      return c.json({ success: false, error: 'Invalid reset code' }, 400);
    }

    // Check if expired
    const expiresAt = new Date(resetRecord.expires_at);
    if (expiresAt < new Date()) {
      console.log('❌ Reset code expired');
      return c.json({ success: false, error: 'Reset code expired' }, 400);
    }

    // Get user
    const user = await kv.get(`user:${resetRecord.user_id}`);
    if (!user) {
      console.log('❌ User not found');
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    console.log(`🔐 New password hashed`);

    // Update user password
    user.password_hash = newPasswordHash;
    await kv.set(`user:${user.id}`, user);
    await kv.set(`user:email:${email}`, user);

    // Mark reset code as used
    resetRecord.is_used = true;
    await kv.set(`password_reset:${email}`, resetRecord);

    console.log('✅ Password reset successful');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Password reset failed' 
    }, 500);
  }
});

// ============================================================================
// MOOD TRACKING ROUTES
// ============================================================================

// Save mood entry
app.post("/make-server-a3c0b8e9/mood/save", async (c) => {
  try {
    const { userId, moodScore, moodLabel, notes, emotions, triggers } = await c.req.json();
    console.log(`💭 Saving mood entry for user: ${userId}`);

    const { data, error } = await supabase
      .from('mood_entries')
      .insert({
        user_id: userId,
        mood_value: moodScore,
        mood_label: moodLabel,
        notes: notes || '',
        entry_date: new Date().toISOString().split('T')[0], // Today's date
        triggers: triggers || []
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving mood:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    console.log('✅ Mood entry saved successfully');
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Mood save error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save mood' 
    }, 500);
  }
});

// Get mood history
app.get("/make-server-a3c0b8e9/mood/history/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const limit = c.req.query('limit') || '30';
    console.log(`📊 Fetching mood history for user: ${userId}`);

    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('❌ Error fetching mood history:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    console.log('✅ Mood history fetched successfully');
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Mood history fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch mood history' 
    }, 500);
  }
});

// ============================================================================
// LESSON PROGRESS ROUTES
// ============================================================================

// Update lesson progress
app.post("/make-server-a3c0b8e9/lessons/progress", async (c) => {
  try {
    const { userId, lessonId, timeSpent, isCompleted } = await c.req.json();
    console.log(`📚 Updating lesson progress for user: ${userId}, lesson: ${lessonId}`);

    // First, get the lesson to find its program_id
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('program_id')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      console.error('❌ Lesson not found:', lessonError);
      return c.json({ success: false, error: 'Lesson not found' }, 404);
    }

    // Check if progress already exists
    const { data: existing } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single();

    let result;
    if (existing) {
      // Update existing progress
      const updates: any = {
        updated_at: new Date().toISOString(),
        time_spent_minutes: (existing.time_spent_minutes || 0) + (timeSpent || 0)
      };

      if (isCompleted && existing.status !== 'completed') {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else if (!isCompleted && existing.status === 'not_started') {
        updates.status = 'in_progress';
        updates.started_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('lesson_progress')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new progress
      const { data, error } = await supabase
        .from('lesson_progress')
        .insert({
          user_id: userId,
          program_id: lesson.program_id,
          lesson_id: lessonId,
          time_spent_minutes: timeSpent || 0,
          status: isCompleted ? 'completed' : 'in_progress',
          started_at: new Date().toISOString(),
          completed_at: isCompleted ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log('✅ Lesson progress updated successfully');
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Lesson progress update error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update lesson progress' 
    }, 500);
  }
});

// ============================================================================
// AI CONVERSATION ROUTES
// ============================================================================

// Save AI conversation
app.post("/make-server-a3c0b8e9/ai/conversation", async (c) => {
  try {
    const { userId, summary, messages } = await c.req.json();
    console.log(`💬 Saving AI conversation for user: ${userId}`);

    // Store conversation summary and metadata
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userId,
        conversation_title: summary || 'AI chat session',
        conversation_summary: summary || 'AI chat session',
        total_messages: messages?.length || 0,
        last_message_at: new Date().toISOString(),
        dominant_emotions: messages?.flatMap((m: any) => m.emotions || []).filter((e: any, i: number, arr: any[]) => arr.indexOf(e) === i).slice(0, 5) || [],
        crisis_episodes: messages?.filter((m: any) => m.isCrisis).length || 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving conversation:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Store individual messages in chat_messages table
    if (messages && messages.length > 0) {
      const chatMessages = messages.map((msg: any) => ({
        conversation_type: 'ai_chat',
        sender_id: msg.sender === 'user' ? userId : null,
        recipient_id: msg.sender === 'ai' ? userId : null,
        message_text: msg.text,
        message_type: 'text',
        detected_emotions: msg.emotions || [],
        is_crisis_message: msg.isCrisis || false,
        ai_response_type: msg.sender === 'ai' ? 'therapeutic_support' : null,
        is_read: true,
        created_at: msg.timestamp
      }));

      const { error: messagesError } = await supabase
        .from('chat_messages')
        .insert(chatMessages);

      if (messagesError) {
        console.error('⚠️ Error saving messages:', messagesError);
        // Don't fail the whole operation if messages fail
      } else {
        console.log(`✅ Saved ${chatMessages.length} messages`);
      }
    }

    console.log('✅ AI conversation saved successfully');
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Conversation save error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save conversation' 
    }, 500);
  }
});

// Get AI conversation history
app.get("/make-server-a3c0b8e9/ai/conversations/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const searchQuery = c.req.query('search') || '';
    console.log(`📜 Fetching AI conversation history for user: ${userId}`);

    let query = supabase
      .from('ai_conversations')
      .select('id, conversation_title, conversation_summary, total_messages, created_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    // If search query is provided, filter by summary or title
    if (searchQuery) {
      query = query.or(`conversation_title.ilike.%${searchQuery}%,conversation_summary.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching conversation history:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Transform data to match expected format in frontend
    const transformedData = (data || []).map(conv => ({
      id: conv.id,
      summary: conv.conversation_title || conv.conversation_summary,
      created_at: conv.created_at,
      conversation_data: {
        messages: [] // Messages would need to be fetched from chat_messages table
      }
    }));

    console.log(`✅ Fetched ${transformedData.length} conversations`);
    return c.json({ success: true, data: transformedData });
  } catch (error) {
    console.error('❌ Conversation history fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch conversation history' 
    }, 500);
  }
});

// Get single AI conversation by ID
app.get("/make-server-a3c0b8e9/ai/conversation/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    console.log(`📜 Fetching AI conversation: ${conversationId}`);

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('❌ Error fetching conversation:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Fetch associated messages from chat_messages table
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('message_text, sender_id, created_at, detected_emotions, is_crisis_message')
      .eq('conversation_type', 'ai_chat')
      .eq('sender_id', data.user_id)
      .order('created_at', { ascending: true });

    // Transform to expected format
    const transformedData = {
      id: data.id,
      summary: data.conversation_title || data.conversation_summary,
      created_at: data.created_at,
      conversation_data: {
        messages: (messages || []).map(msg => ({
          text: msg.message_text,
          sender: msg.sender_id === data.user_id ? 'user' : 'ai',
          timestamp: msg.created_at,
          emotions: msg.detected_emotions || [],
          isCrisis: msg.is_crisis_message || false
        }))
      }
    };

    console.log('✅ Conversation fetched successfully');
    return c.json({ success: true, data: transformedData });
  } catch (error) {
    console.error('❌ Conversation fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch conversation' 
    }, 500);
  }
});

// Delete AI conversation
app.delete("/make-server-a3c0b8e9/ai/conversation/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    console.log(`🗑️ Deleting AI conversation: ${conversationId}`);

    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('❌ Error deleting conversation:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    console.log('✅ Conversation deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Conversation delete error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete conversation' 
    }, 500);
  }
});

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

// Get dashboard data
app.get("/make-server-a3c0b8e9/dashboard/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`📊 Fetching dashboard data for user: ${userId}`);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch mood data for today
    const todayDateStr = today.toISOString().split('T')[0];
    const { data: moodData } = await supabase
      .from('mood_entries')
      .select('mood_value')
      .eq('user_id', userId)
      .eq('entry_date', todayDateStr);

    // Calculate average mood score
    let moodScore = '0.0';
    let moodChange = '';
    if (moodData && moodData.length > 0) {
      const avgMood = moodData.reduce((sum, entry) => sum + (entry.mood_value || 0), 0) / moodData.length;
      moodScore = avgMood.toFixed(1);
      
      // Get yesterday's mood for comparison
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDateStr = yesterday.toISOString().split('T')[0];
      
      const { data: yesterdayMood } = await supabase
        .from('mood_entries')
        .select('mood_value')
        .eq('user_id', userId)
        .eq('entry_date', yesterdayDateStr);
      
      if (yesterdayMood && yesterdayMood.length > 0) {
        const yesterdayAvg = yesterdayMood.reduce((sum, entry) => sum + (entry.mood_value || 0), 0) / yesterdayMood.length;
        const diff = avgMood - yesterdayAvg;
        if (diff > 0) moodChange = `+${diff.toFixed(1)}`;
        else if (diff < 0) moodChange = diff.toFixed(1);
      }
    }

    // Fetch lesson progress for today (minutes practiced)
    const { data: lessonProgress } = await supabase
      .from('lesson_progress')
      .select('time_spent_minutes, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', today.toISOString())
      .lt('updated_at', tomorrow.toISOString());

    let minutesPracticed = 0;
    if (lessonProgress && lessonProgress.length > 0) {
      minutesPracticed = lessonProgress.reduce((sum, lesson) => sum + (lesson.time_spent_minutes || 0), 0);
    }

    // For now, mock goals completed (you can add a goals table later)
    const goalsCompleted = '0/0';

    // Fetch recent activity
    const recentActivity = [];

    // Get recent mood entries (last 3)
    const { data: recentMoods } = await supabase
      .from('mood_entries')
      .select('mood_value, mood_label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentMoods) {
      for (const mood of recentMoods) {
        const timeAgo = getTimeAgo(new Date(mood.created_at));
        recentActivity.push({
          title: `Mood logged: ${mood.mood_label || 'Feeling ' + mood.mood_value + '/5'}`,
          time: timeAgo,
          type: 'mood'
        });
      }
    }

    // Get recent AI conversations (last 2)
    const { data: recentChats } = await supabase
      .from('ai_conversations')
      .select('created_at, summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (recentChats) {
      for (const chat of recentChats) {
        const timeAgo = getTimeAgo(new Date(chat.created_at));
        recentActivity.push({
          title: chat.summary || 'AI chat session completed',
          time: timeAgo,
          type: 'chat'
        });
      }
    }

    // Get recent completed lessons (last 2)
    const { data: completedLessons } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at, lessons(title)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(2);

    if (completedLessons) {
      for (const lesson of completedLessons) {
        if (lesson.completed_at) {
          const timeAgo = getTimeAgo(new Date(lesson.completed_at));
          const lessonTitle = lesson.lessons?.title || 'lesson';
          recentActivity.push({
            title: `Completed ${lessonTitle}`,
            time: timeAgo,
            type: 'achievement'
          });
        }
      }
    }

    // Sort all activity by time and limit to 5 most recent
    recentActivity.sort((a, b) => {
      // This is a simple sort, in production you'd want to sort by actual timestamps
      return 0;
    });

    const limitedActivity = recentActivity.slice(0, 5);

    // If no activity, provide default messages
    if (limitedActivity.length === 0) {
      limitedActivity.push(
        { title: 'Welcome to Therafam!', time: 'Just now', type: 'achievement' },
        { title: 'Start by logging your mood', time: 'Now', type: 'mood' },
        { title: 'Try an AI chat session', time: 'Now', type: 'chat' }
      );
    }

    console.log('✅ Dashboard data fetched successfully');

    return c.json({
      success: true,
      data: {
        todayStats: [
          { label: 'Mood Score', value: moodScore, change: moodChange },
          { label: 'Minutes Practiced', value: minutesPracticed.toString(), change: '' },
          { label: 'Goals Completed', value: goalsCompleted, change: '' }
        ],
        recentActivity: limitedActivity
      }
    });
  } catch (error) {
    console.error('❌ Dashboard data fetch error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
    }, 500);
  }
});

// ============================================================================
// ONBOARDING QUESTIONNAIRE ROUTES
// ============================================================================

// Save questionnaire responses
app.post("/make-server-a3c0b8e9/onboarding/questionnaire", async (c) => {
  try {
    const { userId, age, occupation, goal } = await c.req.json();
    console.log(`📋 Saving questionnaire for user: ${userId}`);

    if (!userId) {
      return c.json({ success: false, error: 'User ID is required' }, 400);
    }

    // Store questionnaire data in KV store
    const questionnaireData = {
      age,
      occupation,
      goal,
      completed_at: new Date().toISOString()
    };

    await kv.set(`questionnaire:${userId}`, JSON.stringify(questionnaireData));

    console.log('✅ Questionnaire saved successfully');
    return c.json({ success: true, data: questionnaireData });
  } catch (error) {
    console.error('❌ Questionnaire save error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save questionnaire' 
    }, 500);
  }
});

// Get questionnaire responses
app.get("/make-server-a3c0b8e9/onboarding/questionnaire/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`📋 Fetching questionnaire for user: ${userId}`);

    const data = await kv.get(`questionnaire:${userId}`);

    if (!data) {
      console.log('📝 No questionnaire found');
      return c.json({ success: true, data: null });
    }

    const questionnaireData = JSON.parse(data);
    console.log('✅ Questionnaire fetched successfully');
    return c.json({ success: true, data: questionnaireData });
  } catch (error) {
    console.error('❌ Questionnaire fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch questionnaire' 
    }, 500);
  }
});

// ============================================================================
// USER SETTINGS ROUTES
// ============================================================================

// Get user language preference
app.get("/make-server-a3c0b8e9/settings/language/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🌐 Fetching language preference for user: ${userId}`);

    // Try to get from user_settings first
    const { data: settings } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();

    if (settings && settings.language) {
      console.log(`✅ Language preference found: ${settings.language}`);
      return c.json({
        success: true,
        language: settings.language
      });
    }

    // If no settings found, return default
    console.log('📝 No language preference found, returning default');
    return c.json({
      success: true,
      language: 'en'
    });
  } catch (error) {
    console.error('❌ Error fetching language preference:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch language preference'
    }, 500);
  }
});

// Save user language preference
app.post("/make-server-a3c0b8e9/settings/language", async (c) => {
  try {
    const { userId, language } = await c.req.json();
    console.log(`💾 Saving language preference for user: ${userId}, language: ${language}`);

    // Check if user_settings exists
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ 
          language,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating language preference:', updateError);
        return c.json({
          success: false,
          error: updateError.message
        }, 500);
      }
    } else {
      // Create new settings
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          language
        });

      if (insertError) {
        console.error('❌ Error creating language preference:', insertError);
        return c.json({
          success: false,
          error: insertError.message
        }, 500);
      }
    }

    console.log('✅ Language preference saved successfully');
    return c.json({
      success: true,
      message: 'Language preference saved'
    });
  } catch (error) {
    console.error('❌ Error saving language preference:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save language preference'
    }, 500);
  }
});

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

// Get all notifications for a user
app.get("/make-server-a3c0b8e9/notifications/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🔔 Fetching notifications for user: ${userId}`);

    // Fetch notifications from KV store
    const notificationsData = await kv.getByPrefix(`notification:${userId}:`);
    
    if (!notificationsData || notificationsData.length === 0) {
      console.log('📝 No notifications found');
      return c.json({ 
        success: true, 
        notifications: [] 
      });
    }

    // Parse and sort notifications
    const notifications = notificationsData
      .map(item => JSON.parse(item))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`✅ Fetched ${notifications.length} notifications`);
    return c.json({ 
      success: true, 
      notifications 
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch notifications' 
    }, 500);
  }
});

// Create a new notification
app.post("/make-server-a3c0b8e9/notifications", async (c) => {
  try {
    const { userId, type, title, message, priority, actionable, avatar } = await c.req.json();
    console.log(`🔔 Creating notification for user: ${userId}`);

    if (!userId || !type || !title || !message) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, 400);
    }

    const notificationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      id: notificationId,
      userId,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: priority || 'medium',
      actionable: actionable || null,
      avatar: avatar || null
    };

    // Store notification in KV store
    await kv.set(
      `notification:${userId}:${notificationId}`,
      JSON.stringify(notification)
    );

    console.log('✅ Notification created successfully');
    return c.json({ 
      success: true, 
      notification 
    });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create notification' 
    }, 500);
  }
});

// Mark a notification as read
app.put("/make-server-a3c0b8e9/notifications/:id/read", async (c) => {
  try {
    const notificationId = c.req.param('id');
    const { userId } = await c.req.json();
    console.log(`🔔 Marking notification as read: ${notificationId}`);

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID is required' 
      }, 400);
    }

    const key = `notification:${userId}:${notificationId}`;
    const data = await kv.get(key);

    if (!data) {
      return c.json({ 
        success: false, 
        error: 'Notification not found' 
      }, 404);
    }

    const notification = JSON.parse(data);
    notification.isRead = true;

    await kv.set(key, JSON.stringify(notification));

    console.log('✅ Notification marked as read');
    return c.json({ 
      success: true, 
      notification 
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark notification as read' 
    }, 500);
  }
});

// Mark all notifications as read for a user
app.put("/make-server-a3c0b8e9/notifications/read-all/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🔔 Marking all notifications as read for user: ${userId}`);

    // Fetch all notifications for the user
    const notificationsData = await kv.getByPrefix(`notification:${userId}:`);

    if (!notificationsData || notificationsData.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No notifications to mark as read' 
      });
    }

    // Mark all as read
    const updatePromises = notificationsData.map(async (item) => {
      const notification = JSON.parse(item);
      notification.isRead = true;
      const key = `notification:${userId}:${notification.id}`;
      return kv.set(key, JSON.stringify(notification));
    });

    await Promise.all(updatePromises);

    console.log(`✅ Marked ${notificationsData.length} notifications as read`);
    return c.json({ 
      success: true, 
      message: `Marked ${notificationsData.length} notifications as read` 
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark all notifications as read' 
    }, 500);
  }
});

// Delete a notification
app.delete("/make-server-a3c0b8e9/notifications/:id", async (c) => {
  try {
    const notificationId = c.req.param('id');
    const userId = c.req.query('userId');
    console.log(`🔔 Deleting notification: ${notificationId}`);

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID is required' 
      }, 400);
    }

    const key = `notification:${userId}:${notificationId}`;
    await kv.del(key);

    console.log('✅ Notification deleted');
    return c.json({ 
      success: true, 
      message: 'Notification deleted' 
    });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete notification' 
    }, 500);
  }
});

// Clear all notifications for a user
app.delete("/make-server-a3c0b8e9/notifications/clear-all/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🔔 Clearing all notifications for user: ${userId}`);

    // Fetch all notification keys
    const notificationsData = await kv.getByPrefix(`notification:${userId}:`);

    if (!notificationsData || notificationsData.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No notifications to clear' 
      });
    }

    // Delete all notifications
    const deletePromises = notificationsData.map((item) => {
      const notification = JSON.parse(item);
      return kv.del(`notification:${userId}:${notification.id}`);
    });

    await Promise.all(deletePromises);

    console.log(`✅ Cleared ${notificationsData.length} notifications`);
    return c.json({ 
      success: true, 
      message: `Cleared ${notificationsData.length} notifications` 
    });
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to clear notifications' 
    }, 500);
  }
});

// ============================================================================
// USER PROFILE & SETTINGS ROUTES
// ============================================================================

// Get user profile
app.get("/make-server-a3c0b8e9/user/profile/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`👤 Fetching profile for user: ${userId}`);

    // Get user data from KV store
    const userData = await kv.get(`user:${userId}`);
    
    if (!userData) {
      console.error('❌ User not found in KV store');
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Get user profile from KV store
    const profileData = await kv.get(`user_profile:${userId}`);
    const profile = profileData ? (typeof profileData === 'string' ? JSON.parse(profileData) : profileData) : {};

    const userProfile = {
      id: user.id,
      email: user.email,
      userType: user.user_type,
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      age: profile?.age || '',
      occupation: profile?.occupation || '',
      location: profile?.location || '',
      phoneNumber: profile?.phoneNumber || '',
      dateJoined: new Date(user.created_at).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      })
    };

    console.log('✅ Profile fetched successfully');
    return c.json({ 
      success: true, 
      profile: userProfile 
    });
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch profile' 
    }, 500);
  }
});

// Update user profile
app.put("/make-server-a3c0b8e9/user/profile", async (c) => {
  try {
    const { userId, firstName, lastName, email, age, occupation, location, phoneNumber } = await c.req.json();
    console.log(`👤 Updating profile for user: ${userId}`);

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID is required' 
      }, 400);
    }

    // Get existing user data from KV store
    const userData = await kv.get(`user:${userId}`);
    if (!userData) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Update user email if provided
    if (email && email !== user.email) {
      // Remove old email mapping
      await kv.del(`user:email:${user.email}`);
      
      // Update user object
      user.email = email;
      user.updated_at = new Date().toISOString();
      
      // Store updated user
      await kv.set(`user:${userId}`, user);
      await kv.set(`user:email:${email}`, user);
      
      console.log('✅ User email updated');
    }

    // Get existing profile or create new one
    const existingProfileData = await kv.get(`user_profile:${userId}`);
    const existingProfile = existingProfileData ? (typeof existingProfileData === 'string' ? JSON.parse(existingProfileData) : existingProfileData) : {};

    // Update profile data
    const updatedProfile = {
      ...existingProfile,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      age,
      occupation,
      location,
      phoneNumber,
      updated_at: new Date().toISOString()
    };

    // Store updated profile in KV store
    await kv.set(`user_profile:${userId}`, updatedProfile);

    console.log('✅ Profile updated successfully');
    return c.json({ 
      success: true, 
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update profile' 
    }, 500);
  }
});

// Change password
app.put("/make-server-a3c0b8e9/user/password", async (c) => {
  try {
    const { userId, currentPassword, newPassword } = await c.req.json();
    console.log(`🔒 Changing password for user: ${userId}`);

    if (!userId || !currentPassword || !newPassword) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, 400);
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return c.json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
      }, 400);
    }

    // Get user from KV store
    const userData = await kv.get(`user:${userId}`);
    
    if (!userData) {
      console.error('❌ User not found');
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      console.error('❌ Invalid current password');
      return c.json({ 
        success: false, 
        error: 'Current password is incorrect' 
      }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in user object
    user.password_hash = newPasswordHash;
    user.updated_at = new Date().toISOString();

    // Store updated user in KV store
    await kv.set(`user:${userId}`, user);
    await kv.set(`user:email:${user.email}`, user);

    console.log('✅ Password changed successfully');
    return c.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('❌ Error changing password:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to change password' 
    }, 500);
  }
});

// Get user settings (notifications, privacy, app settings)
app.get("/make-server-a3c0b8e9/user/settings/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`⚙️ Fetching settings for user: ${userId}`);

    // Get settings from user_settings table
    const { data: dbSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get additional settings from KV store
    const kvSettingsData = await kv.get(`user_settings:${userId}`);
    const kvSettings = kvSettingsData ? JSON.parse(kvSettingsData) : {};

    const settings = {
      notifications: {
        pushNotifications: kvSettings.pushNotifications ?? true,
        emailNotifications: kvSettings.emailNotifications ?? true,
        moodReminders: kvSettings.moodReminders ?? true,
        weeklyReports: kvSettings.weeklyReports ?? false,
        therapistMessages: kvSettings.therapistMessages ?? true,
        programUpdates: kvSettings.programUpdates ?? true
      },
      privacy: {
        profileVisibility: kvSettings.profileVisibility || 'therapists-only',
        dataSharing: kvSettings.dataSharing ?? false,
        analyticsTracking: kvSettings.analyticsTracking ?? true,
        marketingEmails: kvSettings.marketingEmails ?? false
      },
      app: {
        language: dbSettings?.language || 'en',
        theme: kvSettings.theme || 'auto',
        timezone: kvSettings.timezone || 'America/Los_Angeles'
      }
    };

    console.log('✅ Settings fetched successfully');
    return c.json({ 
      success: true, 
      settings 
    });
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch settings' 
    }, 500);
  }
});

// Update user settings
app.put("/make-server-a3c0b8e9/user/settings", async (c) => {
  try {
    const { userId, notifications, privacy, app } = await c.req.json();
    console.log(`⚙️ Updating settings for user: ${userId}`);

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID is required' 
      }, 400);
    }

    // Update language in user_settings table
    if (app?.language) {
      // Check if settings exist
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingSettings) {
        // Update existing settings
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            language: app.language,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('⚠️ Error updating language:', updateError);
        }
      } else {
        // Insert new settings
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            language: app.language,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('⚠️ Error creating settings:', insertError);
        }
      }
    }

    // Store all settings in KV store
    const allSettings = {
      ...notifications,
      ...privacy,
      theme: app?.theme,
      timezone: app?.timezone,
      updated_at: new Date().toISOString()
    };

    await kv.set(`user_settings:${userId}`, JSON.stringify(allSettings));

    console.log('✅ Settings updated successfully');
    return c.json({ 
      success: true, 
      message: 'Settings updated successfully' 
    });
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update settings' 
    }, 500);
  }
});

// Delete user account
app.delete("/make-server-a3c0b8e9/user/account/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🗑️ Deleting account for user: ${userId}`);

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID is required' 
      }, 400);
    }

    // Get user to find email
    const userData = await kv.get(`user:${userId}`);
    if (userData) {
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      
      // Delete user by email mapping
      await kv.del(`user:email:${user.email}`);
    }

    // Delete user from KV store
    await kv.del(`user:${userId}`);

    // Delete user profile from KV store
    await kv.del(`user_profile:${userId}`);
    await kv.del(`therapist_profile:${userId}`);
    
    // Delete user settings from KV store
    await kv.del(`user_settings:${userId}`);
    
    // Delete questionnaire data
    await kv.del(`questionnaire:${userId}`);
    
    // Delete email verification data
    const verificationData = await kv.getByPrefix(`email_verification:`);
    if (verificationData && verificationData.length > 0) {
      for (const item of verificationData) {
        const verification = typeof item === 'string' ? JSON.parse(item) : item;
        if (verification.user_id === userId) {
          await kv.del(`email_verification:${verification.email}`);
        }
      }
    }

    // Delete notifications
    const notificationsData = await kv.getByPrefix(`notification:${userId}:`);
    if (notificationsData && notificationsData.length > 0) {
      const deletePromises = notificationsData.map((item) => {
        const notification = typeof item === 'string' ? JSON.parse(item) : item;
        return kv.del(`notification:${userId}:${notification.id}`);
      });
      await Promise.all(deletePromises);
    }

    // Delete from Supabase tables (mood entries, lessons, conversations, etc.)
    // These are actual feature data tables that should be deleted
    await supabase
      .from('mood_entries')
      .delete()
      .eq('user_id', userId);
      
    await supabase
      .from('lesson_progress')
      .delete()
      .eq('user_id', userId);
      
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId);
      
    await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);
      
    await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', userId);

    console.log('✅ Account deleted successfully');
    return c.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete account' 
    }, 500);
  }
});

// ============================================================================
// PROFILE PICTURE ROUTES
// ============================================================================

// Upload profile picture
app.post("/make-server-a3c0b8e9/user/profile-picture/upload", async (c) => {
  try {
    const { userId, imageData, fileName } = await c.req.json();
    console.log(`📷 Uploading profile picture for user: ${userId}`);

    if (!userId || !imageData) {
      return c.json({ 
        success: false, 
        error: 'User ID and image data are required' 
      }, 400);
    }

    // Create profile-pictures bucket if it doesn't exist
    const bucketName = 'make-a3c0b8e9-profile-pictures';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log('📦 Creating profile pictures bucket...');
      await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 5242880 // 5MB
      });
    }

    // Convert base64 to binary
    const base64Data = imageData.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Generate unique filename
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${userId}/${Date.now()}.${fileExtension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uniqueFileName, binaryData, {
        contentType: `image/${fileExtension}`,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Error uploading file:', uploadError);
      return c.json({ 
        success: false, 
        error: uploadError.message 
      }, 500);
    }

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(uniqueFileName, 31536000); // 1 year

    if (!urlData?.signedUrl) {
      return c.json({ 
        success: false, 
        error: 'Failed to generate signed URL' 
      }, 500);
    }

    // Store URL in KV store
    await kv.set(`profile_picture:${userId}`, JSON.stringify({
      url: urlData.signedUrl,
      fileName: uniqueFileName,
      uploadedAt: new Date().toISOString()
    }));

    console.log('✅ Profile picture uploaded successfully');
    return c.json({ 
      success: true, 
      url: urlData.signedUrl 
    });
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to upload profile picture' 
    }, 500);
  }
});

// Get profile picture URL
app.get("/make-server-a3c0b8e9/user/profile-picture/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`📷 Fetching profile picture for user: ${userId}`);

    const pictureData = await kv.get(`profile_picture:${userId}`);
    
    if (!pictureData) {
      return c.json({ 
        success: true, 
        url: null 
      });
    }

    const picture = JSON.parse(pictureData);
    
    // Check if URL is expired and regenerate if needed
    const uploadedAt = new Date(picture.uploadedAt).getTime();
    const now = Date.now();
    const oneYear = 31536000000; // 1 year in milliseconds
    
    if (now - uploadedAt > oneYear * 0.9) { // Regenerate at 90% of expiry
      console.log('🔄 Regenerating expired signed URL...');
      const bucketName = 'make-a3c0b8e9-profile-pictures';
      const { data: urlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(picture.fileName, 31536000);
      
      if (urlData?.signedUrl) {
        picture.url = urlData.signedUrl;
        picture.uploadedAt = new Date().toISOString();
        await kv.set(`profile_picture:${userId}`, JSON.stringify(picture));
      }
    }

    return c.json({ 
      success: true, 
      url: picture.url 
    });
  } catch (error) {
    console.error('❌ Error fetching profile picture:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch profile picture' 
    }, 500);
  }
});

// ============================================================================
// EMAIL VERIFICATION ROUTES (for email change)
// ============================================================================

// Request email change
app.post("/make-server-a3c0b8e9/user/email/change-request", async (c) => {
  try {
    const { userId, currentEmail, newEmail } = await c.req.json();
    console.log(`📧 Email change request from ${currentEmail} to ${newEmail}`);

    if (!userId || !currentEmail || !newEmail) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, 400);
    }

    // Check if new email is already in use
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', newEmail)
      .single();

    if (existingUser) {
      return c.json({ 
        success: false, 
        error: 'Email is already in use' 
      }, 400);
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store pending email change
    await kv.set(`email_change:${userId}`, JSON.stringify({
      currentEmail,
      newEmail,
      verificationCode,
      expiresAt: expiresAt.toISOString()
    }));

    console.log(`📧 Verification code for email change: ${verificationCode}`);

    return c.json({ 
      success: true, 
      message: 'Verification code sent to new email',
      verificationCode // For development only - remove in production
    });
  } catch (error) {
    console.error('❌ Error requesting email change:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to request email change' 
    }, 500);
  }
});

// Verify email change
app.post("/make-server-a3c0b8e9/user/email/verify-change", async (c) => {
  try {
    const { userId, verificationCode } = await c.req.json();
    console.log(`✅ Verifying email change for user: ${userId}`);

    if (!userId || !verificationCode) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, 400);
    }

    // Get pending email change
    const pendingChangeData = await kv.get(`email_change:${userId}`);
    
    if (!pendingChangeData) {
      return c.json({ 
        success: false, 
        error: 'No pending email change found' 
      }, 404);
    }

    const pendingChange = JSON.parse(pendingChangeData);

    // Check if expired
    if (new Date(pendingChange.expiresAt) < new Date()) {
      await kv.del(`email_change:${userId}`);
      return c.json({ 
        success: false, 
        error: 'Verification code expired' 
      }, 400);
    }

    // Verify code
    if (pendingChange.verificationCode !== verificationCode) {
      return c.json({ 
        success: false, 
        error: 'Invalid verification code' 
      }, 400);
    }

    // Update email in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ email: pendingChange.newEmail })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating email:', updateError);
      return c.json({ 
        success: false, 
        error: updateError.message 
      }, 500);
    }

    // Delete pending change
    await kv.del(`email_change:${userId}`);

    console.log('✅ Email changed successfully');
    return c.json({ 
      success: true, 
      message: 'Email changed successfully',
      newEmail: pendingChange.newEmail
    });
  } catch (error) {
    console.error('❌ Error verifying email change:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify email change' 
    }, 500);
  }
});

// ============================================================================
// TWO-FACTOR AUTHENTICATION ROUTES
// ============================================================================

// Get 2FA status
app.get("/make-server-a3c0b8e9/user/2fa/status/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`🔐 Fetching 2FA status for user: ${userId}`);

    const twoFaData = await kv.get(`2fa:${userId}`);
    
    if (!twoFaData) {
      return c.json({ 
        success: true, 
        enabled: false 
      });
    }

    const twoFa = JSON.parse(twoFaData);

    return c.json({ 
      success: true, 
      enabled: twoFa.enabled,
      method: twoFa.method || 'app'
    });
  } catch (error) {
    console.error('❌ Error fetching 2FA status:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch 2FA status' 
    }, 500);
  }
});

// Setup 2FA (generate secret)
app.post("/make-server-a3c0b8e9/user/2fa/setup", async (c) => {
  try {
    const { userId, email } = await c.req.json();
    console.log(`🔐 Setting up 2FA for user: ${userId}`);

    if (!userId || !email) {
      return c.json({ 
        success: false, 
        error: 'User ID and email are required' 
      }, 400);
    }

    // Generate a simple secret (in production, use proper TOTP library)
    const secret = Array.from({ length: 32 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
    ).join('');

    // Generate QR code URL for authenticator apps
    const appName = 'Therafam';
    const qrCodeUrl = `otpauth://totp/${appName}:${email}?secret=${secret}&issuer=${appName}`;

    // Store temporary setup data
    await kv.set(`2fa_setup:${userId}`, JSON.stringify({
      secret,
      qrCodeUrl,
      createdAt: new Date().toISOString()
    }));

    console.log('✅ 2FA setup initiated');
    return c.json({ 
      success: true, 
      secret,
      qrCodeUrl
    });
  } catch (error) {
    console.error('❌ Error setting up 2FA:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to setup 2FA' 
    }, 500);
  }
});

// Verify and enable 2FA
app.post("/make-server-a3c0b8e9/user/2fa/verify-enable", async (c) => {
  try {
    const { userId, code } = await c.req.json();
    console.log(`🔐 Verifying 2FA code for user: ${userId}`);

    if (!userId || !code) {
      return c.json({ 
        success: false, 
        error: 'User ID and code are required' 
      }, 400);
    }

    // Get setup data
    const setupData = await kv.get(`2fa_setup:${userId}`);
    
    if (!setupData) {
      return c.json({ 
        success: false, 
        error: 'No 2FA setup found. Please start setup again.' 
      }, 404);
    }

    const setup = JSON.parse(setupData);

    // For demo purposes, accept any 6-digit code
    // In production, verify against TOTP algorithm
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      return c.json({ 
        success: false, 
        error: 'Invalid code format' 
      }, 400);
    }

    // Enable 2FA
    await kv.set(`2fa:${userId}`, JSON.stringify({
      enabled: true,
      secret: setup.secret,
      method: 'app',
      enabledAt: new Date().toISOString()
    }));

    // Delete setup data
    await kv.del(`2fa_setup:${userId}`);

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    await kv.set(`2fa_backup:${userId}`, JSON.stringify({
      codes: backupCodes.map(code => ({ code, used: false }))
    }));

    console.log('✅ 2FA enabled successfully');
    return c.json({ 
      success: true, 
      message: '2FA enabled successfully',
      backupCodes
    });
  } catch (error) {
    console.error('❌ Error enabling 2FA:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to enable 2FA' 
    }, 500);
  }
});

// Disable 2FA
app.post("/make-server-a3c0b8e9/user/2fa/disable", async (c) => {
  try {
    const { userId, password } = await c.req.json();
    console.log(`🔐 Disabling 2FA for user: ${userId}`);

    if (!userId || !password) {
      return c.json({ 
        success: false, 
        error: 'User ID and password are required' 
      }, 400);
    }

    // Verify password
    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (!user) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Invalid password' 
      }, 401);
    }

    // Delete 2FA data
    await kv.del(`2fa:${userId}`);
    await kv.del(`2fa_backup:${userId}`);

    console.log('✅ 2FA disabled successfully');
    return c.json({ 
      success: true, 
      message: '2FA disabled successfully' 
    });
  } catch (error) {
    console.error('❌ Error disabling 2FA:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to disable 2FA' 
    }, 500);
  }
});

// ============================================================================
// THERAPIST ROUTES
// ============================================================================

// Get all therapists
app.get("/make-server-a3c0b8e9/therapists", async (c) => {
  try {
    console.log('👨‍⚕️ Fetching all therapists');

    // Get all therapist profiles from KV store
    const therapistKeys = await kv.getByPrefix('therapist:');
    
    if (!therapistKeys || therapistKeys.length === 0) {
      console.log('⚠️ No therapists found, returning sample data');
      
      // Return sample therapists if none exist
      const sampleTherapists = [
        {
          id: '1',
          name: 'Dr. Sarah Johnson',
          specialty: 'Anxiety & Depression',
          avatar: null,
          bio: 'Licensed therapist with 10+ years of experience in treating anxiety and depression.',
          credentials: 'PhD in Clinical Psychology',
          availability: 'Mon-Fri, 9AM-5PM'
        },
        {
          id: '2',
          name: 'Dr. Michael Chen',
          specialty: 'Cognitive Behavioral Therapy',
          avatar: null,
          bio: 'Specialized in CBT techniques for mental health improvement.',
          credentials: 'Licensed Clinical Psychologist',
          availability: 'Tue-Sat, 10AM-6PM'
        },
        {
          id: '3',
          name: 'Dr. Emily Rodriguez',
          specialty: 'Trauma & PTSD',
          avatar: null,
          bio: 'Expert in trauma-focused therapy and PTSD treatment.',
          credentials: 'LCSW, Trauma Specialist',
          availability: 'Mon-Thu, 11AM-7PM'
        },
        {
          id: '4',
          name: 'Dr. David Thompson',
          specialty: 'Relationship Counseling',
          avatar: null,
          bio: 'Helping couples and individuals improve their relationships.',
          credentials: 'LMFT, Couples Therapy Specialist',
          availability: 'Wed-Sun, 12PM-8PM'
        },
        {
          id: '5',
          name: 'Dr. Lisa Wang',
          specialty: 'Mindfulness & Meditation',
          avatar: null,
          bio: 'Integrating mindfulness practices with traditional therapy.',
          credentials: 'PhD in Psychology, Certified Mindfulness Instructor',
          availability: 'Mon-Fri, 8AM-4PM'
        }
      ];
      
      return c.json({ 
        success: true, 
        data: sampleTherapists 
      });
    }

    const therapists = therapistKeys.map(therapist => JSON.parse(therapist));
    
    console.log(`✅ Fetched ${therapists.length} therapists`);
    return c.json({ 
      success: true, 
      data: therapists 
    });
  } catch (error) {
    console.error('❌ Error fetching therapists:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch therapists' 
    }, 500);
  }
});

// Get single therapist by ID
app.get("/make-server-a3c0b8e9/therapists/:therapistId", async (c) => {
  try {
    const therapistId = c.req.param('therapistId');
    console.log(`👨‍⚕�� Fetching therapist: ${therapistId}`);

    const therapistData = await kv.get(`therapist:${therapistId}`);
    
    if (!therapistData) {
      // Return sample data for the requested ID if not found
      const sampleTherapists: Record<string, any> = {
        '1': {
          id: '1',
          name: 'Dr. Sarah Johnson',
          specialty: 'Anxiety & Depression',
          avatar: null,
          bio: 'Licensed therapist with 10+ years of experience in treating anxiety and depression.',
          credentials: 'PhD in Clinical Psychology',
          availability: 'Mon-Fri, 9AM-5PM',
          experience: '10+ years',
          rating: 4.9,
          reviewCount: 127
        },
        '2': {
          id: '2',
          name: 'Dr. Michael Chen',
          specialty: 'Cognitive Behavioral Therapy',
          avatar: null,
          bio: 'Specialized in CBT techniques for mental health improvement.',
          credentials: 'Licensed Clinical Psychologist',
          availability: 'Tue-Sat, 10AM-6PM',
          experience: '8 years',
          rating: 4.8,
          reviewCount: 95
        },
        '3': {
          id: '3',
          name: 'Dr. Emily Rodriguez',
          specialty: 'Trauma & PTSD',
          avatar: null,
          bio: 'Expert in trauma-focused therapy and PTSD treatment.',
          credentials: 'LCSW, Trauma Specialist',
          availability: 'Mon-Thu, 11AM-7PM',
          experience: '12 years',
          rating: 4.9,
          reviewCount: 143
        },
        '4': {
          id: '4',
          name: 'Dr. David Thompson',
          specialty: 'Relationship Counseling',
          avatar: null,
          bio: 'Helping couples and individuals improve their relationships.',
          credentials: 'LMFT, Couples Therapy Specialist',
          availability: 'Wed-Sun, 12PM-8PM',
          experience: '15 years',
          rating: 4.7,
          reviewCount: 88
        },
        '5': {
          id: '5',
          name: 'Dr. Lisa Wang',
          specialty: 'Mindfulness & Meditation',
          avatar: null,
          bio: 'Integrating mindfulness practices with traditional therapy.',
          credentials: 'PhD in Psychology, Certified Mindfulness Instructor',
          availability: 'Mon-Fri, 8AM-4PM',
          experience: '7 years',
          rating: 5.0,
          reviewCount: 156
        }
      };
      
      const therapist = sampleTherapists[therapistId];
      
      if (!therapist) {
        return c.json({ 
          success: false, 
          error: 'Therapist not found' 
        }, 404);
      }
      
      return c.json({ 
        success: true, 
        data: therapist 
      });
    }

    const therapist = JSON.parse(therapistData);
    
    console.log('✅ Therapist fetched successfully');
    return c.json({ 
      success: true, 
      data: therapist 
    });
  } catch (error) {
    console.error('❌ Error fetching therapist:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch therapist' 
    }, 500);
  }
});

// Save/Create therapist
app.post("/make-server-a3c0b8e9/therapists", async (c) => {
  try {
    const therapistData = await c.req.json();
    console.log(`👨‍⚕️ Creating therapist: ${therapistData.name}`);

    const therapistId = therapistData.id || `therapist_${Date.now()}`;
    const therapist = {
      ...therapistData,
      id: therapistId,
      createdAt: new Date().toISOString()
    };

    await kv.set(`therapist:${therapistId}`, JSON.stringify(therapist));

    console.log('✅ Therapist created successfully');
    return c.json({ 
      success: true, 
      data: therapist 
    });
  } catch (error) {
    console.error('❌ Error creating therapist:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create therapist' 
    }, 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  // Using Web Crypto API for password hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured. Email not sent.');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Therafam <noreply@therafam.com>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Resend API error:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('✅ Email sent successfully:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// THERAPIST CHAT ROUTES
// ============================================================================

// Send a message in therapist chat
app.post("/make-server-a3c0b8e9/therapist-chat/send", async (c) => {
  try {
    const { userId, therapistId, text, sender } = await c.req.json();
    console.log(`💬 Sending therapist chat message: ${userId} <-> ${therapistId}`);

    // Generate conversation ID (consistent for both directions)
    const conversationId = [userId, therapistId].sort().join('_');
    
    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create message data
    const message = {
      id: messageId,
      conversation_id: conversationId,
      user_id: userId,
      therapist_id: therapistId,
      text: text,
      sender: sender, // 'user' or 'therapist'
      timestamp: new Date().toISOString(),
      is_read: false
    };

    // Store message in KV store
    await kv.set(`therapist_chat_message:${conversationId}:${messageId}`, JSON.stringify(message));
    
    // Update conversation metadata (last message, timestamp)
    const conversationMeta = {
      id: conversationId,
      user_id: userId,
      therapist_id: therapistId,
      last_message: text,
      last_message_time: new Date().toISOString(),
      last_sender: sender
    };
    
    await kv.set(`therapist_chat_conversation:${conversationId}`, JSON.stringify(conversationMeta));

    console.log('✅ Message sent successfully');
    return c.json({ 
      success: true, 
      data: message 
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send message' 
    }, 500);
  }
});

// Get messages for a therapist chat conversation
app.get("/make-server-a3c0b8e9/therapist-chat/messages/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const limit = parseInt(c.req.query('limit') || '100');
    console.log(`💬 Fetching messages for conversation: ${conversationId}`);

    // Get all messages for this conversation
    const messagesData = await kv.getByPrefix(`therapist_chat_message:${conversationId}:`);
    
    if (!messagesData || messagesData.length === 0) {
      console.log('💬 No messages found, returning empty array');
      return c.json({ 
        success: true, 
        data: [] 
      });
    }

    // Parse and sort by timestamp (oldest first)
    const messages = messagesData
      .map(data => JSON.parse(data))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit); // Get last N messages

    console.log(`✅ Fetched ${messages.length} messages`);
    return c.json({ 
      success: true, 
      data: messages 
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch messages' 
    }, 500);
  }
});

// Get all conversations for a user (therapist or patient)
app.get("/make-server-a3c0b8e9/therapist-chat/conversations/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const userType = c.req.query('userType') || 'user'; // 'user' or 'therapist'
    console.log(`💬 Fetching conversations for ${userType}: ${userId}`);

    // Get all conversation metadata
    const conversationsData = await kv.getByPrefix('therapist_chat_conversation:');
    
    if (!conversationsData || conversationsData.length === 0) {
      return c.json({ 
        success: true, 
        data: [] 
      });
    }

    // Filter conversations for this user
    const conversations = conversationsData
      .map(data => JSON.parse(data))
      .filter(conv => {
        if (userType === 'therapist') {
          return conv.therapist_id === userId;
        } else {
          return conv.user_id === userId;
        }
      })
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

    console.log(`✅ Fetched ${conversations.length} conversations`);
    return c.json({ 
      success: true, 
      data: conversations 
    });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch conversations' 
    }, 500);
  }
});

// Mark messages as read
app.put("/make-server-a3c0b8e9/therapist-chat/mark-read/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { userId } = await c.req.json();
    console.log(`💬 Marking messages as read for conversation: ${conversationId}`);

    // Get all messages for this conversation
    const messagesData = await kv.getByPrefix(`therapist_chat_message:${conversationId}:`);
    
    if (!messagesData || messagesData.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No messages to mark as read' 
      });
    }

    // Mark messages as read (only messages sent TO this user)
    const updatePromises = messagesData.map(async (data) => {
      const message = JSON.parse(data);
      // Only mark as read if this user is the recipient
      if ((message.sender === 'therapist' && message.user_id === userId) ||
          (message.sender === 'user' && message.therapist_id === userId)) {
        message.is_read = true;
        return kv.set(`therapist_chat_message:${conversationId}:${message.id}`, JSON.stringify(message));
      }
    });

    await Promise.all(updatePromises.filter(p => p !== undefined));

    console.log('✅ Messages marked as read');
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error marking messages as read:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark messages as read' 
    }, 500);
  }
});

// ============================================================================
// CALL SESSION ROUTES
// ============================================================================

// Start a new call session
app.post("/make-server-a3c0b8e9/calls/start", async (c) => {
  try {
    const { userId, participantId, participantName, callType, userType } = await c.req.json();
    console.log(`📞 Starting ${callType} call: ${userId} -> ${participantId}`);

    // Generate unique session ID
    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create call session data
    const callSession = {
      id: sessionId,
      user_id: userId,
      participant_id: participantId,
      participant_name: participantName,
      call_type: callType, // 'video' or 'voice'
      user_type: userType, // 'therapist' or 'patient'
      start_time: new Date().toISOString(),
      end_time: null,
      duration_seconds: 0,
      status: 'started'
    };

    // Store in KV store
    await kv.set(`call_session:${sessionId}`, JSON.stringify(callSession));
    
    // Also store in user's call history for easy lookup
    await kv.set(`call_history:${userId}:${sessionId}`, JSON.stringify(callSession));
    await kv.set(`call_history:${participantId}:${sessionId}`, JSON.stringify(callSession));

    console.log('✅ Call session started:', sessionId);
    return c.json({ 
      success: true, 
      sessionId,
      data: callSession
    });
  } catch (error) {
    console.error('❌ Error starting call session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to start call session' 
    }, 500);
  }
});

// End a call session
app.put("/make-server-a3c0b8e9/calls/end/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const { durationSeconds } = await c.req.json();
    console.log(`📞 Ending call session: ${sessionId}, duration: ${durationSeconds}s`);

    // Get existing session
    const sessionData = await kv.get(`call_session:${sessionId}`);
    
    if (!sessionData) {
      console.error('❌ Call session not found:', sessionId);
      return c.json({ 
        success: false, 
        error: 'Call session not found' 
      }, 404);
    }

    const callSession = JSON.parse(sessionData);
    
    // Update session with end time and duration
    callSession.end_time = new Date().toISOString();
    callSession.duration_seconds = durationSeconds || 0;
    callSession.status = 'completed';

    // Update in all locations
    await kv.set(`call_session:${sessionId}`, JSON.stringify(callSession));
    await kv.set(`call_history:${callSession.user_id}:${sessionId}`, JSON.stringify(callSession));
    await kv.set(`call_history:${callSession.participant_id}:${sessionId}`, JSON.stringify(callSession));

    console.log('✅ Call session ended:', sessionId);
    return c.json({ 
      success: true,
      data: callSession
    });
  } catch (error) {
    console.error('❌ Error ending call session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to end call session' 
    }, 500);
  }
});

// Get call history for a user
app.get("/make-server-a3c0b8e9/calls/history/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    console.log(`📞 Fetching call history for user: ${userId}`);

    // Get all call sessions for this user
    const callHistoryData = await kv.getByPrefix(`call_history:${userId}:`);
    
    if (!callHistoryData || callHistoryData.length === 0) {
      console.log('📞 No call history found');
      return c.json({ 
        success: true, 
        data: [] 
      });
    }

    // Parse and sort by start time (most recent first)
    const callHistory = callHistoryData
      .map(data => JSON.parse(data))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, limit);

    console.log(`✅ Fetched ${callHistory.length} call records`);
    return c.json({ 
      success: true, 
      data: callHistory 
    });
  } catch (error) {
    console.error('❌ Error fetching call history:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch call history' 
    }, 500);
  }
});

// Get specific call session
app.get("/make-server-a3c0b8e9/calls/session/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    console.log(`📞 Fetching call session: ${sessionId}`);

    const sessionData = await kv.get(`call_session:${sessionId}`);
    
    if (!sessionData) {
      return c.json({ 
        success: false, 
        error: 'Call session not found' 
      }, 404);
    }

    const callSession = JSON.parse(sessionData);

    console.log('✅ Call session fetched');
    return c.json({ 
      success: true, 
      data: callSession 
    });
  } catch (error) {
    console.error('❌ Error fetching call session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch call session' 
    }, 500);
  }
});

// ============================================================================
// SELF-HELP PROGRAMS ROUTES
// ============================================================================

// Get all self-help programs
app.get("/make-server-a3c0b8e9/programs", async (c) => {
  try {
    console.log(`📚 Fetching self-help programs`);

    const { data: programs, error } = await supabase
      .from('self_help_programs')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching programs:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // If no programs exist, seed some default ones
    if (!programs || programs.length === 0) {
      console.log('📚 No programs found, seeding default programs...');
      
      const defaultPrograms = [
        {
          title: 'Anxiety Management',
          description: 'Learn techniques to manage anxiety and reduce stress in daily life.',
          category: 'anxiety',
          difficulty_level: 'beginner',
          estimated_duration_days: 28,
          total_lessons: 12,
          is_published: true
        },
        {
          title: 'Mindfulness & Meditation',
          description: 'Develop mindfulness practices to improve focus and emotional regulation.',
          category: 'mindfulness',
          difficulty_level: 'beginner',
          estimated_duration_days: 42,
          total_lessons: 18,
          is_published: true
        },
        {
          title: 'Sleep Better',
          description: 'Improve your sleep quality with evidence-based techniques.',
          category: 'sleep',
          difficulty_level: 'beginner',
          estimated_duration_days: 21,
          total_lessons: 9,
          is_published: true
        },
        {
          title: 'Building Confidence',
          description: 'Strengthen self-esteem and build confidence in social situations.',
          category: 'confidence',
          difficulty_level: 'intermediate',
          estimated_duration_days: 35,
          total_lessons: 15,
          is_published: true
        },
        {
          title: 'Stress Management',
          description: 'Comprehensive strategies to handle stress and prevent burnout.',
          category: 'stress',
          difficulty_level: 'beginner',
          estimated_duration_days: 28,
          total_lessons: 12,
          is_published: true
        }
      ];

      const { data: seededPrograms, error: seedError } = await supabase
        .from('self_help_programs')
        .insert(defaultPrograms)
        .select();

      if (seedError) {
        console.error('⚠️ Error seeding programs:', seedError);
        // Return empty array if seeding fails
        return c.json({ success: true, data: [] });
      }

      console.log(`✅ Seeded ${seededPrograms?.length || 0} default programs`);
      return c.json({ success: true, data: seededPrograms || [] });
    }

    console.log(`✅ Fetched ${programs?.length || 0} programs`);
    return c.json({ success: true, data: programs || [] });
  } catch (error) {
    console.error('❌ Programs fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch programs' 
    }, 500);
  }
});

// Get program progress for a user
app.get("/make-server-a3c0b8e9/programs/progress/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`📚 Fetching program progress for user: ${userId}`);

    const { data: progress, error } = await supabase
      .from('lesson_progress')
      .select('program_id, status, progress_percentage, program_started_at, program_completed_at')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching program progress:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    console.log(`✅ Fetched program progress`);
    return c.json({ success: true, data: progress || [] });
  } catch (error) {
    console.error('❌ Program progress fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch program progress' 
    }, 500);
  }
});

// Get lessons for a specific program
app.get("/make-server-a3c0b8e9/programs/:programId/lessons", async (c) => {
  try {
    const programId = c.req.param('programId');
    const userId = c.req.query('userId') || null;
    console.log(`📚 Fetching lessons for program: ${programId}`);

    // Fetch lessons for the program
    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('program_id', programId)
      .order('lesson_number', { ascending: true });

    if (error) {
      console.error('❌ Error fetching lessons:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // If userId provided, fetch their progress for these lessons
    if (userId && lessons && lessons.length > 0) {
      const lessonIds = lessons.map(l => l.id);
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, status, time_spent_minutes')
        .eq('user_id', userId)
        .in('lesson_id', lessonIds);

      // Map progress to lessons
      const progressMap = new Map();
      if (progressData) {
        progressData.forEach(p => {
          progressMap.set(p.lesson_id, p);
        });
      }

      // Enhance lessons with progress data
      const lessonsWithProgress = lessons.map(lesson => {
        const progress = progressMap.get(lesson.id);
        return {
          ...lesson,
          completed: progress?.status === 'completed' || false,
          timeSpent: progress?.time_spent_minutes || 0
        };
      });

      console.log(`��� Fetched ${lessons.length} lessons with progress`);
      return c.json({ success: true, data: lessonsWithProgress });
    }

    console.log(`✅ Fetched ${lessons?.length || 0} lessons`);
    return c.json({ success: true, data: lessons || [] });
  } catch (error) {
    console.error('❌ Lessons fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch lessons' 
    }, 500);
  }
});

// Get specific lesson content by ID
app.get("/make-server-a3c0b8e9/lessons/:lessonId", async (c) => {
  try {
    const lessonId = c.req.param('lessonId');
    const userId = c.req.query('userId') || null;
    console.log(`📖 Fetching lesson content: ${lessonId}`);

    // Fetch lesson
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (error) {
      console.error('❌ Error fetching lesson:', error);
      return c.json({ success: false, error: error.message }, 404);
    }

    if (!lesson) {
      return c.json({ success: false, error: 'Lesson not found' }, 404);
    }

    // Get program details for context
    const { data: program } = await supabase
      .from('self_help_programs')
      .select('title')
      .eq('id', lesson.program_id)
      .single();

    // If userId provided, fetch their progress for this lesson
    let progress = null;
    if (userId) {
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .single();
      
      progress = progressData;
    }

    // Construct complete lesson object
    const lessonContent = {
      ...lesson,
      programTitle: program?.title || 'Self-Help Program',
      progress: progress
    };

    console.log(`✅ Fetched lesson content: ${lesson.title}`);
    return c.json({ success: true, data: lessonContent });
  } catch (error) {
    console.error('❌ Lesson fetch error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch lesson' 
    }, 500);
  }
});

// Seed lessons for a program (development/testing endpoint)
app.post("/make-server-a3c0b8e9/programs/:programId/lessons/seed", async (c) => {
  try {
    const programId = c.req.param('programId');
    console.log(`🌱 Seeding lessons for program: ${programId}`);

    // Check if lessons already exist
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('program_id', programId);

    if (existingLessons && existingLessons.length > 0) {
      console.log(`ℹ️ Lessons already exist for program ${programId}`);
      return c.json({ 
        success: true, 
        message: 'Lessons already exist',
        count: existingLessons.length 
      });
    }

    // Sample lessons based on program ID
    const sampleLessons: any = {
      // These would match program IDs from the database
      '1': [ // Anxiety Management
        {
          title: 'Understanding Anxiety',
          description: 'Learn what anxiety is and how it affects your mind and body.',
          duration_minutes: 15,
          lesson_number: 1,
          content_metadata: {
            objective: 'Understand the nature of anxiety and recognize its physical and mental manifestations.',
            keyTakeaways: [
              'Anxiety is a normal human response that can become problematic',
              'Physical symptoms include rapid heartbeat, sweating, and muscle tension',
              'Mental symptoms include racing thoughts and excessive worry',
              'Understanding anxiety is the first step to managing it effectively'
            ],
            sections: [
              {
                id: 's1',
                type: 'text',
                title: 'What is Anxiety?',
                content: 'Anxiety is your body\'s natural response to stress and potential threats...',
                completed: false
              }
            ]
          }
        },
        {
          title: 'Breathing Techniques',
          description: 'Master deep breathing exercises to calm your nervous system.',
          duration_minutes: 12,
          lesson_number: 2,
          content_metadata: {
            objective: 'Learn and practice effective breathing techniques to reduce anxiety.',
            keyTakeaways: [
              'Deep breathing activates the parasympathetic nervous system',
              'Box breathing is a simple yet powerful technique',
              'Regular practice makes breathing exercises more effective'
            ],
            sections: [
              {
                id: 's1',
                type: 'text',
                title: 'The Power of Breath',
                content: 'Your breath is one of the most powerful tools you have for managing anxiety...',
                completed: false
              }
            ]
          }
        }
      ]
    };

    const lessonsToSeed = sampleLessons[programId] || [];
    
    if (lessonsToSeed.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No sample lessons available for this program',
        count: 0 
      });
    }

    // Add program_id to each lesson
    const lessonsWithProgramId = lessonsToSeed.map((lesson: any) => ({
      ...lesson,
      program_id: programId
    }));

    const { data: seededLessons, error: seedError } = await supabase
      .from('lessons')
      .insert(lessonsWithProgramId)
      .select();

    if (seedError) {
      console.error('⚠️ Error seeding lessons:', seedError);
      return c.json({ 
        success: false, 
        error: seedError.message 
      }, 500);
    }

    console.log(`✅ Seeded ${seededLessons?.length || 0} lessons`);
    return c.json({ 
      success: true, 
      data: seededLessons,
      count: seededLessons?.length || 0
    });
  } catch (error) {
    console.error('❌ Lesson seeding error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to seed lessons' 
    }, 500);
  }
});

// ============================================================================
// DEVELOPMENT SEED ROUTE - Create test therapist account
// ============================================================================

app.post("/make-server-a3c0b8e9/dev/seed-therapist", async (c) => {
  try {
    console.log('🌱 Seeding test therapist account...');
    
    const testEmail = 'therapist@test.com';
    const testPassword = 'Test1234!';
    
    // Check if therapist already exists
    const existing = await kv.get(`user:email:${testEmail}`);
    if (existing) {
      console.log('✅ Test therapist already exists');
      return c.json({ 
        success: true, 
        message: 'Test therapist already exists',
        credentials: {
          email: testEmail,
          password: testPassword
        }
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(testPassword);
    
    // Create user ID
    const userId = crypto.randomUUID();
    
    // Create therapist user
    const therapistUser = {
      id: userId,
      email: testEmail,
      password_hash: passwordHash,
      user_type: 'therapist',
      is_verified: true, // Auto-verify for testing
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null
    };
    
    // Store user
    await kv.set(`user:${userId}`, therapistUser);
    await kv.set(`user:email:${testEmail}`, therapistUser);
    
    // Create therapist profile
    const therapistProfile = {
      user_id: userId,
      first_name: 'Dr. Sarah',
      last_name: 'Johnson',
      phone_number: '+1 555-0123',
      license_type: 'clinical-psychologist',
      license_number: 'PSY12345',
      license_state: 'CA',
      years_experience: 10,
      specializations: ['anxiety-disorders'],
      bio: 'Experienced clinical psychologist specializing in anxiety and depression treatment.',
      is_verified: true,
      is_accepting_clients: true,
      created_at: new Date().toISOString()
    };
    
    await kv.set(`therapist_profile:${userId}`, therapistProfile);
    
    console.log('✅ Test therapist account created successfully');
    return c.json({ 
      success: true,
      message: 'Test therapist account created and verified',
      credentials: {
        email: testEmail,
        password: testPassword
      },
      userId: userId
    });
  } catch (error) {
    console.error('❌ Seed therapist error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to seed therapist' 
    }, 500);
  }
});

// ============================================================================
// DEVELOPMENT SEED ROUTE - Create test client account
// ============================================================================

app.post("/make-server-a3c0b8e9/dev/seed-client", async (c) => {
  try {
    console.log('🌱 Seeding test client account...');
    
    const testEmail = 'client@test.com';
    const testPassword = 'Test1234!';
    
    // Check if client already exists
    const existing = await kv.get(`user:email:${testEmail}`);
    if (existing) {
      console.log('✅ Test client already exists');
      return c.json({ 
        success: true, 
        message: 'Test client already exists',
        credentials: {
          email: testEmail,
          password: testPassword
        }
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(testPassword);
    
    // Create user ID
    const userId = crypto.randomUUID();
    
    // Create client user
    const clientUser = {
      id: userId,
      email: testEmail,
      password_hash: passwordHash,
      user_type: 'client',
      is_verified: true, // Auto-verify for testing
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null
    };
    
    // Store user
    await kv.set(`user:${userId}`, clientUser);
    await kv.set(`user:email:${testEmail}`, clientUser);
    
    // Create client profile
    const clientProfile = {
      user_id: userId,
      first_name: 'Test',
      last_name: 'User',
      created_at: new Date().toISOString()
    };
    
    await kv.set(`user_profile:${userId}`, clientProfile);
    
    console.log('✅ Test client account created successfully');
    return c.json({ 
      success: true,
      message: 'Test client account created and verified',
      credentials: {
        email: testEmail,
        password: testPassword
      },
      userId: userId
    });
  } catch (error) {
    console.error('❌ Seed client error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to seed client' 
    }, 500);
  }
});

// ============================================================================
// THERAPIST SESSION ROUTES (Appointments/Bookings)
// ============================================================================

// Get all sessions for a therapist
app.get("/make-server-a3c0b8e9/therapist/sessions/:therapistId", async (c) => {
  try {
    const therapistId = c.req.param('therapistId');
    const date = c.req.query('date'); // Optional date filter (YYYY-MM-DD)
    console.log(`📅 Fetching sessions for therapist: ${therapistId}, date: ${date || 'all'}`);

    // Fetch all sessions for this therapist
    const prefix = date 
      ? `therapist_session:${therapistId}:${date}:`
      : `therapist_session:${therapistId}:`;
    
    const sessionsData = await kv.getByPrefix(prefix);
    
    if (!sessionsData || sessionsData.length === 0) {
      console.log('📅 No sessions found');
      return c.json({ 
        success: true, 
        sessions: [] 
      });
    }

    // Parse and sort by time
    const sessions = sessionsData
      .map(data => typeof data === 'string' ? JSON.parse(data) : data)
      .sort((a, b) => {
        const timeA = new Date(`${a.date} ${a.time}`).getTime();
        const timeB = new Date(`${b.date} ${b.time}`).getTime();
        return timeA - timeB;
      });

    console.log(`✅ Fetched ${sessions.length} sessions`);
    return c.json({ 
      success: true, 
      sessions 
    });
  } catch (error) {
    console.error('❌ Error fetching therapist sessions:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch sessions' 
    }, 500);
  }
});

// Create a new session/appointment
app.post("/make-server-a3c0b8e9/therapist/sessions", async (c) => {
  try {
    const { therapistId, clientId, clientName, clientAvatar, date, time, duration, type, notes, recurring, recurringPattern, recurringEnd } = await c.req.json();
    console.log(`📅 Creating session for therapist: ${therapistId}`);

    if (!therapistId || !clientId || !date || !time) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields (therapistId, clientId, date, time)' 
      }, 400);
    }

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create session object
    const session = {
      id: sessionId,
      therapistId,
      clientId,
      client: clientName || 'Unknown Client',
      avatar: clientAvatar || '',
      date,
      time,
      duration: duration || '60',
      type: type || 'video',
      status: 'pending',
      notes: notes || '',
      recurring: recurring || false,
      recurringPattern: recurringPattern || null,
      recurringEnd: recurringEnd || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store session
    await kv.set(`therapist_session:${therapistId}:${date}:${sessionId}`, session);
    await kv.set(`client_session:${clientId}:${date}:${sessionId}`, session);
    await kv.set(`session:${sessionId}`, session);

    console.log('✅ Session created:', sessionId);
    return c.json({ 
      success: true, 
      session 
    });
  } catch (error) {
    console.error('❌ Error creating session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create session' 
    }, 500);
  }
});

// Update session status or details
app.put("/make-server-a3c0b8e9/therapist/sessions/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const updates = await c.req.json();
    console.log(`📅 Updating session: ${sessionId}`);

    // Get existing session
    const sessionData = await kv.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return c.json({ 
        success: false, 
        error: 'Session not found' 
      }, 404);
    }

    const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;

    // Update fields
    const updatedSession = {
      ...session,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Update in all locations
    await kv.set(`therapist_session:${session.therapistId}:${session.date}:${sessionId}`, updatedSession);
    await kv.set(`client_session:${session.clientId}:${session.date}:${sessionId}`, updatedSession);
    await kv.set(`session:${sessionId}`, updatedSession);

    console.log('✅ Session updated:', sessionId);
    return c.json({ 
      success: true, 
      session: updatedSession 
    });
  } catch (error) {
    console.error('❌ Error updating session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update session' 
    }, 500);
  }
});

// Delete a session
app.delete("/make-server-a3c0b8e9/therapist/sessions/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    console.log(`📅 Deleting session: ${sessionId}`);

    // Get session to know therapistId and clientId
    const sessionData = await kv.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return c.json({ 
        success: false, 
        error: 'Session not found' 
      }, 404);
    }

    const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;

    // Delete from all locations
    await kv.del(`therapist_session:${session.therapistId}:${session.date}:${sessionId}`);
    await kv.del(`client_session:${session.clientId}:${session.date}:${sessionId}`);
    await kv.del(`session:${sessionId}`);

    console.log('✅ Session deleted:', sessionId);
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete session' 
    }, 500);
  }
});

// ============================================================================
// THERAPIST CLIENTS ROUTES
// ============================================================================

// Get all clients for a therapist
app.get("/make-server-a3c0b8e9/therapist/clients/:therapistId", async (c) => {
  try {
    const therapistId = c.req.param('therapistId');
    console.log(`👥 Fetching clients for therapist: ${therapistId}`);

    // Fetch all sessions for this therapist
    const allSessionsPrefix = `therapist_session:${therapistId}:`;
    const allSessionsData = await kv.getByPrefix(allSessionsPrefix);
    
    if (!allSessionsData || allSessionsData.length === 0) {
      console.log('✅ No sessions found for this therapist');
      return c.json({ 
        success: true, 
        clients: [] 
      });
    }

    // Parse sessions and group by client
    const clientMap = new Map();
    const now = new Date();
    
    for (const sessionData of allSessionsData) {
      const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
      
      if (!session.clientId) continue;
      
      const clientId = session.clientId;
      const sessionDate = new Date(session.date);
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          sessions: [],
          completedSessions: 0,
          lastSessionDate: null,
          nextSessionDate: null
        });
      }
      
      const clientData = clientMap.get(clientId);
      clientData.sessions.push(session);
      
      // Track completed sessions
      if (session.status === 'completed') {
        clientData.completedSessions++;
      }
      
      // Track last session (most recent past session)
      if (sessionDate < now && (!clientData.lastSessionDate || sessionDate > clientData.lastSessionDate)) {
        clientData.lastSessionDate = sessionDate;
      }
      
      // Track next session (nearest future session)
      if (sessionDate >= now && (!clientData.nextSessionDate || sessionDate < clientData.nextSessionDate)) {
        clientData.nextSessionDate = sessionDate;
      }
    }
    
    // Build client list with enriched data
    const clients = [];
    
    for (const [clientId, clientData] of clientMap) {
      // Fetch client profile
      const clientProfileKey = `user_profile:${clientId}`;
      const clientProfileData = await kv.get(clientProfileKey);
      
      let clientName = 'Client ' + clientId.substring(0, 8);
      let avatar = '';
      
      if (clientProfileData) {
        const clientProfile = typeof clientProfileData === 'string' 
          ? JSON.parse(clientProfileData) 
          : clientProfileData;
        clientName = clientProfile.name || clientProfile.first_name + ' ' + (clientProfile.last_name || '') || clientName;
        avatar = clientProfile.avatar || '';
      }
      
      // Fetch user to get email
      const userData = await kv.get(`user:${clientId}`);
      const email = userData?.email || '';
      
      // Determine status based on session activity
      let status = 'active';
      const daysSinceLastSession = clientData.lastSessionDate 
        ? Math.floor((now.getTime() - clientData.lastSessionDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      if (daysSinceLastSession === null || daysSinceLastSession > 30) {
        status = 'inactive';
      } else if (clientData.completedSessions <= 3) {
        status = 'new';
      }
      
      // Determine priority (based on needs attention logic)
      let priority = 'medium';
      if (daysSinceLastSession !== null && daysSinceLastSession > 14 && daysSinceLastSession <= 30) {
        priority = 'high'; // Needs follow-up
      } else if (status === 'new') {
        priority = 'high'; // New clients need attention
      } else if (daysSinceLastSession !== null && daysSinceLastSession <= 7) {
        priority = 'medium'; // Active and engaged
      } else {
        priority = 'low';
      }
      
      // Format last session
      let lastSession = 'Never';
      if (clientData.lastSessionDate) {
        const days = Math.floor((now.getTime() - clientData.lastSessionDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days === 0) lastSession = 'Today';
        else if (days === 1) lastSession = '1 day ago';
        else if (days < 7) lastSession = `${days} days ago`;
        else if (days < 30) lastSession = `${Math.floor(days / 7)} weeks ago`;
        else lastSession = `${Math.floor(days / 30)} months ago`;
      }
      
      // Format next session
      let nextSession = 'Not scheduled';
      if (clientData.nextSessionDate) {
        const days = Math.floor((clientData.nextSessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days === 0) nextSession = 'Today';
        else if (days === 1) nextSession = 'Tomorrow';
        else if (days < 7) nextSession = `In ${days} days`;
        else nextSession = clientData.nextSessionDate.toLocaleDateString();
      }
      
      // Get latest session notes
      const latestSession = clientData.sessions
        .filter(s => s.notes)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const notes = latestSession?.notes || 'No notes available';
      
      // Get condition/specialization from sessions
      const condition = clientData.sessions[0]?.type === 'initial' 
        ? 'Initial Consultation' 
        : 'Ongoing Treatment';
      
      clients.push({
        id: clientId,
        name: clientName,
        email: email,
        phone: '+1 (555) 000-0000', // Placeholder
        status: status,
        lastSession: lastSession,
        nextSession: nextSession,
        sessionsCount: clientData.completedSessions,
        condition: condition,
        priority: priority,
        avatar: avatar || `https://images.unsplash.com/photo-1494790108755-2616b612b5aa?w=40&h=40&fit=crop&crop=center`,
        notes: notes
      });
    }
    
    // Sort by priority (high first) then by last session date
    clients.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.sessionsCount - a.sessionsCount;
    });
    
    console.log(`✅ Found ${clients.length} clients`);
    return c.json({ 
      success: true, 
      clients 
    });
  } catch (error) {
    console.error('❌ Error fetching therapist clients:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch clients' 
    }, 500);
  }
});

// ============================================================================
// THERAPIST MESSAGES ROUTES
// ============================================================================

// Get all messages for a therapist
app.get("/make-server-a3c0b8e9/therapist/messages/:therapistId", async (c) => {
  try {
    const therapistId = c.req.param('therapistId');
    console.log(`💬 Fetching messages for therapist: ${therapistId}`);

    // Fetch all chat conversations for this therapist
    const conversationsPrefix = `therapist_chat_conversation:`;
    const conversationsData = await kv.getByPrefix(conversationsPrefix);
    
    if (!conversationsData || conversationsData.length === 0) {
      console.log('✅ No conversations found');
      return c.json({ 
        success: true, 
        messages: [] 
      });
    }

    const messages = [];
    
    // Process each conversation
    for (const convData of conversationsData) {
      const conversation = typeof convData === 'string' ? JSON.parse(convData) : convData;
      
      // Only process conversations for this therapist
      if (conversation.therapist_id !== therapistId) continue;
      
      // Get messages for this conversation
      const messagesPrefix = `therapist_chat_message:${conversation.id}:`;
      const messagesData = await kv.getByPrefix(messagesPrefix);
      
      if (!messagesData || messagesData.length === 0) continue;
      
      // Parse messages and find the latest one from client
      const conversationMessages = messagesData
        .map(msgData => typeof msgData === 'string' ? JSON.parse(msgData) : msgData)
        .filter(msg => msg.sender === 'user') // Only client messages
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (conversationMessages.length === 0) continue;
      
      const latestMessage = conversationMessages[0];
      
      // Fetch client profile
      const clientProfileKey = `user_profile:${conversation.user_id}`;
      const clientProfileData = await kv.get(clientProfileKey);
      
      let clientName = 'Client';
      let avatar = 'https://images.unsplash.com/photo-1494790108755-2616b612b5aa?w=40&h=40&fit=crop&crop=center';
      
      if (clientProfileData) {
        const clientProfile = typeof clientProfileData === 'string' 
          ? JSON.parse(clientProfileData) 
          : clientProfileData;
        clientName = clientProfile.name || clientProfile.full_name || 'Client ' + conversation.user_id.substring(0, 8);
        avatar = clientProfile.avatar || avatar;
      }
      
      // Calculate time ago
      const now = new Date();
      const messageDate = new Date(latestMessage.created_at);
      const diffMs = now.getTime() - messageDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeAgo = '';
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }
      
      // Determine status (read/unread)
      const status = latestMessage.is_read ? 'read' : 'unread';
      
      // Determine priority based on message content and status
      let priority = 'medium';
      const messageText = latestMessage.text.toLowerCase();
      
      // High priority keywords
      if (messageText.includes('urgent') || 
          messageText.includes('emergency') || 
          messageText.includes('crisis') || 
          messageText.includes('help') ||
          messageText.includes('difficult') ||
          messageText.includes('struggling')) {
        priority = 'high';
      } else if (messageText.includes('question') || 
                 messageText.includes('reschedule') ||
                 messageText.includes('update')) {
        priority = 'medium';
      } else {
        priority = 'low';
      }
      
      // Override priority if unread
      if (status === 'unread' && priority === 'low') {
        priority = 'medium';
      }
      
      // Check if there are attachments
      const hasAttachment = !!latestMessage.attachment_url;
      
      // Generate a subject line from the message
      let subject = latestMessage.text.substring(0, 50);
      if (latestMessage.text.length > 50) {
        subject += '...';
      }
      
      messages.push({
        id: conversation.id,
        conversationId: conversation.id,
        from: clientName,
        subject: subject,
        message: latestMessage.text,
        timestamp: timeAgo,
        status: status,
        priority: priority,
        avatar: avatar,
        hasAttachment: hasAttachment,
        clientId: conversation.user_id,
        messageId: latestMessage.id,
        createdAt: latestMessage.created_at
      });
    }
    
    // Sort messages: unread first, then by date
    messages.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'unread' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`✅ Found ${messages.length} messages`);
    return c.json({ 
      success: true, 
      messages 
    });
  } catch (error) {
    console.error('❌ Error fetching therapist messages:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch messages' 
    }, 500);
  }
});

// Mark message as read
app.post("/make-server-a3c0b8e9/therapist/messages/:messageId/read", async (c) => {
  try {
    const messageId = c.req.param('messageId');
    console.log(`📧 Marking message as read: ${messageId}`);
    
    // Get all messages with this ID pattern
    const messagesPrefix = `therapist_chat_message:${messageId}:`;
    const messagesData = await kv.getByPrefix(messagesPrefix);
    
    if (!messagesData || messagesData.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }
    
    // Update all unread messages in this conversation
    for (const msgData of messagesData) {
      const message = typeof msgData === 'string' ? JSON.parse(msgData) : msgData;
      
      if (!message.is_read && message.sender === 'user') {
        const messageKey = `therapist_chat_message:${messageId}:${message.id}`;
        await kv.set(messageKey, {
          ...message,
          is_read: true
        });
      }
    }
    
    console.log('✅ Message marked as read');
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error marking message as read:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark message as read' 
    }, 500);
  }
});

// Mark message as unread
app.post("/make-server-a3c0b8e9/therapist/messages/:messageId/unread", async (c) => {
  try {
    const messageId = c.req.param('messageId');
    console.log(`📧 Marking message as unread: ${messageId}`);
    
    // Get all messages with this ID pattern
    const messagesPrefix = `therapist_chat_message:${messageId}:`;
    const messagesData = await kv.getByPrefix(messagesPrefix);
    
    if (!messagesData || messagesData.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }
    
    // Update the latest message to be unread
    const messages = messagesData
      .map(msgData => typeof msgData === 'string' ? JSON.parse(msgData) : msgData)
      .filter(msg => msg.sender === 'user')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (messages.length > 0) {
      const latestMessage = messages[0];
      const messageKey = `therapist_chat_message:${messageId}:${latestMessage.id}`;
      await kv.set(messageKey, {
        ...latestMessage,
        is_read: false
      });
    }
    
    console.log('✅ Message marked as unread');
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error marking message as unread:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark message as unread' 
    }, 500);
  }
});

// Delete/archive message (conversation)
app.delete("/make-server-a3c0b8e9/therapist/messages/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    console.log(`🗑️ Archiving conversation: ${conversationId}`);
    
    // For now, we'll just mark it as archived instead of deleting
    const conversationKey = `therapist_chat_conversation:${conversationId}`;
    const conversationData = await kv.get(conversationKey);
    
    if (!conversationData) {
      return c.json({ 
        success: false, 
        error: 'Conversation not found' 
      }, 404);
    }
    
    const conversation = typeof conversationData === 'string' 
      ? JSON.parse(conversationData) 
      : conversationData;
    
    // Mark as archived
    await kv.set(conversationKey, {
      ...conversation,
      archived: true,
      archived_at: new Date().toISOString()
    });
    
    console.log('✅ Conversation archived');
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error archiving conversation:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to archive conversation' 
    }, 500);
  }
});

// Send reply to client
app.post("/make-server-a3c0b8e9/therapist/messages/:conversationId/reply", async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { text, attachments } = await c.req.json();
    
    console.log(`💬 Sending reply to conversation: ${conversationId}`);
    
    // Create new message
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const message = {
      id: messageId,
      conversation_id: conversationId,
      sender: 'therapist',
      text: text,
      attachment_url: attachments?.length > 0 ? attachments[0] : null,
      is_read: false,
      created_at: now,
      updated_at: now
    };
    
    // Store message
    const messageKey = `therapist_chat_message:${conversationId}:${messageId}`;
    await kv.set(messageKey, message);
    
    // Update conversation last message time
    const conversationKey = `therapist_chat_conversation:${conversationId}`;
    const conversationData = await kv.get(conversationKey);
    
    if (conversationData) {
      const conversation = typeof conversationData === 'string' 
        ? JSON.parse(conversationData) 
        : conversationData;
      
      await kv.set(conversationKey, {
        ...conversation,
        last_message_at: now,
        updated_at: now
      });
    }
    
    console.log('✅ Reply sent successfully');
    return c.json({ 
      success: true,
      message 
    });
  } catch (error) {
    console.error('❌ Error sending reply:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send reply' 
    }, 500);
  }
});

// ============================================================================
// THERAPIST DASHBOARD STATISTICS ROUTES
// ============================================================================

// Get dashboard statistics for a therapist
app.get("/make-server-a3c0b8e9/therapist/dashboard-stats/:therapistId", async (c) => {
  try {
    const therapistId = c.req.param('therapistId');
    console.log(`📊 Fetching dashboard stats for therapist: ${therapistId}`);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch today's sessions
    const todaySessionsPrefix = `therapist_session:${therapistId}:${today}:`;
    const todaySessionsData = await kv.getByPrefix(todaySessionsPrefix);
    
    let todaySessions = todaySessionsData
      ? todaySessionsData
          .map(data => typeof data === 'string' ? JSON.parse(data) : data)
          .filter(session => session.status !== 'cancelled')
      : [];
    
    // Enrich sessions with client information
    for (let i = 0; i < todaySessions.length; i++) {
      const session = todaySessions[i];
      if (session.clientId) {
        // Try to fetch client profile
        const clientProfileKey = `user_profile:${session.clientId}`;
        const clientProfileData = await kv.get(clientProfileKey);
        
        if (clientProfileData) {
          const clientProfile = typeof clientProfileData === 'string' 
            ? JSON.parse(clientProfileData) 
            : clientProfileData;
          
          // Add client name to session
          todaySessions[i] = {
            ...session,
            clientName: clientProfile.name || 'Anonymous Client'
          };
        } else {
          // Fallback if no profile found
          todaySessions[i] = {
            ...session,
            clientName: 'Client ' + session.clientId.substring(0, 8)
          };
        }
      }
    }
    
    // Sort sessions by time
    todaySessions.sort((a, b) => {
      const timeA = a.startTime || a.time || '00:00';
      const timeB = b.startTime || b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    const todaySessionsCount = todaySessions.length;
    console.log(`📅 Found ${todaySessionsCount} sessions scheduled today`);

    // Fetch all therapist chat conversations to count unread messages
    const conversationsPrefix = `therapist_chat_conversation:`;
    const conversationsData = await kv.getByPrefix(conversationsPrefix);
    
    let unreadMessagesCount = 0;
    let clientsWithUnreadMessages = new Set();
    
    if (conversationsData && conversationsData.length > 0) {
      for (const convData of conversationsData) {
        const conversation = typeof convData === 'string' ? JSON.parse(convData) : convData;
        
        // Only count if this therapist is part of the conversation
        if (conversation.therapist_id === therapistId) {
          // Get messages for this conversation
          const messagesPrefix = `therapist_chat_message:${conversation.id}:`;
          const messagesData = await kv.getByPrefix(messagesPrefix);
          
          if (messagesData && messagesData.length > 0) {
            for (const msgData of messagesData) {
              const message = typeof msgData === 'string' ? JSON.parse(msgData) : msgData;
              
              // Count unread messages sent by client (sender = 'user')
              if (!message.is_read && message.sender === 'user') {
                unreadMessagesCount++;
                clientsWithUnreadMessages.add(conversation.user_id);
              }
            }
          }
        }
      }
    }
    
    const clientsWaitingCount = clientsWithUnreadMessages.size;
    console.log(`💬 Found ${unreadMessagesCount} unread messages from ${clientsWaitingCount} clients`);

    // Fetch all sessions to count unique active clients
    const allSessionsPrefix = `therapist_session:${therapistId}:`;
    const allSessionsData = await kv.getByPrefix(allSessionsPrefix);
    
    const uniqueClients = new Set();
    if (allSessionsData && allSessionsData.length > 0) {
      for (const sessionData of allSessionsData) {
        const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        if (session.clientId) {
          uniqueClients.add(session.clientId);
        }
      }
    }
    
    const activeClientsCount = uniqueClients.size;
    console.log(`👥 Found ${activeClientsCount} active clients`);

    // Calculate this week's revenue
    // Get start of week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days, else go to Monday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    let weekRevenue = 0;
    const sessionRate = 150; // Default rate per session in dollars
    
    if (allSessionsData && allSessionsData.length > 0) {
      for (const sessionData of allSessionsData) {
        const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        
        // Parse session date
        const sessionDate = new Date(session.date);
        
        // Check if session is within this week and completed
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek && session.status === 'completed') {
          weekRevenue += sessionRate;
        }
      }
    }
    
    console.log(`💰 Calculated week revenue: $${weekRevenue}`);

    // Fetch recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivities = [];
    
    // 1. Get recent sessions (completed/cancelled in last 7 days)
    if (allSessionsData && allSessionsData.length > 0) {
      for (const sessionData of allSessionsData) {
        const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        
        if (session.date) {
          const sessionDate = new Date(session.date);
          if (sessionDate >= sevenDaysAgo && (session.status === 'completed' || session.status === 'cancelled' || session.status === 'confirmed')) {
            // Fetch client name if available
            let clientName = 'Client';
            if (session.clientId) {
              const clientProfileKey = `user_profile:${session.clientId}`;
              const clientProfileData = await kv.get(clientProfileKey);
              if (clientProfileData) {
                const clientProfile = typeof clientProfileData === 'string' ? JSON.parse(clientProfileData) : clientProfileData;
                clientName = clientProfile.name || 'Client ' + session.clientId.substring(0, 8);
              }
            }
            
            let message = '';
            if (session.status === 'completed') {
              message = `Session completed with ${clientName}`;
            } else if (session.status === 'cancelled') {
              message = `Session cancelled with ${clientName}`;
            } else if (session.status === 'confirmed') {
              message = `New session booked with ${clientName}`;
            }
            
            recentActivities.push({
              type: session.status === 'confirmed' ? 'booking' : 'session',
              message,
              time: session.date,
              timestamp: sessionDate.getTime()
            });
          }
        }
      }
    }
    
    // 2. Get recent messages (last 7 days)
    if (conversationsData && conversationsData.length > 0) {
      for (const convData of conversationsData) {
        const conversation = typeof convData === 'string' ? JSON.parse(convData) : convData;
        
        if (conversation.therapist_id === therapistId) {
          const messagesPrefix = `therapist_chat_message:${conversation.id}:`;
          const messagesData = await kv.getByPrefix(messagesPrefix);
          
          if (messagesData && messagesData.length > 0) {
            for (const msgData of messagesData) {
              const message = typeof msgData === 'string' ? JSON.parse(msgData) : msgData;
              
              if (message.sender === 'user' && message.created_at) {
                const messageDate = new Date(message.created_at);
                if (messageDate >= sevenDaysAgo) {
                  // Fetch client name
                  let clientName = 'Client';
                  const clientProfileKey = `user_profile:${conversation.user_id}`;
                  const clientProfileData = await kv.get(clientProfileKey);
                  if (clientProfileData) {
                    const clientProfile = typeof clientProfileData === 'string' ? JSON.parse(clientProfileData) : clientProfileData;
                    clientName = clientProfile.name || 'Client ' + conversation.user_id.substring(0, 8);
                  }
                  
                  recentActivities.push({
                    type: 'message',
                    message: `New message from ${clientName}`,
                    time: message.created_at,
                    timestamp: messageDate.getTime()
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // 3. Get recent client notes (if we have a notes system)
    const notesPrefix = `therapist_client_note:${therapistId}:`;
    const notesData = await kv.getByPrefix(notesPrefix);
    
    if (notesData && notesData.length > 0) {
      for (const noteData of notesData) {
        const note = typeof noteData === 'string' ? JSON.parse(noteData) : noteData;
        
        if (note.created_at) {
          const noteDate = new Date(note.created_at);
          if (noteDate >= sevenDaysAgo) {
            // Fetch client name
            let clientName = 'Client';
            if (note.clientId) {
              const clientProfileKey = `user_profile:${note.clientId}`;
              const clientProfileData = await kv.get(clientProfileKey);
              if (clientProfileData) {
                const clientProfile = typeof clientProfileData === 'string' ? JSON.parse(clientProfileData) : clientProfileData;
                clientName = clientProfile.name || 'Client ' + note.clientId.substring(0, 8);
              }
            }
            
            recentActivities.push({
              type: 'note',
              message: `Added notes for ${clientName}`,
              time: note.created_at,
              timestamp: noteDate.getTime()
            });
          }
        }
      }
    }
    
    // Sort by timestamp (most recent first) and take top 10
    recentActivities.sort((a, b) => b.timestamp - a.timestamp);
    const recentActivityList = recentActivities.slice(0, 10).map(activity => {
      // Format time as relative time (e.g., "2 hours ago", "3 days ago")
      const now = new Date();
      const activityDate = new Date(activity.time);
      const diffMs = now.getTime() - activityDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeAgo = '';
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }
      
      return {
        type: activity.type,
        message: activity.message,
        time: timeAgo
      };
    });
    
    console.log(`📋 Found ${recentActivityList.length} recent activities`);

    return c.json({ 
      success: true, 
      stats: {
        todaySessionsCount,
        clientsWaitingCount,
        unreadMessagesCount,
        activeClientsCount,
        weekRevenue
      },
      todaySessions,
      recentActivity: recentActivityList
    });
  } catch (error) {
    console.error('❌ Error fetching therapist dashboard stats:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard statistics' 
    }, 500);
  }
});

// ============================================================================
// DEBUG ROUTE - Check user data (development only)
// ============================================================================

app.get("/make-server-a3c0b8e9/dev/check-user/:email", async (c) => {
  try {
    const email = c.req.param('email');
    console.log(`🔍 Checking user data for: ${email}`);
    
    const user = await kv.get(`user:email:${email}`);
    
    if (!user) {
      return c.json({ 
        success: false, 
        message: 'User not found',
        email
      });
    }
    
    // Don't return the actual password hash, just confirm it exists
    return c.json({ 
      success: true,
      message: 'User found',
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_active: user.is_active,
        has_password_hash: !!user.password_hash,
        password_hash_length: user.password_hash?.length || 0,
        created_at: user.created_at,
        last_login_at: user.last_login_at
      }
    });
  } catch (error) {
    console.error('❌ Check user error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to check user' 
    }, 500);
  }
});

Deno.serve(app.fetch);

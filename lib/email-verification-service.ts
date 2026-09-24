import { sendEmailVerificationEmail } from "./email";
import {
  generateVerificationToken,
  getEmailVerificationResendSeconds,
  getEmailVerificationTokenTtlMinutes,
  getEmailVerificationUrl,
  hashEmailVerificationToken,
  normalizeEmail,
} from "./verification";
import { getSupabaseAdmin } from "./supabase-server";

export type EmailVerificationResult = {
  required: boolean;
  verified: boolean;
  sent: boolean;
  cooldown: boolean;
};

export async function getVerifiedEmailAt(
  email: string,
): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("verified_emails")
    .select("verified_at")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle<{ verified_at: string }>();

  if (error) {
    throw error;
  }

  return data?.verified_at ?? null;
}

type SendVerificationInput = {
  wishId: string;
  email: string;
  name: string;
};

export async function sendVerificationForWish({
  wishId,
  email,
  name,
}: SendVerificationInput): Promise<EmailVerificationResult> {
  const normalizedEmail = normalizeEmail(email);
  const verifiedAt = await getVerifiedEmailAt(normalizedEmail);
  const supabase = getSupabaseAdmin();

  if (verifiedAt) {
    const { error } = await supabase
      .from("wishes")
      .update({ email_verified_at: verifiedAt })
      .eq("id", wishId)
      .is("email_verified_at", null);

    if (error) {
      throw error;
    }

    return { required: true, verified: true, sent: false, cooldown: false };
  }

  const cooldownSeconds = getEmailVerificationResendSeconds();
  const cooldownStart = new Date(
    Date.now() - cooldownSeconds * 1000,
  ).toISOString();
  const now = new Date().toISOString();
  const { data: recentToken, error: recentTokenError } = await supabase
    .from("email_verification_tokens")
    .select("id")
    .eq("wish_id", wishId)
    .is("used_at", null)
    .gt("expires_at", now)
    .gt("created_at", cooldownStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentTokenError) {
    throw recentTokenError;
  }

  if (recentToken) {
    return { required: true, verified: false, sent: true, cooldown: true };
  }

  const token = generateVerificationToken();
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = new Date(
    Date.now() + getEmailVerificationTokenTtlMinutes() * 60 * 1000,
  ).toISOString();
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("email_verification_tokens")
    .insert({
      wish_id: wishId,
      email: email.trim(),
      normalized_email: normalizedEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (tokenError) {
    throw tokenError;
  }

  try {
    await sendEmailVerificationEmail({
      to: email.trim(),
      name,
      verificationUrl: getEmailVerificationUrl(token),
    });
  } catch (error) {
    await supabase
      .from("email_verification_tokens")
      .delete()
      .eq("id", tokenRecord.id);
    throw error;
  }

  return { required: true, verified: false, sent: true, cooldown: false };
}

// supabase/functions/register/index.ts
// Edge Function — runs server-side with service_role access
// Called by the public registration form via supabase.functions.invoke("register")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // ← server-side ONLY, never in browser
  { auth: { persistSession: false } }
);

/**
 * Generates a human-readable, non-sequential, non-guessable reference.
 * Format: SYN-XXXX-XXXX (uppercase alphanumeric, no ambiguous chars)
 */
function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const rand = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => chars[b % chars.length])
      .join("");
  return `SYN-${rand(4)}-${rand(4)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Server-side validation (mirrors client-side but authoritative)
function validatePayload(body: Record<string, unknown>): string | null {
  if (!body.full_name || typeof body.full_name !== "string" || body.full_name.trim().length < 2) {
    return "Full name is required (minimum 2 characters)";
  }
  if (!body.email || typeof body.email !== "string") {
    return "Email is required";
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(body.email.toString().trim())) {
    return "Invalid email address";
  }
  if (!body.institution || typeof body.institution !== "string" || body.institution.trim().length < 2) {
    return "Institution is required";
  }
  if (!["internal", "external"].includes(body.affiliation as string)) {
    return "Invalid affiliation";
  }
  if (body.consent_given !== true) {
    return "Consent is required";
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ code: "INVALID_JSON", message: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Server-side validation
  const validationError = validatePayload(body);
  if (validationError) {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", message: validationError }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check registration is open (authoritative server-side check)
  const { data: settings } = await supabaseAdmin
    .from("event_settings")
    .select("registration_open, capacity")
    .eq("published", true)
    .maybeSingle();

  if (!settings?.registration_open) {
    return new Response(
      JSON.stringify({ code: "REGISTRATION_CLOSED", message: "Registration is not currently open" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Capacity check (atomic via DB constraint is primary; this is an early-exit optimization)
  if (settings.capacity !== null) {
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled");

    if (count !== null && count >= settings.capacity) {
      return new Response(
        JSON.stringify({ code: "CAPACITY_REACHED", message: "Registration capacity has been reached" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const normalizedEmail = normalizeEmail(body.email as string);

  // Generate a unique reference (retry up to 5 times on collision)
  let reference = "";
  for (let i = 0; i < 5; i++) {
    reference = generateReference();
    const { data: existing } = await supabaseAdmin
      .from("registrations")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();
    if (!existing) break;
  }

  // Insert registration
  const { data: reg, error: insertError } = await supabaseAdmin
    .from("registrations")
    .insert({
      reference,
      full_name: (body.full_name as string).trim(),
      email: normalizedEmail,
      phone: (body.phone as string)?.trim() || null,
      institution: (body.institution as string).trim(),
      affiliation: body.affiliation as string,
      department: (body.department as string)?.trim() || null,
      year_of_study: (body.year_of_study as string)?.trim() || null,
      consent_given: true,
      consent_timestamp: new Date().toISOString(),
      status: "pending",
    })
    .select("id, reference")
    .single();

  if (insertError) {
    // Duplicate email (unique constraint)
    if (insertError.code === "23505") {
      return new Response(
        JSON.stringify({
          code: "DUPLICATE_REGISTRATION",
          message: "This email address is already registered",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Do NOT expose internal error details
    console.error("Registration insert error:", insertError.code, insertError.message);
    return new Response(
      JSON.stringify({ code: "SERVER_ERROR", message: "Registration failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Optionally create a payment record if payment is enabled
  const { data: paymentSettings } = await supabaseAdmin
    .from("payment_settings")
    .select("enabled, applicable_categories, amount_rules")
    .eq("enabled", true)
    .maybeSingle();

  if (paymentSettings?.enabled) {
    const affiliation = body.affiliation as string;
    const needsPayment =
      Array.isArray(paymentSettings.applicable_categories) &&
      paymentSettings.applicable_categories.includes(affiliation);

    if (needsPayment) {
      await supabaseAdmin.from("payments").insert({
        registration_id: reg.id,
        currency: "INR",
        status: "pending",
      });
    } else {
      await supabaseAdmin.from("payments").insert({
        registration_id: reg.id,
        currency: "INR",
        status: "not_required",
      });
    }
  }

  // Return only the public reference — no internal IDs or private fields
  return new Response(
    JSON.stringify({ reference: reg.reference }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

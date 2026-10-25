import { createServerFn } from "@tanstack/react-start";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo";

// Creates the fixed demo account on first use so the one-click demo buttons always work.
export const ensureDemoUser = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "resident" | "staff" }) => {
    if (d?.who !== "resident" && d?.who !== "staff") throw new Error("Invalid demo account");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acct = DEMO_ACCOUNTS[data.who];
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: acct.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: acct.name },
    });
    if (error && !/already|registered|exists/i.test(error.message)) {
      console.error("Demo user creation failed", error);
      throw new Error("Could not prepare the demo account");
    }
    return { email: acct.email };
  });

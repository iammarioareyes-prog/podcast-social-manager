import { NextResponse } from "next/server";
import { createAgentSupabaseClient } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/clear-schedule
 *
 * Deletes all posts with status "scheduled" (not published or failed).
 * Used to wipe the queue before manually building out a week's schedule.
 */
export async function DELETE() {
  const supabase = createAgentSupabaseClient();

  const { count, error } = await supabase
    .from("posts")
    .delete({ count: "exact" })
    .eq("status", "scheduled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: count ?? 0 });
}

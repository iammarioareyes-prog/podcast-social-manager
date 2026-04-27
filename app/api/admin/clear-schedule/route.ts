import { NextResponse } from "next/server";
import { createAgentSupabaseClient } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/clear-schedule
 *
 * Deletes all posts with status "scheduled".
 * Published and failed posts are preserved.
 */
export async function DELETE() {
  const supabase = createAgentSupabaseClient();

  // Count first so we can return how many were deleted
  const { count } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "scheduled");

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("status", "scheduled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: count ?? 0 });
}

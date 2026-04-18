import Link from "next/link";
import { isAdmin } from "@/lib/auth";

/**
 * AdminLink
 * 服务端组件，仅 Admin 用户可见的"前往后台"入口
 */
export async function AdminLink() {
  const admin = await isAdmin();

  if (!admin) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
    >
      后台管理
    </Link>
  );
}

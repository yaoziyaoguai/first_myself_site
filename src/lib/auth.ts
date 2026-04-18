import { cookies } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * 获取当前登录用户
 * 仅用于服务端组件（Server Components）
 * @returns 当前用户对象，未登录返回 null
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("payload-token")?.value;

    if (!token) {
      return null;
    }

    const payload = await getPayload({ config });

    // 构造 headers 对象
    const headers = new Headers();
    headers.set("authorization", `JWT ${token}`);

    // 使用 auth operation 验证 token 并获取用户
    const result = await payload.auth({
      headers,
    });

    return result.user || null;
  } catch {
    // 认证失败，返回 null
    return null;
  }
}

/**
 * 检查当前用户是否为管理员
 * @returns 是否是 admin 角色
 */
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

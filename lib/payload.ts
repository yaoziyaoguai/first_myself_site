import { getPayload as getPayloadClient } from "payload";
import config from "../payload.config";

/**
 * 获取 Payload Local API 客户端
 * 所有服务端组件通过此函数访问 CMS 数据
 */
export async function getPayloadAPI() {
  return getPayloadClient({ config });
}

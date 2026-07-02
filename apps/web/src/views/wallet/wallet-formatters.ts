import type { WalletEntry } from "@parentbond/shared";

export function walletStatusLabel(status: WalletEntry["status"]) {
  if (status === "approved") return "✓ 已同意";
  if (status === "appealing") return "申诉中";
  if (status === "cancelled") return "已取消";
  if (status === "resolved") return "已裁定";
  return "待确认";
}

export function formatWalletDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

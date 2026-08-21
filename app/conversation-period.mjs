export const CONVERSATION_PERIODS = [
  { id: "today", label: "当天" },
  { id: "yesterday", label: "昨天" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "earlier", label: "更早" },
];

export function conversationPeriod(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= startToday && date < startTomorrow) return "today";
  if (date >= startYesterday && date < startToday) return "yesterday";
  if (date >= startWeek) return "week";
  if (date >= startMonth) return "month";
  return "earlier";
}

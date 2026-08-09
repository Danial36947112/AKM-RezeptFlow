export const config = {
  port: Number(process.env.PORT ?? 3001),
  reminderHours: Number(process.env.REMINDER_HOURS ?? 8),
  escalationHours: Number(process.env.ESCALATION_HOURS ?? 24),
  deliveryTargetHours: Number(process.env.DELIVERY_TARGET_HOURS ?? 48),
  orderWebhookSecret: process.env.ORDER_WEBHOOK_SECRET ?? "demo-secret",
};

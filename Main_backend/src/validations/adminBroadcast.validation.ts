import { z } from 'zod';

export const createBroadcastSchema = z.object({
  title: z.string().min(3, 'Tiêu đề thông báo phải có ít nhất 3 ký tự').max(255),
  content: z.string().min(5, 'Nội dung thông báo phải có ít nhất 5 ký tự'),
  priority: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  audience: z.enum(['ALL', 'OWNERS', 'DEVOPS']).default('ALL'),
  showStickyBanner: z.boolean().default(true),
  sendEmail: z.boolean().default(false),
});

export type CreateBroadcastDto = z.infer<typeof createBroadcastSchema>;

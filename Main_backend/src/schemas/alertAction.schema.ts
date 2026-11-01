import { z } from 'zod';

export const assignAlertSchema = z.object({
  assignedTo: z.string('Thiếu trường assignedTo (UUID người dùng)').uuid({
    message: 'assignedTo phải là định dạng UUID hợp lệ',
  }),
  note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const unassignAlertSchema = z.object({
  note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const resolveAlertSchema = z.object({
  resolutionNote: z.string().max(2000, 'Ghi chú giải quyết tối đa 2000 ký tự').optional(),
  resolution_note: z.string().max(2000, 'Ghi chú giải quyết tối đa 2000 ký tự').optional(),
  note: z.string().max(2000, 'Ghi chú giải quyết tối đa 2000 ký tự').optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const acknowledgeAlertSchema = z.object({
  note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const auditTrailQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  order: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc'),
});

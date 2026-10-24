import { z } from 'zod';

export const generateReportPayloadSchema = z.object({
  reportName: z.string().trim().min(1).max(100),
  rows: z.number().int().min(1).max(100_000),
});

export const processDataPayloadSchema = z.object({
  values: z.array(z.number().finite()).min(1).max(10_000),
});

export const submitJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('report.generate'),
    payload: generateReportPayloadSchema,
    priority: z.number().int().min(1).max(10).default(5),
    delaySeconds: z.number().int().min(0).max(86_400).default(0),
  }),
  z.object({
    type: z.literal('data.process'),
    payload: processDataPayloadSchema,
    priority: z.number().int().min(1).max(10).default(5),
    delaySeconds: z.number().int().min(0).max(86_400).default(0),
  }),
]);

export type SubmitJobInput = z.infer<typeof submitJobSchema>;

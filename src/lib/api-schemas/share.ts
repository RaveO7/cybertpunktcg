import { z } from "zod";

export const shareSchema =z.object({ rotate: z.boolean().optional() }).nullable();

export const shareTokenSchema = z.string().min(16).max(128);

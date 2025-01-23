import {z} from 'zod';

export const helpSchema = z.object({
    message: z.string()
        .min(1)
        .optional(),
    links: z.array(
        z.object({
            url: z.string().url(),
            description: z.string().min(1),
        }),
    ).optional(),
    suggestions: z.array(z.string().min(1)).optional(),
});

export const actionDefinitionSchema = z.object({name: z.string().min(1)}).passthrough();

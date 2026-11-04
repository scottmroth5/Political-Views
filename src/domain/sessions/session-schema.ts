import { z } from "zod";

export const discoveryModeSchema = z.enum(["GUIDED", "CONVERSATION"]);

export const modeInputSchema = z.strictObject({ mode: discoveryModeSchema });

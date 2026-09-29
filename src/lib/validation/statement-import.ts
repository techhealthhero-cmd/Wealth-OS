import { z } from "zod";

import { importHeaderMappingSchema } from "@/lib/import/csv";

export const prepareStatementImportSchema = z.object({
  batchId: z.string().uuid(),
  mapping: importHeaderMappingSchema,
});

export const statementImportBatchIdSchema = z.string().uuid();


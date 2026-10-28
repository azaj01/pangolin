/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025-2026 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, customDnsRecords } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { CreateCustomDnsRecordsResponse } from "@server/routers/customDnsRecord/types";
import {
    checkCustomDnsRecordConflicts,
    customDnsRecordFieldsSchema,
    customDnsRecordValueSchema,
    getManageableDomain,
    MAX_CUSTOM_DNS_RECORDS_PER_RRSET,
    NormalizedCustomDnsRecord,
    normalizeCustomDnsRecord
} from "./validation";

const paramsSchema = z.strictObject({
    orgId: z.string().nonempty(),
    domainId: z.string().nonempty()
});

// Either `value` for a single record, or `values` to create several records
// with the same name and settings at once (e.g. a pair of NS records).
const bodySchema = customDnsRecordFieldsSchema
    .extend({
        value: customDnsRecordValueSchema.optional(),
        values: z
            .array(customDnsRecordValueSchema)
            .min(1)
            .max(MAX_CUSTOM_DNS_RECORDS_PER_RRSET)
            .optional(),
        ttl: customDnsRecordFieldsSchema.shape.ttl.optional().default(300),
        enabled: z.boolean().optional().default(true)
    })
    .refine(
        (body) => (body.value === undefined) !== (body.values === undefined),
        {
            message: "Exactly one of value or values must be provided"
        }
    );

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/domain/{domainId}/custom-dns-record",
    description:
        "Create one or more custom DNS records served by Pangolin's nameservers for a domain. Pass `values` instead of `value` to create several records with the same name and settings.",
    tags: [OpenAPITags.Domain],
    request: {
        params: paramsSchema,
        body: {
            content: {
                "application/json": {
                    schema: bodySchema
                }
            }
        }
    },
    responses: {
        200: {
            description: "Successful response",
            content: {
                "application/json": {
                    schema: z.object({
                        data: z.record(z.string(), z.any()).nullable(),
                        success: z.boolean(),
                        error: z.boolean(),
                        message: z.string(),
                        status: z.number()
                    })
                }
            }
        }
    }
});

export async function createCustomDnsRecord(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = paramsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { orgId, domainId } = parsedParams.data;

        const parsedBody = bodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const domain = await getManageableDomain(orgId, domainId);
        if (!domain.ok) {
            return next(createHttpError(domain.status, domain.error));
        }

        const { value, values, ...fields } = parsedBody.data;

        // Validate every record (against the existing ones and each other)
        // before inserting any, so a bad value doesn't leave a partial batch.
        const toInsert: NormalizedCustomDnsRecord[] = [];
        for (const recordValue of values ?? [value!]) {
            const normalized = normalizeCustomDnsRecord(
                { ...fields, value: recordValue },
                domain.baseDomain
            );
            if (!normalized.ok) {
                return next(
                    createHttpError(HttpCode.BAD_REQUEST, normalized.error)
                );
            }

            const conflict = await checkCustomDnsRecordConflicts(
                domainId,
                domain.baseDomain,
                normalized.value,
                undefined,
                toInsert
            );
            if (conflict) {
                return next(createHttpError(HttpCode.CONFLICT, conflict));
            }

            toInsert.push(normalized.value);
        }

        const now = Date.now();
        const records = await db
            .insert(customDnsRecords)
            .values(
                toInsert.map((record) => ({
                    domainId,
                    ...record,
                    createdAt: now,
                    updatedAt: now
                }))
            )
            .returning();

        return response<CreateCustomDnsRecordsResponse>(res, {
            data: { records },
            success: true,
            error: false,
            message:
                records.length === 1
                    ? "Custom DNS record created successfully"
                    : "Custom DNS records created successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

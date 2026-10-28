"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@app/components/ui/card";
import { Button } from "@app/components/ui/button";
import { Switch } from "@app/components/ui/switch";
import CopyToClipboard from "@app/components/CopyToClipboard";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import CustomDnsRecordCredenza from "@app/components/CustomDnsRecordCredenza";
import { PaidFeaturesAlert } from "@app/components/PaidFeaturesAlert";
import { usePaidStatus } from "@app/hooks/usePaidStatus";
import { tierMatrix } from "@server/lib/billing/tierMatrix";
import { domainQueries } from "@app/lib/queries";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { CustomDnsRecordRow } from "@server/routers/customDnsRecord/types";

type Props = {
    orgId: string;
    domainId: string;
    baseDomain: string;
};

function formatValue(record: CustomDnsRecordRow): string {
    if (record.type === "MX") {
        return `${record.priority} ${record.value}`;
    }
    if (record.type === "SRV") {
        return `${record.priority} ${record.weight} ${record.port} ${record.value}`;
    }
    return record.value;
}

export default function CustomDnsRecordsTable({
    orgId,
    domainId,
    baseDomain
}: Props) {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const { isPaidUser } = usePaidStatus();
    const isDisabled = !isPaidUser(tierMatrix.customDnsRecords);

    const { data: records = [], refetch } = useQuery(
        domainQueries.listCustomDnsRecords({ orgId, domainId })
    );

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingRecord, setEditingRecord] =
        useState<CustomDnsRecordRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletingRecord, setDeletingRecord] =
        useState<CustomDnsRecordRow | null>(null);

    function openEditor(record: CustomDnsRecordRow | null) {
        setEditingRecord(record);
        setEditorOpen(true);
    }

    async function toggleEnabled(record: CustomDnsRecordRow, enabled: boolean) {
        try {
            await api.post(
                `/org/${orgId}/domain/${domainId}/custom-dns-record/${record.customDnsRecordId}`,
                { enabled }
            );
            refetch();
        } catch (e) {
            toast({
                variant: "destructive",
                title: t("customDnsRecordSaveError"),
                description: formatAxiosError(e)
            });
        }
    }

    async function deleteRecord() {
        if (!deletingRecord) {
            return;
        }
        try {
            await api.delete(
                `/org/${orgId}/domain/${domainId}/custom-dns-record/${deletingRecord.customDnsRecordId}`
            );
            toast({ title: t("customDnsRecordDeleted") });
            setDeleteOpen(false);
            setDeletingRecord(null);
            refetch();
        } catch (e) {
            toast({
                variant: "destructive",
                title: t("customDnsRecordDeleteError"),
                description: formatAxiosError(e)
            });
        }
    }

    return (
        <>
            <PaidFeaturesAlert tiers={tierMatrix.customDnsRecords} />
            <Card
                className={
                    isDisabled ? "pointer-events-none opacity-50" : undefined
                }
            >
                <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle>{t("customDnsRecords")}</CardTitle>
                        <CardDescription>
                            {t("customDnsRecordsDescription")}
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => openEditor(null)}
                        disabled={isDisabled}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        {t("customDnsRecordsAdd")}
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("name")}</TableHead>
                                <TableHead>{t("type")}</TableHead>
                                <TableHead>{t("value")}</TableHead>
                                <TableHead>{t("TTL")}</TableHead>
                                <TableHead>{t("enabled")}</TableHead>
                                <TableHead className="text-right">
                                    {t("actions")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.length ? (
                                records.map((record) => (
                                    <TableRow key={record.customDnsRecordId}>
                                        <TableCell>
                                            <CopyToClipboard
                                                text={record.fullDomain}
                                                displayText={record.fullDomain}
                                                isLink={false}
                                            />
                                        </TableCell>
                                        <TableCell>{record.type}</TableCell>
                                        <TableCell className="max-w-md break-all">
                                            {formatValue(record)}
                                        </TableCell>
                                        <TableCell>{record.ttl}</TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={record.enabled}
                                                disabled={isDisabled}
                                                onCheckedChange={(checked) =>
                                                    toggleEnabled(
                                                        record,
                                                        checked
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t("edit")}
                                                disabled={isDisabled}
                                                onClick={() =>
                                                    openEditor(record)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t("delete")}
                                                disabled={isDisabled}
                                                onClick={() => {
                                                    setDeletingRecord(record);
                                                    setDeleteOpen(true);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-24 text-center"
                                    >
                                        {t("customDnsRecordsEmpty")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CustomDnsRecordCredenza
                open={editorOpen && !isDisabled}
                setOpen={setEditorOpen}
                orgId={orgId}
                domainId={domainId}
                baseDomain={baseDomain}
                record={editingRecord}
                onSaved={() => refetch()}
            />

            {deletingRecord && !isDisabled && (
                <ConfirmDeleteDialog
                    open={deleteOpen}
                    setOpen={(open) => {
                        setDeleteOpen(open);
                        if (!open) {
                            setDeletingRecord(null);
                        }
                    }}
                    string={deletingRecord.fullDomain}
                    title={t("customDnsRecordDeleteTitle")}
                    dialog={
                        <p>
                            {t("customDnsRecordDeleteQuestion", {
                                type: deletingRecord.type,
                                name: deletingRecord.fullDomain
                            })}
                        </p>
                    }
                    buttonText={t("customDnsRecordDeleteConfirm")}
                    onConfirm={deleteRecord}
                />
            )}
        </>
    );
}

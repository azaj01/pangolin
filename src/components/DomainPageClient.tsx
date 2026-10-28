"use client";

import { useQuery } from "@tanstack/react-query";
import { domainQueries } from "@app/lib/queries";
import { GetDomainResponse } from "@server/routers/domain/getDomain";
import { GetDNSRecordsResponse } from "@server/routers/domain";
import DomainInfoCard from "@app/components/DomainInfoCard";
import DNSRecordsTable from "@app/components/DNSRecordTable";
import RestartDomainButton from "@app/components/RestartDomainButton";
import RefreshButton from "@app/components/RefreshButton";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import DomainCertForm from "@app/components/DomainCertForm";
import CustomDnsRecordsTable from "@app/components/CustomDnsRecordsTable";
import { build } from "@server/build";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Badge } from "@app/components/ui/badge";

interface DomainPageClientProps {
    initialDomain: GetDomainResponse;
    initialDnsRecords: GetDNSRecordsResponse;
    orgId: string;
    domainId: string;
}

export default function DomainPageClient({
    initialDomain,
    initialDnsRecords,
    orgId,
    domainId
}: DomainPageClientProps) {
    const t = useTranslations();
    const { env } = useEnvContext();

    const { data: domain, refetch: refetchDomain } = useQuery({
        ...domainQueries.getDomain({ orgId, domainId }),
        initialData: initialDomain
    });

    const { data: dnsRecords, refetch: refetchDnsRecords } = useQuery({
        ...domainQueries.getDNSRecords({ orgId, domainId }),
        initialData: initialDnsRecords
    });

    const refetchAll = () => {
        refetchDomain();
        refetchDnsRecords();
    };

    return (
        <>
            <div className="flex justify-between">
                <SettingsSectionTitle
                    title={
                        <span className="flex items-center gap-2">
                            {domain.baseDomain}
                            {domain.configManaged && (
                                <Badge
                                    variant="secondary"
                                    className="flex items-center gap-1 text-sm font-normal"
                                >
                                    <Lock className="h-3 w-3" />
                                    {t("configManaged", {
                                        fallback: "Config Managed"
                                    })}
                                </Badge>
                            )}
                        </span>
                    }
                    description={t("domainSettingDescription")}
                />
                {env.flags.usePangolinDns && domain.failed ? (
                    <RestartDomainButton
                        orgId={orgId}
                        domainId={domain.domainId}
                        onSuccess={refetchAll}
                    />
                ) : (
                    <RefreshButton onRefresh={refetchAll} />
                )}
            </div>
            <div className="space-y-6">
                {build !== "oss" && env.flags.usePangolinDns ? (
                    <DomainInfoCard
                        failed={domain.failed}
                        verified={domain.verified}
                        type={domain.type}
                        errorMessage={domain.errorMessage}
                    />
                ) : null}

                <DNSRecordsTable
                    records={dnsRecords.map((r) => ({
                        ...r,
                        id: String(r.id)
                    }))}
                    type={domain.type}
                />

                {build !== "oss" &&
                    env.flags.usePangolinDns &&
                    !env.flags.disableEnterpriseFeatures &&
                    domain.type === "ns" && (
                        <CustomDnsRecordsTable
                            orgId={orgId}
                            domainId={domain.domainId}
                            baseDomain={domain.baseDomain}
                        />
                    )}

                {domain.type === "wildcard" && !domain.configManaged && (
                    <DomainCertForm
                        orgId={orgId}
                        domainId={domain.domainId}
                        domain={domain}
                    />
                )}
            </div>
        </>
    );
}

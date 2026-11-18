import type { BillingInvoiceDetail } from "./types";

// Read-only projection of canonical Billing snapshots. Like the operational
// receipt, it groups document/issuer/recipient/items/orders/totals for a ticket.
// It is neither a second persisted snapshot nor a print/fiscal-validity engine.
export function billingSimplifiedDraftDocument({ invoice, items }: BillingInvoiceDetail) {
  if (invoice.fiscalDocumentType !== "simplificada" || invoice.documentStatus !== "draft"
    || invoice.invoiceNumber !== null || invoice.issuedAt !== null) {
    throw new Error("billing_simplified_draft_required");
  }
  if (!invoice.pricesIncludeTax || items.length === 0
    || new Set(items.map((item) => item.taxRate)).size !== 1) {
    throw new Error("billing_simplified_tax_model_unsupported");
  }

  return {
    fiscalUseAllowed: false as const,
    document: {
      id: invoice.id,
      fiscalDocumentType: invoice.fiscalDocumentType,
      status: invoice.documentStatus,
      number: invoice.invoiceNumber,
      series: invoice.series,
      issueDate: invoice.issueDate,
      issuedAt: invoice.issuedAt,
    },
    issuer: {
      legalName: invoice.issuerLegalName,
      taxId: invoice.issuerTaxId,
      addressLine1: invoice.issuerAddressLine1,
      addressLine2: invoice.issuerAddressLine2,
      city: invoice.issuerCity,
      region: invoice.issuerRegion,
      postalCode: invoice.issuerPostalCode,
      countryCode: invoice.issuerCountryCode,
      email: invoice.issuerEmail,
      phone: invoice.issuerPhone,
      logoPath: invoice.issuerLogoPath,
    },
    recipient: invoice.customerName === null ? null : {
      name: invoice.customerName,
      taxId: invoice.customerTaxId,
      addressLine1: invoice.customerAddressLine1,
      addressLine2: invoice.customerAddressLine2,
      city: invoice.customerCity,
      postalCode: invoice.customerPostalCode,
      countryCode: invoice.customerCountryCode,
      email: invoice.customerEmail,
    },
    items: items.map((item) => ({ ...item })),
    orders: invoice.orderIds.map((id, index) => ({ id, number: invoice.orderNumbers[index] ?? id })),
    tax: {
      // An aliquot alone cannot establish IGIC territory, exemption or special
      // treatment. No tax regime or legal eligibility is inferred here.
      treatmentValidated: false as const,
      pricesIncludeTax: true as const,
      rate: items[0].taxRate,
      taxableBase: invoice.taxableBase,
      amount: invoice.taxTotal,
    },
    totals: {
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      discount: invoice.discountTotal,
      total: invoice.total,
    },
  };
}

export type BillingSimplifiedDraftDocument = ReturnType<typeof billingSimplifiedDraftDocument>;

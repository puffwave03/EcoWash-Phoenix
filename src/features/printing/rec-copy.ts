import type { BlockedRecState } from "./server/rec-document";

const messages: Record<string, Record<BlockedRecState, string>> = {
  es: {
    partial_or_advance: "El pedido tiene un pago parcial o un anticipo. Su tratamiento fiscal está pendiente de definición; REC no disponible.",
    paid_fiscal_review: "El pago está registrado. Es necesario verificar el tratamiento fiscal antes de disponer de REC.",
    compatible_draft: "Existe un borrador de Billing. REC estará disponible cuando exista una factura emitida; aquí no se emite ningún documento.",
    billing_conflict: "Existe una factura ordinaria o un borrador incompatible. Revisa el documento en Billing.",
    refunded: "El pedido tiene reembolsos. Es necesaria una revisión antes de seleccionar REC.",
    reconciliation_anomaly: "Los datos económicos no están conciliados. REC no disponible; revisa los registros existentes.",
    unknown: "No se ha podido verificar el pedido o recuperar un documento coherente. REC no disponible; vuelve a consultar sin repetir cobros ni emisiones.",
  },
  it: {
    partial_or_advance: "L’ordine ha un pagamento parziale o un acconto. Il trattamento fiscale è da definire; REC non disponibile.",
    paid_fiscal_review: "Il pagamento è registrato. Occorre verificare il trattamento fiscale prima di rendere disponibile REC.",
    compatible_draft: "Esiste una bozza Billing. REC sarà disponibile quando esisterà una fattura emessa; qui non viene emesso alcun documento.",
    billing_conflict: "Esiste una fattura ordinaria o una bozza incompatibile. Verifica il documento in Billing.",
    refunded: "L’ordine presenta rimborsi. Occorre una verifica prima di selezionare REC.",
    reconciliation_anomaly: "I dati economici non sono riconciliati. REC non disponibile; verifica le registrazioni esistenti.",
    unknown: "Impossibile verificare l’ordine o recuperare un documento coerente. REC non disponibile; ripeti la consultazione senza ripetere incassi o emissioni.",
  },
  en: {
    partial_or_advance: "The order has a partial payment or advance. Fiscal treatment remains undefined; REC is unavailable.",
    paid_fiscal_review: "Payment is recorded. Fiscal treatment must be reviewed before REC becomes available.",
    compatible_draft: "A Billing draft exists. REC requires an issued invoice; this page does not issue documents.",
    billing_conflict: "An ordinary invoice or incompatible draft exists. Review the document in Billing.",
    refunded: "The order has refunds. Review is required before selecting REC.",
    reconciliation_anomaly: "Financial data do not reconcile. REC is unavailable; review the existing records.",
    unknown: "The order could not be verified or a consistent document retrieved. REC is unavailable; reload without repeating payments or issuance.",
  },
  fr: {
    partial_or_advance: "La commande comporte un paiement partiel ou un acompte. Le traitement fiscal reste à définir ; REC indisponible.",
    paid_fiscal_review: "Le paiement est enregistré. Le traitement fiscal doit être vérifié avant de rendre REC disponible.",
    compatible_draft: "Un brouillon Billing existe. REC nécessite une facture émise ; cette page n’émet aucun document.",
    billing_conflict: "Une facture ordinaire ou un brouillon incompatible existe. Vérifiez le document dans Billing.",
    refunded: "La commande comporte des remboursements. Une vérification est nécessaire avant de sélectionner REC.",
    reconciliation_anomaly: "Les données financières ne sont pas rapprochées. REC indisponible ; vérifiez les écritures existantes.",
    unknown: "La commande ou la cohérence du document n’a pas pu être vérifiée. REC indisponible ; rechargez sans répéter les paiements ni l’émission.",
  },
  de: {
    partial_or_advance: "Der Auftrag enthält eine Teilzahlung oder Anzahlung. Die steuerliche Behandlung ist noch offen; REC ist nicht verfügbar.",
    paid_fiscal_review: "Die Zahlung ist erfasst. Die steuerliche Behandlung muss vor der Bereitstellung von REC geprüft werden.",
    compatible_draft: "Ein Billing-Entwurf liegt vor. REC benötigt eine ausgestellte Rechnung; diese Seite stellt keine Dokumente aus.",
    billing_conflict: "Eine ordentliche Rechnung oder ein inkompatibler Entwurf liegt vor. Prüfen Sie das Dokument in Billing.",
    refunded: "Der Auftrag enthält Erstattungen. Vor der Auswahl von REC ist eine Prüfung erforderlich.",
    reconciliation_anomaly: "Die Finanzdaten sind nicht abgestimmt. REC ist nicht verfügbar; prüfen Sie die vorhandenen Buchungen.",
    unknown: "Der Auftrag oder die Dokumentkonsistenz konnte nicht geprüft werden. REC ist nicht verfügbar; erneut aufrufen, ohne Zahlungen oder Ausstellungen zu wiederholen.",
  },
};

export function recBlockedMessage(locale: string, state: BlockedRecState): string {
  return (messages[locale.split("-")[0]] ?? messages.es)[state];
}

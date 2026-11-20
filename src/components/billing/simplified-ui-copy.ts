const es = {
  ordinary: "Factura ordinaria", simplified: "Factura simplificada",
  description: "Un único pedido pagado. Se utiliza el cobro POS existente.",
  readOnly: "solo consulta. La creación de borradores y la emisión están deshabilitadas.",
  order: "Número de pedido", search: "Comprobar pedido", prepare: "Preparar borrador",
  series: "Serie exclusiva para facturas simplificadas", issue: "Emitir factura simplificada",
  confirm: "He revisado el borrador y solicito la emisión definitiva.",
  preview: "VISTA PREVIA · SIN EMISIÓN FISCAL", issued: "Factura emitida", refresh: "Recuperar documento",
  unavailable: "La factura ya está emitida. No se ha podido recuperar el ticket; vuelve a consultarlo sin repetir la emisión.",
  blocked: "No se puede continuar. Comprueba los datos del pedido y la configuración de facturación.",
  payment: "El pedido debe estar íntegramente pagado mediante POS, con pagos confirmados, registrados y conciliados.",
  conflict: "El pedido ya tiene una factura o un borrador incompatible. No se creará otro documento.",
  customer: "Faltan datos fiscales del cliente. Complétalos antes de continuar.",
  issuer: "Faltan datos fiscales del emisor en la configuración de facturación.",
  tax: "Los importes o el modelo IGIC del pedido no son compatibles con la factura simplificada.",
  orderUnavailable: "Pedido no disponible para esta organización.",
};
type Copy = typeof es;
const copy: Record<string, Copy> = {
  es,
  it: {
    readOnly: "sola consultazione. Creazione delle bozze ed emissione disabilitate.",
    ordinary: "Fattura ordinaria", simplified: "Fattura semplificata", description: "Un solo ordine pagato. Si utilizza l’incasso POS esistente.",
    order: "Numero ordine", search: "Verifica ordine", prepare: "Prepara bozza", series: "Serie riservata alle fatture semplificate", issue: "Emetti fattura semplificata",
    confirm: "Ho verificato la bozza e richiedo l’emissione definitiva.", preview: "ANTEPRIMA · NESSUNA EMISSIONE FISCALE", issued: "Fattura emessa", refresh: "Recupera documento",
    unavailable: "La fattura è già emessa. Il ticket non è disponibile: ripeti la lettura senza ripetere l’emissione.",
    blocked: "Impossibile proseguire. Verifica i dati dell’ordine e la configurazione Billing.",
    payment: "L’ordine deve essere interamente pagato tramite POS, con pagamenti confermati, registrati e riconciliati.",
    conflict: "L’ordine ha già una fattura o una bozza incompatibile. Non verrà creato un altro documento.",
    customer: "Dati fiscali del cliente incompleti. Completali prima di proseguire.", issuer: "Dati fiscali dell’emittente incompleti nella configurazione Billing.",
    tax: "Importi o modello IGIC dell’ordine incompatibili con la fattura semplificata.", orderUnavailable: "Ordine non disponibile per questa organizzazione.",
  },
  en: {
    readOnly: "read only. Draft creation and issuance are disabled.",
    ordinary: "Ordinary invoice", simplified: "Simplified invoice", description: "One paid order. Uses the existing POS payment.",
    order: "Order number", search: "Check order", prepare: "Prepare draft", series: "Series reserved for simplified invoices", issue: "Issue simplified invoice",
    confirm: "I have checked the draft and request final issuance.", preview: "PREVIEW · NO FISCAL ISSUANCE", issued: "Invoice issued", refresh: "Retrieve document",
    unavailable: "The invoice is already issued. Its ticket could not be retrieved; reload without issuing again.",
    blocked: "Cannot continue. Check the order details and Billing configuration.",
    payment: "The order must be fully paid through POS, with confirmed, recorded and reconciled payments.",
    conflict: "The order already has an invoice or an incompatible draft. No additional document will be created.",
    customer: "Customer fiscal details are incomplete. Complete them before continuing.", issuer: "Issuer fiscal details are incomplete in Billing settings.",
    tax: "Order amounts or IGIC model are incompatible with simplified invoicing.", orderUnavailable: "Order unavailable for this organization.",
  },
  fr: {
    readOnly: "consultation uniquement. La création de brouillons et l’émission sont désactivées.",
    ordinary: "Facture ordinaire", simplified: "Facture simplifiée", description: "Une seule commande payée. Le paiement POS existant est utilisé.",
    order: "Numéro de commande", search: "Vérifier la commande", prepare: "Préparer le brouillon", series: "Série réservée aux factures simplifiées", issue: "Émettre la facture simplifiée",
    confirm: "J’ai vérifié le brouillon et demande l’émission définitive.", preview: "APERÇU · AUCUNE ÉMISSION FISCALE", issued: "Facture émise", refresh: "Récupérer le document",
    unavailable: "La facture est déjà émise. Le ticket est indisponible : rechargez sans répéter l’émission.",
    blocked: "Impossible de continuer. Vérifiez la commande et la configuration Billing.",
    payment: "La commande doit être intégralement payée via POS, avec des paiements confirmés, enregistrés et rapprochés.",
    conflict: "La commande possède déjà une facture ou un brouillon incompatible. Aucun autre document ne sera créé.",
    customer: "Les données fiscales du client sont incomplètes.", issuer: "Les données fiscales de l’émetteur sont incomplètes dans Billing.",
    tax: "Les montants ou le modèle IGIC sont incompatibles avec la facture simplifiée.", orderUnavailable: "Commande indisponible pour cette organisation.",
  },
  de: {
    readOnly: "nur Ansicht. Entwurfserstellung und Ausstellung sind deaktiviert.",
    ordinary: "Ordentliche Rechnung", simplified: "Vereinfachte Rechnung", description: "Ein bezahlter Auftrag. Die vorhandene POS-Zahlung wird verwendet.",
    order: "Auftragsnummer", search: "Auftrag prüfen", prepare: "Entwurf vorbereiten", series: "Reihe für vereinfachte Rechnungen", issue: "Vereinfachte Rechnung ausstellen",
    confirm: "Ich habe den Entwurf geprüft und fordere die endgültige Ausstellung an.", preview: "VORSCHAU · KEINE STEUERLICHE AUSSTELLUNG", issued: "Rechnung ausgestellt", refresh: "Dokument abrufen",
    unavailable: "Die Rechnung wurde bereits ausgestellt. Der Beleg ist nicht verfügbar: erneut abrufen, ohne erneut auszustellen.",
    blocked: "Fortfahren nicht möglich. Auftrag und Billing-Konfiguration prüfen.",
    payment: "Der Auftrag muss vollständig über POS mit bestätigten, erfassten und abgestimmten Zahlungen bezahlt sein.",
    conflict: "Der Auftrag hat bereits eine Rechnung oder einen inkompatiblen Entwurf. Kein weiteres Dokument wird erstellt.",
    customer: "Die Steuerdaten des Kunden sind unvollständig.", issuer: "Die Steuerdaten des Ausstellers sind in Billing unvollständig.",
    tax: "Beträge oder IGIC-Modell sind mit vereinfachten Rechnungen nicht vereinbar.", orderUnavailable: "Auftrag für diese Organisation nicht verfügbar.",
  },
};
export function billingSimplifiedUiCopy(locale: string) {
  return copy[locale.split("-")[0]] ?? copy.es;
}
export function billingSimplifiedUiBlockedLabel(locale: string, reason: string) {
  const text = billingSimplifiedUiCopy(locale);
  if (reason === "customer_incomplete") return text.customer;
  if (reason === "issuer_incomplete") return text.issuer;
  if (["order_unavailable", "invalid_input"].includes(reason)) return text.orderUnavailable;
  if (["not_fully_paid", "payment_exceeds_order", "payment_not_pos", "pos_registration_unverified", "payment_reconciliation_failed"].includes(reason)) return text.payment;
  if (["invoice_conflict", "invoice_already_issued", "ordinary_draft_present", "draft_conflict", "draft_incompatible"].includes(reason)) return text.conflict;
  if (["unsupported_tax_model", "billing_totals_mismatch", "invalid_amounts", "draft_order_mismatch"].includes(reason)) return text.tax;
  return text.blocked;
}

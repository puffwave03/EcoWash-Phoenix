export type TicketSettings = { footer: string | null; simplifiedSeries: string | null; specialMessage?: string | null };
export type TicketSchedule = { readyAt: string | null; pickupAt: string | null; deliveryAt: string | null };

export function parseTicketSettings(footer: string, series: string): TicketSettings | null {
  const normalized = series.trim().toUpperCase();
  if (footer.length > 4000 || (normalized && !/^[A-Z0-9-]{1,12}$/.test(normalized))) return null;
  return { footer: footer.trim() || null, simplifiedSeries: normalized || null };
}

export function parseTicketSpecialMessage(value: string): { specialMessage: string | null } | null {
  return value.length > 4000 ? null : { specialMessage: value.trim() || null };
}

const es = {
  specialMessage: "Mensaje especial", specialMessageHelp: "Texto opcional y temporal, separado de las condiciones permanentes.",
  title: "Ticket 80 mm", footer: "Texto al pie del ticket", footerHelp: "Condiciones, avisos e instrucciones. Texto opcional; admite varias líneas.",
  series: "Serie exclusiva para facturas simplificadas", seriesHelp: "Sin valor predeterminado. Debe ser distinta de la serie ordinaria. Requiere Facturación para cambiarla.",
  save: "Guardar", saving: "Guardando…", saved: "Configuración guardada", error: "No se ha guardado. Revisa el texto, la serie y los permisos.",
  unavailable: "Configuración no disponible. Es necesaria la migración de ajustes del ticket.",
  operational: "TICKET OPERATIVO · NO FISCAL", ready: "Trabajo previsto listo", pickup: "Recogida prevista", delivery: "Entrega prevista", blocked: "Ticket no disponible: el pedido debe estar activo, detallado y totalmente sin pagar.",
};
export const ticketCopy = {
  es,
  it: { specialMessage: "Messaggio speciale", specialMessageHelp: "Testo facoltativo temporaneo, separato dalle condizioni permanenti.", title: "Ticket 80 mm", footer: "Testo in fondo al ticket", footerHelp: "Condizioni, avvisi e istruzioni. Testo facoltativo su più righe.", series: "Serie esclusiva per fatture semplificate", seriesHelp: "Nessun valore predefinito. Diversa dalla serie ordinaria. Modifica consentita con Fatturazione.", save: "Salva", saving: "Salvataggio…", saved: "Configurazione salvata", error: "Salvataggio non riuscito. Verifica testo, serie e permessi.", unavailable: "Configurazione non disponibile. Serve la migrazione delle impostazioni del ticket.", operational: "TICKET OPERATIVO · NON FISCALE", ready: "Lavorazione prevista pronta", pickup: "Ritiro previsto", delivery: "Consegna prevista", blocked: "Ticket non disponibile: l’ordine deve essere attivo, dettagliato e totalmente non pagato." },
  en: { specialMessage: "Special message", specialMessageHelp: "Optional temporary text, separate from permanent terms.", title: "80 mm ticket", footer: "Ticket footer", footerHelp: "Terms, notices and instructions. Optional multiline text.", series: "Exclusive simplified invoice series", seriesHelp: "No default. Must differ from the ordinary series. Billing is required to change it.", save: "Save", saving: "Saving…", saved: "Settings saved", error: "Not saved. Check text, series and permissions.", unavailable: "Settings unavailable. The ticket settings migration is required.", operational: "OPERATIONAL TICKET · NON-FISCAL", ready: "Expected work completion", pickup: "Expected pickup", delivery: "Expected delivery", blocked: "Ticket unavailable: the order must be active, detailed and completely unpaid." },
  fr: { specialMessage: "Message spécial", specialMessageHelp: "Texte temporaire facultatif, distinct des conditions permanentes.", title: "Ticket 80 mm", footer: "Texte en bas du ticket", footerHelp: "Conditions, avis et instructions. Texte facultatif sur plusieurs lignes.", series: "Série exclusive des factures simplifiées", seriesHelp: "Aucune valeur par défaut. Différente de la série ordinaire. Facturation requise pour la modifier.", save: "Enregistrer", saving: "Enregistrement…", saved: "Configuration enregistrée", error: "Échec. Vérifiez le texte, la série et les autorisations.", unavailable: "Configuration indisponible. Migration des paramètres du ticket requise.", operational: "TICKET OPÉRATIONNEL · NON FISCAL", ready: "Fin de traitement prévue", pickup: "Retrait prévu", delivery: "Livraison prévue", blocked: "Ticket indisponible : la commande doit être active, détaillée et entièrement impayée." },
  de: { specialMessage: "Besondere Mitteilung", specialMessageHelp: "Optionaler vorübergehender Text, getrennt von dauerhaften Bedingungen.", title: "80-mm-Ticket", footer: "Ticket-Fußtext", footerHelp: "Bedingungen, Hinweise und Anweisungen. Optionaler mehrzeiliger Text.", series: "Exklusive Serie für vereinfachte Rechnungen", seriesHelp: "Kein Standardwert. Muss von der normalen Serie abweichen. Änderung erfordert Rechnungsstellung.", save: "Speichern", saving: "Wird gespeichert…", saved: "Einstellungen gespeichert", error: "Nicht gespeichert. Text, Serie und Berechtigungen prüfen.", unavailable: "Einstellungen nicht verfügbar. Migration der Ticketeinstellungen erforderlich.", operational: "BETRIEBLICHES TICKET · NICHT FISKALISCH", ready: "Geplante Fertigstellung", pickup: "Geplante Abholung", delivery: "Geplante Lieferung", blocked: "Ticket nicht verfügbar: Auftrag muss aktiv, detailliert und vollständig unbezahlt sein." },
} satisfies Record<string, Record<keyof typeof es, string>>;
export function ticketText(locale: string) { return ticketCopy[locale.split("-")[0] as keyof typeof ticketCopy] ?? es; }

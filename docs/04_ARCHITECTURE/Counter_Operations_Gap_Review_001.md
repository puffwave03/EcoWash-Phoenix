# COUNTER-OPERATIONS-GAP-REVIEW-001

## Closeout documentale — 04/11/2026

**COMPLETE — CTO REVIEW PASS per analisi READ ONLY, con condizioni sulle future implementazioni.** Baseline analizzata: `3d5360ad5a48976f40510952b6f8b7ff585d9ae4`. Analisi statica; nessun nuovo test o UAT, nessuna modifica applicativa o database. Questo closeout pubblica esclusivamente documentazione, con commit/push autorizzati dal PO.

Orders, POS, Billing e Accounting restano fondazioni riutilizzabili. I blocchi confermati riguardano classificazione dei pagamenti, finale dopo anticipi, stampa cliente e stampa termica fiscale. La direzione approvata prevede REC futura non obbligatoria e conservazione integrale dello storico. FATTURATO e PAGATO restano indipendenti. Un formato termico uniforme, normalmente in due copie, non unifica le identità documentali: emissione fiscale, incasso e stampa sono eventi distinti. Le note cliente devono restare disponibili; le note interne devono restare riservate.

**Condizioni CTO:** `BILLING-EVENT-CONTRACT-001` precede qualsiasi modifica delle regole fiscali. `COUNTER-NOTES-VISIBILITY-001` è la prima possibile correzione applicativa indipendente, da autorizzare separatamente. Entrambe sono **NOT STARTED**. Tutta la roadmap P0/P1/P2/P3 è proposta, non avviata e non costituisce autorizzazione. Nessun problema operativo o fiscale viene dichiarato risolto da questa pubblicazione.

Il rapporto integrale seguente conserva lo stato e le dichiarazioni della consegna READ ONLY; questa intestazione registra il successivo PASS CTO. I precedenti checkpoint PLANNED / NOT STARTED del benchmark sono storici per questa revisione. Riferimenti canonici: [Session Handover](../00_START_HERE/SESSION_HANDOVER.md), [Project Status](../06_ROADMAP/Project_Status.md).

**Nota editoriale sui riferimenti:** i link assoluti della sessione sono normalizzati a percorsi relativi con frammenti `#L`. In R8 il rapporto originario cita `20261018000200_billing_simplified_invoice_001g_advance_link_foundation.sql`: il file effettivo è [20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql](../../supabase/migrations/20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql). Il refuso originale resta nel testo storico; non cambia l'evidenza o le conclusioni.

---

## Rapporto integrale consegnato per CTO review

**COUNTER-OPERATIONS-GAP-REVIEW-001 — READY_FOR_CTO_REVIEW**

Phoenix dispone già dei principali moduli operativi. Il lavoro necessario riguarda soprattutto il collegamento corretto tra operazioni al banco, pagamenti, emissione fiscale e stampa. **Non serve ricostruire Orders, POS, Billing o Accounting.**

I blocchi principali sono confermati nel codice: classificazione troppo ampia dei pagamenti come percorso anticipo; finale dopo anticipi subordinato a un saldo già incassato e riconciliabile; stampa EW non adatta invariata al cliente perché include note interne; assenza di un percorso termico Billing uniforme e configurabile.

### Parte A — Valutazione esecutiva

**Baseline verificata**

- Branch: `main`.
- HEAD e `origin/main`: `3d5360ad5a48976f40510952b6f8b7ff585d9ae4`.
- Index e worktree puliti, anche al termine.
- Ultimo checkpoint: benchmark **COMPLETE — CTO REVIEW PASS**.
- Questa revisione era registrata **PLANNED / NOT STARTED**; viene svolta ora esclusivamente in analisi.
- Nessuna modifica, test eseguito, operazione database, commit, push o deploy.

Sono state riutilizzate le evidenze del [benchmark approvato](Fiscal_Document_Benchmark_001.md), integrate con ispezioni mirate del codice. **Le conclusioni seguenti sono evidenze statiche, non nuova UAT.**

**Già sufficientemente implementato come fondazione**

Accettazione ordini, clienti registrati e occasionali, servizi e prezzi, pagamenti parziali e misti, sessioni POS, rimborsi finanziari, residui, produzione e consegna separati, fatture ordinarie multiordine, numerazioni e snapshot, storico REC, etichette e QR, chiusure giornaliere ed esportazioni operative.

“Sufficientemente implementato” non significa certificato per ogni combinazione commerciale o fiscale.

**Bloccanti rispetto al contratto PO**

1. Pagamento al ritiro che indirizza impropriamente verso il percorso anticipo.
2. Finale dopo anticipi non disponibile con credito ancora aperto.
3. Copertura incompleta di più pagamenti, saldo misto e rimborsi nella riconciliazione fiscale.
4. Ticket EW che contiene note interne e non mostra tutti gli importi richiesti.
5. Stampa fiscale termica e configurazione generale delle copie non completate.

Non è stata accertata una divulgazione reale di note a clienti né una perdita finanziaria. Il rischio di divulgazione deriva dall’uso del ticket attuale, esplicitamente interno, come futura copia cliente.

### Parte B — Matrice funzionale

Classificazioni: **EXISTS** verificato nel codice; **PARTIAL** presente ma incompleto; **MISSING** assenza nel percorso ispezionato; **BLOCKED** scenario non completabile con le regole attuali; **NOT VERIFIED** evidenza insufficiente.

| Requisito | Stato | Evidenza e comportamento | Rischio e correzione minima |
|---|---|---|---|
| Accettazione capi e servizi | **EXISTS** | `submitShopOrderAction` → `submit_shop_terminal_order`; ordini confermati al banco possono iniziare `received`. [R1] | Riutilizzare il flusso transazionale; non creare un secondo checkout. |
| Clienti registrati e occasionali | **EXISTS** | `createCustomerAction`, `createShopCustomerAction`, `resolve_shared_walk_in_customer`. [R1–R2] | Preservare isolamento tenant e dati della singola visita; l’identità operativa non determina da sola il destinatario fiscale. |
| Note cliente e interne | **PARTIAL** | Campi separati persistiti; Terminal presenta due textarea con lo stesso placeholder. EW stampa entrambe. [R1, R3] | Separazione poco chiara all’operatore e rischio sulla copia cliente. Etichette esplicite e selezione dei contenuti per destinatario. |
| Servizi, prezzi, data prevista | **EXISTS** | Dati presenti nell’ordine; `Ticket` mostra servizi e data prevista. [R3] | Non ricostruire il modello; completare la rappresentazione richiesta. |
| Totale, pagato e residuo sul ticket EW | **PARTIAL** | EW mostra lo stato pagamento, non la tabella monetaria completa. REC e contesto di stampa possiedono già dati utili. [R3–R4] | Riutilizzare i dati canonici, distinguendo importi correnti da snapshot storici. |
| Pagamento completo/parziale/differito | **EXISTS** | POS registra importi; Terminal supporta pagamento e `later`. [R1, R5] | Non equiparare automaticamente pagamento finanziario ad anticipo fiscale. |
| Pagamento misto | **EXISTS** finanziariamente; **PARTIAL** fiscalmente | Terminal dispone di cash/card separati; Billing ha condizioni più ristrette. [R1, R7] | Un checkout finanziariamente valido può non avere un percorso fiscale completo. |
| Rimborsi | **EXISTS** finanziariamente; **PARTIAL** fiscalmente | `record_pos_refund`; rimborso separato dal pagamento originario. [R5] | Rimborso monetario non equivale a rettifica fiscale. Serve contratto esplicito, senza riscrivere movimenti. |
| Sessioni e quadratura POS | **EXISTS** | Apertura, chiusura, fondo iniziale, contante atteso/contato e differenza. [R5] | Riutilizzare i controlli di sessione e sede. |
| Movimenti di cassa non commerciali | **MISSING nel percorso POS ispezionato** | Azioni POS esaminate: apertura, pagamento, rimborso, chiusura; riepilogo basato su fondo, pagamenti e rimborsi. [R5] | Non simulare prelievi/versamenti con vendite o rimborsi. Prima definire casi PO effettivamente necessari. |
| Semplificata dopo pagamento | **BLOCKED** nel percorso diretto del servizio | Qualsiasi pagamento `status <> 'void'` provoca `billing_advance_workflow_required`. [R6] | Classificare l’evento senza rimuovere indiscriminatamente il controllo. |
| Anticipo integrale | **PARTIAL** | Ramo dedicato a un pagamento integrale con vincoli specifici. [R7] | Non generalizzabile automaticamente a cash+card o più anticipi fino al 100%. |
| Finale dopo anticipi | **PARTIAL / BLOCKED con credito aperto** | Richiede anticipi emessi, saldo POS attribuibile e riconciliazione esatta. [R7] | Separare obbligo di documentazione finale dall’avvenuto incasso del saldo. |
| Fattura ordinaria non pagata | **EXISTS** | Emissione ordinaria e saldo finanziario sono separati; query Billing derivano pagato/residuo. [R8] | Conservare indipendenza tra stato documento e stato pagamento. |
| Mensile multiordine | **PARTIAL** | Bozza ordinaria fino a 50 ordini compatibili e selezione degli ordini eleggibili. [R8] | Non manca il motore multiordine; mancano evidenza completa del contratto mensile e gestione delle casistiche fiscali precedenti. |
| Ordinaria successiva a semplificata | **NOT VERIFIED come percorso completo** | Link attivi e storico proteggono la fatturazione; non dimostrato un percorso completo di sostituzione fiscalmente corretto. [R8] | Non cancellare/disattivare collegamenti per aggirare la protezione. Decisione fiscale preliminare. |
| Numerazioni e snapshot | **EXISTS** | Billing e REC hanno fonti, numerazioni e protezioni distinte. [R4, R7–R8] | Preservare immutabilità, concorrenza e idempotenza. |
| REC opzionale nel futuro | **PARTIAL: direzione approvata, flusso ancora attuale** | La route senza `document=fiscal` può emettere REC. [R9] | Modificare in futuro i punti d’ingresso, preservando lettura, ristampa, numeri e vincoli storici. |
| Termico 58/80 mm | **PARTIAL** | Formati nei profili e nel ramo receipt di `OrderPrintDocument`; REC persistente ha proprio componente; Billing usa layout distinto. [R3–R4, R10] | I formati configurati non provano supporto uniforme su tutti i documenti. |
| Due copie configurabili | **PARTIAL** | Billing semplificata emessa genera già due copie di presentazione; `labelCopies` riguarda etichette. [R10] | Riutilizzare il precedente, aggiungendo configurazione coerente senza duplicare emissioni. |
| Ristampa | **EXISTS**, con semantiche differenti | REC usa snapshot; Billing rappresenta fattura; EW legge ordine corrente. [R3–R4, R9–R10] | Non chiamare “ristampa storica” una rigenerazione EW da dati correnti. |
| Profili/adattatori stampante | **PARTIAL** | Configurazioni `browser/network/local_bridge/vendor_adapter`; stampa effettiva osservata tramite `window.print()`, con fallback. [R10] | Configurazione non equivale ad adattatore hardware implementato. Stampa fisica **NOT VERIFIED**. |
| Accounting e chiusura giornaliera | **EXISTS** | Riepiloghi, chiusure persistenti, CSV/PDF e pacchetto contabile operativo. [R11] | Non presentarli come liquidazione IGIC o contabilità fiscale completa. |
| Registro documenti e dettaglio IGIC fattura | **EXISTS** | `list_sales_documents_page` include REC e fatture; Billing mostra base/imposta/totale. [R10–R12] | Un registro misto documentale non è automaticamente un registro fiscale regolamentare. |
| Riepilogo fiscale IGIC periodico | **MISSING nell’export Accounting esaminato** | `sales.csv` esporta eventi/importi; `summary.csv` è `accounting_support_non_fiscal`. [R11] | Progettare eventualmente una lettura da Billing, evitando doppio conteggio anticipo/finale. |
| Crediti aperti | **EXISTS** | Customer Account usa riepilogo e liste di ordini/pagamenti; Billing deriva residui. [R13] | Evitare una seconda contabilità del credito. |
| Vendite per articolo/categoria/periodo | **PARTIAL** | Reporting per periodo presente; export vendite esaminato non contiene dettaglio articolo/categoria. [R11] | Definire metrica e base temporale prima di aggiungere aggregazioni. |
| Etichette e QR | **EXISTS** | `buildPrintLabels`, `ScannableQrCode`, codici ordine/capo e profili etichetta. [R3] | Verificare hardware e leggibilità, senza ricostruire identificazione capi. |
| Express | **PARTIAL** | Priorità `normal/express` negli ordini; sovrapprezzo automatico dedicato non dimostrato. [R14] | Distinguere urgenza operativa e tariffa; valutare prima servizi/prezzi già configurabili. |
| Notifiche cliente | **PARTIAL** | Inviti/accesso portale e contatto WhatsApp presenti; notifica automatica “ordine pronto” non individuata nel percorso esaminato. [R15] | Non confondere email Auth o link WhatsApp con notifiche operative. |
| Import clienti | **MISSING nel flusso clienti ispezionato** | CRUD presente; non individuato import clienti con mapping, anteprima e deduplicazione. [R2] | Non è un blocco per l’inserimento manuale; eventuale import richiede missione separata. |
| Configurabilità multi-tenant | **EXISTS**, con limiti funzionali | Membership server, entitlements, profili stampante per sede, impostazioni fiscali e cataloghi. [R1, R10–R11] | Le nuove funzioni devono estendere questi confini, non accettare tenant dal client come autorizzazione. |

**Riferimenti puntuali della matrice**

- **R1:** [Terminal actions](../../src/features/shop-terminal/server/actions.ts#L86), `createShopCustomerAction`, `submitShopOrderAction`; [Terminal UI](../../src/components/shop-terminal/ShopTerminalWorkspace.tsx#L1326); migrazioni `20261030135502_pos_advance_ux_001.sql`, `20261029224950_terminal_counter_order_received_001.sql`.
- **R2:** [Customer actions](../../src/features/customers/server/actions.ts#L29), `createCustomerAction`, `updateCustomerAction`.
- **R3:** [OrderPrintDocument](../../src/components/printing/OrderPrintDocument.tsx#L84), `Ticket`, `Labels`; [label builder](../../src/features/printing/labels.ts); `src/features/printing/server/queries.ts`, `getPrintOrderContext`.
- **R4:** [REC component](../../src/components/sales-documents/OperationalReceiptDocument.tsx); migrazione `20260908000100_accounting_sales_documents_001.sql`, `issue_operational_receipt`.
- **R5:** [POS actions](../../src/features/pos/server/actions.ts#L22); [POS types](../../src/features/pos/types.ts); migrazioni `20260930000200_pos_session_payment_boundary_001.sql`, `20260930000300_pos_refund_channel_session_boundary_001.sql`.
- **R6:** [Controllo storico pagamenti](../../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql#L144).
- **R7:** [Anticipo integrale/parziale](../../supabase/migrations/20261028163423_billing_full_prepayment_001.sql#L60), `issue_billing_advance_invoice`; [finale](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql#L537), `issue_billing_final_after_advances`.
- **R8:** [Bozza multiordine](../../supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql#L131), `create_billing_draft_internal`; `20261007000100_billing_eligible_order_selector_001.sql`; `20261018000200_billing_simplified_invoice_001g_advance_link_foundation.sql`; [query Billing](../../src/features/billing/server/queries.ts#L171).
- **R9:** [Receipt route](<../../src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx#L9>); [resolver Billing ordine](../../src/features/billing/server/order-entry.ts).
- **R10:** [Billing print](../../src/components/billing/BillingInvoiceView.tsx#L49); [printer types](../../src/features/printer-settings/types.ts#L1); [PrintButton](../../src/components/printing/PrintButton.tsx#L5); `savePrinterProfileAction` in `src/features/printer-settings/server/actions.ts`.
- **R11:** [Accounting export](../../src/features/accounting/server/export-readers.ts#L11); [riepilogo non fiscale](../../src/features/accounting/server/accountant-support.ts); [pacchetto export](../../src/features/accounting/server/accountant-pack-stream.ts#L11); [Daily Close](../../src/features/daily-close/server/actions.ts#L53), `close_daily_close`; `src/features/daily-close/export.ts`, CSV/PDF.
- **R12:** [Registro documenti](../../supabase/migrations/20261004000300_data_retention_scale_001h_billing_sales_document_history.sql#L150), `list_sales_documents_page`.
- **R13:** [Customer Account](../../src/features/customer-account/server/queries.ts#L112), `getCustomerAccountFinancials`, `get_customer_account_summary`.
- **R14:** `src/features/orders/types.ts`, `ORDER_PRIORITIES`; `src/features/orders/validation.ts`; `src/features/pricing-segments/server/order-services.ts`.
- **R15:** `src/features/portal/server/actions.ts`, inviti/reset; `src/components/portal/CustomerPortalViews.tsx`, collegamento WhatsApp.

Le assenze indicate sono circoscritte ai flussi e agli export ispezionati: non sono affermazioni su integrazioni esterne non esaminate.

### Parte C — Matrice end-to-end

| Scenario PO | Percorso attuale | Esito e differenza da colmare |
|---|---|---|
| Accettazione senza pagamento | Ordine ricevuto, ticket, credito aperto | **EXISTS** operativamente. Il momento fiscale va stabilito separatamente; non dedurlo dall’assenza d’incasso. |
| Pagamento completo all’accettazione | POS registra; ramo Billing di prepagamento integrale | **PARTIAL**: percorso supportato entro condizioni precise, non universale per qualsiasi composizione del pagamento. |
| Anticipo parziale e saldo unico al ritiro | Pagamento anticipo, documento anticipo, pagamento saldo, finale | **PARTIAL**: percorso esistente con controlli stringenti; non da ricostruire. |
| Più anticipi, totale inferiore al 100%, saldo unico | Più documenti/attribuzioni, poi riconciliazione | **PARTIAL**: verificare tutte le condizioni e gli arrotondamenti; nuova UAT non eseguita. |
| Più anticipi che raggiungono il 100% | Il ramo parziale non equivale al ramo integrale singolo | **BLOCKED nel percorso generale atteso**: manca una copertura equivalente dimostrata. |
| Pagamento completo al ritiro | Incasso valido; emissione diretta semplificata trova pagamento | **BLOCKED** dal controllo che richiede il percorso anticipo. |
| Saldo cash+card dopo anticipo | Due pagamenti finanziari | **BLOCKED nel finale attuale**, che richiede un pagamento saldo e relazione numerica precisa fra pagamenti e anticipi. |
| Ritiro senza pagamento, nessun anticipo | Handoff con conferma del residuo; ordinaria emettibile non pagata | **EXISTS** come fondazione. Semplificata subordinata a requisiti e dichiarazioni propri. |
| Ritiro con credito residuo dopo anticipo | Consegna finanziariamente possibile | **BLOCKED** per il finale dopo anticipi senza saldo incassato. |
| Mensile professionale multiordine | Selezione ordini e bozza ordinaria multiordine | **PARTIAL**: mantenere fatturato ≠ pagato; definire periodo, prestazioni eleggibili e trattamento di precedenti documenti. |
| Incasso successivo a fattura ordinaria | Pagamento sugli ordini collegati; Billing ricalcola residuo | **EXISTS**. Incasso unico distribuito su molti ordini: UX completa **NOT VERIFIED**. |
| Rimborso dopo documento fiscale | Rimborso finanziario disponibile | **PARTIAL**: correzione fiscale e riconciliazione non derivano automaticamente dal rimborso. |
| Ristampa | REC/Billing ristampabili; EW rigenerato | **EXISTS**, mantenendo distinte le tre semantiche. |

### Risposte esplicite alle dieci domande critiche

1. **Perché viene forzato l’anticipo?**
   Per un controllo conservativo dello storico: basta un pagamento non `void`. Il commento SQL dichiara di non ricavare implicitamente data e natura fiscale dell’anticipo. La UI presenta inoltre il percorso anticipi quando trova pagamenti. È una limitazione intenzionale del percorso implementato, non una dimostrazione che quel pagamento sia realmente un anticipo.

2. **Cosa impedisce il finale in ogni scenario?**
   Necessità di un saldo POS confermato e attribuibile; assenza di rimborsi nella storia ammessa; `payment_count = advance_count + 1`; somma anticipi più saldo uguale al totale; ulteriori vincoli fiscali, temporali e di configurazione. Il finale non è un motore generale per credito aperto, saldo misto e storie finanziarie complesse.

3. **Il modello può mantenere fatture non pagate?**
   **Sì.** Le fatture ordinarie possono essere emesse senza pagamento e il residuo deriva dai fatti finanziari. Il blocco è principalmente nel percorso specifico finale dopo anticipi, non nell’intero modello.

4. **Cosa impedisce la fatturazione mensile corretta?**
   Non manca la creazione multiordine. Restano da definire e verificare periodo/competenza, eleggibilità dei servizi, precedenti semplificate o anticipi, rettifiche, limite di 50 ordini e modalità d’incasso distribuito. Il selettore non costituisce da solo un contratto mensile completo.

5. **Come escludere REC senza danneggiare lo storico?**
   Eliminare in futuro l’emissione REC dai passaggi obbligatori e riordinare la navigazione. Conservare tabelle, snapshot, numeri, eventi e ristampa; mantenere i vincoli che proteggono ordini già documentati. Nessuna conversione retroattiva.

6. **I componenti permettono un layout termico unificato?**
   **Sì come base di riuso, non come funzione già completa.** Esistono formati, profili, componenti monetari e precedente di due copie Billing. Servono composizione condivisa, contenuto selezionato per tipo/destinatario e configurazione copie. Gli adattatori hardware restano un tema distinto.

7. **EW espone note interne?**
   **Sì nel documento stampato:** `Ticket` renderizza `internalNotes` insieme a `customerNotes`. Il documento è però denominato interno; non è accertata una divulgazione reale. Non deve diventare copia cliente senza correzione.

8. **Quali report fiscali esistono?**
   Dettaglio imponibile/imposta delle fatture e registro documentale esistono. Accounting, Daily Close ed export esistono ma sono operativi. Nell’export ispezionato manca una riconciliazione fiscale periodica IGIC basata sui documenti emessi e sulle rettifiche.

9. **Cosa si può migliorare riutilizzando componenti esistenti?**
   Etichette delle note, selezione contenuti cliente/interno, importi nel ticket, navigazione Billing, formati di stampa e riepiloghi derivati. Classificazione fiscale, finale a credito e rettifiche richiedono invece decisioni e controlli di dominio, non solo modifiche UI.

10. **Qual è la sequenza minima?**
    Prima separazione delle note e contratto fiscale degli eventi; poi percorso servizio con pagamento già registrato; quindi riconciliazione finale; stampa termica e REC opzionale; infine mensile e reporting fiscale. Funzioni accessorie soltanto su necessità PO dimostrata.

### Parte D — Rischi fiscali e d’integrità

| Rischio | Conseguenza | Presidio necessario |
|---|---|---|
| Interpretare ogni pagamento come anticipo | Classificazione fiscale non aderente all’evento | Contratto esplicito approvato; non inferire dalla sola esistenza del pagamento |
| Richiedere un nuovo pagamento per sbloccare il finale | Possibile doppio incasso | Riutilizzare pagamenti reali; consentire credito aperto nel modello approvato |
| Rifatturare un servizio già documentato | Doppia documentazione/imposizione | Collegamenti storici e procedura di sostituzione/rettifica formalizzata |
| Sommare indiscriminatamente anticipi e totale dell’operazione | Reporting fiscale duplicato | Distinguere importo operazione, importi documentati e saldo |
| Modificare REC o fatture storiche per adeguarle al nuovo flusso | Perdita di evidenza storica | Solo nuovi comportamenti; snapshot e numerazioni preservati |
| Stampare dati correnti come contenuto fiscale storico | Divergenza dal documento emesso | Parte fiscale alimentata esclusivamente da Billing emesso |
| Confondere residuo corrente e residuo alla data del documento | Quietanza o ristampa ambigua | Etichettare chiaramente natura e data degli importi |
| Copia cliente contenente note interne | Divulgazione operativa | Selezione esplicita del destinatario e test negativi |
| Estendere query/azioni senza confini tenant | Accesso o attribuzione errata | Tenant server-derived, RLS e controlli su ogni collegamento |

**Migrazioni:** nessuna necessaria per questa analisi. Le future modifiche a classificazione, attribuzioni o configurazione copie potrebbero richiederle, ma lo schema minimo non è ancora deciso. Non è giustificato proporre ora una migrazione o riclassificazione massiva dei dati storici.

**Validazioni IGIC:** momento dell’operazione e degli anticipi; semplificata per occasionali; finale con credito aperto o anticipo al 100%; rettifiche/rimborsi; ordinaria successiva a semplificata; riepilogativa mensile; aliquote, arrotondamenti e registri richiesti. Le condizioni attuali del pilot ES-CN/IGIC 7% non certificano tutti questi casi.

### Parte E — Roadmap minima proposta

Le priorità seguenti sono **proposte per CTO/PO**, non autorizzazioni. P0 indica un requisito preliminare al nuovo flusso commerciale interessato; non implica un incidente di produzione accertato.

| Priorità / missione proposta | Obiettivo, dipendenze e impatto | Rischi, test e UAT | Accettazione |
|---|---|---|---|
| **P0 — COUNTER-NOTES-VISIBILITY-001** | Separare chiaramente note cliente/interne e contenuti delle copie. Riusa campi attuali; impatto Terminal e stampa. | Test positivi/negativi sulle due note; UAT con testi distinti e copia cliente/interna. | Nessuna nota interna nella copia cliente; note cliente conservate. |
| **P0 — BILLING-EVENT-CONTRACT-001** | Decisione CTO/consulente su servizio, anticipo, saldo, credito e sostituzioni. Nessuna implementazione preliminare. | Rischio di regole fiscali inventate; revisione tabella scenari PO/consulente. | Ogni scenario ha evento, documento, attribuzione e regola di rettifica espliciti. |
| **P0 — BILLING-SERVICE-PAYMENT-CLASSIFICATION-001** | Correggere il percorso servizio con pagamento già presente, dopo il contratto precedente. Impatto UI/azioni/RPC interessate. | Test pagamento al ritiro, vero anticipo, storico rimborsato, retry, lock e tenant; UAT pagamento al ritiro. | Emissione appropriata senza falso anticipo e senza modificare il pagamento. |
| **P1 — BILLING-FINAL-RECONCILIATION-001** | Coprire finale a credito, saldo misto e più anticipi secondo contratto. Riusa link e snapshot esistenti. | Rischio economico elevato; test importi/arrotondamenti, 100%, attribuzioni duplicate, concorrenza e regressione C2; UAT degli scenari ammessi. | Ogni pagamento attribuito correttamente; nessun incasso artificiale; totale fiscale riconciliato. |
| **P1 — COUNTER-THERMAL-DOCUMENTS-001** | Layout uniforme 58/80 mm e copie configurabili, mantenendo tipi documentali distinti. Dipende dal contratto dei contenuti. | Test overflow, importi, note, copie e ristampa; UAT su stampanti reali. | Copie leggibili; una sola emissione; contenuto fiscale da Billing emesso. |
| **P1 — REC-OPTIONAL-WORKFLOW-001** | Rimuovere REC dai passaggi obbligatori dopo analisi delle dipendenze. Impatto navigazione e route. | Test storico, ristampa, permessi e guardie economiche; UAT ordine senza nuova REC e accesso a vecchia REC. | Nessuna REC automatica non richiesta; storico integralmente disponibile. |
| **P1 — PROFESSIONAL-MONTHLY-BILLING-001** | Completare selezione mensile e incasso degli ordini usando il motore multiordine. Dipende dalle regole sui documenti precedenti. | Test duplicazione, bozze concorrenti, periodo, annullamenti e residui; UAT più ordini fatturati ma non pagati. | Ordini inclusi esclusi da nuova fatturazione indebita; emissione non azzera il credito. |
| **P2 — BILLING-FISCAL-REGISTER-RECONCILIATION-001** | Vista/export fiscale derivato da Billing, se confermato necessario dal consulente. | Test anticipo/finale/rettifica e differenza rispetto agli incassi; UAT riconciliazione di un periodo. | Nessun doppio conteggio; totali spiegabili per documento e periodo. |
| **P2 — POS-NONSALE-CASH-001**, solo se richiesto | Movimenti non commerciali senza ordini fittizi. Dipende da casi PO, autorizzazioni e formula di quadratura. | Test saldo cassa, audit, permessi e chiusura; UAT versamento/prelievo reale simulato. | Movimenti separati da vendite e rimborsi, quadratura coerente. |
| **P3 — estensioni accessorie da selezionare** | Import clienti, notifiche pronto, tariffa express, analisi per categoria. Nessuna apertura automatica. | Specifiche separate: deduplicazione import; consegna notifiche; prezzi server; definizione metriche. UAT per singola funzione. | Utilità PO dimostrata e riuso dei moduli esistenti prima di nuovo sviluppo. |

Per la riconciliazione finale il CTO potrà separare ulteriormente gli incrementi: credito aperto, saldo misto e anticipi al 100% non devono necessariamente entrare nella stessa patch.

**Test esistenti da riutilizzare**, senza rieseguirli in questa missione: `print-contract`, `printer-settings-contract`, `pos-contract`, `pos-advance-ux-001`, `pos-refund-channel-session-boundary-001`, `billing-full-prepayment-001`, `billing-simplified-invoice-001g-c2-postgres`, `billing-eligible-order-selector-001-contract`, `accounting-read-model`, `daily-close-export-contract` e `customer-account-contract`.

La loro presenza non prova che coprano già i nuovi requisiti.

### Parte F — Registro decisioni CTO/PO

| Decisione richiesta | Autorità / risultato atteso |
|---|---|
| Quali contenuti appartengono alla copia cliente e a quella interna? | PO approva contenuti; CTO definisce confine di rappresentazione |
| Quando un pagamento è anticipo fiscale e quando è pagamento del servizio? | Consulente IGIC + CTO; PO valida il workflow |
| Come emettere il finale con credito aperto o anticipi al 100%? | Contratto fiscale prima delle RPC |
| Come gestire saldo misto e più pagamenti? | CTO definisce attribuzioni; PO approva UX; consulente valida effetti fiscali |
| Ordinaria successiva a semplificata: sostituzione, rettifica o altro procedimento? | Decisione fiscale esplicita; nessun aggiramento dei link |
| Quali REC restano emettibili opzionalmente e da quali azioni? | PO/CTO; storico sempre preservato |
| Quali importi della ristampa sono storici e quali correnti? | CTO/PO, con rappresentazione non ambigua |
| Quale periodo e quali operazioni entrano nella mensile? | PO/consulente; CTO traduce in eleggibilità e protezioni |
| Quali stampanti e modalità di consegna sono richieste? | PO identifica hardware; CTO limita adapter e configurazione |
| Quale registro/export IGIC è effettivamente richiesto? | Consulente definisce contenuto; CTO evita duplicazione di Accounting |
| Movimenti non commerciali, import, notifiche ed express sono necessari al primo esercizio? | Priorità PO; nessuna missione automatica |

**Esito finale: READY_FOR_CTO_REVIEW.** Le fondazioni esistenti sono riutilizzabili; restano aperti i contratti fiscali e i blocchi circoscritti descritti. Repository invariato e pulito. Nessuna implementazione avviata.

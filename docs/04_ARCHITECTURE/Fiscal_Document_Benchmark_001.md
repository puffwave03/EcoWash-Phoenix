# FISCAL-DOCUMENT-BENCHMARK-001

## Closeout approvato — 04/11/2026

**Stato: COMPLETE — CTO REVIEW PASS.** Baseline analizzata: `e40c33d7f3cf8ffc1c57f6b79a0890e9f45ac2eb`. Modalità del benchmark: **READ ONLY**. Test: nessun nuovo test eseguito. Database: nessuna operazione. Implementazione: nessuna.

Il Product Owner ha autorizzato il closeout documentale, commit e push dei soli tre documenti previsti. Il rapporto integrale sotto conserva il suo stato di proposta al momento della consegna; questa intestazione registra la successiva approvazione CTO e le decisioni PO, senza trasformarle in funzionalità implementate o certificazioni fiscali. I riferimenti locali sono resi relativi al repository, con le righe di evidenza indicate come frammenti `#L`.

### Direzione architetturale approvata

- Orders/EW: servizi, ordini e lavorazioni.
- POS/Payments: incassi, anticipi, saldi e rimborsi.
- Billing: documentazione fiscale, numerazioni, IGIC e tracciabilità.

Emissione fiscale, registrazione del pagamento e stampa cartacea restano distinte. **La REC non è necessaria come passaggio obbligatorio del futuro flusso ordinario. Le REC storiche devono rimanere integralmente conservate.** È una direzione architetturale approvata, non una modifica già implementata e non una certificazione fiscale.

### Requisiti Product Owner aggiuntivi

Base funzionale approvata, non specifiche tecniche già validate; decisioni PO emerse dal confronto con il gestionale attuale, non nuove verifiche del codice:

1. Un formato di ticket termico uniforme, normalmente in duplice copia.
2. Contenuti e tipologia documentale coerenti con l'operazione effettuata.
3. Preservazione delle note destinate al cliente.
4. Distinzione dalle note interne riservate.
5. Ticket con servizi, prezzi, data prevista, totale, pagato e residuo.
6. Clienti occasionali gestiti fiscalmente anche senza richiesta di fattura nominativa.
7. Stati FATTURATO e PAGATO indipendenti.
8. Fatturazione mensile per clienti professionali.
9. Nessun doppio incasso, doppia fattura o doppia imposizione.
10. Stampa fiscale termica alimentata dai dati Billing realmente emessi.

### Punti ancora aperti

- Classificazione fiscale degli anticipi.
- Emissione semplificata dopo un pagamento già registrato.
- Fatturazione finale con credito aperto.
- Riconciliazione di anticipi e saldo.
- Pagamenti misti e rimborsi.
- Fattura ordinaria successiva alla semplificata.
- Fatturazione mensile senza duplicazioni.
- Requisiti IGIC ancora da validare.
- Stampa termica fiscale Billing.
- Analisi delle dipendenze REC.

Nessuno di questi punti è dichiarato risolto dal closeout.

### Prossima missione

**`COUNTER-OPERATIONS-GAP-REVIEW-001` — PLANNED / NOT STARTED.** Scopo previsto: confronto READ ONLY fra requisiti funzionali, evidenze del gestionale attuale, benchmark e codice Phoenix. Non avviata; nessuna implementazione autorizzata.

Riferimenti canonici: [Session Handover](../00_START_HERE/SESSION_HANDOVER.md), [Project Status](../06_ROADMAP/Project_Status.md). I risultati storici di test, UAT e deployment delle missioni precedenti conservano il loro perimetro e non costituiscono nuove evidenze del benchmark.

---

## Rapporto tecnico integrale consegnato per CTO review

**FISCAL-DOCUMENT-BENCHMARK-001 — READY_FOR_CTO_APPROVAL**

La proposta tecnica è **escludere REC come passaggio obbligatorio del futuro flusso ordinario**, preservandone integralmente lo storico. Il modello più semplice mantiene tre responsabilità distinte:

- **Ordini/EW:** documentare il servizio e la consegna.
- **Pagamenti/POS:** registrare incassi, rimborsi e credito residuo.
- **Billing:** emettere e conservare i documenti fiscali, stampabili nei formati necessari.

La stampa termica può essere una rappresentazione della fattura Billing: non richiede una seconda emissione REC. Questa è una **proposta per decisione CTO**, non una modifica approvata né una conclusione di conformità fiscale.

**Perimetro ed evidenze**

Phoenix verificato su `main`, con `HEAD` e `origin/main` coincidenti con:

`e40c33d7f3cf8ffc1c57f6b79a0890e9f45ac2eb`

Index e worktree puliti. Nessun file modificato, nessun test rieseguito, nessuna operazione sul database, commit, push o deploy.

Il codice pubblico esaminato è riferito a:

| Progetto | Revisione esaminata | Limite dell’evidenza |
|---|---|---|
| FacturaScripts | `a2680d4129ab1005dd8a04383ebc963b04abf532` | Analisi statica del core; alcune funzioni POS/anticipi sono documentate come plugin |
| Dolibarr | `d4625b15ba538413b27fc8778acea9d45fa9a58e` | Analisi statica del ramo di sviluppo; nessuna installazione o prova operativa |
| Phoenix | `e40c33d7f3cf8ffc1c57f6b79a0890e9f45ac2eb` | Codice, migrazioni e documentazione esistenti; nessuna nuova UAT |

Le revisioni pubbliche non costituiscono una certificazione fiscale né dimostrano il comportamento di ogni configurazione o versione distribuita.

**1. Cosa insegnano realmente FacturaScripts e Dolibarr**

| Aspetto | FacturaScripts | Dolibarr | Indicazione per Phoenix |
|---|---|---|---|
| Documento operativo | Ordini e albaranes possono precedere la fattura | Ordini separati dalle fatture | EW deve restare distinto dal documento fiscale |
| Fattura e pagamento | `FacturaCliente` distinta da `ReciboCliente` e `PagoCliente` | `Facture` distinta da `Paiement`, con tabella di attribuzione | Emissione e incasso sono eventi indipendenti |
| Anticipi | Esistono plugin dedicati; non dimostrata un’unica soluzione universale nel core esaminato | Tipo fattura di anticipo esplicito, `TYPE_DEPOSIT` | L’anticipo fiscalmente documentato deve avere identità e collegamenti propri |
| Ticket POS | La documentazione descrive stampe di diversi documenti, non esclusivamente fatture | La stampa TakePOS esaminata carica una `Facture` | Il formato ticket non determina la natura fiscale |
| Raggruppamento | Trasformazione di documenti e quantità residue | Collegamenti ordini/fatture presenti; raggruppamento mensile non verificato completamente | Aggregare prestazioni ancora fatturabili, senza sommare documenti già emessi |
| Ricevuta separata | “Recibo” ha significato finanziario, diverso da REC Phoenix | Nei percorsi esaminati non emerge un passaggio equivalente obbligatorio a REC | Nessuna evidenza di necessità architetturale di REC |

In FacturaScripts, `FacturaCliente::getReceipts()` collega le scadenze alla fattura; `ReciboCliente::getPayments()` collega i pagamenti alla scadenza. **Il suo “recibo” non equivale alla ricevuta operativa Phoenix.** Inoltre, `PagoCliente::saveInsert()` può generare una registrazione contabile: è una responsabilità finanziaria che REC Phoenix esplicitamente non possiede.
Riferimenti: [FacturaCliente.php](https://github.com/NeoRazorX/facturascripts/blob/a2680d4129ab1005dd8a04383ebc963b04abf532/Core/Model/FacturaCliente.php#L109), [ReciboCliente.php](https://github.com/NeoRazorX/facturascripts/blob/a2680d4129ab1005dd8a04383ebc963b04abf532/Core/Model/ReciboCliente.php#L143), [PagoCliente.php](https://github.com/NeoRazorX/facturascripts/blob/a2680d4129ab1005dd8a04383ebc963b04abf532/Core/Model/PagoCliente.php#L139).

In Dolibarr, `Facture::validate()` assegna riferimento e stato validato; `Paiement::create()` registra separatamente le attribuzioni in `paiement_facture`. La presenza della fattura non implica quindi l’incasso.
Riferimenti: [Facture::validate](https://github.com/Dolibarr/dolibarr/blob/d4625b15ba538413b27fc8778acea9d45fa9a58e/htdocs/compta/facture/class/facture.class.php#L3685), [Paiement::create](https://github.com/Dolibarr/dolibarr/blob/d4625b15ba538413b27fc8778acea9d45fa9a58e/htdocs/compta/paiement/class/paiement.class.php#L309).

**2. Phoenix AS-IS: quattro oggetti con responsabilità diverse**

| Oggetto | Comportamento verificato | Limite |
|---|---|---|
| **Ticket EW** | Stampa dati dell’ordine, servizi e stato pagamento; accompagna il lavoro | Legge dati correnti; non è uno snapshot fiscale né una quietanza completa |
| **REC** | Documento operativo persistente, numerazione propria, snapshot, annullamento storico, ristampa | Esplicitamente non fiscale; non determina incassi o Accounting |
| **Billing** | Fatture, numerazioni, snapshot fiscali, collegamenti agli ordini; percorsi ordinario, semplificato, anticipo e finale | I percorsi semplificati hanno vincoli che non coprono tutti gli scenari operativi |
| **POS** | Registra pagamenti e rimborsi finanziari | Registrare il pagamento non emette automaticamente una fattura |

Riferimenti Phoenix:

- [OrderPrintDocument.tsx](../../src/components/printing/OrderPrintDocument.tsx#L84), funzione `Ticket`.
- [Migrazione REC](../../supabase/migrations/20260908000100_accounting_sales_documents_001.sql#L140), `issue_operational_receipt`.
- [Confine pagamento POS](../../supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql#L2), `record_pos_payment`.
- [Query Billing](../../src/features/billing/server/queries.ts#L171), derivazione dello stato finanziario.

Un dettaglio rilevante: il percorso `/print/receipt?document=fiscal` indirizza già verso Billing. **Non dimostra però l’esistenza di un layout termico Billing completo:** il componente attuale usa la stampa Billing, con stile A4. Il percorso senza parametro fiscale può invece chiamare l’emissione REC; non è una semplice lettura.

Riferimenti: [route ricevuta](<../../src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx#L9>), [order-entry.ts](../../src/features/billing/server/order-entry.ts), [BillingInvoiceView.tsx](../../src/components/billing/BillingInvoiceView.tsx#L52), [stili di stampa](../../src/styles/globals.css#L69).

**3. Confronto dei sette scenari**

| Scenario | Benchmark verificato | Phoenix attuale | Contratto proposto |
|---|---|---|---|
| **Accettazione senza pagamento** | Entrambi distinguono documento operativo e fattura | Ordine/EW e pagamento differito disponibili | EW documenta la presa in carico. Nessuna REC obbligatoria; emissione fiscale secondo evento e termine applicabile |
| **Pagamento integrale anticipato** | Dolibarr dispone di fattura di anticipo. FacturaScripts documenta plugin dedicati | Percorso specifico per un pagamento integrale, con condizioni restrittive | Un incasso reale, sua attribuzione e documento fiscale pertinente; evitare un secondo documento fiscale senza necessità |
| **Anticipo parziale e saldo** | Dolibarr collega fattura di anticipo e successivo utilizzo; FacturaScripts demanda parte del flusso ai plugin | Anticipo e finale disponibili, ma il finale richiede riconciliazione esatta e un pagamento saldo attribuibile | Documentare gli eventi fiscali necessari, richiamando gli anticipi senza duplicare imponibile e imposta |
| **Pagamento completo al ritiro** | La separazione fattura/pagamento è presente nei due sistemi | Il pagamento già registrato può bloccare l’emissione semplificata del servizio e indirizzare al percorso anticipo | Classificare il pagamento rispetto al servizio; “pagamento presente” non deve significare automaticamente “anticipo” |
| **Ritiro con credito aperto** | Dolibarr mantiene distinta fattura validata e pagamento; FacturaScripts ha scadenze | Handoff non pagato consentito con conferma; fattura ordinaria emettibile senza incasso. Finale dopo anticipi più restrittivo | Consegna, stato fiscale e credito devono restare indipendenti |
| **Mensile multiordine** | FacturaScripts verifica quantità residue e consente raggruppamento; Dolibarr: verifica incompleta del flusso mensile | Bozza ordinaria multiordine già disponibile, massimo 50 ordini compatibili | Ticket inclusi fiscalmente fatturati, finanziariamente aperti fino all’incasso; esclusione dalle successive selezioni |
| **Ristampa e prova pagamento** | TakePOS stampa una fattura; FacturaScripts documenta stampe ticket di più tipi di documento | REC ristampa snapshot; Billing stampa il documento; POS conserva i movimenti | Ristampa senza nuova emissione; eventuale attestazione d’incasso ricavata dai pagamenti, senza duplicare la fonte finanziaria |

Per gli anticipi FacturaScripts, l’evidenza è **documentale**, non una verifica del codice dei plugin: [Anticipos](https://facturascripts.com/plugins/anticipos). Per Dolibarr sono verificati [`createDepositFromOrigin`](https://github.com/Dolibarr/dolibarr/blob/d4625b15ba538413b27fc8778acea9d45fa9a58e/htdocs/compta/facture/class/facture.class.php#L1782) e il trattamento dell’anticipo pagato in [`Paiement::create`](https://github.com/Dolibarr/dolibarr/blob/d4625b15ba538413b27fc8778acea9d45fa9a58e/htdocs/compta/paiement/class/paiement.class.php#L542).

Il modello Dolibarr usa anche oggetti denominati “discount” per riportare anticipi su altre fatture. **Non va copiato traducendoli automaticamente in sconti commerciali Phoenix:** significato economico e trattamento fiscale devono essere definiti esplicitamente.

**4. Decisione centrale: REC serve davvero nel flusso ordinario futuro?**

**Non emerge una necessità architetturale di emettere REC per ogni ordine o pagamento.**

EW copre il documento operativo; Billing deve coprire la documentazione fiscale; POS conserva i fatti finanziari. Una REC obbligatoria aggiungerebbe un ulteriore numero e uno snapshot che può divergere dagli incassi successivi, senza risolvere i blocchi fiscali.

La proposta è:

- togliere REC dalla sequenza ordinaria obbligatoria futura;
- conservarla come documento storico e, se il PO individua un’utilità concreta, come funzione operativa opzionale;
- preservare numeri, snapshot, annullamenti, storico e ristampa;
- non convertire retroattivamente REC in fatture;
- mantenere i controlli esistenti che proteggono documenti e fatti storici.

**Non basta nascondere un pulsante:** una futura implementazione dovrà censire i punti che emettono REC, compresa la route di stampa, e verificare i vincoli che fanno riferimento agli snapshot storici.

Questa conclusione riguarda l’architettura. Eventuali obblighi settoriali di consegna di una ricevuta di presa in carico o attestazione d’incasso devono essere verificati separatamente: potrebbero essere soddisfatti da EW o da un’altra rappresentazione dei dati canonici, senza rendere REC una seconda fonte fiscale.

**5. Clienti occasionali senza richiesta di fattura nominativa**

La proposta è utilizzare **una fattura semplificata Billing, nei casi consentiti**, con eventuale stampa termica dello stesso documento.

Il flusso concettuale sarebbe:

1. **EW:** identifica servizio, capi e ritiro.
2. **POS:** registra l’incasso effettivo.
3. **Billing:** emette la fattura appropriata, con trattamento IGIC e dati richiesti.
4. **Stampa/consegna:** rappresenta il documento già emesso; ristamparlo non crea una nuova fattura.

“Non richiede fattura nominativa” non equivale a “non occorre documentazione fiscale”. Il nome attribuito alla stampa — ticket, ricevuta o scontrino — non basta a stabilirne la natura.

Il benchmark sostiene la separazione tra documento e formato:

- TakePOS carica una `Facture` mediante `facid` nel percorso di stampa: [receipt.php](https://github.com/Dolibarr/dolibarr/blob/d4625b15ba538413b27fc8778acea9d45fa9a58e/htdocs/takepos/receipt.php#L107).
- Il plugin Tickets di FacturaScripts dichiara di stampare fatture, albaranes, ordini e ricevute. È quindi un formato riutilizzabile, non una categoria fiscale unica. Questa evidenza proviene dalla [documentazione del plugin](https://facturascripts.com/plugins/tickets), che indica inoltre licenza EULA: non si può presumere liberamente riutilizzabile perché collegato a un core open source.

In Phoenix manca soprattutto **la correttezza del percorso di emissione nei diversi momenti del servizio**, oltre al layout termico Billing. Sostituire graficamente REC con una fattura non risolverebbe questo problema.

**6. Come evitare ridondanza tra anticipo e saldo**

La regola proposta è: **emettere i documenti richiesti dagli eventi fiscali, senza aggiungere REC obbligatorie a ogni passaggio.**

| Evento | Fatto finanziario | Documento fiscale proposto |
|---|---|---|
| Anticipo effettivamente incassato | Pagamento registrato una sola volta | Documento di anticipo, quando richiesto |
| Servizio concluso con saldo incassato | Pagamento del residuo | Documento conclusivo con riferimenti e riconciliazione degli anticipi |
| Servizio concluso con saldo ancora dovuto | Nessun incasso inventato | Documento conclusivo quando dovuto, con credito aperto |
| Servizio già interamente documentato in anticipo | Nessun nuovo incasso | Necessità e forma dell’eventuale documento conclusivo da validare |
| Ristampa | Nessun movimento | Nessuna nuova emissione |

**Non si può promettere sempre “una sola fattura per ordine”:** anticipi distinti possono richiedere documenti fiscali distinti. La ridondanza da eliminare è quella priva di funzione, non la documentazione richiesta.

I limiti Phoenix verificati sono concreti:

- `issue_billing_advance_invoice` ha un ramo specifico per il pagamento integrale; più anticipi che raggiungono il 100% non equivalgono automaticamente a quel ramo.
- `issue_billing_final_after_advances` richiede un saldo POS confermato, non attribuito, e riconciliazione esatta.
- Questo saldo può essere **già registrato**: la RPC non impone necessariamente un nuovo incasso al momento dell’emissione. Tuttavia, non copre un finale con credito ancora aperto.
- Il percorso semplificato del servizio blocca la presenza di pagamenti non annullati con `billing_advance_workflow_required`; tale condizione non distingue adeguatamente tutti i momenti operativi.

Riferimenti: [anticipo e prepagamento integrale](../../supabase/migrations/20261028163423_billing_full_prepayment_001.sql#L60), [finale dopo anticipi](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql#L537), [blocco emissione del servizio](../../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql#L150).

**7. Duplicazioni e fatturazione mensile**

FacturaScripts offre un precedente utile: `DocumentStitcher::validateSelectedQuantities()` verifica le quantità ancora disponibili; `BusinessDocumentGenerator::cloneLines()` aggiorna `servido` e registra la relazione fra righe origine e destinazione. È una tracciabilità della trasformazione, non una prova assoluta contro ogni duplicazione o concorrenza.
Riferimenti: [validazione quantità](https://github.com/NeoRazorX/facturascripts/blob/a2680d4129ab1005dd8a04383ebc963b04abf532/Core/Controller/DocumentStitcher.php#L573), [relazioni fra documenti](https://github.com/NeoRazorX/facturascripts/blob/a2680d4129ab1005dd8a04383ebc963b04abf532/Core/Lib/BusinessDocumentGenerator.php#L140).

Phoenix dispone già di:

- creazione ordinaria multiordine;
- verifiche di cliente e valuta;
- esclusione dei collegamenti attivi;
- vincolo sul collegamento finale attivo per ordine.

Riferimenti: [`create_billing_draft_internal`](../../supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql#L131), [selettore ordini fatturabili](../../supabase/migrations/20261007000100_billing_eligible_order_selector_001.sql).

Va mantenuto il contratto PO: **FATTURATO e DA PAGARE possono coesistere.** Un riepilogo mensile non deve rifatturare prestazioni già fiscalmente documentate. La gestione di annullamenti, rettifiche e successiva eleggibilità richiede una regola esplicita: l’esclusione dei collegamenti attivi non equivale a un divieto storico perpetuo.

**8. Validazioni IGIC necessarie**

Il regolamento spagnolo contiene una disciplina specifica di adattamento all’IGIC; non è sufficiente copiare configurazioni IVA o comportamenti di un gestionale internazionale. Riferimento: [RD 1619/2012, disposizione aggiuntiva seconda](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696#dasegunda).

Da sottoporre al consulente:

- ammissibilità, limiti e contenuto della semplificata per i servizi effettivi della lavanderia;
- dati del destinatario necessari nei diversi casi;
- momento fiscale del servizio e degli anticipi, distinto da accettazione, completamento e ritiro;
- modalità di riconciliazione degli anticipi nella fattura conclusiva, compreso il prepagamento al 100%;
- emissione con credito aperto e fatturazione riepilogativa mensile;
- rettifiche per rimborsi, annullamenti e variazioni del servizio;
- aliquote, esenzioni e arrotondamenti applicabili: l’attuale percorso limitato al 7% non è una regola generale;
- consegna, conservazione, stampa termica e obblighi informatici applicabili, inclusi ambito e calendario delle prescrizioni pertinenti.

Riferimenti normativi per l’istruttoria: [regolamento di fatturazione, articoli 4, 7, 11, 13 e 15](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).

**Conclusione proposta al CTO**

Approvare come direzione, previa validazione fiscale:

**EW operativo + pagamenti canonici + Billing fiscale; REC fuori dal percorso obbligatorio, storico integralmente preservato.**

I vantaggi sono meno documenti ridondanti, una sola numerazione fiscale canonica e minore confusione tra incasso ed emissione. Il limite principale è che questa semplificazione **non corregge da sola** classificazione degli anticipi, finale a credito, rimborsi e percorso semplificato.

L’accettazione di una futura implementazione dovrà dimostrare: nessun doppio incasso o doppia documentazione fiscale, ristampa senza nuova emissione, conservazione delle REC storiche, indipendenza tra fatturazione e pagamento, esclusione degli ordini già fatturati e isolamento tenant.

**Rapporto concluso in READ ONLY. Nessuna implementazione avviata; nessuna modifica da committare.**

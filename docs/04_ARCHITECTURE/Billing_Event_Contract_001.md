# BILLING-EVENT-CONTRACT-001

## PO operational clarification — BILLING-D02-OPERATIONAL-CONTRACT-001 (05/11/2026)

**OPERATIONAL RULE CONFIRMED BY PO.** Documentation-only clarification at repository baseline `76f49cf7ce8b222f4baeb56838e019c78d42c1e0`; no application, SQL or database implementation follows from this entry.

- The laundry service is finished when staff actually complete the work: `SERVICE_PERFORMED` describes that operational fact, not merely when an application action is recorded.
- The order is operationally closed when the goods are collected by or delivered to the customer: `SERVICE_DELIVERED` is distinct from production completion. This clarification does not add a new persisted order status.
- `PAYMENT_RECEIVED` is independent of both events. Payment may be full, partial, in advance or subsequent; service completion or delivery does not imply settlement.
- An order can therefore be finished and still awaiting collection, independently of its economic state. Preserve the implemented production/fulfillment/custody separation.
- Record each collection once. Documenting or printing it must not duplicate the financial movement or fiscal coverage of the same operation.

This operational clarification does **not** certify the fiscal tax point or automatically approve D01–D04. Conditions C1–C4 and the complete D01–D11 register below retain their actual states. In particular, actual execution, its registration timestamp and the fiscal interpretation must remain distinct. The reliability of a specific completion/payment chronology, treatment of late or contradictory records and verifiable retention of S06 evidence still require the technical contract and applicable fiscal validation. No historical reclassification or fiscal implementation is authorized by this entry.

## Documentation closeout — 04/11/2026

**COMPLETE — TECHNICAL CTO REVIEW PASS.** Baseline analyzed: `b53ec2e44dc41bfa7ddc456aa8d1711a2fdc55fa`. Execution: READ ONLY. Implementation: NONE. New testing/UAT: NONE. Database changes: NONE. **Fiscal compliance approval: NOT GRANTED.** PO authorization covers only this documentation closeout, commit and push.

The complete session report below preserves the proposed contract, all fifteen scenarios, decision states, evidence limitations and future boundaries. Its READY_FOR_CTO_REVIEW label and clean-repository statements describe the original READ ONLY delivery; this header records the subsequent technical review. Local links are normalized to repository-relative paths and `#L` line references. No fiscal conclusion is promoted to APPROVED by publication.

### CTO review conditions

- **C1 — Service timing evidence:** a payment must not be classified automatically as an advance merely because it exists. Reliable evidence must establish actual service execution relative to payment; same-day events cannot be classified by date alone.
- **C2 — Advance and final reconciliation:** distinguish total commercial value, received payments, previously documented fiscal amounts, remaining fiscal coverage and outstanding customer credit. The final fiscal representation must be approved before implementation.
- **C3 — Unified thermal format and copies:** the operational objective is normally one customer copy and one merchant copy based on the same appropriate document. Multiple copies must not produce multiple fiscal emissions or be treated as independent originals.
- **C4 — Simplified-to-ordinary invoicing:** distinguish canje, correction and rectification. Do not generalize SII F3 to tenants without validating applicability.

### Open decisions and continuation

D01–D11 below retain their actual states. Service tax point and evidence; advances and full prepayments; final invoices with outstanding credit; multiple settlement payments; simplified-to-ordinary relationships; refunds and corrections; professional monthly billing; IGIC rates/exceptions; statutory fiscal records and digital compliance remain open. Official references support the bounded rules stated in the report, not a certification of Phoenix or of the pilot tenant.

**`BILLING-SERVICE-PAYMENT-CLASSIFICATION-001` — PLANNED / NOT STARTED.** Implementation is blocked until the required fiscal and evidence-contract decisions are approved. **`COUNTER-NOTES-VISIBILITY-001`** remains an independently proposed correction requiring separate authorization, **NOT STARTED**. Neither is launched by this closeout.

This checkpoint supersedes only earlier not-started statements about the event-contract analysis. Preserve the [benchmark](Fiscal_Document_Benchmark_001.md), [gap review](Counter_Operations_Gap_Review_001.md), and their historical evidence. Canonical continuation: [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md).

---

## Complete technical report delivered for CTO review

# BILLING-EVENT-CONTRACT-001 — READY_FOR_CTO_REVIEW

## A — Executive Summary

**Phoenix deve decidere quale documento emettere in base all’operazione realmente avvenuta, mantenendo separati prestazione, consegna, incasso ed emissione.**

Il blocco attuale nasce da una protezione troppo generale: nella semplificata del servizio, qualsiasi pagamento non annullato indirizza al percorso anticipo. Il finale dopo anticipi, invece, è costruito per una riconciliazione specifica: anticipi documentati più un solo pagamento saldo, con totale interamente incassato.

Queste condizioni proteggono i casi già implementati, ma non rappresentano tutti i workflow PO. La correzione non consiste nel rimuoverle indiscriminatamente: serve distinguere gli eventi e ampliare soltanto i casi approvati.

**Pre-flight verificato**

- Branch: `main`.
- HEAD = `origin/main` = `b53ec2e44dc41bfa7ddc456aa8d1711a2fdc55fa`.
- Index e worktree puliti, anche al termine.
- Riutilizzati integralmente benchmark e gap review già approvati.
- Nessuna modifica, nuovo test/UAT, operazione database, commit, push o deploy.

Le risultanze sul software sono **analisi statica**. Il contratto seguente è una proposta per CTO, PO e consulente IGIC; non introduce regole fiscali approvate automaticamente.

### Evidenze normative ufficiali

**N1 — IGIC, non IVA peninsulare.** La Ley 20/1991, art. 18, collega ordinariamente il devengo dei servizi alla loro esecuzione; per anticipi precedenti al fatto imponibile considera gli importi effettivamente incassati. Prevede inoltre regole specifiche per operazioni continuative. Identificare quale evento concreto rappresenti la prestazione della lavanderia resta da validare, senza equipararlo automaticamente al ritiro. [BOE, Ley 20/1991, art. 18](https://www.boe.es/buscar/act.php?id=BOE-A-1991-14463#a18).

**N2 — Fatturazione.** Il RD 1619/2012:

- adatta espressamente la disciplina all’IGIC, ferme le specificità canarie;
- include tintoria e lavanderia fra le operazioni ammesse alla semplificata entro 3.000 euro, imposta inclusa, alle condizioni applicabili;
- distingue termini d’emissione, riepilogative mensili, duplicati e rettifiche;
- distingue il canje di una semplificata conforme dalla fattura rettificativa.

La riepilogativa riguarda operazioni dello stesso mese per lo stesso destinatario; per destinatari professionali il termine indicato è prima del giorno 16 del mese successivo. [BOE, artt. 4, 7, 11, 13–15 e disposizione aggiuntiva seconda](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).

**N3 — Conferma canaria sulla non duplicazione.** La FAQ ATC SII 2.26 descrive la sostituzione di semplificate già fatturate e dichiarate mediante tipo F3, con trattamento volto a evitare duplicazione dell’IGIC. È un precedente ufficiale pertinente, **non un’autorizzazione a implementare SII né prova che il tenant vi sia soggetto**. [ATC, FAQ SII, §2.26](https://www3.gobiernodecanarias.org/tributos/atc/documents/65729/240181/Preguntas_frecuentes_SII.pdf/3003e808-6205-ccd8-fb5d-0947afa204de?t=1763547203276).

Non sono utilizzati FacturaScripts, Dolibarr o il precedente TPV come prove di conformità.

## B — Fiscal Event Contract Matrix

### Eventi e dati già disponibili

I nomi seguenti sono concettuali: **non si propone qui la creazione di nuove tabelle o stati**.

| Evento | Fonte Phoenix esistente | Sufficienza e limite |
|---|---|---|
| `SERVICE_ACCEPTED` | `orders.received_at`, stato e `order_status_history` | Evidenza della presa in carico registrata; `created_at` da solo non prova l’accettazione fisica. |
| `PAYMENT_RECEIVED` | Pagamento confermato, `paid_at`, importo, metodo/canale, sessione POS | Fonte finanziaria canonica. Data d’incasso e momento della registrazione non vanno confusi. |
| `SERVICE_PERFORMED` | `orders.completed_at`, storico produzione; `invoices.service_performed_on` con dichiarazione | Esistono dati operativi e dichiarazione fiscale. Non è ancora definita una corrispondenza fiscale universale fra essi. |
| `SERVICE_DELIVERED` | `order_customer_handoffs.completed_at` oppure completamento delivery | Separato dalla produzione; non usare il completamento di un pickup come consegna finale al cliente. |
| `FISCAL_DOCUMENT_ISSUED` | `document_status`, `issued_at`, `issue_date`, numero e snapshot Billing | Evidenza di emissione nell’applicazione; non prova autonoma di trasmissione a un provider fiscale. |
| `PAYMENT_ALLOCATED` | `payments.order_id`; per anticipi/finali, `billing_invoice_payment_links` | Attribuzione all’ordine già presente. Attribuzione fiscale esplicita disponibile entro i vincoli attuali. |
| `INVOICE_REPLACED_OR_RECTIFIED` | Storico fatture e collegamenti ordine esistenti | Non dimostrato un modello completo per canje/rettifica. `cancelled` non equivale a una rettifica fiscalmente valida. |

**Conclusione sui timestamp:** non manca ogni informazione temporale. Manca soprattutto un contratto approvato sull’affidabilità e sul significato fiscale dei dati. `service_performed_on` è una **data**, mentre `service_declared_at` indica quando è stata resa la dichiarazione: nessuno dei due identifica automaticamente l’ora reale della prestazione.

### Convenzioni della matrice

- `a`: data/ora di accettazione; `s`: momento effettivo della prestazione; `d`: consegna.
- `p₁…pₙ`: date/ore degli incassi confermati; `i`: emissione.
- `T`: totale commerciale valido; `P`: incassato netto dei rimborsi; `R = max(T − P, 0)` nel caso ordinario.
- `A`: totale degli anticipi **fiscalmente documentati**, distinto da `P`.
- `F-servizio`, `F-anticipo`, `F-finale`, `F-mensile`: ruoli concettuali del documento, non nuovi tipi SQL.
- Date e importi sono simbolici: nessun dato reale è stato ricostruito o modificato.
- Nei casi di rettifica, `T` deve prima essere determinato dalla revisione commerciale autorizzata; eventuale credito del cliente non va nascosto dal semplice `max`.

### B1 — Sequenza commerciale e finanziaria

| ID | Evento e cronologia da conservare | Stato servizio/consegna | Totale, pagato, residuo |
|---|---|---|---|
| **S01** | Accettazione `a`, prestazione `s`, incasso al ritiro `p₁≈d`; normalmente `a<s≤d` | Ricevuto → eseguito → consegnato | All’accettazione `T/0/T`; dopo incasso `T/T/0` |
| **S02** | Incasso completo all’accettazione: `p₁≈a<s`; consegna successiva `d` | Non eseguito al pagamento; poi eseguito/consegnato | `T/T/0` già prima del servizio |
| **S03** | `a≈p₁<s≤p₂≈d`; primo incasso parziale | In lavorazione dopo anticipo, poi consegnato | Prima `T/P₁/T−P₁`; dopo saldo `T/T/0` |
| **S04** | `a≤p₁<p₂…<s`; saldo `pₙ` successivo alla prestazione | Più incassi prima del servizio, consegna distinta | Residuo diminuisce per ogni incasso, fino a zero |
| **S05** | Più incassi prima di `s`, con somma pari a `T`; nessun nuovo pagamento a `d` | Interamente pagato prima dell’esecuzione | `T/T/0`; non creare saldo artificiale |
| **S06** | Servizio già effettuato a `s`; unico incasso `p₁≈d`, con `s≤p₁` | Eseguito, poi consegnato | `T/0/T` → `T/T/0` |
| **S07** | Anticipo `p₁<s`; saldo in due movimenti cash/card `p₂,p₃≈d` | Eseguito e poi consegnato | `P₁+P₂+P₃=T`; tre fatti finanziari distinti |
| **S08** | Prestazione `s`, consegna `d`, incasso assente o incompleto; `a≤s≤d` | Consegnato con credito aperto | `T/P/R`, con `R>0`; può esistere anticipo precedente |
| **S09** | Più ordini con `aⱼ,sⱼ,dⱼ`; emissione mensile `i`; incasso non necessario | Stato di ogni servizio/consegna indipendente | `ΣTⱼ / ΣPⱼ / residuo`; caso tipico inizialmente non pagato |
| **S10** | Dopo la mensile emessa a `i`, incasso `p>i`, eventualmente parziale | Nessuna nuova prestazione per il solo incasso | Totale invariato; `P` aumenta e `R` diminuisce |
| **S11** | Prestazione e semplificata pregresse; richiesta nominativa successiva | Stato operativo invariato | Incassi e credito invariati per il solo cambio documentale |
| **S12** | Dopo emissione `i`, evento commerciale rettificativo e/o rimborso `r` | Dipende da annullamento, reso o riduzione concordata | Ricalcolare separatamente valore commerciale corretto e incasso netto |
| **S13** | Cliente occasionale; tempi `a,s,p,d` secondo S01–S08 | Nessuna differenza operativa per assenza di richiesta nominativa | Stesse formule degli altri clienti |
| **S14** | Richiesta stampa `q>i`; nessun nuovo servizio/incasso | Invariato | Invariati; distinguere saldo storico e saldo corrente |
| **S15** | Anticipo/documento pregresso; variazione concordata a `v`; prestazione originaria o modificata da identificare | Non assumere che variazione e prestazione coincidano | Da `T` a `T′`; pagamenti reali invariati salvo rimborso separato |

### B2 — Contratto documentale proposto e differenze Phoenix

La colonna “contratto” è **TO-BE proposto**, soggetto alle decisioni della sezione D.

| ID | Evento fiscale/documento e riferimenti | Stato fattura e finanziario; stampa al banco | Phoenix attuale e differenza |
|---|---|---|---|
| **S01** | Verificare evento del servizio a `s`, senza attendere automaticamente `d`; F-servizio se dovuta e non già emessa | Emessa anche prima dell’incasso; poi pagata. EW all’accettazione, documento Billing al momento pertinente | Incasso prima dell’emissione diretta semplificata attiva il blocco anticipo. Separare classificazione e ordine dei clic |
| **S02** | Incasso precedente al servizio: candidato F-anticipo integrale, N1; trattamento conclusivo da validare | Anticipo emesso e pagato; EW più stampa Billing. Al ritiro nessuna nuova riscossione | Ramo integrale singolo esiste. Non generalizzarlo a composizioni diverse |
| **S03** | Anticipo documentato; F-finale riferita al precedente, senza duplicare `A` | Finale con saldo proprio; EW, stampa anticipo e poi finale | Percorso esistente entro vincoli C2; riusarlo |
| **S04** | Ogni incasso pre-servizio da classificare; documenti precedenti tutti richiamati dal finale | Più documenti possono essere necessari; non sono duplicati se coprono eventi distinti | Più anticipi ammessi entro condizioni; finale resta vincolato al saldo unico |
| **S05** | Copertura fiscale degli anticipi al 100%; necessità/forma del documento conclusivo da validare | Pagato; eventuale documento conclusivo non deve creare nuovo debito | Non coperto dal ramo generale come il pagamento integrale singolo |
| **S06** | Candidato F-servizio, oppure incasso di F-servizio già emessa; nessun anticipo desunto dal pagamento | Emessa/pagata; stampa o ristampa Billing appropriata | Blocco diretto confermato: pagamento presente → percorso anticipo |
| **S07** | Finale riferita agli anticipi; riconciliazione con insieme dei pagamenti saldo | Finale pagata da due movimenti reali; una sola emissione finale | Il contratto attuale richiede un saldo singolo; non fondere o ricreare pagamenti |
| **S08** | Documento del servizio/finale quando dovuto, anche con `R>0`; applicabilità N1 da validare | **Emessa e non pagata/parzialmente pagata**; stampa senza quietanza falsa | Ordinaria possibile; finale dopo anticipi senza saldo incassato bloccato |
| **S09** | Mensile per operazioni eleggibili; riferimenti agli EW/albaranes. Precedenti documenti fiscali richiedono percorso distinto | Emessa ≠ pagata; ticket operativi e fattura mensile | Multiordine esiste; mancano contratto completo di periodo e gestione dei già documentati |
| **S10** | Solo incasso/attribuzione, salvo altro evento autonomo | Fattura già emessa passa da aperta a parzialmente/saldata; attestazione incasso o vista aggiornata, non nuova fattura | Pagamenti sugli ordini collegati alimentano il residuo; incasso unico multiordine da definire |
| **S11** | Valutare canje di documento conforme, distinto da rettifica; identificare sempre l’originale nel modello Phoenix | Nuovo documento correlato, nessun nuovo incasso o imponibile economico duplicato | Percorso completo non dimostrato; non usare cancellazione e rifatturazione libera |
| **S12** | Valutare rettifica in funzione della causa; documento originario conservato | Rettifica e rimborso possono avere date diverse; stampa del documento realmente emesso | Rimborso finanziario esiste; correzione fiscale completa non implementata/dimostrata |
| **S13** | Semplificata nei casi consentiti; dati destinatario richiesti secondo il caso | Emessa, con pagamento indipendente; termico Billing e EW operativo se necessario | Identità occasionale esiste; rimangono i blocchi del relativo scenario temporale |
| **S14** | Nessun nuovo evento d’emissione; gestire eventuale duplicato secondo regole applicabili | Numero e snapshot invariati; ristampa identificata correttamente | REC/Billing riutilizzabili; stampa non deve invocare una nuova emissione |
| **S15** | Determinare effetto della variazione su anticipo e servizio; riferimenti a versione/documenti precedenti | Nessuna riscrittura del documento originario; eventuale rettifica e nuovo documento secondo contratto | Guardia economica blocca modifiche protette. Va mantenuta finché non esiste revisione controllata |

**Regola trasversale proposta:** se un evento è già documentato, la nuova azione deve mostrare il documento esistente o il percorso correlato appropriato, non offrire una seconda emissione indipendente.

## C — Phoenix AS-IS vs TO-BE

### 1. Classificare il pagamento rispetto alla prestazione

**AS-IS:** la semplificata del servizio controlla l’esistenza di qualunque pagamento `status <> 'void'` e solleva `billing_advance_workflow_required`. La UI seleziona inoltre il percorso anticipi in presenza di pagamenti.

**TO-BE proposto:** valutare, per ogni pagamento:

- operazione cui appartiene;
- momento effettivo dell’incasso;
- prestazione già effettuata o ancora da effettuare a quel momento;
- documenti e attribuzioni fiscali già esistenti;
- eventuali rimborsi o variazioni.

Un pagamento “al ritiro” non è classificabile fiscalmente soltanto dal pulsante usato. Se la prestazione era già effettuata, è un candidato pagamento del servizio; se la cronologia è incerta, occorre evidenza o dichiarazione controllata.

**Non basta confrontare due date giornaliere.** Incasso e prestazione possono avvenire nello stesso giorno in ordine diverso. Neppure l’assenza di una dichiarazione di anticipo prova che il pagamento non fosse anticipato.

Riferimenti: [guardia di emissione](../../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql#L144), [BillingInvoiceView](../../src/components/billing/BillingInvoiceView.tsx#L40).

### 2. Individuare la prestazione senza inventare un timestamp fiscale

Phoenix possiede:

- `received_at`, `completed_at`;
- storico append-only con `changed_at`, `changed_by`;
- dichiarazione `service_performed_on`, autore e momento della dichiarazione;
- dichiarazioni di anticipo con `service_not_performed_confirmed` e snapshot del pagamento.

Questi dati sono riutilizzabili. Tuttavia, lo storico registra un’azione applicativa; un operatore può registrare il completamento dopo l’esecuzione reale. Il campo fiscale giornaliero non risolve l’ordine intragiornaliero.

**Decisione necessaria:** quale attestazione identifica `s`, chi può renderla, come si trattano inserimenti tardivi, servizi parziali e dati contraddittori. Solo dopo si può stabilire se basti estendere una dichiarazione esistente o serva informazione aggiuntiva.

Riferimenti: [schema Orders e storico](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql#L181), [dichiarazione anticipi](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql#L233), [handoff](../../supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql#L4).

### 3. Finale con credito aperto

**AS-IS:** `issue_billing_final_after_advances` richiede:

- un pagamento saldo confermato POS, non attribuito;
- almeno un anticipo emesso;
- storia ammessa senza rimborsi;
- `payment_count = advance_count + 1`;
- `advance_gross + balance_payment.amount = final_draft.total`.

Il saldo può essere già registrato: la RPC non richiede necessariamente un nuovo incasso durante l’emissione. Richiede però che esista.

**TO-BE proposto:** il documento conclusivo deve rappresentare la quota fiscalmente ancora da documentare; l’ammontare incassato di tale quota è un’informazione separata. L’esigibilità del documento non deve dipendere dall’invenzione di un saldo pagato.

Il principio è coerente con N1, ma momento e forma del documento concreto richiedono validazione IGIC.

Riferimento: [RPC finale](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql#L537).

### 4. Più pagamenti e attribuzioni

La tabella `billing_invoice_payment_links` dispone già di:

- chiave `(organization_id, payment_id)`;
- importo attribuito;
- collegamento composto a ordine e documento;
- immutabilità;
- vincolo specifico di un pagamento per documento di anticipo.

**Più righe verso un finale sono strutturalmente rappresentabili**, ma la RPC attuale non le gestisce come saldo multiplo. Inoltre, i trigger richiedono attribuzione integrale del singolo pagamento e impediscono sovra-attribuzione.

Quindi:

- saldo cash+card: possibile candidata estensione della RPC, senza fondere movimenti;
- pagamento unico ripartito fra più documenti: non supportato dal contratto attuale della tabella;
- incasso mensile multiordine: non va risolto duplicando lo stesso importo su ciascun ordine.

Riferimento: [fondazione link e protezioni](../../supabase/migrations/20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql#L97).

### 5. Riconciliazione senza doppia imposizione

Proposta tecnica, per operazione invariata e senza rettifiche:

- **Incassato:** somma dei pagamenti confermati meno rimborsi.
- **Documentato:** importi fiscali già coperti da documenti pertinenti.
- **Da documentare:** quota residua dell’operazione, secondo il contratto fiscale.
- **Da incassare:** credito commerciale residuo.

`Da documentare` e `da incassare` possono essere diversi.

Esempio puramente illustrativo: servizio 100, anticipo documentato 30, nessun saldo ricevuto. Il finale può dover documentare 70 mentre il credito rimane 70. Se il saldo 70 viene poi incassato, non nasce per questo un secondo servizio da fatturare.

Phoenix conserva già `operation_*`, `documented_advance_*` e `operation_items_snapshot`. Sono basi utili, ma **non si deve sommare `operation_total` e fatture di anticipo come se fossero operazioni aggiuntive**.

Gli arrotondamenti di base e imposta devono riconciliare gli eventi effettivamente documentati; nessuna riscrittura retroattiva degli anticipi per far coincidere un nuovo calcolo globale.

Riferimenti: [riconciliazione C2](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql#L797), [mapping Billing](../../src/features/billing/server/queries.ts#L190).

### 6. Ordinaria, canje e mensile

La fattura ordinaria già separa emissione e pagamento. `derivePayment` distingue `unpaid`, `partially_paid` e `paid`; il totale incassato ordinario deriva dai pagamenti degli ordini collegati.

La creazione multiordine e l’esclusione dei collegamenti attivi esistono. Sono da mantenere.

Per S11 e S09 occorrono però tre percorsi distinti:

1. operazioni non ancora fiscalmente documentate;
2. operazioni con anticipi da riconciliare;
3. operazioni già documentate integralmente, eventualmente soggette a canje/rettifica.

**Proposta:** la mensile non deve trattare il terzo gruppo come nuove vendite. Un estratto conto può elencare documenti già emessi senza diventare una nuova fattura degli stessi servizi.

Riferimenti: [query finanziarie Billing](../../src/features/billing/server/queries.ts#L171), [bozza multiordine](../../supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql#L131), [selettore eleggibilità](../../supabase/migrations/20261007000100_billing_eligible_order_selector_001.sql).

### 7. Controlli indispensabili e restrizioni da riesaminare

| Da preservare | Da riesaminare soltanto dopo il contratto |
|---|---|
| Tenant server-derived, ruoli, entitlement, RLS | Blocco di ogni pagamento non `void` nel servizio |
| Pagamenti reali e attribuzioni non duplicate | Un solo pagamento saldo |
| Snapshot e storico immutabili | Necessità di saldo completamente incassato |
| Numerazione atomica e replay sul documento esistente | Più anticipi al 100% trattati diversamente dal singolo integrale |
| Lock e rivalidazione dopo acquisizione lock | Perimetro POS-only per le attribuzioni fiscali |
| Protezione di documenti già collegati | Gestione generica bloccante di storie rimborsate |
| Rifiuto di dati incoerenti o non autorizzati | Restrizioni di data, da confrontare con procedura tardiva approvata |

Non è stato dimostrato che ciascuna restrizione debba essere eliminata. Alcune devono rimanere per scenari esclusi dalla prima correzione.

### 8. Informazioni effettivamente mancanti o insufficienti

- **Insufficiente:** prova approvata della relazione temporale prestazione/incasso nello stesso giorno.
- **Insufficiente:** classificazione completa dei pagamenti del servizio, complementare alle dichiarazioni di anticipo.
- **Non dimostrato:** relazione fiscale completa di canje/rettifica con trattamento dei documenti sostituiti.
- **Non supportato dal contratto attuale:** ripartizione parziale di un pagamento fra più documenti.
- **Insufficiente:** competenza del servizio per ogni ordine nella selezione mensile, rispetto alla sola creazione ordine.
- **Da definire:** trattamento della revisione commerciale dopo anticipo e collegamento con eventuali rettifiche.

Non mancano invece identificativi ordine, pagamenti, importi, timestamp operativi, numeri fattura o un modello generale di credito: duplicarli sarebbe ingiustificato.

## D — Decision Register

| ID | Decisione richiesta | Evidenza / rischio | Autorità | Stato |
|---|---|---|---|---|
| D01 | Definizione del momento fiscale della prestazione per i servizi EcoWash | N1; rischio di usare ritiro o click come surrogato | Consulente IGIC + CTO | **NEEDS_IGIC_VALIDATION** |
| D02 | Fonte, autore e granularità della dichiarazione di prestazione | Data giornaliera insufficiente in casi intragiornalieri | CTO, PO per operatività | **CTO_REVIEW_REQUIRED** |
| D03 | Procedura per dati tardivi, mancanti o contraddittori | Non inferire retroattivamente fatti non provati | CTO + consulente | **NEEDS_IGIC_VALIDATION** |
| D04 | Classificazione esplicita del pagamento già registrato | Blocco generalizzato attuale | CTO | **PROPOSED** |
| D05 | Finale a credito e trattamento degli anticipi al 100% | Vincoli RPC; S05/S08 | Consulente IGIC + CTO | **NEEDS_IGIC_VALIDATION** |
| D06 | Saldo multiplo e futura ripartizione di incassi | Cardinalità e trigger attuali | CTO | **CTO_REVIEW_REQUIRED** |
| D07 | Canje rispetto a rettifica e cancellazione | N2/N3; rischio di doppia imposizione | Consulente IGIC + CTO | **NEEDS_IGIC_VALIDATION** |
| D08 | Eleggibilità mensile e precedenti documenti | Motore multiordine esiste, contratto incompleto | Consulente + PO + CTO | **NEEDS_IGIC_VALIDATION** |
| D09 | Regole commerciali di modifica/rimborso dopo anticipo | Guardia economica e storico da preservare | PO, poi CTO/consulente | **PO_DECISION_REQUIRED** |
| D10 | Documento mostrato/stampato e distinzione copie | Una stampa non è una nuova emissione | PO + CTO | **PROPOSED** |
| D11 | Regime effettivo del tenant, aliquote, eccezioni e obblighi di registro | Il pilot software non prova la posizione fiscale | Consulente IGIC | **NEEDS_IGIC_VALIDATION** |

## E — Implementation Boundaries

**Componenti potenzialmente interessati, solo in future missioni autorizzate:**

- `src/components/billing/BillingInvoiceView.tsx`.
- `src/features/billing/server/actions.ts`.
- `src/features/billing/service-declaration.ts`.
- `src/features/billing/server/queries.ts`.
- Overload semplificato di `issue_billing_invoice`.
- `issue_billing_advance_invoice`.
- `issue_billing_final_after_advances`.
- Dichiarazioni fiscali e protezioni delle attribuzioni, soltanto se necessarie.
- Selettore multiordine e printing in missioni successive distinte.

**Fuori dal primo intervento:** rifacimento POS, migrazione storica, canje/rettifiche, mensile, nuovi adapter fiscali, nuova numerazione, generalizzazione internazionale.

**Invarianti:**

1. Emissione e stampa non creano un pagamento.
2. Incasso non prova automaticamente un anticipo.
3. Emissione non azzera il credito.
4. Ristampa non assegna un numero.
5. Nessun pagamento o snapshot storico viene riscritto per sbloccare il workflow.
6. Documento sostitutivo/rettificativo mantiene la relazione con l’originale.
7. Un retry restituisce il risultato esistente o un esito verificabile; non ripete alla cieca l’emissione.
8. Resta l’ordine dei lock già corretto e la rivalidazione dei dati.
9. REC storiche restano disponibili e protette.
10. Nessuna autorizzazione deriva dal solo `organization_id` del client.

Le protezioni di replay e lock sono verificabili nella [migrazione lock-order](../../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql#L38). L’anticipo integrale/parziale usa la [RPC corrente](../../supabase/migrations/20261028163423_billing_full_prepayment_001.sql#L60). Rimborsi e revisioni devono mantenere `record_pos_refund` e la guardia `20261029173145_order_financial_integrity_guard_001.sql`.

## F — Test & UAT Matrix

Nessun test viene eseguito in questa analisi.

| Area | Prova automatica proposta | UAT PO proposta | Criterio |
|---|---|---|---|
| Classificazione | Incasso prima/dopo prestazione, stesso giorno, cronologia incerta | Servizio già pronto pagato al ritiro; vero anticipo all’accettazione | Nessun falso anticipo e nessuna deduzione silenziosa nei casi incerti |
| Incasso | Confronto righe/importi prima e dopo emissione | Emettere usando pagamento già registrato | Zero nuovi movimenti finanziari |
| Credito aperto | Finale emesso con `R>0`, incasso successivo | Consegnare con debito e saldare in seguito | Emissione non marca pagato; saldo successivo non rifattura |
| Più pagamenti | Cash+card, più anticipi, tentata doppia attribuzione | S04/S05/S07 | Importi riconciliati, nessun movimento aggregato artificiale |
| Imposta | Anticipi e finale, centesimi e arrotondamenti | Confronto documenti su caso sintetico approvato | Nessun doppio conteggio; base/imposta spiegabili |
| Retry | Doppio click, timeout dopo commit, replay | Riapertura dopo esito incerto | Un solo documento e numero; recupero esito |
| Concorrenza | Pagamento/emissione, due emissioni, due attribuzioni | Due operatori su stesso ordine | Nessuna doppia allocazione o documento duplicato |
| Storico | Tentativi di modifica di fatture/REC/link emessi | Ristampa prima e dopo incasso successivo | Snapshot fiscale invariato, stato finanziario chiaramente distinto |
| Mensile | Ordini già collegati, anticipi, semplificate pregresse | Fatturare più ordini senza incasso | Nessuna rifatturazione indebita; credito conservato |
| Canje/rettifica | Originale conforme/non conforme, relazione documentale | S11/S12 dopo approvazione fiscale | Nessuna cancellazione impropria o doppia imposizione |
| Tenant e ruoli | UUID estranei, staff non abilitato, entitlement assente | Ruolo consentito e ruolo negato | Nessun accesso o emissione fuori perimetro |
| Variazione servizio | Modifica dopo anticipo, riduzione totale, rimborso dovuto | S15 | Nessuna riscrittura economica non tracciata |

Riutilizzare i test Billing/POS esistenti, soprattutto `billing-simplified-invoice-001f`, `billing-simplified-invoice-001g-c2-postgres`, `billing-full-prepayment-001`, `billing-deadlock-40p01-postgres` e quelli sulle attribuzioni. Nuove prove database richiederanno ambiente e fixture autorizzati; nessun test su dati fiscali reali.

## G — Recommended Next Mission

**Proposta: `BILLING-SERVICE-PAYMENT-CLASSIFICATION-001`**, limitata inizialmente al caso:

> Un ordine, servizio attestato come già effettuato al momento dell’incasso, pagamento confermato già registrato, nessun anticipo fiscalmente documentato, nessun rimborso o documento fiscale precedente incompatibile.

**Obiettivo minimo:** consentire il corretto percorso del servizio senza dichiarare un falso anticipo e senza registrare un altro pagamento.

**Perimetro proposto:**

- selezione UI coerente con la classificazione approvata;
- raccolta e validazione dell’evidenza strettamente necessaria;
- modifica circoscritta del controllo nella RPC del servizio;
- conservazione dei blocchi per storie ambigue, anticipi, rimborsi e documenti precedenti;
- gestione idempotente dell’esito e regressione del percorso anticipi esistente.

**Dipendenze ancora aperte:** D01–D04, in particolare significato della prestazione e prova della relazione temporale con l’incasso. Va inoltre deciso come conservare la classificazione in modo verificabile senza introdurre una seconda fonte di verità.

**Esclusioni:** finale a credito, saldo multiplo, anticipi al 100%, mensile, canje, rettifiche, termico e modifica dei documenti storici.

**Accettazione:** S06 completabile nel sottoinsieme approvato; S02/S03 restano correttamente nel percorso anticipo; casi incerti fermati con motivo comprensibile; nessuna variazione ai pagamenti; nessuna doppia emissione; test di concorrenza e tenant PASS.

**Risposta alla domanda finale:** Phoenix deve accompagnare l’operatore registrando una sola volta servizio e denaro, mostrando separatamente ciò che è consegnato, incassato e fiscalmente documentato. Billing deve scegliere il percorso dai fatti attestati e dallo storico, consentendo fatture con credito aperto e ristampe senza nuove emissioni. Le basi tecniche esistono; il significato fiscale degli eventi e le procedure di rettifica devono essere convalidati prima di cambiare le regole.

**READY_FOR_CTO_REVIEW — repository invariato; nessuna missione implementativa avviata.**

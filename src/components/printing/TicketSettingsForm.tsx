"use client";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { ticketText, type TicketSettings } from "@/features/printing/ticket-settings";

export function TicketSettingsForm({ locale, settings, action }: { locale: string; settings: (TicketSettings & { canEditSeries: boolean }) | null;
  action: (state: "idle" | "saved" | "error", form: FormData) => Promise<"idle" | "saved" | "error"> }) {
  const [state, formAction, pending] = useActionState(action, "idle");
  const [seriesState, seriesAction, seriesPending] = useActionState(action, "idle");
  const [messageState, messageAction, messagePending] = useActionState(action, "idle");
  const text = ticketText(locale);
  return <section className="space-y-4 rounded-card border border-border bg-white p-5">
    <h2 className="text-xl font-semibold">{text.title}</h2>
    {!settings ? <p role="alert">{text.unavailable}</p> : <><form action={formAction} className="space-y-4">
      <input type="hidden" name="intent" value="footer" />
      <label className="block space-y-2"><span>{text.footer}</span><textarea className="block w-full rounded-control border border-border p-3" name="footer" maxLength={4000} rows={6} defaultValue={settings.footer ?? ""} /><span className="block text-sm text-muted">{text.footerHelp}</span></label>
      {state !== "idle" ? <p role={state === "error" ? "alert" : "status"}>{state === "saved" ? text.saved : text.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? text.saving : text.save}</Button>
    </form>
    <form action={messageAction} className="space-y-4 border-t border-border pt-4">
      <input type="hidden" name="intent" value="specialMessage" />
      <label className="block space-y-2"><span>{text.specialMessage}</span><textarea className="block w-full rounded-control border border-border p-3" name="ticket_special_message" maxLength={4000} rows={4} defaultValue={settings.specialMessage ?? ""} /><span className="block text-sm text-muted">{text.specialMessageHelp}</span></label>
      {messageState !== "idle" ? <p role={messageState === "error" ? "alert" : "status"}>{messageState === "saved" ? text.saved : text.error}</p> : null}
      <Button type="submit" disabled={messagePending}>{messagePending ? text.saving : text.save}</Button>
    </form>
    {settings.canEditSeries ? <form action={seriesAction} className="space-y-4 border-t border-border pt-4">
      <input type="hidden" name="intent" value="series" />
      <label className="block space-y-2"><span>{text.series}</span><input className="block min-h-11 rounded-control border border-border px-3 uppercase" name="simplifiedSeries" maxLength={12} pattern="[A-Za-z0-9-]{1,12}" defaultValue={settings.simplifiedSeries ?? ""} /><span className="block text-sm text-muted">{text.seriesHelp}</span></label>
      {seriesState !== "idle" ? <p role={seriesState === "error" ? "alert" : "status"}>{seriesState === "saved" ? text.saved : text.error}</p> : null}
      <Button type="submit" disabled={seriesPending}>{seriesPending ? text.saving : text.save}</Button>
    </form> : null}</>}
  </section>;
}

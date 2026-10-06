"use client";

import { useCallback, useEffect, useState } from "react";

type PackJob = {
  id: string; period_start: string; period_end_exclusive: string; timezone: string;
  location_name_snapshot: string | null; status: "queued" | "processing" | "completed" | "failed" | "expired";
  requested_at: string; expires_at: string | null;
};

function inclusiveEnd(endExclusive: string) {
  const [year, month, day] = endExclusive.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export type AccountantPackText = {
  title: string; description: string; consistency: string; prepare: string; preparing: string;
  ready: string; failed: string; expired: string; download: string; retry: string;
  prepareAgain: string; period: string; scope: string; requested: string; status: string;
  expires: string; action: string; allLocations: string; older: string; newer: string;
  latest: string; empty: string; error: string;
};

export function AccountantPackPanel({ locale, selection, locationId, text }: {
  locale: string;
  selection: { preset: string; start: string; end: string; year?: string; quarter?: string };
  locationId: string | null;
  text: AccountantPackText;
}) {
  const base = `/${locale}/app/accounting/accountant-pack`;
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [jobs, setJobs] = useState<PackJob[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cursor = cursors[page];
  const refresh = useCallback(async () => {
    try {
      const url = `${base}/jobs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
      const result = await fetch(url, { cache: "no-store" });
      if (!result.ok) throw new Error("history_unavailable");
      const data = await result.json();
      const now = Date.now();
      setJobs(data.rows.map((job: PackJob) => job.status === "completed" && job.expires_at
        && Date.parse(job.expires_at) <= now ? { ...job, status: "expired" } : job));
      setNextCursor(data.nextCursor);
      setError(false);
    } catch { setError(true); }
  }, [base, cursor]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [jobs, refresh]);

  async function submit(body: Record<string, unknown>) {
    setBusy(true);
    setError(false);
    try {
      const result = await fetch(`${base}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!result.ok) throw new Error("request_failed");
      setCursors([null]); setPage(0);
      await refresh();
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  const prepare = () => submit({ ...selection, location: locationId });
  return <section className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-primary">{text.title}</h2><p className="mt-1 text-sm text-muted">{text.description}</p></div>
      <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        disabled={busy} onClick={prepare} type="button">{text.prepare}</button>
    </div>
    <p className="mt-3 text-xs text-muted">{text.consistency}</p>
    {error ? <p className="mt-3 text-sm text-red-800" role="alert">{text.error}</p> : null}
    {jobs.length === 0 ? <p className="mt-4 text-sm text-muted">{text.empty}</p> : <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase text-muted">
        {[text.period, text.scope, text.requested, text.status, text.expires, text.action].map((label) => <th className="px-2 py-3" key={label}>{label}</th>)}
      </tr></thead><tbody>{jobs.map((job) => {
        const status = job.status;
        return <tr className="border-b border-border" key={job.id}>
          <td className="px-2 py-3 tabular-nums">{job.period_start} – {inclusiveEnd(job.period_end_exclusive)}</td>
          <td className="px-2 py-3">{job.location_name_snapshot ?? text.allLocations}</td>
          <td className="px-2 py-3">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: job.timezone }).format(new Date(job.requested_at))}</td>
          <td className="px-2 py-3">{status === "queued" || status === "processing" ? text.preparing
            : status === "completed" ? text.ready : status === "failed" ? text.failed : text.expired}</td>
          <td className="px-2 py-3">{job.expires_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: job.timezone }).format(new Date(job.expires_at)) : "—"}</td>
          <td className="px-2 py-3">{status === "completed"
            ? <span className="flex gap-2"><a className="font-semibold text-primary underline" href={`${base}/${job.id}/download`}>{text.download}</a>
                <button className="font-semibold text-primary underline disabled:opacity-50" disabled={busy}
                  onClick={() => void submit({ prepareAgainJobId: job.id })} type="button">{text.prepareAgain}</button></span>
            : status === "failed" ? <button className="font-semibold text-primary underline disabled:opacity-50" disabled={busy}
              onClick={() => void submit({ retryJobId: job.id })} type="button">{text.retry}</button>
              : status === "expired" ? <button className="font-semibold text-primary underline disabled:opacity-50" disabled={busy}
                onClick={() => void submit({ prepareAgainJobId: job.id })} type="button">{text.prepareAgain}</button> : "—"}</td>
        </tr>;
      })}</tbody></table>
    </div>}
    <div className="mt-3 flex gap-3 text-sm">
      {page > 0 ? <button className="font-semibold text-primary underline" onClick={() => setPage(page - 1)} type="button">{text.newer}</button> : null}
      {nextCursor ? <button className="font-semibold text-primary underline" onClick={() => {
        setCursors((value) => [...value.slice(0, page + 1), nextCursor]); setPage(page + 1);
      }} type="button">{text.older}</button> : null}
      {page > 0 ? <button className="font-semibold text-primary underline" onClick={() => { setCursors([null]); setPage(0); }} type="button">{text.latest}</button> : null}
    </div>
  </section>;
}

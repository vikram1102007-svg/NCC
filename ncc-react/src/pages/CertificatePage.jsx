import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, Search } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

export default function CertificatePage() {
  const [params] = useSearchParams();
  const paramId = params.get("id") || "";
  const [queryId, setQueryId] = useState(paramId);
  const [result, setResult] = useState(() => (paramId ? Store.getCertificateById(paramId) : null));
  const [searched, setSearched] = useState(Boolean(paramId));

  useEffect(() => {
    if (paramId) {
      setQueryId(paramId);
      setResult(Store.getCertificateById(paramId));
      setSearched(true);
    }
  }, [paramId]);

  const handleVerify = (e) => {
    e.preventDefault();
    setSearched(true);
    setResult(Store.getCertificateById(queryId));
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <GlassCard>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
          Public Verification · Demo
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-[#0d1b2a]">
          Verify Certificate ID
        </h1>
        <p className="mt-1 text-sm text-[#4a5a6b]">
          Enter a demo certificate ID (issued after attendance is marked Present in Admin).
        </p>

        <form onSubmit={handleVerify} className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="cert-id" className="sr-only">
            Certificate ID
          </label>
          <input
            id="cert-id"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            placeholder="CERT-XXXXXX-..."
            className="min-h-[44px] flex-1 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-mono"
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#0d1b2a] px-4 py-2 text-sm font-bold text-white"
          >
            <Search className="h-4 w-4" /> Verify
          </button>
        </form>

        {searched && !result && (
          <div className="mt-5 rounded-md border border-[#ebc2be] bg-[#fceceb] p-4 text-sm text-[#a62b21]">
            No certificate record matched that ID in this browser demo store.
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-xl border-2 border-[#d9a742] bg-[#fbf3df]/40 p-5">
            <div className="flex items-center gap-2 text-[#1b6638]">
              <Award className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Verified Demo Certificate</span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-[#0d1b2a]">
              {result.participantName}
            </h2>
            <p className="mt-1 text-sm text-[#2b3c4d]">
              Event: <strong>{result.eventTitle}</strong> ({result.eventDay})
            </p>
            <p className="mt-1 text-xs text-[#4a5a6b]">
              Certificate ID: <strong>{result.certificateId}</strong> · Regimental No: {result.regimentalNo}
            </p>
            <p className="mt-1 text-xs text-[#4a5a6b]">
              Signatories: {result.signatoryLeft} &amp; {result.signatoryRight}
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import Diorama from "./three/Diorama.jsx";
import { exportPostcard } from "./postcard.js";

const STAGES = [
  ["01", "LOOK", "GPT-5.6 blind visual survey"],
  ["02", "CHECK", "Independent crash + 311 evidence"],
  ["03", "FIX", "Costed, grant-matched interventions"],
  ["04", "ACT", "Resident letter ready to send"],
];

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    spark: <><path d="m12 2 1.5 5.3L19 9l-5.5 1.7L12 16l-1.5-5.3L5 9l5.5-1.7L12 2Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    external: <><path d="M14 3h7v7"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function CrashMap({ leaderboard, currentLabel, demo, loading, onAnalyze }) {
  const points = (leaderboard?.intersections || []).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  const [selectedKey, setSelectedKey] = useState("");
  const selected = points.find((item) => item.key === selectedKey) || points.find((item) => item.label === currentLabel) || points[0];
  if (!points.length) return null;
  const latitudes = points.map((item) => item.lat);
  const longitudes = points.map((item) => item.lng);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes); const maxLng = Math.max(...longitudes);
  const position = (item) => ({
    x: 70 + ((item.lng - minLng) / Math.max(0.001, maxLng - minLng)) * 860,
    y: 350 - ((item.lat - minLat) / Math.max(0.001, maxLat - minLat)) * 280,
  });
  const selectedIsCurrent = /16th/i.test(selected?.label || "") && /mission/i.test(selected?.label || "");
  return (
    <section className="crash-map-landing" aria-labelledby="crash-map-title">
      <div className="map-copy">
        <span>ALL OF SAN FRANCISCO COUNTY</span>
        <h1 id="crash-map-title">Every dot is a case<br /><em>for a safer street.</em></h1>
        <p>Explore severity-weighted injury-crash intersections, then open a complete evidence brief.</p>
        {selected && <div className="map-selection"><small>SELECTED CORNER · RANK {selected.rank}</small><strong>{selected.label}</strong><span>{selected.crashCount} crashes · {selected.fatalCount} fatal · score {selected.score}</span><button disabled={loading || (demo && !selectedIsCurrent)} onClick={(event) => onAnalyze(event, selected.label)}>{demo && !selectedIsCurrent ? "LIVE MODE REQUIRED" : "ANALYZE THIS CORNER"}<Icon name="arrow" /></button></div>}
      </div>
      <div className="crash-map" role="group" aria-label={`Clickable injury-crash map for Supervisor District ${leaderboard.district}`}>
        <div className="map-label">DISTRICT {leaderboard.district} · CLICK A DOT</div>
        <svg viewBox="0 0 1000 420" aria-label="Ranked crash intersections">
          <path className="map-water" d="M0 0h1000v420H0z" />
          <path className="map-land" d="M70 35 940 15 975 330 845 405 115 385 35 250Z" />
          {[95,155,215,275,335].map((y) => <path className="map-road" key={`h${y}`} d={`M75 ${y} C 260 ${y - 45}, 650 ${y + 45}, 940 ${y - 8}`} />)}
          {[160,310,460,610,760,885].map((x) => <path className="map-road minor" key={`v${x}`} d={`M${x} 40 C ${x - 65} 170, ${x + 55} 280, ${x - 20} 385`} />)}
          {points.map((item) => { const point = position(item); return <g key={item.key} role="button" tabIndex="0" aria-label={`Select ${item.label}, rank ${item.rank}`} className={`crash-dot ${selected?.key === item.key ? "selected" : ""} ${item.fatalCount ? "fatal" : ""}`} onClick={() => setSelectedKey(item.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedKey(item.key); }}><circle cx={point.x} cy={point.y} r={8 + Math.min(12, item.score / 4)} /><text x={point.x} y={point.y + 3}>{item.rank}</text></g>; })}
        </svg>
        <div className="sr-only">{points.map((item) => <button key={item.key} onClick={() => setSelectedKey(item.key)}>Select {item.label}, rank {item.rank}</button>)}</div>
        <div className="map-legend"><span><i className="fatal" />Fatality in group</span><span><i />Injury crashes</span><b>{leaderboard.recordsAnalyzed.toLocaleString()} RECORDS</b></div>
      </div>
    </section>
  );
}

function RenderPair({ renders }) {
  if (!renders?.available) return null;
  return (
    <section className="render-pair" aria-labelledby="render-pair-title">
      <div className="render-heading"><div><span>PHOTOREALISTIC STREET EDIT</span><h2 id="render-pair-title">Same corner. Buildable change.</h2></div><p>{renders.synthetic ? "Synthetic judge-mode reference · not evidence" : `Live edit · ${renders.model}`}</p></div>
      <div className="render-grid">
        <figure><img src={renders.before} alt="Street before proposed safety treatments" /><figcaption><b>BEFORE</b><span>Existing visual condition</span></figcaption></figure>
        <figure><img src={renders.after} alt="Photorealistic edit showing proposed safety treatments" /><figcaption><b>AFTER</b><span>Crosswalk · bulb-outs · protected bike space</span></figcaption></figure>
      </div>
      <small>{renders.source}</small>
    </section>
  );
}

function StreetReference({ items = [], satellite }) {
  const [mode, setMode] = useState("street");
  const available = items.find((item) => item.available && item.image);
  const overhead = satellite?.available && satellite.image ? satellite : null;
  const selected = mode === "satellite" ? overhead : available;
  if (selected) {
    return (
      <div className="street-reference image-ready" style={{ backgroundImage: `url(${selected.image})` }}>
        <div className="reference-label"><span className="live-dot" /> {mode === "satellite" ? "SATELLITE · NORTH-UP" : `STREET VIEW · ${available.heading}°`}</div>
        {available && overhead && <div className="reference-switch"><button className={mode === "street" ? "selected" : ""} onClick={() => setMode("street")}>STREET</button><button className={mode === "satellite" ? "selected" : ""} onClick={() => setMode("satellite")}>OVERHEAD</button></div>}
        <div className="reference-credit">{mode === "satellite" ? overhead.source : available.copyright || "Street View reference"}</div>
      </div>
    );
  }
  return (
    <div className="street-reference placeholder">
      <div className="reference-label"><span className="sample-dot" /> STREET-LEVEL REFERENCE</div>
      <div className="placeholder-sky" />
      <div className="placeholder-building left" />
      <div className="placeholder-building right" />
      <div className="placeholder-road"><i /><i /><i /><i /></div>
      <div className="placeholder-copy">
        <span>Judge-mode privacy fallback</span>
        <small>Add a Google Street View key for live imagery</small>
      </div>
    </div>
  );
}

function FindingCard({ finding, fix }) {
  return (
    <article className="finding-card">
      <div className="finding-topline">
        <span className={`status-pill ${finding.status.toLowerCase()}`}><i />{finding.status}</span>
        <span className="zone-tag">{finding.zone}</span>
      </div>
      <h3>{finding.hazard}</h3>
      <p>{finding.detail}</p>
      <div className="confidence-line">
        <span>Vision confidence</span>
        <div className="meter"><i style={{ width: `${Math.round((finding.confidence || 0) * 100)}%` }} /></div>
        <strong>{Math.round((finding.confidence || 0) * 100)}%</strong>
      </div>
      {fix && (
        <div className="fix-mini">
          <div>
            <small>PROPOSED FIX</small>
            <strong>{fix.title}</strong>
          </div>
          <div className="fix-price">
            <b>{fix.cost}</b>
            <span>{fix.grant}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function ReportedCard({ item }) {
  return (
    <article className="finding-card reported-card">
      <div className="finding-topline">
        <span className="status-pill reported"><i />REPORTED</span>
        <span className="zone-tag">record-only signal</span>
      </div>
      <h3>{item.source}</h3>
      <p>{item.detail}</p>
      <div className="reported-date">Official record · {formatDate(item.date)}</div>
    </article>
  );
}

export default function App() {
  const dioramaRef = useRef(null);
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("16th St & Mission St");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remodeled, setRemodeled] = useState(false);
  const [panel, setPanel] = useState("findings");
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState("");
  const [telemetry, setTelemetry] = useState([]);
  const [activity, setActivity] = useState([]);
  const [exportStatus, setExportStatus] = useState("");

  useEffect(() => {
    fetch("/api/demo")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the judge-mode sample.");
        return response.json();
      })
      .then((payload) => { setData(payload); setProgress(4); setTelemetry(payload.meta?.telemetry || []); setActivity(payload.meta?.activity || []); })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const runAnalysis = async (event, overrideQuery) => {
    event?.preventDefault();
    const targetQuery = String(overrideQuery || query).trim();
    if (!targetQuery) return;
    setQuery(targetQuery);
    setLoading(true);
    setError("");
    setProgress(0);
    setTelemetry([]);
    setActivity([]);
    setRemodeled(false);
    try {
      const payload = await new Promise((resolve, reject) => {
        const source = new EventSource(`/api/analyze/stream?query=${encodeURIComponent(targetQuery)}`);
        let receivedEvent = false;
        source.addEventListener("stage", (message) => {
          receivedEvent = true;
          const eventData = JSON.parse(message.data);
          setProgress(eventData.progress || 0);
          setTelemetry((events) => [...events, eventData].slice(-8));
        });
        source.addEventListener("warning", (message) => {
          receivedEvent = true;
          const warning = JSON.parse(message.data);
          setTelemetry((events) => [...events, { stage: "NOTICE", status: "warning", message: warning.message, at: new Date().toISOString() }].slice(-8));
        });
        source.addEventListener("agent", (message) => {
          receivedEvent = true;
          const eventData = JSON.parse(message.data);
          setActivity((events) => [...events, eventData].slice(-12));
        });
        source.addEventListener("result", (message) => {
          receivedEvent = true;
          source.close();
          resolve(JSON.parse(message.data));
        });
        source.addEventListener("analysis-error", (message) => {
          receivedEvent = true;
          source.close();
          reject(new Error(JSON.parse(message.data).message));
        });
        source.onerror = async () => {
          source.close();
          if (receivedEvent) return reject(new Error("The analysis stream ended before the result arrived."));
          try {
            const response = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: targetQuery }),
            });
            const fallback = await response.json();
            if (!response.ok) throw new Error(fallback.error || "Analysis failed.");
            resolve(fallback);
          } catch (fallbackError) {
            reject(fallbackError);
          }
        };
      });
      setData(payload);
      setProgress(4);
      setTelemetry(payload.meta?.telemetry || []);
      setActivity(payload.meta?.activity || []);
    } catch (analysisError) {
      setError(analysisError.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (value, key) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  };

  const fixesByFinding = useMemo(
    () => new Map((data?.fixes || []).map((fix) => [fix.findingId, fix])),
    [data],
  );
  const latestCrash = data?.crashes?.[0];
  const locationTitle = data?.location?.shortLabel || data?.location?.query || "16th St & Mission St";
  const mailto = data?.civic?.email
    ? `mailto:${data.civic.email}?subject=${encodeURIComponent(`Street safety request: ${locationTitle}`)}&body=${encodeURIComponent(data.advocacy?.letter || "")}`
    : "";
  const tweetUrl = data?.advocacy?.post ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.advocacy.post)}` : "";
  const redditUrl = data?.advocacy?.redditTitle ? `https://www.reddit.com/submit?title=${encodeURIComponent(data.advocacy.redditTitle)}&text=${encodeURIComponent(data.advocacy.redditBody || "")}` : "";

  const downloadPostcard = async () => {
    setExportStatus("Preparing…");
    try {
      const pair = dioramaRef.current?.capturePair();
      if (!pair) throw new Error("The 3D scene is still preparing.");
      await exportPostcard({ pair, data, title: locationTitle });
      setExportStatus("Downloaded");
      window.setTimeout(() => setExportStatus(""), 2200);
    } catch (downloadError) {
      setExportStatus(downloadError.message);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Model Citizen home">
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span>MODEL <b>CITIZEN</b></span>
        </a>
        <nav>
          <a href="#method">How it works</a>
          <a href="#evidence">Evidence</a>
          <span className="track-chip">OPENAI BUILD WEEK · APPS FOR YOUR LIFE</span>
        </nav>
      </header>

      <main id="top">
        {data?.leaderboard?.intersections?.length > 0 && <CrashMap leaderboard={data.leaderboard} currentLabel={locationTitle} demo={data.meta?.demo} loading={loading} onAnalyze={runAnalysis} />}
        <section className="hero">
          <div className="eyebrow"><span>INDEPENDENT VISION</span><i /> <span>PUBLIC DATA</span><i /> <span>FUNDABLE FIXES</span></div>
          <h1>See the street.<br /><em>Fund the fix.</em></h1>
          <p className="hero-copy">Turn any San Francisco intersection into an evidence-backed safety plan — with an explorable 3D before-and-after.</p>
          <form className="search-form" onSubmit={runAnalysis}>
            <Icon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="San Francisco intersection" placeholder="Try 16th St & Mission St" />
            <button type="submit" disabled={loading}>{loading ? "Analyzing…" : "Analyze corner"}<Icon name="arrow" /></button>
          </form>
          <div className="search-note"><Icon name="shield" /> GPT-5.6 sees imagery first. City records stay firewalled until corroboration.</div>
        </section>

        {data?.leaderboard?.intersections?.length > 0 && (
          <section className="leaderboard-card" aria-labelledby="leaderboard-title">
            <div className="leaderboard-heading">
              <div><span>DISCOVER THE NEED</span><h2 id="leaderboard-title">Highest-priority corners in District {data.leaderboard.district}</h2></div>
              <p>{data.leaderboard.recordsAnalyzed} returned injury-crash records since 2021 · severity-weighted and street-pair deduplicated</p>
            </div>
            <div className="leaderboard-list">
              {data.leaderboard.intersections.slice(0, 10).map((item) => {
                const current = item.key === "16TH ST & MISSION ST" && /16th/i.test(locationTitle) && /mission/i.test(locationTitle);
                const disabled = data.meta?.demo && !current;
                return (
                  <button key={item.key} disabled={disabled || loading} onClick={(event) => runAnalysis(event, item.label)} title={disabled ? "Live keyed mode analyzes this corner; judge mode remains fixed to 16th & Mission." : `Analyze ${item.label}`}>
                    <b>{String(item.rank).padStart(2, "0")}</b>
                    <span><strong>{item.label}</strong><small>{item.crashCount} crashes · {item.fatalCount} fatal · {item.pedestrianCount} pedestrian</small></span>
                    <em>{item.score}</em>
                  </button>
                );
              })}
            </div>
            <div className="leaderboard-method"><span>SCORE</span>{data.leaderboard.methodology}</div>
          </section>
        )}

        <section className="stage-rail" id="method" aria-label="Analysis pipeline">
          {STAGES.map(([number, verb, detail], index) => (
            <div className={`stage ${progress > index ? "complete" : ""} ${loading && progress === index ? "active" : ""}`} key={number}>
              <span className="stage-number">{progress > index ? "✓" : number}</span>
              <div><strong>{verb}</strong><small>{detail}</small></div>
            </div>
          ))}
        </section>

        {telemetry.length > 0 && (
          <section className="telemetry-feed" aria-live="polite">
            <div><span className="pulse-dot" /><strong>LIVE PIPELINE</strong><small>Server-reported completions</small></div>
            <ol>
              {telemetry.slice(-4).map((item, index) => (
                <li className={item.status === "warning" ? "warning" : ""} key={`${item.at}-${index}`}><b>{item.stage}</b><span>{item.message}</span><time>{item.at ? new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</time></li>
              ))}
            </ol>
          </section>
        )}

        {activity.length > 0 && (
          <section className="agent-feed" aria-live="polite">
            <div className="agent-feed-heading"><span>MULTI-AGENT ACTIVITY</span><strong>{data?.meta?.orchestration?.runtime === "fetch-ai-uagents" ? "FETCH.AI / uAGENTS" : data?.meta?.demo ? "VERIFIED FIXTURE TASKS" : "LOCAL ORCHESTRATOR"}</strong><small>Actual task events · no staged timer</small></div>
            <div className="agent-feed-grid">{activity.slice(-4).map((item, index) => <article key={`${item.at}-${index}`}><i className={item.status} /><div><b>{item.agentName || item.agent}</b><span>{item.message}</span></div><time>{item.at ? new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</time></article>)}</div>
          </section>
        )}

        {error && <div className="error-banner">{error}</div>}

        {data && (
          <>
            <section className="location-heading">
              <div>
                <span className="section-kicker">INTERSECTION BRIEF · {data.meta?.demo ? "JUDGE MODE" : "LIVE ANALYSIS"}</span>
                <h2>{locationTitle}</h2>
                <p>Supervisor District {data.civic?.district || "—"} · San Francisco, California</p>
              </div>
              <div className="data-freshness">
                <span className="fresh-dot" />
                <div><strong>PUBLIC DATA LOADED</strong><small>DataSF + OpenStreetMap · {formatDate(data.meta?.generatedAt)}</small></div>
              </div>
            </section>

            <section className="metric-grid" id="evidence">
              <article className="metric danger"><small>RECORDED FATALITIES</small><strong>{data.summary?.fatalCount || 0}</strong><span>within 100 m in returned records</span></article>
              <article className="metric"><small>INJURY CRASH RECORDS</small><strong>{data.summary?.crashCount || 0}</strong><span>{data.summary?.pedestrianCrashCount || 0} involving pedestrians</span></article>
              <article className="metric"><small>VISUAL FINDINGS</small><strong>{data.findings?.length || 0}</strong><span>{data.summary?.confirmedCount || 0} independently confirmed</span></article>
              <article className="metric accent"><small>PLANNED INVESTMENT</small><strong>{data.fixes?.length || 0}</strong><span>grant-matched street fixes</span></article>
            </section>

            <section className="workspace-card">
              <div className="workspace-toolbar">
                <div className="view-title"><Icon name="layers" /><div><strong>THE CORNER, REBUILT</strong><small>Real OSM footprints · drag to orbit · scroll to zoom</small></div></div>
                <div className="workspace-actions">
                  <button className="postcard-button" onClick={downloadPostcard}><Icon name="download" />{exportStatus || "EXPORT POSTCARD"}</button>
                  <div className="remodel-control" role="group" aria-label="Street design view">
                    <button className={!remodeled ? "selected" : ""} onClick={() => setRemodeled(false)}>TODAY</button>
                    <button className={remodeled ? "selected proposed" : ""} onClick={() => setRemodeled(true)}><Icon name="spark" />PROPOSED</button>
                  </div>
                </div>
              </div>
              <div className={`split-view ${remodeled ? "is-remodeled" : ""}`}>
                <div className="reference-column">
                  <StreetReference items={data.streetview} satellite={data.satellite} />
                  <div className="source-caption"><span>A</span><div><strong>STREET-LEVEL VIEW</strong><small>Visual input is isolated from city records</small></div></div>
                </div>
                <div className="diorama-column">
                  <Diorama ref={dioramaRef} data={data} remodeled={remodeled} />
                  <div className={`scene-state ${remodeled ? "proposed" : ""}`}><i />{remodeled ? "FUNDED REMODEL" : "EXISTING CONDITIONS"}</div>
                  <div className="orbit-hint">↔ DRAG TO EXPLORE</div>
                  <div className="source-caption dark"><span>B</span><div><strong>3D DIGITAL TWIN</strong><small>{data.geometry?.elements?.length || 0} mapped street elements</small></div></div>
                </div>
              </div>
              <div className="legend-bar">
                <div><span className="legend-ring red" /> Confirmed hazard</div>
                <div><span className="legend-ring amber" /> Visual candidate</div>
                <div><span className="legend-block green" /> Funded intervention</div>
                <p>{remodeled ? "Bright street props show the proposed, grant-matched fixes." : "Hazard rings are anchored to stable street zones, not fragile pixel coordinates."}</p>
              </div>
            </section>

            <RenderPair renders={data.renders} />

            <section className="detail-grid">
              <div className="findings-panel">
                <div className="panel-tabs">
                  <button className={panel === "findings" ? "active" : ""} onClick={() => setPanel("findings")}>FINDINGS <span>{data.findings?.length || 0}</span></button>
                  <button className={panel === "letter" ? "active" : ""} onClick={() => setPanel("letter")}>TAKE ACTION</button>
                </div>
                {panel === "findings" ? (
                  <div className="finding-list">
                    {(data.findings || []).map((finding) => <FindingCard key={finding.id} finding={finding} fix={fixesByFinding.get(finding.id)} />)}
                    {(data.reported || []).slice(0, 4).map((item) => <ReportedCard key={item.id} item={item} />)}
                    {!data.findings?.length && <div className="empty-state">No visual claims were made. Configure Street View and OpenAI keys for a live blind survey.</div>}
                  </div>
                ) : (
                  <div className="letter-card">
                    <div className="letter-heading"><div><span>READY TO SEND · DISTRICT {data.civic?.district || "—"}</span><h3>Letter to {data.civic?.supervisor ? `Supervisor ${data.civic.supervisor.split(" ").at(-1)}` : "your Supervisor"}</h3></div><button onClick={() => copyText(data.advocacy?.letter || "", "letter")}><Icon name="copy" />{copied === "letter" ? "Copied" : "Copy"}</button></div>
                    <pre>{data.advocacy?.letter}</pre>
                    {mailto && <a className="email-letter-button" href={mailto}><Icon name="mail" />Open addressed email to {data.civic.supervisor}</a>}
                    <div className="social-post"><div><span>X / TWEET · {data.advocacy?.post?.length || 0}/280</span><div className="social-actions"><button onClick={() => copyText(data.advocacy?.post || "", "post")}>{copied === "post" ? "Copied" : "Copy"}</button>{tweetUrl && <a href={tweetUrl} target="_blank" rel="noreferrer">POST ON X <Icon name="external" /></a>}</div></div><p>{data.advocacy?.post}</p></div>
                    {data.advocacy?.redditTitle && <div className="reddit-post"><div><span>REDDIT POST</span><div className="social-actions"><button onClick={() => copyText(`${data.advocacy.redditTitle}\n\n${data.advocacy.redditBody}`, "reddit")}>{copied === "reddit" ? "Copied" : "Copy"}</button>{redditUrl && <a href={redditUrl} target="_blank" rel="noreferrer">OPEN REDDIT <Icon name="external" /></a>}</div></div><h4>{data.advocacy.redditTitle}</h4><p>{data.advocacy.redditBody}</p></div>}
                  </div>
                )}
              </div>

              <aside className="evidence-panel">
                <div className="aside-heading"><span>WHY THIS MATTERS</span><h3>Independent signals,<br />one urgent pattern.</h3></div>
                {latestCrash && (
                  <article className="record-card fatal-record">
                    <div className="record-icon">!</div>
                    <div><span>DATASF TRAFFIC CRASH</span><h4>{latestCrash.collision_severity} {latestCrash.type_of_collision}</h4><p>{formatDate(latestCrash.collision_datetime)} · {latestCrash.primary_rd} & {latestCrash.secondary_rd}</p></div>
                  </article>
                )}
                <article className="firewall-card">
                  <Icon name="shield" />
                  <div><span>THE TRUST FIREWALL</span><p>GPT-5.6 inspected only street-level and satellite imagery. Crash, 311, district, legislative, and geometry records were introduced afterward.</p></div>
                </article>
                {data.civic && (
                  <article className="official-card">
                    <span>NAMED OFFICIAL TO CONTACT</span>
                    <h4>Supervisor {data.civic.supervisor}</h4>
                    <p>District {data.civic.district} · {data.civic.phone}</p>
                    <small>District data verified {formatDate(data.civic.dataAsOf)}</small>
                    <div><a href={data.civic.rosterUrl} target="_blank" rel="noreferrer">Official roster <Icon name="external" /></a>{mailto && <a href={mailto}>Draft email <Icon name="mail" /></a>}</div>
                  </article>
                )}
                <div className="source-list">
                  <div><span className="source-logo ds">SF</span><div><strong>DataSF</strong><small>{data.crashes?.length || 0} crash · {data.reports311?.length || 0} relevant 311 records</small></div><b>LIVE</b></div>
                  <div><span className="source-logo osm">◇</span><div><strong>OpenStreetMap</strong><small>Roads, buildings, signals, crossings</small></div><b>ODbL</b></div>
                  <div><span className="source-logo ai">✦</span><div><strong>OpenAI</strong><small>{data.meta?.model || "gpt-5.6"} blind survey + writing</small></div><b>AI</b></div>
                </div>
                <section className="paper-trail">
                  <div className="paper-trail-heading"><span>LEGISLATIVE PAPER TRAIL</span><b>{data.legislative?.records?.length || 0} MATCHES</b></div>
                  {(data.legislative?.records || []).slice(0, 3).map((record) => (
                    <a href={record.url} target="_blank" rel="noreferrer" key={record.id}>
                      <small>FILE {record.file} · {formatDate(record.actionAt)}</small>
                      <strong>{record.name}</strong>
                      <span>{record.status} · {record.action}</span>
                    </a>
                  ))}
                  {!data.legislative?.records?.length && <p>No exact street-name match was returned. That is not evidence that no action occurred.</p>}
                  <em>{data.legislative?.disclosure}</em>
                </section>
                {data.meetingMinutes?.records?.length > 0 && <section className="corroboration-list"><div className="paper-trail-heading"><span>COUNCIL MEETING MINUTES</span><b>{data.meetingMinutes.records.length} OFFICIAL</b></div>{data.meetingMinutes.records.map((record) => <a href={record.url} target="_blank" rel="noreferrer" key={`${record.file}-${record.url}`}><small>FILE {record.file} · {formatDate(record.date)}</small><strong>{record.title}</strong><span>{record.detail}</span></a>)}<em>{data.meetingMinutes.disclosure}</em></section>}
                {data.news?.articles?.length > 0 && <section className="corroboration-list news-list"><div className="paper-trail-heading"><span>NEWS CORROBORATION</span><b>{data.news.articles.length} ARTICLE</b></div>{data.news.articles.map((article) => <a href={article.url} target="_blank" rel="noreferrer" key={article.url}><small>{article.publisher} · {formatDate(article.publishedAt)}</small><strong>{article.title}</strong><span>{article.corroborates}</span></a>)}</section>}
                {data.warnings?.length > 0 && <div className="warning-stack"><span>TRANSPARENCY NOTICES</span>{data.warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div>}
                <button className="action-button" onClick={() => setPanel("letter")}>Open ready-to-send letter <Icon name="arrow" /></button>
              </aside>
            </section>
          </>
        )}
      </main>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span>MODEL <b>CITIZEN</b></span></div>
        <p>Original build for OpenAI Build Week 2026.</p>
        <span>PUBLIC DATA · INDEPENDENT EVIDENCE · MIT LICENSE</span>
      </footer>
    </div>
  );
}

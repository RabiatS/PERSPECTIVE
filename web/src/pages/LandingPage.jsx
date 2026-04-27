import { Link } from 'react-router-dom'
import { LandingGlobe } from '../components/landing/LandingGlobe.jsx'
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx'

const TOKEN_TEAL = '#5EEAD4'
const TOKEN_BLOOD = '#A81C1C'
const TOKEN_CALM = '#4ECDC4'

export function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <span className="landing-logo">3D Data Vis</span>
          <nav className="landing-nav-links">
            <ThemeToggle variant="nav" />
            <a className="landing-nav-ghost" href="#how-it-works">
              How it works
            </a>
            <a className="landing-nav-ghost" href="#data-types">
              Data types
            </a>
            <Link className="landing-nav-cta" to="/app">
              Open workspace
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow">Browser-native · Spatial · AI-assisted</p>
              <h1 className="landing-title">
                See your data as a world you can{' '}
                <span className="landing-title-accent">move through</span>
              </h1>
              <p className="landing-lead">
                Upload structured tables, geospatial sets, or audio. Let classification suggest
                the right 3D view, explore with orbit controls, then export a shareable badge —
                all without leaving the tab.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-btn landing-btn-primary" to="/app?demo=1">
                  Try sample data
                </Link>
                <Link className="landing-btn landing-btn-secondary" to="/app">
                  Open workspace
                </Link>
              </div>
              <ul className="landing-hero-meta">
                <li>
                  <span className="landing-dot" style={{ color: TOKEN_TEAL }} />
                  Unity-style scene + axis gizmos
                </li>
                <li>
                  <span className="landing-dot" style={{ color: TOKEN_BLOOD }} />
                  LENS · SCOUT · CURATOR · BRIDGE agents
                </li>
                <li>
                  <span className="landing-dot" style={{ color: TOKEN_CALM }} />
                  Desktop now · WebXR-ready
                </li>
              </ul>
            </div>
            <div className="landing-hero-visual">
              <LandingGlobe />
              <p className="landing-globe-caption">
                Geographic data lights up like night cities — links show relationships across the
                globe. In the app, your own datasets get the same spatial treatment.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-section" id="how-it-works">
          <div className="landing-section-head">
            <h2 className="landing-h2">How it works</h2>
            <p className="landing-sub">
              Three beats from file drop to spatial insight — no generic dashboard metaphors.
            </p>
          </div>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-num">01</span>
              <h3 className="landing-h3">Ingest &amp; classify</h3>
              <p>
                Drop CSV, JSON, GeoJSON, or audio. The LENS agent reads types, gaps, and outliers,
                then recommends a 3D chart and axis mapping you can override.
              </p>
            </li>
            <li className="landing-step">
              <span className="landing-step-num">02</span>
              <h3 className="landing-h3">Navigate the scene</h3>
              <p>
                Orbit, zoom, and pan on a dark grid stage. SCOUT surfaces insight pins; CURATOR
                isolates selections into sub-scenes when you need a tighter lens.
              </p>
            </li>
            <li className="landing-step">
              <span className="landing-step-num">03</span>
              <h3 className="landing-h3">Export &amp; extend</h3>
              <p>
                BRIDGE handles formats and handoff. Badge exports package the view, key stats, and
                branding — PNG or SVG — for decks, docs, or social.
              </p>
            </li>
          </ol>
        </section>

        <section className="landing-section landing-section-tight" id="data-types">
          <div className="landing-section-head">
            <h2 className="landing-h2">Built for more than flat charts</h2>
            <p className="landing-sub">
              Each data family gets a visual language that belongs in 3D space — not squeezed into
              a grid of widgets.
            </p>
          </div>
          <div className="landing-cards">
            <article className="landing-card">
              <h3 className="landing-h3">Structured</h3>
              <p>Scatter, surface, mesh, and bar volumes from tabular numeric columns.</p>
            </article>
            <article className="landing-card">
              <h3 className="landing-h3">Geographic</h3>
              <p>Globe-first views with arcs, regions, and spatial correlation — like the hero above.</p>
            </article>
            <article className="landing-card">
              <h3 className="landing-h3">Audio</h3>
              <p>FFT-powered waveform surfaces so sound becomes a landscape you can inspect.</p>
            </article>
          </div>
        </section>

        <section className="landing-cta-band">
          <div className="landing-cta-inner">
            <div>
              <h2 className="landing-h2 landing-h2-inline">Ready to walk your dataset?</h2>
              <p className="landing-sub landing-sub-cta">
                Placeholder name: <strong>3D Data Vis</strong> — the workspace is live in this repo.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link className="landing-btn landing-btn-primary landing-btn-large" to="/app?demo=1">
                Try sample data
              </Link>
              <Link className="landing-btn landing-btn-secondary landing-btn-large" to="/app">
                Open workspace
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>3D Data Vis — spatial visualization in the browser</span>
        <Link to="/app">Workspace</Link>
      </footer>
    </div>
  )
}

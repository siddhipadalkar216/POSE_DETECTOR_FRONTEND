import { Link } from 'react-router-dom';

const highlights = [
  { number: '01', title: 'Move in frame', copy: 'Set your camera far enough back to keep your full body visible.', color: 'mint' },
  { number: '02', title: 'Get real-time cues', copy: 'See your form and hear short prompts once you begin the movement.', color: 'blue' },
  { number: '03', title: 'Build your range', copy: 'Review mobility trends and repeated form signals after each workout.', color: 'pink' },
];

export default function StudioHomePage() {
  return (
    <div className="neo-page home-page">
      <section className="home-hero neo-card">
        <div className="hero-copy">
          <p className="eyebrow">A SMARTER WAY TO MOVE · POSE COACH</p>
          <h1>Your form.<br /><span>Your pace.</span></h1>
          <p className="hero-description">Train with live camera feedback, spoken coaching and a clear history of your movement.</p>
          <div className="hero-actions">
            <Link className="neo-button neo-button-lime" to="/exercises">Start a session <span>↗</span></Link>
            <Link className="hero-secondary" to="/settings">Set up your voice <span>→</span></Link>
          </div>
          <div className="hero-trust"><span>●</span> Camera analysis runs on this device when supported</div>
        </div>
        <div className="hero-art">
          <img
            className="hero-image"
            src="/home/pose.jpg"
            alt="Pose tracking highlights the joints of a person exercising on a mat."
          />
          <div className="hero-caption">LIVE POSE TRACKING <span>✳</span></div>
        </div>
      </section>

      <section className="pose-feature neo-card">
        <div className="pose-feature-copy">
          <p className="eyebrow">POSE TRACKING · CONCEPT ART</p>
          <h2>See the movement behind every rep.</h2>
          <p>Pose Coach reads your body landmarks to give you a clearer picture of how you move.</p>
          <Link className="hero-secondary" to="/exercises">Explore live coaching <span>→</span></Link>
        </div>
        <div className="pose-feature-image-wrap">
          <img
            className="pose-feature-image"
            src="/home/pose-tracking-concept.png"
            alt="Concept illustration of pose landmarks and movement lines overlaid on a weightlifting exercise."
            loading="lazy"
          />
        </div>
      </section>

      <section className="home-how">
        <div className="section-title-row"><div><p className="eyebrow">THREE STEPS · ONE BETTER REP</p><h2>Coaching that stays clear.</h2></div><span className="section-scribble">✳</span></div>
        <div className="highlight-grid">
          {highlights.map(item => (
            <article className={`neo-card highlight-card highlight-${item.color}`} key={item.number}>
              <span className="highlight-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <span className="highlight-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer"><strong>POSE COACH</strong><span>Move well. Keep learning.</span><Link to="/settings">VOICE SETTINGS ↗</Link></footer>
    </div>
  );
}

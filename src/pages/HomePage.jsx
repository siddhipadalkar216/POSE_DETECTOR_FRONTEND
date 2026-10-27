import { useRef } from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const containerRef = useRef(null);

  return (
    <div ref={containerRef} className="min-h-screen">
      <Hero />
      <div className="section py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-semibold mb-6 text-center">Workout ideas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="Lifting Dumbbells" img="https://marathonhandbook.com/wp-content/uploads/2022/08/Total-Body-Gym-Workout.jpg" />
            <Card title="Lifting Bars" img="https://mensfitness.co.uk/wp-content/uploads/sites/2/2022/11/squat_1-min-min_compressed-1.jpg?w=799" />
            <Card title="Warmup & Mobility" img="https://tse2.mm.bing.net/th/id/OIP.o1AkBtsQvPQoeP7OpTjTnwHaEK?pid=Api&P=0&h=180" />
          </div>
          <div className="mt-8 text-center">
            <p className="text-neutral-400">Prefer to train at home? Try workouts in front of your laptop and get posture feedback in real time.</p>
            <img src="https://tse2.mm.bing.net/th/id/OIP.Bl8Mg56zdJPVJgOjuKqIAAHaHa?pid=Api&P=0&h=180" alt="workout at laptop" className="mx-auto mt-4 w-64 rounded shadow-lg" />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
  <section className="section relative h-screen flex items-center justify-center bg-gradient-to-b from-indigo-900 via-neutral-900 to-neutral-950 overflow-hidden">
      {/* floating shapes */}
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute left-10 top-10 opacity-30" width="160" height="160" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#7c3aed" /></svg>
        <svg className="absolute right-20 top-28 opacity-20" width="220" height="220" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="18" fill="#06b6d4" /></svg>
      </div>

      <div className="relative z-10 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-white">Perfect Your Workout with Real-Time Pose Correction</h1>
            <p className="mt-4 text-neutral-300 text-lg md:text-xl">Track your exercise, get instant feedback, and improve posture with AI-powered pose detection.</p>
            <div className="mt-6 flex items-center gap-4 justify-center md:justify-start">
              <Link to="/exercises" className="inline-block rounded-lg bg-emerald-400 text-neutral-900 px-6 py-3 font-semibold shadow">Start Free Session</Link>
            </div>
            <div className="mt-4 text-sm text-neutral-400">No credit card required • Works with your laptop camera</div>
          </div>

            <div className="flex items-center justify-center">
            {/* silhouette (static) */}
            <div className="w-72 h-72 bg-white/5 rounded-full flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 200 200" className="w-56 h-56 text-white/90" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M100 30c-10 0-18 8-18 18s8 18 18 18 18-8 18-18-8-18-18-18z" opacity="0.95" />
                  <path d="M100 70v40" />
                  <path d="M100 110c-20 10-30 30-30 50" />
                  <path d="M100 110c20 10 30 30 30 50" />
                  <path d="M70 80c-10 10-22 18-34 26" opacity="0.8" />
                  <path d="M130 80c10 10 22 18 34 26" opacity="0.8" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
    </section>
  );
}

function Section({ title, subtitle }) {
  return (
    <section className="section py-12 flex items-center justify-center">
      <div className="max-w-3xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold mb-3">{title}</h2>
        <p className="text-neutral-300">{subtitle}</p>
      </div>
    </section>
  );
}

function Card({ title, img }) {
  return (
    <div className="bg-neutral-900 rounded-lg overflow-hidden shadow-md">
      <div className="h-44 bg-black/20">
        <img src={img} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="p-4">
        <div className="font-semibold">{title}</div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="section border-t border-neutral-800 bg-neutral-900 text-neutral-200">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-xl font-semibold mb-2">Pose Coach</div>
            <p className="text-neutral-400 text-sm">Perfect your posture with real-time AI feedback. Train safely and track progress over time.</p>
            <div className="mt-4 space-x-3">
              <a className="text-neutral-300 hover:underline" href="#">About</a>
              <a className="text-neutral-300 hover:underline" href="#">Contact</a>
              <a className="text-neutral-300 hover:underline" href="#">FAQ</a>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2">Pose Gallery</div>
            <div className="grid grid-cols-3 gap-2">
              <img src="https://tse2.mm.bing.net/th/id/OIP.UME09AOxLsE6SNsBMT05cgHaEK?pid=Api&P=0&h=180" alt="Warrior II" className="w-full h-20 object-cover rounded" />
              <img src="https://bod-blog-assets.prod.cd.beachbodyondemand.com/bod-blog/wp-content/uploads/2024/04/30135217/tree-pose-960.png" alt="Tree" className="w-full h-20 object-cover rounded" />
              <img src="https://i.pinimg.com/originals/96/9d/bf/969dbfeedc6dc79234bf56acacf59650.jpg" alt="Chair" className="w-full h-20 object-cover rounded" />
              <img src="https://musculation-nutrition.fr/wp-content/uploads/2021/04/position-squat.jpeg" alt="Squat" className="w-full h-20 object-cover rounded" />
              <img src="https://beyogi.com/wp-content/uploads/2015/03/Low-Lunge-Pose-Anjaneyasana.png" alt="Lunge" className="w-full h-20 object-cover rounded" />
              <img src="https://as2.ftcdn.net/v2/jpg/01/11/89/51/1000_F_111895122_s77Gn99UZqsc3XPwjJDVC8VhnE61id5R.jpg" alt="Pushup" className="w-full h-20 object-cover rounded" />
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2">Get updates</div>
            <p className="text-neutral-400 text-sm">Subscribe for weekly tips & product updates.</p>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); alert('Subscribed'); }}>
              <input placeholder="Your email" type="email" className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm" />
              <button className="rounded bg-emerald-400 text-neutral-900 px-3 py-2 text-sm font-semibold">Subscribe</button>
            </form>
            <div className="mt-4 text-sm text-neutral-400">Follow us:</div>
            <div className="mt-2 flex items-center gap-3">
              <a href="#" className="text-neutral-300">LinkedIn</a>
              <a href="#" className="text-neutral-300">Instagram</a>
              <a href="#" className="text-neutral-300">YouTube</a>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-neutral-400 text-sm">© {new Date().getFullYear()} Pose Coach. All rights reserved.</div>
      </div>
    </footer>
  );
}



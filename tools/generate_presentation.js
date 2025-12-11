const PptxGenJS = require("pptxgenjs");

const slides = [
  {
    title: "Kinekit — Kinect2 Interaction Demo",
    bullets: [
      "Real-time skeletal tracking & web-based visualizations",
      "Team: Finalisti",
      "Dec 2025"
    ],
    notes: "Intro: Greet audience and give elevator pitch (15-20s)."
  },
  {
    title: "Project Overview",
    bullets: [
      "Browser demo using Kinect v2 skeletal data",
      "Maps body movement to interactive visuals",
      "Runs locally via Node.js server"
    ],
    notes: "Describe what the project does and intended audience (30s)."
  },
  {
    title: "Goals & Requirements",
    bullets: [
      "Realtime low-latency tracking",
      "Accessible browser UI",
      "Modular capture, server, client separation"
    ],
    notes: "Explain design goals and why they matter (30s)."
  },
  {
    title: "High-Level Architecture",
    bullets: [
      "Kinect v2 -> Node.js server -> Browser client",
      "Server broadcasts joint frames to connected clients",
      "Client maps 3D joints to 2D canvas/WebGL"
    ],
    notes: "Walk through the data flow and components (45s)."
  },
  {
    title: "Hardware & Software Stack",
    bullets: [
      "Kinect v2, Windows PC (USB 3.0)",
      "Node.js server (`server.js`)",
      "Client: `index.html`, `src/main.js`"
    ],
    notes: "Mention drivers and platform constraints (20-30s)."
  },
  {
    title: "Data Flow & Formats",
    bullets: [
      "Depth, color, and skeleton frames",
      "Pose: 3D joint positions + confidence",
      "Transport: WebSocket-like JSON pose updates"
    ],
    notes: "Explain frame payloads and client rendering loop (40s)."
  },
  {
    title: "Key Implementation Details",
    bullets: [
      "`server.js` captures and broadcasts skeleton frames",
      "`src/main.js` maps joint coords to visuals",
      "Performance: throttle frames, send necessary joints"
    ],
    notes: "Show pseudocode idea and performance fixes (60s)."
  },
  {
    title: "Visualization & Interaction",
    bullets: [
      "Skeleton overlay + particle effects",
      "Position -> pointer; velocity -> intensity",
      "Gestures trigger mode changes"
    ],
    notes: "Describe a couple of interaction mappings (45s)."
  },
  {
    title: "Demo Walkthrough",
    bullets: [
      "Start server: `npm install` then `node server.js`",
      "Open browser to `http://localhost:3000`",
      "Show live skeleton, particle responses"
    ],
    notes: "Run demo live or show recorded video. Mention driver gotchas (2-3 min)."
  },
  {
    title: "Challenges & Solutions",
    bullets: [
      "Driver compatibility — verify Kinect drivers",
      "Noise/jitter — smooth joint data",
      "Latency — trim payloads, drop stale frames"
    ],
    notes: "For each challenge mention the implemented fix (45s)."
  },
  {
    title: "Results & Evaluation",
    bullets: [
      "Near real-time responsiveness (~50–100ms typical)",
      "Reliable single-person tracking within 1–4m",
      "Good baseline for interactive prototypes"
    ],
    notes: "Share observed metrics and UX notes (30s)."
  },
  {
    title: "Future Work",
    bullets: [
      "Multi-person support and selection logic",
      "ML-based gesture recognition",
      "Support newer depth sensors (Azure Kinect)"
    ],
    notes: "Short roadmap and possible extensions (30s)."
  },
  {
    title: "How to Run Locally",
    bullets: [
      "Prereqs: Windows, Kinect v2 drivers, Node.js",
      "`npm install` then `node server.js`",
      "Open `http://localhost:3000` in a browser"
    ],
    notes: "Walk techs through setup; point to files (60s)."
  },
  {
    title: "Code Highlights (Appendix)",
    bullets: [
      "Broadcast loop in `server.js`",
      "Client `socket.on('pose', ...)` and render loop",
      "See repo files for full implementation"
    ],
    notes: "Show short code examples during Q/A (60s)."
  },
  {
    title: "Closing & Q/A",
    bullets: [
      "Summary: Realtime Kinect2-driven web demo",
      "Call to action: try the demo and propose features",
      "Contact / repo link"
    ],
    notes: "Wrap up and invite questions (20-30s)."
  }
];

async function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.author = "Finalisti";
  pptx.company = "Finalisti";
  pptx.subject = "Kinekit — Kinect2 Interaction Demo";

  slides.forEach((s) => {
    const slide = pptx.addSlide();
    slide.addText(s.title, { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: "363636" });

    // Build bullet text as single block
    const bulletText = s.bullets.map((b) => "• " + b).join("\n\n");
    slide.addText(bulletText, { x: 0.5, y: 1.2, fontSize: 18, color: "444444", lineSpacing: 18, bullet: false, width: 9 });

    if (s.notes) {
      slide.addNotes(s.notes);
    }
  });

  const outPath = "presentation/Kinekit_Presentation.pptx";

  try {
    await pptx.writeFile({ fileName: outPath });
    console.log("Presentation created:", outPath);
  } catch (err) {
    console.error("Failed to create presentation:", err);
    process.exit(1);
  }
}

buildPptx();

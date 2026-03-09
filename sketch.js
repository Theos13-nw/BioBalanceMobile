// =========================================================
// BioBalance: Digestive System Explorer
// FINAL FIXED VERSION — All bugs resolved
// =========================================================
// HOW TO USE THIS FILE:
//   This is your COMPLETE sketch.js.
//   Replace your existing sketch.js entirely with this file.
//   Keep your /data/ folder (images + audio) exactly as-is.
// =========================================================

// ── AUDIO ─────────────────────────────────────────────────
let bgLoop, clickSfx, acidSfx, successSfx, spraySfx, dragSfx,
    warningSfx, reportSfx, denatureSfx, bounceSfx, nhe3Sfx,
    wrongSfx, correctSfx, swallowSfx, chewSfx;
let bgLoopStarted = false;

// ── AUDIO FLAGS ────────────────────────────────────────────
let cephalicSuccessPlayed = false;   // FIX: was missing from doc2 globals
let pepsinSuccessPlayed   = false;   // FIX: was missing from doc2 globals
let warningPlayed         = false;   // FIX: was missing from doc2 globals
let reportPlayed          = false;
let phase2ButtonSuccessPlayed = false;
let phase0ProceedSoundPlayed  = false;
let phase1ProceedSoundPlayed  = false;
let phase2ProceedSoundPlayed  = false;
let phase3ProceedSoundPlayed  = false;

// ── LICENSE ────────────────────────────────────────────────
let developer       = "Developed by Altheo Cardillo © 2026";
let creatorID       = "Theos_2026_DigestiveSystemApp";
let acceptedLicense = false;
let showLicenseScreen = true;

// ── MODE CONSTANTS ─────────────────────────────────────────
const MODE_TITLE     = 0;
const MODE_PHASE0    = 7;
const MODE_MECHANICS = 5;
const MODE_PHASE1    = 1;
const MODE_PHASE2    = 2;
const MODE_PHASE3    = 3;
const MODE_FINISH    = 6;
const MODE_JOURNEY   = 8;

// ── GLOBAL STATE ───────────────────────────────────────────
let mode     = MODE_TITLE;
let lastMode = MODE_TITLE;
let MEMBRANE_X;
let showOverlay  = false;
let overlayAlpha = 0;

// ── GRADIENT BUFFERS (performance) ────────────────────────
let bgGradientBuffer;
let reportGradientBuffer;
let lastBgColor1 = null;
let lastBgColor2 = null;      // FIX: was missing from doc2 globals
let needsGradientRedraw = true;

// ── PHASE 0 VARIABLES ─────────────────────────────────────
let smellSliderX;
let salivaLevel = 0;
let foodType    = 0;
let cephalicAcid  = 0;
let cephalicReady = false;
let delayedSmell  = 0;
let foodScale     = 0;
let isChewing   = false;
let hasSwallowed = false;
let cephalicTimer = 0;
let insulinLevel  = 0;
let hepaticGlucoseOutput    = 100;
let peripheralGlucoseUptake = 0;
let emeticTimer = 0;
const EMETIC_THRESHOLD = 60;

// ── PHASE 1 VARIABLES ─────────────────────────────────────
let stomachAcid   = 0;
let enzymeActive  = false;
let proteinScale  = 1.0;
let ulcerRisk     = 0;
let sliderX;
let sprayType     = 0;
let secretinLevel = 0, cckLevel = 0, decayRate = 0.55;
let homeostasisReached      = false;
let homeostasisJustReached  = false;
let homeostasisDisplayTimer = 0;
const HOMEOSTASIS_DISPLAY_FRAMES = 65;
let homeostasisLocked = false;
let phase1Complete    = false;
let hormoneMist = [];
let pepsinTimer = 0;

const PepsinState = { INACTIVE: 0, PARTIAL: 1, ACTIVE: 2, DENATURED: 3 };
let pepsinState        = PepsinState.INACTIVE;
let pepsinConcentration = 0;
let pepsinogenReserve   = 100;
let pepsinRestoredFlag  = false;

// ── PHASE 3 VARIABLES ─────────────────────────────────────
// FIX: glucoseX/Y, lipidX/Y, tGX/tGY/tLX/tLY now declared as proper globals
let glucoseX = 0, glucoseY = 0;
let lipidX   = 0, lipidY   = 0;
let tGX = 0, tGY = 0;
let tLX = 0, tLY = 0;

let sodiumSGLTX = 0, sodiumSGLTY = 0;
let sodiumNH3X  = 0, sodiumNH3Y  = 0;
let tSGLTX = 0, tSGLTY = 0;
let tNH3X  = 0, tNH3Y  = 0;

let draggingGlucose    = false;
let draggingSodiumSGLT = false;
let draggingSodiumNHE3 = false;
let draggingLipid      = false;

let glucoseSorted    = false;
let sodiumSGLTSorted = false;
let sodiumNHE3Sorted = false;
let lipidSorted      = false;

let gTimer = 0, sGLTTimer = 0, nhe3Timer = 0, lTimer = 0;
let capillaryPulse = 0, lactealPulse = 0, nhe3Pulse = 0;

let glucoseVX  = 0, glucoseVY  = 0;
let sodiumSGLTVX = 0, sodiumSGLTVY = 0;
let sodiumNH3VX  = 0, sodiumNH3VY  = 0;
let lipidVX    = 0, lipidVY    = 0;

let phase3ProceedDelay = 0;
const PHASE3_PROCEED_DELAY_FRAMES = 45;
let dragOffsetX = 0, dragOffsetY = 0;

// ── JOURNEY MAP ────────────────────────────────────────────
let phaseCompleted  = [false, false, false, false];
let phaseEfficiency = [0, 0, 0, 0];
let nodePulse       = [0, 0, 0, 0];
let connectionGlow  = 0;
let phaseNames     = ["BRAIN FOOD RESPONSE", "STOMACH ACID CONTROL", "HORMONE BALANCE", "NUTRIENT ABSORPTION"];
let phaseSubtitles = ["Cephalic Phase", "Gastric Phase", "Intestinal Phase", "Villi Transport"];
let phaseColors;   // initialised in preload() — needs p5 color() available
let selectedPhase = -1;

// ── CONTROL PROTOCOL ──────────────────────────────────────
let protocolParticles = [];
let currentCard = 0;
let totalCards  = 4;
let cardTitles  = ["OBJECTIVE", "CONTROLS", "FEEDBACK", "TIPS"];
let cardContent = [
  ["Your goal is to complete the digestive", "journey! Each phase shows a different",
   "part of how your body breaks down food.", "Control what happens at each step and",
   "keep your body in balance."],
  ["Touch and drag nutrients to the correct", "zones. Press hormone buttons to balance",
   "acid levels. Use the NEXT button to move", "forward when each phase is complete.",
   "Pay attention to timing!"],
  ["Watch the progress bars for each phase.", "Glowing green means success, shaking or",
   "red means danger. Your timing and accuracy", "are tracked. Keep indicators in the green",
   "zone for the best results."],
  ["Try different things and explore!", "There is no single perfect answer.",
   "Replay phases to improve your score", "and discover new reactions.",
   "Learn from each attempt."]
];

// ── REPORT ─────────────────────────────────────────────────
let currentReportSlide = 0;
let reportParticles    = [];
let reportContent;

// ── QUIZ / REFLECTION GATE ─────────────────────────────────
let quizState        = 0;
let quizSubState     = 0;
let currentQuizPhase = 0;
let phaseBank        = [];
let questionOrder    = [0, 1, 2, 3, 4];
let answerOrder      = [0, 1, 2];
let currentQuestionIdx = 0;
let score        = 0;
let feedbackMsg  = "";
let feedbackTimer = 0;
let gateJustCompleted = false;    // FIX: was missing from doc2 globals
let phaseAttempts     = [0, 0, 0, 0];
let gateAttemptsCount = [0, 0, 0, 0];
let firstTrySuccess   = [false, false, false, false];
let wrongAnswers      = [];

// ── ASSETS ─────────────────────────────────────────────────
let stomachImg, intestineImg, glucoseImg, sodiumImg, proteinImg, lipidImg, villusImg;
let headImg, deliciousImg, spoiledImg;
let hormone1Img, hormone2Img, glucoseZoneImg, sodiumZoneImg;

// ── PARTICLE SYSTEMS ───────────────────────────────────────
let phase0Particles  = [];
let phase1Particles  = [];
let phase2Particles  = [];
let phase3Particles  = [];
let aromaParticles   = [];
let acidBubbles      = [];
let successParticles = [];

// ── CINEMATIC ─────────────────────────────────────────────
let transitionAlpha = 0;
let organPulse      = 1.0;
let shakeIntensity  = 0;

// ── MOBILE SCALING ────────────────────────────────────────
const GAME_W = 1280;   // virtual canvas width
const GAME_H = 720;    // virtual canvas height
let scaleF  = 1;       // scale factor (< 1 on small screens)
let offsetX = 0;       // left letterbox offset
let offsetY = 0;       // top  letterbox offset
let previousTime = 0;  // millis() at last frame
let dt = 1;            // delta/16.666 — 1.0 at 60fps, 0.5 at 120fps, 2.0 at 30fps
let delta = 16.666;    // raw ms since last frame (for spawn timers)
let realFPS = 60;      // measured fps for debug display
let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ── TOUCH/DRAG STATE ──────────────────────────────────────
let isDraggingSmellSlider = false;
let isDraggingPHSlider    = false;

// ── SPAWN TIMERS (time-based, replaces frameCount %) ──────
let aromaSpawnTimer  = 0;   // ms accumulator for aroma particles
let bubbleSpawnTimer = 0;   // ms accumulator for acid bubbles
let successSpawnTimer = 0;  // ms accumulator for success particles

// =========================================================
// PRELOAD
// =========================================================
function preload() {
  // phaseColors uses p5 color arrays — safe here as preload runs after p5 init
  phaseColors = [
    [0, 255, 200],
    [255, 100, 100],
    [100, 150, 255],
    [255, 200, 50]
  ];

  reportContent = [
    ["PHASE 0 — Your Brain Prepares for Food", "",
     "Your digestive system started before you",
     "even took a bite! The smell and sight of",
     "food sent a signal through the vagus nerve",
     "to your stomach, triggering saliva and",
     "getting your body ready. This is called",
     "the cephalic phase — your brain literally",
     "starts digestion for you!"],
    ["PHASE 1 — Stomach Acid and Enzyme Activity", "",
     "Protein digestion happened successfully",
     "in the stomach. Stomach acid unfolded the",
     "protein structure (denaturation), allowing",
     "pepsin to break it into smaller pieces.",
     "The stomach wall was protected by its",
     "mucus lining, and churning helped mix",
     "everything together."],
    ["PHASE 2 — Balancing Acid in the Small Intestine", "",
     "The stomach acid was neutralized as it",
     "entered the small intestine. The hormone",
     "Secretin triggered bicarbonate to reduce",
     "the acid, while CCK released bile and",
     "enzymes to digest fats. Both hormones",
     "worked together to create the right",
     "environment for nutrient absorption."],
    ["PHASE 3 — Nutrient Absorption Through the Villi", "",
     "Digested nutrients were absorbed through",
     "tiny finger-like structures called villi.",
     "Glucose and sodium entered the bloodstream,",
     "while fats were packaged and sent through",
     "the lymph vessel (lacteal). The digestive",
     "journey is complete — all nutrients",
     "reached where they needed to go!"]
  ];

  stomachImg    = loadImage("data/stomach.png");
  proteinImg    = loadImage("data/protein.png");
  intestineImg  = loadImage("data/intestine.png");
  hormone1Img   = loadImage("data/hormone1.png");
  hormone2Img   = loadImage("data/hormone2.png");
  villusImg     = loadImage("data/villi.png");
  glucoseImg    = loadImage("data/glucose.png");
  sodiumImg     = loadImage("data/sodium.png");
  lipidImg      = loadImage("data/lipid.png");
  glucoseZoneImg = loadImage("data/glucoseZone.png");
  sodiumZoneImg  = loadImage("data/sodiumZone.png");
  headImg       = loadImage("data/head.png");
  deliciousImg  = loadImage("data/deliciousfood.png");
  spoiledImg    = loadImage("data/spoiledfood.png");

  bgLoop      = loadSound("data/bgloop.mp3");
  clickSfx    = loadSound("data/click.wav");
  acidSfx     = loadSound("data/acid.wav");
  successSfx  = loadSound("data/success.wav");
  spraySfx    = loadSound("data/spray.wav");
  dragSfx     = loadSound("data/drag.wav");
  warningSfx  = loadSound("data/warning.wav");
  reportSfx   = loadSound("data/report.wav");
  denatureSfx = loadSound("data/denature.wav");
  bounceSfx   = loadSound("data/bounce.wav");
  nhe3Sfx     = loadSound("data/nhe3.wav");
  wrongSfx    = loadSound("data/wrong.wav");
  correctSfx  = loadSound("data/correct.wav");
  swallowSfx  = loadSound("data/swallow.wav");
  chewSfx     = loadSound("data/chew.wav");
}

// =========================================================
// SETUP
// =========================================================
function setup() {
  pixelDensity(1);      // Prevents blur issues and GPU overload on mobile
  createCanvas(windowWidth, windowHeight);
  frameRate(60);        // Request 60fps cap — dt handles actual speed regardless
  imageMode(CENTER);
  rectMode(CENTER);
  _calcScale();

  previousTime = millis(); // Initialise for millis()-based dt

  bgGradientBuffer     = createGraphics(GAME_W, GAME_H);
  reportGradientBuffer = createGraphics(GAME_W, GAME_H);
  updateReportGradientBuffer(reportGradientBuffer);

  MEMBRANE_X   = GAME_W / 2;
  sliderX      = GAME_W / 2 - 150;
  smellSliderX = GAME_W / 2 - 200;
  resetNutrientPositions();

  for (let i = 0; i < 30; i++) {
    let p = new ProtocolParticle();
    p.y = random(GAME_H);
    protocolParticles.push(p);
  }
  for (let i = 0; i < 50; i++) {
    let p = new ReportParticle();
    p.y = random(GAME_H);
    reportParticles.push(p);
  }
}

function _calcScale() {
  // Uniform scale — fit whichever dimension is tighter
  // No stretching ever. Small bars on one axis are fine.
  scaleF  = min(windowWidth / GAME_W, windowHeight / GAME_H);
  offsetX = (windowWidth  - GAME_W * scaleF) / 2;
  offsetY = (windowHeight - GAME_H * scaleF) / 2;
}

// =========================================================
// TOUCH HELPERS — translates screen coords → game coords
// =========================================================
function getInputX() {
  let sx = touches.length > 0 ? touches[0].x : mouseX;
  return (sx - offsetX) / scaleF;
}
function getInputY() {
  let sy = touches.length > 0 ? touches[0].y : mouseY;
  return (sy - offsetY) / scaleF;
}

// =========================================================
// CLASSES
// =========================================================
class PhaseParticle {
  constructor(col) {
    this.x = random(GAME_W);  this.y = random(GAME_H);
    this.vx = random(-0.2, 0.2);  this.vy = random(-0.2, 0.2);
    this.size = random(2, 6);  this.alpha = random(15, 40);
    this.c = col;
    this.pulseSpeed  = random(0.01, 0.03);
    this.pulseOffset = random(TWO_PI);
  }
  update() {
    this.x += this.vx * dt;  this.y += this.vy * dt;
    if (this.x < -10)          this.x = GAME_W + 10;
    if (this.x > GAME_W + 10)   this.x = -10;
    if (this.y < -10)          this.y = GAME_H + 10;
    if (this.y > GAME_H + 10)  this.y = -10;
    if (random(1) < 0.3 * dt) {
      this.vx += random(-0.05, 0.05);  this.vy += random(-0.05, 0.05);
      this.vx = constrain(this.vx, -0.3, 0.3);
      this.vy = constrain(this.vy, -0.3, 0.3);
    }
    this.alpha = 25 + sin(millis() * this.pulseSpeed * 0.06 + this.pulseOffset) * 15;
  }
  display() {
    noStroke();
    fill(this.c[0], this.c[1], this.c[2], this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
    fill(this.c[0], this.c[1], this.c[2], this.alpha * 0.2);
    ellipse(this.x, this.y, this.size * 1.5, this.size * 1.5);
  }
}

class AromaParticle {
  constructor(x, y) {
    this.x = x;  this.y = y;
    this.vx    = random(-1.5, -2.5);  this.vy = random(-0.8, -1.5);
    this.alpha = random(25, 50);      this.size = random(3, 6);
  }
  update(targetX, targetY) {
    let dx = targetX - this.x,  dy = targetY - this.y;
    let d  = sqrt(dx * dx + dy * dy);
    if (d > 30) { this.x += ((dx / d) * 2.5 + this.vx * 0.25) * dt;
                  this.y += ((dy / d) * 2.5 + this.vy * 0.25) * dt; }
    else { this.alpha -= 1.5 * dt; }
    this.alpha -= 0.2 * dt;
  }
  display(c) {
    noStroke();
    fill(c[0], c[1], c[2], this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class ProtocolParticle {
  constructor() {
    this.x = random(GAME_W);  this.y = GAME_H + 20;
    this.vy = random(0.5, 2);  this.alpha = random(50, 150);
    this.size = random(2, 6);
  }
  update() {
    this.y -= this.vy * dt;
    if (this.y < -20) { this.y = GAME_H + 20;  this.x = random(GAME_W); }
    this.alpha = 100 + sin(millis() * 0.003 + this.x * 0.01) * 50;
  }
  display() {
    noStroke();  fill(0, 255, 200, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class ReportParticle {
  constructor() {
    this.x = random(GAME_W);  this.y = GAME_H + random(10, 100);
    this.vy = random(0.3, 1.2);  this.alpha = random(50, 150);
    this.size = random(3, 8);
  }
  update() {
    this.y -= this.vy * dt;
    if (this.y < -20) { this.y = GAME_H + 20;  this.x = random(GAME_W); }
    this.alpha = 80 + sin(millis() * 0.0018 + this.x * 0.01) * 40;
  }
  display() {
    noStroke();  fill(112, 240, 240, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class SuccessParticle {
  constructor(x, y, c) {
    this.x = x;  this.y = y;
    this.vx = random(-5, 5);  this.vy = random(-8, -3);
    this.alpha = 255;  this.size = random(4, 12);
    // FIX: c must always be a plain array [r,g,b] — never a p5 color() object
    // because display() indexes it as this.c[0], this.c[1], this.c[2]
    this.c = Array.isArray(c) ? c : [red(c), green(c), blue(c)];
  }
  update() {
    this.x += this.vx * dt;  this.y += this.vy * dt;
    this.vy += 0.2 * dt;    this.alpha -= 3 * dt;  this.size *= pow(0.98, dt);
  }
  display() {
    noStroke();
    fill(this.c[0], this.c[1], this.c[2], this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
  isDead() { return this.alpha <= 0; }
}

class Mist {
  constructor(x, y, vx, vy, c) {
    this.x = x;  this.y = y;  this.vx = vx;  this.vy = vy;  this.c = c;
    this.alpha = 200;  this.size = random(3, 10);
  }
  update() { this.x += this.vx * dt;  this.y += this.vy * dt;  this.alpha = lerp(this.alpha, 0, 1 - pow(1 - 0.15, dt)); }
  display() {
    noStroke();
    fill(this.c[0], this.c[1], this.c[2], this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class Bubble {
  constructor(x, y, size, speed, c) {
    this.x = x;  this.y = y;  this.size = size;  this.speed = speed;  this.c = c;
  }
  update() { this.y -= this.speed * dt;  this.x += sin(millis() * 0.006) * 0.5 * dt; }
  display() {
    // FIX: honour alpha channel when present
    let a = (this.c.length >= 4) ? this.c[3] : 255;
    fill(this.c[0], this.c[1], this.c[2], a);
    noStroke();
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class Question {
  constructor(q, c, correct) {
    this.question     = q;
    this.choices      = c;
    this.correctIndex = correct;
  }
}

// =========================================================
// GRADIENT BUFFER HELPERS
// =========================================================
function updateGradientBuffer(buffer, c1, c2) {
  buffer.noFill();
  for (let i = 0; i <= buffer.height; i++) {
    let c = lerpColor(c1, c2, map(i, 0, buffer.height, 0, 1));
    buffer.stroke(c);
    buffer.line(0, i, buffer.width, i);
  }
}

// FIX: "let let y" syntax error corrected
function updateReportGradientBuffer(buffer) {
  let topColor = color(10, 15, 30);
  let midColor = color(25, 166, 166);
  let botColor = color(112, 240, 240);
  buffer.noFill();
  for (let y = 0; y < buffer.height; y++) {
    let c = (y < buffer.height / 2)
      ? lerpColor(topColor, midColor, map(y, 0, buffer.height / 2, 0, 1))
      : lerpColor(midColor, botColor, map(y, buffer.height / 2, buffer.height, 0, 1));
    buffer.stroke(c);
    buffer.line(0, y, buffer.width, y);
  }
}

// FIX: animated states use solid bg — no gradient buffer thrash every frame
function _drawBackground(bgColor1, bgColor2) {
  let isAnimating =
    (mode === MODE_PHASE1 && ulcerRisk > 100) ||
    (mode === MODE_PHASE0 && foodType === 2 && emeticTimer >= EMETIC_THRESHOLD);

  if (isAnimating) {
    background(bgColor1);
  } else {
    let changed =
      needsGradientRedraw || !lastBgColor1 ||
      Math.round(red(bgColor1))   !== Math.round(red(lastBgColor1))   ||
      Math.round(green(bgColor1)) !== Math.round(green(lastBgColor1)) ||
      Math.round(blue(bgColor1))  !== Math.round(blue(lastBgColor1));
    if (changed) {
      updateGradientBuffer(bgGradientBuffer, bgColor1, bgColor2);
      lastBgColor1 = bgColor1;
      lastBgColor2 = bgColor2;
      needsGradientRedraw = false;
    }
    image(bgGradientBuffer, GAME_W / 2, GAME_H / 2);
  }
}

// =========================================================
// PHASE PARTICLE MANAGEMENT
// =========================================================
function initPhaseParticles(phaseIdx) {
  let map2 = [phase0Particles, phase1Particles, phase2Particles, phase3Particles];
  if (phaseIdx < 0 || phaseIdx > 3) return;
  map2[phaseIdx].length = 0;
  for (let i = 0; i < 25; i++) map2[phaseIdx].push(new PhaseParticle(phaseColors[phaseIdx]));
}

function updateAndDrawPhaseParticles(phaseIdx) {
  let map2 = [phase0Particles, phase1Particles, phase2Particles, phase3Particles];
  if (phaseIdx < 0 || phaseIdx > 3) return;
  for (let p of map2[phaseIdx]) { p.update();  p.display(); }
}

// =========================================================
// DRAW LOOP
// =========================================================
function draw() {
  // ── True millis-based delta time ─────────────────────────
  let now = millis();
  let rawDelta = now - previousTime; // ms since last frame
  previousTime = now;
  delta = min(rawDelta, 50);         // cap at 50ms; also used by spawn timers globally
  dt = delta / 16.666;               // 1.0 at 60fps, 0.5 at 120fps, 2.0 at 30fps
  realFPS = 1000 / max(rawDelta, 1);

  // ── Landscape lock ───────────────────────────────────────
  if (windowWidth < windowHeight) {
    background(5, 15, 35);
    fill(0, 255, 200);  textSize(24);  textAlign(CENTER, CENTER);
    text("Please rotate your device to landscape", width / 2, height / 2);
    return;
  }

  // ── Virtual canvas ───────────────────────────────────────
  background(0);
  push();
  translate(offsetX, offsetY);
  scale(scaleF);

  if (showLicenseScreen) { drawLicenseScreen(); pop(); return; }
  if (quizState === 1)   { drawReflectionGate(); pop(); return; }
  drawSimulationLoop();
  drawPersistentReturnButton();
  if (mode !== MODE_TITLE && !showLicenseScreen) drawFooter();

  // ── FPS debug display (remove after testing) ─────────────
  fill(255, 220, 0, 200);  noStroke();  textSize(18);  textAlign(LEFT, TOP);
  text("FPS: " + nf(realFPS, 1, 0), 10, 10);

  pop();
}

function drawSimulationLoop() {
  if (bgLoop != null && !bgLoopStarted && !bgLoop.isPlaying()) {
    bgLoop.loop();  bgLoop.setVolume(0.05);  bgLoopStarted = true;
  }

  // dt is already computed in draw() — no recalculation needed here

  transitionAlpha = lerp(transitionAlpha, 255, 1 - pow(1 - 0.08, dt));
  organPulse      = 1.0 + sin(millis() * 0.003) * 0.015;
  connectionGlow  = (sin(millis() * 0.003) + 1) / 2.0;

  let shakeX = 0, shakeY = 0;
  let isShaking =
    (mode === MODE_PHASE1 && ulcerRisk > 100) ||
    (mode === MODE_PHASE0 && foodType === 2 && emeticTimer >= EMETIC_THRESHOLD);
  if (isShaking) {
    shakeIntensity = lerp(shakeIntensity, map(delayedSmell, 0, 100, 0.5, 4.0), 1 - pow(1 - 0.1, dt));
    shakeX = random(-shakeIntensity, shakeIntensity);
    shakeY = random(-shakeIntensity, shakeIntensity);
  } else {
    shakeIntensity = lerp(shakeIntensity, 0, 1 - pow(1 - 0.2, dt));
  }

  push();
  translate(shakeX, shakeY);

  let bgColor1 = color(10, 15, 30);
  if (mode === MODE_PHASE1 && ulcerRisk > 100) {
    bgColor1 = lerpColor(color(10, 15, 30), color(50, 10, 10), (sin(millis() * 0.006) + 1) / 2.0);
  } else if (mode === MODE_PHASE0 && foodType === 2 && emeticTimer >= EMETIC_THRESHOLD) {
    bgColor1 = lerpColor(color(10, 15, 30), color(25, 60, 25),
                         map(delayedSmell, 0, 100, 0, 1.0));
  } else if (mode === MODE_JOURNEY || mode === MODE_MECHANICS || mode === MODE_TITLE) {
    bgColor1 = color(5, 15, 35);
  }
  _drawBackground(bgColor1, color(25, 40, 65));

  tint(255, transitionAlpha);
  switch (mode) {
    case MODE_TITLE:     drawTitleScreen();     break;
    case MODE_MECHANICS: drawControlProtocol(); break;
    case MODE_JOURNEY:   drawJourneyMap();      break;
    case MODE_PHASE0:    phase0();              break;
    case MODE_PHASE1:    phase1();              break;
    case MODE_PHASE2:    phase2();              break;
    case MODE_PHASE3:    phase3();              break;
    case MODE_FINISH:    drawFinalReport();     break;
  }
  noTint();

  if (showOverlay) overlayAlpha = lerp(overlayAlpha, 255, 1 - pow(1 - 0.2, dt));
  else             overlayAlpha = lerp(overlayAlpha, 0, 1 - pow(1 - 0.3, dt));
  if (overlayAlpha > 1) {
    fill(0, map(overlayAlpha, 0, 255, 0, 235));
    rect(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);
  }
  pop();
}

// =========================================================
// PHASE 0 — CEPHALIC PHASE
// =========================================================
function phase0() {
  updateAndDrawPhaseParticles(0);
  drawPhaseTitle("PHASE 0 — YOUR BRAIN PREPARES FOR FOOD", 50);

  let foodX = GAME_W * 0.85, foodY = GAME_H / 2 + 20;
  let emissionX = foodX - 60, emissionY = foodY - 40;
  let headX = GAME_W * 0.35, headY = GAME_H / 2 - 40;

  updateCephalicMetabolismFast();

  if (foodType > 0) {
    // Time-based spawn: spawnRate 10→2 frames at 60fps = 167ms→33ms interval
    let spawnIntervalMs = map(delayedSmell, 0, 100, 167, 33);
    aromaSpawnTimer += delta;  // dt*16.667 = ms per frame
    if (aromaSpawnTimer >= spawnIntervalMs) {
      aromaSpawnTimer = 0;
      let cnt = int(map(delayedSmell, 0, 100, 1, 3));
      for (let i = 0; i < cnt; i++)
        aromaParticles.push(new AromaParticle(emissionX - random(0, 40), emissionY + random(-20, 20)));
    }
  }

  for (let i = aromaParticles.length - 1; i >= 0; i--) {
    let p = aromaParticles[i];
    p.update(headX, headY);
    p.display(foodType === 1 ? [245, 230, 180] : [150, 200, 100]);
    if (p.alpha <= 0) aromaParticles.splice(i, 1);
  }

  if (headImg != null) {
    push();
    translate(headX, headY);
    scale(organPulse);
    if (foodType === 1 && insulinLevel > 10) {
      let g = map(insulinLevel, 0, 50, 50, 180);
      fill(255, 100, 150, g + sin(millis() * 0.006) * 40);  noStroke();
      ellipse(0, -20, 160, 140);
      fill(255, 150, 200, g * 0.6);
      ellipse(0, -20, 100, 90);
    }
    if (foodType === 1 && salivaLevel > 150) {
      fill(0, 255, 200, 50 + sin(millis() * 0.006) * 50);  noStroke();
      ellipse(0, -50, 120, 100);
    }
    if (foodType === 2 && emeticTimer >= EMETIC_THRESHOLD) {
      tint(map(delayedSmell, 0, 100, 255, 180), 255, map(delayedSmell, 0, 100, 255, 180), transitionAlpha);
    }
    image(headImg, 0, 0, 480, 480);
    noTint();
    pop();
  }

  if (foodType > 0) {
    foodScale = lerp(foodScale, 1.0, 1 - pow(1 - 0.15, dt));
    push();
    translate(foodX, foodY);
    scale(foodScale);
    if (foodType === 1 && deliciousImg != null) image(deliciousImg, 0, 0, 280, 200);
    else if (foodType === 2 && spoiledImg != null) image(spoiledImg, 0, 0, 280, 200);
    pop();
  }

  let sStart = GAME_W / 2 - 200, sEnd = GAME_W / 2 + 200, sliderY = GAME_H - 150;

  // FIX: update smellSliderX position while dragging
  if (isDraggingSmellSlider)
    smellSliderX = constrain(getInputX(), sStart, sEnd);

  let inputSmell = map(smellSliderX, sStart, sEnd, 0, 100);
  delayedSmell = lerp(delayedSmell, inputSmell, 1 - pow(1 - 0.015, dt));

  if (foodType === 1) {
    salivaLevel = lerp(salivaLevel, map(inputSmell, 0, 100, 40, 170), 1 - pow(1 - 0.02, dt));
    if (salivaLevel > 168 && inputSmell >= 99) salivaLevel = 170;
    cephalicAcid = lerp(cephalicAcid, map(delayedSmell, 0, 100, 0, 150), 1 - pow(1 - 0.01, dt));
  } else if (foodType === 2) {
    salivaLevel  = lerp(salivaLevel, 5, 1 - pow(1 - 0.02, dt));
    cephalicAcid = lerp(cephalicAcid, 0, 1 - pow(1 - 0.1, dt));
  }

  let metabolismReady   = (insulinLevel > 20 && hepaticGlucoseOutput < 60);
  let inActivationWindow = (foodType === 1 && inputSmell >= 99 &&
                            salivaLevel >= 170 && metabolismReady && !hasSwallowed);
  cephalicTimer = inActivationWindow ? min(60, cephalicTimer + dt) : 0;
  let cephalicActive = (cephalicTimer >= 60);

  let guideY = 90, buttonY = 130;
  let p0Text = "", p0Color = color(255);

  if (hasSwallowed) {
    p0Text  = "FOOD SWALLOWED — READY TO CONTINUE!";
    p0Color = color(0, 255, 150);
    if (!phase0ProceedSoundPlayed) { if (successSfx) successSfx.play();  phase0ProceedSoundPlayed = true; }
    drawProceedButton(GAME_W / 2, buttonY);
  } else if (isChewing) {
    p0Text  = "CHEWING: BREAKING DOWN YOUR FOOD!";
    p0Color = color(255, 200, 0);
    drawNextButton(GAME_W / 2, buttonY, "SWALLOW");
  } else if (foodType === 1 && cephalicActive) {
    cephalicReady = true;
    p0Text  = "BRAIN SIGNAL SENT — VAGUS NERVE ACTIVATED!";
    p0Color = color(0, 255, 150, 150 + sin(millis() * 0.012) * 105);
  } else if (foodType === 1 && inputSmell >= 99 && salivaLevel >= 170 && !metabolismReady) {
    cephalicReady = false;
    p0Text = "SALIVA READY — YOUR BODY IS GETTING READY...";  p0Color = color(255, 200, 0);
  } else if (foodType === 1 && inputSmell >= 99 && salivaLevel < 170) {
    cephalicReady = false;
    p0Text = "SALIVA IS BUILDING UP — KEEP THE SCENT HIGH!";  p0Color = color(255, 255, 0);
  } else if (foodType === 1 && inputSmell >= 99) {
    cephalicReady = false;  p0Text = "GETTING READY...";  p0Color = color(200);
  } else if (foodType === 1) {
    cephalicReady = false;
    p0Text = "SMELL THE FOOD: MOVE THE SCENT SLIDER TO START!";  p0Color = color(200);
  } else if (foodType === 2) {
    cephalicReady = false;
    if (inputSmell >= 60) emeticTimer = min(EMETIC_THRESHOLD, emeticTimer + dt);
    else                  emeticTimer = max(0, emeticTimer - 2 * dt);
    if (emeticTimer >= EMETIC_THRESHOLD) { if (warningSfx && !warningSfx.isPlaying()) warningSfx.play(); }
    else                                  { if (warningSfx && warningSfx.isPlaying())  warningSfx.stop(); }
    if      (delayedSmell < 30)              p0Text = "SOMETHING SMELLS ODD...";
    else if (delayedSmell < 60)              p0Text = "SOMETHING SMELLS BAD — BODY IS REJECTING IT!";
    else if (emeticTimer >= EMETIC_THRESHOLD) p0Text = "SPOILED FOOD DETECTED — NAUSEA RESPONSE TRIGGERED!";
    else                                      p0Text = "SMELL GETTING WORSE — REJECTION INTENSIFYING...";
    p0Color = color(255, 50, 50);
  } else {
    cephalicReady = false;  p0Text = "SELECT A FOOD TYPE TO BEGIN";  p0Color = color(200);
  }

  fill(p0Color);  textStyle(BOLD);  textAlign(CENTER);  textSize(20);
  text(p0Text, GAME_W / 2, guideY);  textStyle(NORMAL);

  if (!hasSwallowed && cephalicReady && !isChewing)
    drawNextButton(GAME_W / 2, buttonY, "CHEW FOOD");

  drawMetabolicPanelWithSaliva(160, GAME_H / 2);

  stroke(0, 255, 200);  strokeWeight(4);
  line(sStart, sliderY, sEnd, sliderY);
  fill(0, 255, 200);
  ellipse(smellSliderX, sliderY, 30, 30);
  fill(255);  textSize(16);
  textAlign(RIGHT);  text("FAINT",  sStart - 20, sliderY + 7);
  textAlign(LEFT);   text("STRONG", sEnd   + 20, sliderY + 7);
  textAlign(CENTER);
  text("SCENT CONCENTRATION: " + int(inputSmell) + "%", GAME_W / 2, sliderY + 45);

  drawPhase0Button(GAME_W / 2 - 110, sliderY + 90, "DELICIOUS FOOD", 1);
  drawPhase0Button(GAME_W / 2 + 110, sliderY + 90, "SPOILED FOOD",   2);
}

function updateCephalicMetabolismFast() {
  if (foodType === 1) {
    let cal = map(delayedSmell, 0, 100, 0, 500);
    insulinLevel            = lerp(insulinLevel, cal * 0.08, 1 - pow(1 - 0.05, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, max(20, 100 - insulinLevel * 1.5), 1 - pow(1 - 0.03, dt));
    peripheralGlucoseUptake = map(insulinLevel, 0, 40, 0, 100);
  } else if (foodType === 2) {
    insulinLevel            = lerp(insulinLevel, 0, 1 - pow(1 - 0.1, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, 150, 1 - pow(1 - 0.05, dt));
    peripheralGlucoseUptake = lerp(peripheralGlucoseUptake, 0, 1 - pow(1 - 0.1, dt));
  } else {
    insulinLevel            = lerp(insulinLevel, 0, 1 - pow(1 - 0.05, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, 100, 1 - pow(1 - 0.02, dt));
    peripheralGlucoseUptake = lerp(peripheralGlucoseUptake, 0, 1 - pow(1 - 0.05, dt));
  }
}

function drawMetabolicPanelWithSaliva(x, y) {
  fill(20, 30, 50, 220);  stroke(255, 150);  strokeWeight(2);
  rect(x, y, 280, 280, 15);

  fill(0, 255, 200);  textStyle(BOLD);  textSize(16);  textAlign(CENTER);
  text("BODY PREP STATUS", x, y - 118);  textStyle(NORMAL);

  // Saliva bar
  fill(30, 40, 60);  rect(x, y - 60, 240, 40, 5);
  let sw = map(salivaLevel, 0, 170, 0, 240);
  fill(0, 200, 255);  rect(x - 120 + sw / 2, y - 60, sw, 40, 5);
  if (salivaLevel >= 170) {
    stroke(0, 255, 255, 100 + (sin(millis() * 0.006) + 1) / 2.0 * 155);
    strokeWeight(3);  noFill();  rect(x, y - 60, 240, 40, 5);  noStroke();
  }
  fill(0, 255, 255);  textStyle(BOLD);  textSize(12);  text("SALIVA", x, y - 85);  textStyle(NORMAL);

  // Insulin bar
  fill(30, 40, 60);  rect(x, y - 10, 240, 20, 5);
  fill(255, 100, 150);  rect(x - 120 + map(insulinLevel, 0, 50, 0, 240) / 2, y - 10, map(insulinLevel, 0, 50, 0, 240), 20, 5);
  fill(255);  textSize(10);  text("INSULIN LEVEL: " + nf(insulinLevel, 0, 1), x, y - 25);

  // Liver glucose bar
  fill(30, 40, 60);  rect(x, y + 35, 240, 20, 5);
  let hw = map(hepaticGlucoseOutput, 0, 150, 240, 0);
  fill(hepaticGlucoseOutput < 60 ? color(0, 255, 150) : hepaticGlucoseOutput < 100 ? color(255, 255, 0) : color(255, 100, 100));
  rect(x - 120 + hw / 2, y + 35, hw, 20, 5);
  fill(255);  text("LIVER GLUCOSE: " + nf(hepaticGlucoseOutput, 0, 1) + "%", x, y + 20);

  // Uptake bar
  fill(30, 40, 60);  rect(x, y + 80, 240, 20, 5);
  let pu = map(peripheralGlucoseUptake, 0, 100, 0, 240);
  fill(100, 255, 200);  rect(x - 120 + pu / 2, y + 80, pu, 20, 5);
  fill(255);  text("BODY CELLS ABSORBING: " + nf(peripheralGlucoseUptake, 0, 1) + "%", x, y + 65);

  let ready = (insulinLevel > 20 && hepaticGlucoseOutput < 60);
  textStyle(BOLD);  textSize(13);
  if      (salivaLevel >= 170 && ready)  { fill(0, 255, 150);  text("READY!", x, y + 120); }
  else if (salivaLevel >= 170)           { fill(255, 200, 0);  text("YOUR BODY IS GETTING READY", x, y + 120); }
  else                                   { fill(255, 200, 0);  text("BUILDING UP — WAIT...", x, y + 120); }
  textStyle(NORMAL);
}

function drawPhase0Button(x, y, label, type) {
  let hover = (getInputX() > x - 90 && getInputX() < x + 90 && getInputY() > y - 25 && getInputY() < y + 25);
  stroke(foodType === type ? color(0, 255, 200) : 150);  strokeWeight(2);
  fill(foodType === type ? color(0, 80, 80) : hover ? 60 : 30);
  rect(x, y, 180, 50, 5);
  fill(foodType === type ? 255 : 200);
  textAlign(CENTER, CENTER);  textSize(16);  text(label, x, y - 3);
}

// =========================================================
// PHASE 1 — GASTRIC PHASE
// =========================================================
function phase1() {
  updateAndDrawPhaseParticles(1);
  drawPhaseTitle("PHASE 1 — STOMACH ACID & ENZYME ACTIVITY", 50);

  let sliderY = GAME_H - 110, sliderStart = GAME_W / 2 - 150, sliderEnd = GAME_W / 2 + 150;
  if (!phase1Complete && isDraggingPHSlider)
    sliderX = constrain(getInputX(), sliderStart, sliderEnd);

  let currentPH = map(sliderX, sliderStart, sliderEnd, 7.0, 1.0);
  stomachAcid = map(currentPH, 7.0, 1.0, 0, 255);
  ulcerRisk   = (currentPH < 1.5) ? min(110, ulcerRisk + 2*dt) : max(0, ulcerRisk - 10*dt);

  let inPHWindow = (currentPH >= 1.5 && currentPH <= 3.0);
  pepsinTimer = inPHWindow ? min(60, pepsinTimer + dt) : 0;

  enzymeActive = (pepsinTimer >= 60 && pepsinState === PepsinState.ACTIVE);
  updatePepsinDenaturation(currentPH, inPHWindow);

  if (stomachImg != null) {
    push();  translate(GAME_W / 2, GAME_H / 2);  scale(organPulse);
    if (ulcerRisk > 100) tint(255, 100, 100, transitionAlpha);
    image(stomachImg, 0, 0, 650, 550);  noTint();  pop();
  }

  let pX = GAME_W / 2 + 110, pY = GAME_H / 2 + 40;
  if (enzymeActive && acidSfx != null && !acidSfx.isPlaying()) acidSfx.play();

  if (proteinImg != null) {
    let pAlpha = enzymeActive ? map(proteinScale, 1.0, 0.0, 255, 0) : 200;
    if (enzymeActive) proteinScale = max(0.0, proteinScale - 0.005*dt);
    else if (proteinScale < 1.0 && pepsinState !== PepsinState.ACTIVE)
      proteinScale = min(1.0, proteinScale + 0.02);
    if (proteinScale > 0.01 && pAlpha > 1) {
      push();  translate(pX, pY);  scale(proteinScale);
      tint(255, pAlpha, transitionAlpha);  image(proteinImg, 0, 0, 140, 140);  noTint();  pop();
    }
  }

  // Bubble spawn: every 5 frames at 60fps = every 83ms
  bubbleSpawnTimer += delta;
  if (enzymeActive && bubbleSpawnTimer >= 83) {
    bubbleSpawnTimer = 0;
    acidBubbles.push(new Bubble(pX + random(-60, 60), pY + 80, random(6, 14), random(1, 5), [180, 255, 0, 180]));
  }
  for (let i = acidBubbles.length - 1; i >= 0; i--) {
    acidBubbles[i].update();  acidBubbles[i].display();
    if (acidBubbles[i].y < pY - 100) acidBubbles.splice(i, 1);
  }

  drawPepsinPanelBig(GAME_W - 140, GAME_H / 2, currentPH, inPHWindow, enzymeActive);

  let phC = lerpColor(color(0, 150, 255), color(255, 0, 0), map(currentPH, 7, 1, 0, 1));
  stroke(255, 150);  strokeWeight(4);
  line(sliderStart, sliderY, sliderEnd, sliderY);
  fill(phC);  noStroke();  ellipse(sliderX, sliderY, 32, 32);
  fill(255);  textSize(16);  textAlign(CENTER);
  text("STOMACH pH CONTROL (ACIDITY LEVEL)", GAME_W / 2, sliderY + 45);
  textAlign(RIGHT);  text("NEUTRAL (7.0)", sliderStart - 20, sliderY + 7);
  textAlign(LEFT);   text("ACIDIC (1.0)",  sliderEnd   + 20, sliderY + 7);

  let statusY = 90, spacing = 35;
  textAlign(CENTER);

  if (ulcerRisk > 100) {
    fill(255, 0, 0);  textStyle(BOLD);  textSize(22);
    text("STOMACH LINING IN DANGER — ULCER RISK HIGH!", GAME_W / 2, statusY);  textStyle(NORMAL);
    if (warningSfx && !warningSfx.isPlaying()) warningSfx.play();
  } else {
    if (warningSfx && warningSfx.isPlaying()) warningSfx.stop();

    if (pepsinState === PepsinState.DENATURED) {
      fill(255, 50, 50);  textStyle(BOLD);  textSize(22);
      text("ENZYME SHAPE BROKEN — PEPSIN STOPPED WORKING!", GAME_W / 2, statusY);  textStyle(NORMAL);
      drawRestorePepsinButton(GAME_W / 2, statusY + spacing);
    } else if (pepsinConcentration > 0 && currentPH > 4.5 && currentPH <= 5.0) {
      fill(255, 100 + (sin(millis() * 0.018) + 1) / 2.0 * 155, 0);
      textStyle(BOLD);  textSize(22);
      text("WARNING: PEPSIN ABOUT TO BREAK DOWN — LOWER THE ACID!", GAME_W / 2, statusY);  textStyle(NORMAL);
    } else if (currentPH < 1.5) {
      fill(255, (sin(millis() * 0.012) + 1) / 2.0 * 100, 0);
      textStyle(BOLD);  textSize(22);
      text("DANGER: TOO MUCH ACID — MOVE SLIDER LEFT!", GAME_W / 2, statusY);  textStyle(NORMAL);
    } else if (inPHWindow && !enzymeActive) {
      fill(pepsinState === PepsinState.PARTIAL ? color(255, 200, 0) : color(255, 255, 0));
      textStyle(BOLD);  textSize(22);
      text(pepsinState === PepsinState.PARTIAL
        ? "ENZYME WEAKENING — KEEP pH BETWEEN 1.5 AND 3.0!"
        : "INACTIVE ENZYME BECOMING ACTIVE — HOLD THE pH!", GAME_W / 2, statusY);  textStyle(NORMAL);
    } else if (enzymeActive) {
      if (proteinScale < 0.3) {
        fill(0, 255, 150);  textStyle(BOLD);  textSize(22);
        text("PROTEIN DIGESTION COMPLETE!", GAME_W / 2, statusY);  textStyle(NORMAL);
        phase1Complete = true;
        if (!phase1ProceedSoundPlayed) { if (successSfx) successSfx.play();  phase1ProceedSoundPlayed = true; }
        drawProceedButton(GAME_W / 2, statusY + spacing);
      } else {
        fill(0, 255, 150);  textStyle(BOLD);  textSize(22);
        text("PEPSIN ACTIVE — PROTEIN IS BEING BROKEN DOWN!", GAME_W / 2, statusY);  textStyle(NORMAL);
        fill(255, 200, 0);  textSize(16);
        text("Wait for protein digestion to complete...", GAME_W / 2, statusY + spacing);
      }
    }
  }
}

function drawRestorePepsinButton(x, y) {
  textStyle(BOLD);  textSize(20);
  let bw = textWidth("RESTORE PEPSIN") + 60, bh = 54;
  let hover = (getInputX() > x - bw / 2 && getInputX() < x + bw / 2 &&
               getInputY() > y - bh / 2 && getInputY() < y + bh / 2);
  fill(hover ? 120 : 60, 200);
  stroke(255, 50, 50, 150 + sin(millis() * 0.006) * 100);  strokeWeight(3);
  rect(x, y, bw, bh, 10);
  fill(255);  textAlign(CENTER, CENTER);  text("RESTORE PEPSIN", x, y - 3);  textStyle(NORMAL);
}

function resetPepsin() {
  pepsinState        = PepsinState.INACTIVE;
  pepsinConcentration = 0;
  pepsinogenReserve   = 100;
  pepsinTimer         = 0;
  proteinScale        = 1.0;
  pepsinRestoredFlag  = true;
  phase1Complete      = false;
}

function updatePepsinDenaturation(currentPH, inPHWindow) {
  if (currentPH > 5.0 && pepsinConcentration > 0) {
    pepsinConcentration = max(0, pepsinConcentration - 2*dt);
    if (pepsinConcentration <= 0 && pepsinState !== PepsinState.DENATURED) {
      pepsinState    = PepsinState.DENATURED;
      phase1Complete = false;
      if (denatureSfx) denatureSfx.play();
    }
  } else if (currentPH > 4.0 && currentPH <= 5.0 && pepsinConcentration > 0) {
    pepsinConcentration = max(0, pepsinConcentration - 0.5*dt);
  }

  if (pepsinState === PepsinState.DENATURED) {
    pepsinogenReserve = min(100, pepsinogenReserve + 0.2*dt);
  } else {
    if (inPHWindow && pepsinState === PepsinState.INACTIVE) {
      pepsinConcentration = min(100, pepsinConcentration + 1.5*dt);
      if (pepsinConcentration >= 60) pepsinState = PepsinState.ACTIVE;
    } else if (!inPHWindow && pepsinState === PepsinState.ACTIVE) {
      if (currentPH > 3.0 && currentPH <= 4.0) {
        pepsinState = PepsinState.PARTIAL;
        pepsinConcentration = max(0, pepsinConcentration - 1.0*dt);
      } else if (currentPH > 4.0 || currentPH < 1.5) {
        pepsinState = PepsinState.INACTIVE;  pepsinConcentration = 0;  pepsinTimer = 0;
      }
    } else if (!inPHWindow && pepsinState === PepsinState.PARTIAL) {
      if (currentPH > 4.0 || currentPH < 1.5) {
        pepsinState = PepsinState.INACTIVE;  pepsinConcentration = 0;  pepsinTimer = 0;
      }
    }
  }
}

function drawPepsinPanelBig(x, y, currentPH, inPHWindow, enzymeActive) {
  fill(20, 30, 50, 220);  stroke(255, 150);  strokeWeight(2);
  rect(x, y, 275, 260, 15);

  fill(0, 255, 200);  textStyle(BOLD);  textSize(16);  textAlign(CENTER);
  text("ENZYME STATUS", x, y - 90);  textStyle(NORMAL);

  let phC = lerpColor(color(0, 150, 255), color(255, 0, 0), map(currentPH, 7, 1, 0, 1));
  fill(30, 40, 60);  rect(x, y - 40, 240, 40, 5);
  let phW = map(currentPH, 7, 1, 0, 240);
  fill(phC);  rect(x - 120 + phW / 2, y - 40, phW, 40, 5);
  if (inPHWindow) {
    stroke(0, 255, 150, 100 + (sin(millis() * 0.006) + 1) / 2.0 * 155);
    strokeWeight(3);  noFill();  rect(x, y - 40, 240, 40, 5);  noStroke();
  }
  fill(phC);  textStyle(BOLD);  textSize(12);
  text("pH: " + nf(currentPH, 1, 1), x, y - 65);  textStyle(NORMAL);

  fill(30, 40, 60);  rect(x, y + 10, 240, 20, 5);
  let pgW = map(pepsinogenReserve, 0, 100, 0, 240);
  fill(100, 150, 200);  rect(x - 120 + pgW / 2, y + 10, pgW, 20, 5);
  fill(255);  textSize(10);
  text("INACTIVE ENZYME (Pepsinogen): " + nf(pepsinogenReserve, 0, 0) + "%", x, y - 5);

  fill(30, 40, 60);  rect(x, y + 55, 240, 20, 5);
  let pepColor = (pepsinState === PepsinState.ACTIVE)    ? color(0, 255, 150)   :
                 (pepsinState === PepsinState.PARTIAL)   ? color(255, 255, 0)   :
                 (pepsinState === PepsinState.DENATURED) ? color(255, 50, 50)   :
                                                           color(100, 100, 100);
  fill(pepColor);
  rect(x - 120 + map(pepsinConcentration, 0, 100, 0, 240) / 2, y + 55,
       map(pepsinConcentration, 0, 100, 0, 240), 20, 5);
  fill(255);  text("ACTIVE ENZYME (Pepsin): " + nf(pepsinConcentration, 0, 0) + "%", x, y + 40);

  textStyle(BOLD);  textSize(13);
  if      (pepsinState === PepsinState.DENATURED)     { fill(255, 50, 50);   text("BROKEN — SHAPE DESTROYED",   x, y + 100); }
  else if (enzymeActive)                              { fill(0, 255, 150);   text("DIGESTING PROTEIN NOW!",      x, y + 100); }
  else if (inPHWindow && pepsinConcentration > 0)     { fill(255, 255, 0);   text("ENZYME ACTIVATING...",        x, y + 100); }
  else if (inPHWindow)                                { fill(255, 200, 0);   text("OPTIMAL pH — WAITING",        x, y + 100); }
  else if (currentPH < 1.5)                          { fill(255, 100, 100); text("TOO MUCH ACID — SLIDE LEFT!",  x, y + 100); }
  else if (currentPH > 5.0 && pepsinConcentration > 0){ fill(255, 50, 50);  text("ENZYME BREAKING DOWN!",       x, y + 100); }
  else if (currentPH > 3.0)                          { fill(200);           text("pH NOT IN RANGE YET",          x, y + 100); }
  else                                               { fill(200);           text("WAITING FOR ACID",             x, y + 100); }
  textStyle(NORMAL);
}

// =========================================================
// PHASE 2 — DUODENAL HOMEOSTASIS
// =========================================================
function phase2() {
  updateAndDrawPhaseParticles(2);
  drawPhaseTitle("PHASE 2 — BALANCING ACID IN THE SMALL INTESTINE", 50);

  let yOffset = 40, phLabelY = 75, phBarY = 95, warningY = 130;

  if (intestineImg != null) {
    push();  translate(GAME_W / 2, GAME_H / 2 + 30 + yOffset);  scale(organPulse);
    tint(255 - secretinLevel, 255, 255 - cckLevel, transitionAlpha);
    image(intestineImg, 0, 0, 750, 480);  noTint();  pop();
  }

  let phV = map(secretinLevel, 0, 200, 1.5, 7.5);
  fill(255);  textSize(16);  textAlign(CENTER);
  text("SMALL INTESTINE ACID LEVEL (pH): " + nf(phV, 1, 1), GAME_W / 2, phLabelY);

  let phC2 = lerpColor(color(255, 50, 0), color(0, 255, 100), secretinLevel / 200.0);
  fill(30, 40, 60);  stroke(255, 100);
  rect(GAME_W / 2, phBarY, 300, 25, 5);
  fill(phC2);  noStroke();
  rect(GAME_W / 2 - 150 + (secretinLevel / 200.0 * 150), phBarY,
       secretinLevel / 200.0 * 300, 15, 5);

  let thresholdMet = (secretinLevel >= 150 && cckLevel >= 150);
  if (thresholdMet && !homeostasisReached) {
    homeostasisReached = true;  homeostasisJustReached = true;
    homeostasisLocked  = true;  homeostasisDisplayTimer = HOMEOSTASIS_DISPLAY_FRAMES;
  }
  if (homeostasisDisplayTimer > 0) {
    homeostasisDisplayTimer -= dt;
    if (homeostasisDisplayTimer <= 0) homeostasisLocked = false;
  }
  if (homeostasisReached && !homeostasisLocked && !thresholdMet) {
    homeostasisReached = false;  homeostasisJustReached = false;
  }

  textAlign(CENTER);
  if (homeostasisReached && homeostasisDisplayTimer <= 0) {
    fill(0, 255, 150);  textStyle(BOLD);  textSize(22);
    text("ACID NEUTRALIZED — READY FOR NUTRIENT ABSORPTION!", GAME_W / 2, warningY);  textStyle(NORMAL);
    if (!phase2ProceedSoundPlayed) { if (successSfx) successSfx.play();  phase2ProceedSoundPlayed = true; }
    drawProceedButton(GAME_W / 2, warningY + 45);
  } else if (homeostasisReached && homeostasisDisplayTimer > 0) {
    fill(0, 255, 150, 150 + sin(millis() * 0.012) * 105);  textStyle(BOLD);  textSize(22);
    text("HORMONES BALANCED — WAIT FOR ABSORPTION TO BEGIN...", GAME_W / 2, warningY);  textStyle(NORMAL);
  } else {
    let p2T = (secretinLevel <= 150 && cckLevel <= 150) ? "TOO MUCH ACID AND FAT! SPRAY BOTH HORMONES!" :
              (secretinLevel <= 150)                    ? "TOO MUCH STOMACH ACID HERE — SPRAY SECRETIN!" :
                                                          "FATS DETECTED — SPRAY CCK TO HELP DIGEST THEM!";
    fill(255);  textStyle(BOLD);  textSize(22);  text(p2T, GAME_W / 2, warningY);  textStyle(NORMAL);
  }

  drawHormoneButton(GAME_W * 0.15, GAME_H / 2 + 50 + yOffset, "SECRETIN", color(0, 150, 255), sprayType === 1, hormone1Img);
  drawHormoneButton(GAME_W * 0.85, GAME_H / 2 + 50 + yOffset, "CCK",      color(255, 180, 0), sprayType === 2, hormone2Img);

  // FIX: secretinLevel/cckLevel range is 0–200; divide by 2 to show 0–100%
  fill(0, 180, 255);  textSize(14);  textAlign(CENTER);
  text("Secretin: " + int(secretinLevel / 2) + "% (need 75%)", GAME_W * 0.15, GAME_H / 2 + 50 + yOffset + 100);
  fill(255, 200, 0);
  text("CCK: " + int(cckLevel / 2) + "% (need 75%)", GAME_W * 0.85, GAME_H / 2 + 50 + yOffset + 100);

  if (mouseIsPressed && (sprayType === 1 || sprayType === 2)) {
    if (spraySfx && !spraySfx.isPlaying()) spraySfx.play();
    if (sprayType === 1) {
      secretinLevel = min(secretinLevel + 4.5*dt, 200);
      for (let i = 0; i < 3; i++)
        hormoneMist.push(new Mist(GAME_W * 0.15 + 80, GAME_H / 2 + 50 + yOffset,
                                   random(5, 10), random(-2, 2), [0, 150, 255]));
    } else {
      cckLevel = min(cckLevel + 4.5*dt, 200);
      for (let i = 0; i < 3; i++)
        hormoneMist.push(new Mist(GAME_W * 0.85 - 80, GAME_H / 2 + 50 + yOffset,
                                   random(-10, -5), random(-2, 2), [255, 180, 0]));
    }
  } else {
    if (spraySfx && spraySfx.isPlaying()) spraySfx.stop();
  }

  updateMist();

  if (!homeostasisLocked) {
    secretinLevel = max(secretinLevel - decayRate*dt, 0);
    cckLevel      = max(cckLevel      - decayRate*dt, 0);
  }

  drawMeter(GAME_W / 2 - 250, GAME_H - 110 + yOffset, secretinLevel, "Secretin (Acid Reducer)", color(0, 180, 255));
  drawMeter(GAME_W / 2 + 250, GAME_H - 110 + yOffset, cckLevel,      "CCK (Fat Digester)",      color(255, 200, 0));
}

// =========================================================
// PHASE 3 — NUTRIENT ABSORPTION
// =========================================================
function phase3() {
  drawPhaseTitle("PHASE 3 — NUTRIENT ABSORPTION THROUGH THE VILLI", 50);
  updateAndDrawPhaseParticles(3);

  if (villusImg != null) image(villusImg, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);

  let zoneX = MEMBRANE_X + 280;
  let capY = GAME_H * 0.35, nheY = GAME_H * 0.55, lacY = GAME_H * 0.75;

  renderZoneStrict(zoneX, capY, "BLOOD CAPILLARY",  color(255, 100, 100), 400, 120, capillaryPulse, glucoseSorted && sodiumSGLTSorted);
  renderZoneStrict(zoneX, nheY, "SODIUM EXCHANGER", color(100, 150, 255), 400, 120, nhe3Pulse,      sodiumNHE3Sorted);
  renderZoneStrict(zoneX, lacY, "LACTEAL",          color(100, 150, 255), 400, 120, lactealPulse,   lipidSorted);

  fill(200);  textSize(16);  textAlign(CENTER);
  text("DRAG EACH NUTRIENT TO ITS CORRECT ZONE IN THE VILLI!", GAME_W / 2, 75);

  handleNutrientPhysicsStrict(zoneX, 400, 120, capY, nheY, lacY);
  updateMist();

  drawNutrient(glucoseImg, glucoseX,    glucoseY,    "Glucose",        [0, 255, 0],   glucoseSorted,    draggingGlucose,    gTimer);
  drawNutrient(sodiumImg,  sodiumSGLTX, sodiumSGLTY, "Sodium — SGLT1", [0, 200, 150], sodiumSGLTSorted, draggingSodiumSGLT, sGLTTimer);
  drawNutrient(sodiumImg,  sodiumNH3X,  sodiumNH3Y,  "Sodium — NHE3",  [0, 100, 200], sodiumNHE3Sorted, draggingSodiumNHE3, nhe3Timer);
  drawNutrient(lipidImg,   lipidX,      lipidY,      "Lipids (Fats)",  [255, 255, 0], lipidSorted,      draggingLipid,      lTimer);

  let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
  if (allAbsorbed) {
    phase3ProceedDelay += dt;
    if (phase3ProceedDelay < PHASE3_PROCEED_DELAY_FRAMES) {
      fill(0, 255, 150, 150 + sin(millis() * 0.012) * 105);
      textStyle(BOLD);  textSize(22);  textAlign(CENTER);
      text("COMPLETING THE PROCESS — WAIT...", GAME_W / 2, 105);  textStyle(NORMAL);
    } else {
      if (!phase3ProceedSoundPlayed) { if (successSfx) successSfx.play();  phase3ProceedSoundPlayed = true; }
      fill(0, 0, 0, 180);  rect(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);
      fill(0, 255, 200);  textStyle(BOLD);  textSize(26);  textAlign(CENTER);
      text("ALL NUTRIENTS ABSORBED SUCCESSFULLY!", GAME_W / 2, GAME_H / 2 - 60);  textStyle(NORMAL);
      drawProceedButton(GAME_W / 2, GAME_H / 2 + 22);
    }
  }
}

function renderZoneStrict(x, y, label, c, w, h, pulse, done) {
  let pe = map(pulse, 0, 30, 0, 15);
  fill(red(c), green(c), blue(c), done ? 80 : 40);
  stroke(done ? color(0, 255, 150) : c, done ? 255 : 150);
  strokeWeight(done ? 4 : 2);
  rect(x, y, w + pe, h + pe, 10);
  fill(255);  textSize(14);  textAlign(CENTER);
  text(label, x, y - h / 2 - 15);
  if (pulse > 0) {
    if      (label.startsWith("BLOOD"))  capillaryPulse--;
    else if (label.startsWith("SODIUM")) nhe3Pulse--;
    else                                  lactealPulse--;
  }
}

function pointInZone(x, y, zX, zY, zW, zH) {
  return (x > zX - zW / 2 && x < zX + zW / 2 && y > zY - zH / 2 && y < zY + zH / 2);
}

function handleNutrientPhysicsStrict(zoneX, zoneW, zoneH, capY, nheY, lacY) {
  let ix = getInputX(), iy = getInputY();

  if (draggingGlucose)    { glucoseX  = ix + dragOffsetX; glucoseY  = iy + dragOffsetY; glucoseVX  = 0; glucoseVY  = 0; }
  else                    { glucoseX += glucoseVX; glucoseY += glucoseVY; glucoseVX *= 0.95; glucoseVY *= 0.95; }

  if (draggingSodiumSGLT) { sodiumSGLTX = ix + dragOffsetX; sodiumSGLTY = iy + dragOffsetY; sodiumSGLTVX = 0; sodiumSGLTVY = 0; }
  else                    { sodiumSGLTX += sodiumSGLTVX; sodiumSGLTY += sodiumSGLTVY; sodiumSGLTVX *= 0.95; sodiumSGLTVY *= 0.95; }

  if (draggingSodiumNHE3) { sodiumNH3X = ix + dragOffsetX; sodiumNH3Y = iy + dragOffsetY; sodiumNH3VX = 0; sodiumNH3VY = 0; }
  else                    { sodiumNH3X += sodiumNH3VX; sodiumNH3Y += sodiumNH3VY; sodiumNH3VX *= 0.95; sodiumNH3VY *= 0.95; }

  if (draggingLipid)      { lipidX = ix + dragOffsetX; lipidY = iy + dragOffsetY; lipidVX = 0; lipidVY = 0; }
  else                    { lipidX += lipidVX; lipidY += lipidVY; lipidVX *= 0.95; lipidVY *= 0.95; }

  // --- Glucose → capillary ---
  if (!draggingGlucose && !glucoseSorted) {
    if (pointInZone(glucoseX, glucoseY, zoneX, capY, zoneW, zoneH)) {
      gTimer += 0.05;
      if (gTimer >= 1.0) { glucoseSorted = true; capillaryPulse = 30; triggerBurst(glucoseX, glucoseY, [0,255,0]); if (correctSfx) correctSfx.play(); }
    } else if (pointInZone(glucoseX, glucoseY, zoneX, nheY, zoneW, zoneH) ||
               pointInZone(glucoseX, glucoseY, zoneX, lacY, zoneW, zoneH)) {
      if (glucoseVX >= -5) { glucoseVX = -40; glucoseVY = random(-5, 5); if (bounceSfx) bounceSfx.play(); }
      gTimer = 0;
    } else { gTimer = 0; }
  }

  // --- Sodium SGLT → capillary ---
  if (!draggingSodiumSGLT && !sodiumSGLTSorted) {
    if (pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, capY, zoneW, zoneH)) {
      let speedMult = dist(sodiumSGLTX, sodiumSGLTY, glucoseX, glucoseY) < 80 ? 2.0 : 1.0;
      sGLTTimer += 0.05 * speedMult;
      if (sGLTTimer >= 1.0) { sodiumSGLTSorted = true; capillaryPulse = 30; triggerBurst(sodiumSGLTX, sodiumSGLTY, [0,200,150]); if (correctSfx) correctSfx.play(); }
    } else if (pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, nheY, zoneW, zoneH) ||
               pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, lacY, zoneW, zoneH)) {
      if (sodiumSGLTVX >= -5) { sodiumSGLTVX = -40; sodiumSGLTVY = random(-5, 5); if (bounceSfx) bounceSfx.play(); }
      sGLTTimer = 0;
    } else { sGLTTimer = 0; }
  }

  // --- Sodium NHE3 → exchanger ---
  if (!draggingSodiumNHE3 && !sodiumNHE3Sorted) {
    if (pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, nheY, zoneW, zoneH)) {
      nhe3Timer += 0.04;
      if (nhe3Timer >= 1.0) { sodiumNHE3Sorted = true; nhe3Pulse = 30; triggerBurst(sodiumNH3X, sodiumNH3Y, [0,100,200]); if (nhe3Sfx) nhe3Sfx.play(); if (correctSfx) correctSfx.play(); }
    } else if (pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, capY, zoneW, zoneH) ||
               pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, lacY, zoneW, zoneH)) {
      if (sodiumNH3VX >= -5) { sodiumNH3VX = -40; sodiumNH3VY = random(-5, 5); if (bounceSfx) bounceSfx.play(); }
      nhe3Timer = 0;
    } else { nhe3Timer = 0; }
  }

  // --- Lipid → lacteal ---
  if (!draggingLipid && !lipidSorted) {
    if (pointInZone(lipidX, lipidY, zoneX, lacY, zoneW, zoneH)) {
      lTimer += 0.05;
      if (lTimer >= 1.0) { lipidSorted = true; lactealPulse = 30; triggerBurst(lipidX, lipidY, [255,255,180]); if (correctSfx) correctSfx.play(); }
    } else if (pointInZone(lipidX, lipidY, zoneX, capY, zoneW, zoneH) ||
               pointInZone(lipidX, lipidY, zoneX, nheY, zoneW, zoneH)) {
      if (lipidVX >= -5) { lipidVX = -40; lipidVY = random(-5, 5); if (bounceSfx) bounceSfx.play(); }
      lTimer = 0;
    } else { lTimer = 0; }
  }

  // Constrain all nutrients to canvas
  glucoseX    = constrain(glucoseX,    50, GAME_W - 50);  glucoseY    = constrain(glucoseY,    50, GAME_H - 50);
  sodiumSGLTX = constrain(sodiumSGLTX, 50, GAME_W - 50);  sodiumSGLTY = constrain(sodiumSGLTY, 50, GAME_H - 50);
  sodiumNH3X  = constrain(sodiumNH3X,  50, GAME_W - 50);  sodiumNH3Y  = constrain(sodiumNH3Y,  50, GAME_H - 50);
  lipidX      = constrain(lipidX,      50, GAME_W - 50);  lipidY      = constrain(lipidY,      50, GAME_H - 50);
}

function triggerBurst(x, y, c) {
  for (let i = 0; i < 15; i++)
    hormoneMist.push(new Mist(x, y, random(-6, 6), random(-6, 6), c));
}

function updateMist() {
  for (let i = hormoneMist.length - 1; i >= 0; i--) {
    hormoneMist[i].update();  hormoneMist[i].display();
    if (hormoneMist[i].alpha <= 5) hormoneMist.splice(i, 1);
  }
}

// =========================================================
// FINAL REPORT
// =========================================================
function drawFinalReport() {
  if (!reportPlayed && reportSfx != null) { reportSfx.play();  reportPlayed = true; }

  if (reportGradientBuffer.GAME_W !== GAME_W || reportGradientBuffer.GAME_H !== GAME_H) {
    reportGradientBuffer = createGraphics(GAME_W, GAME_H);
    updateReportGradientBuffer(reportGradientBuffer);
  }
  image(reportGradientBuffer, GAME_W / 2, GAME_H / 2);

  for (let p of reportParticles) { p.update();  p.display(); }

  fill(255);  textStyle(BOLD);  textAlign(CENTER);  textSize(60);
  text("YOUR DIGESTIVE REPORT", GAME_W / 2, 70);
  stroke(112, 240, 240, 150);  strokeWeight(2);
  line(GAME_W / 2 - 200, 95, GAME_W / 2 + 200, 95);

  let boxW = GAME_W * 0.85, boxH = GAME_H * 0.55, boxY = GAME_H / 2 - 40;
  fill(10, 40, 30, 200);  stroke(0, 255, 150, 100);  strokeWeight(3);
  rect(GAME_W / 2, boxY, boxW, boxH, 20);
  noFill();  stroke(0, 255, 150, 50);  strokeWeight(8);
  rect(GAME_W / 2, boxY, boxW - 20, boxH - 20, 15);

  let content = reportContent[currentReportSlide];
  fill(220, 255, 240);  textAlign(LEFT);
  textStyle(BOLD);  textSize(40);
  text(content[0], GAME_W / 2 - boxW / 2 + 40, boxY - boxH / 2 + 50);
  textStyle(NORMAL);
  stroke(0, 255, 150, 100);  strokeWeight(1);
  line(GAME_W / 2 - boxW / 2 + 30, boxY - boxH / 2 + 70,
       GAME_W / 2 + boxW / 2 - 30, boxY - boxH / 2 + 70);

  textSize(22);
  let textY = boxY - boxH / 2 + 115;
  for (let i = 2; i < content.length; i++) { text(content[i], GAME_W / 2 - boxW / 2 + 40, textY);  textY += 30; }

  let btnY = boxY + boxH / 2 + 70, btnSpacing = 220;
  let startX = GAME_W / 2 - btnSpacing * 1.5;
  for (let i = 0; i < 4; i++) {
    let bx = startX + i * btnSpacing;
    let isActive = (currentReportSlide === i), isDone = phaseCompleted[i];
    if (isActive) {
      noFill();  stroke(255, 255, 255, 150 + sin(millis() * 0.006) * 100);  strokeWeight(4);
      rect(bx, btnY, 200, 100, 12);
    }
    fill(isActive ? color(0, 100, 100) : isDone ? color(0, 80, 80) : color(20, 40, 50), 220);
    stroke(isActive ? color(0, 255, 200) : isDone ? color(0, 255, 150) : color(80, 100, 110));
    strokeWeight(isActive ? 3 : 2);  rect(bx, btnY, 190, 95, 10);
    fill(isActive ? color(255) : isDone ? color(0, 255, 150) : color(120, 140, 150));
    textStyle(BOLD);  textSize(20);  textAlign(CENTER);  text("PHASE " + i, bx, btnY - 15);  textStyle(NORMAL);
    fill(isActive ? color(0, 255, 200) : color(200, 220, 240));
    textSize(15);  text(isDone ? "COMPLETED" : "PENDING", bx, btnY + 12);
    if (isDone) {
      fill(phaseColors[i][0], phaseColors[i][1], phaseColors[i][2]);
      textStyle(BOLD);  textSize(22);  text(nf(phaseEfficiency[i], 0, 0) + "%", bx, btnY + 40);  textStyle(NORMAL);
    }
  }

  fill(150, 200, 200);  textSize(14);  textAlign(CENTER);
  text("Select a phase button below to read its detailed report", GAME_W / 2, GAME_H - 25);
  fill(0, 255, 200);  textSize(16);  textAlign(LEFT);
  text("System Designer: Altheo Cardillo",                        40, GAME_H - 60);
  text("Educational Biology Simulation — Digestive System",       40, GAME_H - 40);
}

// =========================================================
// MOUSE / TOUCH HANDLERS
// =========================================================
function mousePressed()  { handleInputStart(); }
function touchStarted()  { handleInputStart(); return false; }
function mouseReleased() { handleInputEnd(); }
function touchEnded()    { handleInputEnd(); return false; }
function mouseDragged()  { /* handled by isDragging flags */ }
function touchMoved()    { return false; }

function handleInputStart() {
  let ix = getInputX(), iy = getInputY();

  if (showLicenseScreen) {
    textStyle(BOLD);  textSize(22);
    let btnY = GAME_H / 2 + 230, btnH = 50, spacing = 40;
    let aw = textWidth("AGREE") + 50, dw = textWidth("DISAGREE") + 50;
    let ax = GAME_W / 2 - dw / 2 - spacing / 2 - aw / 2;
    let dx = GAME_W / 2 + aw / 2 + spacing / 2 + dw / 2;
    if (ix > ax - aw / 2 && ix < ax + aw / 2 && iy > btnY - btnH / 2 && iy < btnY + btnH / 2) {
      acceptedLicense = true;  showLicenseScreen = false;  if (clickSfx) clickSfx.play();  return;
    }
    if (ix > dx - dw / 2 && ix < dx + dw / 2 && iy > btnY - btnH / 2 && iy < btnY + btnH / 2)
      location.reload();
    return;
  }

  if (quizState === 1) { if (clickSfx) clickSfx.play();  handleQuizClick();  return; }
  if (clickSfx) clickSfx.play();

  if (mode !== MODE_TITLE && mode !== MODE_MECHANICS) {
    if (ix > 15 && ix < 135 && iy > 10 && iy < 50) { mode = MODE_TITLE;  resetAll();  return; }
  }

  if (mode === MODE_TITLE) {
    let bw = 360, bh = 90, cx = GAME_W / 2;
    if (ix > cx - bw/2 && ix < cx + bw/2 && iy > GAME_H/2+40  && iy < GAME_H/2+130) { mode = MODE_JOURNEY;   transitionAlpha = 0; }
    if (ix > cx - bw/2 && ix < cx + bw/2 && iy > GAME_H/2+150 && iy < GAME_H/2+240) { mode = MODE_MECHANICS; currentCard = 0; transitionAlpha = 0; }
  }

  if (mode === MODE_MECHANICS) {
    let bx = GAME_W - 80, by = GAME_H - 80;
    if (dist(ix, iy, bx, by) < 60) {
      if (currentCard < totalCards - 1) currentCard++;
      else { mode = MODE_JOURNEY;  transitionAlpha = 0; }
    }
    if (ix > 30 && ix < 180 && iy > 20 && iy < 60) { mode = MODE_TITLE;  transitionAlpha = 0; }
  }

  if (mode === MODE_JOURNEY) {
    for (let i = 0; i < 4; i++) {
      let nx = GAME_W / 2 - 450 + i * 300, ny = GAME_H / 2 - 50;
      let avail = (i === 0) || phaseCompleted[i - 1];
      if (dist(ix, iy, nx, ny) < 50 && avail) {
        selectedPhase = i;
        gateAttemptsCount[i] = 0;
        const phaseMode = [MODE_PHASE0, MODE_PHASE1, MODE_PHASE2, MODE_PHASE3];
        mode = phaseMode[i];
        initPhaseParticles(i);
        transitionAlpha = 0;
      }
    }
  }

  if (mode === MODE_PHASE0) {
    let sliderY = GAME_H - 150, buttonY = 130;
    if (ix > (GAME_W/2-110)-90 && ix < (GAME_W/2-110)+90 && iy > (sliderY+90)-25 && iy < (sliderY+90)+25) {
      if (foodType !== 1) { foodScale = 0;  emeticTimer = 0;  if (warningSfx && warningSfx.isPlaying()) warningSfx.stop(); }
      foodType = 1;
    } else if (ix > (GAME_W/2+110)-90 && ix < (GAME_W/2+110)+90 && iy > (sliderY+90)-25 && iy < (sliderY+90)+25) {
      if (foodType !== 2) { foodScale = 0;  emeticTimer = 0;  if (warningSfx && warningSfx.isPlaying()) warningSfx.stop(); }
      foodType = 2;
    }
    if (hasSwallowed) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) startReflectionGate();
    } else if (isChewing) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) {
        hasSwallowed = true;  if (swallowSfx) swallowSfx.play();
      }
    } else if (cephalicReady) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) {
        isChewing = true;  if (chewSfx) chewSfx.play();
      }
    }
    if (iy > GAME_H-180 && iy < GAME_H-120 && ix > smellSliderX-30 && ix < smellSliderX+30)
      isDraggingSmellSlider = true;
  }

  if (mode === MODE_PHASE1) {
    if (pepsinState === PepsinState.DENATURED) {
      textStyle(BOLD);  textSize(20);
      let bw2 = textWidth("RESTORE PEPSIN") + 60, bh2 = 54, bx2 = GAME_W/2, by2 = 90+35;
      if (ix > bx2-bw2/2 && ix < bx2+bw2/2 && iy > by2-bh2/2 && iy < by2+bh2/2) resetPepsin();
    }
    if (phase1Complete && proteinScale < 0.3) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (90+35)-25 && iy < (90+35)+25) startReflectionGate();
    }
    let sliderY = GAME_H-110, sliderStart = GAME_W/2-150, sliderEnd = GAME_W/2+150;
    if (iy > sliderY-30 && iy < sliderY+30 && ix > sliderX-30 && ix < sliderX+30)
      isDraggingPHSlider = true;
  }

  if (mode === MODE_PHASE2) {
    let yOffset = 40, warningY = 130;
    if (ix > GAME_W*0.15-100 && ix < GAME_W*0.15+100 && iy > GAME_H/2+50+yOffset-80 && iy < GAME_H/2+50+yOffset+80) sprayType = 1;
    else if (ix > GAME_W*0.85-100 && ix < GAME_W*0.85+100 && iy > GAME_H/2+50+yOffset-80 && iy < GAME_H/2+50+yOffset+80) sprayType = 2;
    if (homeostasisReached && homeostasisDisplayTimer <= 0) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (warningY+45)-25 && iy < (warningY+45)+25) startReflectionGate();
    }
  }

  if (mode === MODE_PHASE3) {
    let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
    if (allAbsorbed && phase3ProceedDelay >= PHASE3_PROCEED_DELAY_FRAMES) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (GAME_H/2+22)-25 && iy < (GAME_H/2+22)+25) startReflectionGate();
    } else {
      if      (dist(ix, iy, glucoseX,    glucoseY)    < 40) { draggingGlucose    = true;  dragOffsetX = glucoseX    - ix;  dragOffsetY = glucoseY    - iy;  if (dragSfx) dragSfx.play(); }
      else if (dist(ix, iy, sodiumSGLTX, sodiumSGLTY) < 40) { draggingSodiumSGLT = true;  dragOffsetX = sodiumSGLTX - ix;  dragOffsetY = sodiumSGLTY - iy;  if (dragSfx) dragSfx.play(); }
      else if (dist(ix, iy, sodiumNH3X,  sodiumNH3Y)  < 40) { draggingSodiumNHE3 = true;  dragOffsetX = sodiumNH3X  - ix;  dragOffsetY = sodiumNH3Y  - iy;  if (dragSfx) dragSfx.play(); }
      else if (dist(ix, iy, lipidX,      lipidY)      < 40) { draggingLipid      = true;  dragOffsetX = lipidX      - ix;  dragOffsetY = lipidY      - iy;  if (dragSfx) dragSfx.play(); }
    }
  }

  if (mode === MODE_FINISH) {
    let boxH = GAME_H * 0.55, boxY = GAME_H/2-40, btnY = boxY+boxH/2+70, bsp = 220;
    let sx = GAME_W/2 - bsp*1.5;
    for (let i = 0; i < 4; i++) {
      let bx = sx + i*bsp;
      if (ix > bx-95 && ix < bx+95 && iy > btnY-47 && iy < btnY+47) currentReportSlide = i;
    }
  }
}

function handleInputEnd() {
  draggingGlucose = draggingSodiumSGLT = draggingSodiumNHE3 = draggingLipid = false;
  sprayType = 0;
  isDraggingSmellSlider = isDraggingPHSlider = false;
  if (spraySfx && spraySfx.isPlaying()) spraySfx.stop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  _calcScale();
  bgGradientBuffer    = createGraphics(GAME_W, GAME_H);
  reportGradientBuffer = createGraphics(GAME_W, GAME_H);
  needsGradientRedraw = true;
  MEMBRANE_X   = GAME_W / 2;
  smellSliderX = GAME_W / 2 - 200;
  sliderX      = GAME_W / 2 - 150;
}

// =========================================================
// RESET ALL
// =========================================================
function resetAll() {
  stomachAcid = 0;  ulcerRisk = 0;  sliderX = GAME_W/2-150;
  proteinScale = 1.0;  pepsinTimer = 0;  enzymeActive = false;
  pepsinState = PepsinState.INACTIVE;  pepsinConcentration = 0;
  pepsinogenReserve = 100;  pepsinRestoredFlag = false;
  acidBubbles = [];  phase1ProceedSoundPlayed = false;  phase1Complete = false;
  pepsinSuccessPlayed = false;

  secretinLevel = 0;  cckLevel = 0;
  homeostasisReached = false;  homeostasisJustReached = false;
  homeostasisDisplayTimer = 0;  homeostasisLocked = false;
  hormoneMist = [];  phase2ButtonSuccessPlayed = false;  phase2ProceedSoundPlayed = false;

  glucoseSorted = false;  sodiumSGLTSorted = false;
  sodiumNHE3Sorted = false;  lipidSorted = false;
  resetNutrientPositions();

  foodType = 0;  salivaLevel = 0;  cephalicAcid = 0;
  smellSliderX = GAME_W/2-200;  delayedSmell = 0;  foodScale = 0;
  isChewing = false;  hasSwallowed = false;
  cephalicTimer = 0;  insulinLevel = 0;
  hepaticGlucoseOutput = 100;  peripheralGlucoseUptake = 0;  emeticTimer = 0;
  cephalicSuccessPlayed = false;  warningPlayed = false;
  phase0ProceedSoundPlayed = false;  aromaParticles = [];

  currentReportSlide = 0;  reportPlayed = false;
  quizState = 0;  quizSubState = 0;
  phase3ProceedDelay = 0;  phase3ProceedSoundPlayed = false;
  selectedPhase = -1;  currentCard = 0;
  successParticles = [];
  phase0Particles = [];  phase1Particles = [];  phase2Particles = [];  phase3Particles = [];
  isDraggingSmellSlider = false;  isDraggingPHSlider = false;
  wrongAnswers = [];  dragOffsetX = 0;  dragOffsetY = 0;
  gateJustCompleted = false;

  if (warningSfx && warningSfx.isPlaying()) warningSfx.stop();
}

// =========================================================
// TITLE SCREEN
// =========================================================
function drawTitleScreen() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(72);
  text("BioBalance", GAME_W/2, GAME_H/2-180);
  textSize(36);  text("DIGESTIVE SYSTEM EXPLORER", GAME_W/2, GAME_H/2-130);

  fill(150, 200, 255);  textStyle(NORMAL);  textSize(20);
  text("Explore, control, and understand how your body digests food.", GAME_W/2, GAME_H/2-90);

  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-250, GAME_H/2-70, GAME_W/2+250, GAME_H/2-70);

  let bw = 360, bh = 90, cx = GAME_W/2;
  let h1 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+40 && getInputY()<GAME_H/2+130;
  let h2 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+150 && getInputY()<GAME_H/2+240;
  drawTitleButton(cx, GAME_H/2+85,  bw, bh, "START JOURNEY", "Play through all 4 digestive phases", h1);
  drawTitleButton(cx, GAME_H/2+195, bw, bh, "HOW TO PLAY",   "Read the instructions before playing", h2);

  fill(100, 150, 180);  textSize(14);  textAlign(CENTER);
  text("Developed by Altheo Cardillo © 2026", GAME_W/2, GAME_H-30);
}

function drawTitleButton(x, y, w, h, main, sub, hov) {
  push();  translate(x, y);  if (hov) scale(1.03);
  if (hov) { noFill();  stroke(0,255,200,100);  strokeWeight(8);  rect(0,0,w+10,h+10,15); }
  fill(hov ? color(0,100,100) : color(0,80,80), 220);
  stroke(0,255,200, hov?255:180);  strokeWeight(hov?3:2);  rect(0,0,w,h,12);
  fill(255);  textStyle(BOLD);  textSize(28);  text(main, 0, -12);  textStyle(NORMAL);
  fill(200,255,255);  textSize(15);  text(sub, 0, 22);
  pop();
}

// =========================================================
// CONTROL PROTOCOL / HOW TO PLAY
// =========================================================
function drawControlProtocol() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0,255,200);  textStyle(BOLD);  textAlign(CENTER);  textSize(56);
  text("HOW TO PLAY", GAME_W/2, 80);
  fill(150,200,255,200);  textStyle(NORMAL);  textSize(18);
  text("BioBalance — Digestive System Guide", GAME_W/2, 115);
  stroke(0,255,200,100);  strokeWeight(1);
  line(GAME_W/2-250,135, GAME_W/2+250,135);

  let sf = min(1, GAME_W/1280);
  let cw = 580*sf, ch = 220*sf, sx2 = 40*sf, sy = 40*sf;
  let sx3 = GAME_W/2-cw/2-sx2/2, sy3 = 170;

  drawProtocolCard(sx3,          sy3+ch/2,            cw, ch, 0, currentCard===0);
  drawProtocolCard(sx3+cw+sx2,   sy3+ch/2,            cw, ch, 1, currentCard===1);
  drawProtocolCard(sx3,          sy3+ch+sy+ch/2,      cw, ch, 2, currentCard===2);
  drawProtocolCard(sx3+cw+sx2,   sy3+ch+sy+ch/2,      cw, ch, 3, currentCard===3);

  let pw = 600*sf, pv = (currentCard+1)/totalCards, barY = sy3+ch*2+sy+50;
  fill(30,50,70);  rect(GAME_W/2,barY,pw,8,4);
  fill(0,255,200);  rect(GAME_W/2-pw/2+(pw*pv)/2, barY, pw*pv, 8, 4);

  let bx4=GAME_W-80, by4=GAME_H-80, br=60;
  let hov = dist(getInputX(),getInputY(),bx4,by4)<br;
  let pulse4 = (sin(millis()*0.006)+1)/2.0;
  noFill();  stroke(0,255,200, hov?200:80+pulse4*60);  strokeWeight(hov?8:4);
  ellipse(bx4,by4,br*2+20,br*2+20);
  fill(hov?color(0,200,160):color(0,100,100),240);
  stroke(0,255,200);  strokeWeight(hov?4:2);  ellipse(bx4,by4,br*2,br*2);
  fill(255);  textStyle(BOLD);  textSize(36);  textAlign(CENTER,CENTER);  text("→",bx4+2,by4-2);  textStyle(NORMAL);

  let rh=getInputX()>30&&getInputX()<180&&getInputY()>20&&getInputY()<60;
  fill(rh?60:30,200);  stroke(0,255,200,rh?255:150);  strokeWeight(1);
  rect(105,40,150,40,5);  fill(0,255,200);  textSize(14);  text("RETURN",105,38);
}

function drawProtocolCard(x, y, w, h, idx, isActive) {
  let a = isActive ? 255 : 140;
  push();  translate(x, y);
  fill(15,30,50,a);  stroke(0,255,200,isActive?255:100);  strokeWeight(isActive?4:2);  rect(0,0,w,h,15);
  if (isActive) { noFill();  stroke(0,255,200,40);  strokeWeight(12);  rect(0,0,w-20,h-20,12); }
  fill(isActive?color(0,255,200):color(130,150,170));
  textStyle(BOLD);  textSize(isActive?28:24);  textAlign(CENTER);  text(cardTitles[idx],0,-h/2+45);  textStyle(NORMAL);
  fill(isActive?color(230,240,255):color(150,160,170));
  textSize(isActive?22:20);  textAlign(LEFT);
  let ly = -h/2+85;
  for (let line of cardContent[idx]) { text(line, -w/2+30, ly);  ly += 26; }
  pop();
}

// =========================================================
// JOURNEY MAP
// =========================================================
function drawJourneyMap() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0,255,200);  textStyle(BOLD);  textAlign(CENTER);  textSize(56);
  text("YOUR DIGESTIVE JOURNEY", GAME_W/2, 80);

  let done = 0, tot = 0;
  for (let i = 0; i < 4; i++) { if (phaseCompleted[i]) { done++;  tot += phaseEfficiency[i]; } }
  let sysInt = done === 0 ? 0 : tot / done;

  fill(150,200,255);  textStyle(NORMAL);  textSize(18);
  text("Overall Score: " + nf(sysInt,0,1) + "%  |  Phases Completed: " + done + " / 4", GAME_W/2, 120);

  strokeWeight(4);
  for (let i = 0; i < 3; i++) {
    let x1 = GAME_W/2-450+(i*300), x2 = x1+300, y = GAME_H/2-50;
    stroke(phaseCompleted[i] ? color(0,255,200, 100+connectionGlow*155)
           : (i===0||phaseCompleted[i-1]) ? color(0,255,200,50) : color(50,60,80,100));
    line(x1, y, x2, y);
    if (phaseCompleted[i]) {
      fill(0,255,200,200);  noStroke();
      ellipse(x1 + (millis()/8.333)%300, y, 8, 8);
    }
  }

  for (let i = 0; i < 4; i++) drawPhaseNode(GAME_W/2-450+i*300, GAME_H/2-50, i);

  if (selectedPhase >= 0) {
    let sx = GAME_W/2-450+selectedPhase*300, sy = GAME_H/2-50;
    noFill();  stroke(255,255,0, 150+sin(millis()*0.006)*105);  strokeWeight(3);
    ellipse(sx,sy,120,120);
  }

  // Journey instruction text
  fill(255);  textStyle(NORMAL);  textSize(18);  textAlign(CENTER);
  text("Click an available phase node to begin or replay", GAME_W/2, GAME_H-100);

  fill(0,40,60,180);  stroke(0,255,200,80);  strokeWeight(1);  rect(200,GAME_H-150,300,100,10);
  fill(0,255,200);  textStyle(BOLD);  textSize(16);  textAlign(LEFT);  text("PROGRESS",80,GAME_H-180);
  fill(200,220,255);  textStyle(NORMAL);  textSize(14);
  text("Status: " + (done===4?"COMPLETE!":done>=2?"IN PROGRESS":"JUST STARTING"), 80, GAME_H-155);
  text("Score: " + nf(sysInt,0,1)+"%", 80, GAME_H-135);

  if (done === 4) {
    fill(0,255,200, 100+(sin(millis()*0.006)+1)/2.0*155);
    textStyle(BOLD);  textSize(28);  textAlign(CENTER);
    text("DIGESTION COMPLETE!", GAME_W-200, GAME_H-130);  textStyle(NORMAL);
  }
}

// FIX: replaced broken ternary fill() crash in original
function drawPhaseNode(x, y, phaseIndex) {
  let isCompleted = phaseCompleted[phaseIndex];
  let isAvailable = (phaseIndex === 0) || phaseCompleted[phaseIndex - 1];
  let isLocked    = !isCompleted && !isAvailable;
  let isSelected  = (selectedPhase === phaseIndex);

  let baseSize = 80, pulseSize = 0;
  if (phaseIndex === 0 && !isCompleted) {
    pulseSize = sin(millis() * 0.0048) * 10;
  } else if (!isCompleted && isAvailable) {
    nodePulse[phaseIndex] = (sin(millis() * 0.0048 + phaseIndex) + 1) / 2.0;
    pulseSize = nodePulse[phaseIndex] * 15;
  }

  if (isSelected) { noFill();  stroke(255,200,0,150);  strokeWeight(4);  ellipse(x,y,baseSize+40,baseSize+40); }

  if (isCompleted) {
    noFill();
    stroke(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2], 100+connectionGlow*100);
    strokeWeight(3);  ellipse(x,y,baseSize+30,baseSize+30);
  } else if (isAvailable) {
    noFill();
    stroke(0,255,200, 50+(phaseIndex===0?0.5:nodePulse[phaseIndex])*100);
    strokeWeight(2);  ellipse(x,y,baseSize+20+pulseSize,baseSize+20+pulseSize);
  }

  if (isCompleted) {
    fill(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2],200);
    stroke(255);  strokeWeight(3);
  } else if (isAvailable) {
    fill(isSelected?color(40,80,80):(phaseIndex===0?color(0,80,80):color(0,60,60)),220);
    stroke(0,255,200);  strokeWeight(isSelected?4:2);
  } else {
    fill(30,35,45,220);  stroke(80,90,100);  strokeWeight(2);
  }
  ellipse(x, y, baseSize, baseSize);

  textAlign(CENTER, CENTER);
  if (isCompleted) {
    if (phaseEfficiency[phaseIndex] === 100) {
      noFill();  stroke(255,215,0, 150+sin(millis()*0.006)*105);  strokeWeight(4);
      ellipse(x,y,baseSize+35,baseSize+35);  fill(255,215,0);
    } else { fill(phaseEfficiency[phaseIndex]===90 ? color(220,220,255) : color(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2])); }
    textStyle(BOLD);  textSize(24);  text(nf(phaseEfficiency[phaseIndex],0,0)+"%", x, y);
    if (phaseEfficiency[phaseIndex]===100) { textSize(12);  fill(255,215,0);  text("★ PERFECT ★",x,y+28); }
  } else if (isLocked) {
    fill(100,110,120);  textStyle(BOLD);  textSize(18);  text("LOCK",x,y);
  } else {
    fill(isSelected?color(255,200,0):color(0,255,200));
    textStyle(BOLD);  textSize(18);  text(phaseIndex===0?"START":"PLAY",x,y+2);
  }
  textStyle(NORMAL);

  // Phase label above — FIX: proper if/else instead of broken ternary inside fill()
  if (isCompleted)       fill(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2]);
  else if (isAvailable)  fill(isSelected?color(255,200,0):color(0,255,200));
  else                   fill(120,130,140);
  textSize(14);  textAlign(CENTER,CENTER);  text("PHASE "+phaseIndex, x, y-65);

  fill(255);  textStyle(BOLD);  textSize(16);  text(phaseNames[phaseIndex], x, y+65);  textStyle(NORMAL);
  fill(180,190,200);  textSize(12);  text(phaseSubtitles[phaseIndex], x, y+85);

  let statusLabel, statusColor;
  if (isCompleted)      { statusLabel = "COMPLETED"; statusColor = color(0,255,150); }
  else if (isAvailable) { statusLabel = phaseIndex===0?"START HERE":(isSelected?"SELECTED":"AVAILABLE"); statusColor = isSelected?color(255,200,0):color(0,255,200); }
  else                  { statusLabel = "LOCKED";    statusColor = color(255,80,80); }
  fill(statusColor);  textSize(13);  text(statusLabel, x, y+105);

  if (dist(getInputX(),getInputY(),x,y) < baseSize/2 && isAvailable) {
    noFill();  stroke(255,200);  strokeWeight(2);  ellipse(x,y,baseSize+40,baseSize+40);
    fill(255,255,0);  textSize(14);  text(isCompleted?"REPLAY":"START", x, y+130);
  }
}

// =========================================================
// LICENSE SCREEN
// =========================================================
function drawLicenseScreen() {
  let bgC1 = color(5,15,35);
  if (needsGradientRedraw || !lastBgColor1) {
    updateGradientBuffer(bgGradientBuffer, bgC1, color(25,40,65));
    lastBgColor1 = bgC1;  lastBgColor2 = color(25,40,65);  needsGradientRedraw = false;
  }
  image(bgGradientBuffer, GAME_W/2, GAME_H/2);

  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0,255,200);  textStyle(BOLD);  textAlign(CENTER);  textSize(56);
  text("SOFTWARE LICENSE AGREEMENT", GAME_W/2, 120);
  stroke(0,255,200,100);  strokeWeight(2);  line(GAME_W/2-300,150,GAME_W/2+300,150);

  fill(15,30,50,220);  stroke(0,255,200,150);  strokeWeight(2);  rect(GAME_W/2,GAME_H/2-20,700,400,20);

  fill(255);  textStyle(NORMAL);  textSize(22);  textAlign(CENTER);
  let lines = [
    "BioBalance: Digestive Control System","",
    "Copyright © 2026 Altheo Cardillo. All Rights Reserved.","",
    "This software is licensed for educational use only.",
    "Redistribution, modification, or commercial use",
    "without express written permission is strictly prohibited.","",
    "This is an Educational Game Prototype.",
    "System Designer: Altheo Cardillo","",
    "By clicking 'Agree', you accept these terms."
  ];
  let yp = GAME_H/2-150;
  for (let l of lines) { text(l, GAME_W/2, yp);  yp += 25; }

  fill(100,120,140,50);  textSize(12);  text(creatorID, GAME_W-150, GAME_H-20);

  let btnY=GAME_H/2+230, btnH=50, spacing=40;
  textStyle(BOLD);  textSize(22);
  let aw=textWidth("AGREE")+50, dw=textWidth("DISAGREE")+50;
  let ax=GAME_W/2-dw/2-spacing/2-aw/2, dx=GAME_W/2+aw/2+spacing/2+dw/2;

  let ha=getInputX()>ax-aw/2&&getInputX()<ax+aw/2&&getInputY()>btnY-btnH/2&&getInputY()<btnY+btnH/2;
  fill(ha?color(0,200,160):color(0,100,100),240);  stroke(0,255,200);  strokeWeight(ha?4:2);
  rect(ax,btnY,aw,btnH,10);  fill(255);  textAlign(CENTER,CENTER);  text("AGREE",ax,btnY-3);

  let hd=getInputX()>dx-dw/2&&getInputX()<dx+dw/2&&getInputY()>btnY-btnH/2&&getInputY()<btnY+btnH/2;
  fill(hd?color(200,50,50):color(100,30,30),240);  stroke(255,100,100);  strokeWeight(hd?4:2);
  rect(dx,btnY,dw,btnH,10);  fill(255);  textAlign(CENTER,CENTER);  text("DISAGREE",dx,btnY-3);

  drawFooter();
}

// =========================================================
// UTILITY DRAW FUNCTIONS
// =========================================================
function drawFooter() {
  textAlign(LEFT);   // FIX: reset at start
  fill(180);  textStyle(NORMAL);  textSize(12);
  text(developer, 20, GAME_H - 15);
  textAlign(CENTER); // restore for everything else
}

function drawPersistentReturnButton() {
  if (mode !== MODE_TITLE && mode !== MODE_MECHANICS && quizState !== 1) {
    let hov = getInputX()>15&&getInputX()<135&&getInputY()>10&&getInputY()<50;
    fill(hov?80:40,200);  stroke(0,255,200);  strokeWeight(2);
    rect(75,30,120,40,5);
    fill(0,255,200);  textAlign(CENTER,CENTER);  textSize(16);  text("RETURN",75,28);
  }
}

function drawPhaseTitle(t, y) {
  fill(255);  textAlign(CENTER);  textStyle(BOLD);  textSize(24);
  text(t, GAME_W/2, y);  textStyle(NORMAL);
}

function drawHormoneButton(x, y, name, c, active, img) {
  fill(active ? c : color(60,80,100,180));  stroke(255, active?255:50);
  rect(x, y, 200, 160, 20);
  if (img != null) image(img, x, y-10, 100, 100);
  fill(255);  textAlign(CENTER);  textSize(16);  text(name, x, y+60);
}

function drawMeter(x, y, val, label, c) {
  fill(30,45,60);  rect(x, y, 300, 25, 8);
  fill(c);  rect(x-(150-val*0.75), y, val*1.5, 25, 8);
  fill(255);  textAlign(CENTER);  textSize(14);  text(label, x, y-25);
}

function drawNutrient(img, x, y, label, c, sorted, dragging, t) {
  if (sorted) return;
  push();  translate(x, y);
  if (dragging) { noFill();  stroke(255,200);  strokeWeight(3);  ellipse(0,0,70,70); }
  if (img != null) image(img, 0, 0, 60, 60);
  else { fill(c[0],c[1],c[2]);  ellipse(0,0,50,50); }
  if (t > 0 && !dragging) {
    noFill();  stroke(0,255,0);  strokeWeight(4);
    arc(0,0,70,70,-HALF_PI,-HALF_PI+map(t,0,1,0,TWO_PI));
  }
  fill(255);  textAlign(CENTER);  textSize(14);  text(label,0,45);
  pop();
}

function drawProceedButton(x, y) {
  let bw=200, bh=50;
  let hov=getInputX()>x-bw/2&&getInputX()<x+bw/2&&getInputY()>y-bh/2&&getInputY()<y+bh/2;
  fill(hov?80:40,200);  stroke(0,255,200, 150+sin(millis()*0.006)*100);  strokeWeight(3);
  rect(x,y,bw,bh,10);  fill(255);  textStyle(BOLD);  textSize(20);  textAlign(CENTER,CENTER);
  text("PROCEED",x,y-3);  textStyle(NORMAL);
}

function drawNextButton(x, y, label) {
  let bw=200, bh=50;
  let hov=getInputX()>x-bw/2&&getInputX()<x+bw/2&&getInputY()>y-bh/2&&getInputY()<y+bh/2;
  fill(hov?80:40,200);  stroke(0,255,200, 150+sin(millis()*0.006)*100);  strokeWeight(3);
  rect(x,y,bw,bh,10);  fill(255);  textStyle(BOLD);  textSize(20);  textAlign(CENTER,CENTER);
  text(label,x,y-3);  textStyle(NORMAL);
}

function resetNutrientPositions() {
  let minX=60, maxX=GAME_W*0.38, minY=120, maxY=GAME_H-80, minD=90;
  let gx=random(minX,maxX), gy=random(minY,maxY);
  let sx, sy, nx, ny, lx, ly, att=0;

  do { sx=random(minX,maxX); sy=random(minY,maxY); att++; }
  while (dist(sx,sy,gx,gy)<minD && att<200);  att=0;

  do { nx=random(minX,maxX); ny=random(minY,maxY); att++; }
  while ((dist(nx,ny,gx,gy)<minD||dist(nx,ny,sx,sy)<minD) && att<200);  att=0;

  do { lx=random(minX,maxX); ly=random(minY,maxY); att++; }
  while ((dist(lx,ly,gx,gy)<minD||dist(lx,ly,sx,sy)<minD||dist(lx,ly,nx,ny)<minD) && att<200);

  tGX=glucoseX=gx;  tGY=glucoseY=gy;
  tSGLTX=sodiumSGLTX=sx;  tSGLTY=sodiumSGLTY=sy;
  tNH3X=sodiumNH3X=nx;    tNH3Y=sodiumNH3Y=ny;
  tLX=lipidX=lx;          tLY=lipidY=ly;

  gTimer=sGLTTimer=nhe3Timer=lTimer=0;
  capillaryPulse=lactealPulse=nhe3Pulse=0;
  glucoseVX=glucoseVY=sodiumSGLTVX=sodiumSGLTVY=sodiumNH3VX=sodiumNH3VY=lipidVX=lipidVY=0;
}

// =========================================================
// QUIZ SYSTEM
// =========================================================
function getTextWidth(str, font, size) { textSize(size);  return textWidth(str); }

function drawWrappedText(txt, x, y, maxWidth, lineHeight, font, size) {
  textSize(size);
  let words = txt.split(' '), lines = [], cur = '';
  for (let w of words) {
    let test = cur + (cur.length > 0 ? ' ' : '') + w;
    if (textWidth(test) > maxWidth && cur.length > 0) { lines.push(cur);  cur = w; }
    else cur = test;
  }
  lines.push(cur);
  let startY = y - (lines.length - 1) * lineHeight / 2;
  textAlign(CENTER, CENTER);
  for (let i = 0; i < lines.length; i++) text(lines[i], x, startY + i * lineHeight);
}

function currentPhaseIndex() {
  if (mode===MODE_PHASE0) return 0;
  if (mode===MODE_PHASE1) return 1;
  if (mode===MODE_PHASE2) return 2;
  if (mode===MODE_PHASE3) return 3;
  return -1;
}

function calculateEfficiency(phaseIdx) {
  if (!firstTrySuccess[phaseIdx] && gateAttemptsCount[phaseIdx]===1) return 100;
  if (gateAttemptsCount[phaseIdx]===1) return 90;
  return 80;
}

function initQuizBanks() {
  let phaseIdx = currentPhaseIndex();
  if (phaseIdx < 0) return;
  let fullBank = [];

  if (phaseIdx === 0) {
    fullBank = [
      new Question("What nerve carries signals from your brain to your stomach when you smell food?",
        ["The vagus nerve connects brain to digestive organs","The spinal cord connects brain to digestive organs","The optic nerve connects brain to digestive organs"],0),
      new Question("Why does your mouth produce more saliva when smelling delicious food?",
        ["Saliva contains enzymes that start breaking down food","Saliva contains minerals that start breaking down food","Saliva contains chemicals that start breaking down food"],0),
      new Question("What happens to your liver's glucose output when insulin levels rise?",
        ["Glucose release decreases to prepare for incoming food","Glucose release increases to prepare for incoming food","Glucose release stabilizes to prepare for incoming food"],0),
      new Question("How does your body react when you smell potentially spoiled food?",
        ["Saliva decreases and nausea signals are triggered","Saliva increases and nausea signals are triggered","Saliva continues and nausea signals are triggered"],0),
      new Question("Why does insulin release before you start the eating process?",
        ["To prepare cells for absorbing incoming glucose sugar","To prepare cells for absorbing incoming protein sugar","To prepare cells for absorbing incoming mineral sugar"],0),
      new Question("Why does your body prepare for digestion before food arrives?",
        ["Early preparation improves nutrient processing efficiency","Early preparation destroys nutrient processing efficiency","Early preparation minimizes nutrient processing efficiency"],0),
      new Question("What does the scent slider control in the simulation game?",
        ["The concentration of food aroma reaching the brain","The concentration of food taste reaching the brain","The concentration of food color reaching the brain"],0),
    ];
  } else if (phaseIdx === 1) {
    fullBank = [
      new Question("Why must proteins unfold before enzymes can digest them?",
        ["Unfolding exposes bonds for enzymes to reach and break","Unfolding shields bonds for enzymes to reach and break","Unfolding blocks bonds for enzymes to reach and break"],0),
      new Question("What protects your stomach from its own digestive acid?",
        ["A thick mucus layer and bicarbonate barrier system","A thin mucus layer and bicarbonate barrier system","A hard mucus layer and bicarbonate barrier system"],0),
      new Question("How does pepsinogen become active pepsin in the simulation?",
        ["Stomach acid triggers the change to active form","Stomach base triggers the change to active form","Stomach salt triggers the change to active form"],0),
      new Question("What happens if stomach acid drops below pH 1.5?",
        ["The protective mucus barrier can be damaged here","The protective mucus barrier can be restored here","The protective mucus barrier can be thickened here"],0),
      new Question("Why does pepsin stop working when pH rises above 5?",
        ["The enzyme's shape changes and stops functioning","The enzyme's shape remains and stops functioning","The enzyme's shape enlarges and stops functioning"],0),
      new Question("What does the pH slider control in the simulation game?",
        ["The acidity level of stomach digestive acid","The motility level of stomach digestive acid","The viscosity level of stomach digestive acid"],0),
      new Question("What happens to the protein image when pepsin is active?",
        ["It shrinks as pepsin breaks the protein chains","It expands as pepsin breaks the protein chains","It vibrates as pepsin breaks the protein chains"],0),
    ];
  } else if (phaseIdx === 2) {
    fullBank = [
      new Question("Why must stomach acid be reduced in the small intestine?",
        ["Intestinal enzymes need neutral pH to function","Intestinal enzymes need acidic pH to function","Intestinal enzymes need basic pH to function"],0),
      new Question("What does the Secretin hormone button spray in the simulation?",
        ["Hormone that triggers bicarbonate to reduce acid","Hormone that triggers bicarbonate to increase acid","Hormone that triggers bicarbonate to modify acid"],0),
      new Question("What does the CCK hormone button spray in the simulation?",
        ["Hormone that triggers bile and fat-digesting enzymes","Hormone that triggers bile and fat-digesting hormones","Hormone that triggers bile and fat-digesting peptides"],0),
      new Question("Why do hormone levels drop when you stop spraying?",
        ["The body regulates to prevent over-neutralizing","The body regulates to prevent under-neutralizing","The body regulates to prevent re-neutralizing"],0),
      new Question("What does it mean when both hormone meters hit the green zone?",
        ["The intestine has balanced pH for digestion","The intestine has elevated pH for digestion","The intestine has restricted pH for digestion"],0),
      new Question("Why are both Secretin and CCK needed together?",
        ["One reduces acid while the other digests fats","One produces acid while the other digests fats","One modifies acid while the other digests fats"],0),
      new Question("What happens if you only spray Secretin and not CCK?",
        ["Acid reduces but fats won't be properly digested","Acid increases but fats won't be properly digested","Acid stabilizes but fats won't be properly digested"],0),
    ];
  } else {
    fullBank = [
      new Question("Why do glucose and sodium enter the blood capillary together?",
        ["They share a channel using sodium's energy","They share a channel using sodium's pressure","They share a channel using sodium's velocity"],0),
      new Question("Why do lipids go to the lacteal instead of blood capillaries?",
        ["Fats are too large to fit into blood vessels directly","Fats are too small to fit into blood vessels directly","Fats are too dense to fit into blood vessels directly"],0),
      new Question("What does the NHE3 zone do with sodium in the simulation?",
        ["Trades sodium for hydrogen ions to balance pH","Trades sodium for carbon ions to balance pH","Trades sodium for oxygen ions to balance pH"],0),
      new Question("Why do nutrients bounce back from wrong zones?",
        ["Cell membranes only allow specific molecules through","Cell membranes only allow multiple molecules through","Cell membranes only allow reactive molecules through"],0),
      new Question("What happens when you drag sodium near glucose in the capillary zone?",
        ["Sodium helps glucose absorb faster together","Sodium helps glucose absorb slower together","Sodium helps glucose absorb steady together"],0),
      new Question("What do the three zones in the villi simulation represent?",
        ["Blood capillary, sodium exchanger, and lymphatic lacteal","Blood capillary, sodium exchanger, and stomach lining","Blood capillary, sodium exchanger, and mouth cavity"],0),
      new Question("Why are villi shaped like tiny fingers?",
        ["More surface area absorbs nutrients faster","Less surface area absorbs nutrients faster","Same surface area absorbs nutrients faster"],0),
    ];
  }

  // Fisher-Yates shuffle, pick 5
  for (let i = fullBank.length - 1; i > 0; i--) {
    let j = Math.floor(random(i + 1));
    [fullBank[i], fullBank[j]] = [fullBank[j], fullBank[i]];
  }
  phaseBank     = fullBank.slice(0, 5);
  questionOrder = [0, 1, 2, 3, 4];
}

function prepareQuestion() {
  for (let i = 0; i < 3; i++) {
    let r = Math.floor(random(3));
    [answerOrder[i], answerOrder[r]] = [answerOrder[r], answerOrder[i]];
  }
}

function startReflectionGate() {
  let phaseIdx = currentPhaseIndex();
  if (phaseIdx < 0) return;
  gateAttemptsCount[phaseIdx]++;
  initQuizBanks();
  quizState = 1;  quizSubState = 0;
  score = 0;  currentQuestionIdx = 0;
  feedbackMsg = "";  feedbackTimer = 0;
  gateJustCompleted = false;    // FIX: now declared as global — no crash
  wrongAnswers = [];
  prepareQuestion();
}

function drawReflectionGate() {
  // FIX: replaced emptied setGradient() call with cached buffer
  image(bgGradientBuffer, GAME_W / 2, GAME_H / 2);
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(10, 15, 25, 200);  noStroke();
  rect(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);

  let cx = GAME_W / 2;
  let phaseIdx = currentPhaseIndex();

  // ── Sub-state 0: question ─────────────────────────────
  if (quizSubState === 0) {
    noFill();
    stroke(0, 255, 200, 100 + sin(millis() * 0.003) * 50);
    strokeWeight(3);  rect(cx, GAME_H/2, GAME_W-40, GAME_H-40, 20);

    fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(48);
    text("KNOWLEDGE CHECK", cx, 80);
    textStyle(NORMAL);  textSize(22);  fill(150, 200, 255);
    let pname = ["PHASE 0 — BRAIN FOOD RESPONSE","PHASE 1 — STOMACH ACID & ENZYMES",
                  "PHASE 2 — HORMONE BALANCE","PHASE 3 — NUTRIENT ABSORPTION"][phaseIdx] || "";
    text(pname, cx, 115);

    textSize(15);  fill(200);
    let att = gateAttemptsCount[phaseIdx];
    if      (att===1 && !firstTrySuccess[phaseIdx]) text("FIRST ATTEMPT — 100% MASTERY AVAILABLE", cx, 140);
    else if (firstTrySuccess[phaseIdx])              text("REPLAY ATTEMPT — 90% MAXIMUM", cx, 140);
    else                                             text("ATTEMPT #"+att+" — 80% MAXIMUM", cx, 140);

    let barW=400, barH=20;
    noFill();  stroke(255,50);  strokeWeight(1);  rect(cx,165,barW,barH,10);
    fill(0,255,150);  noStroke();
    let pw2 = map(currentQuestionIdx,0,5,0,barW);
    rect(cx-barW/2+pw2/2, 165, pw2, barH, 10);
    fill(200);  textSize(16);  text("Question "+(currentQuestionIdx+1)+" of 5", cx, 205);

    if (!phaseBank || currentQuestionIdx >= 5) {
      fill(255,0,0);  textSize(20);  text("ERROR: Quiz data missing. Please restart.", cx, 250);  return;
    }

    let q = phaseBank[questionOrder[currentQuestionIdx]];
    fill(255);  textSize(22);  textAlign(CENTER,CENTER);
    drawWrappedText(q.question, cx, 270, GAME_W-200, 30, null, 22);

    for (let i = 0; i < 3; i++) {
      let ch = q.choices[answerOrder[i]];
      textSize(18);
      let tw = textWidth(ch);
      let bw3 = min(GAME_W-100, max(500, tw+80)), bh3 = 80;
      let y   = 370 + i * 115;
      let hov = getInputX()>cx-bw3/2 && getInputX()<cx+bw3/2 &&
                getInputY()>y-bh3/2  && getInputY()<y+bh3/2;
      fill(hov?color(25,50,80):color(15,30,50));
      stroke(hov?color(0,255,200):color(255,80));  strokeWeight(hov?4:2);
      rect(cx,y,bw3,bh3,15);
      fill(255);  textSize(18);  textAlign(CENTER,CENTER);
      if (tw > bw3-60) drawWrappedText(ch, cx-bw3/2+30, y-5, bw3-60, 22, null, 18);
      else             text(ch, cx, y);
    }

    fill(200);  textStyle(NORMAL);  textSize(18);  textAlign(CENTER);
    text("Score: "+score+" / 5 Correct", cx, GAME_H-80);

    if (feedbackTimer > 0) {
      if (feedbackMsg === "CORRECT") {
        fill(0, 255, 100);
        if (feedbackTimer === 35) {
          // FIX: pass array [r,g,b] — NOT color() object — so display() can index it
          for (let i = 0; i < 20; i++)
            successParticles.push(new SuccessParticle(cx, GAME_H-150, [0, 255, 100]));
        }
      } else { fill(255,50,50); }
      textStyle(BOLD);  textSize(28);  text(feedbackMsg, cx, GAME_H-130);
      feedbackTimer--;
    }
    for (let i = successParticles.length-1; i >= 0; i--) {
      successParticles[i].update();  successParticles[i].display();
      if (successParticles[i].isDead()) successParticles.splice(i,1);
    }

  // ── Sub-state 1: success ──────────────────────────────
  } else if (quizSubState === 1) {
    fill(0,20,10,220);  noStroke();  rect(cx,GAME_H/2,GAME_W,GAME_H);
    let pulse3=(sin(millis()*0.006)+1)/2.0;
    fill(0,255,150, 200+pulse3*55);  textStyle(BOLD);  textSize(56);  textAlign(CENTER,CENTER);
    text("GREAT JOB!", cx, GAME_H/2-80);

    let pname2=["PHASE 0 — BRAIN FOOD RESPONSE","PHASE 1 — STOMACH ACID & ENZYMES",
                "PHASE 2 — HORMONE BALANCE","PHASE 3 — NUTRIENT ABSORPTION"][phaseIdx]||"";
    let eff = calculateEfficiency(phaseIdx);
    fill(255,215,0);  textSize(40);  text(nf(eff,0,0)+"% MASTERY ACHIEVED", cx, GAME_H/2-20);
    fill(255);  textStyle(NORMAL);  textSize(24);
    text("You've successfully learned about", cx, GAME_H/2+30);
    textStyle(BOLD);  text(pname2, cx, GAME_H/2+70);  textStyle(NORMAL);

    if (mode===MODE_PHASE3) {
      textSize(22);  fill(0,255,200);  text("The digestive journey is complete!", cx, GAME_H/2+115);
      textSize(19);  fill(200,255,230);
      text("From smelling food all the way to absorbing nutrients —", cx, GAME_H/2+148);
      text("you've explored how your entire digestive system works.", cx, GAME_H/2+172);
      text("Well done, BioBalancer!", cx, GAME_H/2+196);
    } else {
      if (eff===100) { textStyle(BOLD);  textSize(28);  fill(255,215,0);  text("★ PERFECT FIRST-TRY MASTERY ★", cx, GAME_H/2+110);  textStyle(NORMAL); }
      else if (eff===90) { textSize(20);  fill(220,220,255);  text("First-try on replay (100% only on first attempt)", cx, GAME_H/2+110); }
      else { textSize(20);  fill(200);  text("Multiple attempts needed — replay to improve!", cx, GAME_H/2+110); }
    }
    fill(0,255,200);  textSize(20);
    text(mode===MODE_PHASE3?"Click anywhere to view your final report"
                           :"Click anywhere to continue to the next phase",
         cx, GAME_H/2+(mode===MODE_PHASE3?230:160));

    // Success spawn: every 5 frames at 60fps = 83ms
    successSpawnTimer += delta;
    if (successSpawnTimer >= 83) {
      successSpawnTimer = 0;
      for (let i=0;i<5;i++)
        successParticles.push(new SuccessParticle(random(GAME_W), GAME_H+10, [0,255,200]));
    }
    for (let i=successParticles.length-1;i>=0;i--) {
      successParticles[i].update();  successParticles[i].display();
      if (successParticles[i].isDead()) successParticles.splice(i,1);
    }

  // ── Sub-state 2: failure ──────────────────────────────
  } else if (quizSubState === 2) {
    fill(20,10,10,220);  noStroke();  rect(cx,GAME_H/2,GAME_W,GAME_H);
    fill(255,100,100);  textStyle(BOLD);  textSize(48);  textAlign(CENTER,CENTER);
    text("NOT QUITE — LET'S TRY AGAIN!", cx, GAME_H/2-100);
    fill(255);  textStyle(NORMAL);  textSize(22);
    text("You need all 5 correct to move forward.", cx, GAME_H/2-55);

    // FIX: wrong answers are now displayed so students can learn
    if (wrongAnswers.length > 0) {
      fill(255,200,100);  textStyle(BOLD);  textSize(18);
      text("Questions you missed:", cx, GAME_H/2-10);  textStyle(NORMAL);
      let wy = GAME_H/2+25;
      for (let wa of wrongAnswers) {
        fill(255,100,100);  textSize(15);
        text("Q"+wa.questionNum+" — Your answer: "+wa.yourAnswer, cx, wy);  wy+=22;
        fill(100,255,150);
        text("✓ Correct: "+wa.correctAnswer, cx, wy);  wy+=30;
      }
    }

    fill(0,255,200);  textStyle(BOLD);  textSize(20);
    text("Click anywhere to return and replay the phase", cx, GAME_H-80);  textStyle(NORMAL);
  }

  drawFooter();
}

function handleQuizClick() {
  let phaseIdx = currentPhaseIndex();

  if (quizSubState === 1) {
    quizState=0;  quizSubState=0;  successParticles=[];
    let eff2=calculateEfficiency(phaseIdx);
    if (eff2===100) firstTrySuccess[phaseIdx]=true;
    if (!phaseCompleted[phaseIdx]||eff2>phaseEfficiency[phaseIdx]) phaseEfficiency[phaseIdx]=eff2;
    phaseCompleted[phaseIdx]=true;
    if      (mode===MODE_PHASE0) mode=MODE_PHASE1;
    else if (mode===MODE_PHASE1) mode=MODE_PHASE2;
    else if (mode===MODE_PHASE2) mode=MODE_PHASE3;
    else if (mode===MODE_PHASE3) { reportPlayed=false;  mode=MODE_FINISH; }
    gateAttemptsCount[phaseIdx]=0;  wrongAnswers=[];  transitionAlpha=0;
    return;
  }

  if (quizSubState === 2) {
    quizState=0;  quizSubState=0;  successParticles=[];  wrongAnswers=[];
    resetSimulationToPhaseStart();  return;
  }

  if (!phaseBank || currentQuestionIdx >= 5) return;

  let q   = phaseBank[questionOrder[currentQuestionIdx]];
  let cxq = GAME_W / 2;

  for (let i = 0; i < 3; i++) {
    let ch = q.choices[answerOrder[i]];
    textSize(18);
    let tw=textWidth(ch), bw4=min(GAME_W-100,max(500,tw+80)), bh4=80;
    let y = 370 + i * 115;
    if (getInputX()>cxq-bw4/2 && getInputX()<cxq+bw4/2 &&
        getInputY()>y-bh4/2   && getInputY()<y+bh4/2) {
      if (answerOrder[i] === q.correctIndex) {
        score++;  feedbackMsg="CORRECT";  if (correctSfx) correctSfx.play();
      } else {
        feedbackMsg="INCORRECT";
        wrongAnswers.push({questionNum:currentQuestionIdx+1, yourAnswer:ch, correctAnswer:q.choices[q.correctIndex]});
        if (wrongSfx) wrongSfx.play();
      }
      feedbackTimer=40;  currentQuestionIdx++;
      if (currentQuestionIdx >= 5) {
        feedbackMsg="";  feedbackTimer=0;
        if (score===5) {
          quizSubState=1;
          // FIX: array not color()
          for (let i2=0;i2<50;i2++)
            successParticles.push(new SuccessParticle(random(GAME_W),random(GAME_H),[0,255,200]));
        } else { quizSubState=2; }
      } else { prepareQuestion(); }
      break;
    }
  }
}

function resetSimulationToPhaseStart() {
  organPulse=1.0;  shakeIntensity=0;
  if (mode===MODE_PHASE0) {
    smellSliderX=GAME_W/2-200;  salivaLevel=0;  foodType=0;  cephalicAcid=0;
    cephalicReady=false;  delayedSmell=0;  foodScale=0;  isChewing=false;
    hasSwallowed=false;  cephalicTimer=0;  insulinLevel=0;
    hepaticGlucoseOutput=100;  peripheralGlucoseUptake=0;  emeticTimer=0;
    aromaParticles=[];  cephalicSuccessPlayed=false;  warningPlayed=false;
    phase0ProceedSoundPlayed=false;
    if (warningSfx && warningSfx.isPlaying()) warningSfx.stop();
  } else if (mode===MODE_PHASE1) {
    stomachAcid=0;  ulcerRisk=0;  sliderX=GAME_W/2-150;
    proteinScale=1.0;  pepsinTimer=0;  enzymeActive=false;
    pepsinState=PepsinState.INACTIVE;  pepsinConcentration=0;
    pepsinogenReserve=100;  pepsinRestoredFlag=false;
    acidBubbles=[];  pepsinSuccessPlayed=false;
    phase1ProceedSoundPlayed=false;  phase1Complete=false;
    if (warningSfx && warningSfx.isPlaying()) warningSfx.stop();
  } else if (mode===MODE_PHASE2) {
    secretinLevel=0;  cckLevel=0;  homeostasisReached=false;
    homeostasisJustReached=false;  homeostasisDisplayTimer=0;
    homeostasisLocked=false;  hormoneMist=[];
    phase2ButtonSuccessPlayed=false;  phase2ProceedSoundPlayed=false;
  } else if (mode===MODE_PHASE3) {
    glucoseSorted=false;  sodiumSGLTSorted=false;
    sodiumNHE3Sorted=false;  lipidSorted=false;
    resetNutrientPositions();  hormoneMist=[];
    phase3ProceedDelay=0;  phase3ProceedSoundPlayed=false;
  }
}

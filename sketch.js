// ── AUDIO ─────────────────────────────────────────────────
let bgLoop, clickSfx, acidSfx, successSfx, spraySfx, dragSfx,
    warningSfx, reportSfx, denatureSfx, bounceSfx, nhe3Sfx,
    wrongSfx, correctSfx, swallowSfx, chewSfx;
let bgLoopStarted = false;  // only set to true once — never reset (prevents loop stacking)

// =========================================================
// CENTRAL SOUND MANAGER — prevents Web Audio memory leaks
// Always stop before play; never stack audio nodes on mobile
// =========================================================
let _sfxLastFired = new Map();  // per-sound ms timestamp — prevents double-fire
let _nhe3LastFired = 0;  // nhe3Sfx gets its own 600ms gate (4 absorptions in phase3)

function playSoundOnce(sound) {
  if (!sound || !sound.isLoaded()) return;
  let now = millis();
  if (now - (_sfxLastFired.get(sound) || 0) < 80) return;  // 80ms cooldown per sound
  _sfxLastFired.set(sound, now);
  if (!sound.isPlaying()) { sound.setVolume(masterVolume); sound.play(); }
  // If already playing: skip — do NOT stop+restart (avoids node stacking on mobile)
}

function playNhe3Sfx() {
  if (!nhe3Sfx || !nhe3Sfx.isLoaded()) return;
  let now = millis();
  if (now - _nhe3LastFired < 600) return;  // 600ms between absorption pings
  _nhe3LastFired = now;
  if (!nhe3Sfx.isPlaying()) nhe3Sfx.play();
}

function loopSound(sound, vol) {
  if (!sound || !sound.isLoaded()) return;
  if (!sound.isPlaying()) {
    // Only call loop() when genuinely stopped — not just paused
    sound.loop();
  }
  sound.setVolume((vol !== undefined ? vol : 0.5) * masterVolume);
}

function stopAllLoopingSounds() {
  // Stop every sound — looping, one-shot, or any overlapping node
  // bgLoop excluded — volume-only control, never stopped after startup
  [acidSfx, warningSfx, spraySfx,
   dragSfx, bounceSfx, nhe3Sfx, correctSfx, wrongSfx, successSfx,
   denatureSfx, reportSfx, clickSfx].forEach(function(s) {
    if (s && s.isPlaying()) s.stop();
  });
  // Reset audio flags so sounds can restart cleanly next time
  sfx_wantWarning = false;
  sfx_wantAcid    = false;
  sfx_wantSpray   = false;
  warningPlayed         = false;
  cephalicSuccessPlayed = false;
  pepsinSuccessPlayed   = false;
  phase2ButtonSuccessPlayed = false;
  phase4ProceedSoundPlayed  = false;
  reportSfxTriggered    = false;
  reportSfxPlayed       = false;
}

// ── AUDIO FLAGS ────────────────────────────────────────────
let cephalicSuccessPlayed = false;   // FIX: was missing from doc2 globals
let pepsinSuccessPlayed   = false;   // FIX: was missing from doc2 globals
let warningPlayed         = false;   // FIX: was missing from doc2 globals
let reportPlayed          = false;
let reportSfxTriggered    = false;
let reportSfxPlayed       = false;  // one-time trigger: fires only when report first opens
let phase2ButtonSuccessPlayed = false;
let phase0ProceedSoundPlayed  = false;
let swallowProceedDelay       = 0;
const SWALLOW_PROCEED_FRAMES  = 120;  // 2 seconds at 60fps
let phase1ProceedSoundPlayed  = false;
let phase2ProceedSoundPlayed  = false;
let phase3ProceedSoundPlayed  = false;
let phase4ProceedSoundPlayed  = false;

// ── LICENSE ────────────────────────────────────────────────
let developer       = "Developed by Altheo Cardillo © 2026";
let creatorID       = "Theos_2026_DigestiveSystemApp";

// ── SAVE / LOAD PROGRESS ───────────────────────────────────
// SAVE_KEY is tied to the SW cache name (biobalance-v3.2).
// When the user uninstalls the PWA or clears app cache/storage,
// the SW cache is wiped — and since the key includes the version,
// any old localStorage entry from a different version is ignored.
// This mirrors Play Store behaviour: uninstall = fresh start,
// normal exit = progress kept.
const SAVE_KEY = 'biobalance-save-v3.2';  // ← must match CACHE_NAME in sw.js

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      acceptedLicense: acceptedLicense,
      phaseCompleted:  phaseCompleted,
      phaseEfficiency: phaseEfficiency,
      firstTrySuccess: firstTrySuccess
    }));
  } catch(e) {}
}

function loadProgress() {
  try {
    // Wipe any save from a different version (old SAVE_KEY won't match)
    for (let i = 0; i < localStorage.length; i++) {
      let k = localStorage.key(i);
      if (k && k.startsWith('biobalance-save-') && k !== SAVE_KEY) {
        localStorage.removeItem(k);
      }
    }
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    let p = JSON.parse(raw);
    if (p.acceptedLicense === true) { acceptedLicense = true; showLicenseScreen = false; }
    if (Array.isArray(p.phaseCompleted))  phaseCompleted  = p.phaseCompleted;
    if (Array.isArray(p.phaseEfficiency)) phaseEfficiency = p.phaseEfficiency;
    if (Array.isArray(p.firstTrySuccess)) firstTrySuccess = p.firstTrySuccess;
  } catch(e) {
    localStorage.removeItem(SAVE_KEY);
  }
}

let acceptedLicense   = false;
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
const MODE_PHASE4        = 9;
const MODE_SETTINGS      = 10;
const MODE_INFO          = 11;
const MODE_EXIT_CONFIRM  = 12;

// ── SETTINGS ───────────────────────────────────────────────
let masterVolume = 0.8;
let settingsReturnMode = MODE_TITLE;
let infoReturnMode     = MODE_TITLE;
let exitReturnMode     = MODE_TITLE;  // remembers which screen to go back to if exit cancelled

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
let secretinLevel = 0, cckLevel = 0, decayRate = 0.30;
let homeostasisReached      = false;
let homeostasisJustReached  = false;
let homeostasisDisplayTimer = 0;
const HOMEOSTASIS_DISPLAY_FRAMES = 65;
let homeostasisLocked = false;
let greenZoneTimer = 0;                   // counts dt-ticks both hormones are in green zone
const GREEN_ZONE_REQUIRED = 25 * 60;     // 25 seconds × 60 ticks = 1500 ticks
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
const PHASE3_PROCEED_DELAY_FRAMES = 90;
let dragOffsetX = 0, dragOffsetY = 0;

// ── PHASE 4 VARIABLES ─────────────────────────────────────
let waterSliderX;
let waterAbsorbed        = 0;
let actualWaterAbsorbed  = 0;
let stoolConsistency     = 0;
let peristalsisProgress  = 0;
let peristalsisActive    = false;
let peristalsissComplete = false;
let phase4Ready          = false;
let phase4ProceedDelay   = 0;
const PHASE4_PROCEED_DELAY_FRAMES = 180;  // 3 seconds at 60fps — hold optimal then proceed
const WP_X = [
  -153.3,-163.0,-183.0,-193.0,-206.0,-217.0,-223.0,-186.0,-154.0,-129.0,
  -101.0,-79.0,-46.0,-23.0,19.0,56.0,97.0,142.0,180.0,209.0,
  241.0,243.0,228.0,203.0,199.0,215.0,230.0,223.0,189.0,154.0,
  113.0,69.0,48.0,8.0,-21.0,-25.0,-10.0,-3.0,0.0
];
const WP_Y = [
  98.7,74.0,51.0,-1.0,-44.0,-92.0,-115.0,-145.0,-179.0,-187.0,
  -178.0,-169.0,-164.0,-161.0,-166.0,-170.0,-182.0,-184.0,-204.0,-221.0,
  -214.0,-191.0,-157.0,-131.0,-94.0,-55.0,-1.0,42.0,75.0,86.0,
  87.0,71.0,59.0,48.0,61.0,92.0,118.0,174.0,226.0
];

// ── JOURNEY MAP ────────────────────────────────────────────
let phaseCompleted  = [false, false, false, false, false];
let phaseEfficiency = [0, 0, 0, 0, 0];
let nodePulse       = [0, 0, 0, 0, 0];
let connectionGlow  = 0;
let phaseNames     = ["BRAIN FOOD RESPONSE", "STOMACH ACID CONTROL", "HORMONE BALANCE", "NUTRIENT ABSORPTION", "WASTE & ELIMINATION"];
let phaseSubtitles = ["Cephalic Phase", "Gastric Phase", "Intestinal Phase", "Villi Transport", "Large Intestine"];
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
  ["After completing each phase, you will face", "a Knowledge Check — 5 questions about",
   "the biology you just experienced.", "Score 5/5 on your first try for full marks.",
   "Wrong answers are shown after the quiz."],
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
let phaseAttempts     = [0, 0, 0, 0, 0];
let gateAttemptsCount = [0, 0, 0, 0, 0];
let firstTrySuccess   = [false, false, false, false, false];
let wrongAnswers      = [];
let lastClickTime     = 0;   // debounce for quiz clicks
let quizModeSelected  = 0;   // 0=not chosen, 2=short quiz, 5=full quiz
let shortQuizBank     = [];  // 2 hardcoded structural/functional Q per phase

// ── ASSETS ─────────────────────────────────────────────────
let stomachImg, intestineImg, glucoseImg, sodiumImg, proteinImg, lipidImg, villusImg;
let headImg, deliciousImg, spoiledImg;
let hormone1Img, hormone2Img, glucoseZoneImg, sodiumZoneImg;
let largeIntImg;

// ── PARTICLE SYSTEMS ───────────────────────────────────────
let phase0Particles  = [];
let phase1Particles  = [];
let phase2Particles  = [];
let phase3Particles  = [];
let phase4Particles  = [];
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
let scaleX  = 1;       // horizontal stretch factor
let scaleY  = 1;       // vertical stretch factor
let scaleF  = 1;       // uniform scale (kept for compat)
let offsetX = 0;       // always 0 in stretch mode
let offsetY = 0;       // always 0 in stretch mode
// ── Fixed-timestep accumulator ────────────────────────────
let previousTime  = 0;
let accumulator   = 0;
const FIXED_DT    = 1 / 60;      // 16.666 ms — one logic tick
const TARGET_FPS  = 60;
let dt = 1;                       // kept for lerp rates (= 1.0 per logic tick)
let delta = 16.666;               // kept for spawn timers (ms per tick = 16.666)
let realFPS = 60;
let smoothedFPS = 60;
let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let soundTickTimer = 0;   // throttle sound management to ~4×/sec
// Sound state flags — set by logic, acted on by soundTick() once per frame
let sfx_wantWarning  = false;
let sfx_wantAcid     = false;
let sfx_wantSpray    = false;
let sfx_bounceCooldown = 0;   // prevents bounceSfx from firing every physics frame

// ── TOUCH/DRAG STATE ──────────────────────────────────────
let isDraggingSmellSlider = false;
let isDraggingVolumeSlider = false;
let _settingsKnobX = 0, _settingsSliderStart = 0, _settingsSliderEnd = 0, _settingsSliderY = 0;
let isDraggingPHSlider    = false;
let isDraggingWaterSlider   = false;

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
    [255, 200, 50],
    [180, 120, 255]
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
     "the lymph vessel (lacteal). Nutrients now",
     "travel to cells — the body prepares for",
     "the final stage of digestion!"],
    ["PHASE 4 — Water Reabsorption & Elimination", "",
     "Undigested material entered the large",
     "intestine, where water and electrolytes",
     "were reabsorbed back into the body.",
     "Beneficial gut bacteria fermented fibre,",
     "producing short-chain fatty acids that",
     "feed the colon lining. Peristalsis then",
     "moved the formed stool to the rectum",
     "for elimination — completing digestion!"]
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
  largeIntImg   = loadImage("data/largeint.png");

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
  // Safety: ensure nothing auto-plays on load
  [bgLoop, acidSfx, warningSfx, spraySfx].forEach(function(s) {
    if (s) s.stop();
  });
}

// =========================================================
// SETUP
// =========================================================
function setup() {
    pixelDensity(2);           // crisp text/images on high-DPI phones
    // Use visualViewport.height when available — this is the true visible height
    // that excludes Chrome's browser bar. windowHeight/innerHeight includes it,
    // which causes the top of the game to be clipped behind the address bar.
    let trueH = (window.visualViewport ? window.visualViewport.height : windowHeight);
    createCanvas(windowWidth, trueH);
    noSmooth();                // sharp pixel edges
    frameRate(60);
    imageMode(CENTER);
    rectMode(CENTER);
    
    _calcScale();              // Recalculate scaling for current screen size

    previousTime = millis();

    bgGradientBuffer     = createGraphics(GAME_W, GAME_H);
    reportGradientBuffer = createGraphics(GAME_W, GAME_H);
    updateReportGradientBuffer(reportGradientBuffer);

    MEMBRANE_X   = GAME_W / 2;
    sliderX      = GAME_W / 2 - 150;
    smellSliderX = GAME_W / 2 - 200;
    waterSliderX = GAME_W * 0.34;
    resetNutrientPositions();

    // ── Audio context protection for mobile ──────────────────────────────
    // Prevents audio distortion after background/sleep
    if (typeof getAudioContext === 'function') {
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                if (bgLoop) bgLoop.setVolume(0);
                stopAllLoopingSounds();
            } else {
                let ctx = getAudioContext();
                if (ctx && ctx.state === 'suspended') {
                    ctx.resume();
                }
                previousTime = millis();
                accumulator  = 0;
            }
        });

        // Resume audio on user interaction
        document.addEventListener('touchstart', function() {
            let ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') ctx.resume();
        }, { passive: true });
        
        document.addEventListener('mousedown', function() {
            let ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') ctx.resume();
        }, { passive: true });
    }

    // ── visualViewport resize — fixes Chrome browser bar clipping ────
    // Chrome's address bar can appear/disappear while scrolling.
    // This keeps the canvas sized to the true visible area at all times.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
            let trueH = window.visualViewport.height;
            resizeCanvas(windowWidth, trueH);
            _calcScale();
        });
    }

    // ── Back-button handling for PWA ──────────────────────────────
    if (window.history && window.history.pushState) {
        window.history.pushState({ biobalance: true }, '');
        window.addEventListener('popstate', function() {
            window.history.pushState({ biobalance: true }, '');
            exitReturnMode = mode;
            mode = MODE_EXIT_CONFIRM;
        });
    }

    // Initialize particles
    for (let i = 0; i < 30; i++) {
        let p = new ProtocolParticle();
        p.y = random(GAME_H);
        protocolParticles.push(p);
    }
    for (let i = 0; i < 15; i++) {
        let p = new ReportParticle();
        p.y = random(GAME_H);
        reportParticles.push(p);
    }

    // ── Pre-cache font metrics to prevent layout jumps ──
    push();
    textSize(28);  
    textAlign(CENTER, CENTER);
    fill(0, 0, 0, 0);  
    noStroke();  
    
    let _dummyStrings = [
        "PROCEED", "FOOD SWALLOWED — READY TO CONTINUE!",
        "PROTEIN FULLY DIGESTED — READY TO PROCEED",
        "HORMONES BALANCED — PROCEED", "ALL NUTRIENTS ABSORBED",
        "CORRECT", "INCORRECT", "KNOWLEDGE CHECK"
    ];
    for (let s of _dummyStrings) { 
        text(s, -9999, -9999); 
    }
    
    // Pre-cache various text sizes
    for (let sz of [12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 48]) {
        textSize(sz);  
        text("X", -9999, -9999);
    }
    
    textStyle(BOLD);  
    textSize(13);  
    textAlign(CENTER);
    for (let s of ["SALIVA", "pH: 2.0"]) { 
        text(s, -9999, -9999); 
    }
    
    textStyle(NORMAL);  
    textSize(12);
    pop();

    // Load saved progress
    loadProgress();

    // Listen for SW cache-updated message — wipes old save keys on reinstall
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'CACHE_UPDATED') {
                // Remove any biobalance save that doesn't match current SAVE_KEY
                let keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    let k = localStorage.key(i);
                    if (k && k.startsWith('biobalance-save-') && k !== SAVE_KEY) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
            }
        });
    }
}

function _calcScale() {
    let trueH = (window.visualViewport ? window.visualViewport.height : windowHeight);
    scaleX = windowWidth / GAME_W;
    scaleY = trueH / GAME_H;
    scaleF = min(scaleX, scaleY);
    offsetX = 0;
    offsetY = 0;
}

// =========================================================
// TOUCH HELPERS — translates screen coords → game coords
// =========================================================
function getInputX() {
  let sx = touches.length > 0 ? touches[0].x : mouseX;
  return sx / scaleX;
}
function getInputY() {
  let sy = touches.length > 0 ? touches[0].y : mouseY;
  return sy / scaleY;
}

// =========================================================
// CLASSES
// =========================================================
class PhaseParticle {
  constructor(col) {
    this.x = random(GAME_W);  this.y = random(GAME_H);
    this.vx = random(-0.013, 0.013);  this.vy = random(-0.013, 0.013);  // 15× slower total
    this.size = random(2, 6);  this.alpha = random(15, 40);
    this.c = col;
    this.pulseSpeed  = random(0.0006, 0.002);  // 15× slower pulse
    this.pulseOffset = random(TWO_PI);
  }
  update() {
    this.x += this.vx * 0.067 * dt;  this.y += this.vy * 0.067 * dt;
    if (this.x < -10)          this.x = GAME_W + 10;
    if (this.x > GAME_W + 10)   this.x = -10;
    if (this.y < -10)          this.y = GAME_H + 10;
    if (this.y > GAME_H + 10)  this.y = -10;
    if (random(1) < 0.02 * dt) {
      this.vx += random(-0.003, 0.003);  this.vy += random(-0.003, 0.003);
      this.vx = constrain(this.vx, -0.02, 0.02);
      this.vy = constrain(this.vy, -0.02, 0.02);
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
    this.vx    = random(-1.2, -2.0);   // faster horizontal drift
    this.vy    = random(-0.6, -1.2);   // faster upward drift
    this.alpha = random(15, 35);       // subtle — low alpha
    this.size  = random(2, 5);         // small clean circles
  }
  update(targetX, targetY) {
    let dx = targetX - this.x,  dy = targetY - this.y;
    let d  = sqrt(dx * dx + dy * dy);
    if (d > 30) { this.x += ((dx / d) * 1.8 + this.vx * 0.2) * dt;  // fast travel
                  this.y += ((dy / d) * 1.8 + this.vy * 0.2) * dt; }
    else { this.alpha -= 0.8 * dt; }
    this.alpha -= 0.12 * dt;  // gentle fade
  }
  display(c) {
    noStroke();
    // Subtle white outer glow for visibility against dark background
    fill(255, 255, 255, this.alpha * 0.45);
    ellipse(this.x, this.y, this.size * 1.35, this.size * 1.35);
    // Main particle
    fill(c[0], c[1], c[2], this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class ProtocolParticle {
  constructor() {
    this.x = random(GAME_W);  this.y = GAME_H + 20;
    this.vy = random(0.033, 0.133);  this.alpha = random(50, 150);  // 15× slower total
    this.size = random(2, 6);
  }
  update() {
    this.y -= this.vy * dt;
    if (this.y < -20) { this.y = GAME_H + 20;  this.x = random(GAME_W); }
    this.alpha = 100 + sin(millis() * 0.0002 + this.x * 0.01) * 50;
  }
  display() {
    noStroke();  fill(0, 255, 200, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class ReportParticle {
  constructor() {
    this.x = random(GAME_W);  this.y = GAME_H + random(10, 100);
    this.vy = random(0.02, 0.08);  this.alpha = random(50, 150);  // 15× slower total
    this.size = random(3, 8);
  }
  update() {
    this.y -= this.vy * dt;
    if (this.y < -20) { this.y = GAME_H + 20;  this.x = random(GAME_W); }
    this.alpha = 80 + sin(millis() * 0.000025 + this.x * 0.01) * 40;
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
    this.x += this.vx * 0.2 * dt;  this.y += this.vy * 0.2 * dt;
    this.vy += 0.08 * dt;    this.alpha -= 1.2 * dt;  this.size *= pow(0.992, dt);
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
  update() { this.x += this.vx * 0.2 * dt;  this.y += this.vy * 0.2 * dt;  this.alpha = lerp(this.alpha, 0, 1 - pow(1 - 0.15, dt)); }
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
  update() { this.y -= this.speed * dt;  this.x += sin(millis() * 0.00032) * 0.5 * dt; }
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
  let map2 = [phase0Particles, phase1Particles, phase2Particles, phase3Particles, phase4Particles];
  if (phaseIdx < 0 || phaseIdx > 4) return;
  map2[phaseIdx].length = 0;
  for (let i = 0; i < 25; i++) map2[phaseIdx].push(new PhaseParticle(phaseColors[phaseIdx]));
}

// updateAndDrawPhaseParticles: kept for backward compat; used only in phases that 
// still call it explicitly. Particles are updated by updateGameLogic each tick.
function updateAndDrawPhaseParticles(phaseIdx) {
  let map2 = [phase0Particles, phase1Particles, phase2Particles, phase3Particles, phase4Particles];
  if (phaseIdx < 0 || phaseIdx > 4) return;
  for (let p of map2[phaseIdx]) p.display();  // update is handled in updateGameLogic()
}

// =========================================================
// SOUND TICK — called once per display frame (NOT per logic tick)
// Manages all continuous/looping sounds based on flags set by logic.
// Throttled to ~4× per second to prevent Web Audio API overload on mobile.
// =========================================================
function soundTick() {
  // ── BG loop: screen-aware volume manager (runs every frame) ─
  if (bgLoop != null && bgLoopStarted) {
    let bgAllowed = (mode === MODE_TITLE || mode === MODE_JOURNEY ||
                     mode === MODE_MECHANICS || mode === MODE_SETTINGS || mode === MODE_INFO || quizState === 1);
    let bgTarget  = bgAllowed ? (quizState === 1 ? 0.04 * masterVolume : 0.08 * masterVolume) : 0;

    // Smooth fade toward target
    let bgCurrent = bgLoop.getVolume ? bgLoop.getVolume() : 0;
    let bgNext    = bgCurrent + (bgTarget - bgCurrent) * 0.04;

    // Volume-only control — NEVER pause/play after startup.
    // pause()/play() both create new Web Audio nodes in p5.sound 1.9.x.
    // setVolume(0) = silent; setVolume(x) = audible. One node, forever.
    bgLoop.setVolume(bgNext < 0.003 ? 0 : bgNext);
  }

  soundTickTimer++;
  if (soundTickTimer < 15) return;   // throttle the rest to ~4×/sec
  soundTickTimer = 0;

  // Warning sound — use loopSound() to prevent node stacking
  if (sfx_wantWarning) { loopSound(warningSfx, 0.5); }
  else { if (warningSfx && warningSfx.isPlaying()) warningSfx.stop(); }

  // Acid sound — use loopSound() to prevent node stacking
  if (sfx_wantAcid) { loopSound(acidSfx, 0.4); }
  else { if (acidSfx && acidSfx.isPlaying()) acidSfx.stop(); }

  // Spray sound — use loopSound() to prevent node stacking
  if (sfx_wantSpray) { loopSound(spraySfx, 0.5); }
  else { if (spraySfx && spraySfx.isPlaying()) spraySfx.stop(); }
}

// =========================================================
// DRAW LOOP
// =========================================================
function draw() {
  // ── Fixed-timestep accumulator ────────────────────────────
  let now = millis();
  let rawDelta = now - previousTime;

  // If gap > 500ms (tab backgrounded, crash-resume, phone sleep):
  // discard the accumulated time entirely — do NOT try to catch up
  if (rawDelta > 500) {
    previousTime = now;
    accumulator  = 0;
    return;   // skip this frame, start fresh next frame
  }

  previousTime = now;
  realFPS = 1000 / max(rawDelta, 1);
  smoothedFPS = lerp(smoothedFPS, realFPS, 0.08);

  // Hard cap: max 2 logic ticks per display frame (prevents any spiral)
  let frameTime = min(rawDelta / 1000, FIXED_DT * 2);
  accumulator += frameTime;

  while (accumulator >= FIXED_DT) {
    updateGameLogic();
    accumulator -= FIXED_DT;
  }

  // Sound management: once per display frame, throttled
  soundTick();

  // Safety net: stop sounds that should not play outside their context
  // reportSfx removed — no sound plays on final report
  if (quizState !== 1 && wrongSfx && wrongSfx.isPlaying()) wrongSfx.stop();
  if (quizState !== 1 && correctSfx && correctSfx.isPlaying()) correctSfx.stop();


  // ── Render once per actual display frame ─────────────────
  background(0);
  push();
  translate(offsetX, offsetY);
  scale(scaleX, scaleY);

  if (showLicenseScreen) { drawLicenseScreen(); pop(); return; }
  if (quizState === 1)   { drawReflectionGate(); pop(); return; }
  renderGame();
  drawPersistentReturnButton();
  if (!showLicenseScreen) drawFooter();  // consistent footer on all screens

  // FPS debug removed — gameplay confirmed stable

  pop();
}

// ── All state-changing logic at fixed 60Hz ─────────────────
// dt = 1.0 always (one tick = one 60fps frame worth of change)
function updateGameLogic() {
  dt = 1.0;  // Fixed: always exactly one 60fps tick

  // Spawn timer accumulates in ms; one tick = 16.666ms
  delta = 16.666;

  // BG loop: start once; rate locked to prevent drift
  // BG loop: started silently on first tick; screen-aware volume managed in soundTick()
  if (bgLoop != null && !bgLoopStarted) {
    bgLoop.setVolume(0);
    bgLoop.rate(1.0);
    bgLoop.loop();
    bgLoopStarted = true;
  }

  transitionAlpha = lerp(transitionAlpha, 255, 1 - pow(1 - 0.08, dt));
  organPulse      = 1.0 + sin(millis() * 0.0009) * 0.005;
  connectionGlow  = (sin(millis() * 0.0009) + 1) / 2.0;

  let isShaking =
    (mode === MODE_PHASE1 && ulcerRisk > 100) ||
    (mode === MODE_PHASE0 && foodType === 2 && emeticTimer >= EMETIC_THRESHOLD);
  if (isShaking) {
    // Subtle shake: max intensity 0.8 (was 1.5), slower lerp for smoothness
    shakeIntensity = lerp(shakeIntensity, map(delayedSmell, 0, 100, 0.1, 0.8), 1 - pow(1 - 0.05, dt));
  } else {
    // Fade quickly when warning stops (0.15 vs old 0.003 = ~50× faster decay)
    shakeIntensity = lerp(shakeIntensity, 0, 0.15);
  }

  if (showOverlay) overlayAlpha = lerp(overlayAlpha, 255, 1 - pow(1 - 0.2, dt));
  else             overlayAlpha = lerp(overlayAlpha, 0,   1 - pow(1 - 0.3, dt));

  // Phase-specific logic updates
  if (!showLicenseScreen && quizState !== 1) {
    switch (mode) {
      case MODE_PHASE0: updatePhase0Logic(); break;
      case MODE_PHASE1: updatePhase1Logic(); break;
      case MODE_PHASE2: updatePhase2Logic(); break;
      case MODE_PHASE3: updatePhase3Logic(); break;
      case MODE_PHASE4: updatePhase4Logic(); break;
    }
    // Update all active particles
    updateAndTickPhaseParticles();
    for (let i = aromaParticles.length - 1; i >= 0; i--) {
      aromaParticles[i].update(
        GAME_W * 0.35,   // headX
        GAME_H / 2 - 40  // headY
      );
      if (aromaParticles[i].alpha <= 0) aromaParticles.splice(i, 1);
    }
    for (let i = acidBubbles.length - 1; i >= 0; i--) {
      acidBubbles[i].update();
      let pY = GAME_H / 2 + 40;
      if (acidBubbles[i].y < pY - 100) acidBubbles.splice(i, 1);
    }
    for (let i = successParticles.length - 1; i >= 0; i--) {
      successParticles[i].update();
      if (successParticles[i].isDead()) successParticles.splice(i, 1);
    }
    for (let i = hormoneMist.length - 1; i >= 0; i--) {
      hormoneMist[i].update();
      if (hormoneMist[i].alpha <= 5) hormoneMist.splice(i, 1);
    }
  }
}

// ── Phase logic extracted from drawing functions ───────────
function updatePhase0Logic() {
  updateCephalicMetabolismFast();

  if (foodType > 0) {
    let spawnIntervalMs = map(delayedSmell, 0, 100, 600, 140);  // 4× less frequent
    aromaSpawnTimer += delta;
    if (aromaSpawnTimer >= spawnIntervalMs) {
      aromaSpawnTimer = 0;
      let foodX = GAME_W * 0.85, foodY = GAME_H / 2 + 20;
      let emissionX = foodX - 60, emissionY = foodY - 40;
      let cnt = delayedSmell > 65 ? 2 : 1;  // max 2, usually 1
      for (let i = 0; i < cnt; i++)
        aromaParticles.push(new AromaParticle(emissionX - random(0, 25), emissionY + random(-12, 12)));
    }
  }

  if (foodType > 0) foodScale = lerp(foodScale, 1.0, 1 - pow(1 - 0.15, dt));

  if (isDraggingSmellSlider) {
    let sStart = GAME_W / 2 - 200, sEnd = GAME_W / 2 + 200;
    smellSliderX = constrain(getInputX(), sStart, sEnd);
  }
  if (isDraggingVolumeSlider && _settingsSliderEnd > _settingsSliderStart) {
    masterVolume = constrain(map(getInputX(), _settingsSliderStart, _settingsSliderEnd, 0, 1), 0, 1);
  }
  if (isDraggingVolumeSlider && _settingsSliderEnd > _settingsSliderStart) {
    masterVolume = constrain(map(getInputX(), _settingsSliderStart, _settingsSliderEnd, 0, 1), 0, 1);
  }
  let sStart = GAME_W / 2 - 200, sEnd = GAME_W / 2 + 200;
  let inputSmell = map(smellSliderX, sStart, sEnd, 0, 100);
  delayedSmell = lerp(delayedSmell, inputSmell, 1 - pow(1 - 0.005, dt));

  if (foodType === 1) {
    salivaLevel  = lerp(salivaLevel, map(inputSmell, 0, 100, 40, 170), 0.004);
    if (salivaLevel > 168 && inputSmell >= 99) salivaLevel = 170;
    cephalicAcid = lerp(cephalicAcid, map(delayedSmell, 0, 100, 0, 150), 1 - pow(1 - 0.005, dt));
  } else if (foodType === 2) {
    salivaLevel  = lerp(salivaLevel, 5, 1 - pow(1 - 0.002, dt));
    cephalicAcid = lerp(cephalicAcid, 0, 1 - pow(1 - 0.1, dt));
  }

  let metabolismReady    = (insulinLevel > 20 && hepaticGlucoseOutput < 60);
  let inActivationWindow = (foodType === 1 && inputSmell >= 99 &&
                            salivaLevel >= 170 && metabolismReady && !hasSwallowed);
  cephalicTimer = inActivationWindow ? min(60, cephalicTimer + 0.2) : 0;

  if (foodType === 2) {
    let inputSmellNow = map(smellSliderX, GAME_W/2-200, GAME_W/2+200, 0, 100);
    if (inputSmellNow >= 60) emeticTimer = min(EMETIC_THRESHOLD, emeticTimer + 0.15);
    else                     emeticTimer = max(0, emeticTimer - 2 * dt);
    sfx_wantWarning = (emeticTimer >= EMETIC_THRESHOLD);
  } else {
    // Not spoiled food — silence warning immediately
    sfx_wantWarning = false;
    if (warningSfx && warningSfx.isPlaying()) warningSfx.stop();
  }
}

function updatePhase1Logic() {
  let sliderStart = GAME_W / 2 - 150, sliderEnd = GAME_W / 2 + 150;
  if (!phase1Complete && isDraggingPHSlider)
    sliderX = constrain(getInputX(), sliderStart, sliderEnd);

  let currentPH = map(sliderX, sliderStart, sliderEnd, 7.0, 1.0);
  stomachAcid = map(currentPH, 7.0, 1.0, 0, 255);
  ulcerRisk   = (currentPH < 1.5) ? min(110, ulcerRisk + 1*dt) : max(0, ulcerRisk - 5*dt);

  let inPHWindow = (currentPH >= 1.5 && currentPH <= 3.0);
  pepsinTimer = inPHWindow ? min(60, pepsinTimer + dt) : 0;
  enzymeActive = (pepsinTimer >= 60 && pepsinState === PepsinState.ACTIVE);
  sfx_wantAcid = enzymeActive;  // set in logic so soundTick always has fresh value
  if (!enzymeActive && acidSfx && acidSfx.isPlaying()) acidSfx.stop();  // stop immediately
  updatePepsinDenaturation(currentPH, inPHWindow);

  if (proteinImg != null && enzymeActive)
    proteinScale = max(0.0, proteinScale - 0.00035);
  else if (proteinScale < 1.0 && pepsinState !== PepsinState.ACTIVE)
    proteinScale = min(1.0, proteinScale + 0.002);

  bubbleSpawnTimer += delta;
  if (enzymeActive && bubbleSpawnTimer >= 83) {
    bubbleSpawnTimer = 0;
    let pX = GAME_W / 2 + 110, pY = GAME_H / 2 + 40;
    acidBubbles.push(new Bubble(pX + random(-60, 60), pY + 80, random(6, 14), random(1, 5), [180, 255, 0, 180]));
  }
}

function updatePhase2Logic() {
  let thresholdMet = (secretinLevel >= 150 && cckLevel >= 150);

  // Count up greenZoneTimer only while BOTH hormones are in green zone
  // Reset to 0 the instant either drops below threshold
  if (thresholdMet) {
    greenZoneTimer += dt;
  } else {
    greenZoneTimer = 0;
  }

  // Homeostasis reached only after sustaining green for full 30 seconds
  if (greenZoneTimer >= GREEN_ZONE_REQUIRED && !homeostasisReached) {
    homeostasisReached     = true;
    homeostasisJustReached = true;
    homeostasisLocked      = false;  // unlock proceed immediately
    homeostasisDisplayTimer = 0;
  }
  // If hormones drop after reaching homeostasis, keep it reached (don't un-reach)
  // but if they drop before the 30s, greenZoneTimer already resets above

  if (mouseIsPressed && (sprayType === 1 || sprayType === 2)) {
    sfx_wantSpray = true;
    let yOffset = 40;
    if (sprayType === 1) {
      secretinLevel = min(secretinLevel + 1.0, 200);
      for (let i = 0; i < 3; i++)
        hormoneMist.push(new Mist(GAME_W*0.15+80, GAME_H/2+50+yOffset, random(5,10), random(-2,2), [0,150,255]));
    } else {
      cckLevel = min(cckLevel + 1.0, 200);
      for (let i = 0; i < 3; i++)
        hormoneMist.push(new Mist(GAME_W*0.85-80, GAME_H/2+50+yOffset, random(-10,-5), random(-2,2), [255,180,0]));
    }
  } else {
    sfx_wantSpray = false;
  }

  if (!homeostasisLocked) {
    secretinLevel = max(secretinLevel - decayRate * 0.4, 0);
    cckLevel      = max(cckLevel      - decayRate * 0.4, 0);
  }
}

function updatePhase3Logic() {
  handleNutrientPhysicsStrict(MEMBRANE_X + 280, 400, 120, GAME_H*0.35, GAME_H*0.55, GAME_H*0.75);

  let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
  if (allAbsorbed) phase3ProceedDelay += dt;

  successSpawnTimer += delta;
  if (successSpawnTimer >= 83) {
    successSpawnTimer = 0;
  }
}

// ── PHASE 4 LOGIC ─────────────────────────────────────────
function updatePhase4Logic() {
  let sliderStart = GAME_W * 0.34, sliderEnd = GAME_W * 0.66;
  if (isDraggingWaterSlider)
    waterSliderX = constrain(getInputX(), sliderStart, sliderEnd);
  waterSliderX = constrain(waterSliderX, sliderStart, sliderEnd);
  waterAbsorbed = map(waterSliderX, sliderStart, sliderEnd, 0, 100);
  // Moderate lerp — responsive but not instant (~3.5s to fully settle)
  actualWaterAbsorbed = lerp(actualWaterAbsorbed, waterAbsorbed, 1 - pow(1 - 0.012, dt));
  stoolConsistency    = lerp(stoolConsistency, map(actualWaterAbsorbed, 0, 100, 0, 100), 1 - pow(1 - 0.010, dt));
  let waterGood = (actualWaterAbsorbed >= 40 && actualWaterAbsorbed <= 72);
  if (peristalsisActive && !peristalsissComplete) {
    // ~35 seconds of held-button time: 100 / (35s × 60fps) = 100/2100 per tick
    peristalsisProgress = min(100, peristalsisProgress + (100 / 2100) * dt);
    if (peristalsisProgress >= 100) peristalsissComplete = true;
  }
  // phase4Ready: stool at end AND water in optimal zone
  // PROCEED shows after holding optimal for 3 seconds (3s × 60 = 180 ticks)
  phase4Ready = waterGood && peristalsissComplete;
  if (phase4Ready) phase4ProceedDelay = min(PHASE4_PROCEED_DELAY_FRAMES, phase4ProceedDelay + dt);
}

function resetPhase4() {
  waterSliderX = GAME_W * 0.34;   // start at left of relative slider
  waterAbsorbed = 0;  actualWaterAbsorbed = 0;  stoolConsistency = 0;
  peristalsisProgress = 0;  peristalsisActive = false;  peristalsissComplete = false;
  phase4Ready = false;  phase4ProceedDelay = 0;  phase4ProceedSoundPlayed = false;
  isDraggingWaterSlider = false;
}

function phase4() {
  updateAndDrawPhaseParticles(4);
  drawPhaseTitle("PHASE 4 — WATER REABSORPTION & ELIMINATION", 50);
  let waterGood = (actualWaterAbsorbed >= 40 && actualWaterAbsorbed <= 72);

  // All positions relative to GAME_W / GAME_H — no hardcoded pixels
  let imgCX   = GAME_W * 0.56;       // organ image centre x (right side, leaves room for panel)
  let imgCY   = GAME_H * 0.54;       // organ image centre y (pushed down to clear guide/button row)
  let imgW    = GAME_W * 0.52;       // organ image width  (~665 at 1280px)
  let imgH    = GAME_H * 0.72;       // organ image height (~518 at 720px) — slightly shorter so slider fits
  let sliderY4    = GAME_H * 0.94;   // slider well below image
  let sliderStart = GAME_W * 0.34;
  let sliderEnd   = GAME_W * 0.66;
  let panelX  = GAME_W * 0.135;      // panel centre x
  let panelY  = GAME_H * 0.50;       // panel centre y — keep vertically centred
  let guideY  = GAME_H * 0.10;       // guide text near top

  if (largeIntImg != null) {
    push();
    translate(imgCX, imgCY);  scale(organPulse);
    tint(255, transitionAlpha);  image(largeIntImg, 0, 0, imgW, imgH);  noTint();
    pop();
  }

  // Stool position: scale waypoints proportionally to image size
  let scaleWP = imgW / 650.0;   // WP_X/WP_Y were designed for 650×550
  let t4  = peristalsisProgress / 100.0;
  let segF = t4 * (WP_X.length - 1);
  let seg  = int(constrain(segF, 0, WP_X.length - 2));
  let frac = segF - seg;
  let stoolX = imgCX + lerp(WP_X[seg], WP_X[seg + 1], frac) * scaleWP;
  let stoolY = imgCY + lerp(WP_Y[seg], WP_Y[seg + 1], frac) * scaleWP;

  let stoolW = map(stoolConsistency, 0, 100, 52, 72) * scaleWP;
  let stoolH = stoolW * 0.72;
  let sB, sSh, sHi;
  if      (stoolConsistency < 35) { sB=[115,160,80,230]; sSh=[80,120,50,200];  sHi=[160,210,110,150]; }
  else if (stoolConsistency > 80) { sB=[80,42,18,240];   sSh=[55,28,10,210];   sHi=[115,68,38,160];   }
  else                            { sB=[135,82,38,235];  sSh=[95,55,22,205];   sHi=[180,125,68,155];  }

  if (peristalsisActive || peristalsissComplete) {
    noFill();
    stroke(180,120,255, 70+sin(millis()*0.00032)*50);  strokeWeight(4);
    ellipse(stoolX, stoolY, stoolW+30*scaleWP+sin(millis()*0.0003)*8, stoolH+24*scaleWP);
  }
  noStroke();
  fill(sB[0],sB[1],sB[2],sB[3]);     ellipse(stoolX, stoolY, stoolW, stoolH);
  fill(sSh[0],sSh[1],sSh[2],sSh[3]); ellipse(stoolX-stoolW*0.1, stoolY+stoolH*0.12, stoolW*0.62, stoolH*0.52);
  fill(sHi[0],sHi[1],sHi[2],sHi[3]); ellipse(stoolX+stoolW*0.15, stoolY-stoolH*0.18, stoolW*0.36, stoolH*0.28);

  if (waterGood) {
    for (let d = 0; d < 5; d++) {
      let angle = millis()*0.00008 + d*TWO_PI/5;
      fill(100,180,255,160);  noStroke();
      ellipse(stoolX+cos(angle)*(stoolW*0.5+22*scaleWP+sin(millis()*0.00013+d)*8),
              stoolY+sin(angle)*(stoolH*0.5+14*scaleWP+cos(millis()*0.00013+d)*6), 8, 8);
    }
  }
  for (let m of hormoneMist) m.display();

  drawPhase4Panel(panelX, panelY, waterGood);

  // Slider — all relative
  let sCol = lerpColor(color(100,200,255), color(180,120,50), map(actualWaterAbsorbed,0,100,0,1));
  stroke(255,150);  strokeWeight(4);  line(sliderStart, sliderY4, sliderEnd, sliderY4);
  fill(sCol);  noStroke();
  // keep slider knob within track
  let knobX = map(waterAbsorbed, 0, 100, sliderStart, sliderEnd);
  ellipse(knobX, sliderY4, 32, 32);
  fill(255);  textStyle(NORMAL);  textSize(14);  textAlign(CENTER);
  text("WATER ABSORPTION CONTROL", GAME_W/2, sliderY4+45);
  textAlign(RIGHT);  text("LOW (0%)",    sliderStart-20, sliderY4+7);
  textAlign(LEFT);   text("HIGH (100%)", sliderEnd  +20, sliderY4+7);
  textAlign(CENTER);

  // Guide text + buttons — positioned relative to guideY
  textStyle(BOLD);  textSize(min(20, GAME_W*0.016));  textAlign(CENTER);
  if (phase4Ready && phase4ProceedDelay >= PHASE4_PROCEED_DELAY_FRAMES) {
    // Fully ready — show completion text and PROCEED
    fill(0,255,150);
    text("ELIMINATION COMPLETE — DIGESTION CYCLE FINISHED!", GAME_W/2, guideY);
    if (!phase4ProceedSoundPlayed) { playSoundOnce(successSfx);  phase4ProceedSoundPlayed = true; }
    drawProceedButton(GAME_W/2, guideY + GAME_H*0.067);
  } else if (phase4Ready && phase4ProceedDelay < PHASE4_PROCEED_DELAY_FRAMES) {
    // Stool at end + water optimal — holding for 3s before proceed
    let holdSec = nf((PHASE4_PROCEED_DELAY_FRAMES - phase4ProceedDelay) / 60, 0, 0);
    fill(0,255,150);
    text("STOOL REACHED RECTUM — HOLD OPTIMAL LEVEL...", GAME_W/2, guideY);
    // Progress bar showing the 3s countdown
    let pct = phase4ProceedDelay / PHASE4_PROCEED_DELAY_FRAMES;
    noStroke();  fill(30,40,60);
    rect(GAME_W/2, guideY + GAME_H*0.055, GAME_W*0.28, 14, 7);
    fill(0,255,150);
    rect(GAME_W/2 - GAME_W*0.14 + pct*GAME_W*0.14, guideY + GAME_H*0.055, pct*GAME_W*0.28, 14, 7);
    fill(255);  textStyle(NORMAL);  textSize(12);
    text(holdSec + "s remaining...", GAME_W/2, guideY + GAME_H*0.085);
    textStyle(BOLD);  textSize(min(20, GAME_W*0.016));
  } else if (actualWaterAbsorbed < 40) {
    fill(100,200,255);
    text("STOOL TOO WATERY — INCREASE WATER ABSORPTION!", GAME_W/2, guideY);
    if (!peristalsissComplete) drawPeristalsisButton(GAME_W/2, guideY + GAME_H*0.06);
  } else if (actualWaterAbsorbed > 72) {
    fill(255,140,60);
    text("STOOL TOO DRY — DECREASE WATER ABSORPTION!", GAME_W/2, guideY);
    if (!peristalsissComplete) drawPeristalsisButton(GAME_W/2, guideY + GAME_H*0.06);
  } else if (waterGood && !peristalsissComplete) {
    fill(180,120,255);
    text("WATER OPTIMAL — HOLD PERISTALSIS TO MOVE STOOL!", GAME_W/2, guideY);
    drawPeristalsisButton(GAME_W/2, guideY + GAME_H*0.06);
  } else {
    fill(200,180,255);  text("ALMOST THERE...", GAME_W/2, guideY);
  }
  textStyle(NORMAL);
}

function drawPeristalsisButton(x, y) {
  let hov = getInputX()>x-110 && getInputX()<x+110 && getInputY()>y-27 && getInputY()<y+27;
  fill(hov ? color(0,100,100) : color(0,60,80), 230);
  stroke(0,255,200);  strokeWeight(2);  rect(x, y, 220, 50, 12);
  fill(255);  textStyle(BOLD);  textSize(19);  textAlign(CENTER,CENTER);
  text(peristalsisActive ? "CONTRACTING..." : "PERISTALSIS", x, y-2);
  textStyle(NORMAL);
}

function drawPhase4Panel(x, y, waterGood) {
  push();
  fill(20,30,50,220);  stroke(255,150);  strokeWeight(2);  rect(x, y, 275, 260, 15);
  fill(0,255,200);  textStyle(BOLD);  textSize(16);  textAlign(CENTER);
  text("COLON STATUS", x, y-95);  textStyle(NORMAL);
  let r1Y = y-40;
  let wCol = waterGood ? color(0,255,150) : (actualWaterAbsorbed<40 ? color(100,180,255) : color(255,140,60));
  fill(30,40,60);  rect(x, r1Y, 240, 40, 5);
  fill(wCol);  rect(x-120+map(actualWaterAbsorbed,0,100,0,240)/2, r1Y, map(actualWaterAbsorbed,0,100,0,240), 40, 5);
  if (waterGood) {
    stroke(0,255,150, 100+sin(millis()*0.00032)*155);  strokeWeight(3);
    noFill();  rect(x, r1Y, 240, 40, 5);
  }
  fill(wCol);  textStyle(BOLD);  textSize(12);  textAlign(CENTER);
  text("WATER ABSORBED", x, r1Y-26);  textStyle(NORMAL);
  let r2Y = y+22;
  let sLabel = stoolConsistency<35 ? "LIQUID" : stoolConsistency>80 ? "HARD/IMPACTED" : "WELL-FORMED";
  let sCol   = (stoolConsistency>=35&&stoolConsistency<=80) ? color(140,200,100) :
               (stoolConsistency<35) ? color(100,200,255) : color(180,100,60);
  noStroke();  fill(30,40,60);  rect(x, r2Y, 240, 20, 5);
  fill(sCol);  rect(x-120+map(stoolConsistency,0,100,0,240)/2, r2Y, map(stoolConsistency,0,100,0,240), 20, 5);
  fill(255);  textSize(11);  textAlign(CENTER);
  text("STOOL CONSISTENCY: "+sLabel, x, r2Y-14);
  let r3Y = y+65;
  let pLabel = peristalsissComplete ? "COMPLETE" : "IN PROGRESS";
  let pCol   = peristalsissComplete ? color(180,120,255) : color(100,70,160);
  fill(30,40,60);  rect(x, r3Y, 240, 20, 5);
  fill(pCol);  rect(x-120+map(peristalsisProgress,0,100,0,240)/2, r3Y, map(peristalsisProgress,0,100,0,240), 20, 5);
  if (peristalsissComplete) {
    stroke(180,120,255, 80+sin(millis()*0.00032)*70);  strokeWeight(3);
    noFill();  rect(x, r3Y, 240, 20, 5);
  }
  fill(255);  textSize(11);  textAlign(CENTER);
  text("PERISTALSIS: "+pLabel, x, r3Y-14);
  noStroke();  textStyle(BOLD);  textSize(13);
  if (phase4Ready)                         { fill(0,255,150);   text("READY!",                   x, r3Y+52); }
  else if (waterGood&&!peristalsissComplete){ fill(180,120,255); text("HOLD PERISTALSIS BUTTON", x, r3Y+52); }
  else if (!waterGood)                     { fill(255,200,0);   text("ADJUST ABSORPTION LEVEL",  x, r3Y+52); }
  else                                     { fill(200,180,255); text("ALMOST THERE...",           x, r3Y+52); }
  textStyle(NORMAL);
  pop();
}

// Particle tick (update only, display done in renderGame)
function updateAndTickPhaseParticles() {
  let allP = [phase0Particles, phase1Particles, phase2Particles, phase3Particles, phase4Particles];
  for (let arr of allP) for (let p of arr) p.update();
  for (let p of protocolParticles) p.update();
  for (let p of reportParticles)   p.update();
}

// ── Pure rendering — no state changes allowed here ─────────
function renderGame() {
  let shakeX = (shakeIntensity > 0.1) ? random(-shakeIntensity, shakeIntensity) : 0;
  let shakeY = (shakeIntensity > 0.1) ? random(-shakeIntensity, shakeIntensity) : 0;

  push();
  translate(shakeX, shakeY);

  let bgColor1 = color(10, 15, 30);
  if (mode === MODE_PHASE1 && ulcerRisk > 100) {
    bgColor1 = lerpColor(color(10, 15, 30), color(50, 10, 10), (sin(millis() * 0.00032) + 1) / 2.0);
  } else if (mode === MODE_PHASE0 && foodType === 2 && emeticTimer >= EMETIC_THRESHOLD) {
    bgColor1 = lerpColor(color(10, 15, 30), color(25, 60, 25), map(delayedSmell, 0, 100, 0, 1.0));
  } else if (mode === MODE_JOURNEY || mode === MODE_MECHANICS || mode === MODE_TITLE || mode === MODE_FINISH) {
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
    case MODE_PHASE4:    phase4();              break;
    case MODE_FINISH:    drawFinalReport();     break;
    case MODE_SETTINGS:  drawSettingsScreen();  break;
    case MODE_INFO:      drawInfoScreen();      break;
    case MODE_EXIT_CONFIRM: drawExitConfirmScreen(); break;
  }
  noTint();

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
  textStyle(NORMAL);  textSize(20);  // lock clean state for entire frame
  // Particles already updated in updateGameLogic(); just draw them
  let arr0 = phase0Particles; for (let p of arr0) p.display();
  drawPhaseTitle("PHASE 0 — YOUR BRAIN PREPARES FOR FOOD", 50);

  let foodX = GAME_W * 0.85, foodY = GAME_H / 2 + 20;
  let headX = GAME_W * 0.35, headY = GAME_H / 2 - 40;

  // Draw aroma particles (already updated in logic tick)
  for (let p of aromaParticles) {
    p.display(foodType === 1 ? [245, 230, 180] : [150, 200, 100]);
  }

  if (headImg != null) {
    push();
    translate(headX, headY);
    scale(organPulse);
    if (foodType === 1 && insulinLevel > 10) {
      let g = map(insulinLevel, 0, 50, 50, 180);
      fill(255, 100, 150, g + sin(millis() * 0.00032) * 40);  noStroke();
      ellipse(0, -20, 160, 140);
      fill(255, 150, 200, g * 0.6);
      ellipse(0, -20, 100, 90);
    }
    if (foodType === 1 && salivaLevel > 150) {
      fill(0, 255, 200, 50 + sin(millis() * 0.00032) * 50);  noStroke();
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
    push();
    translate(foodX, foodY);
    scale(foodScale);
    if (foodType === 1 && deliciousImg != null) image(deliciousImg, 0, 0, 280, 200);
    else if (foodType === 2 && spoiledImg != null) image(spoiledImg, 0, 0, 280, 200);
    pop();
  }

  let sStart = GAME_W / 2 - 200, sEnd = GAME_W / 2 + 200, sliderY = GAME_H - 150;
  let inputSmell = map(smellSliderX, sStart, sEnd, 0, 100);
  let metabolismReady   = (insulinLevel > 20 && hepaticGlucoseOutput < 60);
  let cephalicActive    = (cephalicTimer >= 60);

  let guideY = 90, buttonY = 130;
  let p0Text = "", p0Color = color(255);

  if (hasSwallowed) {
    swallowProceedDelay = min(swallowProceedDelay + 1, SWALLOW_PROCEED_FRAMES + 1);
    if (swallowProceedDelay >= SWALLOW_PROCEED_FRAMES) {
      p0Text  = "FOOD SWALLOWED — READY TO CONTINUE!";
      p0Color = color(0, 255, 150);
      if (!phase0ProceedSoundPlayed) { playSoundOnce(successSfx);  phase0ProceedSoundPlayed = true; }
      drawProceedButton(GAME_W / 2, buttonY);
    } else {
      p0Text  = "SWALLOWING FOOD...";
      p0Color = color(0, 255, 200);
    }
  } else if (isChewing) {
    p0Text  = "CHEWING: BREAKING DOWN YOUR FOOD!";
    p0Color = color(255, 200, 0);
    drawNextButton(GAME_W / 2, buttonY, "SWALLOW");
  } else if (foodType === 1 && cephalicActive) {
    cephalicReady = true;
    p0Text  = "BRAIN SIGNAL SENT — VAGUS NERVE ACTIVATED!";
    p0Color = color(0, 255, 150, 150 + sin(millis() * 0.004) * 105);
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
    if      (delayedSmell < 30)              p0Text = "SOMETHING SMELLS ODD...";
    else if (delayedSmell < 60)              p0Text = "SOMETHING SMELLS BAD — BODY IS REJECTING IT!";
    else if (emeticTimer >= EMETIC_THRESHOLD) p0Text = "SPOILED FOOD DETECTED — NAUSEA RESPONSE TRIGGERED!";
    else                                      p0Text = "SMELL GETTING WORSE — REJECTION INTENSIFYING...";
    p0Color = color(255, 50, 50);
  } else {
    cephalicReady = false;  p0Text = "SELECT A FOOD TYPE TO BEGIN";  p0Color = color(200);
  }

  textStyle(NORMAL);  textSize(20);  textAlign(CENTER);
  fill(p0Color);  text(p0Text, GAME_W / 2, guideY);

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
    insulinLevel            = lerp(insulinLevel, cal * 0.08, 1 - pow(1 - 0.0025, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, max(20, 100 - insulinLevel * 1.5), 1 - pow(1 - 0.005, dt));
    peripheralGlucoseUptake = map(insulinLevel, 0, 40, 0, 100);
  } else if (foodType === 2) {
    insulinLevel            = lerp(insulinLevel, 0, 1 - pow(1 - 0.1, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, 150, 1 - pow(1 - 0.05, dt));
    peripheralGlucoseUptake = lerp(peripheralGlucoseUptake, 0, 1 - pow(1 - 0.1, dt));
  } else {
    insulinLevel            = lerp(insulinLevel, 0, 1 - pow(1 - 0.05, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, 100, 1 - pow(1 - 0.002, dt));
    peripheralGlucoseUptake = lerp(peripheralGlucoseUptake, 0, 1 - pow(1 - 0.05, dt));
  }
}

function drawMetabolicPanelWithSaliva(x, y) {
  push();  // isolate ALL style changes in this panel
  fill(20, 30, 50, 220);  stroke(255, 150);  strokeWeight(2);
  rect(x, y, 280, 280, 15);

  fill(0, 255, 200);  textStyle(BOLD);  textSize(16);  textAlign(CENTER);
  text("BODY PREP STATUS", x, y - 118);
  textStyle(NORMAL);  textSize(12);

  // Saliva bar — label plain white, normal weight
  fill(30, 40, 60);  rect(x, y - 60, 240, 40, 5);
  let sw = map(salivaLevel, 0, 170, 0, 240);
  fill(0, 200, 255);  rect(x - 120 + sw / 2, y - 60, sw, 40, 5);
  noStroke();  // no glow effects on saliva bar
  fill(255);  textStyle(NORMAL);  textSize(13);  textAlign(CENTER);  text("SALIVA", x, y - 93);

  // Insulin bar
  fill(30, 40, 60);  rect(x, y - 10, 240, 20, 5);
  fill(255, 100, 150);  rect(x - 120 + map(insulinLevel, 0, 50, 0, 240) / 2, y - 10, map(insulinLevel, 0, 50, 0, 240), 20, 5);
  fill(255);  textStyle(NORMAL);  textSize(11);  textAlign(CENTER);  text("INSULIN LEVEL: " + nf(insulinLevel, 0, 1), x, y - 25);

  // Liver glucose bar — high output = full bar (biologically correct)
  fill(30, 40, 60);  rect(x, y + 35, 240, 20, 5);
  let hw = map(hepaticGlucoseOutput, 0, 150, 0, 240);
  fill(hepaticGlucoseOutput < 60 ? color(0, 255, 150) : hepaticGlucoseOutput < 100 ? color(255, 255, 0) : color(255, 100, 100));
  rect(x - 120 + hw / 2, y + 35, hw, 20, 5);
  fill(255);  textStyle(NORMAL);  textSize(11);  textAlign(CENTER);  text("LIVER GLUCOSE: " + nf(hepaticGlucoseOutput, 0, 1) + "%", x, y + 20);

  // Uptake bar
  fill(30, 40, 60);  rect(x, y + 80, 240, 20, 5);
  let pu = map(peripheralGlucoseUptake, 0, 100, 0, 240);
  fill(100, 255, 200);  rect(x - 120 + pu / 2, y + 80, pu, 20, 5);
  fill(255);  textStyle(NORMAL);  textSize(11);  textAlign(CENTER);  text("BODY CELLS ABSORBING: " + nf(peripheralGlucoseUptake, 0, 1) + "%", x, y + 65);

  let ready = (insulinLevel > 20 && hepaticGlucoseOutput < 60);
  textStyle(NORMAL);  textSize(13);  textAlign(CENTER);
  noStroke();
  if      (salivaLevel >= 170 && ready)  { fill(0, 255, 150);  text("READY!", x, y + 120); }
  else if (salivaLevel >= 170)           { fill(255, 200, 0);  text("YOUR BODY IS GETTING READY", x, y + 120); }
  else                                   { fill(255, 200, 0);  text("BUILDING UP — WAIT...", x, y + 120); }
  pop();  // restore all styles — zero bleed to outer draw
}

function drawPhase0Button(x, y, label, type) {
  let hover = (getInputX() > x - 90 && getInputX() < x + 90 && getInputY() > y - 25 && getInputY() < y + 25);
  // Selection shown only by border brightness, not fill — keeps text always readable
  stroke(foodType === type ? color(0, 255, 200) : color(80, 120, 140));
  strokeWeight(foodType === type ? 3 : 1);
  fill(hover ? color(20, 50, 60) : color(15, 35, 45));  // consistent dark fill always
  rect(x, y, 180, 50, 5);
  fill(255);  // always plain white text
  textAlign(CENTER, CENTER);  textSize(16);  text(label, x, y - 3);
}

// =========================================================
// PHASE 1 — GASTRIC PHASE
// =========================================================
function phase1() {
  textStyle(NORMAL);  textSize(20);  // lock clean state for entire frame
  updateAndDrawPhaseParticles(1);
  drawPhaseTitle("PHASE 1 — STOMACH ACID & ENZYME ACTIVITY", 50);

  let sliderY = GAME_H - 110, sliderStart = GAME_W / 2 - 150, sliderEnd = GAME_W / 2 + 150;
  let currentPH = map(sliderX, sliderStart, sliderEnd, 7.0, 1.0);
  let inPHWindow = (currentPH >= 1.5 && currentPH <= 3.0);

  if (stomachImg != null) {
    push();  translate(GAME_W / 2, GAME_H / 2);  scale(organPulse);
    if (ulcerRisk > 100) tint(255, 100, 100, transitionAlpha);
    image(stomachImg, 0, 0, 650, 550);  noTint();  pop();
  }

  let pX = GAME_W / 2 + 110, pY = GAME_H / 2 + 40;
  // sfx_wantAcid set in updatePhase1Logic() for immediate response

  if (proteinImg != null) {
    let pAlpha = enzymeActive ? map(proteinScale, 1.0, 0.0, 255, 0) : 200;
    if (proteinScale > 0.01 && pAlpha > 1) {
      push();  translate(pX, pY);  scale(proteinScale);
      tint(255, pAlpha, transitionAlpha);  image(proteinImg, 0, 0, 140, 140);  noTint();  pop();
    }
  }

  // Bubbles updated in logic tick; just display here
  for (let ab of acidBubbles) ab.display();

  drawPepsinPanelBig(140, GAME_H / 2, currentPH, inPHWindow, enzymeActive);

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
    fill(255, 0, 0);  textStyle(NORMAL);  textSize(20);
    text("STOMACH LINING IN DANGER — ULCER RISK HIGH!", GAME_W / 2, statusY);
    sfx_wantWarning = true;
  } else {
    sfx_wantWarning = false;

    if (pepsinState === PepsinState.DENATURED) {
      fill(255, 50, 50);  textStyle(NORMAL);  textSize(20);
      text("ENZYME SHAPE BROKEN — PEPSIN STOPPED WORKING!", GAME_W / 2, statusY);
      drawRestorePepsinButton(GAME_W / 2, statusY + spacing);
    } else if (pepsinConcentration > 0 && currentPH > 4.5 && currentPH <= 5.0) {
      fill(255, 100 + (sin(millis() * 0.018) + 1) / 2.0 * 155, 0);
      textStyle(NORMAL);  textSize(20);
      text("WARNING: PEPSIN ABOUT TO BREAK DOWN — LOWER THE ACID!", GAME_W / 2, statusY);
    } else if (currentPH < 1.5) {
      fill(255, (sin(millis() * 0.004) + 1) / 2.0 * 100, 0);
      textStyle(NORMAL);  textSize(20);
      text("DANGER: TOO MUCH ACID — MOVE SLIDER LEFT!", GAME_W / 2, statusY);
    } else if (inPHWindow && !enzymeActive) {
      fill(pepsinState === PepsinState.PARTIAL ? color(255, 200, 0) : color(255, 255, 0));
      textStyle(NORMAL);  textSize(20);
      text(pepsinState === PepsinState.PARTIAL
        ? "ENZYME WEAKENING — KEEP pH BETWEEN 1.5 AND 3.0!"
        : "INACTIVE ENZYME BECOMING ACTIVE — HOLD THE pH!", GAME_W / 2, statusY);
    } else if (enzymeActive) {
      if (proteinScale < 0.3) {
        fill(0, 255, 150);  textStyle(NORMAL);  textSize(20);
        text("PROTEIN DIGESTION COMPLETE!", GAME_W / 2, statusY);
        phase1Complete = true;
        if (!phase1ProceedSoundPlayed) { playSoundOnce(successSfx);  phase1ProceedSoundPlayed = true; }
        drawProceedButton(GAME_W / 2, statusY + spacing);
      } else {
        fill(0, 255, 150);  textStyle(NORMAL);  textSize(20);
        text("PEPSIN ACTIVE — PROTEIN IS BEING BROKEN DOWN!", GAME_W / 2, statusY);
        fill(255, 200, 0);  textStyle(NORMAL);  textSize(16);
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
  stroke(255, 50, 50, 150 + sin(millis() * 0.00032) * 100);  strokeWeight(3);
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
      if (denatureSfx) { denatureSfx.stop(); denatureSfx.play(); }
    }
  } else if (currentPH > 4.0 && currentPH <= 5.0 && pepsinConcentration > 0) {
    pepsinConcentration = max(0, pepsinConcentration - 0.5*dt);
  }

  if (pepsinState === PepsinState.DENATURED) {
    // Denatured: reserve stays where it is — only restored by player pressing RESTORE PEPSIN
  } else {
    if (inPHWindow && pepsinState === PepsinState.INACTIVE) {
      pepsinConcentration = min(100, pepsinConcentration + 0.056*dt);  // ~30s to reach 100%
      // Pepsinogen consumed 1:1 as it converts to pepsin (stoichiometrically accurate)
      pepsinogenReserve   = max(0, 100 - pepsinConcentration);  // mirror: as pepsin rises, reserve falls to 0
      if (pepsinConcentration >= 100) {
        pepsinState = PepsinState.ACTIVE;  // full activation only at 100%
        pepsinogenReserve = 0;             // reserve fully depleted at full activation
      }
    } else if (inPHWindow && pepsinState === PepsinState.ACTIVE) {
      // Fully active — reserve stays at 0 (all converted)
      pepsinogenReserve = 0;
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
  push();  // isolate ALL style changes in this panel
  fill(20, 30, 50, 220);  stroke(255, 150);  strokeWeight(2);
  rect(x, y, 275, 260, 15);

  fill(0, 255, 200);  textStyle(BOLD);  textSize(16);  textAlign(CENTER);
  text("ENZYME STATUS", x, y - 95);  textStyle(NORMAL);

  let phC = lerpColor(color(0, 150, 255), color(255, 0, 0), map(currentPH, 7, 1, 0, 1));
  fill(30, 40, 60);  rect(x, y - 40, 240, 40, 5);
  let phW = map(currentPH, 7, 1, 0, 240);
  fill(phC);  rect(x - 120 + phW / 2, y - 40, phW, 40, 5);
  noStroke();  // no glow effects on pH bar
  fill(255);  textStyle(NORMAL);  textSize(13);  textAlign(CENTER);
  text("pH: " + nf(currentPH, 1, 1), x, y - 72);

  fill(30, 40, 60);  rect(x, y + 10, 240, 20, 5);
  let pgW = map(pepsinogenReserve, 0, 100, 0, 240);
  fill(100, 150, 200);  rect(x - 120 + pgW / 2, y + 10, pgW, 20, 5);
  fill(255);  textStyle(NORMAL);  textSize(11);  textAlign(CENTER);
  text("INACTIVE ENZYME (Pepsinogen): " + nf(pepsinogenReserve, 0, 0) + "%", x, y - 5);

  fill(30, 40, 60);  rect(x, y + 55, 240, 20, 5);
  let pepColor = (pepsinState === PepsinState.ACTIVE)    ? color(0, 255, 150)   :
                 (pepsinState === PepsinState.PARTIAL)   ? color(255, 255, 0)   :
                 (pepsinState === PepsinState.DENATURED) ? color(255, 50, 50)   :
                                                           color(100, 100, 100);
  fill(pepColor);
  rect(x - 120 + map(pepsinConcentration, 0, 100, 0, 240) / 2, y + 55,
       map(pepsinConcentration, 0, 100, 0, 240), 20, 5);
  fill(255);  textStyle(NORMAL);  textSize(11);  textAlign(CENTER);  text("ACTIVE ENZYME (Pepsin): " + nf(pepsinConcentration, 0, 0) + "%", x, y + 40);

  textStyle(NORMAL);  textSize(13);
  if      (pepsinState === PepsinState.DENATURED)     { fill(255, 50, 50);   text("BROKEN — SHAPE DESTROYED",   x, y + 100); }
  else if (enzymeActive)                              { fill(0, 255, 150);   text("DIGESTING PROTEIN NOW!",      x, y + 100); }
  else if (inPHWindow && pepsinConcentration > 0)     { fill(255, 255, 0);   text("ENZYME ACTIVATING: " + nf(pepsinConcentration,0,0) + "%",  x, y + 100); }
  else if (inPHWindow)                                { fill(255, 200, 0);   text("OPTIMAL pH — WAITING",        x, y + 100); }
  else if (currentPH < 1.5)                          { fill(255, 100, 100); text("TOO MUCH ACID — SLIDE LEFT!",  x, y + 100); }
  else if (currentPH > 5.0 && pepsinConcentration > 0){ fill(255, 50, 50);  text("ENZYME BREAKING DOWN!",       x, y + 100); }
  else if (currentPH > 3.0)                          { fill(200);           text("pH NOT IN RANGE YET",          x, y + 100); }
  else                                               { fill(200);           text("WAITING FOR ACID",             x, y + 100); }
  pop();  // restore all styles — zero bleed to outer draw
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

  textAlign(CENTER);
  if (homeostasisReached) {
    fill(0, 255, 150);  textStyle(BOLD);  textSize(22);
    text("ACID NEUTRALIZED — READY FOR NUTRIENT ABSORPTION!", GAME_W / 2, warningY);  textStyle(NORMAL);
    if (!phase2ProceedSoundPlayed) { playSoundOnce(successSfx);  phase2ProceedSoundPlayed = true; }
    drawProceedButton(GAME_W / 2, warningY + 45);
  } else if (greenZoneTimer > 0) {
    // Actively counting — show progress bar
    let pct = greenZoneTimer / GREEN_ZONE_REQUIRED;
    fill(0, 255, 150, 150 + sin(millis() * 0.004) * 105);  textStyle(BOLD);  textSize(22);
    text("HORMONES BALANCED — HOLD FOR " + nf((GREEN_ZONE_REQUIRED - greenZoneTimer) / 60, 0, 0) + "s MORE...", GAME_W / 2, warningY);  textStyle(NORMAL);
    // Progress bar
    fill(30, 40, 60);  stroke(255, 80);  strokeWeight(1);
    rect(GAME_W / 2, warningY + 40, 400, 18, 5);
    fill(0, 255, 150);  noStroke();
    rect(GAME_W / 2 - 200 + pct * 200, warningY + 40, pct * 400, 18, 5);
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

  // Mist already updated in logic tick; draw it here
  for (let m of hormoneMist) m.display();

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

  // Physics+mist already ticked in updateGameLogic(); draw nutrients
  for (let m of hormoneMist) m.display();
  drawNutrient(glucoseImg, glucoseX,    glucoseY,    "Glucose",        [0, 255, 0],   glucoseSorted,    draggingGlucose,    gTimer);
  drawNutrient(sodiumImg,  sodiumSGLTX, sodiumSGLTY, "Sodium — SGLT1", [0, 200, 150], sodiumSGLTSorted, draggingSodiumSGLT, sGLTTimer);
  drawNutrient(sodiumImg,  sodiumNH3X,  sodiumNH3Y,  "Sodium — NHE3",  [0, 100, 200], sodiumNHE3Sorted, draggingSodiumNHE3, nhe3Timer);
  drawNutrient(lipidImg,   lipidX,      lipidY,      "Lipids (Fats)",  [255, 255, 0], lipidSorted,      draggingLipid,      lTimer);

  let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
  if (allAbsorbed) {
    if (phase3ProceedDelay < PHASE3_PROCEED_DELAY_FRAMES) {
      fill(0, 255, 150, 150 + sin(millis() * 0.004) * 105);
      textStyle(BOLD);  textSize(22);  textAlign(CENTER);
      text("COMPLETING THE PROCESS — WAIT...", GAME_W / 2, 105);  textStyle(NORMAL);
    } else {
      fill(0, 0, 0, 180);  rect(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);
      fill(0, 255, 200);  textStyle(BOLD);  textSize(26);  textAlign(CENTER);
      text("ALL NUTRIENTS ABSORBED SUCCESSFULLY!", GAME_W / 2, GAME_H / 2 - 60);  textStyle(NORMAL);
      if (!phase3ProceedSoundPlayed) { playSoundOnce(successSfx);  phase3ProceedSoundPlayed = true; }
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
      gTimer += 1.0 / 1800.0;   // ~30 seconds at 60 ticks/s
      if (gTimer >= 1.0) { glucoseSorted = true; capillaryPulse = 30; triggerBurst(glucoseX, glucoseY, [0,255,0]); playNhe3Sfx(); }
    } else if (pointInZone(glucoseX, glucoseY, zoneX, nheY, zoneW, zoneH) ||
               pointInZone(glucoseX, glucoseY, zoneX, lacY, zoneW, zoneH)) {
      if (glucoseVX >= -5) { glucoseVX = -30; glucoseVY = random(-5, 5); if (millis() - sfx_bounceCooldown > 200) { playSoundOnce(bounceSfx); sfx_bounceCooldown = millis(); } }
      gTimer = 0;
    } else { gTimer = 0; }
  }

  // --- Sodium SGLT → capillary ---
  if (!draggingSodiumSGLT && !sodiumSGLTSorted) {
    if (pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, capY, zoneW, zoneH)) {
      let speedMult = dist(sodiumSGLTX, sodiumSGLTY, glucoseX, glucoseY) < 80 ? 2.0 : 1.0;
      sGLTTimer += (1.0 / 1800.0) * speedMult;   // ~30 seconds
      if (sGLTTimer >= 1.0) { sodiumSGLTSorted = true; capillaryPulse = 30; triggerBurst(sodiumSGLTX, sodiumSGLTY, [0,200,150]); playNhe3Sfx(); }
    } else if (pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, nheY, zoneW, zoneH) ||
               pointInZone(sodiumSGLTX, sodiumSGLTY, zoneX, lacY, zoneW, zoneH)) {
      if (sodiumSGLTVX >= -5) { sodiumSGLTVX = -30; sodiumSGLTVY = random(-5, 5); if (millis() - sfx_bounceCooldown > 200) { playSoundOnce(bounceSfx); sfx_bounceCooldown = millis(); } }
      sGLTTimer = 0;
    } else { sGLTTimer = 0; }
  }

  // --- Sodium NHE3 → exchanger ---
  if (!draggingSodiumNHE3 && !sodiumNHE3Sorted) {
    if (pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, nheY, zoneW, zoneH)) {
      nhe3Timer += 1.0 / 1800.0;   // ~30 seconds
      if (nhe3Timer >= 1.0) { sodiumNHE3Sorted = true; nhe3Pulse = 30; triggerBurst(sodiumNH3X, sodiumNH3Y, [0,100,200]); playNhe3Sfx(); }
    } else if (pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, capY, zoneW, zoneH) ||
               pointInZone(sodiumNH3X, sodiumNH3Y, zoneX, lacY, zoneW, zoneH)) {
      if (sodiumNH3VX >= -5) { sodiumNH3VX = -30; sodiumNH3VY = random(-5, 5); if (millis() - sfx_bounceCooldown > 200) { playSoundOnce(bounceSfx); sfx_bounceCooldown = millis(); } }
      nhe3Timer = 0;
    } else { nhe3Timer = 0; }
  }

  // --- Lipid → lacteal ---
  if (!draggingLipid && !lipidSorted) {
    if (pointInZone(lipidX, lipidY, zoneX, lacY, zoneW, zoneH)) {
      lTimer += 1.0 / 1800.0;   // ~30 seconds
      if (lTimer >= 1.0) { lipidSorted = true; lactealPulse = 30; triggerBurst(lipidX, lipidY, [255,255,180]); playNhe3Sfx(); }
    } else if (pointInZone(lipidX, lipidY, zoneX, capY, zoneW, zoneH) ||
               pointInZone(lipidX, lipidY, zoneX, nheY, zoneW, zoneH)) {
      if (lipidVX >= -5) { lipidVX = -30; lipidVY = random(-5, 5); if (millis() - sfx_bounceCooldown > 200) { playSoundOnce(bounceSfx); sfx_bounceCooldown = millis(); } }
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
  // One-time report sound — fires only when report first opens, never again
  if (!reportSfxPlayed) {
    reportSfxPlayed = true;
    if (reportSfx && reportSfx.isLoaded()) {
      reportSfx.stop();
      reportSfx.setVolume(masterVolume);
      reportSfx.play();
    }
  }

  // Background: same protocolParticles as title screen
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(50);
  text("YOUR DIGESTIVE REPORT", GAME_W / 2, 70);
  stroke(112, 240, 240, 150);  strokeWeight(2);
  line(GAME_W / 2 - 200, 95, GAME_W / 2 + 200, 95);

  let boxW = GAME_W * 0.85, boxH = GAME_H * 0.55, boxY = GAME_H / 2 - 40;
  fill(10, 40, 30, 200);  stroke(0, 255, 150, 100);  strokeWeight(3);
  rect(GAME_W / 2, boxY, boxW, boxH, 20);
  noFill();  stroke(0, 255, 150, 50);  strokeWeight(8);
  rect(GAME_W / 2, boxY, boxW - 20, boxH - 20, 15);

  let content = reportContent[currentReportSlide];
  let cx = GAME_W / 2;
  let bodyLines = content.slice(2);
  let titleSize = 40, bodySize = 38, lineGap = 48;
  let totalBodyH = bodyLines.length * lineGap;
  let blockH = titleSize + 20 + 12 + totalBodyH;
  let blockTop = boxY - blockH / 2;

  // Title — centered, bold
  fill(220, 255, 240);  textAlign(CENTER, TOP);
  textStyle(BOLD);  textSize(titleSize);
  text(content[0], cx, blockTop);

  // Divider line
  let divY = blockTop + titleSize + 10;
  stroke(0, 255, 150, 120);  strokeWeight(1);
  line(cx - boxW / 2 + 60, divY, cx + boxW / 2 - 60, divY);

  // Body lines — phase 4 uses tighter spacing to fit 8 lines in the box
  let lineGapActual = (currentReportSlide === 4) ? 40 : lineGap;
  textStyle(NORMAL);  textSize(bodySize);  fill(210, 245, 230);
  let textY = divY + 20;
  for (let i = 0; i < bodyLines.length; i++) {
    text(bodyLines[i], cx, textY);
    textY += lineGapActual;
  }

  let btnY = boxY + boxH / 2 + 70, btnSpacing = 195;
  let startX = GAME_W / 2 - btnSpacing * 2;
  for (let i = 0; i < 5; i++) {
    let bx = startX + i * btnSpacing;
    let isActive = (currentReportSlide === i), isDone = phaseCompleted[i];
    if (isActive) {
      noFill();  stroke(255, 255, 255, 180);  strokeWeight(3);
      rect(bx, btnY, 170, 100, 12);
    }
    fill(isActive ? color(0, 100, 100) : isDone ? color(0, 80, 80) : color(20, 40, 50), 220);
    stroke(isActive ? color(0, 255, 200) : isDone ? color(0, 255, 150) : color(80, 100, 110));
    strokeWeight(isActive ? 3 : 2);  rect(bx, btnY, 160, 95, 10);
    fill(255);
    textStyle(BOLD);  textSize(18);  textAlign(CENTER);  text("PHASE " + i, bx, btnY - 15);  textStyle(NORMAL);
    fill(220, 240, 255);
    textSize(13);  text(isDone ? "COMPLETED" : "PENDING", bx, btnY + 10);
    if (isDone) {
      fill(phaseColors[i][0], phaseColors[i][1], phaseColors[i][2]);
      textStyle(BOLD);  textSize(20);  text(nf(phaseEfficiency[i], 0, 0) + "%", bx, btnY + 38);  textStyle(NORMAL);
    }
  }

  // Static hint — no hover, no effects
  noStroke();  fill(160, 175, 190);  textStyle(NORMAL);  textSize(15);  textAlign(CENTER);
  text("Select a phase button above to read its detailed report", GAME_W / 2, GAME_H - 48);
  // Developer credit now handled by drawFooter() — no duplicate text here
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
      acceptedLicense = true;  showLicenseScreen = false;  saveProgress();  if (clickSfx && !clickSfx.isPlaying()) { clickSfx.stop(); clickSfx.play(); }  return;
    }
    if (ix > dx - dw / 2 && ix < dx + dw / 2 && iy > btnY - btnH / 2 && iy < btnY + btnH / 2)
      // Try to close the PWA/tab; show farewell screen as fallback
      if (window.confirm("Exit BioBalance?")) {
        window.close();
        // Fallback if window.close() is blocked (most browsers in a tab)
        document.body.innerHTML = "<div style=\"background:#000;color:#00ffc8;font-family:monospace;text-align:center;padding:100px 40px;font-size:28px;\">Thank you for visiting BioBalance.<br><br><span style=\"font-size:18px;color:#aaa;\">You can close this tab.</span></div>";
      }
    return;
  }

  if (quizState === 1) { handleQuizClick();  return; }  // no clickSfx — wrong/correct sounds are the feedback
  // NOTE: clickSfx is fired ONLY in each specific button handler below — not here

  if (mode !== MODE_TITLE && mode !== MODE_MECHANICS) {
    if (ix > 15 && ix < 135 && iy > 10 && iy < 50) { playSoundOnce(clickSfx);  mode = MODE_TITLE;  resetAll();  return; }
  }

  if (mode === MODE_TITLE) {
    let bw = 360, bh = 90, cx = GAME_W / 2;
    if (ix > cx - bw/2 && ix < cx + bw/2 && iy > GAME_H/2+40  && iy < GAME_H/2+130) { playSoundOnce(clickSfx);  mode = MODE_JOURNEY;   transitionAlpha = 0; }
    if (ix > cx - bw/2 && ix < cx + bw/2 && iy > GAME_H/2+150 && iy < GAME_H/2+240) { playSoundOnce(clickSfx);  mode = MODE_MECHANICS; currentCard = 0; transitionAlpha = 0; }
    // Settings button (top-right)
    let sbx = GAME_W-80, sby = 35, sbw = 120, sbh = 40;
    if (ix > sbx-sbw/2 && ix < sbx+sbw/2 && iy > sby-sbh/2 && iy < sby+sbh/2) {
      playSoundOnce(clickSfx);  settingsReturnMode = MODE_TITLE;  mode = MODE_SETTINGS;  transitionAlpha = 0;
    }
    // More Info button (top-left)
    let ibx2 = 80, iby2 = 35, ibw2 = 120, ibh2 = 40;
    if (ix > ibx2-ibw2/2 && ix < ibx2+ibw2/2 && iy > iby2-ibh2/2 && iy < iby2+ibh2/2) {
      playSoundOnce(clickSfx);  infoReturnMode = MODE_TITLE;  mode = MODE_INFO;  transitionAlpha = 0;
    }
  }

  if (mode === MODE_SETTINGS) {
    // Volume slider drag
    if (dist(ix, iy, _settingsKnobX, _settingsSliderY) < 30) isDraggingVolumeSlider = true;
    // Preset buttons
    let presets = [0, 0.25, 0.5, 0.75, 1.0];
    for (let i = 0; i < presets.length; i++) {
      let bx2 = GAME_W/2 - 250 + i*125, by2 = _settingsSliderY + 110, bw2 = 100, bh2 = 40;
      if (ix > bx2-bw2/2 && ix < bx2+bw2/2 && iy > by2-bh2/2 && iy < by2+bh2/2) {
        masterVolume = presets[i];  playSoundOnce(clickSfx);
      }
    }
    // Back button
    let backX = GAME_W/2, backY = GAME_H-80, backW = 200, backH = 50;
    if (ix > backX-backW/2 && ix < backX+backW/2 && iy > backY-backH/2 && iy < backY+backH/2) {
      playSoundOnce(clickSfx);  mode = settingsReturnMode;  transitionAlpha = 0;
    }
  }

  if (mode === MODE_INFO) {
    // Link box click — open site
    let lbx = GAME_W/2, lby = GAME_H/2 + 60, lbw = 700, lbh = 80;
    if (ix > lbx-lbw/2 && ix < lbx+lbw/2 && iy > lby-lbh/2 && iy < lby+lbh/2) {
      window.open('https://theos13-nw.github.io/BioBalance-SITE', '_blank');
    }
    // Back button
    let bi2x = GAME_W/2, bi2y = GAME_H-80, bi2w = 200, bi2h = 50;
    if (ix > bi2x-bi2w/2 && ix < bi2x+bi2w/2 && iy > bi2y-bi2h/2 && iy < bi2y+bi2h/2) {
      playSoundOnce(clickSfx);  mode = infoReturnMode;  transitionAlpha = 0;
    }
  }

  if (mode === MODE_EXIT_CONFIRM) {
    // EXIT button (red, left)
    let exBtnX = GAME_W/2 - 130, exBtnY = GAME_H/2 + 75, exBtnW = 200, exBtnH = 60;
    if (ix > exBtnX-exBtnW/2 && ix < exBtnX+exBtnW/2 &&
        iy > exBtnY-exBtnH/2 && iy < exBtnY+exBtnH/2) {
      playSoundOnce(clickSfx);
      saveProgress();
      // Try to close the PWA window; fallback to a farewell page
      window.close();
      document.body.innerHTML = "<div style=\"background:#000;color:#00ffc8;font-family:monospace;" +
        "text-align:center;padding:100px 40px;font-size:28px;\">Thank you for using BioBalance.<br><br>" +
        "<span style=\"font-size:18px;color:#aaa;\">You can close this tab.</span></div>";
      return;
    }
    // CANCEL button (cyan, right)
    let caBtnX = GAME_W/2 + 130, caBtnY = GAME_H/2 + 75, caBtnW = 200, caBtnH = 60;
    if (ix > caBtnX-caBtnW/2 && ix < caBtnX+caBtnW/2 &&
        iy > caBtnY-caBtnH/2 && iy < caBtnY+caBtnH/2) {
      playSoundOnce(clickSfx);
      mode = exitReturnMode;  transitionAlpha = 0;
    }
    return;  // consume all input while confirm screen is up
  }

  if (mode === MODE_MECHANICS) {
    let bx = GAME_W - 80, by = GAME_H - 80;
    if (dist(ix, iy, bx, by) < 60) {
      playSoundOnce(clickSfx);
      if (currentCard < totalCards - 1) currentCard++;
      else { mode = MODE_JOURNEY;  transitionAlpha = 0; }
    }
    if (ix > 30 && ix < 180 && iy > 20 && iy < 60) { playSoundOnce(clickSfx);  mode = MODE_TITLE;  transitionAlpha = 0; }
  }

  if (mode === MODE_JOURNEY) {
    // VIEW REPORT button
    let done2 = phaseCompleted.filter(Boolean).length;
    let rBtnXi = GAME_W-160, rBtnYi = GAME_H/2+150, rBtnWi = 260, rBtnHi = 60;
    if (ix > rBtnXi-rBtnWi/2 && ix < rBtnXi+rBtnWi/2 && iy > rBtnYi-rBtnHi/2 && iy < rBtnYi+rBtnHi/2) {  // DEBUG: always accessible
      playSoundOnce(clickSfx);  currentReportSlide = 0;  reportSfxPlayed=false;  mode = MODE_FINISH;  transitionAlpha = 0;  return;
    }
    for (let i = 0; i < 5; i++) {
      let nx = GAME_W / 2 - 440 + i * 220, ny = GAME_H / 2 - 50;
      // DEBUG: all phases always accessible for fast testing
      if (dist(ix, iy, nx, ny) < 50) {
        playSoundOnce(clickSfx);
        selectedPhase = i;
        gateAttemptsCount[i] = 0;
        const phaseMode = [MODE_PHASE0, MODE_PHASE1, MODE_PHASE2, MODE_PHASE3, MODE_PHASE4];
        mode = phaseMode[i];
        initPhaseParticles(i);
        if (i === 4) resetPhase4();
        transitionAlpha = 0;
      }
    }
  }

  if (mode === MODE_PHASE0) {
    let sliderY = GAME_H - 150, buttonY = 130;
    if (ix > (GAME_W/2-110)-90 && ix < (GAME_W/2-110)+90 && iy > (sliderY+90)-25 && iy < (sliderY+90)+25) {
      playSoundOnce(clickSfx);
      if (foodType !== 1) { foodScale = 0;  emeticTimer = 0;  if (warningSfx && warningSfx.isPlaying()) warningSfx.stop(); }
      foodType = 1;
    } else if (ix > (GAME_W/2+110)-90 && ix < (GAME_W/2+110)+90 && iy > (sliderY+90)-25 && iy < (sliderY+90)+25) {
      playSoundOnce(clickSfx);
      if (foodType !== 2) { foodScale = 0;  emeticTimer = 0;  if (warningSfx && warningSfx.isPlaying()) warningSfx.stop(); }
      foodType = 2;
    }
    if (hasSwallowed && swallowProceedDelay >= SWALLOW_PROCEED_FRAMES) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) { playSoundOnce(clickSfx);  startReflectionGate(); }
    } else if (isChewing) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) {
        playSoundOnce(clickSfx);  if (swallowSfx) { swallowSfx.stop(); swallowSfx.play(); }  hasSwallowed = true;  swallowProceedDelay = 0;
      }
    } else if (cephalicReady) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) {
        playSoundOnce(clickSfx);  isChewing = true;  if (chewSfx) { chewSfx.stop(); chewSfx.play(); }
      }
    }
    if (iy > GAME_H-180 && iy < GAME_H-120 && ix > smellSliderX-30 && ix < smellSliderX+30)
      isDraggingSmellSlider = true;  // slider drag — no click sound
  }

  if (mode === MODE_PHASE1) {
    if (pepsinState === PepsinState.DENATURED) {
      textStyle(BOLD);  textSize(20);
      let bw2 = textWidth("RESTORE PEPSIN") + 60, bh2 = 54, bx2 = GAME_W/2, by2 = 90+35;
      if (ix > bx2-bw2/2 && ix < bx2+bw2/2 && iy > by2-bh2/2 && iy < by2+bh2/2) { playSoundOnce(clickSfx);  resetPepsin(); }
    }
    if (phase1Complete && proteinScale < 0.3) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (90+35)-25 && iy < (90+35)+25) {
        playSoundOnce(clickSfx);
        if (acidSfx && acidSfx.isPlaying()) acidSfx.stop();
        sfx_wantAcid = false;
        startReflectionGate();
      }
    }
    let sliderY = GAME_H-110, sliderStart = GAME_W/2-150, sliderEnd = GAME_W/2+150;
    if (iy > sliderY-30 && iy < sliderY+30 && ix > sliderX-30 && ix < sliderX+30)
      isDraggingPHSlider = true;  // slider drag — no click sound
  }

  if (mode === MODE_PHASE2) {
    let yOffset = 40, warningY = 130;
    // Hormone spray areas — no click sound (continuous hold mechanic)
    if (ix > GAME_W*0.15-100 && ix < GAME_W*0.15+100 && iy > GAME_H/2+50+yOffset-80 && iy < GAME_H/2+50+yOffset+80) sprayType = 1;
    else if (ix > GAME_W*0.85-100 && ix < GAME_W*0.85+100 && iy > GAME_H/2+50+yOffset-80 && iy < GAME_H/2+50+yOffset+80) sprayType = 2;
    if (homeostasisReached) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (warningY+45)-25 && iy < (warningY+45)+25) { playSoundOnce(clickSfx);  startReflectionGate(); }
    }
  }

  if (mode === MODE_PHASE3) {
    let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
    if (allAbsorbed && phase3ProceedDelay >= PHASE3_PROCEED_DELAY_FRAMES) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (GAME_H/2+22)-25 && iy < (GAME_H/2+22)+25) { playSoundOnce(clickSfx);  startReflectionGate(); }
    } else {
      // Particle drags — dragSfx only, no click sound overlap
      if      (dist(ix, iy, glucoseX,    glucoseY)    < 40) { draggingGlucose    = true;  dragOffsetX = glucoseX    - ix;  dragOffsetY = glucoseY    - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, sodiumSGLTX, sodiumSGLTY) < 40) { draggingSodiumSGLT = true;  dragOffsetX = sodiumSGLTX - ix;  dragOffsetY = sodiumSGLTY - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, sodiumNH3X,  sodiumNH3Y)  < 40) { draggingSodiumNHE3 = true;  dragOffsetX = sodiumNH3X  - ix;  dragOffsetY = sodiumNH3Y  - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, lipidX,      lipidY)      < 40) { draggingLipid      = true;  dragOffsetX = lipidX      - ix;  dragOffsetY = lipidY      - iy;  playSoundOnce(dragSfx); }
    }
  }

  if (mode === MODE_PHASE4) {
    // Mirror exact coords from phase4() draw function
    let guideY      = GAME_H * 0.10;
    let btnPY       = guideY + GAME_H * 0.06;
    let sliderY4    = GAME_H * 0.94;
    let sliderStart = GAME_W * 0.34;
    let sliderEnd   = GAME_W * 0.66;
    // Peristalsis hold button — only when stool not yet at end
    if (!peristalsissComplete &&
        ix > GAME_W/2 - 110 && ix < GAME_W/2 + 110 &&
        iy > btnPY - 27  && iy < btnPY + 27) {
      peristalsisActive = true;
    }
    // Proceed button — only after full 3s countdown
    if (phase4Ready && phase4ProceedDelay >= PHASE4_PROCEED_DELAY_FRAMES) {
      let proceedY = guideY + GAME_H * 0.067;
      if (ix > GAME_W/2 - 100 && ix < GAME_W/2 + 100 &&
          iy > proceedY - 25 && iy < proceedY + 25) {
        playSoundOnce(clickSfx);
        startReflectionGate();
      }
    }
    // Water slider drag — full track hitbox, tight vertical tolerance
    if (iy > sliderY4 - 20 && iy < sliderY4 + 20 &&
        ix > sliderStart - 16 && ix < sliderEnd + 16)
      isDraggingWaterSlider = true;
  }

  if (mode === MODE_FINISH) {
    let boxH = GAME_H * 0.55, boxY = GAME_H/2-40, btnY = boxY+boxH/2+70, bsp = 195;
    let sx = GAME_W/2 - bsp*2;
    for (let i = 0; i < 5; i++) {
      let bx = sx + i*bsp;
      if (ix > bx-85 && ix < bx+85 && iy > btnY-47 && iy < btnY+47) {
        currentReportSlide = i;
        playSoundOnce(clickSfx);
      }
    }
  }
}

function handleInputEnd() {
  draggingGlucose = draggingSodiumSGLT = draggingSodiumNHE3 = draggingLipid = false;
  sprayType = 0;
  peristalsisActive = false;
  isDraggingSmellSlider = isDraggingPHSlider = isDraggingVolumeSlider = isDraggingWaterSlider = false;
  if (spraySfx && spraySfx.isPlaying()) spraySfx.stop();
}

function windowResized() {
  let trueH = (window.visualViewport ? window.visualViewport.height : windowHeight);
  resizeCanvas(windowWidth, trueH);
  _calcScale();
  bgGradientBuffer    = createGraphics(GAME_W, GAME_H);
  reportGradientBuffer = createGraphics(GAME_W, GAME_H);
  needsGradientRedraw = true;
  MEMBRANE_X   = GAME_W / 2;
  smellSliderX = GAME_W / 2 - 200;
  sliderX      = GAME_W / 2 - 150;
  waterSliderX = GAME_W * 0.34;
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
  isChewing = false;  hasSwallowed = false;  swallowProceedDelay = 0;
  cephalicTimer = 0;  insulinLevel = 0;
  hepaticGlucoseOutput = 100;  peripheralGlucoseUptake = 0;  emeticTimer = 0;
  cephalicSuccessPlayed = false;  warningPlayed = false;
  phase0ProceedSoundPlayed = false;  aromaParticles = [];

  currentReportSlide = 0;  reportPlayed = false;
  quizState = 0;  quizSubState = 0;
  phase3ProceedDelay = 0;  phase3ProceedSoundPlayed = false;
  resetPhase4();
  selectedPhase = -1;  currentCard = 0;
  successParticles = [];
  phase0Particles = [];  phase1Particles = [];  phase2Particles = [];  phase3Particles = [];  phase4Particles = [];
  isDraggingSmellSlider = false;  isDraggingPHSlider = false;  isDraggingWaterSlider = false;
  wrongAnswers = [];  dragOffsetX = 0;  dragOffsetY = 0;
  gateJustCompleted = false;

  stopAllLoopingSounds();  // stop ALL looping sounds cleanly on full reset
}

// =========================================================
// TITLE SCREEN
// =========================================================
function drawTitleScreen() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(72);
  text("BioBalance", GAME_W/2, GAME_H/2-180);
  textSize(36);  text("DIGESTIVE CONTROL", GAME_W/2, GAME_H/2-130);

  fill(150, 200, 255);  textStyle(NORMAL);  textSize(20);
  text("Explore, control, and understand how your body digests food.", GAME_W/2, GAME_H/2-90);

  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-250, GAME_H/2-70, GAME_W/2+250, GAME_H/2-70);

  let bw = 360, bh = 90, cx = GAME_W/2;
  let h1 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+40 && getInputY()<GAME_H/2+130;
  let h2 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+150 && getInputY()<GAME_H/2+240;
  drawTitleButton(cx, GAME_H/2+85,  bw, bh, "START JOURNEY", "Play through all 5 digestive phases", h1);
  drawTitleButton(cx, GAME_H/2+195, bw, bh, "HOW TO PLAY",   "Read the instructions before playing", h2);

  // Settings button top-right
  let sbx = GAME_W - 80, sby = 35, sbw = 120, sbh = 40;
  let hset = getInputX()>sbx-sbw/2 && getInputX()<sbx+sbw/2 && getInputY()>sby-sbh/2 && getInputY()<sby+sbh/2;
  fill(hset ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,255,200, hset?255:150);  strokeWeight(2);
  rect(sbx, sby, sbw, sbh, 8);
  fill(255);  textStyle(BOLD);  textSize(16);  textAlign(CENTER,CENTER);
  text("SETTINGS", sbx, sby-2);  textStyle(NORMAL);

  // More Info button top-left (opposite of settings)
  let ibx = 80, iby = 35, ibw = 120, ibh = 40;
  let hinfo = getInputX()>ibx-ibw/2 && getInputX()<ibx+ibw/2 && getInputY()>iby-ibh/2 && getInputY()<iby+ibh/2;
  fill(hinfo ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,255,200, hinfo?255:150);  strokeWeight(2);
  rect(ibx, iby, ibw, ibh, 8);
  fill(255);  textStyle(BOLD);  textSize(16);  textAlign(CENTER,CENTER);
  text("MORE INFO", ibx, iby-2);  textStyle(NORMAL);

  // Footer text handled by drawFooter() — no duplicate here
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
  text("BioBalance — Digestive Control Guide", GAME_W/2, 115);
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
  let pulse4 = (sin(millis()*0.002)+1)/2.0;
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
  push();  translate(x, y);
  // Box border always visible — active gets brighter
  fill(15,30,50, 220);
  stroke(0,255,200, isActive?255:100);  strokeWeight(isActive?4:2);  rect(0,0,w,h,15);
  if (isActive) { noFill();  stroke(0,255,200,40);  strokeWeight(12);  rect(0,0,w-20,h-20,12); }
  // Card title hover only — active is cyan, inactive is grey
  fill(isActive ? color(0,255,200) : color(130,150,170));
  textStyle(BOLD);  textSize(26);  textAlign(CENTER);
  text(cardTitles[idx], 0, -h/2+45);  textStyle(NORMAL);
  // Body content — always same size and colour, NO hover effect
  fill(220, 235, 255);
  textSize(20);  textAlign(LEFT);
  let ly = -h/2+90;
  for (let line of cardContent[idx]) { text(line, -w/2+30, ly);  ly += 28; }
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
  for (let i = 0; i < 5; i++) { if (phaseCompleted[i]) { done++;  tot += phaseEfficiency[i]; } }
  let sysInt = done === 0 ? 0 : tot / done;

  fill(150,200,255);  textStyle(NORMAL);  textSize(18);
  text("Overall Score: " + nf(sysInt,0,1) + "%  |  Phases Completed: " + done + " / 5", GAME_W/2, 120);

  // Connection lines between 5 nodes (4 gaps), node spacing 220
  strokeWeight(4);
  for (let i = 0; i < 4; i++) {
    let x1 = GAME_W/2-440+(i*220), x2 = x1+220, y = GAME_H/2-50;
    stroke(phaseCompleted[i] ? color(0,255,200, 100+connectionGlow*155)
           : (i===0||phaseCompleted[i-1]) ? color(0,255,200,50) : color(50,60,80,100));
    line(x1, y, x2, y);
    if (phaseCompleted[i]) {
      fill(0,255,200,200);  noStroke();
      ellipse(x1 + (millis()/8.333)%220, y, 8, 8);
    }
  }

  for (let i = 0; i < 5; i++) drawPhaseNode(GAME_W/2-440+i*220, GAME_H/2-50, i);

  if (selectedPhase >= 0) {
    let sx = GAME_W/2-440+selectedPhase*220, sy = GAME_H/2-50;
    noFill();  stroke(255,255,0, 150+sin(millis()*0.002)*105);  strokeWeight(3);
    ellipse(sx,sy,120,120);
  }

  // Journey instruction text
  fill(255);  textStyle(NORMAL);  textSize(18);  textAlign(CENTER);
  text("Click an available phase node to begin or replay", GAME_W/2, GAME_H-100);

  fill(0,40,60,180);  stroke(0,255,200,80);  strokeWeight(1);  rect(200,GAME_H-150,300,100,10);
  fill(0,255,200);  textStyle(BOLD);  textSize(16);  textAlign(LEFT);  text("PROGRESS",80,GAME_H-180);
  fill(200,220,255);  textStyle(NORMAL);  textSize(14);
  text("Status: " + (done===5?"COMPLETE!":done>=2?"IN PROGRESS":"JUST STARTING"), 80, GAME_H-155);
  text("Score: " + nf(sysInt,0,1)+"%", 80, GAME_H-135);

  if (done === 5) {
    fill(0,255,200, 100+(sin(millis()*0.002)+1)/2.0*155);
    textStyle(BOLD);  textSize(28);  textAlign(CENTER);
    text("DIGESTION COMPLETE!", GAME_W-200, GAME_H-130);  textStyle(NORMAL);
  }

  // VIEW REPORT button — locked until all 5 phases done
  let rBtnX2 = GAME_W - 160, rBtnY2 = GAME_H/2 + 150, rBtnW2 = 260, rBtnH2 = 60;
  let allDone2 = (done === 5);
  let hRep2 = allDone2 && getInputX()>rBtnX2-rBtnW2/2 && getInputX()<rBtnX2+rBtnW2/2 &&
              getInputY()>rBtnY2-rBtnH2/2 && getInputY()<rBtnY2+rBtnH2/2;
  fill(allDone2 ? (hRep2 ? color(0,150,120) : color(0,100,80)) : color(30,40,50), 220);
  stroke(allDone2 ? color(0,255,200) : color(60,70,80));  strokeWeight(allDone2 ? 3 : 1);
  rect(rBtnX2, rBtnY2, rBtnW2, rBtnH2, 12);
  fill(allDone2 ? 255 : color(80,90,100));
  textStyle(BOLD);  textSize(18);  textAlign(CENTER,CENTER);
  text(allDone2 ? "VIEW FULL REPORT" : "REPORT (Complete all phases)", rBtnX2, rBtnY2 - 2);
  textStyle(NORMAL);
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
      noFill();  stroke(255,215,0, 150+sin(millis()*0.002)*105);  strokeWeight(4);
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

  // Agreement text — plain, formal, no effects
  noStroke();
  fill(220, 225, 235);  textStyle(NORMAL);  textSize(19);  textAlign(LEFT);
  let lines = [
    "BioBalance: Digestive Control",
    "",
    "Copyright (c) 2026 Altheo Cardillo. All Rights Reserved.",
    "",
    "This software is provided for educational use only.",
    "Redistribution, modification, or commercial use without",
    "express written permission of the author is strictly prohibited.",
    "",
    "This application is an Educational Game Prototype developed as part",
    "of a Bachelor of Secondary Education academic requirement.",
    "System Designer: Altheo Cardillo",
    "",
    "By clicking AGREE below, you acknowledge that you have read",
    "and accept the terms stated in this agreement."
  ];
  let yp = GAME_H/2 - 175;
  let lx = GAME_W/2 - 310;
  for (let l of lines) { text(l, lx, yp);  yp += 26; }

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
// SETTINGS SCREEN
// =========================================================
function drawSettingsScreen() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(56);
  text("SETTINGS", GAME_W/2, 80);
  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-200, 105, GAME_W/2+200, 105);

  // Volume slider
  let sliderCX = GAME_W/2, sliderY = GAME_H/2 - 60;
  let sliderLen = 500, sliderStart = sliderCX - sliderLen/2, sliderEnd = sliderCX + sliderLen/2;
  let knobX = map(masterVolume, 0, 1, sliderStart, sliderEnd);

  fill(150, 200, 255);  textStyle(NORMAL);  textSize(22);  textAlign(CENTER);
  text("MASTER VOLUME", sliderCX, sliderY - 50);

  stroke(60, 80, 100);  strokeWeight(8);  line(sliderStart, sliderY, sliderEnd, sliderY);
  stroke(0, 255, 200);  strokeWeight(8);  line(sliderStart, sliderY, knobX, sliderY);
  fill(0, 255, 200);  noStroke();  ellipse(knobX, sliderY, 36, 36);

  fill(200);  textSize(16);
  textAlign(RIGHT);  text("MUTE", sliderStart - 15, sliderY + 6);
  textAlign(LEFT);   text("MAX",  sliderEnd   + 15, sliderY + 6);
  textAlign(CENTER);

  let volLabel = masterVolume < 0.02 ? "MUTED" : int(masterVolume * 100) + "%";
  fill(0, 255, 200);  textStyle(BOLD);  textSize(28);
  text(volLabel, sliderCX, sliderY + 55);  textStyle(NORMAL);

  // Preset buttons
  let presets = [{l:"MUTE",v:0},{l:"25%",v:0.25},{l:"50%",v:0.5},{l:"75%",v:0.75},{l:"MAX",v:1.0}];
  for (let i = 0; i < presets.length; i++) {
    let bx = GAME_W/2 - 250 + i*125, by = sliderY + 110, bw = 100, bh = 40;
    let active = abs(masterVolume - presets[i].v) < 0.01;
    let hov = getInputX()>bx-bw/2 && getInputX()<bx+bw/2 && getInputY()>by-bh/2 && getInputY()<by+bh/2;
    fill(active ? color(0,150,120) : hov ? color(0,100,100) : color(20,40,50), 220);
    stroke(active ? color(0,255,200) : color(80,100,120));  strokeWeight(active?3:1);
    rect(bx, by, bw, bh, 8);
    fill(255);  textStyle(active?BOLD:NORMAL);  textSize(16);  textAlign(CENTER,CENTER);
    text(presets[i].l, bx, by-2);  textStyle(NORMAL);
  }

  // Back button
  let backX = GAME_W/2, backY = GAME_H - 80, backW = 200, backH = 50;
  let hBack = getInputX()>backX-backW/2 && getInputX()<backX+backW/2 &&
              getInputY()>backY-backH/2 && getInputY()<backY+backH/2;
  fill(hBack ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,255,200);  strokeWeight(2);  rect(backX, backY, backW, backH, 10);
  fill(255);  textStyle(BOLD);  textSize(18);  textAlign(CENTER,CENTER);
  text("BACK", backX, backY-2);  textStyle(NORMAL);

  // Cache slider coords for drag/click detection
  _settingsKnobX = knobX;
  _settingsSliderStart = sliderStart;
  _settingsSliderEnd   = sliderEnd;
  _settingsSliderY     = sliderY;
}

// =========================================================
// MORE INFO SCREEN
// =========================================================
function drawInfoScreen() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  // Title
  fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(52);
  text("MORE INFO", GAME_W/2, 80);
  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-200, 108, GAME_W/2+200, 108);

  // Description block
  fill(170, 200, 230);  textStyle(NORMAL);  textSize(20);  textAlign(CENTER);
  text("BioBalance: Digestive Control is available as a desktop app for Windows and as a", GAME_W/2, 155);
  text("Progressive Web App (PWA) you can open on any phone or tablet.", GAME_W/2, 182);

  // Section label
  fill(0, 255, 200);  textStyle(BOLD);  textSize(22);
  text("OFFICIAL WEBSITE", GAME_W/2, 240);  textStyle(NORMAL);

  fill(150, 170, 200);  textSize(17);
  text("Visit the site to download the Windows version or access the mobile app.", GAME_W/2, 270);

  // Link box — looks like a clean button, clickable
  let lbx = GAME_W/2, lby = GAME_H/2 + 60, lbw = 700, lbh = 80;
  let hlnk = getInputX()>lbx-lbw/2 && getInputX()<lbx+lbw/2 &&
             getInputY()>lby-lbh/2 && getInputY()<lby+lbh/2;
  fill(hlnk ? color(0,80,70) : color(5,25,40), 230);
  stroke(hlnk ? color(0,255,200) : color(0,180,140));  strokeWeight(hlnk ? 3 : 2);
  rect(lbx, lby, lbw, lbh, 14);

  // URL text — big, clear, no glow
  fill(0, 255, 200);  textStyle(BOLD);  textSize(30);  textAlign(CENTER, CENTER);
  text("theos13-nw.github.io/BioBalance-SITE", lbx, lby - 2);  textStyle(NORMAL);

  // Small hint below box
  fill(120, 140, 160);  textSize(15);  textAlign(CENTER);
  text("Tap / click the box above to open in browser", lbx, lby + lbh/2 + 24);

  // Back button
  let bi2x = GAME_W/2, bi2y = GAME_H-80, bi2w = 200, bi2h = 50;
  let hBack2 = getInputX()>bi2x-bi2w/2 && getInputX()<bi2x+bi2w/2 &&
               getInputY()>bi2y-bi2h/2 && getInputY()<bi2y+bi2h/2;
  fill(hBack2 ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,255,200);  strokeWeight(2);  rect(bi2x, bi2y, bi2w, bi2h, 10);
  fill(255);  textStyle(BOLD);  textSize(18);  textAlign(CENTER,CENTER);
  text("BACK", bi2x, bi2y-2);  textStyle(NORMAL);
}

// =========================================================
// EXIT CONFIRM SCREEN
// =========================================================
function drawExitConfirmScreen() {
  // Dim overlay over whatever was behind
  fill(0, 0, 0, 210);  noStroke();
  rect(GAME_W/2, GAME_H/2, GAME_W, GAME_H);

  // Panel
  fill(10, 20, 35, 240);  stroke(0, 255, 200, 160);  strokeWeight(3);
  rect(GAME_W/2, GAME_H/2, 560, 320, 20);

  // Title
  fill(255, 255, 255);  textStyle(BOLD);  textAlign(CENTER, CENTER);  textSize(32);
  text("EXIT BIOBALANCE?", GAME_W/2, GAME_H/2 - 90);  textStyle(NORMAL);

  fill(180, 200, 220);  textSize(18);
  text("Your progress has been saved.", GAME_W/2, GAME_H/2 - 48);
  text("Are you sure you want to exit?", GAME_W/2, GAME_H/2 - 20);

  // EXIT button (red)
  let exBtnX = GAME_W/2 - 130, exBtnY = GAME_H/2 + 75, exBtnW = 200, exBtnH = 60;
  let hEx = getInputX()>exBtnX-exBtnW/2 && getInputX()<exBtnX+exBtnW/2 &&
            getInputY()>exBtnY-exBtnH/2 && getInputY()<exBtnY+exBtnH/2;
  fill(hEx ? color(180, 30, 30) : color(120, 20, 20), 240);
  stroke(255, 80, 80);  strokeWeight(hEx ? 4 : 2);
  rect(exBtnX, exBtnY, exBtnW, exBtnH, 12);
  fill(255);  textStyle(BOLD);  textSize(22);  textAlign(CENTER, CENTER);
  text("EXIT", exBtnX, exBtnY - 2);  textStyle(NORMAL);

  // CANCEL button (cyan)
  let caBtnX = GAME_W/2 + 130, caBtnY = GAME_H/2 + 75, caBtnW = 200, caBtnH = 60;
  let hCa = getInputX()>caBtnX-caBtnW/2 && getInputX()<caBtnX+caBtnW/2 &&
            getInputY()>caBtnY-caBtnH/2 && getInputY()<caBtnY+caBtnH/2;
  fill(hCa ? color(0, 130, 110) : color(0, 80, 70), 240);
  stroke(0, 255, 200);  strokeWeight(hCa ? 4 : 2);
  rect(caBtnX, caBtnY, caBtnW, caBtnH, 12);
  fill(255);  textStyle(BOLD);  textSize(22);  textAlign(CENTER, CENTER);
  text("CANCEL", caBtnX, caBtnY - 2);  textStyle(NORMAL);
}

// =========================================================
// UTILITY DRAW FUNCTIONS
// =========================================================
function drawFooter() {
  noStroke();
  fill(100, 150, 180);  textStyle(NORMAL);  textSize(14);
  textAlign(LEFT);
  text(developer, 20, GAME_H - 15);
  textAlign(CENTER);  // restore default
}

function drawPersistentReturnButton() {
  if (mode !== MODE_TITLE && mode !== MODE_MECHANICS && mode !== MODE_SETTINGS && mode !== MODE_INFO && mode !== MODE_EXIT_CONFIRM && quizState !== 1) {
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
  fill(hov?80:40,200);  stroke(0,255,200, 150+sin(millis()*0.002)*100);  strokeWeight(3);
  rect(x,y,bw,bh,10);  fill(255);  textStyle(BOLD);  textSize(20);  textAlign(CENTER,CENTER);
  text("PROCEED",x,y-3);  textStyle(NORMAL);
}

function drawNextButton(x, y, label) {
  let bw=200, bh=50;
  let hov=getInputX()>x-bw/2&&getInputX()<x+bw/2&&getInputY()>y-bh/2&&getInputY()<y+bh/2;
  fill(hov?80:40,200);  stroke(0,255,200, 150+sin(millis()*0.002)*100);  strokeWeight(3);
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
  if (mode===MODE_PHASE4) return 4;
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
  } else if (phaseIdx === 3) {
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
  } else if (phaseIdx === 4) {
    fullBank = [
      new Question("What is the main job of the large intestine in digestion?",
        ["To reabsorb water and compact undigested material into solid stool","To produce digestive enzymes that break down the last bits of food","To absorb glucose and amino acids that the small intestine missed"],0),
      new Question("Why must the large intestine reabsorb water from the waste material?",
        ["To prevent dehydration and to form solid stool the body can pass","To cool down the body after the heat produced during digestion","To flush harmful bacteria away before they enter the bloodstream"],0),
      new Question("What happens to stool if the large intestine absorbs too little water?",
        ["The stool stays too watery and passes out as diarrhoea","The stool becomes so hard it cannot move and causes a blockage","The stool dissolves back into the intestine wall and is lost"],0),
      new Question("What role do gut bacteria play in the large intestine?",
        ["They ferment fibre to produce fatty acids that feed the colon lining","They produce digestive enzymes that break down proteins","They destroy any bacteria that entered the body with food"],0),
      new Question("What is peristalsis, and why does the large intestine need it?",
        ["Wave-like muscle contractions that push waste toward the rectum","A chemical signal that tells the body when to release stool","The process of water being pumped out through the gut wall"],0),
      new Question("What would happen if peristalsis in the large intestine stopped?",
        ["Waste would not move forward, causing constipation and build-up","Digestion would reverse and nutrients would leak back into the gut","Water would stop being absorbed so stool would remain liquid"],0),
      new Question("Why is elimination the final and necessary step of digestion?",
        ["It removes undigested waste and prevents harmful build-up","It signals the brain that digestion is finished and hunger can start","It pushes leftover digestive enzymes out before they cause damage"],0),
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

// Hardcoded 2-question banks: index 0 = structure Q, index 1 = function Q
function initShortQuizBank() {
  let phaseIdx = currentPhaseIndex();
  let banks = [
    // Phase 0 — Brain / Cephalic
    [
      new Question("What is the structure that connects the brain to the digestive organs to start the cephalic response?",
        ["The vagus nerve — a long cranial nerve running from the brainstem","The spinal cord — the main relay cable inside the backbone","The optic nerve — the sensory cable connecting the eyes to the brain"],0),
      new Question("What is the function of saliva during the cephalic phase before food even enters the mouth?",
        ["It begins breaking down carbohydrates and lubricates the mouth for food","It destroys harmful bacteria that might enter with the incoming food","It cools the food temperature so the stomach lining is not damaged"],0),
    ],
    // Phase 1 — Stomach
    [
      new Question("What structure in the stomach wall produces the protective barrier against stomach acid?",
        ["Mucus-secreting cells lining the stomach wall","Parietal cells that release hydrochloric acid","Chief cells that store pepsinogen enzyme"],0),
      new Question("What is the function of pepsin in the stomach during protein digestion?",
        ["It breaks peptide bonds in proteins, splitting them into smaller peptides","It neutralises stomach acid to create the right pH for digestion","It signals the small intestine to prepare for incoming food material"],0),
    ],
    // Phase 2 — Small intestine hormones
    [
      new Question("What structure releases Secretin and CCK when acid and fat enter the small intestine?",
        ["Enteroendocrine cells in the lining of the small intestine","The pancreas itself, which detects acid through pressure sensors","The liver, which monitors blood pH and releases hormones accordingly"],0),
      new Question("What is the function of CCK (cholecystokinin) when fat enters the small intestine?",
        ["It triggers the gallbladder and pancreas to release bile and digestive enzymes","It signals the stomach to slow emptying so fat is not overwhelmed","It raises blood sugar by releasing stored glucose from the liver"],0),
    ],
    // Phase 3 — Villi / nutrient absorption
    [
      new Question("What are the tiny finger-like structures on the small intestine wall that absorb nutrients?",
        ["Villi — microscopic projections that dramatically increase surface area","Lacteals — lymph vessels that carry fat away from the intestine","Microvilli — brush-border enzymes that break down complex sugars"],0),
      new Question("What is the function of the lacteal inside each villus during fat absorption?",
        ["It absorbs fatty acids and glycerol and carries them through the lymph system","It absorbs glucose and amino acids and passes them into the bloodstream","It secretes bile salts to emulsify fats before they can be absorbed"],0),
    ],
    // Phase 4 — Large intestine
    [
      new Question("What structure in the large intestine wall actively pumps water back into the body?",
        ["Specialised epithelial cells with aquaporin channels in the colon lining","Peristaltic muscle fibres that squeeze water out of the waste material","Goblet cells that secrete mucus to draw water away from the stool"],0),
      new Question("What is the function of peristalsis in the large intestine after water has been reabsorbed?",
        ["Wave-like muscle contractions push the formed stool toward the rectum for elimination","Peristalsis churns the stool to mix it with digestive enzymes","Peristalsis pumps additional water into the stool to soften it"],0),
    ],
  ];
  shortQuizBank = banks[phaseIdx] || [];
}

function startReflectionGate() {
  let phaseIdx = currentPhaseIndex();
  if (phaseIdx < 0) return;
  stopAllLoopingSounds();
  // Show mode selector first — quizSubState = -1
  quizModeSelected = 0;
  quizState = 1;  quizSubState = -1;
  score = 0;  currentQuestionIdx = 0;
  feedbackMsg = "";  feedbackTimer = 0;
  gateJustCompleted = false;  wrongAnswers = [];
}

function startShortQuiz() {
  let phaseIdx = currentPhaseIndex();
  gateAttemptsCount[phaseIdx]++;
  initShortQuizBank();
  quizModeSelected = 2;
  quizSubState = 0;
  score = 0;  currentQuestionIdx = 0;
  feedbackMsg = "";  feedbackTimer = 0;
  wrongAnswers = [];
  // shuffle answer order for first question
  for (let i = 0; i < 3; i++) {
    let r = Math.floor(random(3));
    [answerOrder[i], answerOrder[r]] = [answerOrder[r], answerOrder[i]];
  }
}

function startFullQuiz() {
  let phaseIdx = currentPhaseIndex();
  gateAttemptsCount[phaseIdx]++;
  initQuizBanks();
  quizModeSelected = 5;
  quizSubState = 0;
  score = 0;  currentQuestionIdx = 0;
  feedbackMsg = "";  feedbackTimer = 0;
  wrongAnswers = [];
  prepareQuestion();
}

function drawReflectionGate() {
  image(bgGradientBuffer, GAME_W / 2, GAME_H / 2);
  for (let p of protocolParticles) { p.update();  p.display(); }
  fill(10, 15, 25, 200);  noStroke();
  rect(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);

  let cx = GAME_W / 2;
  let phaseIdx = currentPhaseIndex();
  let pnameShort = ["PHASE 0 — BRAIN FOOD RESPONSE","PHASE 1 — STOMACH ACID & ENZYMES",
                    "PHASE 2 — HORMONE BALANCE","PHASE 3 — NUTRIENT ABSORPTION",
                    "PHASE 4 — WATER REABSORPTION & ELIMINATION"][phaseIdx] || "";

  // ── Sub-state -1: MODE SELECTOR ──────────────────────
  if (quizSubState === -1) {
    noFill();
    stroke(0,255,200, 100+sin(millis()*0.0009)*50);  strokeWeight(3);
    rect(cx, GAME_H/2, GAME_W-40, GAME_H-40, 20);

    fill(0,255,200);  textStyle(BOLD);  textAlign(CENTER);  textSize(48);
    text("KNOWLEDGE CHECK", cx, 80);
    textStyle(NORMAL);  textSize(22);  fill(150,200,255);
    text(pnameShort, cx, 120);

    fill(255);  textSize(19);  textAlign(CENTER);
    text("Choose how many questions you want to answer:", cx, 180);

    // 2-question button
    let b2x = cx - 200, b2y = 290, b2w = 340, b2h = 140;
    let h2 = getInputX()>b2x-b2w/2 && getInputX()<b2x+b2w/2 && getInputY()>b2y-b2h/2 && getInputY()<b2y+b2h/2;
    fill(h2 ? color(0,100,80) : color(0,60,50), 230);
    stroke(0,255,200);  strokeWeight(h2?3:2);  rect(b2x, b2y, b2w, b2h, 15);
    fill(0,255,200);  textStyle(BOLD);  textSize(36);  textAlign(CENTER,CENTER);
    text("2 QUESTIONS", b2x, b2y-20);
    fill(200,255,240);  textStyle(NORMAL);  textSize(15);
    text("Structure & Function", b2x, b2y+12);
    text("(quick check)", b2x, b2y+32);

    // 5-question button
    let b5x = cx + 200, b5y = 290, b5w = 340, b5h = 140;
    let h5 = getInputX()>b5x-b5w/2 && getInputX()<b5x+b5w/2 && getInputY()>b5y-b5h/2 && getInputY()<b5y+b5h/2;
    fill(h5 ? color(80,60,0) : color(60,40,0), 230);
    stroke(255,200,0);  strokeWeight(h5?3:2);  rect(b5x, b5y, b5w, b5h, 15);
    fill(255,215,0);  textStyle(BOLD);  textSize(36);  textAlign(CENTER,CENTER);
    text("5 QUESTIONS", b5x, b5y-20);
    fill(255,240,180);  textStyle(NORMAL);  textSize(15);
    text("Full knowledge check", b5x, b5y+12);
    text("(7-question bank, 5 drawn)", b5x, b5y+32);

    fill(160,180,200);  textSize(14);  textAlign(CENTER);
    text("Both modes use the same mastery scoring (100% → 90% → 80%)", cx, 420);
    text("Tip: 2-question mode is ideal for quick review during debugging", cx, 442);
    return;
  }

  // ── Sub-state 0: question ─────────────────────────────
  if (quizSubState === 0) {
    let totalQ = (quizModeSelected === 2) ? 2 : 5;
    let bank   = (quizModeSelected === 2) ? shortQuizBank : phaseBank;
    let order  = (quizModeSelected === 2) ? [0,1] : questionOrder;

    noFill();
    stroke(0, 255, 200, 100 + sin(millis() * 0.0009) * 50);
    strokeWeight(3);  rect(cx, GAME_H/2, GAME_W-40, GAME_H-40, 20);

    fill(0, 255, 200);  textStyle(BOLD);  textAlign(CENTER);  textSize(48);
    text("KNOWLEDGE CHECK", cx, 80);
    textStyle(NORMAL);  textSize(22);  fill(150, 200, 255);
    text(pnameShort, cx, 115);

    textSize(15);  fill(200);
    let att = gateAttemptsCount[phaseIdx];
    if      (att===1 && !firstTrySuccess[phaseIdx]) text("FIRST ATTEMPT — 100% MASTERY AVAILABLE", cx, 135);
    else if (firstTrySuccess[phaseIdx])              text("REPLAY ATTEMPT — 90% MAXIMUM", cx, 135);
    else                                             text("ATTEMPT #"+att+" — 80% MAXIMUM", cx, 135);
    fill(0, 255, 150);  textSize(15);
    text("Score: " + score + " / " + totalQ + " Correct", cx, 155);

    let barW=400, barH=20;
    noFill();  stroke(255,50);  strokeWeight(1);  rect(cx,182,barW,barH,10);
    fill(0,255,150);  noStroke();
    let pw2 = map(currentQuestionIdx, 0, totalQ, 0, barW);
    rect(cx-barW/2+pw2/2, 182, pw2, barH, 10);
    fill(200);  textSize(16);  text("Question "+(currentQuestionIdx+1)+" of "+totalQ, cx, 215);

    if (!bank || bank.length === 0 || currentQuestionIdx >= totalQ) {
      fill(255,0,0);  textSize(20);  text("ERROR: Quiz data missing. Please restart.", cx, 250);  return;
    }

    let q = bank[order[currentQuestionIdx]];
    fill(255);  textSize(22);  textAlign(CENTER,CENTER);
    drawWrappedText(q.question, cx, 270, GAME_W-200, 30, null, 22);

    for (let i = 0; i < 3; i++) {
      let ch = q.choices[answerOrder[i]];
      textSize(18);
      let tw = textWidth(ch);
      let bw3 = min(GAME_W-100, max(500, tw+80)), bh3 = 80;
      let y   = 370 + i * 115;
      let hov = feedbackTimer <= 0 && mouseIsPressed &&
               getInputX()>cx-bw3/2 && getInputX()<cx+bw3/2 &&
               getInputY()>y-bh3/2  && getInputY()<y+bh3/2;
      fill(hov?color(25,50,80):color(15,30,50));
      stroke(hov?color(0,255,200):color(255,80));  strokeWeight(hov?4:2);
      rect(cx,y,bw3,bh3,15);
      fill(255);  textSize(18);  textAlign(CENTER,CENTER);
      if (tw > bw3-60) drawWrappedText(ch, cx-bw3/2+30, y-5, bw3-60, 22, null, 18);
      else             text(ch, cx, y);
    }

    if (feedbackTimer > 0) {
      if (feedbackMsg === "CORRECT") {
        fill(0, 255, 100);
        if (feedbackTimer === 35) {
          for (let i = 0; i < 20; i++)
            successParticles.push(new SuccessParticle(cx, GAME_H-80, [0, 255, 100]));
        }
      } else { fill(255,50,50); }
      textStyle(BOLD);  textSize(28);  text(feedbackMsg, cx, GAME_H-80);
      feedbackTimer--;
    }
    for (let i = successParticles.length-1; i >= 0; i--) {
      successParticles[i].update();  successParticles[i].display();
      if (successParticles[i].isDead()) successParticles.splice(i,1);
    }

  // ── Sub-state 1: success ──────────────────────────────
  } else if (quizSubState === 1) {
    fill(0,20,10,220);  noStroke();  rect(cx,GAME_H/2,GAME_W,GAME_H);
    let pulse3=(sin(millis()*0.002)+1)/2.0;
    fill(0,255,150, 200+pulse3*55);  textStyle(BOLD);  textSize(56);  textAlign(CENTER,CENTER);
    text("GREAT JOB!", cx, GAME_H/2-80);

    let pname2=["PHASE 0 — BRAIN FOOD RESPONSE","PHASE 1 — STOMACH ACID & ENZYMES",
                "PHASE 2 — HORMONE BALANCE","PHASE 3 — NUTRIENT ABSORPTION",
                "PHASE 4 — WATER REABSORPTION & ELIMINATION"][phaseIdx]||"";
    let eff = calculateEfficiency(phaseIdx);
    fill(255,215,0);  textSize(40);  text(nf(eff,0,0)+"% MASTERY ACHIEVED", cx, GAME_H/2-20);
    fill(255);  textStyle(NORMAL);  textSize(24);
    text("You've successfully learned about", cx, GAME_H/2+30);
    textStyle(BOLD);  text(pname2, cx, GAME_H/2+70);  textStyle(NORMAL);

    if (mode===MODE_PHASE4) {
      textSize(22);  fill(0,255,200);  text("The digestive journey is complete!", cx, GAME_H/2+115);
      textSize(19);  fill(200,255,230);
      text("From smelling food all the way to eliminating waste —", cx, GAME_H/2+148);
      text("you've explored how your entire digestive system works.", cx, GAME_H/2+172);
      text("Well done, BioBalancer!", cx, GAME_H/2+196);
    } else {
      if (eff===100) { textStyle(BOLD);  textSize(28);  fill(255,215,0);  text("★ PERFECT FIRST-TRY MASTERY ★", cx, GAME_H/2+110);  textStyle(NORMAL); }
      else if (eff===90) { textSize(20);  fill(220,220,255);  text("First-try on replay (100% only on first attempt)", cx, GAME_H/2+110); }
      else { textSize(20);  fill(200);  text("Multiple attempts needed — replay to improve!", cx, GAME_H/2+110); }
    }
    fill(0,255,200);  textSize(20);
    text(mode===MODE_PHASE4?"Click anywhere to view your final report"
                           :"Click anywhere to continue to the next phase",
         cx, GAME_H/2+(mode===MODE_PHASE4?230:160));

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
    text("You need all " + (quizModeSelected===2?"2":"5") + " correct to move forward.", cx, GAME_H/2-55);

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
  if (millis() - lastClickTime < 300) return;
  lastClickTime = millis();

  let phaseIdx = currentPhaseIndex();
  let cx = GAME_W / 2;

  // ── Mode selector (substate -1) ──────────────────────
  if (quizSubState === -1) {
    // 2-question button
    let b2x = cx - 200, b2y = 290, b2w = 340, b2h = 140;
    if (getInputX()>b2x-b2w/2 && getInputX()<b2x+b2w/2 && getInputY()>b2y-b2h/2 && getInputY()<b2y+b2h/2) {
      playSoundOnce(clickSfx);  startShortQuiz();  return;
    }
    // 5-question button
    let b5x = cx + 200, b5y = 290, b5w = 340, b5h = 140;
    if (getInputX()>b5x-b5w/2 && getInputX()<b5x+b5w/2 && getInputY()>b5y-b5h/2 && getInputY()<b5y+b5h/2) {
      playSoundOnce(clickSfx);  startFullQuiz();  return;
    }
    return;  // consume all clicks on selector screen
  }

  // ── Success screen (substate 1) ──────────────────────
  if (quizSubState === 1) {
    stopAllLoopingSounds();
    quizState=0;  quizSubState=0;  quizModeSelected=0;  successParticles=[];
    let eff2=calculateEfficiency(phaseIdx);
    if (eff2===100 && !phaseCompleted[phaseIdx]) firstTrySuccess[phaseIdx]=true;
    phaseEfficiency[phaseIdx] = eff2;
    phaseCompleted[phaseIdx]=true;
    saveProgress();
    if      (mode===MODE_PHASE0) mode=MODE_PHASE1;
    else if (mode===MODE_PHASE1) mode=MODE_PHASE2;
    else if (mode===MODE_PHASE2) mode=MODE_PHASE3;
    else if (mode===MODE_PHASE3) { mode=MODE_PHASE4; initPhaseParticles(4); resetPhase4(); }
    else if (mode===MODE_PHASE4) { stopAllLoopingSounds();  reportPlayed=false;  reportSfxPlayed=false;  mode=MODE_FINISH; }
    gateAttemptsCount[phaseIdx]=0;  wrongAnswers=[];  transitionAlpha=0;
    return;
  }

  // ── Failure screen (substate 2) ──────────────────────
  if (quizSubState === 2) {
    stopAllLoopingSounds();
    quizState=0;  quizSubState=0;  quizModeSelected=0;  successParticles=[];  wrongAnswers=[];
    resetSimulationToPhaseStart();  return;
  }

  // ── Active question (substate 0) ─────────────────────
  let totalQ = (quizModeSelected === 2) ? 2 : 5;
  let bank   = (quizModeSelected === 2) ? shortQuizBank : phaseBank;
  let order  = (quizModeSelected === 2) ? [0,1] : questionOrder;

  if (!bank || bank.length === 0 || currentQuestionIdx >= totalQ) return;

  let q   = bank[order[currentQuestionIdx]];
  let cxq = GAME_W / 2;

  for (let i = 0; i < 3; i++) {
    let ch = q.choices[answerOrder[i]];
    textSize(18);
    let tw=textWidth(ch), bw4=min(GAME_W-100,max(500,tw+80)), bh4=80;
    let y = 370 + i * 115;
    if (getInputX()>cxq-bw4/2 && getInputX()<cxq+bw4/2 &&
        getInputY()>y-bh4/2   && getInputY()<y+bh4/2) {
      if (answerOrder[i] === q.correctIndex) {
        score++;  feedbackMsg="CORRECT";  if (correctSfx) { correctSfx.stop(); correctSfx.play(); }
      } else {
        feedbackMsg="INCORRECT";
        wrongAnswers.push({questionNum:currentQuestionIdx+1, yourAnswer:ch, correctAnswer:q.choices[q.correctIndex]});
        if (wrongSfx) { wrongSfx.stop(); wrongSfx.play(); }
      }
      feedbackTimer=40;  currentQuestionIdx++;
      if (currentQuestionIdx >= totalQ) {
        feedbackMsg="";  feedbackTimer=0;
        if (score === totalQ) {
          quizSubState=1;
          for (let i2=0;i2<50;i2++)
            successParticles.push(new SuccessParticle(random(GAME_W),random(GAME_H),[0,255,200]));
        } else { quizSubState=2; }
      } else {
        // Shuffle answer order for next question
        for (let j = 0; j < 3; j++) {
          let r = Math.floor(random(3));
          [answerOrder[j], answerOrder[r]] = [answerOrder[r], answerOrder[j]];
        }
      }
      break;
    }
  }
}

function resetSimulationToPhaseStart() {
  organPulse=1.0;  shakeIntensity=0;
  stopAllLoopingSounds();  // always clean up all looping sounds on any phase reset
  if (mode===MODE_PHASE0) {
    smellSliderX=GAME_W/2-200;  salivaLevel=0;  foodType=0;  cephalicAcid=0;
    cephalicReady=false;  delayedSmell=0;  foodScale=0;  isChewing=false;
    hasSwallowed=false;  swallowProceedDelay=0;  cephalicTimer=0;  insulinLevel=0;
    hepaticGlucoseOutput=100;  peripheralGlucoseUptake=0;  emeticTimer=0;
    aromaParticles=[];  cephalicSuccessPlayed=false;  warningPlayed=false;
    phase0ProceedSoundPlayed=false;
  } else if (mode===MODE_PHASE1) {
    stomachAcid=0;  ulcerRisk=0;  sliderX=GAME_W/2-150;
    proteinScale=1.0;  pepsinTimer=0;  enzymeActive=false;
    pepsinState=PepsinState.INACTIVE;  pepsinConcentration=0;
    pepsinogenReserve=100;  pepsinRestoredFlag=false;
    acidBubbles=[];  pepsinSuccessPlayed=false;
    phase1ProceedSoundPlayed=false;  phase1Complete=false;
  } else if (mode===MODE_PHASE2) {
    secretinLevel=0;  cckLevel=0;  homeostasisReached=false;
    homeostasisJustReached=false;  homeostasisDisplayTimer=0;
    homeostasisLocked=false;  greenZoneTimer=0;  hormoneMist=[];
    phase2ButtonSuccessPlayed=false;  phase2ProceedSoundPlayed=false;
  } else if (mode===MODE_PHASE3) {
    glucoseSorted=false;  sodiumSGLTSorted=false;
    sodiumNHE3Sorted=false;  lipidSorted=false;
    resetNutrientPositions();  hormoneMist=[];
    phase3ProceedDelay=0;  phase3ProceedSoundPlayed=false;
  } else if (mode===MODE_PHASE4) {
    resetPhase4();  hormoneMist=[];
  }
}

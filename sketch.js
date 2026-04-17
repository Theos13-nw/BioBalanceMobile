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
  if (!sfxEnabled && sound !== clickSfx) return;  // SFX muted (allow click for UI feedback)
  let now = millis();
  if (now - (_sfxLastFired.get(sound) || 0) < 80) return;
  _sfxLastFired.set(sound, now);
  // For short one-shot feedback sounds: allow restart if already playing
  if (sound === correctSfx || sound === wrongSfx || sound === clickSfx || sound === successSfx) {
    if (sound.isPlaying()) sound.stop();
    sound.setVolume(masterVolume);  sound.play();
  } else {
    if (!sound.isPlaying()) { sound.setVolume(masterVolume); sound.play(); }
  }
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
  if (!sfxEnabled) { if (sound.isPlaying()) sound.stop(); return; }
  if (!sound.isPlaying()) sound.loop();
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
let musicEnabled = true;   // controls bgLoop (background music)
let sfxEnabled   = true;   // controls all sound effects
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
const GREEN_ZONE_REQUIRED = 10 * 60;     // 10 seconds × 60 ticks = 600 ticks
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
let phaseNames     = ["CEPHALIC PHASE", "STOMACH DIGESTION", "HORMONE SECRETION", "NUTRIENT ABSORPTION", "WATER & ELIMINATION"];
let phaseSubtitles = ["Brain Signals", "Stomach", "Small Intestine", "Villi Absorption", "Large Intestine"];
let phaseColors;   // initialised in preload() — needs p5 color() available
let selectedPhase = -1;

// ── CONTROL PROTOCOL ──────────────────────────────────────
let protocolParticles = [];
let currentCard = 0;
let totalCards  = 4;
let cardTitles  = ["OBJECTIVE", "CONTROLS", "FEEDBACK", "TIPS"];
let cardContent = [
  ["Your goal is to trace food through the", "digestive tract! Each phase models a",
   "different digestive process in the body.", "Control what happens at each step and",
   "keep the system in balance."],
  ["Touch and drag nutrients to the correct", "zones. Press hormone buttons to balance",
   "acid levels. Use the NEXT button to move", "forward when each phase is complete.",
   "Pay attention to timing!"],
  ["After completing each phase, you will face", "a Knowledge Check. You can choose how",
   "many questions to answer each time.", "Get a perfect score on your first try",
   "to earn full marks. Wrong answers are shown."],
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
    ["The Brain Starts Digestion", "",
     "Before you even take a bite, your brain",
     "gets your body ready! Seeing or smelling",
     "food sends nerve signals that trigger",
     "saliva in your mouth. This is called the",
     "cephalic phase — a type of secretion",
     "where your digestive system prepares",
     "for the food that is coming."],
    ["Mechanical and Chemical Digestion", "",
     "Inside the stomach, food is broken down",
     "in two ways. Churning muscles mash food",
     "into smaller pieces (mechanical digestion).",
     "At the same time, stomach acid unfolds",
     "proteins so the enzyme pepsin can split",
     "them apart (chemical digestion). Mucus",
     "protects the stomach wall from the acid."],
    ["Hormones Balance the Small Intestine", "",
     "When food enters the small intestine,",
     "hormones are secreted to balance the",
     "conditions. Secretin signals the release",
     "of bicarbonate to reduce acid. CCK signals",
     "release of bile and enzymes to break down",
     "fats and proteins — this is digestion",
     "coordinated by the body's systems."],
    ["Absorption Through the Villi", "",
     "The small intestine absorbs nutrients",
     "through tiny finger-like folds called",
     "villi. Glucose and minerals enter the",
     "bloodstream and travel to body cells.",
     "Fats are packed into vessels called",
     "lacteals. This absorption step connects",
     "digestion to the circulatory system."],
    ["Water Recovery and Elimination", "",
     "In the large intestine, water is absorbed",
     "back into the body from leftover waste.",
     "Muscle contractions called peristalsis",
     "push the solid waste toward the rectum.",
     "Elimination removes undigested material",
     "from the body — completing the digestive",
     "and excretory process together."]
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
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(function() {
                    // Start bgLoop immediately after context resumes
                    if (bgLoop != null && !bgLoopStarted) {
                        try { bgLoop.setVolume(0); bgLoop.rate(1.0); bgLoop.loop(); bgLoopStarted = true; } catch(e) {}
                    }
                });
            } else if (bgLoop != null && !bgLoopStarted) {
                try { bgLoop.setVolume(0); bgLoop.rate(1.0); bgLoop.loop(); bgLoopStarted = true; } catch(e) {}
            }
        }, { passive: true });
        
        document.addEventListener('mousedown', function() {
            let ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(function() {
                    if (bgLoop != null && !bgLoopStarted) {
                        try { bgLoop.setVolume(0); bgLoop.rate(1.0); bgLoop.loop(); bgLoopStarted = true; } catch(e) {}
                    }
                });
            } else if (bgLoop != null && !bgLoopStarted) {
                try { bgLoop.setVolume(0); bgLoop.rate(1.0); bgLoop.loop(); bgLoopStarted = true; } catch(e) {}
            }
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
        "PROCEED", "FOOD SWALLOWED — MOVING TO THE STOMACH!",
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
    
    textStyle(NORMAL);  
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
    let bgVol = musicEnabled ? masterVolume : 0;
    let bgTarget  = bgAllowed ? (quizState === 1 ? 0.04 * bgVol : 0.08 * bgVol) : 0;

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

  // Safety net: only stop quiz sounds if quiz is not active
  // Use isPlaying() check only — do NOT call stop() repeatedly per frame (causes Web Audio node leak)
  if (quizState !== 1) {
    if (wrongSfx && wrongSfx.isPlaying()) wrongSfx.stop();
    if (correctSfx && correctSfx.isPlaying()) correctSfx.stop();
  }


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

  // BG loop: start once on first logic tick — audio context must be resumed first
  if (bgLoop != null && !bgLoopStarted) {
    try {
      bgLoop.setVolume(0);
      bgLoop.rate(1.0);
      bgLoop.loop();
      bgLoopStarted = true;
    } catch(e) { /* retry next tick if audio context not ready */ }
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
    salivaLevel  = lerp(salivaLevel, map(inputSmell, 0, 100, 40, 170), 0.009);
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
    proteinScale = max(0.0, proteinScale - 0.00093);
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
      secretinLevel = min(secretinLevel + 1.5, 200);
      for (let i = 0; i < 3; i++)
        hormoneMist.push(new Mist(GAME_W*0.15+80, GAME_H/2+50+yOffset, random(5,10), random(-2,2), [0,150,255]));
    } else {
      cckLevel = min(cckLevel + 1.5, 200);
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
  handleNutrientPhysicsStrict(MEMBRANE_X + 280, 400, 100, GAME_H*0.28, GAME_H*0.52, GAME_H*0.76);

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
    // ~30 seconds of held-button time: 100 / (30s × 60fps) = 100/1800 per tick
    peristalsisProgress = min(100, peristalsisProgress + (100 / 900) * dt);   // ~15s
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
  drawPhaseTitle("PHASE 4 — WATER REABSORPTION AND ELIMINATION", 50);
  let waterGood = (actualWaterAbsorbed >= 40 && actualWaterAbsorbed <= 72);

  // All positions relative to GAME_W / GAME_H — no hardcoded pixels
  let imgCX   = GAME_W * 0.50;       // organ image centre x — centred, leaving panel space on left
  let imgCY   = GAME_H * 0.51;       // organ image centre y
  let imgW    = GAME_W * 0.52;       // organ image width  (~665 at 1280px)
  let imgH    = imgW * (550/650);    // height preserves original WP aspect ratio (550/650 ≈ 0.846)
  let sliderY4    = GAME_H * 0.89;   // slider just below image
  let sliderStart = GAME_W * 0.34;
  let sliderEnd   = GAME_W * 0.66;
  let panelX  = GAME_W * 0.135;      // panel centre x
  let panelY  = GAME_H * 0.50;       // panel centre y
  let guideY  = GAME_H * 0.115;      // guide text — a little below the phase title

  if (largeIntImg != null) {
    push();
    translate(imgCX, imgCY);  scale(organPulse);
    tint(255, transitionAlpha);  image(largeIntImg, 0, 0, imgW, imgH);  noTint();
    pop();
  }

  // Stool position: scale waypoints proportionally to image size
  // imgCX/imgCY are the origin — path follows the organ regardless of position
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

  // Slider — label tight below the track (not far below)
  let sCol = lerpColor(color(100,200,255), color(180,120,50), map(actualWaterAbsorbed,0,100,0,1));
  stroke(255,150);  strokeWeight(4);  line(sliderStart, sliderY4, sliderEnd, sliderY4);
  fill(sCol);  noStroke();
  let knobX = map(waterAbsorbed, 0, 100, sliderStart, sliderEnd);
  ellipse(knobX, sliderY4, 32, 32);
  fill(255);  textStyle(NORMAL);  textSize(14);  textAlign(CENTER);
  text("WATER ABSORPTION CONTROL", GAME_W/2, sliderY4 + 26);  // tight below track
  textAlign(RIGHT);  text("LOW (0%)",    sliderStart-20, sliderY4+7);
  textAlign(LEFT);   text("HIGH (100%)", sliderEnd  +20, sliderY4+7);
  textAlign(CENTER);

  // Guide text + buttons — invisible 3s countdown happens in logic, not shown here
  textStyle(NORMAL);  textSize(min(20, GAME_W*0.016));  textAlign(CENTER);
  if (phase4Ready && phase4ProceedDelay >= PHASE4_PROCEED_DELAY_FRAMES) {
    // 3s elapsed — show completion text and PROCEED
    fill(0,255,150);
    text("ELIMINATION COMPLETE — DIGESTIVE CYCLE FINISHED!", GAME_W/2, guideY);
    if (!phase4ProceedSoundPlayed) { phase4ProceedSoundPlayed = true; }  // sound on click
    drawProceedButton(GAME_W/2, guideY + GAME_H*0.067);
  } else if (phase4Ready && phase4ProceedDelay < PHASE4_PROCEED_DELAY_FRAMES) {
    // Stool at end + water optimal — silent 3s wait, just show guide text
    fill(0,255,150);
    text("WASTE REACHED RECTUM — MAINTAINING OPTIMAL...", GAME_W/2, guideY);
  } else if (actualWaterAbsorbed < 40) {
    fill(100,200,255);
    text("WASTE TOO WATERY — INCREASE WATER ABSORPTION!", GAME_W/2, guideY);
    if (!peristalsissComplete) drawPeristalsisButton(GAME_W/2, guideY + GAME_H*0.06);
  } else if (actualWaterAbsorbed > 72) {
    fill(255,140,60);
    text("WASTE TOO DRY — DECREASE WATER ABSORPTION!", GAME_W/2, guideY);
    if (!peristalsissComplete) drawPeristalsisButton(GAME_W/2, guideY + GAME_H*0.06);
  } else if (waterGood && !peristalsissComplete) {
    fill(180,120,255);
    text("WATER ABSORBED — HOLD PERISTALSIS TO MOVE WASTE!", GAME_W/2, guideY);
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
  noStroke();  fill(220, 245, 240);  textStyle(NORMAL);  textSize(17);  textAlign(CENTER,CENTER);
  text(peristalsisActive ? "Contracting..." : "PERISTALSIS", x, y-2);
  textStyle(NORMAL);
}

function drawPhase4Panel(x, y, waterGood) {
  push();
  fill(20,30,50,220);  stroke(255,150);  strokeWeight(2);  rect(x, y, 275, 260, 15);
  fill(0,255,200);  textStyle(NORMAL);  textSize(16);  textAlign(CENTER);
  text("LARGE INTESTINE STATUS", x, y-95);  textStyle(NORMAL);
  let r1Y = y-40;
  let wCol = waterGood ? color(0,255,150) : (actualWaterAbsorbed<40 ? color(100,180,255) : color(255,140,60));
  fill(30,40,60);  rect(x, r1Y, 240, 40, 5);
  fill(wCol);  rect(x-120+map(actualWaterAbsorbed,0,100,0,240)/2, r1Y, map(actualWaterAbsorbed,0,100,0,240), 40, 5);
  if (waterGood) {
    stroke(0,255,150, 100+sin(millis()*0.00032)*155);  strokeWeight(3);
    noFill();  rect(x, r1Y, 240, 40, 5);
  }
  fill(wCol);  textStyle(NORMAL);  textSize(12);  textAlign(CENTER);
  text("WATER ABSORBED", x, r1Y-26);  textStyle(NORMAL);
  let r2Y = y+22;
  let sLabel = stoolConsistency<35 ? "LIQUID" : stoolConsistency>80 ? "HARD/IMPACTED" : "WELL-FORMED";
  let sCol   = (stoolConsistency>=35&&stoolConsistency<=80) ? color(140,200,100) :
               (stoolConsistency<35) ? color(100,200,255) : color(180,100,60);
  noStroke();  fill(30,40,60);  rect(x, r2Y, 240, 20, 5);
  fill(sCol);  rect(x-120+map(stoolConsistency,0,100,0,240)/2, r2Y, map(stoolConsistency,0,100,0,240), 20, 5);
  fill(255);  textSize(11);  textAlign(CENTER);
  text("WASTE CONSISTENCY: "+sLabel, x, r2Y-14);
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
  noStroke();  textStyle(NORMAL);  textSize(13);
  if (phase4Ready)                         { fill(0,255,150);   text("READY!",                   x, r3Y+52); }
  else if (waterGood&&!peristalsissComplete){ fill(180,120,255); text("PRESS PERISTALSIS TO MOVE WASTE", x, r3Y+52); }
  else if (!waterGood)                     { fill(255,200,0);   text("ADJUST WATER ABSORPTION",  x, r3Y+52); }
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
  drawPhaseTitle("PHASE 0 — YOUR BRAIN SIGNALS DIGESTION TO BEGIN", 50);

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
      p0Text  = "FOOD SWALLOWED — MOVING TO THE STOMACH!";
      p0Color = color(0, 255, 150);
      if (!phase0ProceedSoundPlayed) { playSoundOnce(successSfx);  phase0ProceedSoundPlayed = true; }
      drawProceedButton(GAME_W / 2, buttonY);
    } else {
      p0Text  = "SWALLOWING FOOD DOWN THE OESOPHAGUS...";
      p0Color = color(0, 255, 200);
    }
  } else if (isChewing) {
    p0Text  = "CHEWING: MECHANICAL DIGESTION IN THE MOUTH!";
    p0Color = color(255, 200, 0);
    drawNextButton(GAME_W / 2, buttonY, "SWALLOW");
  } else if (foodType === 1 && cephalicActive) {
    cephalicReady = true;
    p0Text  = "BRAIN SIGNAL SENT — SECRETION IS STARTING!";
    p0Color = color(0, 255, 150, 150 + sin(millis() * 0.004) * 105);
  } else if (foodType === 1 && inputSmell >= 99 && salivaLevel >= 170 && !metabolismReady) {
    cephalicReady = false;
    p0Text = "SALIVA SECRETED — BODY IS GETTING READY...";  p0Color = color(255, 200, 0);
  } else if (foodType === 1 && inputSmell >= 99 && salivaLevel < 170) {
    cephalicReady = false;
    p0Text = "SALIVA IS BEING SECRETED — KEEP THE SCENT HIGH!";  p0Color = color(255, 255, 0);
  } else if (foodType === 1 && inputSmell >= 99) {
    cephalicReady = false;  p0Text = "GETTING READY...";  p0Color = color(200);
  } else if (foodType === 1) {
    cephalicReady = false;
    p0Text = "SMELL THE FOOD: MOVE THE SCENT SLIDER TO BEGIN!";  p0Color = color(200);
  } else if (foodType === 2) {
    cephalicReady = false;
    if      (delayedSmell < 30)              p0Text = "SOMETHING SMELLS OFF...";
    else if (delayedSmell < 60)              p0Text = "THE FOOD SMELLS SPOILED — BODY IS REJECTING IT!";
    else if (emeticTimer >= EMETIC_THRESHOLD) p0Text = "SPOILED FOOD DETECTED — NAUSEA REFLEX TRIGGERED!";
    else                                      p0Text = "SMELL GETTING WORSE — BODY IS RESPONDING...";
    p0Color = color(255, 50, 50);
  } else {
    cephalicReady = false;  p0Text = "SELECT A FOOD TYPE TO START THE SIMULATION";  p0Color = color(200);
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
  text("SCENT LEVEL: " + int(inputSmell) + "%", GAME_W / 2, sliderY + 45);

  drawPhase0Button(GAME_W / 2 - 110, sliderY + 90, "DELICIOUS FOOD", 1);
  drawPhase0Button(GAME_W / 2 + 110, sliderY + 90, "SPOILED FOOD",   2);
}

function updateCephalicMetabolismFast() {
  if (foodType === 1) {
    let cal = map(delayedSmell, 0, 100, 0, 500);
    insulinLevel            = lerp(insulinLevel, cal * 0.08, 1 - pow(1 - 0.006, dt));
    hepaticGlucoseOutput    = lerp(hepaticGlucoseOutput, max(20, 100 - insulinLevel * 1.5), 1 - pow(1 - 0.011, dt));
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

  fill(0, 255, 200);  textStyle(NORMAL);  textSize(16);  textAlign(CENTER);
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
  drawPhaseTitle("PHASE 1 — MECHANICAL AND CHEMICAL DIGESTION", 50);

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

  drawPepsinPanelBig(GAME_W * 0.135, GAME_H / 2, currentPH, inPHWindow, enzymeActive);

  let phC = lerpColor(color(0, 150, 255), color(255, 0, 0), map(currentPH, 7, 1, 0, 1));
  stroke(255, 150);  strokeWeight(4);
  line(sliderStart, sliderY, sliderEnd, sliderY);
  fill(phC);  noStroke();  ellipse(sliderX, sliderY, 32, 32);
  fill(255);  textSize(16);  textAlign(CENTER);
  text("STOMACH pH CONTROL (ACIDITY LEVEL)", GAME_W / 2, sliderY + 45);
  textAlign(RIGHT);  text("NEUTRAL (7.0)", sliderStart - 20, sliderY + 7);
  textAlign(LEFT);   text("ACIDIC (1.0)",  sliderEnd   + 20, sliderY + 7);

  let statusY = 75, spacing = 32;
  textAlign(CENTER);

  if (ulcerRisk > 100) {
    fill(255, 0, 0);  textStyle(NORMAL);  textSize(20);
    text("STOMACH LINING IN DANGER — TOO MUCH ACID!", GAME_W / 2, statusY);
    sfx_wantWarning = true;
  } else {
    sfx_wantWarning = false;

    if (pepsinState === PepsinState.DENATURED) {
      fill(255, 50, 50);  textStyle(NORMAL);  textSize(20);
      text("ENZYME DENATURED — PEPSIN STOPPED WORKING!", GAME_W / 2, statusY);
      drawRestorePepsinButton(GAME_W / 2, statusY + spacing);
    } else if (pepsinConcentration > 0 && currentPH > 4.5 && currentPH <= 5.0) {
      fill(255, 100 + (sin(millis() * 0.018) + 1) / 2.0 * 155, 0);
      textStyle(NORMAL);  textSize(20);
      text("WARNING: PEPSIN WILL DENATURE — LOWER THE PH!", GAME_W / 2, statusY);
    } else if (currentPH < 1.5) {
      fill(255, (sin(millis() * 0.004) + 1) / 2.0 * 100, 0);
      textStyle(NORMAL);  textSize(20);
      text("DANGER: ACID TOO STRONG — MOVE SLIDER LEFT!", GAME_W / 2, statusY);
    } else if (inPHWindow && !enzymeActive) {
      fill(pepsinState === PepsinState.PARTIAL ? color(255, 200, 0) : color(255, 255, 0));
      textStyle(NORMAL);  textSize(20);
      text(pepsinState === PepsinState.PARTIAL
        ? "ENZYME WEAKENING — KEEP pH BETWEEN 1.5 AND 3.0!"
        : "PEPSINOGEN ACTIVATING INTO PEPSIN — HOLD THE pH!", GAME_W / 2, statusY);
    } else if (enzymeActive) {
      if (proteinScale < 0.3) {
        fill(0, 255, 150);  textStyle(NORMAL);  textSize(20);
        text("CHEMICAL DIGESTION COMPLETE!", GAME_W / 2, statusY);
        phase1Complete = true;
        if (!phase1ProceedSoundPlayed) { phase1ProceedSoundPlayed = true; }  // sound plays on click, not on pop-up
        drawProceedButton(GAME_W / 2, statusY + spacing);
      } else {
        fill(0, 255, 150);  textStyle(NORMAL);  textSize(20);
        text("PEPSIN IS ACTIVE — PROTEIN IS BEING DIGESTED!", GAME_W / 2, statusY);
        fill(255, 200, 0);  textStyle(NORMAL);  textSize(16);
        text("Wait for chemical digestion to finish...", GAME_W / 2, statusY + spacing);
      }
    }
  }
}

function drawRestorePepsinButton(x, y) {
  textStyle(NORMAL);  textSize(20);
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
      pepsinConcentration = min(100, pepsinConcentration + 0.167*dt);  // ~10s to reach 100%
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

  fill(0, 255, 200);  textStyle(NORMAL);  textSize(16);  textAlign(CENTER);
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
  drawPhaseTitle("PHASE 2 — HORMONE SECRETION IN THE SMALL INTESTINE", 50);

  // yOffset reduced: image moves up to fill the space freed by removing the countdown bar
  let yOffset = 10, phLabelY = 75, phBarY = 95, warningY = 130;

  if (intestineImg != null) {
    push();  translate(GAME_W / 2, GAME_H / 2 + 16 + yOffset);  scale(organPulse);
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

  noStroke();  textAlign(CENTER);
  if (homeostasisReached) {
    fill(0, 200, 140);  textStyle(NORMAL);  textSize(20);
    text("Acid neutralized — ready for digestion!", GAME_W / 2, warningY);
    if (!phase2ProceedSoundPlayed) { phase2ProceedSoundPlayed = true; }  // sound plays on click, not on pop-up
    drawProceedButton(GAME_W / 2, warningY + 38);
  } else if (greenZoneTimer > 0) {
    // Counting — show text only, no progress bar
    fill(0, 200, 140, 180 + sin(millis()*0.004)*75);  textStyle(NORMAL);  textSize(20);
    text("Hormones balanced — hold for " + nf((GREEN_ZONE_REQUIRED - greenZoneTimer)/60,0,0) + "s more...", GAME_W/2, warningY);
  } else {
    let p2T = (secretinLevel <= 150 && cckLevel <= 150) ? "TOO MUCH ACID AND FAT! SPRAY BOTH HORMONES!" :
              (secretinLevel <= 150)                    ? "TOO MUCH ACID — SPRAY SECRETIN TO NEUTRALIZE IT!" :
                                                          "FATS DETECTED — SPRAY CCK TO RELEASE ENZYMES!";
    fill(200, 210, 230);  textStyle(NORMAL);  textSize(20);  text(p2T, GAME_W / 2, warningY);
  }

  drawHormoneButton(GAME_W * 0.15, GAME_H / 2 + 50 + yOffset, "SECRETIN", color(0, 150, 255), sprayType === 1, hormone1Img);
  drawHormoneButton(GAME_W * 0.85, GAME_H / 2 + 50 + yOffset, "CCK",      color(255, 180, 0), sprayType === 2, hormone2Img);

  fill(0, 180, 255);  textSize(14);  textAlign(CENTER);
  text("Secretin: " + int(secretinLevel / 2) + "% (need 75%)", GAME_W * 0.15, GAME_H / 2 + 50 + yOffset + 100);
  fill(255, 200, 0);
  text("CCK: " + int(cckLevel / 2) + "% (need 75%)", GAME_W * 0.85, GAME_H / 2 + 50 + yOffset + 100);

  for (let m of hormoneMist) m.display();

  drawMeter(GAME_W / 2 - 250, GAME_H - 110 + yOffset, secretinLevel, "Secretin (Acid Reducer)", color(0, 180, 255));
  drawMeter(GAME_W / 2 + 250, GAME_H - 110 + yOffset, cckLevel,      "CCK (Fat Digester)",      color(255, 200, 0));
}

// =========================================================
// PHASE 3 — NUTRIENT ABSORPTION
// =========================================================
function phase3() {
  drawPhaseTitle("PHASE 3 — ABSORPTION OF NUTRIENTS IN THE SMALL INTESTINE", 50);
  updateAndDrawPhaseParticles(3);

  if (villusImg != null) image(villusImg, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H);

  let zoneX = MEMBRANE_X + 280;
  // Spread zones further apart so labels never overlap
  let zoneW = 400, zoneH = 100;
  let capY = GAME_H * 0.28, nheY = GAME_H * 0.52, lacY = GAME_H * 0.76;

  renderZoneStrict(zoneX, capY, "BLOOD CAPILLARY",  color(255, 100, 100), zoneW, zoneH, capillaryPulse, glucoseSorted && sodiumSGLTSorted);
  renderZoneStrict(zoneX, nheY, "SODIUM EXCHANGER", color(100, 150, 255), zoneW, zoneH, nhe3Pulse,      sodiumNHE3Sorted);
  renderZoneStrict(zoneX, lacY, "LACTEAL",          color(100, 150, 255), zoneW, zoneH, lactealPulse,   lipidSorted);

  // Guide text — only show drag instruction when nutrients still need absorbing
  let allAbsorbedCheck = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
  if (!allAbsorbedCheck) {
    noStroke();  fill(180, 200, 225);  textStyle(NORMAL);  textSize(15);  textAlign(CENTER);
    text("Drag each nutrient to where it is absorbed in the villi", GAME_W / 2, 75);
  }

  // Physics+mist already ticked in updateGameLogic(); draw nutrients
  for (let m of hormoneMist) m.display();
  drawNutrient(glucoseImg, glucoseX,    glucoseY,    "Glucose",        [0, 255, 0],   glucoseSorted,    draggingGlucose,    gTimer);
  drawNutrient(sodiumImg,  sodiumSGLTX, sodiumSGLTY, "Sodium (SGLT1)", [0, 200, 150], sodiumSGLTSorted, draggingSodiumSGLT, sGLTTimer);
  drawNutrient(sodiumImg,  sodiumNH3X,  sodiumNH3Y,  "Sodium (NHE3)",  [0, 100, 200], sodiumNHE3Sorted, draggingSodiumNHE3, nhe3Timer);
  drawNutrient(lipidImg,   lipidX,      lipidY,      "Lipids (Fats)",  [255, 255, 0], lipidSorted,      draggingLipid,      lTimer);

  let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
  noStroke();  textAlign(CENTER);
  if (allAbsorbed) {
    if (phase3ProceedDelay < PHASE3_PROCEED_DELAY_FRAMES) {
      fill(0, 200, 140, 180 + sin(millis()*0.004)*75);
      textStyle(NORMAL);  textSize(20);
      text("All nutrients absorbed — processing...", GAME_W / 2, 75);
    } else {
      // "All nutrients successfully absorbed!" sits just above the proceed button
      fill(0, 200, 140);  textStyle(NORMAL);  textSize(20);  textAlign(CENTER);
      text("All nutrients successfully absorbed!", GAME_W / 2, 75);
      if (!phase3ProceedSoundPlayed) { phase3ProceedSoundPlayed = true; }  // sound plays on click
      drawProceedButton(GAME_W / 2, 115);
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
      gTimer += 1.0 / 600.0;    // ~10 seconds at 60 ticks/s
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
      sGLTTimer += (1.0 / 600.0) * speedMult;    // ~10 seconds
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
      nhe3Timer += 1.0 / 600.0;    // ~10 seconds
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
      lTimer += 1.0 / 600.0;    // ~10 seconds
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

  noStroke();
  fill(0, 220, 180);  textStyle(NORMAL);  textAlign(CENTER);  textSize(34);
  text("Your Digestive Report", GAME_W / 2, 60);
  stroke(112, 240, 240, 150);  strokeWeight(2);
  line(GAME_W / 2 - 180, 80, GAME_W / 2 + 180, 80);

  // Box sized to content — centred, not full width
  let boxW = GAME_W * 0.62, boxH = GAME_H * 0.52, boxY = GAME_H * 0.43;
  fill(10, 40, 30, 200);  stroke(0, 255, 150, 100);  strokeWeight(3);
  rect(GAME_W / 2, boxY, boxW, boxH, 20);
  noFill();  stroke(0, 255, 150, 50);  strokeWeight(8);
  rect(GAME_W / 2, boxY, boxW - 20, boxH - 20, 15);

  let content = reportContent[currentReportSlide];
  let cx = GAME_W / 2;
  let bodyLines = content.slice(2);
  let titleSize = 32;   // slightly smaller so title fits on one line at all sizes
  // Phase 4 has 8 lines — use tighter gap; all others 7 lines — use comfortable gap
  let bodySize = 32, lineGap = 42;  // same spacing for all phases

  // Strip "PHASE X — " prefix from title (phase shown in buttons below)
  let rawTitle = content[0];
  let dashIdx = rawTitle.indexOf(" — ");
  let displayTitle = dashIdx >= 0 ? rawTitle.substring(dashIdx + 3) : rawTitle;

  // Title centred at top of box
  fill(220, 255, 240);  textAlign(CENTER, TOP);
  textStyle(NORMAL);  textSize(titleSize);
  text(displayTitle, cx, boxY - boxH/2 + 18);

  // Divider line
  let divY = boxY - boxH/2 + 62;
  stroke(0, 255, 150, 120);  strokeWeight(1);
  line(cx - boxW/2 + 40, divY, cx + boxW/2 - 40, divY);

  // Body lines — centred
  textStyle(NORMAL);  textSize(bodySize);  fill(210, 245, 230);
  textAlign(CENTER, TOP);
  let textY = divY + 14;
  for (let i = 0; i < bodyLines.length; i++) {
    text(bodyLines[i], cx, textY);
    textY += lineGap;
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
    textStyle(NORMAL);  textSize(16);  textAlign(CENTER);  text("PHASE " + i, bx, btnY - 15);
    fill(220, 240, 255);
    textSize(12);  text(isDone ? "COMPLETED" : "PENDING", bx, btnY + 10);
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
    textStyle(NORMAL);  textSize(22);
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
    let sbx = GAME_W-50, sby = 38;
    if (dist(ix, iy, sbx, sby) < 28) {
      playSoundOnce(clickSfx);  settingsReturnMode = MODE_TITLE;  mode = MODE_SETTINGS;  transitionAlpha = 0;
    }
    // More Info button (top-left)
    // Info button (top-left ? icon)
    let ibx2 = 50, iby2 = 38;
    if (dist(ix, iy, ibx2, iby2) < 28) {
      playSoundOnce(clickSfx);  infoReturnMode = MODE_TITLE;  mode = MODE_INFO;  transitionAlpha = 0;
    }
  }

  if (mode === MODE_SETTINGS) {
    // Slider knob drag
    if (dist(ix, iy, _settingsKnobX, _settingsSliderY) < 30) isDraggingVolumeSlider = true;
    // 5 step circles
    let steps2 = [0, 0.25, 0.5, 0.75, 1.0];
    let sStart2 = GAME_W/2 - 250, stepSpacing2 = 500 / 4;
    for (let i = 0; i < steps2.length; i++) {
      let sx3 = sStart2 + i * stepSpacing2;
      let sy3 = (_settingsSliderY > 0 ? _settingsSliderY : GAME_H/2-60) + 92;
      if (dist(ix, iy, sx3, sy3) < 22) {
        masterVolume = steps2[i];  playSoundOnce(clickSfx);
      }
    }
    // Back button
    let backX = GAME_W/2, backY = GAME_H-80, backW = 180, backH = 48;
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
    // VIEW REPORT — centred
    let rBtnXi = GAME_W/2, rBtnYi = GAME_H/2+150, rBtnWi = 280, rBtnHi = 60;
    if (done2 === 5 && ix > rBtnXi-rBtnWi/2 && ix < rBtnXi+rBtnWi/2 && iy > rBtnYi-rBtnHi/2 && iy < rBtnYi+rBtnHi/2) {
      playSoundOnce(clickSfx);  currentReportSlide = 0;  reportSfxPlayed=false;  mode = MODE_FINISH;  transitionAlpha = 0;  return;
    }
    for (let i = 0; i < 5; i++) {
      let nx = GAME_W / 2 - 440 + i * 220, ny = GAME_H/2 - 50;
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
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > buttonY-25 && iy < buttonY+25) { playSoundOnce(successSfx);  startReflectionGate(); }
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
      textStyle(NORMAL);  textSize(20);
      let bw2 = textWidth("RESTORE PEPSIN") + 60, bh2 = 54, bx2 = GAME_W/2, by2 = 75+32;
      if (ix > bx2-bw2/2 && ix < bx2+bw2/2 && iy > by2-bh2/2 && iy < by2+bh2/2) { playSoundOnce(clickSfx);  resetPepsin(); }
    }
    if (phase1Complete && proteinScale < 0.3) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (75+32)-25 && iy < (75+32)+25) {
        playSoundOnce(successSfx);
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
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > (warningY+38)-25 && iy < (warningY+38)+25) { playSoundOnce(successSfx);  startReflectionGate(); }
    }
  }

  if (mode === MODE_PHASE3) {
    let allAbsorbed = glucoseSorted && sodiumSGLTSorted && sodiumNHE3Sorted && lipidSorted;
    if (allAbsorbed && phase3ProceedDelay >= PHASE3_PROCEED_DELAY_FRAMES) {
      if (ix > GAME_W/2-100 && ix < GAME_W/2+100 && iy > 115-25 && iy < 115+25) { playSoundOnce(successSfx);  startReflectionGate(); }
    } else {
      // Particle drags — dragSfx only, no click sound overlap
      if      (dist(ix, iy, glucoseX,    glucoseY)    < 40) { draggingGlucose    = true;  dragOffsetX = glucoseX    - ix;  dragOffsetY = glucoseY    - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, sodiumSGLTX, sodiumSGLTY) < 40) { draggingSodiumSGLT = true;  dragOffsetX = sodiumSGLTX - ix;  dragOffsetY = sodiumSGLTY - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, sodiumNH3X,  sodiumNH3Y)  < 40) { draggingSodiumNHE3 = true;  dragOffsetX = sodiumNH3X  - ix;  dragOffsetY = sodiumNH3Y  - iy;  playSoundOnce(dragSfx); }
      else if (dist(ix, iy, lipidX,      lipidY)      < 40) { draggingLipid      = true;  dragOffsetX = lipidX      - ix;  dragOffsetY = lipidY      - iy;  playSoundOnce(dragSfx); }
    }
  }

  if (mode === MODE_PHASE4) {
    // Exact mirror of phase4() draw function coords
    let guideY      = GAME_H * 0.115;
    let btnPY       = guideY + GAME_H * 0.06;
    let sliderY4    = GAME_H * 0.88;
    let sliderStart = GAME_W * 0.34;
    let sliderEnd   = GAME_W * 0.66;
    // Peristalsis hold button — only when stool not yet at end
    if (!peristalsissComplete &&
        ix > GAME_W/2 - 110 && ix < GAME_W/2 + 110 &&
        iy > btnPY - 27  && iy < btnPY + 27) {
      peristalsisActive = true;
    }
    // Proceed button — only after full 3s silent countdown
    if (phase4Ready && phase4ProceedDelay >= PHASE4_PROCEED_DELAY_FRAMES) {
      let proceedY = guideY + GAME_H * 0.067;
      if (ix > GAME_W/2 - 100 && ix < GAME_W/2 + 100 &&
          iy > proceedY - 25 && iy < proceedY + 25) {
        playSoundOnce(successSfx);
        startReflectionGate();
      }
    }
    // Water slider drag — tight vertical, full horizontal track
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

  noStroke();
  fill(0, 255, 200);  textStyle(NORMAL);  textAlign(CENTER);  textSize(72);
  text("BioBalance", GAME_W/2, GAME_H/2-180);
  textSize(30);  text("Digestive Control", GAME_W/2, GAME_H/2-125);

  fill(150, 200, 255);  textStyle(NORMAL);  textSize(20);
  text("Explore, control, and understand how your body digests food.", GAME_W/2, GAME_H/2-90);

  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-250, GAME_H/2-70, GAME_W/2+250, GAME_H/2-70);

  let bw = 360, bh = 90, cx = GAME_W/2;
  let h1 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+40 && getInputY()<GAME_H/2+130;
  let h2 = getInputX()>cx-bw/2 && getInputX()<cx+bw/2 && getInputY()>GAME_H/2+150 && getInputY()<GAME_H/2+240;
  drawTitleButton(cx, GAME_H/2+85,  bw, bh, "START JOURNEY", "Play through all 5 digestive phases", h1);
  drawTitleButton(cx, GAME_H/2+195, bw, bh, "HOW TO PLAY",   "Read the instructions before playing", h2);

  // Settings button top-right — gear icon
  let sbx = GAME_W - 50, sby = 38;
  let hset = dist(getInputX(), getInputY(), sbx, sby) < 28;
  fill(hset ? color(0,80,70) : color(0,40,50), 200);
  stroke(hset ? color(0,255,200) : color(0,180,140));  strokeWeight(hset?2:1.5);
  ellipse(sbx, sby, 52, 52);
  drawGearIcon(sbx, sby, 16);

  // More Info button top-left — question mark icon, mirrors gear button style
  let ibx = 50, iby = 38;
  let hinfo = dist(getInputX(), getInputY(), ibx, iby) < 28;
  fill(hinfo ? color(0,80,70) : color(0,40,50), 200);
  stroke(hinfo ? color(0,200,160) : color(0,160,130));  strokeWeight(hinfo?2:1.5);
  ellipse(ibx, iby, 52, 52);
  drawQuestionMarkIcon(ibx, iby, 14);

  // Footer text handled by drawFooter() — no duplicate here
}

function drawTitleButton(x, y, w, h, main, sub, hov) {
  push();  translate(x, y);  if (hov) scale(1.03);
  if (hov) { noFill();  stroke(0,255,200,100);  strokeWeight(8);  rect(0,0,w+10,h+10,15); }
  fill(hov ? color(0,100,100) : color(0,80,80), 220);
  stroke(0,255,200, hov?255:180);  strokeWeight(hov?3:2);  rect(0,0,w,h,12);
  noStroke();
  fill(240, 250, 255);  textStyle(NORMAL);  textSize(24);  text(main, 0, -12);
  fill(180,220,225);  textSize(14);  text(sub, 0, 20);
  pop();
}

// =========================================================
// CONTROL PROTOCOL / HOW TO PLAY
// =========================================================
function drawControlProtocol() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  noStroke();
  fill(0,220,180);  textStyle(NORMAL);  textAlign(CENTER);  textSize(36);
  text("How to Play", GAME_W/2, 65);
  stroke(0,255,200,80);  strokeWeight(1);
  line(GAME_W/2-200, 85, GAME_W/2+200, 85);

  let sf = min(1, GAME_W/1280);
  let cw = 550*sf, ch = 200*sf, sx2 = 30*sf, sy = 30*sf;
  let sx3 = GAME_W/2-cw/2-sx2/2, sy3 = 110;

  drawProtocolCard(sx3,          sy3+ch/2,            cw, ch, 0, currentCard===0);
  drawProtocolCard(sx3+cw+sx2,   sy3+ch/2,            cw, ch, 1, currentCard===1);
  drawProtocolCard(sx3,          sy3+ch+sy+ch/2,      cw, ch, 2, currentCard===2);
  drawProtocolCard(sx3+cw+sx2,   sy3+ch+sy+ch/2,      cw, ch, 3, currentCard===3);
  // No progress bar below cards

  let bx4=GAME_W-80, by4=GAME_H-80, br=60;
  let hov = dist(getInputX(),getInputY(),bx4,by4)<br;
  let pulse4 = (sin(millis()*0.002)+1)/2.0;
  noFill();  stroke(0,255,200, hov?200:80+pulse4*60);  strokeWeight(hov?8:4);
  ellipse(bx4,by4,br*2+20,br*2+20);
  fill(hov?color(0,200,160):color(0,100,100),240);
  stroke(0,255,200);  strokeWeight(hov?4:2);  ellipse(bx4,by4,br*2,br*2);
  fill(255);  textStyle(NORMAL);  textSize(36);  textAlign(CENTER,CENTER);  text("→",bx4+2,by4-2);  textStyle(NORMAL);

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
  // Card title
  noStroke();
  fill(isActive ? color(0,210,170) : color(110,130,150));
  textStyle(NORMAL);  textSize(18);  textAlign(CENTER);
  text(cardTitles[idx], 0, -h/2+40);
  // Body content — centred
  noStroke();  fill(195, 215, 238);
  textStyle(NORMAL);  textSize(15);  textAlign(CENTER);
  let ly = -h/2+75;
  for (let line of cardContent[idx]) { text(line, 0, ly);  ly += 23; }
  pop();
}

// =========================================================
// JOURNEY MAP
// =========================================================
function drawJourneyMap() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  // Title — v4 style: uppercase, cyan, size 38
  noStroke();  fill(0,255,200);  textStyle(NORMAL);  textAlign(CENTER);  textSize(38);
  text("YOUR DIGESTIVE JOURNEY", GAME_W/2, 65);

  let done = 0, tot = 0;
  for (let i = 0; i < 5; i++) { if (phaseCompleted[i]) { done++;  tot += phaseEfficiency[i]; } }
  let sysInt = done === 0 ? 0 : tot / done;

  noStroke();  fill(150,200,255);  textStyle(NORMAL);  textSize(16);
  text("Overall Score: " + nf(sysInt,0,1) + "%  |  Phases Completed: " + done + " / 5", GAME_W/2, 95);

  // DIGESTION COMPLETE — v4 style: static fill, size 34
  if (done === 5) {
    noStroke();  fill(0, 255, 200);
    textStyle(NORMAL);  textSize(34);  textAlign(CENTER);
    text("Digestion Complete!", GAME_W/2, 160);
  }

  // Phase nodes — nodeY matches click handler
  let nodeY = GAME_H/2 - 50;
  noStroke();
  strokeWeight(3);
  for (let i = 0; i < 4; i++) {
    let x1 = GAME_W/2-440+(i*220), x2 = x1+220;
    stroke(phaseCompleted[i] ? color(0,200,160,140) : color(50,60,80,80));
    line(x1, nodeY, x2, nodeY);
  }

  for (let i = 0; i < 5; i++) drawPhaseNode(GAME_W/2-440+i*220, nodeY, i);

  if (selectedPhase >= 0) {
    let sx = GAME_W/2-440+selectedPhase*220;
    noFill();  stroke(0,200,160,100);  strokeWeight(2);
    ellipse(sx, nodeY, 118, 118);
  }

  noStroke();  fill(160,180,200);  textStyle(NORMAL);  textSize(14);  textAlign(CENTER);
  text("Select a phase to begin or replay", GAME_W/2, GAME_H - 42);

  // PROGRESS table — kept from last file (left side)
  let rBtnY2 = GAME_H/2 + 150, rBtnH2 = 60;
  let prgX = 165, prgW = 260;
  fill(0,20,40,200);  stroke(0,180,140,60);  strokeWeight(1);
  rect(prgX, rBtnY2, prgW, 70, 8);
  noStroke();  fill(0,255,200);  textStyle(NORMAL);  textSize(13);  textAlign(CENTER,CENTER);
  text("Progress", prgX, rBtnY2 - 22);
  fill(180,200,225);  textSize(12);
  text("Status: " + (done===5?"Complete":done>=2?"In Progress":"Just Starting"), prgX, rBtnY2 - 4);
  text("Score:  " + nf(sysInt,0,1)+"%", prgX, rBtnY2 + 16);

  // VIEW REPORT button — always drawn; active only when all 5 done
  let rBtnX2 = GAME_W/2, rBtnW2 = 280;
  let allDone2 = (done === 5);
  let hRep2 = allDone2 && getInputX()>rBtnX2-rBtnW2/2 && getInputX()<rBtnX2+rBtnW2/2 &&
              getInputY()>rBtnY2-rBtnH2/2 && getInputY()<rBtnY2+rBtnH2/2;
  fill(allDone2 ? (hRep2 ? color(0,150,120) : color(0,100,80)) : color(30,40,55), 220);
  stroke(allDone2 ? color(0,255,200) : color(50,65,80));  strokeWeight(allDone2?2:1);
  rect(rBtnX2, rBtnY2, rBtnW2, rBtnH2, 12);
  noStroke();  fill(allDone2 ? 255 : color(80,95,110));
  textStyle(NORMAL);  textSize(16);  textAlign(CENTER,CENTER);
  text(allDone2 ? "View Full Report" : "Complete all phases first", rBtnX2, rBtnY2 - 2);
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

  // Outer ring — completed uses phase colour with glow, available uses pulse
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

  noStroke();  textAlign(CENTER, CENTER);
  if (isCompleted) {
    // Gold ring for 100% — breathing glow from reference
    if (phaseEfficiency[phaseIndex] === 100) {
      noFill();  stroke(255,215,0, 150+sin(millis()*0.002)*105);  strokeWeight(4);
      ellipse(x,y,baseSize+35,baseSize+35);
      noStroke();  fill(255,215,0);
    } else {
      noStroke();  fill(phaseEfficiency[phaseIndex]===90 ? color(220,220,255) : color(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2]));
    }
    noStroke();  textStyle(NORMAL);  textSize(24);  text(nf(phaseEfficiency[phaseIndex],0,0)+"%", x, y);
    if (phaseEfficiency[phaseIndex]===100) { noStroke();  textSize(12);  fill(255,215,0);  text("★ PERFECT ★",x,y+20); }
  } else if (isLocked) {
    noStroke();  fill(100,110,120);  textStyle(NORMAL);  textSize(18);  text("LOCK",x,y);
  } else {
    noStroke();  fill(isSelected?color(255,200,0):color(0,255,200));
    textStyle(NORMAL);  textSize(18);  text(phaseIndex===0?"START":"PLAY",x,y+2);
  }
  textStyle(NORMAL);

  // Phase label above — uses phaseColors for completed (from reference)
  noStroke();
  if (isCompleted)       fill(phaseColors[phaseIndex][0],phaseColors[phaseIndex][1],phaseColors[phaseIndex][2]);
  else if (isAvailable)  fill(isSelected?color(255,200,0):color(0,255,200));
  else                   fill(120,130,140);
  textSize(14);  textAlign(CENTER,CENTER);  text("PHASE "+phaseIndex, x, y-65);

  // Phase name — bold white (from reference)
  noStroke();  fill(255);  textStyle(NORMAL);  textSize(16);  text(phaseNames[phaseIndex], x, y+65);
  fill(180,190,200);  textSize(12);  text(phaseSubtitles[phaseIndex], x, y+85);

  // Status label with colour variable (from reference)
  let statusLabel, statusColor;
  if (isCompleted)      { statusLabel = "COMPLETED"; statusColor = color(0,255,150); }
  else if (isAvailable) { statusLabel = phaseIndex===0?"START HERE":(isSelected?"SELECTED":"AVAILABLE"); statusColor = isSelected?color(255,200,0):color(0,255,200); }
  else                  { statusLabel = "LOCKED";    statusColor = color(255,80,80); }
  noStroke();  fill(statusColor);  textSize(13);  text(statusLabel, x, y+105);

  // Hover ring + REPLAY/START label (from reference)
  if (dist(getInputX(),getInputY(),x,y) < baseSize/2 && isAvailable) {
    noFill();  stroke(255,200);  strokeWeight(2);  ellipse(x,y,baseSize+40,baseSize+40);
    noStroke();  fill(255,255,0);  textSize(14);  text(isCompleted?"REPLAY":"START", x, y+130);
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

  noStroke();
  fill(0,200,160);  textStyle(NORMAL);  textAlign(CENTER);  textSize(36);
  text("Software License Agreement", GAME_W/2, 90);
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
  textStyle(NORMAL);  textSize(22);
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

  noStroke();
  fill(0, 200, 160);  textStyle(NORMAL);  textAlign(CENTER);  textSize(32);
  text("Settings", GAME_W/2, 80);
  stroke(0, 200, 160, 60);  strokeWeight(1);
  line(GAME_W/2-160, 98, GAME_W/2+160, 98);

  // Master volume slider
  let sliderCX = GAME_W/2, sliderY = GAME_H/2 - 60;
  let sliderLen = 500, sliderStart = sliderCX - sliderLen/2, sliderEnd = sliderCX + sliderLen/2;
  let knobX = map(masterVolume, 0, 1, sliderStart, sliderEnd);

  noStroke();  fill(160, 190, 220);  textStyle(NORMAL);  textSize(20);  textAlign(CENTER);
  text("Master Volume", sliderCX, sliderY - 50);

  stroke(60, 80, 100);  strokeWeight(8);  line(sliderStart, sliderY, sliderEnd, sliderY);
  stroke(0, 200, 160);  strokeWeight(8);  line(sliderStart, sliderY, knobX, sliderY);
  fill(0, 200, 160);  noStroke();  ellipse(knobX, sliderY, 36, 36);

  noStroke();  fill(180, 200, 220);  textSize(13);
  textAlign(RIGHT);  text("0%", sliderStart - 12, sliderY + 6);
  textAlign(LEFT);   text("100%", sliderEnd + 12, sliderY + 6);
  textAlign(CENTER);

  let volLabel = masterVolume < 0.02 ? "0%" : int(masterVolume * 100) + "%";
  noStroke();  fill(0, 200, 160);  textStyle(NORMAL);  textSize(30);
  text(volLabel, sliderCX, sliderY + 52);

  // 5 step circles: 0%, 25%, 50%, 75%, 100%
  let steps = [0, 0.25, 0.5, 0.75, 1.0];
  let stepLabels = ["0%", "25%", "50%", "75%", "100%"];
  let stepSpacing = sliderLen / (steps.length - 1);
  for (let i = 0; i < steps.length; i++) {
    let sx2 = sliderStart + i * stepSpacing;
    let sy2 = sliderY + 92;
    let isActive = abs(masterVolume - steps[i]) < 0.01;
    let isHov = dist(getInputX(), getInputY(), sx2, sy2) < 22;
    fill(isActive ? color(0,180,140) : isHov ? color(0,120,110) : color(15,35,55));
    stroke(isActive ? color(0,200,160) : color(55,90,110));
    strokeWeight(isActive ? 2.5 : 1.5);
    ellipse(sx2, sy2, 38, 38);
    noStroke();
    fill(isActive ? 255 : color(170,190,215));
    textStyle(NORMAL);  textSize(12);  textAlign(CENTER, CENTER);
    text(stepLabels[i], sx2, sy2);
  }

  // Back button
  let backX = GAME_W/2, backY = GAME_H - 80, backW = 180, backH = 48;
  let hBack = getInputX()>backX-backW/2 && getInputX()<backX+backW/2 &&
              getInputY()>backY-backH/2 && getInputY()<backY+backH/2;
  fill(hBack ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,200,160);  strokeWeight(2);  rect(backX, backY, backW, backH, 10);
  noStroke();  fill(230, 245, 240);  textStyle(NORMAL);  textSize(16);  textAlign(CENTER,CENTER);
  text("Back", backX, backY - 2);

  // Cache slider coords for drag/click detection
  _settingsKnobX = knobX;
  _settingsSliderStart = sliderStart;
  _settingsSliderEnd   = sliderEnd;
  _settingsSliderY     = sliderY;
}

function drawGearIcon(cx, cy, r) {
  // Soft rounded gear — fewer, wider teeth with curved outer profile
  let teeth = 6, innerR = r*0.60, outerR = r, toothHalf = 0.18;
  fill(0, 210, 165, 210);  noStroke();
  beginShape();
  for (let i = 0; i < teeth; i++) {
    let midA  = (i / teeth) * TWO_PI;
    let a1 = midA - toothHalf;
    let a2 = midA - toothHalf * 0.3;
    let a3 = midA + toothHalf * 0.3;
    let a4 = midA + toothHalf;
    // Blend inner to outer smoothly
    vertex(cx + cos(a1)*innerR,          cy + sin(a1)*innerR);
    vertex(cx + cos(a2)*(outerR*0.90),   cy + sin(a2)*(outerR*0.90));
    vertex(cx + cos(midA)*outerR,        cy + sin(midA)*outerR);
    vertex(cx + cos(a3)*(outerR*0.90),   cy + sin(a3)*(outerR*0.90));
    vertex(cx + cos(a4)*innerR,          cy + sin(a4)*innerR);
  }
  endShape(CLOSE);
  // Centre hole
  fill(10, 20, 35);  noStroke();
  ellipse(cx, cy, innerR*1.15, innerR*1.15);
  // Small centre dot
  fill(0, 210, 165, 160);  noStroke();
  ellipse(cx, cy, innerR*0.35, innerR*0.35);
}

function drawQuestionMarkIcon(cx, cy, r) {
  // Clean question mark: thick arc curve + vertical stem + dot
  noStroke();  fill(0, 200, 160, 220);
  let sw = r * 0.28;   // stroke width as filled shape

  // Upper arc — draw as thick ring segment using two arcs (outer and inner)
  let outerR = r * 0.72, innerR = r * 0.72 - sw;
  let arcStart = -PI * 0.9, arcEnd = PI * 0.45;
  let steps = 24;
  beginShape();
  // Outer arc forward
  for (let i = 0; i <= steps; i++) {
    let a = map(i, 0, steps, arcStart, arcEnd);
    vertex(cx + cos(a)*outerR, cy - r*0.08 + sin(a)*outerR);
  }
  // Inner arc backward (forming the thickness)
  for (let i = steps; i >= 0; i--) {
    let a = map(i, 0, steps, arcStart, arcEnd);
    vertex(cx + cos(a)*innerR, cy - r*0.08 + sin(a)*innerR);
  }
  endShape(CLOSE);

  // Vertical stem dropping from the arc's end
  let stemX = cx + cos(arcEnd)*((outerR+innerR)/2);
  let stemY = cy - r*0.08 + sin(arcEnd)*((outerR+innerR)/2);
  rectMode(CENTER);
  rect(cx, stemY + r*0.22, sw, r*0.38, sw*0.4);
  rectMode(CENTER);  // keep rectMode consistent

  // Dot
  ellipse(cx, cy + r*0.72, sw*0.9, sw*0.9);
}

function drawSettingsToggle(cx, y, label, sublabel, isOn) {
  // Row background
  fill(10, 25, 45, 180);  stroke(0, 200, 160, 50);  strokeWeight(1);
  rect(cx, y, 520, 72, 12);

  // Label
  fill(210, 230, 250);  textStyle(NORMAL);  textSize(18);  textAlign(LEFT, CENTER);
  text(label, cx - 230, y - 10);
  fill(130, 150, 170);  textSize(13);
  text(sublabel, cx - 230, y + 12);

  // Toggle pill
  let tx = cx + 180, tw = 80, th = 36;
  let pillColor = isOn ? color(0, 200, 150) : color(50, 65, 80);
  fill(pillColor);  noStroke();  rect(tx, y, tw, th, th/2);

  // Knob
  let knobX2 = isOn ? tx + tw/2 - th/2 - 2 : tx - tw/2 + th/2 + 2;
  fill(255);  ellipse(knobX2, y, th-6, th-6);

  // No text on pill — knob position communicates state
}

// =========================================================
// MORE INFO SCREEN
// =========================================================
function drawInfoScreen() {
  for (let p of protocolParticles) { p.update();  p.display(); }

  // Title
  noStroke();
  fill(0, 200, 160);  textStyle(NORMAL);  textAlign(CENTER);  textSize(36);
  text("More Info", GAME_W/2, 70);
  stroke(0, 255, 200, 100);  strokeWeight(2);
  line(GAME_W/2-200, 108, GAME_W/2+200, 108);

  // Description block
  fill(170, 200, 230);  textStyle(NORMAL);  textSize(20);  textAlign(CENTER);
  text("BioBalance: Digestive Control is available as a desktop app for Windows and as a", GAME_W/2, 155);
  text("Progressive Web App (PWA) you can open on any phone or tablet.", GAME_W/2, 182);

  // Section label
  fill(0, 255, 200);  textStyle(NORMAL);  textSize(18);
  text("Official Website", GAME_W/2, 238);

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
  fill(0, 255, 200);  textStyle(NORMAL);  textSize(28);  textAlign(CENTER, CENTER);
  text("theos13-nw.github.io/BioBalance-SITE", lbx, lby - 2);

  // Small hint below box
  fill(120, 140, 160);  textSize(15);  textAlign(CENTER);
  text("Tap / click the box above to open in browser", lbx, lby + lbh/2 + 24);

  // Back button
  let bi2x = GAME_W/2, bi2y = GAME_H-80, bi2w = 200, bi2h = 50;
  let hBack2 = getInputX()>bi2x-bi2w/2 && getInputX()<bi2x+bi2w/2 &&
               getInputY()>bi2y-bi2h/2 && getInputY()<bi2y+bi2h/2;
  fill(hBack2 ? color(0,100,100) : color(0,60,80), 220);
  stroke(0,255,200);  strokeWeight(2);  rect(bi2x, bi2y, bi2w, bi2h, 10);
  fill(255);  textStyle(NORMAL);  textSize(16);  textAlign(CENTER,CENTER);
  text("Back", bi2x, bi2y-2);
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
  fill(255, 255, 255);  textStyle(NORMAL);  textAlign(CENTER, CENTER);  textSize(32);
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
  fill(255);  textStyle(NORMAL);  textSize(22);  textAlign(CENTER, CENTER);
  text("EXIT", exBtnX, exBtnY - 2);  textStyle(NORMAL);

  // CANCEL button (cyan)
  let caBtnX = GAME_W/2 + 130, caBtnY = GAME_H/2 + 75, caBtnW = 200, caBtnH = 60;
  let hCa = getInputX()>caBtnX-caBtnW/2 && getInputX()<caBtnX+caBtnW/2 &&
            getInputY()>caBtnY-caBtnH/2 && getInputY()<caBtnY+caBtnH/2;
  fill(hCa ? color(0, 130, 110) : color(0, 80, 70), 240);
  stroke(0, 255, 200);  strokeWeight(hCa ? 4 : 2);
  rect(caBtnX, caBtnY, caBtnW, caBtnH, 12);
  fill(255);  textStyle(NORMAL);  textSize(22);  textAlign(CENTER, CENTER);
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
  noStroke();
  fill(220, 235, 250);  textAlign(CENTER);  textStyle(NORMAL);  textSize(22);
  text(t, GAME_W/2, y);
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
  rect(x,y,bw,bh,10);  noStroke();  fill(230,248,245);  textStyle(NORMAL);  textSize(18);  textAlign(CENTER,CENTER);
  text("PROCEED",x,y-3);
}

function drawNextButton(x, y, label) {
  let bw=200, bh=50;
  let hov=getInputX()>x-bw/2&&getInputX()<x+bw/2&&getInputY()>y-bh/2&&getInputY()<y+bh/2;
  fill(hov?80:40,200);  stroke(0,255,200, 150+sin(millis()*0.002)*100);  strokeWeight(3);
  rect(x,y,bw,bh,10);  noStroke();  fill(230,248,245);  textStyle(NORMAL);  textSize(18);  textAlign(CENTER,CENTER);
  text(label,x,y-3);
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
  noStroke();
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
    // Competency: trace food; explain secretion; brain-gut connection
    fullBank = [
      new Question("What type of process happens in your mouth when you smell food and saliva is produced?",
        ["Secretion — the body releases digestive fluids to get ready","Absorption — the body takes in nutrients through the mouth wall","Elimination — the body removes waste before digestion starts"],0),
      new Question("Which nerve sends signals from the brain to the digestive organs before you eat?",
        ["The vagus nerve — it connects the brain to the gut","The spinal cord — it carries signals between the body and brain","The optic nerve — it carries signals from the eyes to the brain"],0),
      new Question("Why does your mouth water when you smell delicious food?",
        ["Saliva contains enzymes that begin breaking down food early","Saliva cools the food so the stomach is not damaged","Saliva fights bacteria before they enter the digestive tract"],0),
      new Question("What is the first digestive organ that food enters after it is swallowed?",
        ["The oesophagus — a muscular tube that carries food to the stomach","The stomach — where most chemical digestion takes place","The small intestine — where most nutrients are absorbed"],0),
      new Question("What does the cephalic phase tell us about how the digestive and nervous systems work together?",
        ["The nervous system triggers digestive secretions before food arrives","The digestive system sends signals to the brain when full","The nervous system absorbs nutrients on behalf of the gut"],0),
      new Question("In the simulation, what does moving the scent slider to the right represent?",
        ["A stronger food smell reaching the brain and triggering more secretion","A stronger acid level building up inside the stomach","A faster rate of absorption in the small intestine"],0),
      new Question("What would happen if the vagus nerve were cut before a meal?",
        ["The brain could not signal the stomach to prepare for digestion","The stomach would produce too much acid and digest itself","The small intestine would stop absorbing all nutrients"],0),
    ];
  } else if (phaseIdx === 1) {
    // Competency: mechanical processing + chemical digestion in the stomach
    fullBank = [
      new Question("What is the difference between mechanical and chemical digestion in the stomach?",
        ["Mechanical churns food into smaller pieces; chemical uses acid and enzymes to break molecules","Mechanical uses enzymes to break food down; chemical uses muscles to mash it","Mechanical absorbs nutrients; chemical removes waste from the body"],0),
      new Question("Why does the stomach produce a thick layer of mucus?",
        ["To protect the stomach lining from being damaged by its own acid","To help enzymes move through the stomach faster","To slow digestion so the body has more time to absorb nutrients"],0),
      new Question("What happens to a protein molecule when it meets stomach acid?",
        ["It unfolds (denatures) so that enzymes can break it into smaller parts","It dissolves completely without the need for any enzymes","It becomes a carbohydrate that is absorbed directly into the blood"],0),
      new Question("What does pepsin do during chemical digestion?",
        ["It breaks protein chains into shorter peptide pieces","It neutralises stomach acid to protect the stomach wall","It churns food together with acid through muscle movement"],0),
      new Question("In this simulation, what does lowering the pH slider represent?",
        ["Increasing the acidity of the stomach to activate pepsin","Decreasing the amount of mucus protecting the stomach","Slowing the mechanical movement of food in the stomach"],0),
      new Question("What does the shrinking protein image in the simulation show?",
        ["That chemical digestion is breaking the protein into smaller pieces","That the food has moved from the stomach to the small intestine","That the stomach is producing less acid than it should"],0),
      new Question("How do the digestive and muscular systems work together in the stomach?",
        ["Stomach muscles churn food while digestive enzymes break it down chemically","The muscular system absorbs nutrients and the digestive system removes waste","Muscles stop digestion while enzymes physically mash the food instead"],0),
    ];
  } else if (phaseIdx === 2) {
    // Competency: hormone secretion; body systems working together; small intestine
    fullBank = [
      new Question("What is secretion in the digestive system?",
        ["The release of fluids like hormones and enzymes to help digestion","The movement of food from the stomach to the small intestine","The absorption of nutrients through the walls of the intestine"],0),
      new Question("Why must the acid from the stomach be neutralised in the small intestine?",
        ["The enzymes in the small intestine work best at a neutral or slightly basic pH","The small intestine produces its own acid so the incoming acid must be removed","The acid would speed up absorption too much in the small intestine"],0),
      new Question("What does the hormone Secretin do in the small intestine?",
        ["It signals the pancreas to release bicarbonate to reduce acid","It signals the stomach to increase acid production","It signals the liver to release more glucose into the blood"],0),
      new Question("What does the hormone CCK do when fats enter the small intestine?",
        ["It triggers the release of bile and enzymes to digest fats and proteins","It slows the stomach so fat cannot enter the intestine too fast","It signals the large intestine to begin reabsorbing water"],0),
      new Question("In this simulation, what happens if you only spray Secretin and not CCK?",
        ["Acid is reduced but fats are not properly broken down for absorption","Fats are broken down but acid remains too high for enzymes to work","Both acid and fats are handled because Secretin does both jobs"],0),
      new Question("How do the digestive system and endocrine system work together in Phase 2?",
        ["Hormones secreted by the intestine control enzyme and fluid release","The intestine digests hormones to release energy for the body","Enzymes in the intestine signal the brain to produce hormones"],0),
      new Question("What do both Secretin and CCK have in common?",
        ["They are both hormones secreted to help digestion in the small intestine","They are both enzymes produced in the stomach to digest protein","They are both produced in the large intestine to reabsorb water"],0),
    ];
  } else if (phaseIdx === 3) {
    // Competency: absorption; villi; digestion+circulatory systems together
    fullBank = [
      new Question("What is absorption in the digestive system?",
        ["The process where nutrients pass through the intestine wall into the blood","The process where food is broken down into smaller chemical molecules","The process where the body removes undigested waste at the end of digestion"],0),
      new Question("Why are villi in the small intestine shaped like tiny finger-like folds?",
        ["The folds increase surface area so more nutrients can be absorbed faster","The folds slow digestion so that enzymes have more time to work","The folds protect the intestine wall from being damaged by acid"],0),
      new Question("Why does glucose travel into the blood capillary and not the lacteal?",
        ["Glucose is small enough to pass directly into blood vessels for transport","Glucose is a fat that is too large for blood capillaries to accept","Glucose travels with lipids through the lymph system to reach the liver"],0),
      new Question("Why do fats travel to the lacteal instead of the blood capillary?",
        ["Fats are packaged into large molecules that must travel through the lymph system","Fats are small enough to dissolve in blood but too slow for the capillary","Fats are broken down into glucose before entering the blood capillary"],0),
      new Question("How do the digestive and circulatory systems work together during absorption?",
        ["Nutrients absorbed through the villi enter the bloodstream to reach body cells","The circulatory system digests nutrients using enzymes from the heart","The digestive system carries blood through the intestine for oxygenation"],0),
      new Question("In the simulation, what does it mean when a nutrient bounces back from a zone?",
        ["That the wrong zone was chosen — cell membranes only allow certain molecules","That the zone is full and cannot accept any more nutrients","That the nutrient has already been absorbed and is returning to the intestine"],0),
      new Question("After nutrients are absorbed, which body system transports them to cells?",
        ["The circulatory system — blood carries nutrients to every cell in the body","The excretory system — the kidneys filter nutrients out of the blood","The nervous system — nerve signals carry nutrients to organs that need them"],0),
    ];
  } else if (phaseIdx === 4) {
    // Competency: elimination; digestion+excretion working together; large intestine
    fullBank = [
      new Question("What is elimination in the digestive process?",
        ["The removal of undigested waste from the body through the rectum","The absorption of water from the large intestine into the blood","The breakdown of fibre by gut bacteria in the large intestine"],0),
      new Question("Why is water reabsorbed in the large intestine before waste is eliminated?",
        ["To prevent dehydration and to form solid waste the body can pass","To kill any bacteria left in the waste before it leaves the body","To add enzymes that finish digesting food in the large intestine"],0),
      new Question("What does peristalsis do in the large intestine?",
        ["Wave-like muscle contractions push waste toward the rectum for elimination","Peristalsis pumps water out of the blood into the large intestine","Peristalsis produces enzymes that break down undigested food"],0),
      new Question("How do the digestive and excretory systems work together in Phase 4?",
        ["The large intestine reabsorbs water (digestion) and then removes waste (excretion)","The excretory system digests food while the digestive system removes waste","The digestive system filters blood and the excretory system absorbs nutrients"],0),
      new Question("In the simulation, what happens when too little water is absorbed from the waste?",
        ["The waste stays too watery and would pass as diarrhoea","The waste becomes too hard and would cause constipation","The waste dissolves back into the intestine wall completely"],0),
      new Question("What does the water absorption slider in the simulation represent?",
        ["How much water the large intestine is reabsorbing from the waste","How much saliva the mouth is producing at the start of digestion","How fast peristalsis is moving waste toward the rectum"],0),
      new Question("What would happen to the body if the large intestine did not reabsorb water?",
        ["The body would lose too much water, leading to dehydration","The body would absorb too many nutrients from the large intestine","The body would produce more digestive enzymes to replace the water"],0),
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
  // 2-question banks: Q1 = structure, Q2 = function
  // MATATAG Grade 8: "Structure and function of the human digestive system"
  let banks = [
    // Phase 0 — Mouth
    [
      new Question("Which structure in the mouth mainly breaks food into smaller pieces?",
        ["Teeth grind food into smaller pieces during chewing.",
         "Tongue pushes food toward the throat for swallowing.",
         "Saliva moistens food to make swallowing easier."],0),
      new Question("What important function does saliva perform in the mouth?",
        ["Saliva moistens food and begins starch digestion.",
         "Saliva pushes food directly toward the stomach.",
         "Saliva absorbs nutrients into nearby blood vessels."],0),
    ],
    // Phase 1 — Stomach
    [
      new Question("What is the main function of the stomach during digestion?",
        ["Stomach acid and enzymes break down proteins.",
         "Small intestine absorbs nutrients into blood vessels.",
         "Large intestine removes water from food waste."],0),
      new Question("Which structure helps the stomach mix food with digestive juices?",
        ["Strong stomach muscles churn food with acid.",
         "Thin intestinal walls absorb nutrients quickly.",
         "Large intestine stores waste before elimination."],0),
    ],
    // Phase 2 — Small Intestine (Digestion Stage)
    [
      new Question("What is the main role of the small intestine in digestion?",
        ["Digestive enzymes break food into nutrients.",
         "Stomach acid breaks proteins into smaller parts.",
         "Large intestine removes water from food waste."],0),
      new Question("Why is the small intestine important after stomach digestion?",
        ["Food nutrients are prepared for absorption.",
         "Food is returned to the stomach for mixing.",
         "Food waste is removed from the body."],0),
    ],
    // Phase 3 — Small Intestine (Villi & Nutrient Zones)
    [
      new Question("What is the main function of the villi in the small intestine?",
        ["Villi absorb nutrients into the bloodstream.",
         "Villi grind food into smaller particles.",
         "Villi store waste before elimination."],0),
      new Question("Why do villi have many tiny folds and projections?",
        ["They increase surface area for nutrient absorption.",
         "They push food back toward the stomach.",
         "They store nutrients for later digestion."],0),
    ],
    // Phase 4 — Large Intestine (Elimination)
    [
      new Question("What is the main function of the large intestine?",
        ["Water is absorbed from remaining food waste.",
         "Proteins are broken down into amino acids.",
         "Starch is digested into simple sugars."],0),
      new Question("Why is water absorption important in the large intestine?",
        ["It helps form solid waste for elimination.",
         "It begins the digestion of starch molecules.",
         "It sends nutrients into the bloodstream."],0),
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

    noStroke();
    fill(0,255,200);  textStyle(NORMAL);  textAlign(CENTER);  textSize(38);
    text("KNOWLEDGE CHECK", cx, 80);
    textSize(18);  fill(150,200,255);
    text(pnameShort, cx, 110);

    fill(255);  textSize(19);  textAlign(CENTER);
    text("Choose how many questions you want to answer:", cx, 185);

    // 2-question button — TOP, cyan
    let b2x = cx, b2y = 300, b2w = 420, b2h = 120;
    let h2 = getInputX()>b2x-b2w/2 && getInputX()<b2x+b2w/2 && getInputY()>b2y-b2h/2 && getInputY()<b2y+b2h/2;
    fill(h2 ? color(0,100,100) : color(0,60,80), 230);
    stroke(0,255,200);  strokeWeight(h2?3:2);  rect(b2x, b2y, b2w, b2h, 15);
    fill(0,255,200);  textStyle(NORMAL);  textSize(32);  textAlign(CENTER,CENTER);
    text("2 QUESTIONS", b2x, b2y-18);
    fill(200,255,240);  textStyle(NORMAL);  textSize(15);
    text("Structure & Function — quick check", b2x, b2y+14);

    // 5-question button — BOTTOM, cyan
    let b5x = cx, b5y = 460, b5w = 420, b5h = 120;
    let h5 = getInputX()>b5x-b5w/2 && getInputX()<b5x+b5w/2 && getInputY()>b5y-b5h/2 && getInputY()<b5y+b5h/2;
    fill(h5 ? color(0,100,100) : color(0,60,80), 230);
    stroke(0,255,200);  strokeWeight(h5?3:2);  rect(b5x, b5y, b5w, b5h, 15);
    fill(0,255,200);  textStyle(NORMAL);  textSize(32);  textAlign(CENTER,CENTER);
    text("5 QUESTIONS", b5x, b5y-18);
    fill(200,255,240);  textStyle(NORMAL);  textSize(15);
    text("Full knowledge check — 7-question bank, 5 drawn", b5x, b5y+14);

    fill(160,180,200);  textSize(13);  textAlign(CENTER);
    text("Both modes use the same mastery scoring: 100% → 90% → 80%", cx, 545);
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

    noStroke();
    fill(0, 255, 200);  textStyle(NORMAL);  textAlign(CENTER);  textSize(38);
    text("KNOWLEDGE CHECK", cx, 80);
    textSize(18);  fill(150, 200, 255);
    text(pnameShort, cx, 110);

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
      noStroke();  textStyle(NORMAL);  textSize(22);  text(feedbackMsg, cx, GAME_H-80);
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
    fill(0,255,150, 200+pulse3*55);  textStyle(NORMAL);  textSize(56);  textAlign(CENTER,CENTER);
    text("Great Job!", cx, GAME_H/2-80);

    let pname2=["PHASE 0 — BRAIN FOOD RESPONSE","PHASE 1 — STOMACH ACID & ENZYMES",
                "PHASE 2 — HORMONE BALANCE","PHASE 3 — NUTRIENT ABSORPTION",
                "PHASE 4 — WATER REABSORPTION & ELIMINATION"][phaseIdx]||"";
    let eff = calculateEfficiency(phaseIdx);
    noStroke();  fill(210,180,70);  textSize(30);  text(nf(eff,0,0)+"% Mastery Achieved", cx, GAME_H/2-20);
    fill(255);  textStyle(NORMAL);  textSize(24);
    text("You've successfully learned about", cx, GAME_H/2+30);
    textStyle(NORMAL);  text(pname2, cx, GAME_H/2+70);  textStyle(NORMAL);

    if (mode===MODE_PHASE4) {
      textSize(22);  fill(0,255,200);  text("The full digestive process is complete!", cx, GAME_H/2+115);
      textSize(19);  fill(200,255,230);
      text("From the brain signal all the way to elimination —", cx, GAME_H/2+148);
      text("you have traced how the entire digestive system works.", cx, GAME_H/2+172);
      text("Great work, BioBalancer!", cx, GAME_H/2+196);
    } else {
      if (eff===100) { textStyle(NORMAL);  textSize(20);  fill(220,185,80);  noStroke();  text("★ Perfect first-try mastery ★", cx, GAME_H/2+110); }
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
    noStroke();
    fill(220,100,100);  textStyle(NORMAL);  textSize(36);  textAlign(CENTER,CENTER);
    text("Not quite — let's try again!", cx, GAME_H/2-100);
    fill(190,205,225);  textStyle(NORMAL);  textSize(19);
    text("You need all " + (quizModeSelected===2?"2":"5") + " correct to move forward.", cx, GAME_H/2-55);

    // FIX: wrong answers are now displayed so students can learn
    if (wrongAnswers.length > 0) {
      fill(255,200,100);  textStyle(NORMAL);  textSize(18);
      text("Questions you missed:", cx, GAME_H/2-10);  textStyle(NORMAL);
      let wy = GAME_H/2+25;
      for (let wa of wrongAnswers) {
        fill(255,100,100);  textSize(15);
        text("Q"+wa.questionNum+" — Your answer: "+wa.yourAnswer, cx, wy);  wy+=22;
        fill(100,255,150);
        text("✓ Correct: "+wa.correctAnswer, cx, wy);  wy+=30;
      }
    }

    fill(0,255,200);  textStyle(NORMAL);  textSize(20);
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
    // 2-question button (top, centred)
    let b2x = cx, b2y = 300, b2w = 420, b2h = 120;
    if (getInputX()>b2x-b2w/2 && getInputX()<b2x+b2w/2 && getInputY()>b2y-b2h/2 && getInputY()<b2y+b2h/2) {
      playSoundOnce(clickSfx);  startShortQuiz();  return;
    }
    // 5-question button (bottom, centred)
    let b5x = cx, b5y = 460, b5w = 420, b5h = 120;
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
        score++;  feedbackMsg="CORRECT";  playSoundOnce(correctSfx);
      } else {
        feedbackMsg="INCORRECT";
        wrongAnswers.push({questionNum:currentQuestionIdx+1, yourAnswer:ch, correctAnswer:q.choices[q.correctIndex]});
        playSoundOnce(wrongSfx);
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

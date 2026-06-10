// main.js

// ===============================
// CONFIGURAÇÃO GERAL
// ===============================

const canvas = document.getElementById("game");
const restartButton = document.getElementById("restart-button");

const VIEW_WIDTH = window.innerWidth;
const VIEW_HEIGHT = window.innerHeight;

const MAP_WIDTH = 1024;
const MAP_HEIGHT = 768;

const REAL_PHOTO_WIDTH = 740;
const REAL_PHOTO_HEIGHT = 607;

const CHARACTER_SCALE = 0.65;

const DEBUG_MODE = false;

let bgMusic = null;
let musicStarted = false;
let endingMusic = null;

kaboom({
  canvas,
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  background: [23, 23, 29],
  global: true,
  debug: DEBUG_MODE,
});

debug.inspect = DEBUG_MODE;

document.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

restartButton.addEventListener("click", () => {
  window.location.reload();
});

// ===============================
// ASSETS
// ===============================

loadSprite("love-map", "assets/backgrounds/mapa_eu_te_amo.png");
loadSprite("vida-real", "assets/vida_real.png");
loadSprite("logo", "assets/logo.png");

loadSprite("girlfriend", "assets/sprites/girlfriend.png", {
  sliceX: 4,
  sliceY: 6,
  anims: {
    "walk-down": { from: 0, to: 3, loop: true, speed: 8 },
    "walk-up": { from: 4, to: 7, loop: true, speed: 8 },
    "walk-left": { from: 8, to: 11, loop: true, speed: 8 },
    "walk-right": { from: 12, to: 15, loop: true, speed: 8 },
    idle: { from: 16, to: 17, loop: true, speed: 2 },
    jump: { from: 20, to: 23, loop: false, speed: 12 },
  },
});

loadSprite("boyfriend", "assets/sprites/boyfriend.png", {
  sliceX: 4,
  sliceY: 6,
  anims: {
    "walk-down": { from: 0, to: 3, loop: true, speed: 8 },
    "walk-up": { from: 4, to: 7, loop: true, speed: 8 },
    "walk-left": { from: 8, to: 11, loop: true, speed: 8 },
    "walk-right": { from: 12, to: 15, loop: true, speed: 8 },
    idle: { from: 16, to: 17, loop: true, speed: 2 },
    proposal: { from: 20, to: 23, loop: false, speed: 7 },
  },
});

function startMusic() {
  if (musicStarted) return;

  musicStarted = true;

  bgMusic = new Audio("assets/music.mp3");

  bgMusic.loop = true;
  bgMusic.volume = 0.55;

  bgMusic.addEventListener("loadedmetadata", () => {
    bgMusic.currentTime = 15;

    bgMusic.play().catch((err) => {
      console.error(err);
    });
  });

  bgMusic.load();
}

function startEndingMusic() {
  if (endingMusic) return;

  endingMusic = new Audio("assets/music2.mp3");

  endingMusic.loop = true;
  endingMusic.volume = 0;

  endingMusic.load();

  endingMusic.addEventListener("canplaythrough", () => {
    endingMusic.play().catch(console.error);
  });

  // Fade in da nova música
  let fadeIn = setInterval(() => {
    if (endingMusic.volume >= 0.65) {
      endingMusic.volume = 0.65;
      clearInterval(fadeIn);
      return;
    }

    endingMusic.volume += 0.03;
  }, 100);

  // Fade out da música antiga
  if (bgMusic) {
    let fadeOut = setInterval(() => {
      if (bgMusic.volume <= 0.03) {
        bgMusic.pause();
        bgMusic.volume = 0;
        clearInterval(fadeOut);
        return;
      }

      bgMusic.volume -= 0.03;
    }, 100);
  }
}

// ===============================
// JOYSTICK
// ===============================

let joystickDir = vec2(0, 0);
let joystickActive = false;
let joystickPointerId = null;

let joystickBase = null;
let joystickKnob = null;

const JOYSTICK_RADIUS = 38;
const JOYSTICK_KNOB_RADIUS = 16;

// ===============================
// LETRAS
// ===============================

const phraseLetters = ["E", "U", "T", "E", "A", "M", "O"];
const collectedLetters = Array(phraseLetters.length).fill(false);

const letterSpots = [
  { letter: "E", index: 0, x: -390, y: -245 },
  { letter: "U", index: 1, x: -105, y: -270 },
  { letter: "T", index: 2, x: 235, y: -225 },
  { letter: "E", index: 3, x: 405, y: -35 },
  { letter: "A", index: 4, x: 215, y: 225 },
  { letter: "M", index: 5, x: -110, y: 250 },
  { letter: "O", index: 6, x: -390, y: 110 },
];

let progressText = null;
let helperText = null;

let hasFinishedGame = false;
let endingStarted = false;

// ===============================
// CENA PRINCIPAL
// ===============================

scene("game", () => {
  add([
    sprite("love-map"),
    pos(-MAP_WIDTH / 2, -MAP_HEIGHT / 2),
    anchor("topleft"),
    z(-20),
  ]);

  add([
    rect(MAP_WIDTH, MAP_HEIGHT),
    pos(-MAP_WIDTH / 2, -MAP_HEIGHT / 2),
    color(30, 42, 34),
    opacity(0.08),
    z(-19),
  ]);

  if (DEBUG_MODE) {
    add([
      rect(MAP_WIDTH, MAP_HEIGHT),
      pos(-MAP_WIDTH / 2, -MAP_HEIGHT / 2),
      outline(2, rgb(255, 255, 255)),
      z(50),
    ]);
  }

  const girlfriend = add([
    sprite("girlfriend", {
      anim: "idle",
    }),
    pos(0, 0),
    anchor("center"),
    scale(CHARACTER_SCALE),
    area({
      shape: new Rect(vec2(-18, -38), 36, 70),
    }),
    z(20),
    {
      speed: 115,
      direction: "down",
      isCollectJumping: false,
    },
  ]);

  camPos(girlfriend.pos);
  camScale(1);

  for (const spot of letterSpots) {
    createCollectibleLetter(spot);
  }

  createGameUI();
  createJoystickUI();

  girlfriend.onCollide("letter", (letterObject) => {
    collectLetter(letterObject, girlfriend);
  });

  onKeyPress("r", () => {
    window.location.reload();
  });

  onKeyPress("f", () => {
    debugCompleteLetters();
    startEnding(girlfriend);
  });

  onUpdate(() => {
    if (hasFinishedGame) return;

    const keyboardDir = getKeyboardDir();
    const finalDir = keyboardDir.len() > 0 ? keyboardDir : joystickDir;

    moveCharacter(girlfriend, finalDir);
    clampPlayerToMap(girlfriend);

    camPos(girlfriend.pos);
    clampCameraToMap();

    updateJoystickUI();
  });

  setupPointerControls();
});

// ===============================
// MOVIMENTO
// ===============================

function moveCharacter(character, dir) {
  if (character.isCollectJumping) return;

  let moving = false;

  if (dir.x < -0.2) {
    character.move(-character.speed, 0);
    character.direction = "left";
    moving = true;
  } else if (dir.x > 0.2) {
    character.move(character.speed, 0);
    character.direction = "right";
    moving = true;
  }

  if (dir.y < -0.2) {
    character.move(0, -character.speed);
    character.direction = "up";
    moving = true;
  } else if (dir.y > 0.2) {
    character.move(0, character.speed);
    character.direction = "down";
    moving = true;
  }

  const nextAnim = moving ? `walk-${character.direction}` : "idle";

  if (character.curAnim() !== nextAnim) {
    character.play(nextAnim);
  }
}

function getKeyboardDir() {
  const dir = vec2(0, 0);

  if (isKeyDown("left") || isKeyDown("a")) dir.x -= 1;
  if (isKeyDown("right") || isKeyDown("d")) dir.x += 1;
  if (isKeyDown("up") || isKeyDown("w")) dir.y -= 1;
  if (isKeyDown("down") || isKeyDown("s")) dir.y += 1;

  return dir.len() > 0 ? dir.unit() : dir;
}

function clampPlayerToMap(player) {
  const padding = 34;

  player.pos.x = clamp(
    player.pos.x,
    -MAP_WIDTH / 2 + padding,
    MAP_WIDTH / 2 - padding
  );

  player.pos.y = clamp(
    player.pos.y,
    -MAP_HEIGHT / 2 + padding,
    MAP_HEIGHT / 2 - padding
  );
}

function clampCameraToMap() {
  const currentCam = camPos();

  const halfW = width() / 2;
  const halfH = height() / 2;

  camPos(
    clamp(currentCam.x, -MAP_WIDTH / 2 + halfW, MAP_WIDTH / 2 - halfW),
    clamp(currentCam.y, -MAP_HEIGHT / 2 + halfH, MAP_HEIGHT / 2 - halfH)
  );
}

// ===============================
// LETRAS
// ===============================

function createCollectibleLetter({ letter, index, x, y }) {
  const container = add([
    pos(x, y),
    anchor("center"),
    area({
      shape: new Rect(vec2(-16, -16), 32, 32),
    }),
    z(15),
    "letter",
    {
      letter,
      index,
      collected: false,
      baseY: y,
    },
  ]);

  container.add([
    circle(18),
    color(255, 215, 238),
    opacity(0.94),
    outline(2, rgb(190, 65, 125)),
    anchor("center"),
    z(0),
  ]);

  container.add([
    text(letter, {
      size: 20,
      font: "sink",
    }),
    color(145, 35, 85),
    anchor("center"),
    pos(0, -1),
    z(1),
  ]);

  container.onUpdate(() => {
    if (container.collected) return;

    const floatY = Math.sin(time() * 3 + index) * 2;
    container.pos.y = container.baseY + floatY;
  });

  return container;
}

function collectLetter(letterObject, girlfriend) {
  if (letterObject.collected || endingStarted) return;

  letterObject.collected = true;
  collectedLetters[letterObject.index] = true;

  girlfriend.isCollectJumping = true;
  girlfriend.play("jump");

  wait(0.5, () => {
    girlfriend.isCollectJumping = false;

    if (!endingStarted && !hasFinishedGame) {
      girlfriend.play("idle");
    }
  });

  addCollectionEffect(letterObject.pos, letterObject.letter);
  destroy(letterObject);

  updateProgressText();

  if (collectedLetters.every(Boolean)) {
    wait(0.4, () => {
      startEnding(girlfriend);
    });
  }
}

function addCollectionEffect(position, letter) {
  const effect = add([
    text(`+ ${letter}`, {
      size: 16,
      font: "sink",
    }),
    pos(position.x, position.y - 18),
    anchor("center"),
    color(255, 245, 170),
    z(80),
    lifespan(0.75, {
      fade: 0.35,
    }),
  ]);

  tween(
    effect.pos.y,
    effect.pos.y - 26,
    0.75,
    (value) => {
      effect.pos.y = value;
    },
    easings.easeOutQuad
  );
}

// ===============================
// UI DO JOGO
// ===============================

function getResponsiveProgressSize() {
  return width() >= 900 ? 42 : 22;
}

function getResponsiveHelperSize() {
  return width() >= 900 ? 30 : 20;
}

function createGameUI() {
  progressText = add([
    text(getProgressPhrase(), {
      size: getResponsiveProgressSize(),
      font: "sink",
      align: "center",
    }),
    pos(width() / 2, width() >= 900 ? 34 : 24),
    anchor("center"),
    fixed(),
    color(255, 255, 255),
    z(1000),
  ]);

  helperText = add([
    text("Colete as letras espalhadas pelo mapa", {
      size: getResponsiveHelperSize(),
      font: "sink",
      align: "center",
    }),
    pos(width() / 2, width() >= 900 ? 82 : 54),
    anchor("center"),
    fixed(),
    color(255, 232, 246),
    z(1000),
  ]);
}

function getProgressPhrase() {
  const visible = phraseLetters.map((letter, index) => {
    return collectedLetters[index] ? letter : "━";
  });

  return `${visible[0]}${visible[1]}  ${visible[2]}${visible[3]}  ${visible[4]}${visible[5]}${visible[6]}`;
}

function updateProgressText() {
  progressText.text = getProgressPhrase();

  const amount = collectedLetters.filter(Boolean).length;
  helperText.text = `${amount}/7 letras encontradas`;
}

// ===============================
// FINAL COM BOYFRIEND
// ===============================

function walkTo(character, targetPos, animName, duration, onFinish, onStep) {
  character.play(animName);

  tween(
    character.pos,
    targetPos,
    duration,
    (value) => {
      character.pos = value;

      if (onStep) {
        onStep();
      }
    },
    easings.easeInOutQuad
  );

  wait(duration, () => {
    character.play("idle");

    if (onFinish) {
      onFinish();
    }
  });
}

function startEnding(girlfriend) {
  if (endingStarted) return;

  startEndingMusic();

  endingStarted = true;
  hasFinishedGame = true;

  joystickDir = vec2(0, 0);
  joystickActive = false;

  helperText.text = "Você completou a frase...";
  progressText.text = "EU TE AMO";

  girlfriend.play("idle");

  if (joystickBase) joystickBase.hidden = true;
  if (joystickKnob) joystickKnob.hidden = true;

  const spawnFromLeft = true;

  const startX = girlfriend.pos.x - width() / 2 - 120;
  const firstTargetX = girlfriend.pos.x - 42;

  const boyfriend = add([
    sprite("boyfriend", {
      anim: "walk-right",
    }),
    pos(startX, girlfriend.pos.y),
    anchor("center"),
    scale(CHARACTER_SCALE),
    z(21),
    {
      direction: "right",
    },
  ]);

  camPos(girlfriend.pos);
  clampCameraToMap();

  tween(
    boyfriend.pos.x,
    firstTargetX,
    1.35,
    (value) => {
      boyfriend.pos.x = value;
    },
    easings.easeOutQuad
  );

  wait(1.35, () => {
    boyfriend.play("idle");

    wait(0.45, () => {
      helperText.text = "Ele tinha algo pra te entregar...";

      const centerGirlPos = vec2(18, 0);
      const centerBoyPos = vec2(-18, 0);

      const girlAnim =
        girlfriend.pos.x > centerGirlPos.x ? "walk-left" : "walk-right";

      const boyAnim =
        boyfriend.pos.x > centerBoyPos.x ? "walk-left" : "walk-right";

      const updateCenterCamera = () => {
        const movingCenter = girlfriend.pos.add(boyfriend.pos).scale(0.5);
        camPos(movingCenter);
      };

      walkTo(girlfriend, centerGirlPos, girlAnim, 2.25, null, updateCenterCamera);

      walkTo(boyfriend, centerBoyPos, boyAnim, 2.25, () => {
        camPos(vec2(0, 0));

        girlfriend.stop();
        girlfriend.frame = 16;

        wait(1.15, () => {
          boyfriend.play("proposal");

          wait(1.65, () => {
            boyfriend.stop();
            boyfriend.frame = 23;

            girlfriend.stop();
            girlfriend.frame = 16;

            wait(1.1, () => {
              createLoveBurstBetween(girlfriend.pos, boyfriend.pos);

              wait(1.45, () => {
                helperText.hidden = true;
                focusCoupleEnding(girlfriend, boyfriend);
              });
            });
          });
        });
      }, updateCenterCamera);
    });
  });
}

function createLoveBurstBetween(girlPos, boyPos) {
  const center = girlPos.add(boyPos).scale(0.5);

  add([
    text("❤", {
      size: 36,
      font: "sink",
    }),
    pos(center.x, center.y - 58),
    anchor("center"),
    color(255, 80, 150),
    z(200),
    lifespan(1.4, {
      fade: 0.4,
    }),
  ]);

  for (let i = 0; i < 26; i++) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(18, 92);

    const start = vec2(
      center.x + Math.cos(angle) * 8,
      center.y - 38 + Math.sin(angle) * 8
    );

    const end = vec2(
      center.x + Math.cos(angle) * distance,
      center.y - 56 + Math.sin(angle) * distance
    );

    const heart = add([
      text("❤", {
        size: randi(10, 22),
        font: "sink",
      }),
      pos(start),
      anchor("center"),
      color(255, randi(70, 150), randi(130, 210)),
      z(201),
      lifespan(1.2, {
        fade: 0.45,
      }),
    ]);

    tween(
      heart.pos,
      end,
      rand(0.7, 1.25),
      (value) => {
        heart.pos = value;
      },
      easings.easeOutQuad
    );
  }
}

function focusCoupleEnding(girlfriend, boyfriend) {
  const isDesktop = width() >= 900;

  const finalZoom = isDesktop ? 2.85 : 1.85;

  const gap = isDesktop ? 56 : 14;

  const maxPanelByWidth = (width() - 48 - gap) / 2;
  const maxPanelByHeight = height() - (isDesktop ? 190 : 145);

  const panelSize = Math.floor(
    Math.min(
      isDesktop ? 320 : 145,
      maxPanelByWidth,
      maxPanelByHeight
    )
  );

  const photoW = panelSize;
  const photoH = panelSize;

  const totalW = panelSize * 2 + gap;

  const gameCenterScreenX = width() / 2 - totalW / 2 + photoW / 2;
  const photoCenterScreenX = width() / 2 + totalW / 2 - photoW / 2;

  const centerY = height() / 2 + (isDesktop ? 18 : 28);

  const photoPanel = {
    x: photoCenterScreenX - panelSize / 2,
    y: centerY - panelSize / 2,
    w: panelSize,
    h: panelSize,
  };

  const coupleCenter = girlfriend.pos.add(boyfriend.pos).scale(0.5);

  // Calcula a posição da câmera para que o casal apareça no lado esquerdo da tela,
  // em vez de ficar no centro.
  const targetCamX =
    coupleCenter.x + (width() / 2 - gameCenterScreenX) / finalZoom;

  const targetCamY =
    coupleCenter.y + (height() / 2 - centerY) / finalZoom;

  const targetCam = vec2(targetCamX, targetCamY);

  tween(
    camPos(),
    targetCam,
    2.25,
    (value) => {
      camPos(value);
    },
    easings.easeInOutQuad
  );

  tween(
    camScale(),
    vec2(finalZoom, finalZoom),
    2.25,
    (value) => {
      camScale(value);
    },
    easings.easeInOutQuad
  );

  const clearPadding = isDesktop ? 24 : 10;

  const clearArea = {
    x: gameCenterScreenX - panelSize / 2 - clearPadding,
    y: centerY - panelSize / 2 - clearPadding,
    w: panelSize + clearPadding * 2,
    h: panelSize + clearPadding * 2,
  };

  createDarkOverlayAroundRect(clearArea, 0.72, 2.25);

  createPhotoPanel(photoPanel);

  wait(2.55, () => {
    restartButton.classList.add("show");
  });
}

function createDarkOverlayAroundRect(clearArea, maxOpacity = 0.72, duration = 2.25) {
  const pieces = [
    // Parte de cima
    {
      x: 0,
      y: 0,
      w: width(),
      h: clearArea.y,
    },

    // Parte de baixo
    {
      x: 0,
      y: clearArea.y + clearArea.h,
      w: width(),
      h: height() - (clearArea.y + clearArea.h),
    },

    // Parte esquerda
    {
      x: 0,
      y: clearArea.y,
      w: clearArea.x,
      h: clearArea.h,
    },

    // Parte direita
    {
      x: clearArea.x + clearArea.w,
      y: clearArea.y,
      w: width() - (clearArea.x + clearArea.w),
      h: clearArea.h,
    },
  ];

  for (const piece of pieces) {
    if (piece.w <= 0 || piece.h <= 0) continue;

    const darkPiece = add([
      rect(piece.w, piece.h),
      pos(piece.x, piece.y),
      fixed(),
      color(0, 0, 0),
      opacity(0),
      z(600),
    ]);

    tween(
      0,
      maxOpacity,
      duration,
      (value) => {
        darkPiece.opacity = value;
      },
      easings.easeInOutQuad
    );
  }
}

function createPhotoPanel(photoPanel) {
  add([
    rect(photoPanel.w, photoPanel.h),
    pos(photoPanel.x, photoPanel.y),
    fixed(),
    color(12, 12, 16),
    z(700),
  ]);

  addPanelBorder(photoPanel.x, photoPanel.y, photoPanel.w, photoPanel.h);

  add([
    sprite("vida-real"),
    pos(photoPanel.x + photoPanel.w / 2, photoPanel.y + photoPanel.h / 2),
    anchor("center"),
    fixed(),
    scale(getContainPhotoScale(photoPanel.w, photoPanel.h)),
    z(701),
  ]);
}

function addPanelBorder(x, y, w, h) {
  const border = 3;
  const borderColor = rgb(255, 235, 245);

  add([
    rect(w, border),
    pos(x, y),
    fixed(),
    color(borderColor),
    z(702),
  ]);

  add([
    rect(w, border),
    pos(x, y + h - border),
    fixed(),
    color(borderColor),
    z(702),
  ]);

  add([
    rect(border, h),
    pos(x, y),
    fixed(),
    color(borderColor),
    z(702),
  ]);

  add([
    rect(border, h),
    pos(x + w - border, y),
    fixed(),
    color(borderColor),
    z(702),
  ]);
}

function createDarkOverlayAroundPanels(gamePanel, photoPanel) {
  const darknessOpacity = 0.9;

  const leftClear = gamePanel.x;
  const rightClear = photoPanel.x + photoPanel.w;
  const topClear = Math.min(gamePanel.y, photoPanel.y);
  const bottomClear = Math.max(
    gamePanel.y + gamePanel.h,
    photoPanel.y + photoPanel.h
  );

  const darkPieces = [
    {
      x: 0,
      y: 0,
      w: width(),
      h: topClear,
    },
    {
      x: 0,
      y: bottomClear,
      w: width(),
      h: height() - bottomClear,
    },
    {
      x: 0,
      y: topClear,
      w: leftClear,
      h: bottomClear - topClear,
    },
    {
      x: gamePanel.x + gamePanel.w,
      y: topClear,
      w: photoPanel.x - (gamePanel.x + gamePanel.w),
      h: bottomClear - topClear,
    },
    {
      x: rightClear,
      y: topClear,
      w: width() - rightClear,
      h: bottomClear - topClear,
    },
  ];

  for (const piece of darkPieces) {
    if (piece.w <= 0 || piece.h <= 0) continue;

    const dark = add([
      rect(piece.w, piece.h),
      pos(piece.x, piece.y),
      fixed(),
      color(0, 0, 0),
      opacity(0),
      z(650),
    ]);

    tween(
      0,
      darknessOpacity,
      2.35,
      (value) => {
        dark.opacity = value;
      },
      easings.easeInOutQuad
    );
  }
}

function getContainPhotoScale(panelW, panelH) {
  const padding = 5;

  const availableW = panelW - padding * 2;
  const availableH = panelH - padding * 2;

  const scaleX = availableW / REAL_PHOTO_WIDTH;
  const scaleY = availableH / REAL_PHOTO_HEIGHT;

  return Math.min(scaleX, scaleY);
}

function fadeToBlack() {
  const fade = add([
    rect(width(), height()),
    pos(0, 0),
    fixed(),
    color(0, 0, 0),
    opacity(0),
    z(500),
  ]);

  tween(
    0,
    1,
    1.8,
    (value) => {
      fade.opacity = value;
    },
    easings.easeInOutQuad
  );

  wait(1.85, () => {
    restartButton.classList.add("show");
  });
}

// ===============================
// JOYSTICK VISUAL
// ===============================

function joystickCenter() {
  return vec2(120, height() - 130);
}

function createJoystickUI() {
  joystickBase = add([
    circle(JOYSTICK_RADIUS),
    pos(joystickCenter()),
    color(120, 120, 120),
    opacity(0.35),
    outline(2, rgb(210, 210, 210)),
    fixed(),
    z(1000),
  ]);

  joystickKnob = add([
    circle(JOYSTICK_KNOB_RADIUS),
    pos(joystickCenter()),
    color(235, 235, 235),
    opacity(0.78),
    fixed(),
    z(1001),
  ]);
}

function updateJoystickUI() {
  if (!joystickBase || !joystickKnob) return;

  joystickBase.pos = joystickCenter();

  if (!joystickActive) {
    joystickKnob.pos = joystickCenter();
  }
}

// ===============================
// POINTER CONTROLS
// ===============================

function setupPointerControls() {
  canvas.addEventListener("pointerdown", (event) => {
    if (hasFinishedGame) return;

    const screenPos = pointerEventToGamePos(event);

    if (!isInsideJoystick(screenPos)) return;

    joystickActive = true;
    joystickPointerId = event.pointerId;

    canvas.setPointerCapture(event.pointerId);
    updateJoystickFromScreenPos(screenPos);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!joystickActive) return;
    if (event.pointerId !== joystickPointerId) return;

    const screenPos = pointerEventToGamePos(event);
    updateJoystickFromScreenPos(screenPos);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== joystickPointerId) return;
    stopJoystick();
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== joystickPointerId) return;
    stopJoystick();
  });
}

function pointerEventToGamePos(event) {
  const rect = canvas.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * width();
  const y = ((event.clientY - rect.top) / rect.height) * height();

  return vec2(x, y);
}

function isInsideJoystick(screenPos) {
  return screenPos.dist(joystickCenter()) <= 78;
}

function updateJoystickFromScreenPos(screenPos) {
  const center = joystickCenter();

  let delta = screenPos.sub(center);

  if (delta.len() > JOYSTICK_RADIUS) {
    delta = delta.unit().scale(JOYSTICK_RADIUS);
  }

  joystickKnob.pos = center.add(delta);

  joystickDir = delta.len() > 4
    ? delta.scale(1 / JOYSTICK_RADIUS)
    : vec2(0, 0);
}

function stopJoystick() {
  joystickActive = false;
  joystickPointerId = null;
  joystickDir = vec2(0, 0);

  if (joystickKnob) {
    joystickKnob.pos = joystickCenter();
  }
}

function debugCompleteLetters() {
  for (let i = 0; i < collectedLetters.length; i++) {
    collectedLetters[i] = true;
  }

  if (progressText) {
    updateProgressText();
  }
}

function startIntro() {
  const overlay = add([
    rect(width(), height()),
    pos(0, 0),
    fixed(),
    color(0, 0, 0),
    z(5000),
  ]);

  const tapText = add([
    text("Toque para iniciar ❤", {
      size: width() >= 900 ? 30 : 18,
      font: "sink",
      align: "center",
    }),
    pos(width() / 2, height() / 2),
    anchor("center"),
    fixed(),
    color(255, 255, 255),
    opacity(1),
    z(5001),
  ]);

  let introStarted = false;

  const beginIntroSequence = () => {
    if (introStarted) return;
    introStarted = true;

    startMusic();

    tween(
      tapText.opacity,
      0,
      0.7,
      (value) => {
        tapText.opacity = value;
      },
      easings.easeInOutQuad
    );

    wait(0.75, () => {
      destroy(tapText);
      showCreditsAndLogo(overlay);
    });
  };

  onClick(beginIntroSequence);
  onTouchStart(beginIntroSequence);
}

function showCreditsAndLogo(overlay) {
  const creditText = add([
    text("Feito com muito amor pelo seu neném", {
      size: width() >= 900 ? 28 : 18,
      font: "sink",
      align: "center",
    }),
    pos(width() / 2, height() / 2),
    anchor("center"),
    fixed(),
    color(255, 255, 255),
    opacity(0),
    z(5001),
  ]);

  tween(0, 1, 1.2, (value) => {
    creditText.opacity = value;
  }, easings.easeInOutQuad);

  wait(3, () => {
    tween(1, 0, 1, (value) => {
      creditText.opacity = value;
    }, easings.easeInOutQuad);
  });

  wait(4.2, () => {
    destroy(creditText);

    const maxLogoSize = width() >= 900 ? 500 : width() * 0.65;
    const logoScale = maxLogoSize / 500;

    const logo = add([
      sprite("logo"),
      pos(width() / 2, height() / 2),
      anchor("center"),
      fixed(),
      scale(logoScale),
      opacity(0),
      z(5001),
    ]);

    tween(0, 1, 1, (value) => {
      logo.opacity = value;
    }, easings.easeInOutQuad);

    wait(5, () => {
      tween(1, 0, 1, (value) => {
        logo.opacity = value;
      }, easings.easeInOutQuad);

      wait(1.1, () => {
        destroy(logo);

        tween(1, 0, 1, (value) => {
          overlay.opacity = value;
        }, easings.easeInOutQuad);

        wait(1, () => {
          destroy(overlay);
          go("game");
        });
      });
    });
  });
}

// ===============================
// INÍCIO
// ===============================

startIntro();
const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const audio = document.getElementById("my-audio");
const playAudioBtn = document.getElementById("play-audio-btn");
const startOverlay = document.getElementById("start-overlay");

const lyricText = `
    [00:00.00]Why do I pull you close?
    [00:02.55]And then ask you for space
    [00:05.40]If all it is is eight letters
    [00:07.00]Why is it so hard to say?
    [00:10.50]If all it is is eight letters
    [00:12.20]When I close my eyes
    [00:15.40]It's you there in my mind (it's only you)
    [00:18.20]When I close my eyes
    [00:21.00]If all it is is eight letters
    [00:23.50]When I close my eyes
    [00:26.30]It's you there in my mind (you)
    [00:28.50]When I close my eyes
    [00:32.00]If all it is is eight letters
    `;

function parseLyricLines(text) {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^\s*\[(\d{2}):(\d{2}(?:\.\d{1,2})?)\](.*)$/);
      if (!match) {
        return "";
      }
      return match[3].trim();
    })
    .filter(Boolean);
}

function parseTimedLyrics(text) {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^\s*\[(\d{2}):(\d{2}(?:\.\d{1,2})?)\](.*)$/);
      if (!match) {
        return null;
      }

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);

      return {
        timestamp: minutes * 60 + seconds,
        content: match[3].trim(),
      };
    })
    .filter(Boolean);
}

const lyricLines = parseLyricLines(lyricText);
const timedLyrics = parseTimedLyrics(lyricText);
const lyricAnimationClasses = [
  "fx-rise",
  "fx-pop",
  "fx-slide-left",
  "fx-slide-right",
  "fx-blur",
  "fx-tilt",
  "fx-globe",
  "fx-flip",
  "fx-tumble",
  "fx-orbit",
];
const photoEmoteAnimations = [
  "photoEmoteFloat",
  "photoEmoteDrift",
  "photoEmotePulse",
  "photoEmoteWobble",
];
const reactionGroups = {
  love: ["💗", "💕", "💖", "💘", "💞"],
  sparkle: ["✨", "💫", "⭐", "🌟"],
  soft: ["🌸", "🫧", "🦋", "🌈"],
  fun: ["🎵", "🎶", "🔥", "⚡"],
};
const reactionGroupNames = Object.keys(reactionGroups);
const lyricPhotoPool = [
  "assets/photos/photo01.jpg",
  "assets/photos/photo02.jpg",
  "assets/photos/photo03.jpg",
  "assets/photos/photo04.jpg",
  "assets/photos/photo05.jpg",
];

const zoomOptions = [1.2, 1.5, 2];
const lyricLeadSeconds = 0.1;

let worldWidth = 0;
let worldHeight = 0;
let lyricItems = [];
let lyricAnchors = [];
let currentCamera = { x: 0, y: 0, scale: 1 };
let activeLyricIndex = -1;
let cameraRafId = 0;
let syncRafId = 0;
let audioStarted = false;
let lastSyncedLyricIndex = -1;
let cameraSequenceToken = 0;
let lastReactionGroup = "";

function pickReactionSymbol() {
  let groupName =
    reactionGroupNames[Math.floor(Math.random() * reactionGroupNames.length)];

  // Avoid same group too often so particles feel more varied.
  if (groupName === lastReactionGroup && Math.random() < 0.75) {
    const alternatives = reactionGroupNames.filter((name) => name !== lastReactionGroup);
    groupName = alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  lastReactionGroup = groupName;
  const symbols = reactionGroups[groupName];
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function decoratePhotoCard(index) {
  lyricItems.forEach((item) => {
    item.querySelectorAll(".photo-emote").forEach((emote) => emote.remove());
  });

  const item = lyricItems[index];
  if (!item || !item.classList.contains("has-photo")) {
    return;
  }

  const cornerAnchors = [
    { x: -4, y: -4 },
    { x: 104, y: -4 },
    { x: -4, y: 104 },
    { x: 104, y: 104 },
  ];

  const emoteCount = Math.floor(randomBetween(4, 10));
  const shuffledCorners = [...cornerAnchors].sort(() => Math.random() - 0.5);
  const placedPoints = [];
  const minGap = 3.4;

  for (let i = 0; i < emoteCount; i += 1) {
    const anchor = shuffledCorners[i % shuffledCorners.length];
    let x = anchor.x + randomBetween(-2.8, 2.8);
    let y = anchor.y + randomBetween(-2.8, 2.8);
    let tries = 0;

    while (tries < 70) {
      const overlap = placedPoints.some((point) => {
        const dx = x - point.x;
        const dy = y - point.y;
        return Math.hypot(dx, dy) < minGap;
      });

      if (!overlap) {
        break;
      }

      x = anchor.x + randomBetween(-2.8, 2.8);
      y = anchor.y + randomBetween(-2.8, 2.8);
      tries += 1;
    }

    const emote = document.createElement("span");
    placedPoints.push({ x, y });

    emote.className = "photo-emote";
    emote.textContent = pickReactionSymbol();
    emote.style.setProperty("--size", `${randomBetween(25, 50).toFixed(0)}px`);
    emote.style.setProperty("--float-dur", `${randomBetween(1800, 2800).toFixed(0)}ms`);
    emote.style.setProperty("--delay", `${randomBetween(0, 220).toFixed(0)}ms`);
    emote.style.setProperty("--x", `${x.toFixed(2)}%`);
    emote.style.setProperty("--y", `${y.toFixed(2)}%`);
    emote.style.setProperty("--rot", `${randomBetween(-18, 18).toFixed(1)}deg`);
    emote.style.setProperty("--scale", `${randomBetween(0.82, 1.18).toFixed(2)}`);
    emote.style.setProperty(
      "--anim-name",
      photoEmoteAnimations[
        Math.floor(Math.random() * photoEmoteAnimations.length)
      ],
    );
    emote.style.opacity = randomBetween(0.78, 1).toFixed(2);
    emote.style.zIndex = `${3 + Math.floor(randomBetween(0, 8))}`;

    item.appendChild(emote);
  }
}

function startAudio() {
  if (!audio) {
    return;
  }

  if (audioStarted && audio.paused) {
    audio.play();
    return;
  }

  if (audioStarted) {
    return;
  }

  audio.volume = 1;
  audio
    .play()
    .then(() => {
      audioStarted = true;
      startMusicSyncedCamera();
      if (playAudioBtn) {
        playAudioBtn.textContent = "Music Playing";
        playAudioBtn.disabled = true;
      }
    })
    .catch(() => {
      if (playAudioBtn) {
        playAudioBtn.textContent = "Tap To Play";
      }
    });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createWorldSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  worldWidth = Math.max(vw * 2.7, 1800);
  worldHeight = Math.max(vh * 2.5, 1400);
  world.style.width = `${worldWidth}px`;
  world.style.height = `${worldHeight}px`;
}

function splitLyricToFragments(line) {
  const words = line.split(/\s+/).filter(Boolean);
  const fragments = [];
  let pointer = 0;

  while (pointer < words.length) {
    const remain = words.length - pointer;
    const chunkSize =
      remain <= 2 ? remain : Math.random() < 0.58 ? 2 : 1;
    fragments.push(words.slice(pointer, pointer + chunkSize).join(" "));
    pointer += chunkSize;
  }

  return fragments;
}

function buildFragmentModeCard(item, line, isMobile) {
  const fragments = splitLyricToFragments(line);
  const placed = [];
  const minGapX = isMobile ? 24 : 26;
  const minGapY = isMobile ? 18 : 20;

  item.classList.add("word-mode");
  item.style.setProperty(
    "--fragment-h",
    `${(isMobile ? randomBetween(230, 320) : randomBetween(300, 420)).toFixed(0)}px`,
  );

  fragments.forEach((fragment) => {
    const span = document.createElement("span");
    span.className = "lyric-word lyric-fragment";
    span.textContent = fragment;

    let x = randomBetween(16, 84);
    let y = randomBetween(16, 84);
    let attempts = 0;

    while (attempts < 120) {
      const conflict = placed.some((point) => {
        return (
          Math.abs(x - point.x) < minGapX &&
          Math.abs(y - point.y) < minGapY
        );
      });

      if (!conflict) {
        break;
      }

      x = randomBetween(16, 84);
      y = randomBetween(16, 84);
      attempts += 1;
    }

    span.style.left = `${x.toFixed(2)}%`;
    span.style.top = `${y.toFixed(2)}%`;
    placed.push({ x, y });
    item.appendChild(span);
  });
}

function createFixedLyricLayout() {
  world.innerHTML = "";
  lyricItems = [];
  lyricAnchors = [];

  const wordModeCount = Math.min(
    Math.max(3, Math.floor(lyricLines.length * 0.35)),
    lyricLines.length,
  );
  const wordModeIndices = new Set(
    [...Array(lyricLines.length).keys()]
      .sort(() => Math.random() - 0.5)
      .slice(0, wordModeCount),
  );

  const wordModeIndexList = [...wordModeIndices];
  const photoCount = Math.min(5, wordModeIndexList.length, lyricPhotoPool.length);
  const lyricIndices = [...wordModeIndexList]
    .sort(() => Math.random() - 0.5)
    .slice(0, photoCount);
  const indicesWithPhoto = new Set(lyricIndices);
  const shuffledPhotos = [...lyricPhotoPool]
    .sort(() => Math.random() - 0.5)
    .slice(0, photoCount);
  let photoPointer = 0;

  const isMobile = window.innerWidth < 768;
  const marginX = isMobile ? 0.16 : 0.14;
  const marginY = isMobile ? 0.18 : 0.16;
  const minGapX = isMobile ? 0.13 : 0.15;
  const minGapY = isMobile ? 0.11 : 0.13;

  lyricLines.forEach((line, lyricIndex) => {
    let nx = randomBetween(marginX, 1 - marginX);
    let ny = randomBetween(marginY, 1 - marginY);
    let attempts = 0;

    while (attempts < 160) {
      const tooClose = lyricAnchors.some((anchor) => {
        return (
          Math.abs(nx - anchor.nx) < minGapX &&
          Math.abs(ny - anchor.ny) < minGapY
        );
      });

      if (!tooClose) {
        break;
      }

      nx = randomBetween(marginX, 1 - marginX);
      ny = randomBetween(marginY, 1 - marginY);
      attempts += 1;
    }

    const item = document.createElement("article");
    item.className = "lyric-item";
    if (wordModeIndices.has(lyricIndex)) {
      buildFragmentModeCard(item, line, isMobile);
    } else {
      item.textContent = line;
    }
    item.style.left = `${(nx * 100).toFixed(2)}%`;
    item.style.top = `${(ny * 100).toFixed(2)}%`;
    const frameWidth = isMobile
      ? randomBetween(220, 360)
      : randomBetween(300, 560);
    const frameHeight = isMobile
      ? randomBetween(150, 240)
      : randomBetween(200, 360);
    item.style.setProperty("--photo-w", `${frameWidth.toFixed(0)}px`);
    item.style.setProperty("--photo-h", `${frameHeight.toFixed(0)}px`);
    if (indicesWithPhoto.has(lyricIndex)) {
      const photoUrl = shuffledPhotos[photoPointer % shuffledPhotos.length];
      item.classList.add("has-photo");
      item.classList.remove("no-photo");
      item.style.backgroundImage =
        `linear-gradient(180deg, rgba(5, 8, 16, 0.35) 0%, rgba(5, 8, 16, 0.78) 100%), url(${photoUrl})`;
      photoPointer += 1;
    } else {
      item.classList.add("no-photo");
      item.classList.remove("has-photo");
      item.style.backgroundImage = "none";
    }

    world.appendChild(item);
    lyricItems.push(item);
    lyricAnchors.push({ nx, ny });
  });
}

function setActiveLyric(index) {
  const nextItem = lyricItems[index];

  if (activeLyricIndex >= 0) {
    const prevItem = lyricItems[activeLyricIndex];
    prevItem.classList.remove("is-active", ...lyricAnimationClasses);
  }

  nextItem.classList.remove(...lyricAnimationClasses);
  nextItem.classList.add("is-active");

  nextItem.style.setProperty("--anim-dur", `${randomBetween(650, 1200).toFixed(0)}ms`);
  nextItem.style.setProperty("--spin-start", `${randomBetween(-540, 540).toFixed(0)}deg`);
  nextItem.style.setProperty("--tilt-start", `${randomBetween(-24, 24).toFixed(1)}deg`);
  nextItem.style.setProperty("--slide-shift", `${randomBetween(24, 56).toFixed(0)}px`);
  nextItem.style.setProperty("--zoom-start", `${randomBetween(0.66, 0.9).toFixed(2)}`);
  const globeDirection = Math.random() < 0.5 ? -1 : 1;
  const globeTurns = Math.floor(randomBetween(1, 3));
  nextItem.style.setProperty("--globe-spin", `${globeDirection * globeTurns * 360}deg`);
  nextItem.style.setProperty("--ultra-x", `${randomBetween(1.28, 1.58).toFixed(2)}`);
  nextItem.style.setProperty("--ultra-y", `${randomBetween(0.58, 0.82).toFixed(2)}`);
  nextItem.style.setProperty("--globe-tilt", `${randomBetween(10, 22).toFixed(1)}deg`);

  nextItem.offsetHeight;

  const randomClass =
    lyricAnimationClasses[
      Math.floor(Math.random() * lyricAnimationClasses.length)
    ];
  nextItem.classList.add(randomClass);
  decoratePhotoCard(index);

  activeLyricIndex = index;
}

function calculateCameraTarget(index, scale) {
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const anchor = lyricAnchors[index];
  const targetX = anchor.nx * worldWidth;
  const targetY = anchor.ny * worldHeight;

  let tx = vw / 2 - targetX * scale;
  let ty = vh / 2 - targetY * scale;

  const minTx = vw - worldWidth * scale;
  const minTy = vh - worldHeight * scale;

  tx = clamp(tx, minTx, 0);
  ty = clamp(ty, minTy, 0);

  return { x: tx, y: ty, scale };
}

function calculateCameraTargetByPoint(worldX, worldY, scale) {
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;

  let tx = vw / 2 - worldX * scale;
  let ty = vh / 2 - worldY * scale;

  const minTx = vw - worldWidth * scale;
  const minTy = vh - worldHeight * scale;

  tx = clamp(tx, minTx, 0);
  ty = clamp(ty, minTy, 0);

  return { x: tx, y: ty, scale };
}

function getWorldPointFromElement(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (centerX - currentCamera.x) / currentCamera.scale,
    y: (centerY - currentCamera.y) / currentCamera.scale,
  };
}

function runWordFocusSequence(lyricIndex, totalDuration, sequenceToken) {
  const item = lyricItems[lyricIndex];
  const wordEls = Array.from(item.querySelectorAll(".lyric-word"));

  if (wordEls.length < 2) {
    return false;
  }

  const lyricZoomOut = calculateCameraTarget(lyricIndex, 1.08);
  const introDuration = clamp(totalDuration * 0.18, 220, 700);
  const perWordDuration = clamp((totalDuration * 0.82) / wordEls.length, 180, 520);

  animateCamera(currentCamera, lyricZoomOut, introDuration, () => {
    if (sequenceToken !== cameraSequenceToken) {
      return;
    }

    world.classList.remove("is-moving");
    world.classList.add("has-active");

    const focusWordAt = (wordIndex) => {
      if (sequenceToken !== cameraSequenceToken || wordIndex >= wordEls.length) {
        return;
      }

      const worldPoint = getWorldPointFromElement(wordEls[wordIndex]);
      const targetZoom = window.innerWidth < 768 ? 1.85 : 2.05;
      const wordTarget = calculateCameraTargetByPoint(worldPoint.x, worldPoint.y, targetZoom);

      animateCamera(currentCamera, wordTarget, perWordDuration, () => {
        focusWordAt(wordIndex + 1);
      });
    };

    focusWordAt(0);
  });

  return true;
}

function applyCameraTransform(camera) {
  world.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`;
}

function animateCamera(from, to, durationMs, done) {
  const start = performance.now();

  const frame = (now) => {
    const elapsed = now - start;
    const t = clamp(elapsed / durationMs, 0, 1);
    const eased = easeInOutCubic(t);

    currentCamera = {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      scale: from.scale + (to.scale - from.scale) * eased,
    };

    applyCameraTransform(currentCamera);

    if (t < 1) {
      cameraRafId = requestAnimationFrame(frame);
      return;
    }

    if (typeof done === "function") {
      done();
    }
  };

  cancelAnimationFrame(cameraRafId);
  cameraRafId = requestAnimationFrame(frame);
}

function moveToLyricByIndex(index) {
  cameraSequenceToken += 1;
  const sequenceToken = cameraSequenceToken;
  world.classList.add("is-moving");
  world.classList.remove("has-active");

  const zoom = zoomOptions[index % zoomOptions.length];
  const zoomOut = Math.max(1.05, zoom - 0.35);
  const nextTimestamp =
    index < timedLyrics.length - 1 ? timedLyrics[index + 1].timestamp : null;
  const currentTimestamp = timedLyrics[index]?.timestamp ?? 0;
  const gapToNext = nextTimestamp ? Math.max(0.6, nextTimestamp - currentTimestamp) : 2.6;
  const totalDuration = clamp(gapToNext * 1000 * 0.88, 900, 3400);
  const phaseOneDuration = clamp(totalDuration * 0.28, 280, 1100);
  const phaseTwoDuration = clamp(totalDuration * 0.72, 620, 2300);

  setActiveLyric(index);

  if (runWordFocusSequence(index, totalDuration, sequenceToken)) {
    return;
  }

  const zoomOutTarget = calculateCameraTarget(index, zoomOut);
  const zoomInTarget = calculateCameraTarget(index, zoom);

  animateCamera(currentCamera, zoomOutTarget, phaseOneDuration, () => {
    world.classList.remove("is-moving");
    world.classList.add("has-active");
    animateCamera(zoomOutTarget, zoomInTarget, phaseTwoDuration);
  });
}

function getLyricIndexByAudioTime(currentTime) {
  const elapsed = currentTime + lyricLeadSeconds;
  let index = -1;

  for (let i = 0; i < timedLyrics.length; i += 1) {
    if (elapsed >= timedLyrics[i].timestamp) {
      index = i;
    } else {
      break;
    }
  }

  return index;
}

function startMusicSyncedCamera() {
  if (!timedLyrics.length) {
    return;
  }

  const syncFrame = () => {
    const nextIndex = getLyricIndexByAudioTime(audio.currentTime);

    if (nextIndex >= 0 && nextIndex !== lastSyncedLyricIndex) {
      moveToLyricByIndex(nextIndex);
      lastSyncedLyricIndex = nextIndex;
    }

    if (!audio.paused && !audio.ended) {
      syncRafId = requestAnimationFrame(syncFrame);
    }
  };

  cancelAnimationFrame(syncRafId);
  syncRafId = requestAnimationFrame(syncFrame);
}

function fitCameraToCenter() {
  const initialTarget = calculateCameraTarget(0, 1.15);
  currentCamera = initialTarget;
  applyCameraTransform(currentCamera);
}

function setupScene() {
  createWorldSize();
  createFixedLyricLayout();
  fitCameraToCenter();
}

if (playAudioBtn) {
  playAudioBtn.addEventListener("click", () => {
    if (startOverlay) {
      startOverlay.classList.add("is-hidden");
    }
    startAudio();
  });
}

if (audio) {
  audio.addEventListener("play", () => {
    startMusicSyncedCamera();
  });

  audio.addEventListener("pause", () => {
    cancelAnimationFrame(syncRafId);
  });

  audio.addEventListener("ended", () => {
    cancelAnimationFrame(syncRafId);
    lastSyncedLyricIndex = -1;
  });
}

window.addEventListener("resize", () => {
  createWorldSize();

  lyricItems.forEach((item, index) => {
    item.style.left = `${(lyricAnchors[index].nx * 100).toFixed(2)}%`;
    item.style.top = `${(lyricAnchors[index].ny * 100).toFixed(2)}%`;
  });

  const focusIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
  currentCamera = calculateCameraTarget(focusIndex, currentCamera.scale);
  applyCameraTransform(currentCamera);
});

setupScene();
(function () {
  "use strict";

  var DRAW_SECONDS = 5;
  var CANVAS_W = 320;
  var CANVAS_H = 400;

  var PROMPTS = [
    "A shark riding a bicycle",
    "A penguin baking a pizza",
    "An astronaut watering a cactus",
    "A dragon stuck in a traffic jam",
    "A robot having a picnic",
    "A cat wearing a top hat on a skateboard",
    "A whale in a bathtub",
    "A T-Rex playing the violin",
    "A UFO stealing a taco",
    "A banana on trial in court",
    "A snowman sunbathing",
    "A octopus doing karate",
    "A giraffe in a submarine",
    "A toaster fighting a blender",
    "A wizard at the gym",
    "A hedgehog as a DJ",
    "A potato running a marathon",
    "A ghost learning to ride a bike",
    "A cactus hugging a balloon",
    "A knight ordering coffee",
    "A snail winning a race",
    "A panda on a roller coaster",
    "A fish walking a dog",
    "A volcano with sunglasses",
    "A moon eating cheese",
    "A tree playing video games",
    "A clock arguing with a calendar",
    "A cloud wearing sneakers",
    "A dinosaur in a tutu",
    "A lamp having an existential crisis",
    "A muffin lifting weights",
    "A pirate on a scooter",
    "A elephant in a phone booth",
    "A bee filing taxes",
    "A rock band of vegetables",
    "A helicopter made of spaghetti",
    "A ninja making a sandwich",
    "A frog on the moon",
    "A suitcase full of ducks",
    "A volcano spa day"
  ];

  var cfg = window.__SKETCH_DUEL_CONFIG || { useFirebase: false, firebase: {} };
  var db = null;
  var unsub = null;
  var localMode = false;
  var localState = null;
  var currentGameId = null;
  var timerId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.remove("active");
    });
    var el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  function randomPrompt() {
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }

  function randomGameId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var s = "";
    for (var i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function getCreatedCodes() {
    try {
      return JSON.parse(sessionStorage.getItem("sketchDuel_created") || "[]");
    } catch (e) {
      return [];
    }
  }

  function addCreatedCode(code) {
    var a = getCreatedCodes();
    if (a.indexOf(code) === -1) {
      a.push(code);
      sessionStorage.setItem("sketchDuel_created", JSON.stringify(a));
    }
  }

  function isCreatorOf(code) {
    return getCreatedCodes().indexOf(code) !== -1;
  }

  function initFirebase() {
    if (!cfg.useFirebase || !cfg.firebase || !cfg.firebase.apiKey || cfg.firebase.apiKey.indexOf("YOUR_") === 0) {
      return false;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg.firebase);
      }
      db = firebase.firestore();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function setFirebaseStatus() {
    var el = $("firebase-status");
    if (!el) return;
    if (initFirebase()) {
      el.textContent = "Online mode: games sync with Firebase.";
      el.className = "hint firebase-hint ok";
    } else {
      el.textContent = "Local mode: use “Local demo” or add Firebase in js/config.js for friends online.";
      el.className = "hint firebase-hint warn";
    }
  }

  function normalizePoint(clientX, clientY, canvas) {
    var r = canvas.getBoundingClientRect();
    var x = (clientX - r.left) / r.width;
    var y = (clientY - r.top) / r.height;
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function setupCanvasDrawing(canvas, options) {
    options = options || {};
    var readOnly = options.readOnly;
    var color = options.color || "#ffffff";
    var lineWidth = options.lineWidth || 2.5;
    var onStrokeChange = options.onStrokeChange;
    var baseSegmentCount = 0;
    var baseStrokeColor = "#ffffff";

    var strokes = [];
    var drawing = false;
    var current = [];

    function resizeCanvas() {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      redraw();
    }

    function drawStrokeList(ctx, list, col, lw) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (var s = 0; s < list.length; s++) {
        var seg = list[s];
        if (seg.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(seg[0].x * CANVAS_W, seg[0].y * CANVAS_H);
        for (var i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x * CANVAS_W, seg[i].y * CANVAS_H);
        }
        ctx.stroke();
      }
    }

    function redraw() {
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (var s = 0; s < strokes.length; s++) {
        var col = s < baseSegmentCount ? baseStrokeColor : color;
        drawStrokeList(ctx, [strokes[s]], col, lineWidth);
      }
      drawStrokeList(ctx, current, color, lineWidth);
    }

    function pushPoint(x, y) {
      var p = normalizePoint(x, y, canvas);
      if (!current.length) {
        current.push([p]);
        strokes.push(current[0]);
      } else {
        current[0].push(p);
      }
      if (onStrokeChange) onStrokeChange(serializeStrokes(strokes));
      redraw();
    }

    function endStroke() {
      current = [];
      if (onStrokeChange) onStrokeChange(serializeStrokes(strokes));
    }

    function serializeStrokes(list) {
      return list.map(function (seg) {
        return seg.map(function (pt) {
          return { x: pt.x, y: pt.y };
        });
      });
    }

    function loadStrokes(data, bc) {
      strokes = [];
      baseSegmentCount = 0;
      if (!data || !data.length) {
        redraw();
        return;
      }
      baseStrokeColor = bc || "#ffffff";
      baseSegmentCount = data.length;
      for (var i = 0; i < data.length; i++) {
        var seg = data[i].map(function (p) {
          return { x: p.x, y: p.y };
        });
        strokes.push(seg);
      }
      redraw();
    }

    function getStrokes() {
      return serializeStrokes(strokes);
    }

    resizeCanvas();

    if (!readOnly) {
      canvas.addEventListener(
        "pointerdown",
        function (e) {
          e.preventDefault();
          drawing = true;
          canvas.setPointerCapture(e.pointerId);
          current = [];
          var p = normalizePoint(e.clientX, e.clientY, canvas);
          current.push([p]);
          strokes.push(current[0]);
          if (onStrokeChange) onStrokeChange(serializeStrokes(strokes));
          redraw();
        },
        { passive: false }
      );

      canvas.addEventListener(
        "pointermove",
        function (e) {
          if (!drawing) return;
          e.preventDefault();
          pushPoint(e.clientX, e.clientY);
        },
        { passive: false }
      );

      canvas.addEventListener(
        "pointerup",
        function (e) {
          drawing = false;
          endStroke();
        },
        { passive: true }
      );

      canvas.addEventListener(
        "pointercancel",
        function () {
          drawing = false;
          endStroke();
        },
        { passive: true }
      );
    }

    return {
      redraw: redraw,
      loadStrokes: loadStrokes,
      getStrokes: getStrokes,
      clear: function () {
        strokes = [];
        current = [];
        baseSegmentCount = 0;
        redraw();
      }
    };
  }

  function drawCombined(canvas, strokes1, strokes2) {
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    function drawList(list, col, lw) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (var s = 0; s < list.length; s++) {
        var seg = list[s];
        if (!seg || seg.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(seg[0].x * CANVAS_W, seg[0].y * CANVAS_H);
        for (var i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x * CANVAS_W, seg[i].y * CANVAS_H);
        }
        ctx.stroke();
      }
    }
    drawList(strokes1 || [], "#ffffff", 2.5);
    drawList(strokes2 || [], "#4ecca3", 2.5);
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(el, seconds, onDone) {
    clearTimer();
    var left = seconds;
    function tick() {
      el.textContent = String(left);
      el.classList.toggle("urgent", left <= 2);
      if (left <= 0) {
        clearTimer();
        el.classList.remove("urgent");
        onDone();
        return;
      }
      left--;
    }
    tick();
    timerId = setInterval(tick, 1000);
  }

  function gameRef(id) {
    return db.collection("sketchGuessGames").doc(id);
  }

  function parseUrlParams() {
    var q = new URLSearchParams(window.location.search);
    return {
      game: (q.get("g") || q.get("game") || "").toUpperCase().trim(),
      role: q.get("r") || q.get("role")
    };
  }

  function baseUrl() {
    var u = window.location.href.split("?")[0];
    return u.replace(/index\.html$/, "");
  }

  function buildInviteLink(gameId, role) {
    return baseUrl() + "index.html?g=" + encodeURIComponent(gameId) + "&r=" + role;
  }

  function showWaitScreen(message, code, inviteLink) {
    $("wait-message").textContent = message;
    $("game-code-display").textContent = code || "";
    $("invite-instructions").textContent = inviteLink
      ? "Send this link to the next player (or they can enter the code on Join)."
      : "";
    $("invite-link").value = inviteLink || "";
    showScreen("screen-wait");
  }

  function copyInvite() {
    var ta = $("invite-link");
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      navigator.clipboard.writeText(ta.value).catch(function () {});
    }
  }

  function stopListen() {
    if (unsub) {
      unsub();
      unsub = null;
    }
  }

  // ——— Firestore game flow ———
  function createOnlineGame() {
    if (!db) {
      alert("Firebase is not configured. Use Local demo or add keys in js/config.js");
      return;
    }
    var id = randomGameId();
    var prompt = randomPrompt();
    addCreatedCode(id);
    currentGameId = id;
    gameRef(id)
      .set({
        prompt: prompt,
        phase: "p1",
        strokes1: [],
        strokes2: [],
        guess: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
      .then(function () {
        runP1Online(id, prompt);
      })
      .catch(function (e) {
        alert("Could not create game: " + e.message);
      });
  }

  function runP1Online(gameId, prompt) {
    currentGameId = gameId;
    $("p1-prompt").textContent = "Draw: " + prompt;
    var canvas = $("canvas-p1");
    var api = setupCanvasDrawing(canvas, { color: "#ffffff", onStrokeChange: function () {} });
    api.clear();
    $("btn-p1-done").disabled = true;
    showScreen("screen-p1");

    startTimer($("p1-timer"), DRAW_SECONDS, function () {
      submitP1Online(gameId, prompt, api);
    });

    setTimeout(function () {
      $("btn-p1-done").disabled = false;
    }, 300);

    $("btn-p1-done").onclick = function () {
      clearTimer();
      submitP1Online(gameId, prompt, api);
    };
  }

  function submitP1Online(gameId, prompt, drawApi) {
    var strokes = drawApi.getStrokes();
    $("btn-p1-done").disabled = true;
    gameRef(gameId)
      .update({
        strokes1: strokes,
        phase: "p2"
      })
      .then(function () {
        var link = buildInviteLink(gameId, "2");
        showWaitScreen("Player 1 done! Share with Player 2.", gameId, link);
      })
      .catch(function (e) {
        alert("Save failed: " + e.message);
      });
  }

  function runP2Online(gameId, data) {
    var s1 = data.strokes1 || [];
    var canvas = $("canvas-p2");
    var api = setupCanvasDrawing(canvas, { color: "#4ecca3" });
    api.loadStrokes(s1, "#ffffff");
    showScreen("screen-p2");
    startTimer($("p2-timer"), DRAW_SECONDS, function () {
      submitP2Online(gameId, api, s1);
    });
    setTimeout(function () {
      $("btn-p2-done").disabled = false;
    }, 300);
    $("btn-p2-done").onclick = function () {
      clearTimer();
      submitP2Online(gameId, api, s1);
    };
  }

  function submitP2Online(gameId, drawApi, strokes1Base) {
    var s1 = strokes1Base || [];
    var all = drawApi.getStrokes();
    var strokes2 = all.length > s1.length ? all.slice(s1.length) : [];
    $("btn-p2-done").disabled = true;
    gameRef(gameId)
      .update({
        strokes2: strokes2,
        phase: "p3"
      })
      .then(function () {
        var link = buildInviteLink(gameId, "3");
        showWaitScreen("Player 2 done! Share with Player 3.", gameId, link);
      })
      .catch(function (e) {
        alert("Save failed: " + e.message);
      });
  }

  function runP3Online(gameId, data) {
    var canvas = $("canvas-p3");
    drawCombined(canvas, data.strokes1, data.strokes2);
    $("p3-guess").value = "";
    showScreen("screen-p3");
    $("btn-p3-done").onclick = function () {
      var g = $("p3-guess").value.trim();
      if (!g) {
        alert("Type a guess!");
        return;
      }
      gameRef(gameId)
        .update({
          guess: g,
          phase: "done"
        })
        .then(function () {
          showResult(data.prompt, g, data.strokes1, data.strokes2);
        })
        .catch(function (e) {
          alert("Save failed: " + e.message);
        });
    };
  }

  function showResult(prompt, guess, s1, s2) {
    $("result-prompt").textContent = prompt;
    $("result-guess").textContent = guess || "—";
    drawCombined($("canvas-result"), s1, s2);
    showScreen("screen-result");
  }

  function listenGame(gameId) {
    stopListen();
    currentGameId = gameId;
    unsub = gameRef(gameId).onSnapshot(
      function (snap) {
        if (!snap.exists) {
          alert("Game not found.");
          showScreen("screen-home");
          return;
        }
        var d = snap.data();

        if (d.phase === "p1") {
          var s1a = d.strokes1 || [];
          if (s1a.length === 0 && isCreatorOf(gameId)) {
            if (!(document.getElementById("screen-p1") && document.getElementById("screen-p1").classList.contains("active"))) {
              runP1Online(gameId, d.prompt);
            }
          } else {
            showWaitScreen("Waiting for Player 1 to finish drawing…", gameId, "");
          }
          return;
        }
        if (d.phase === "p2") {
          var has2 = (d.strokes2 || []).length > 0;
          if (!has2) {
            if (!(document.getElementById("screen-p2") && document.getElementById("screen-p2").classList.contains("active"))) {
              runP2Online(gameId, d);
            }
          } else {
            showWaitScreen("Player 2 is done. Waiting for Player 3…", gameId, buildInviteLink(gameId, "3"));
          }
          return;
        }
        if (d.phase === "p3") {
          var guess = d.guess;
          if (guess) {
            stopListen();
            showResult(d.prompt, guess, d.strokes1, d.strokes2);
            return;
          }
          if (!(document.getElementById("screen-p3") && document.getElementById("screen-p3").classList.contains("active"))) {
            runP3Online(gameId, d);
          }
          return;
        }
        if (d.phase === "done") {
          stopListen();
          showResult(d.prompt, d.guess, d.strokes1, d.strokes2);
        }
      },
      function (err) {
        console.error(err);
        alert("Connection error: " + err.message);
      }
    );
  }

  function joinOnline(code) {
    if (!db) {
      alert("Firebase not configured.");
      return;
    }
    code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) {
      alert("Enter a valid game code.");
      return;
    }
    gameRef(code)
      .get()
      .then(function (snap) {
        if (!snap.exists) {
          alert("No game with that code.");
          return;
        }
        listenGame(code);
      })
      .catch(function (e) {
        alert(e.message);
      });
  }

  // Local demo
  function runLocalDemo() {
    localMode = true;
    localState = { prompt: randomPrompt(), strokes1: null, strokes2: null, step: 1 };
    runLocalP1();
  }

  function runLocalP1() {
    $("p1-prompt").textContent = "Draw: " + localState.prompt;
    var canvas = $("canvas-p1");
    var api = setupCanvasDrawing(canvas, { color: "#ffffff" });
    api.clear();
    $("btn-p1-done").disabled = true;
    showScreen("screen-p1");
    startTimer($("p1-timer"), DRAW_SECONDS, function () {
      localState.strokes1 = api.getStrokes();
      runLocalP2();
    });
    setTimeout(function () {
      $("btn-p1-done").disabled = false;
    }, 300);
    $("btn-p1-done").onclick = function () {
      clearTimer();
      localState.strokes1 = api.getStrokes();
      runLocalP2();
    };
  }

  function runLocalP2() {
    var canvas = $("canvas-p2");
    var api = setupCanvasDrawing(canvas, { color: "#4ecca3" });
    api.loadStrokes(localState.strokes1 || [], "#ffffff");
    showScreen("screen-p2");
    startTimer($("p2-timer"), DRAW_SECONDS, function () {
      var all = api.getStrokes();
      var s1 = localState.strokes1 || [];
      localState.strokes2 = all.length > s1.length ? all.slice(s1.length) : [];
      runLocalP3();
    });
    setTimeout(function () {
      $("btn-p2-done").disabled = false;
    }, 300);
    $("btn-p2-done").onclick = function () {
      clearTimer();
      var all = api.getStrokes();
      var s1 = localState.strokes1 || [];
      localState.strokes2 = all.length > s1.length ? all.slice(s1.length) : [];
      runLocalP3();
    };
  }

  function runLocalP3() {
    drawCombined($("canvas-p3"), localState.strokes1, localState.strokes2);
    $("p3-guess").value = "";
    showScreen("screen-p3");
    $("btn-p3-done").onclick = function () {
      var g = $("p3-guess").value.trim();
      if (!g) {
        alert("Type a guess!");
        return;
      }
      showResult(localState.prompt, g, localState.strokes1, localState.strokes2);
      localMode = false;
    };
  }

  function goHome() {
    stopListen();
    clearTimer();
    showScreen("screen-home");
  }

  document.addEventListener("DOMContentLoaded", function () {
    setFirebaseStatus();

    $("btn-new-game").addEventListener("click", function () {
      if (!initFirebase()) {
        alert("Add Firebase keys in js/config.js (see README) or use Local demo.");
        return;
      }
      createOnlineGame();
    });

    $("btn-join-game").addEventListener("click", function () {
      showScreen("screen-join");
    });

    $("btn-join-submit").addEventListener("click", function () {
      if (!initFirebase()) {
        alert("Add Firebase keys in js/config.js first.");
        return;
      }
      joinOnline($("join-code").value);
    });

    $("btn-local-demo").addEventListener("click", function () {
      stopListen();
      clearTimer();
      runLocalDemo();
    });

    $("btn-copy-invite").addEventListener("click", copyInvite);

    $("btn-play-again").addEventListener("click", goHome);

    document.querySelectorAll("[data-back]").forEach(function (btn) {
      btn.addEventListener("click", goHome);
    });

    var params = parseUrlParams();
    if (params.game && initFirebase()) {
      $("join-code").value = params.game;
      joinOnline(params.game);
    }
  });
})();

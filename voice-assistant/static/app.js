/* Voice Assistant Frontend
 * State machine: idle → listening → thinking → speaking → idle
 * STT: browser Web Speech API (primary), audio blob POST fallback
 * TTS: browser speechSynthesis
 * AI:  POST /chat  (SSE stream via fetch + ReadableStream)
 */

(function () {
  "use strict";

  // ── DOM refs ────────────────────────────────────────────────
  const body         = document.body;
  const micBtn       = document.getElementById("mic-btn");
  const micIcon      = document.getElementById("mic-icon");
  const stopIcon     = document.getElementById("stop-icon");
  const statusEl     = document.getElementById("status");
  const previewEl    = document.getElementById("transcript-preview");
  const messagesEl   = document.getElementById("messages");
  const chatEl       = document.getElementById("chat");

  // ── State ───────────────────────────────────────────────────
  const States = { IDLE: "idle", LISTENING: "listening", THINKING: "thinking", SPEAKING: "speaking" };
  let state = States.IDLE;
  let conversationHistory = [];  // [{role, content}]
  let recognition = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let abortController = null;
  let currentAiMsg = null;

  // ── State transitions ───────────────────────────────────────
  function setState(s) {
    state = s;
    body.classList.remove("listening", "thinking", "speaking");
    if (s !== States.IDLE) body.classList.add(s);

    const labels = {
      [States.IDLE]:      "Tap the mic to start",
      [States.LISTENING]: "Listening…",
      [States.THINKING]:  "Thinking…",
      [States.SPEAKING]:  "Speaking…",
    };
    statusEl.textContent = labels[s] || "";

    const busy = s === States.THINKING;
    micBtn.disabled = busy;
    micIcon.style.display = (s === States.LISTENING) ? "none" : "block";
    stopIcon.style.display = (s === States.LISTENING) ? "block" : "none";
  }

  // ── Message rendering ───────────────────────────────────────
  function appendMessage(role, text, toolNote) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    if (toolNote) {
      const tn = document.createElement("div");
      tn.className = "tool-note";
      tn.textContent = toolNote;
      div.appendChild(tn);
    }
    messagesEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function startStreamingMessage() {
    const div = document.createElement("div");
    div.className = "msg assistant streaming";
    messagesEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    currentAiMsg = div;
    return div;
  }

  function appendToStreamingMessage(text) {
    if (!currentAiMsg) return;
    currentAiMsg.textContent += text;
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function finalizeStreamingMessage(toolNote) {
    if (!currentAiMsg) return;
    currentAiMsg.classList.remove("streaming");
    if (toolNote) {
      const tn = document.createElement("div");
      tn.className = "tool-note";
      tn.textContent = toolNote;
      currentAiMsg.appendChild(tn);
    }
    currentAiMsg = null;
  }

  // ── TTS ─────────────────────────────────────────────────────
  function speak(text) {
    if (!text.trim() || !window.speechSynthesis) {
      setState(States.IDLE);
      return;
    }
    setState(States.SPEAKING);
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 1.05;
    utter.pitch = 1.0;

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /Samantha|Google US|en-US.*Female|Ava|Karen/i.test(v.name)
    ) || voices.find(v => v.lang === "en-US") || voices[0];
    if (preferred) utter.voice = preferred;

    utter.onend = () => setState(States.IDLE);
    utter.onerror = () => setState(States.IDLE);

    window.speechSynthesis.speak(utter);
  }

  // ── Send transcript to Claude ────────────────────────────────
  async function sendToAI(transcript) {
    if (!transcript.trim()) {
      setState(States.IDLE);
      return;
    }

    previewEl.textContent = "";
    appendMessage("user", transcript);
    conversationHistory.push({ role: "user", content: transcript });

    setState(States.THINKING);
    startStreamingMessage();

    let fullResponse = "";
    let toolNotes = [];

    abortController = new AbortController();

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          history: conversationHistory.slice(0, -1),  // exclude current user msg — backend appends it
        }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();          // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "text") {
            fullResponse += event.content;
            appendToStreamingMessage(event.content);
          } else if (event.type === "tool_start") {
            setState(States.THINKING);
            statusEl.textContent = `Using ${event.name}…`;
          } else if (event.type === "tool_done") {
            toolNotes.push(`${event.name}: ${event.result}`);
          } else if (event.type === "error") {
            appendToStreamingMessage("\n[Error: " + event.content + "]");
          } else if (event.type === "done") {
            streamDone = true;
            break;
          }
        }
      }

      finalizeStreamingMessage(toolNotes.length ? toolNotes.join(" · ") : null);
      conversationHistory.push({ role: "assistant", content: fullResponse });

      speak(fullResponse);

    } catch (err) {
      if (err.name === "AbortError") {
        finalizeStreamingMessage();
        setState(States.IDLE);
      } else {
        finalizeStreamingMessage();
        appendMessage("assistant", "Sorry, something went wrong. " + err.message);
        setState(States.IDLE);
      }
    }
  }

  // ── Web Speech API (primary STT) ─────────────────────────────
  function startWebSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setState(States.LISTENING);

    recognition.onresult = (e) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      previewEl.textContent = final || interim;
    };

    recognition.onend = () => {
      const transcript = previewEl.textContent.trim();
      if (transcript && state === States.LISTENING) {
        sendToAI(transcript);
      } else if (state === States.LISTENING) {
        setState(States.IDLE);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        statusEl.textContent = "Microphone access denied";
      }
      setState(States.IDLE);
    };

    recognition.start();
    return true;
  }

  function stopWebSpeechRecognition() {
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
  }

  // ── MediaRecorder fallback STT ────────────────────────────────
  async function startMediaRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunks, { type: mimeType });
        const transcript = await serverTranscribe(blob);
        if (transcript) {
          previewEl.textContent = transcript;
          sendToAI(transcript);
        } else {
          setState(States.IDLE);
          statusEl.textContent = "Could not understand — try again";
        }
      };

      mediaRecorder.start();
      setState(States.LISTENING);
    } catch {
      statusEl.textContent = "Microphone access denied";
      setState(States.IDLE);
    }
  }

  function stopMediaRecorder() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  async function serverTranscribe(blob) {
    setState(States.THINKING);
    const form = new FormData();
    form.append("audio", blob, "audio.wav");
    try {
      const res  = await fetch("/transcribe", { method: "POST", body: form });
      const data = await res.json();
      return data.transcript || "";
    } catch {
      return "";
    }
  }

  // ── Mic button handler ────────────────────────────────────────
  micBtn.addEventListener("click", () => {
    if (micBtn.disabled) return;

    if (state === States.SPEAKING) {
      window.speechSynthesis.cancel();
      setState(States.IDLE);
      return;
    }

    if (state === States.LISTENING) {
      // Stop listening
      stopWebSpeechRecognition();
      stopMediaRecorder();
      return;
    }

    if (state === States.IDLE) {
      previewEl.textContent = "";
      const usedWebSpeech = startWebSpeechRecognition();
      if (!usedWebSpeech) startMediaRecorder();
    }
  });

  // Load voices asynchronously (Chrome quirk)
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.getVoices();
  }

  // ── Init ─────────────────────────────────────────────────────
  setState(States.IDLE);
})();

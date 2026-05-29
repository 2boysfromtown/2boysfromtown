"""
Voice Assistant — Powered by Claude AI
=======================================
A Siri-like voice assistant that listens to your microphone,
transcribes your speech, and responds using Claude claude-sonnet-4-6
with tool use (get_time, calculate) and streaming.

Setup:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...
    python app.py

Then open http://localhost:5000 in Chrome or Edge (Web Speech API required).

Optional: For server-side transcription fallback, no extra config needed
— it uses Google's free STT via the SpeechRecognition library.
"""

import os
import json
import ast
import operator
from datetime import datetime
from flask import Flask, render_template, request, Response, stream_with_context, jsonify

try:
    import anthropic
    _has_anthropic = True
except ImportError:
    _has_anthropic = False

try:
    import speech_recognition as sr
    _has_sr = True
except ImportError:
    _has_sr = False

app = Flask(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

CLAUDE_TOOLS = [
    {
        "name": "get_time",
        "description": "Get the current date and time. Use this when the user asks what time it is, what day it is, or the current date.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "calculate",
        "description": (
            "Evaluate a safe mathematical expression. "
            "Supports +, -, *, /, ** (power), // (floor div), % (modulo), and parentheses. "
            "Use this for any arithmetic the user asks about."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression to evaluate, e.g. '(10 * 5) / 2' or '2 ** 10'",
                }
            },
            "required": ["expression"],
        },
    },
]

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _safe_eval(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp):
        op = _OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"Operation not allowed: {type(node.op).__name__}")
        return op(_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp):
        op = _OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"Operation not allowed: {type(node.op).__name__}")
        return op(_safe_eval(node.operand))
    raise ValueError(f"Expression type not allowed: {type(node).__name__}")


def run_tool(name: str, tool_input: dict) -> str:
    if name == "get_time":
        now = datetime.now()
        return now.strftime("Today is %A, %B %d, %Y. The current time is %I:%M %p.")

    if name == "calculate":
        expr = tool_input.get("expression", "").strip()
        try:
            tree = ast.parse(expr, mode="eval")
            result = _safe_eval(tree.body)
            if isinstance(result, float) and result.is_integer():
                result = int(result)
            return f"{expr} = {result}"
        except ZeroDivisionError:
            return "Error: division by zero."
        except Exception as e:
            return f"Could not evaluate '{expr}': {e}"

    return f"Unknown tool: {name}"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """Server-side STT fallback using Python SpeechRecognition + Google backend."""
    if not _has_sr:
        return jsonify({"transcript": "", "error": "SpeechRecognition not installed"}), 200

    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"transcript": "", "error": "No audio file provided"}), 400

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
        transcript = recognizer.recognize_google(audio_data)
        return jsonify({"transcript": transcript})
    except sr.UnknownValueError:
        return jsonify({"transcript": "", "error": "Speech not understood"})
    except sr.RequestError as e:
        return jsonify({"transcript": "", "error": f"STT service error: {e}"})
    except Exception as e:
        return jsonify({"transcript": "", "error": str(e)})


@app.route("/chat", methods=["POST"])
def chat():
    """Streaming SSE endpoint. Accepts JSON {message, history}, streams Claude's reply."""
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    history = data.get("history") or []

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    if not ANTHROPIC_API_KEY or not _has_anthropic:
        def mock_stream():
            yield _sse({"type": "text", "content": "I'm running in demo mode — no API key set. You said: "})
            yield _sse({"type": "text", "content": user_message})
            yield _sse({"type": "done"})
        return Response(
            stream_with_context(mock_stream()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    messages = list(history)
    messages.append({"role": "user", "content": user_message})

    def generate():
        current_messages = list(messages)

        while True:
            accumulated_text = ""
            tool_calls = []
            stop_reason = None

            try:
                with client.messages.stream(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    system=(
                        "You are a friendly, concise voice assistant. "
                        "Your responses will be read aloud, so avoid markdown — "
                        "no bullet points, no headers, no bold text. "
                        "Speak naturally and keep answers brief unless detail is needed."
                    ),
                    tools=CLAUDE_TOOLS,
                    messages=current_messages,
                ) as stream:
                    for event in stream:
                        if hasattr(event, "type"):
                            if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                                chunk = event.delta.text
                                accumulated_text += chunk
                                yield _sse({"type": "text", "content": chunk})

                    final = stream.get_final_message()
                    stop_reason = final.stop_reason

                    for block in final.content:
                        if block.type == "tool_use":
                            tool_calls.append(
                                {"id": block.id, "name": block.name, "input": block.input}
                            )

            except anthropic.AuthenticationError:
                yield _sse({"type": "error", "content": "Invalid API key. Check your ANTHROPIC_API_KEY."})
                break
            except Exception as e:
                yield _sse({"type": "error", "content": str(e)})
                break

            if stop_reason != "tool_use" or not tool_calls:
                break

            # Notify frontend that tools are running
            for tc in tool_calls:
                yield _sse({"type": "tool_start", "name": tc["name"]})

            # Build assistant turn with tool_use blocks
            assistant_content = []
            if accumulated_text:
                assistant_content.append({"type": "text", "text": accumulated_text})
            for tc in tool_calls:
                assistant_content.append(
                    {"type": "tool_use", "id": tc["id"], "name": tc["name"], "input": tc["input"]}
                )
            current_messages.append({"role": "assistant", "content": assistant_content})

            # Run tools and build tool_results
            tool_results = []
            for tc in tool_calls:
                result = run_tool(tc["name"], tc["input"])
                yield _sse({"type": "tool_done", "name": tc["name"], "result": result})
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tc["id"], "content": result}
                )
            current_messages.append({"role": "user", "content": tool_results})

        yield _sse({"type": "done"})

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

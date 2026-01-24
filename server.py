import json
import threading
import time
from typing import Generator

import cv2
from flask import Flask, Response, jsonify, request, send_from_directory

from config import CFG
from camera_manager import CameraManager
from event_store import EventStore
from actions import Actions
from pipeline import Pipeline

app = Flask(__name__, static_folder="web", static_url_path="")

store = EventStore(CFG.log_path, maxlen=CFG.max_events_in_memory)
actions = Actions(CFG.snapshot_dir)
pipeline = Pipeline(store, actions)

camera = CameraManager(CFG.camera_index, CFG.width, CFG.height)

# Shared latest JPEG bytes for /video_feed
_latest_jpeg = None
_jpeg_lock = threading.Lock()

def _encode_jpeg(frame_bgr) -> bytes:
    ok, buf = cv2.imencode(".jpg", frame_bgr)
    if not ok:
        return b""
    return buf.tobytes()

def _processing_thread():
    camera.open()
    try:
        for _ in pipeline.run_forever_generator():
            ok, frame = camera.read()
            if not ok:
                continue

            annotated = pipeline.step(frame)
            jpg = _encode_jpeg(annotated)

            with _jpeg_lock:
                global _latest_jpeg
                _latest_jpeg = jpg
    finally:
        camera.close()

@app.route("/")
def index():
    # Serve Jaskaran's UI
    return send_from_directory("web", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("web", path)

@app.route("/video_feed")
def video_feed():
    def gen() -> Generator[bytes, None, None]:
        while True:
            with _jpeg_lock:
                jpg = _latest_jpeg
            if jpg:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
            time.sleep(0.03)
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/events")
def events_sse():
    """
    Server-Sent Events stream of latest events.
    Frontend can listen with:
      const es = new EventSource("/events");
      es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    def gen():
        last_len = 0
        while True:
            events = store.latest(50)
            if len(events) != last_len:
                # Send only the newest event (simple + low bandwidth)
                newest = events[-1]
                yield f"data: {json.dumps(newest)}\n\n"
                last_len = len(events)
            time.sleep(0.25)

    return Response(gen(), mimetype="text/event-stream")

@app.route("/api/latest_events")
def api_latest_events():
    return jsonify(store.latest(50))

@app.route("/api/mode", methods=["GET", "POST"])
def api_mode():
    if request.method == "GET":
        return jsonify({"mode": pipeline.mode})

    data = request.get_json(silent=True) or {}
    mode = data.get("mode")
    try:
        pipeline.set_mode(mode)
        return jsonify({"ok": True, "mode": pipeline.mode})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

def start_background_processing():
    t = threading.Thread(target=_processing_thread, daemon=True)
    t.start()

if __name__ == "__main__":
    start_background_processing()
    app.run(host=CFG.host, port=CFG.port, threaded=True)

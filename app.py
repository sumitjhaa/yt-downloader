from flask import Flask, request, jsonify, send_file, render_template, Response
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import json
import threading
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# In-memory store: job_id -> progress dict
jobs = {}

YDL_BASE_OPTS = {
    "quiet": True,
    "cookiefile": "cookies.txt",
    "extractor_args": {
        "youtube": {
            "player_client": ["android", "web"],
        }
    },
    "http_headers": {
        "User-Agent": "com.google.android.youtube/17.36.4 (Linux; U; Android 12) gzip"
    },
}


def make_progress_hook(job_id):
    def hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            speed = d.get("speed") or 0
            eta = d.get("eta") or 0
            pct = round((downloaded / total * 100)) if total else 0
            jobs[job_id] = {
                "status": "downloading",
                "percent": pct,
                "speed": round(speed / 1024 / 1024, 2) if speed else 0,
                "eta": eta,
                "downloaded": round(downloaded / 1024 / 1024, 1),
                "total": round(total / 1024 / 1024, 1),
            }
        elif d["status"] == "finished":
            jobs[job_id] = {"status": "merging", "percent": 95}
        elif d["status"] == "error":
            jobs[job_id] = {"status": "error", "percent": 0}
    return hook


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/info", methods=["POST"])
def get_info():
    url = request.json.get("url")
    if not url:
        return jsonify({"error": "No URL"}), 400
    try:
        with yt_dlp.YoutubeDL(YDL_BASE_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)
        resolutions = sorted(
            {f["height"] for f in info.get("formats", [])
             if f.get("vcodec") != "none" and f.get("height")},
            reverse=True
        )
        return jsonify({
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "uploader": info.get("uploader"),
            "channel": info.get("channel"),
            "view_count": info.get("view_count"),
            "like_count": info.get("like_count"),
            "upload_date": info.get("upload_date"),
            "max_resolution": resolutions[0] if resolutions else None,
            "resolutions": resolutions,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/start_download", methods=["POST"])
def start_download():
    """Kick off download in background thread, return job_id immediately."""
    data = request.json
    url = data.get("url")
    resolution = data.get("resolution", "best")
    if not url:
        return jsonify({"error": "No URL"}), 400

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "starting", "percent": 0}
    tmp_dir = tempfile.mkdtemp()

    def run():
        try:
            fmt = "bestaudio/best" if resolution == "audio" else \
                  f"bestvideo[height<={resolution}]+bestaudio/best[height<={resolution}]/best"
            opts = {
                **YDL_BASE_OPTS,
                "format": fmt,
                "outtmpl": os.path.join(tmp_dir, "%(title)s.%(ext)s"),
                "merge_output_format": "mp4",
                "progress_hooks": [make_progress_hook(job_id)],
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                fname = ydl.prepare_filename(info)
                if not os.path.exists(fname):
                    fname = fname.rsplit(".", 1)[0] + ".mp4"
            jobs[job_id] = {"status": "done", "percent": 100, "file": fname}
        except Exception as e:
            jobs[job_id] = {"status": "error", "percent": 0, "error": str(e)}

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"job_id": job_id})


@app.route("/progress/<job_id>")
def progress_stream(job_id):
    def generate():
        import time
        while True:
            state = jobs.get(job_id, {"status": "unknown", "percent": 0})
            yield f"data: {json.dumps(state)}\n\n"
            if state.get("status") in ("done", "error"):
                break
            time.sleep(0.4)
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
            "Connection": "keep-alive",
        }
    )


@app.route("/serve/<job_id>")
def serve_file(job_id):
    """Once job is done, serve the file for download."""
    state = jobs.get(job_id)
    if not state or state.get("status") != "done":
        return jsonify({"error": "Not ready"}), 404
    return send_file(
        state["file"],
        as_attachment=True,
        download_name=os.path.basename(state["file"]),
        mimetype="video/mp4"
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)

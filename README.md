# yt-downloader: YouTube Video Downloader

**yt-downloader** is a modern, user-friendly web application for downloading YouTube videos in various resolutions and formats. Built with Flask (Python) and yt-dlp, it offers a responsive UI, real-time progress tracking, and support for both video and audio downloads.

---

## Features

- **Video & Audio Downloads**: Download videos in MP4/WebM or extract audio only.
- **Resolution Selection**: Choose from all available resolutions (up to 1080p, 4K if available).
- **Real-time Progress**: Live progress bar with speed, ETA, and download size.
- **History**: Keep track of recent downloads.
- **Theme Support**: Multiple UI themes (VS Dark, Dracula, Nord, etc.).
- **Responsive Design**: Works on mobile and desktop.

---

## Tech Stack

- **Backend**: Flask (Python)
- **Video Downloader**: yt-dlp (fork of youtube-dl with more features and fixes)
- **Frontend**: HTML, CSS, JavaScript (no external dependencies)
- **Progress Tracking**: Server-Sent Events (SSE)

---

## Setup & Installation

### Prerequisites

- Python 3.8+
- pip
- FFmpeg (for merging video and audio streams)

### Installation

1.  Clone this repository:

    ```
    git clone https://github.com/sumitjhaa/yt-downloader.git
    cd yt-downloader
    ```

2.  Install dependencies:

    ```
    pip install flask yt-dlp flask-cors
    ```

3.  Run the application:

    ```
    python app.py
    ```

4.  Open your browser and navigate to:
    ```
    http://localhost:5000
    ```

---

## Usage

1.  **Enter a YouTube URL** in the input field.
2.  **Fetch Info**: Click "Fetch Info" to load video details.
3.  **Select Quality & Format**: Choose your preferred resolution and format (MP4, WebM, or Audio).
4.  **Download**: Click "Download" to start the download. Progress will be shown in real-time.
5.  **History**: Recent downloads are saved and can be revisited.

---

## API Endpoints

| Endpoint           | Method | Description                                        |
| ------------------ | ------ | -------------------------------------------------- |
| /                  | GET    | Serve the main page                                |
| /info              | POST   | Fetch video info (title, thumbnail, formats, etc.) |
| /start_download    | POST   | Start a download job (returns job_id)              |
| /progress/<job_id> | GET    | Stream download progress (SSE)                     |
| /serve/<job_id>    | GET    | Serve the downloaded file                          |

---

## Configuration

- **Themes**: Change the UI theme via the dropdown in the navbar.
- **Auto Mode**: Syncs with your system’s dark/light mode preference.
- **History**: Up to 6 recent downloads are stored in localStorage.

---

## Best Practices & Notes

- **FFmpeg**: Required for merging video and audio streams. Install via your package manager or [FFmpeg’s official site](https://ffmpeg.org/).
- **Rate Limiting**: Consider adding rate limits to prevent abuse (see [Flask-Limiter](https://flask-limiter.readthedocs.io/)).
- **Security**: For production, use HTTPS, set a secret key, and consider adding authentication.
- **Cleanup**: Downloaded files are stored in a temporary directory and are not automatically deleted. For a production app, implement a cleanup mechanism.

---

## License

This project is open-source and available under the MIT License.

---

## Contributing

Pull requests and issue reports are welcome! For major changes, please open an issue first.

---

## Acknowledgements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for the powerful video downloading library.
- [Flask](https://flask.palletsprojects.com/) for the web framework.
- All theme authors for their beautiful CSS themes.

---

**Enjoy downloading!** If you have questions or suggestions, feel free to open an issue or contact the maintainer.

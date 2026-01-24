from server import start_background_processing, app
from config import CFG

if __name__ == "__main__":
    start_background_processing()
    app.run(host=CFG.host, port=CFG.port, threaded=True)

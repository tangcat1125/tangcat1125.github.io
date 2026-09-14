from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
ROOT=Path(__file__).parent
class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
if __name__=='__main__':
    print('猜拳遊戲已啟動：http://localhost:8000')
    ThreadingHTTPServer(('127.0.0.1',8000),GameHandler).serve_forever()

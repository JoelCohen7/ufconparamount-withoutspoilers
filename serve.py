# Local server only for installing the script in Tampermonkey (explicit UTF-8).
import http.server, functools, os
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.dirname(os.path.abspath(__file__)))
H.func.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript; charset=utf-8"}
http.server.ThreadingHTTPServer(("127.0.0.1", 8765), H).serve_forever()

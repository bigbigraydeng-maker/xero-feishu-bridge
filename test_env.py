import sys
print("Python executable:", sys.executable)
print("Python version:", sys.version)

try:
    import flask
    print("Flask version:", flask.__version__)
except ImportError as e:
    print("Flask not installed:", e)

try:
    import requests
    print("Requests version:", requests.__version__)
except ImportError as e:
    print("Requests not installed:", e)

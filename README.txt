If you want TLS:
    first time only:
        pip3 install jsonschema jinja2 --break-system-packages
    mkdir build && cd build
    cmake ..
    make

Normal run with cmake:

cmake --build build && ./webcorn

If you don't

./webcorn
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

Reset stuff for the server

cd ~/webcorn
rm -rf build
mkdir build
cd build
cmake ..
make
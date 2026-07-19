Flags cheat sheet

For the intial build (cmake -B build):
    cmake -B build -DUSE_TLS=[ON/OFF] : Use to turn TLS on or off when compiling
        If you want TLS you need to do this first:
            first time only:
                pip3 install jsonschema jinja2 --break-system-packages
            mkdir build && cd build
            cmake ..
            make

For running webcorn (./webcorn)
    --unitcode=[file path] : sets what webrunner to use (by default it's webrunner.gld)
    --twigcode=[file path] : sets what project is being launched (by deafult it's test.twg)
    --port=[number] : sets the port (by default its 8080)
    --tls=[cert/self] : with tls on, select from the self certification or the proper letsencrypt certification.
    --private : disables guests and forces login
    --debug : turns debug features on, namely no terminate handler, and Thistle will auto-log in as Fir.
    --files : directories to whiteliest, only goes one directory deep, seperated by commas



Normal run with cmake:

cmake --build build && ./webcorn

Thistle debug run (no tls):
./webcorn --port=443 --private --twigcode=web/thistle/thistle.twg --debug
cmake --build build && ./webcorn --port=443 --private --twigcode=web/thistle/thistle.twg --debug

Thistle run production (enable tls first by rebuilding):
./webcorn --port=443 --tls=cert --private --twigcode=web/thistle/thistle.twg

Test running
cmake --build build && ./webcorn --port=443 --twigcode=web/test.twg --debug

If you don't

./webcorn

Reset stuff for the server

cd ~/webcorn
rm -rf build
mkdir build
cd build
cmake ..
make


Flags cheat sheet

For the intial build (cmake -B build):
    cmake -B build -DUSE_TLS=ON : Use to turn TLS on or off when compiling
    cmake -B build -DUSE_ASAN=ON : ASAN is also an option
    to use clang: -DCMAKE_CXX_COMPILER=clang++
        If you want TLS you need to do this first:
            first time only:
                pip3 install jsonschema jinja2 --break-system-packages
            mkdir build && cd build
            cmake ..
            make

For running webcorn (./webcorn)
    --project=[file path] : sets the project path everything will be looked for in
    --unitcode=[file path] : sets what webrunner to use (by default it's webrunner.gld)
    --twigcode=[file path] : sets what project is being launched (by deafult it's test.twg)
    --port=[number] : sets the port (by default its 8080)
    --tls=[cert/self] : with tls on, select from the self certification or the proper letsencrypt certification.
    --private : disables guests and forces login
    --debug : turns debug features on, namely no terminate handler, and Thistle will auto-log in as Fir.
    --files : directories to whiteliest, only goes one directory deep, seperated by commas
    --script : a script to run on startup
    --units : how many units to startup, this is needed for Webcorn

For running Hazel (./hazel)



Normal run with cmake:

cmake --build build && ./webcorn

Thistle debug run (no tls):
./webcorn --port=443 --private --twigcode=web/thistle/thistle.twg --debug
cmake --build build && ./webcorn --port=443 --project=web/thistle/ --private --twigcode=web/thistle/thistle.twg --debug

Thistle run production (enable tls first by rebuilding):
./webcorn --port=443 --tls=cert --private --twigcode=web/thistle/thistle.twg

Test running
cmake --build build && ./webcorn --port=443 --twigcode=web/test.twg

Website
cmake --build build && ./webcorn --port=443 --twigcode=web/goldensystems/website.twg --files=web/goldensystems/files

Election Madness
cmake --build build && ./webcorn --port=443 --private --project=web/electionmadness/ --twigcode=web/electionmadness/website.twg --files=web/electionmadness/files --script=web/electionmadness/init.gld
cmake --build build && ./webcorn --port=443 --private --tls=cert --project=web/electionmadness/ --twigcode=web/electionmadness/website.twg --files=web/electionmadness/files --script=web/electionmadness/init.gld


cmake --build build && ./hazel ./webcorn --port=443 --project=web/electionmadness/ --twigcode=web/electionmadness/website.twg --files=web/electionmadness/files --script=web/electionmadness/init.gld --verbosity=3 --units=8

cmake --build build && ./hazel ./webcorn --port=443 --project=web/electionmadness/ --twigcode=web/electionmadness/website.twg --files=web/electionmadness/files --script=web/electionmadness/init.gld --verbosity=1 --units=12

Standard production launch:
ulimit -n 65536 && cmake --build build && ./hazel ./webcorn --port=443 --project=web/electionmadness/ --tls=cert --verbosity=0 --units=8

cmake --build build && ./webcorn --port=443 --project=web/electionmadness/ --units=2 --verbosity=3

./hazel ./webcorn --port=8080 --project=web/electionmadness/ --tls=cert --verbosity=3 --units=2

ulimit -n 65536 && cmake --build build && ./hazel ./webcorn --port=443 --project=web/goldensystems/ --tls=cert  --track --tickint=5 --units=4

If you don't

./webcorn

Reset stuff for the server

cd ~/webcorn
rm -rf build
mkdir build
cd build
cmake ..
make

